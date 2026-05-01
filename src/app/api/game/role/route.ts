import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")

  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

  const player = await prisma.gamePlayer.findFirst({
    where: {
      gameId: sessionId!,
      userId: payload.userId,
    },
  })

  if (!player) {
    return NextResponse.json({ error: "Not in game" }, { status: 404 })
  }

  return NextResponse.json({ role: player.role })
}