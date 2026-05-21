import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { assignRoles } from "@/game-engine/mafia/setup"

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

    const { lobbyId } = await req.json()

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: true,
      },
    })

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
    }

    // заглушка
    if (lobby.ownerId !== payload.userId) {
      return NextResponse.json({ error: "Only owner can start" }, { status: 403 })
    }

    // Мінімум гравців залежить від типу гри
    const minPlayers = lobby.gameType === "whoami" ? 2 : 4
    if (lobby.players.length < minPlayers) {
      return NextResponse.json(
        { error: `Minimum ${minPlayers} players required` },
        { status: 400 }
      )
    }

    // перевірка ready
    const allReady = lobby.players.every(p => p.isReady)

    if (!allReady) {
      return NextResponse.json(
        { error: "Not all players are ready" },
        { status: 400 }
      )
    }

    // Чи гра waiting
    if (lobby.status !== "waiting") {
      return NextResponse.json(
        { error: "Game already started" },
        { status: 400 }
      )
    }

    let session: any

    if (lobby.gameType === "whoami") {
      // ===== "Хто я?" =====
      const turnOrder = lobby.players.map(p => p.userId)

      session = await prisma.gameSession.create({
        data: {
          lobbyId: lobbyId,
          gameType: "whoami",
          status: "writing",
          phase: "submit_words",
          dayNumber: 0,
          settings: lobby.settings ?? {},
          actions: {
            submittedWords: {},
            assignments: {},
            turnOrder: turnOrder,
            currentTurnIndex: 0,
            answers: {},
            winners: [],
            gameLog: [],
          },
        },
      })

      // Створюємо гравців з role: "player" (буде замінено на слово після розподілу)
      await prisma.gamePlayer.createMany({
        data: lobby.players.map(p => ({
          userId: p.userId,
          gameId: session.id,
          role: "player",
          number: p.number || 1,
          state: {},
          personal: {},
        })),
      })
    } else {
      // ===== Мафія =====
      session = await prisma.gameSession.create({
        data: {
          lobbyId: lobbyId,
          gameType: "mafia",
          status: "night",
          phase: "mafia",
          dayNumber: 1,
          settings: {
            revealRoles: lobby.revealRoles,
            lastWords: lobby.lastWords,
          },
          state: {
            phaseStartedAt: Date.now(),
            currentSpeakerIndex: 0,
            speakersCount: 0,
            nominations: [],
            votes: {},
            mafiaVotes: {},
            heal: null,
            lastHeal: null,
            currentNightDonCheck: null,
            currentNightCommissarCheck: null,
            lastCheck: null,
            checkResult: null,
            nightKilledId: null,
            revoteCandidates: [],
            nominationSpeakerIndex: 0,
          },
          actions: {
            timeline: [],
          },
        },
      })

      const playerIds = lobby.players.map(p => p.userId)
      const roles = assignRoles(playerIds)

      await prisma.gamePlayer.createMany({
        data: lobby.players.map((p, index) => ({
          userId: p.userId,
          gameId: session.id,
          role: roles[index],
          number: p.number || (index + 1),
          state: {
            isAlive: true,
            healsUsed: 0,
            selfHeals: 0,
            checksUsed: 0,
            checkedPlayers: [],
            hasVoted: false,
          },
          personal: {
            investigation: {},
          },
        })),
      })
    }

    // рефреш лобі(тепер воно в грі)
    await prisma.lobby.update({
      where: { id: lobbyId },
      data: {
        status: "playing",
      },
    })

    return NextResponse.json({ success: true, sessionId: session.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}