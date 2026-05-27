import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function POST(req: NextRequest) {
  try {
    const { lobbyId, number } = await req.json()

    if (!lobbyId || !number) {
      return NextResponse.json({ error: "LobbyId and number are required" }, { status: 400 })
    }

    const seatNumber = Number(number)

    if (!Number.isInteger(seatNumber) || seatNumber < 1) {
      return NextResponse.json({ error: "Invalid seat number" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
    const userId = payload.userId

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: true,
      },
    })

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
    }

    if (lobby.status !== "waiting") {
      return NextResponse.json({ error: "Seat can be changed only while lobby is waiting" }, { status: 400 })
    }

    if (seatNumber > lobby.maxPlayers) {
      return NextResponse.json({ error: "Seat number is out of lobby range" }, { status: 400 })
    }

    const occupiedSeat = lobby.players.find((p: any) => p.number === seatNumber)

    if (occupiedSeat && occupiedSeat.userId !== userId) {
      return NextResponse.json({ error: "Seat is already taken" }, { status: 409 })
    }

    const currentPlayer = lobby.players.find((p: any) => p.userId === userId)

    if (currentPlayer) {
      const updatedPlayer = await prisma.lobbyPlayer.update({
        where: { id: currentPlayer.id },
        data: {
          number: seatNumber,
          isReady: false,
        },
      })

      return NextResponse.json({ player: updatedPlayer })
    }

    if (lobby.players.length >= lobby.maxPlayers) {
      return NextResponse.json({ error: "Lobby is full" }, { status: 400 })
    }

    const createdPlayer = await prisma.lobbyPlayer.create({
      data: {
        lobbyId,
        userId,
        number: seatNumber,
        isReady: false,
      },
    })

    return NextResponse.json({ player: createdPlayer })
  } catch (e: any) {
    console.error("Failed to select lobby seat:", e)
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
  }
}