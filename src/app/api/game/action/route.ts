import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { resolveNight } from "@/game-engine/mafia/night"
import { checkWin } from "@/game-engine/mafia/win" // ← ДОДАНО ІМПОРТ ПЕРЕВІРКИ ПЕРЕМОГИ

export async function POST(req: NextRequest) {
  try {
    const { sessionId, actionType, targetId } = await req.json()

    // AUTH
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

    // GAME
    const game = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    })

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    if (game.status !== "night") {
      return NextResponse.json({ error: "Actions allowed only at night" }, { status: 400 })
    }

    if (actionType === "kill" && game.phase !== "mafia") {
      return NextResponse.json({ error: "Not mafia phase" }, { status: 400 })
    }

    if (actionType === "check" && !["don", "commissar"].includes(game.phase)) {
      return NextResponse.json({ error: "Not check phase" }, { status: 400 })
    }

    if (actionType === "heal" && game.phase !== "doctor") {
      return NextResponse.json({ error: "Not doctor phase" }, { status: 400 })
    }

    // PLAYER
    const player = await prisma.gamePlayer.findFirst({
      where: {
        gameId: sessionId,
        userId: payload.userId,
      },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // DEAD CHECK
    const playerState = (player.state as any) || {}
    const isAlive = playerState.isAlive !== false
    if (!isAlive) {
      return NextResponse.json(
        { error: "Dead players can't act" },
        { status: 403 }
      )
    }

    // ACTIONS
    const gameState = (game.state as any) || {}
    const role = player.role
    const userId = player.userId
    const checkedPlayers = playerState.checkedPlayers || []

    const actions = (game.actions as any) || {}
    // Переконуємось, що структура snapshots існує
    actions.snapshots = actions.snapshots || { days: [], nights: [], votings: [] }
    const timeline = Array.isArray(actions.timeline) ? actions.timeline : []

    // KILL (mafia + don)
    if (actionType === "kill") {
      if (!["mafia", "don"].includes(player.role || "")) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 })
      }

      if (!gameState.mafiaVotes) {
        gameState.mafiaVotes = {}
      }

      gameState.mafiaVotes[player.userId] = targetId

      // пріоритет дона
      if (player.role === "don") {
        gameState.donKill = targetId
      }

      timeline.push({
        type: "night_action",
        action: "kill_vote",
        userId: player.userId,
        targetId,
        dayNumber: game.dayNumber,
        timestamp: Date.now(),
      })
    }

    // CHECK (commissar + don)
    if (actionType === "check") {
      if (!targetId) {
        return NextResponse.json({ error: "no target" }, { status: 400 })
      }

      if (checkedPlayers.includes(targetId)) {
        return NextResponse.json({ error: "already checked" }, { status: 400 })
      }

      const target = game.players.find((p: any) => p.userId === targetId)

      if (!target) {
        return NextResponse.json({ error: "target not found" }, { status: 404 })
      }

      // COMMISSAR
      if (role === "commissar") {
        const result =
          target.role === "mafia" || target.role === "don"
            ? "mafia"
            : "citizen"

        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            state: {
              ...playerState,
              checkedPlayers: [...checkedPlayers, targetId],
            },
          },
        })

        gameState.commissarChecks = [
          ...(gameState.commissarChecks || []),
          {
            by: userId,
            targetId,
            result,
          },
        ]
        gameState.currentNightCommissarCheck = targetId
        gameState.check = targetId

        timeline.push({
          type: "night_action",
          action: "check",
          userId,
          targetId,
          result,
          dayNumber: game.dayNumber,
          timestamp: Date.now(),
        })
      }

      // DON
      if (role === "don") {
        if (target.role === "mafia" || target.role === "don") {
          return NextResponse.json({ error: "cannot check mafia" }, { status: 400 })
        }

        const result =
          target.role === "commissar"
            ? "commissar"
            : "not_commissar"

        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            state: {
              ...playerState,
              checkedPlayers: [...checkedPlayers, targetId],
            },
          },
        })

        gameState.donChecks = [
          ...(gameState.donChecks || []),
          {
            by: userId,
            targetId,
            result,
          },
        ]
        gameState.currentNightDonCheck = targetId

        timeline.push({
          type: "night_action",
          action: "don_check",
          userId,
          targetId,
          result,
          dayNumber: game.dayNumber,
          timestamp: Date.now(),
        })
      }
    }

    // HEAL (doctor)
    if (actionType === "heal") {
      if (role !== "doctor") {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 })
      }

      const lastHeal = gameState.lastHeal
      const selfHeals = playerState.selfHeals || 0

      if (lastHeal === targetId) {
        return NextResponse.json({ error: "Can't heal same target twice" }, { status: 400 })
      }

      if (targetId === player.userId && selfHeals > 0) {
        return NextResponse.json({ error: "Self heal already used" }, { status: 400 })
      }

      gameState.heal = targetId

      timeline.push({
        type: "night_action",
        action: "heal",
        userId,
        targetId,
        dayNumber: game.dayNumber,
        timestamp: Date.now(),
      })
    }

    // Первинне збереження дій у проміжних фазах
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        state: gameState,
        actions: {
          timeline,
          snapshots: actions.snapshots,
        },
      },
    })

    // АВТОПЕРЕХІД МІЖ ФАЗАМИ
    const alivePlayers = game.players.filter(p => (p.state as any)?.isAlive ?? true)

    // MAFIA → DON
    if (game.phase === "mafia") {
      const mafia = alivePlayers.filter(p => ["mafia", "don"].includes(p.role || ""))
      const allVoted = mafia.every(p => gameState.mafiaVotes?.[p.userId])

      if (allVoted) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "don",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // DON → COMMISSAR
    else if (game.phase === "don") {
      const hasDonCheck = !!gameState.currentNightDonCheck
      if (hasDonCheck) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "commissar",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // COMMISSAR → DOCTOR
    else if (game.phase === "commissar") {
      const hasCheck = !!gameState.currentNightCommissarCheck
      if (hasCheck) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "doctor",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // DOCTOR → DAY (ПЕРЕХІД У ДЕНЬ)
    else if (game.phase === "doctor") {
      const hasHeal = !!gameState.heal
      if (hasHeal) {
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

        const doctor = game.players.find(p => p.role === "doctor")
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

        // === ДОДАНO ЗНІМОК СТАНУ НОЧІ (SNAPSHOTS) ===
        const alivePlayersSnapshot = game.players
          .filter(p => ((p.state as any)?.isAlive ?? true) && p.userId !== result.killedPlayerId)
          .map(p => p.userId)

        const deadPlayersSnapshot = game.players
          .filter(p => !((p.state as any)?.isAlive ?? true) || p.userId === result.killedPlayerId)
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
            gameState.heal && gameState.heal === gameState.donKill
              ? gameState.heal
              : null,
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
        // ============================================

        // Розрахунок першого спікера
        const isAliveNow = (p: any) => ((p.state as any)?.isAlive ?? true) && p.userId !== result.killedPlayerId
        const alivePlayersTemp = game.players.filter(isAliveNow)
        let firstSpeaker = 0
        if (alivePlayersTemp.length > 0) {
          const targetSeat = (game.dayNumber - 1) % game.players.length
          for (let i = 0; i < game.players.length; i++) {
            const seat = (targetSeat + i) % game.players.length
            if (isAliveNow(game.players[seat])) {
              firstSpeaker = alivePlayersTemp.findIndex(p => p.userId === game.players[seat].userId)
              break
            }
          }
        }

        const lobby = await prisma.lobby.findUnique({ where: { id: game.lobbyId } })
        const nextPhase = (result.killedPlayerId && lobby?.lastWords) ? "night_kill_speech" : "discussion"

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "day",
            phase: nextPhase,
            state: {
              ...gameState,
              lastCheck: result.checkedPlayerId,
              checkResult: result.checkResult,
              lastHeal: gameState.heal,
              currentSpeakerIndex: firstSpeaker,
              speakersCount: 1,
              phaseStartedAt: Date.now(),
              speechStartAt: Date.now(), // ← ДОДАНО ДЛЯ ФІКСУ ТАЙМЕРУ ПРОМОВ
              heal: null,
              currentNightDonCheck: null,
              currentNightCommissarCheck: null,
              check: null,
              nightKilledId: result.killedPlayerId,
              nominations: [],
              firstSpeakerUserId: alivePlayersTemp[firstSpeaker]?.userId,
              nominationSpeakerIndex: 0,
              revoteCandidates: [],
            },
            // Записуємо оновлені snapshot логі в базу даних!
            actions: { timeline, snapshots: actions.snapshots },
          },
        })

        // === ДОДАНO ПЕРЕВІРКУ НА ПЕРЕМОГУ ПІСЛЯ НОЧІ ===
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
        // ==============================================
      }
    }

    return NextResponse.json({ success: true })
  }
  catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}