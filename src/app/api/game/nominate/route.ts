import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function POST(req: NextRequest) {
  const { sessionId, targetId } = await req.json()
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
  const currentUserId = payload.userId

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true },
  })

  if (!game || game.status !== "day" || game.phase !== "discussion") {
    return NextResponse.json({ error: "Nominations only allowed during discussion" }, { status: 403 })
  }

  // Verify the caller is the current speaker
  const gameState = (game.state as any) || {}
  const isAlive = (p: any) => (p.state as any)?.isAlive ?? true
  const alivePlayers = game.players.filter(p => isAlive(p) && p.userId !== gameState.nightKilledId)
  const currentSpeaker = alivePlayers[gameState.currentSpeakerIndex || 0]

  if (!currentSpeaker || currentSpeaker.userId !== currentUserId) {
    return NextResponse.json({ error: "You can only nominate during your turn" }, { status: 403 })
  }

  // Verify target
  const targetPlayer = game.players.find(p => p.userId === targetId)
  if (!targetPlayer || !isAlive(targetPlayer) || targetPlayer.userId === gameState.nightKilledId) {
    return NextResponse.json({ error: "Target must be alive" }, { status: 400 })
  }
  if (targetId === currentUserId) {
    return NextResponse.json({ error: "Cannot nominate yourself" }, { status: 400 })
  }

  const nominations: string[] = gameState.nominations || []
  if (nominations.includes(targetId)) {
    return NextResponse.json({ error: "Player already nominated" }, { status: 400 })
  }

  nominations.push(targetId)

  const updatedState = {
    ...gameState,
    nominations,
  }

  const actions = (game.actions as any) || {}
  const timeline = Array.isArray(actions.timeline) ? actions.timeline : []
  timeline.push({
    type: "nomination",
    voterId: currentUserId,
    targetId,
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      state: updatedState,
      actions: {
        ...actions,
        timeline,
      },
    },
  })

  return NextResponse.json({ success: true })
}
