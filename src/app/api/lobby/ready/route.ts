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

    const player = await prisma.lobbyPlayer.findFirst({
      where: {
        lobbyId,
        userId: payload.userId,
      },
    })

    if (!player) {
      return NextResponse.json({ error: "Not in lobby" }, { status: 400 })
    }

    const updated = await prisma.lobbyPlayer.update({
      where: { id: player.id },
      data: {
        isReady: !player.isReady,
      },
    })

    return NextResponse.json({ player: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}