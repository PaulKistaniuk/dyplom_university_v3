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

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: true },
    })

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
    }

    if (lobby.ownerId === payload.userId) {
      await prisma.lobbyPlayer.deleteMany({
        where: { lobbyId },
      })

      await prisma.lobby.delete({
        where: { id: lobbyId },
      })

      return NextResponse.json({ deleted: true })
    }

    await prisma.lobbyPlayer.deleteMany({
      where: {
        lobbyId,
        userId: payload.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}