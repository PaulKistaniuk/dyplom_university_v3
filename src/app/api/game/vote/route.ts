import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function POST(req: NextRequest) {
  const { sessionId, targetId } = await req.json()

  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

  const player = await prisma.gamePlayer.findFirst({
    where: {
      gameId: sessionId,
      userId: payload.userId,
    },
  })

  if (!player || !player.isAlive) {
    return NextResponse.json({ error: "Dead players can't vote" }, { status: 403 })
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  })

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
  if (game.status !== "voting") return NextResponse.json({ error: "Not voting phase" }, { status: 400 })

  const actions = (game.actions as any) || {}

  if (game.phase === "voting") {
    const nominations = actions.nominations || []
    if (!nominations.includes(targetId)) {
      return NextResponse.json({ error: "Target is not nominated" }, { status: 400 })
    }
  } else if (game.phase === "revote") {
    const revoteCandidates = actions.revoteCandidates || []
    if (!revoteCandidates.includes(targetId)) {
      return NextResponse.json({ error: "Target is not in revote" }, { status: 400 })
    }
  }

  if (!actions.votes) {
    actions.votes = {}
  }

  actions.votes[payload.userId] = targetId

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { actions },
  })

  return NextResponse.json({ success: true })
}