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

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }
  const isAlive = (player.state as any)?.isAlive ?? true
  if (!isAlive) {
    return NextResponse.json({ error: "Dead players can't vote" }, { status: 403 })
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  })

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 })
  if (game.status !== "voting") return NextResponse.json({ error: "Not voting phase" }, { status: 400 })

  const gameState = (game.state as any) || {}

  if (game.phase === "voting") {
    const nominations = gameState.nominations || []
    if (!nominations.includes(targetId)) {
      return NextResponse.json({ error: "Target is not nominated" }, { status: 400 })
    }
  } else if (game.phase === "revote") {
    const revoteCandidates = gameState.revoteCandidates || []
    if (!revoteCandidates.includes(targetId)) {
      return NextResponse.json({ error: "Target is not in revote" }, { status: 400 })
    }
  }

  if (!gameState.votes) {
    gameState.votes = {}
  }

  gameState.votes[payload.userId] = targetId

  const actions = (game.actions as any) || {}
  const timeline = Array.isArray(actions.timeline) ? actions.timeline : []
  timeline.push({
    type: "vote",
    voterId: payload.userId,
    targetId,
    dayNumber: game.dayNumber,
    phase: game.phase,
    timestamp: Date.now(),
  })

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      state: gameState,
      actions: {
        ...actions,
        timeline,
      },
    },
  })

  return NextResponse.json({ success: true })
}