import { prisma } from "@/lib/prisma";
import {
  normalizeRole,
  resolveCitizensWinByGameResult,
} from "./evaluationUtils"

const CONFIG = {
  START_SCORE: 50,
  WEIGHTS: {
    plus: { voting: 15, nomination: 12, special: 20, speech: 5, kill: 15, triangleWin: 30 },
    minus: { voting: -10, nomination: -12, special: -20, speech: -5, failedKill: -15, triangleLoss: -20 }
  }
};

/*
function normalizeRole(role: any) {
  return String(role || "").trim().toLowerCase();
}

function isMafiaRole(role: string) {
  return ["mafia", "don", "мафія", "дон"].includes(normalizeRole(role));
}

function isCitizenRole(role: string) {
  return ["citizen", "commissar", "doctor", "мирний", "мирний житель", "комісар", "лікар", "sheriff", "sherif"].includes(normalizeRole(role));
}

function resolveCitizensWinByGameResult(role: string, result: string) {
  const normalizedRole = normalizeRole(role);
  const normalizedResult = String(result || "").trim().toLowerCase();

  if (normalizedResult !== "win" && normalizedResult !== "lose") {
    throw new Error(`Unknown GameResult.result value: ${result}`);
  }

  if (isCitizenRole(normalizedRole)) {
    return normalizedResult === "win";
  }

  if (isMafiaRole(normalizedRole)) {
    return normalizedResult === "lose";
  }

  throw new Error(`Unknown mafia role in GameResult.stats.role: ${role}`);
}
  */

export async function evaluateAndSaveGameResults(gameSessionId: string) {
  try {
    // 1. Завантажуємо сесію гри з усіма гравцями та їхніми юзернеймами
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        players: { include: { user: { select: { username: true } } } },
      },
    });

    if (!session) {
      console.error(`❌ [Evaluation] Сесію гри ${gameSessionId} не знайдено.`);
      return;
    }

    const sessionState = (session.state as any) || {};
    const sessionActions = (session.actions as any) || {};
    
    const timeline = sessionState.timeline || sessionActions.timeline || [];
    const snapshots = sessionState.snapshots || sessionActions.snapshots || { nights: [], days: [], votings: [] };

    // Формуємо масив гравців за стільцями
    const players = session.players.map((p: any) => ({
      userId: p.userId,
      username: p.user?.username || `user_${p.number}`,
      number: p.number,
      role: p.role?.toLowerCase() || "citizen",
    })).sort((a: any, b: any) => a.number - b.number);

    const mafiaIds = players.filter(p => p.role === 'mafia' || p.role === 'don').map(p => p.userId);
    const sheriffId = players.find(p => ['commissar', 'комісар', 'sheriff', 'sherif'].includes(p.role))?.userId;
    const doctorId = players.find(p => ['doctor', 'лікар'].includes(p.role))?.userId;

    const representativeResult = await prisma.gameResult.findFirst({
      where: {
        gameId: gameSessionId,
        gameType: "mafia",
      },
      select: {
        userId: true,
        result: true,
        stats: true,
      },
    });

    if (!representativeResult) {
      console.warn(`⚠️ [Evaluation] Для сесії ${gameSessionId} не знайдено GameResult. Оцінювання пропущено.`);
      return;
    }

    const representativePlayer = players.find(p => p.userId === representativeResult.userId);

    const representativeRole =
      normalizeRole((representativeResult.stats as any)?.role) ||
      normalizeRole(representativePlayer?.role);

    const isCitizensWin = resolveCitizensWinByGameResult(
      representativeRole,
      representativeResult.result
    );

    const finalWinnerTeam = isCitizensWin ? "Мирне місто" : "Мафія";

    const eliminatedMafiaIds: string[] = [];
    const statsMap: Record<string, any> = {};

    // Ініціалізація внутрішньої карти для кожного з гравців сесії
    players.forEach((p) => {
      const isMafiaTeam = mafiaIds.includes(p.userId);
      statsMap[p.userId] = {
        userId: p.userId,
        username: p.username,
        number: p.number,
        role: p.role,
        isMafiaTeam,
        isWinner: isCitizensWin ? !isMafiaTeam : isMafiaTeam,
        score: CONFIG.START_SCORE,
        rawTheses: [] as { type: 'plus' | 'minus'; priority: number; text: string }[],
        actionLogs: [] as string[],
        
        isKilledNight2: false,
        isInTriangle: false,
        isLastMafiaClutch: false,

        doctorSavesCount: 0,
        sheriffMafiaChecks: 0,
        donFoundSheriffAtNight: null,
        successfulMafiaNominations: 0,
        mafiaVotedCount: 0,
        
        hasVotedOrNominated: false,
        votedOnlyAgainstMafia: true,
        nominatedOnlyAgainstMafia: true
      };
    });

    const daySnapshots = snapshots.days || [];
    const nightSnapshots = snapshots.nights || [];
    const votingSnapshots = snapshots.votings || [];

    // Збір вигнаної мафії
    timeline.forEach((event: any) => {
      if (event.type !== "speech") return;
      if (event.speechType !== "single_elim" && event.speechType !== "voting_elim") return;

      const eliminatedId = event.playerId;

      if (
        eliminatedId &&
        mafiaIds.includes(eliminatedId) &&
        !eliminatedMafiaIds.includes(eliminatedId)
      ) {
        eliminatedMafiaIds.push(eliminatedId);
      }
    });

    // 2. АНАЛІЗ СМЕРТЕЙ ТА ТРИКУТНИКІВ
    const night2 = nightSnapshots.find((n: any) => n.night === 2);
    if (night2 && night2.killedPlayerId) {
      if (statsMap[night2.killedPlayerId]) {
        statsMap[night2.killedPlayerId].isKilledNight2 = true;
      }
    }

    let trianglePlayersDetected: string[] = [];
    const triangleDay = daySnapshots.find(
      (d: any) => Array.isArray(d.alivePlayers) && d.alivePlayers.length === 3
    );

    const triangleNight = nightSnapshots.find(
      (n: any) => Array.isArray(n.alivePlayers) && n.alivePlayers.length === 3
    );

    const triangleVote = votingSnapshots.find(
      (v: any) => v.votes && Object.keys(v.votes).length === 3
    );

    if (triangleDay) {
      trianglePlayersDetected = triangleDay.alivePlayers;
    } else if (triangleNight) {
      trianglePlayersDetected = triangleNight.alivePlayers;
    } else if (triangleVote) {
      trianglePlayersDetected = Object.keys(triangleVote.votes);
    }

    if (trianglePlayersDetected.length === 3) {
      const mafiaCount = trianglePlayersDetected.filter(id => mafiaIds.includes(id)).length;
      const citizensCount = trianglePlayersDetected.filter(id => !mafiaIds.includes(id)).length;
      if (citizensCount === 2 && mafiaCount === 1) {
        trianglePlayersDetected.forEach((id) => {
          if (statsMap[id]) statsMap[id].isInTriangle = true;
        });
      }
    }

    if (!isCitizensWin && trianglePlayersDetected.length === 3) {
      const triangleMafia = trianglePlayersDetected.filter(id => mafiaIds.includes(id));
      const triangleCitizens = trianglePlayersDetected.filter(id => !mafiaIds.includes(id));

      if (triangleMafia.length === 1 && triangleCitizens.length === 2) {
        const clutchMafiaId = triangleMafia[0];

        if (statsMap[clutchMafiaId]) {
          statsMap[clutchMafiaId].isLastMafiaClutch = true;
        }
      }
    }

    // 3. ОБРОБКА ТАЙМЛАЙНУ
    timeline.forEach((event: any) => {
      const pId = event.playerId || event.userId || event.nominatorId;
      if (!pId || !statsMap[pId]) return;

      const pStat = statsMap[pId];
      if (pStat.isKilledNight2) return; 

      const currentDay = event.day || event.dayNumber || 1;

      if (event.type === 'speech') {
        const duration = event.durationSec || event.duration || 0;
        if (duration >= 40) {
          pStat.score += CONFIG.WEIGHTS.plus.speech;
          pStat.actionLogs.push(`[День ${currentDay}] Повноцінна промова (${duration}с): +${CONFIG.WEIGHTS.plus.speech} балів`);
          pStat.rawTheses.push({ type: 'plus', priority: 4, text: "Довга промова. Помітка. Плюс" });
        } else if (duration <= 10 && duration > 0) {
          pStat.score += CONFIG.WEIGHTS.minus.speech;
          pStat.actionLogs.push(`[День ${currentDay}] Дуже коротка промова (${duration}с): ${CONFIG.WEIGHTS.minus.speech} балів`);
          pStat.rawTheses.push({ type: 'minus', priority: 4, text: "Коротка промова. Помітка. Мінус" });
        }
      }

      if (event.type === 'nomination' && event.nominatorId && event.nominatorId !== 'system') {
        const targetId = event.targetId;
        if (targetId && statsMap[targetId]) {
          const targetStat = statsMap[targetId];
          pStat.hasVotedOrNominated = true;

          if (!pStat.isMafiaTeam) {
            if (targetStat.isMafiaTeam) {
              pStat.score += CONFIG.WEIGHTS.plus.nomination;
              pStat.successfulMafiaNominations++;
              pStat.actionLogs.push(`[День ${currentDay}] Виставив на голосування мафію ${targetStat.username}: +${CONFIG.WEIGHTS.plus.nomination} балів`);
              pStat.rawTheses.push({ type: 'plus', priority: 2, text: "Правильна номінація. Помітка. Плюс" });
            } else {
              pStat.score += CONFIG.WEIGHTS.minus.nomination;
              pStat.nominatedOnlyAgainstMafia = false;
              pStat.actionLogs.push(`[День ${currentDay}] Помилково виставив мирного ${targetStat.username}: ${CONFIG.WEIGHTS.minus.nomination} балів`);
              pStat.rawTheses.push({ type: 'minus', priority: 3, text: "Неправильна номінація. Помітка. Мінус" });
            }
          } else {
            if (targetId === sheriffId || targetId === doctorId) {
              pStat.score += CONFIG.WEIGHTS.plus.nomination;
            } else if (mafiaIds.includes(targetId)) {
              pStat.score += CONFIG.WEIGHTS.minus.nomination;
              pStat.rawTheses.push({ type: 'minus', priority: 2, text: "Голосування в своїх напарників. Помітка. Мінус" });
            }
          }
        }
      }
    });

    // 4. АНАЛІЗ ГОЛОСУВАНЬ ЗІ СНАПШОТІВ
    votingSnapshots.forEach((vSnapshot: any) => {
      const vDay = vSnapshot.day || 2;
      const votesBlock = vSnapshot.votes || {};

      Object.entries(votesBlock).forEach(([voterId, targetId]) => {
        if (!statsMap[voterId] || !statsMap[targetId as string]) return;
        
        const pStat = statsMap[voterId];
        if (pStat.isKilledNight2) return;

        const targetStat = statsMap[targetId as string];
        pStat.hasVotedOrNominated = true;

        if (pStat.isInTriangle && trianglePlayersDetected.includes(voterId)) {
          if (!pStat.isMafiaTeam) {
            if (targetStat.isMafiaTeam) {
              pStat.score += CONFIG.WEIGHTS.plus.triangleWin;
              pStat.mafiaVotedCount++;
              pStat.actionLogs.push(`[Голосування. Трикутник] Точний вирішальний голос проти Дона/Мафії ${targetStat.username}: +${CONFIG.WEIGHTS.plus.triangleWin} балів`);
            } else {
              pStat.score += CONFIG.WEIGHTS.minus.triangleLoss;
              pStat.votedOnlyAgainstMafia = false;
              pStat.actionLogs.push(`[Голосування. Трикутник] Помилковий голос у мирного в ситуації 2х1 ${targetStat.username}: ${CONFIG.WEIGHTS.minus.triangleLoss} балів`);
            }
          } else {
            if (!targetStat.isMafiaTeam) {
              if (isCitizensWin) pStat.score += CONFIG.WEIGHTS.minus.triangleLoss;
              else pStat.score += CONFIG.WEIGHTS.plus.voting;
            }
          }
          return; 
        }

        if (!pStat.isMafiaTeam) {
          if (targetStat.isMafiaTeam) {
            pStat.score += CONFIG.WEIGHTS.plus.voting;
            pStat.mafiaVotedCount++;
            pStat.rawTheses.push({ type: 'plus', priority: 1, text: "Відмінно відданий голос. Помітка. Плюс" });
          } else if (voterId !== targetId) {
            pStat.score += CONFIG.WEIGHTS.minus.voting;
            pStat.votedOnlyAgainstMafia = false;
            pStat.rawTheses.push({ type: 'minus', priority: 1, text: "Атака по своїх. Помітка. Мінус" });
          }
        } else {
          if (mafiaIds.includes(targetId as string)) {
            pStat.score += CONFIG.WEIGHTS.minus.voting;
            pStat.rawTheses.push({ type: 'minus', priority: 1, text: "Голосування в своїх напарників. Помітка. Мінус" });
          } else {
            pStat.score += CONFIG.WEIGHTS.plus.voting;
            pStat.rawTheses.push({ type: 'plus', priority: 2, text: "Відмінно відданий голос. Помітка. Плюс" });
          }
        }
      });
    });

    // 5. АНАЛІЗ НІЧНИХ ДІЙ
    nightSnapshots.forEach((nSnapshot: any) => {
      const nightNum = nSnapshot.night;

      if (doctorId && statsMap[doctorId] && !statsMap[doctorId].isKilledNight2) {
        const docStat = statsMap[doctorId];
        const healTarget = nSnapshot.doctorHeal;
        if (healTarget && nightNum > 1) {
          if (nSnapshot.savedPlayerId === healTarget && nSnapshot.finalKillTarget === healTarget) {
            docStat.score += CONFIG.WEIGHTS.plus.special;
            docStat.doctorSavesCount++;
            docStat.rawTheses.push({ type: 'plus', priority: 1, text: "Успішне лікування. Помітка. Плюс" });
          }
          if (mafiaIds.includes(healTarget)) {
            docStat.score += CONFIG.WEIGHTS.minus.special;
            docStat.rawTheses.push({ type: 'minus', priority: 1, text: "Лікування ворога. Помітка. Мінус" });
          }
        }
      }

      if (sheriffId && statsMap[sheriffId] && !statsMap[sheriffId].isKilledNight2) {
        const shStat = statsMap[sheriffId];
        const checkData = nSnapshot.commissarCheck || {};
        if (checkData.targetId) {
          if (checkData.result === 'mafia' || mafiaIds.includes(checkData.targetId)) {
            shStat.score += CONFIG.WEIGHTS.plus.special;
            shStat.sheriffMafiaChecks++;
            shStat.rawTheses.push({ type: 'plus', priority: 1, text: "Коректна перевірка. Помітка. Плюс" });
          } else {
            shStat.rawTheses.push({ type: 'minus', priority: 5, text: "Перевірка мирного громадянина" });
          }
        }
      }

      const donCheckData = nSnapshot.donCheck || {};
      if (donCheckData.targetId) {
        const donId = players.find(p => p.role === 'don')?.userId;
        if (donId && statsMap[donId] && !statsMap[donId].isKilledNight2) {
          const donStat = statsMap[donId];
          if (donCheckData.result === 'commissar' || donCheckData.targetId === sheriffId) {
            donStat.score += CONFIG.WEIGHTS.plus.special;
            donStat.donFoundSheriffAtNight = nightNum;
            donStat.rawTheses.push({ type: 'plus', priority: 1, text: "Коректна перевірка. Помітка. Плюс" });
          } else {
            donStat.rawTheses.push({ type: 'minus', priority: 3, text: "Неправильна перевірка, за умови, що комісар ще живий" });
          }
        }
      }

      const mafiaVotes = nSnapshot.mafiaVotes || {};
      Object.entries(mafiaVotes).forEach(([mId, targetId]) => {
        if (!statsMap[mId] || !statsMap[targetId as string] || statsMap[mId].isKilledNight2) return;
        const mStat = statsMap[mId];
        if (nSnapshot.savedPlayerId === targetId && nSnapshot.finalKillTarget === targetId) {
          mStat.score += CONFIG.WEIGHTS.minus.failedKill;
          mStat.rawTheses.push({ type: 'minus', priority: 1, text: "Вбивство гравця, якого полікував лікар" });
        } else if (targetId === sheriffId || targetId === doctorId) {
          mStat.score += CONFIG.WEIGHTS.plus.kill;
          mStat.rawTheses.push({ type: 'plus', priority: 1, text: "Важливе убивство. Помітка. Плюс" });
        }
      });
    });

    // 6. ВИЗНАЧЕННЯ АВТО-MVP ТА АВТО-EVP
    let automaticMVPId: string | null = null;
    let automaticEVPId: string | null = null;

    const winnerPlayers = Object.values(statsMap).filter((p: any) => p.isWinner && !p.isKilledNight2);
    const loserPlayers = Object.values(statsMap).filter((p: any) => !p.isWinner && !p.isKilledNight2);

    function checkRoleEvents(p: any) {
      if (p.role === 'don' && p.donFoundSheriffAtNight === 1) return true;
      if (p.isLastMafiaClutch) return true;
      if (p.role === 'doctor' && p.doctorSavesCount >= 2) return true;
      if (['commissar', 'sheriff', 'комісар'].includes(p.role) && p.sheriffMafiaChecks >= 2) return true;
      
      if (['citizen', 'мирний'].includes(p.role)) {
        const cleanPlay = p.hasVotedOrNominated && p.votedOnlyAgainstMafia && p.nominatedOnlyAgainstMafia;
        const nominatedAtLeastOneMafia = p.successfulMafiaNominations > 0;
        const votedAgainstAllEliminatedMafia = eliminatedMafiaIds.length > 0 ? (p.mafiaVotedCount >= eliminatedMafiaIds.length) : false;
        if (cleanPlay && nominatedAtLeastOneMafia && votedAgainstAllEliminatedMafia) return true;
      }
      return false;
    }

    const mvpCandidate = winnerPlayers.find(p => checkRoleEvents(p));
    if (mvpCandidate) automaticMVPId = mvpCandidate.userId;

    const evpCandidate = loserPlayers.find(p => {
      if (['commissar', 'sheriff', 'комісар'].includes(p.role)) return false; 
      return checkRoleEvents(p);
    });
    if (evpCandidate) automaticEVPId = evpCandidate.userId;

    let mvpBackupPlayer = winnerPlayers.sort((a,b) => b.score - a.score)[0];
    let evpBackupPlayer = loserPlayers.filter(p => !['commissar', 'sheriff', 'комісар'].includes(p.role)).sort((a,b) => b.score - a.score)[0];

    // 7. ФОРМУВАННЯ ДАНИХ ДЛЯ ОНОВЛЕННЯ КОЖНОГО ГРАВЦЯ
    const globalBadgesMap: Record<string, { title: string, badges: string[] }> = {};

    const operations = Object.values(statsMap).map((p: any) => {
      const finalScore = p.isKilledNight2 ? 50 : Math.max(0, Math.min(100, Math.round(p.score)));
      let baseTitle = "Гравець";
      const badges: string[] = [];

      if (p.isKilledNight2) {
        baseTitle = "Повезе наступного разу";
        badges.push("better_luck_next_time");
      } else {
        if (automaticMVPId && p.userId === automaticMVPId) {
          baseTitle = p.isLastMafiaClutch ? "MVP (Клатч)" : "MVP";
          badges.push("mvp");
        } else if (!automaticMVPId && mvpBackupPlayer && p.userId === mvpBackupPlayer.userId) {
          baseTitle = "MVP";
          badges.push("mvp");
        } else if (automaticEVPId && p.userId === automaticEVPId) {
          baseTitle = "EVP";
          badges.push("evp");
        } else if (!automaticEVPId && evpBackupPlayer && p.userId === evpBackupPlayer.userId) {
          baseTitle = "EVP";
          badges.push("evp");
        }

        if (p.isInTriangle) badges.push("triangle");
        if (p.isLastMafiaClutch) badges.push("clutch");
      }

      // Зберігаємо бейджі для глобальної сесії
      globalBadgesMap[p.userId] = { title: baseTitle, badges };

      const plusTheses = p.rawTheses.filter((t: any) => t.type === 'plus').sort((a: any, b: any) => a.priority - b.priority).map((t: any) => t.text);
      const minusTheses = p.rawTheses.filter((t: any) => t.type === 'minus').sort((a: any, b: any) => a.priority - b.priority).map((t: any) => t.text);
      const combinedTheses = [...plusTheses, ...minusTheses].slice(0, 3);

      // Записуємо корисність у % та бейджі в модель GamePlayer
      const dbPlayer = session.players.find((gp: any) => gp.userId === p.userId)

      if (!dbPlayer) {
        console.warn(`⚠️ [Evaluation] Гравець з userId ${p.userId} не знайдений у сесії сесії.`);
        return null; // Повертаємо null, якщо не знайдено
      }

      const oldPersonal = (dbPlayer?.personal as any) || {}

      return prisma.gamePlayer.update({
        where: {
          id: dbPlayer.id
        },
        data: {
          personal: {
            ...oldPersonal,
            evaluation: {
              score: finalScore,
              title: baseTitle,
              badges,
              theses: combinedTheses,
              actionLogs: p.actionLogs
            }
          }
        }
      });
    });

    // 8. ЗАПУСКАЄМО ТРАНЗАКЦІЮ БД: Оновлюємо GamePlayer та додаємо загальну карту звань у GameSession
    const updatedState = {
      ...sessionState,
      winnerTeam: finalWinnerTeam,
      gameBadges: globalBadgesMap // Карта всіх звань гри, яку легко вивести в stats/page.tsx
    };

    const safeOperations = (operations as any[]).filter(Boolean);

    await prisma.$transaction([
      ...safeOperations,
      prisma.gameSession.update({
        where: { id: gameSessionId },
        data: { state: updatedState }
      })
    ]);

    console.log(`✅ [Evaluation] Розрахунок корисності та звань для сесії ${gameSessionId} успішно збережено в БД!`);

  } catch (err) {
    console.error("❌ [Evaluation] Помилка під час автоматичного оцінювання:", err);
  }
}