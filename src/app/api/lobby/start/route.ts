import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { assignRoles } from "@/game-engine/mafia/setup"

const MIN_PLAYERS = 4

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

    // мінімалка гравців 4 для мафії, можливо зміниться
    if (lobby.players.length < MIN_PLAYERS) {
      return NextResponse.json(
        { error: `Minimum ${MIN_PLAYERS} players required` },
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

    // GameSession
    const session = await prisma.gameSession.create({
      data: {
        lobbyId: lobbyId,
        status: "night",
        phase: "mafia",
        dayNumber: 1,
      },
    })

    // Копіюємо гравців у Player(зв'язка з грою)
    const playerIds = lobby.players.map(p => p.userId)
    const roles = assignRoles(playerIds)

    await prisma.gamePlayer.createMany({
      data: lobby.players.map((p, index) => ({
        userId: p.userId,
        gameId: session.id,
        role: roles[index],
      })),
    })

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