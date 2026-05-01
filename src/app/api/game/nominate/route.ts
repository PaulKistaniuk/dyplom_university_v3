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
  const actions = (game.actions as any) || {}
  const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== actions.nightKilledId)
  const currentSpeaker = alivePlayers[actions.currentSpeakerIndex || 0]

  if (!currentSpeaker || currentSpeaker.userId !== currentUserId) {
    return NextResponse.json({ error: "You can only nominate during your turn" }, { status: 403 })
  }

  // Verify target
  const targetPlayer = game.players.find(p => p.userId === targetId)
  if (!targetPlayer || !targetPlayer.isAlive || targetPlayer.userId === actions.nightKilledId) {
    return NextResponse.json({ error: "Target must be alive" }, { status: 400 })
  }
  if (targetId === currentUserId) {
    return NextResponse.json({ error: "Cannot nominate yourself" }, { status: 400 })
  }

  const nominations: string[] = actions.nominations || []
  if (nominations.includes(targetId)) {
    return NextResponse.json({ error: "Player already nominated" }, { status: 400 })
  }

  nominations.push(targetId)

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      actions: {
        ...actions,
        nominations,
      },
    },
  })

  return NextResponse.json({ success: true })
}
