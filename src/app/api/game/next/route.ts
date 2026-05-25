import { prisma } from "@/lib/prisma"
import { resolveNight } from "@/game-engine/mafia/night"
import { resolveVoting } from "@/game-engine/mafia/voting"
import { checkWin } from "@/game-engine/mafia/win"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { evaluateAndSaveGameResults } from "@/server/services/mafia/evaluationService"

/**
 * Returns the index (into alivePlayers array) of the first speaker for a given day.
 * Day N starts from the player whose original seat = (N-1) % totalSeats.
 * If that player is dead, we advance to the next alive one.
 * killedThisRound: userId of a player who just died but isn’t yet removed from allPlayers.isAlive.
 */
function getFirstSpeakerIndex(
  dayNumber: number,
  allPlayers: any[],
  killedThisRound?: string | null,
): number {
  const isAliveNow = (p: any) => {
    const isAlive = (p.state as any)?.isAlive ?? true
    return isAlive && p.userId !== killedThisRound
  }

  const alivePlayers = allPlayers.filter(isAliveNow)
  if (alivePlayers.length === 0) return 0

  const targetSeat = (dayNumber - 1) % allPlayers.length
  for (let i = 0; i < allPlayers.length; i++) {
    const seat = (targetSeat + i) % allPlayers.length
    if (isAliveNow(allPlayers[seat])) {
      return alivePlayers.findIndex(p => p.userId === allPlayers[seat].userId)
    }
  }
  return 0
}

function getNextNightPhase(currentPhase: string, game: any): string {
  const settings = (game.settings as any) || {}
  const revealRoles = settings.revealRoles === true
  const isAliveNow = (p: any) => (p.state as any)?.isAlive ?? true

  const checkPhaseValid = (role: string) => {
    if (game.dayNumber === 1) return false

    const roleExists = game.players.some((p: any) => p.role === role)
    if (!roleExists) return false

    const roleAlive = game.players.some((p: any) => p.role === role && isAliveNow(p))
    
    if (!roleAlive && revealRoles) return false

    return true
  }

  if (currentPhase === "mafia") {
    if (checkPhaseValid("don")) return "don"
    if (checkPhaseValid("commissar")) return "commissar"
    if (checkPhaseValid("doctor")) return "doctor"
    return "day"
  }
  if (currentPhase === "don") {
    if (checkPhaseValid("commissar")) return "commissar"
    if (checkPhaseValid("doctor")) return "doctor"
    return "day"
  }
  if (currentPhase === "commissar") {
    if (checkPhaseValid("doctor")) return "doctor"
    return "day"
  }
  return "day"
}

export async function POST(req: NextRequest) {
  const { sessionId, auto } = await req.json()
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true, lobby: true },
  })

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 })
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
  const currentUserId = payload.userId

  const gameState = (game.state as any) || {}
  const actions = (game.actions as any) || {};
  actions.snapshots = actions.snapshots || { days: [], nights: [], votings: [] };
  actions.timeline = actions.timeline || [];
  const now = Date.now()
  const startedAt: number = gameState.phaseStartedAt ?? now

  const getActiveRoleAlive = (): boolean => {
    const p = game.players
    const isAlive = (player: any) => (player.state as any)?.isAlive ?? true
    if (game.phase === "mafia") return p.some(x => ["mafia", "don"].includes(x.role || "") && isAlive(x))
    if (game.phase === "don") return p.some(x => x.role === "don" && isAlive(x))
    if (game.phase === "commissar") return p.some(x => x.role === "commissar" && isAlive(x))
    if (game.phase === "doctor") return p.some(x => x.role === "doctor" && isAlive(x))
    return true
  }

  const getDuration = (): number => {
    if (game.phase === "nomination_defense" || game.phase === "revote_defense") return 30_000
    if (game.phase === "night_kill_speech" || game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") return 60_000
    if (game.status === "voting") return 10_000
    if (game.status === "day") return 60_000
    if (game.status === "night") {
      if (game.dayNumber === 1 && game.phase !== "mafia") return 0;
      let roleExists = true
      if (game.phase === "don") roleExists = game.players.some(x => x.role === "don")
      if (game.phase === "commissar") roleExists = game.players.some(x => x.role === "commissar")
      if (game.phase === "doctor") roleExists = game.players.some(x => x.role === "doctor")

      if (!roleExists) return 0
      return getActiveRoleAlive() ? 30_000 : 10_000
    }
    return 30_000
  }

  const isExpired = now - startedAt >= getDuration()

  if (auto && !isExpired) {
    return NextResponse.json({ success: false, error: "Timer not expired yet" }, { status: 400 })
  }

  // Функція для збереження денного snapshot (щоб викликати в goToNight та при завершенні гри вдень)
  const recordDaySnapshot = (allPlayersList: any[]) => {
    const alivePlayersSnapshot = allPlayersList
      .filter(p => (p.state as any)?.isAlive ?? true)
      .map(p => p.userId)

    const deadPlayersSnapshot = allPlayersList
      .filter(p => !((p.state as any)?.isAlive ?? true))
      .map(p => p.userId)

    const nominationsSnapshot = gameState.nominatedBy || {};

    // Запобігаємо дублюванню snapshot для одного й того ж дня
    const exists = actions.snapshots.days.some((d: any) => d.day === game.dayNumber);
    if (!exists) {
      actions.snapshots.days.push({
        day: game.dayNumber,
        type: "day",
        alivePlayers: alivePlayersSnapshot,
        deadPlayers: deadPlayersSnapshot,
        nominations: nominationsSnapshot,
        timestamp: Date.now(),
      })
    }
  }

  // Helper for transitioning to night
  const goToNight = async (killedPlayerId?: string | null) => {
    let currentPlayersList = [...game.players];

    if (killedPlayerId) {
      const gp = await prisma.gamePlayer.findFirst({
        where: { gameId: sessionId, userId: killedPlayerId }
      })
      if (gp) {
        const gpState = (gp.state as any) || {}
        gpState.isAlive = false
        const updatedGp = await prisma.gamePlayer.update({
          where: { id: gp.id },
          data: { state: gpState }
        })
        // Оновлюємо локальний список для snapshot
        currentPlayersList = game.players.map(p => p.userId === killedPlayerId ? { ...p, state: gpState } : p);
      }
    }

    // Записуємо snapshot дня перед переходом
    recordDaySnapshot(currentPlayersList);

    const updatedState = {
      ...gameState,
      votes: {},
      mafiaVotes: {},
      donKill: null,
      heal: null,
      check: null,
      currentNightDonCheck: null,
      currentNightCommissarCheck: null,
      phaseStartedAt: Date.now(),
    }

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "night",
        phase: "mafia",
        dayNumber: { increment: 1 },
        state: updatedState,
        actions: { timeline: actions.timeline, snapshots: actions.snapshots },
      },
    })

    // win check
    const after = await prisma.gameSession.findUnique({
      where: { id: sessionId }, include: { players: true },
    })
    const winner = checkWin(after!.players)
    if (winner) {
      await prisma.gameSession.update({ where: { id: sessionId }, data: { status: "finished" } })
      await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })
      
      const resultsData = after!.players.map((p) => {
        const isMafiaTeam = p.role === "mafia" || p.role === "don";
        const isWin = (winner === "mafia" && isMafiaTeam) || (winner === "citizens" && !isMafiaTeam);
        return {
          gameId: sessionId,
          userId: p.userId,
          gameType: "mafia",
          result: isWin ? "win" : "lose",
          stats: { role: p.role },
        };
      });
      await prisma.gameResult.createMany({ data: resultsData });
      try {
        await evaluateAndSaveGameResults(sessionId)
      } catch (e) {
        console.error("Mafia evaluation failed:", e)
      }
    }
  }

  // ─── CORE PROGRESSION LOGIC ───────────────────────────────────────────
  const alivePlayers = game.players.filter(p => (p.state as any)?.isAlive ?? true)

  if (game.status === "night") {
    const nextNightPhase = getNextNightPhase(game.phase, game)

    if (nextNightPhase !== "day") {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: nextNightPhase,
          state: { ...gameState, phaseStartedAt: Date.now() },
        },
      })
      return NextResponse.json({ success: true })
    } else {
      const result = resolveNight(gameState, game.players)

      if (result.killedPlayerId) {
        const killedPlayer = game.players.find(p => p.userId === result.killedPlayerId)
        if (killedPlayer) {
          const killedState = (killedPlayer.state as any) || {}
          killedState.isAlive = false
          await prisma.gamePlayer.update({
            where: { id: killedPlayer.id },
            data: { state: killedState },
          })
        }
      }

      const doctor = await prisma.gamePlayer.findFirst({
        where: { gameId: sessionId, role: "doctor" },
      })
      if (doctor && gameState.heal === doctor.userId) {
        const docState = (doctor.state as any) || {}
        docState.healsUsed = (docState.healsUsed || 0) + 1
        if (gameState.heal === doctor.userId) {
          docState.selfHeals = (docState.selfHeals || 0) + 1
        }
        await prisma.gamePlayer.update({
          where: { id: doctor.id },
          data: { state: docState },
        })
      }

      let nextPhase = "discussion";
      if (result.killedPlayerId && game.lobby.lastWords) {
        nextPhase = "night_kill_speech";
      }
      
      const firstSpeaker = getFirstSpeakerIndex(game.dayNumber, game.players, result.killedPlayerId)
      const isAliveNow = (p: any) => ((p.state as any)?.isAlive ?? true) && p.userId !== result.killedPlayerId
      const alivePlayersTemp = game.players.filter(isAliveNow)

      const alivePlayersSnapshot = game.players
        .filter(p => {
          const alive = (p.state as any)?.isAlive ?? true
          return alive && p.userId !== result.killedPlayerId
        })
        .map(p => p.userId)

      const deadPlayersSnapshot = game.players
        .filter(p => {
          const alive = (p.state as any)?.isAlive ?? true
          return !alive || p.userId === result.killedPlayerId
        })
        .map(p => p.userId)

      actions.snapshots.nights.push({
        night: game.dayNumber,
        type: "night",
        alivePlayers: alivePlayersSnapshot,
        deadPlayers: deadPlayersSnapshot,
        mafiaVotes: gameState.mafiaVotes || {},
        finalKillTarget: gameState.donKill || null,
        doctorHeal: gameState.heal || null,
        savedPlayerId:
          gameState.heal && gameState.heal === gameState.donKill ? gameState.heal : null,
        donCheck: gameState.currentNightDonCheck ? { 
          targetId: gameState.currentNightDonCheck, 
          result: (gameState.donChecks && gameState.donChecks.length > 0) ? gameState.donChecks[gameState.donChecks.length - 1].result : null 
        } : {},
        commissarCheck: gameState.currentNightCommissarCheck ? { 
          targetId: gameState.currentNightCommissarCheck, 
          result: (gameState.commissarChecks && gameState.commissarChecks.length > 0) ? gameState.commissarChecks[gameState.commissarChecks.length - 1].result : null 
        } : {},
        killedPlayerId: result.killedPlayerId,
        timestamp: Date.now(),
      })

      const updatedState = {
        ...gameState,
        lastCheck: result.checkedPlayerId,
        checkResult: result.checkResult,
        lastHeal: gameState.heal,
        currentSpeakerIndex: firstSpeaker,
        speakersCount: 1,
        phaseStartedAt: Date.now(),
        heal: null,
        currentNightDonCheck: null,
        currentNightCommissarCheck: null,
        check: null,
        nightKilledId: result.killedPlayerId,
        nominations: [],
        firstSpeakerUserId: alivePlayersTemp[firstSpeaker]?.userId,
        nominationSpeakerIndex: 0,
        revoteCandidates: [],
        speechStartAt: Date.now(),
      }

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: "day",
          phase: nextPhase,
          state: updatedState,
          actions: { timeline: actions.timeline, snapshots: actions.snapshots },
        },
      })

      const afterNight = await prisma.gameSession.findUnique({
        where: { id: sessionId }, include: { players: true },
      })
      const nightWinner = checkWin(afterNight!.players)
      if (nightWinner) {
        await prisma.gameSession.update({ where: { id: sessionId }, data: { status: "finished" } })
        await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })

        const resultsData = afterNight!.players.map((p) => {
          const isMafiaTeam = p.role === "mafia" || p.role === "don";
          const isWin = (nightWinner === "mafia" && isMafiaTeam) || (nightWinner === "citizens" && !isMafiaTeam);
          return {
            gameId: sessionId,
            userId: p.userId,
            gameType: "mafia",
            result: isWin ? "win" : "lose",
            stats: { role: p.role },
          };
        });
        await prisma.gameResult.createMany({ data: resultsData });
      }

      return NextResponse.json({ success: true })
    }
  }

  if (game.status === "day") {
    if (game.phase === "night_kill_speech") {
      if (gameState.speechStartAt) {
        const durationSec = Math.round((Date.now() - gameState.speechStartAt) / 1000);
        actions.timeline.push({
          type: "speech",
          day: game.dayNumber,
          speechType: "night_kill",
          playerId: gameState.nightKilledId,
          durationSec: Math.min(durationSec, 60),
          timestamp: Date.now(),
        });
      }

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: "discussion",
          state: { ...gameState, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
          actions: { timeline: actions.timeline, snapshots: actions.snapshots },
        },
      })
      return NextResponse.json({ success: true })
    }

    if (game.phase === "discussion") {
      const currentSpeaker = alivePlayers[gameState.currentSpeakerIndex || 0]

      if (!isExpired) {
        if (!currentSpeaker || currentSpeaker.userId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      // Авто-номінація для першого спікера
      if (currentSpeaker && currentSpeaker.userId === gameState.firstSpeakerUserId && game.dayNumber > 1) {
        const noms = gameState.nominations || []
        if (noms.length === 0) {
          const possible = alivePlayers.filter(p => p.userId !== currentSpeaker.userId)
          if (possible.length > 0) {
            const rand = possible[Math.floor(Math.random() * possible.length)]
            noms.push(rand.userId)
            gameState.nominations = noms
            
            // Логуємо авто-номінацію в таймлайн
            actions.timeline.push({
              type: "nomination",
              nominatorId: "system",
              targetId: rand.userId,
              dayNumber: game.dayNumber,
              timestamp: Date.now()
            });
          }
        }
      }

      const speakersCount = (gameState.speakersCount || 1) + 1
      const currentIndex = ((gameState.currentSpeakerIndex || 0) + 1) % alivePlayers.length

      if (gameState.speechStartAt && currentSpeaker) {
        let durationSec = Math.round((Date.now() - gameState.speechStartAt) / 1000);
        durationSec = Math.min(durationSec, 60);
        actions.timeline.push({
          type: "speech",
          day: game.dayNumber,
          speechType: "discussion",
          playerId: currentSpeaker.userId,
          durationSec,
          timestamp: Date.now(),
        });
      }

      if (speakersCount > alivePlayers.length) {
        if (game.dayNumber === 1) {
          await goToNight()
          return NextResponse.json({ success: true })
        } else {
          const noms = gameState.nominations || []
          if (noms.length === 0) {
            await goToNight()
            return NextResponse.json({ success: true })
          } else if (noms.length === 1) {
            if (game.lobby.lastWords) {
              await prisma.gameSession.update({
                where: { id: sessionId },
                data: {
                  phase: "single_elim_speech",
                  state: { ...gameState, phaseStartedAt: Date.now(), speechStartAt: Date.now(), nominationSpeakerIndex: 0 },
                  actions: { timeline: actions.timeline, snapshots: actions.snapshots },
                },
              })
              return NextResponse.json({ success: true })
            } else {
              await goToNight(noms[0])
              return NextResponse.json({ success: true })
            }
          } else {
            await prisma.gameSession.update({
              where: { id: sessionId },
              data: {
                phase: "nomination_defense",
                state: { ...gameState, phaseStartedAt: Date.now(), speechStartAt: Date.now(), nominationSpeakerIndex: 0 },
                actions: { timeline: actions.timeline, snapshots: actions.snapshots },
              },
            })
            return NextResponse.json({ success: true })
          }
        }
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, currentSpeakerIndex: currentIndex, speakersCount, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
        return NextResponse.json({ success: true })
      }
    }

    if (game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") {
      const eliminatedId = game.phase === "single_elim_speech" ? (gameState.nominations || [])[0] : gameState.nightKilledId
      
      // Логуємо прощальну промову перед вигоном
      if (gameState.speechStartAt && eliminatedId) {
        const durationSec = Math.round((Date.now() - gameState.speechStartAt) / 1000);
        actions.timeline.push({
          type: "speech",
          day: game.dayNumber,
          speechType: game.phase === "single_elim_speech" ? "single_elim" : "voting_elim",
          playerId: eliminatedId,
          durationSec: Math.min(durationSec, 60),
          timestamp: Date.now(),
        });
      }

      await goToNight(eliminatedId)
      return NextResponse.json({ success: true })
    }

    if (game.phase === "nomination_defense") {
      const noms = gameState.nominations || []
      const currentDefendingId = noms[gameState.nominationSpeakerIndex || 0]
      const nextIndex = (gameState.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        if (currentDefendingId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      // Логуємо промову захисту поточного кандидата
      if (gameState.speechStartAt && currentDefendingId) {
        const durationSec = Math.round((Date.now() - gameState.speechStartAt) / 1000);
        actions.timeline.push({
          type: "speech",
          day: game.dayNumber,
          speechType: "nomination_defense",
          playerId: currentDefendingId,
          durationSec: Math.min(durationSec, 30),
          timestamp: Date.now(),
        });
      }

      if (nextIndex >= noms.length) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "voting",
            phase: "voting",
            state: { ...gameState, votes: {}, phaseStartedAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
      }
      return NextResponse.json({ success: true })
    }
  }

  if (game.status === "voting") {
    if (game.phase === "voting") {
      const noms = gameState.nominations || []
      const fallbackTarget = noms[noms.length - 1]

      const votes = gameState.votes || {}
      alivePlayers.forEach(p => {
        if (!votes[p.userId]) {
          votes[p.userId] = fallbackTarget
        }
      })

      const result = resolveVoting(votes)
      const expectedVoters = alivePlayers.map(p => p.userId);
      const voteCount: Record<string, number> = {};
      
      noms.forEach((c: string) => voteCount[c] = 0);
      Object.values(votes).forEach((targetId: any) => {
        if (voteCount[targetId] !== undefined) {
          voteCount[targetId]++;
        }
      });
      const didNotVote = expectedVoters.filter(vId => !votes[vId]);

      actions.snapshots.votings.push({
        day: game.dayNumber,
        type: "voting",
        candidates: noms,
        votes: votes,
        voteCount: voteCount,
        didNotVote: didNotVote,
        eliminatedPlayerId: result.eliminated || null,
        isTie: result.tie || false,
        timestamp: Date.now()
      });

      if (!result.tie) {
        if (game.lobby.lastWords) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              status: "day",
              phase: "voting_elim_speech",
              state: { ...gameState, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
              actions: { timeline: actions.timeline, snapshots: actions.snapshots },
            },
          })
        } else {
          await goToNight(result.eliminated)
        }
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "revote_defense",
            state: { ...gameState, votes: {}, revoteCandidates: result.leaders, nominationSpeakerIndex: 0, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote_defense") {
      const revoteCandidates = gameState.revoteCandidates || []
      const currentDefendingId = revoteCandidates[gameState.nominationSpeakerIndex || 0]
      const nextIndex = (gameState.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        if (currentDefendingId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      // Логуємо промову під час повторного захисту при нічиїй
      if (gameState.speechStartAt && currentDefendingId) {
        const durationSec = Math.round((Date.now() - gameState.speechStartAt) / 1000);
        actions.timeline.push({
          type: "speech",
          day: game.dayNumber,
          speechType: "revote_defense",
          playerId: currentDefendingId,
          durationSec: Math.min(durationSec, 30),
          timestamp: Date.now(),
        });
      }

      if (nextIndex >= revoteCandidates.length) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "revote",
            state: { ...gameState, votes: {}, phaseStartedAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
            actions: { timeline: actions.timeline, snapshots: actions.snapshots },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote") {
      const revoteCandidates = gameState.revoteCandidates || []
      const fallbackTarget = revoteCandidates[revoteCandidates.length - 1]
      const votes = gameState.votes || {}
      
      alivePlayers.forEach(p => {
        if (!votes[p.userId]) {
          votes[p.userId] = fallbackTarget
        }
      })

      const result = resolveVoting(votes)
      const expectedVoters = alivePlayers.map(p => p.userId);
      const voteCount: Record<string, number> = {};
      
      revoteCandidates.forEach((c: string) => voteCount[c] = 0);
      Object.values(votes).forEach((targetId: any) => {
        if (voteCount[targetId] !== undefined) {
          voteCount[targetId]++;
        }
      });
      const didNotVote = expectedVoters.filter(vId => !votes[vId]);

      actions.snapshots.votings.push({
        day: game.dayNumber,
        type: "revoting",
        candidates: revoteCandidates,
        votes: votes,
        voteCount: voteCount,
        didNotVote: didNotVote,
        eliminatedPlayerId: result.eliminated || null,
        isTie: result.tie || false,
        timestamp: Date.now()
      });

      if (!result.tie) {
        if (game.lobby.lastWords) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              status: "day",
              phase: "voting_elim_speech",
              state: { ...gameState, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now(), speechStartAt: Date.now() },
              actions: { timeline: actions.timeline, snapshots: actions.snapshots },
            },
          })
        } else {
          await goToNight(result.eliminated)
        }
      } else {
        await goToNight() // Ніхто не вилітає
      }
      return NextResponse.json({ success: true })
    }
  }

  // Fallback win check (якщо гра завершилась посеред дня без виклику goToNight)
  const updatedGame = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true },
  })
  const winner = checkWin(updatedGame!.players)
  if (winner) {
    // Гарантуємо, що фінальний snapshot дня запишеться перед завершенням
    recordDaySnapshot(updatedGame!.players);

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "finished",
        actions: { timeline: actions.timeline, snapshots: actions.snapshots }
      }
    })
    await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })
    
    const resultsData = updatedGame!.players.map((p) => {
      const isMafiaTeam = p.role === "mafia" || p.role === "don";
      const isWin = (winner === "mafia" && isMafiaTeam) || (winner === "citizens" && !isMafiaTeam);
      return {
        gameId: sessionId,
        userId: p.userId,
        gameType: "mafia",
        result: isWin ? "win" : "lose",
        stats: { role: p.role },
      };
    });
    await prisma.gameResult.createMany({ data: resultsData });
  }

  return NextResponse.json({ success: true })
}