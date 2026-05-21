import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

    const { lobbyId } = await req.json()

    if (!lobbyId) {
      return NextResponse.json({ error: "Lobby ID required" }, { status: 400 })
    }

    // перевіряємо чи існує лобі
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: true },
    })

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
    }

    // already started
    if (lobby.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 })
    }

    // already in
    const alreadyInLobby = lobby.players.some(
      (p) => p.userId === payload.userId
    )

    if (alreadyInLobby) {
      return NextResponse.json({ error: "Already in lobby" }, { status: 400 })
    }

    // no slots
    if (lobby.players.length >= lobby.maxPlayers) {
      return NextResponse.json({ error: "Lobby is full" }, { status: 400 })
    }

    const existing = await prisma.lobbyPlayer.findFirst({
      where: {
        userId: payload.userId,
        lobby: {
          status: {
            in: ["waiting", "playing"],
          },
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Already in a lobby" },
        { status: 400 }
      )
    }

    const takenSeats = lobby.players.map(p => p.number || 0)
    let freeSeat = 1
    for (let i = 1; i <= lobby.maxPlayers; i++) {
      if (!takenSeats.includes(i)) {
        freeSeat = i
        break
      }
    }

    const player = await prisma.lobbyPlayer.create({
      data: {
        userId: payload.userId,
        lobbyId,
        number: freeSeat,
      },
    })

    return NextResponse.json({ player })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}