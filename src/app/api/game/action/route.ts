import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { resolveNight } from "@/game-engine/mafia/night"

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
    if (!player.isAlive) {
      return NextResponse.json(
        { error: "Dead players can't act" },
        { status: 403 }
      )
    }

    // ACTIONS
    const actions = (game.actions as any) || {}
    const role = player.role
    const userId = player.userId
    const checkedPlayers = (player.checkedPlayers as string[]) || []

    // KILL (mafia + don)
    if (actionType === "kill") {
      if (!["mafia", "don"].includes(player.role)) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 })
      }

      if (!actions.mafiaVotes) {
        actions.mafiaVotes = {}
      }

      actions.mafiaVotes[player.userId] = targetId

      // пріоритет дна
      if (player.role === "don") {
        actions.donKill = targetId
      }
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

        const currentChecked = Array.isArray(player.checkedPlayers)
          ? player.checkedPlayers
          : []

        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            checkedPlayers: [...currentChecked, targetId],
          },
        })

        actions.commissarChecks = [
          ...(actions.commissarChecks || []),
          {
            by: userId,
            targetId,
            result,
          },
        ]
        actions.currentNightCommissarCheck = targetId
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

        const currentChecked = Array.isArray(player.checkedPlayers)
          ? player.checkedPlayers
          : []

        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            checkedPlayers: [...currentChecked, targetId],
          },
        })

        actions.donChecks = [
          ...(actions.donChecks || []),
          {
            by: userId,
            targetId,
            result,
          },
        ]
        actions.currentNightDonCheck = targetId
      }
    }

    // HEAL (doctor)
    if (actionType === "heal") {
      if (role !== "doctor") {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 })
      }

      const lastHeal = (game.actions as any)?.lastHeal
      const selfHealUsed = player.healsUsed > 0

      if (lastHeal === targetId) {
        return NextResponse.json({ error: "Can't heal same target twice" }, { status: 400 })
      }

      if (targetId === player.userId && selfHealUsed) {
        return NextResponse.json({ error: "Self heal already used" }, { status: 400 })
      }

      actions.heal = targetId
    }

    // SAVE
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        actions,
      },
    })

    // ДОБАВЛЯЄМО АВТОПЕРЕХІД

    const alivePlayers = game.players.filter(p => p.isAlive)

    // MAFIA → DON
    if (game.phase === "mafia") {
      const mafia = alivePlayers.filter(p => ["mafia", "don"].includes(p.role))

      const allVoted = mafia.every(p => actions.mafiaVotes?.[p.userId])

      if (allVoted) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "don",
            actions: { ...actions, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // DON → COMMISSAR
    else if (game.phase === "don") {
      const hasDonCheck = !!actions.currentNightDonCheck

      if (hasDonCheck) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "commissar",
            actions: { ...actions, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // COMMISSAR → DOCTOR
    else if (game.phase === "commissar") {
      const hasCheck = !!actions.currentNightCommissarCheck

      if (hasCheck) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "doctor",
            actions: { ...actions, phaseStartedAt: Date.now() },
          },
        })
      }
    }

    // DOCTOR → DAY
    else if (game.phase === "doctor") {
      const hasHeal = !!actions.heal
      if (hasHeal) {
        // We use the same complex logic as next/route.ts
        const result = await resolveNight(actions, game.players)

        if (result.killedPlayerId) {
          await prisma.gamePlayer.updateMany({
            where: { gameId: sessionId, userId: result.killedPlayerId },
            data: { isAlive: false },
          })
        }

        const doctor = game.players.find(p => p.role === "doctor")
        if (doctor && actions.heal === doctor.userId) {
          await prisma.gamePlayer.update({
            where: { id: doctor.id },
            data: { healsUsed: { increment: 1 } },
          })
        }

        // Helper to find first speaker
        const isAliveNow = (p: any) => p.isAlive && p.userId !== result.killedPlayerId
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

        // Get lobby for lastWords
        const lobby = await prisma.lobby.findUnique({ where: { id: game.lobbyId } })
        const nextPhase = (result.killedPlayerId && lobby?.lastWords) ? "night_kill_speech" : "discussion"

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "day",
            phase: nextPhase,
            actions: {
              ...actions,
              lastCheck: result.checkedPlayerId,
              checkResult: result.checkResult,
              lastHeal: actions.heal,
              currentSpeakerIndex: firstSpeaker,
              speakersCount: 1,
              phaseStartedAt: Date.now(),
              heal: null,
              currentNightDonCheck: null,
              currentNightCommissarCheck: null,
              nightKilledId: result.killedPlayerId,
              nominations: [],
              firstSpeakerUserId: alivePlayersTemp[firstSpeaker]?.userId,
              nominationSpeakerIndex: 0,
              revoteCandidates: [],
            },
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  }
  catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}