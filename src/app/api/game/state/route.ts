import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")

  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  let currentUserId = ""
  if (token) {
    try {
      const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
      currentUserId = payload.userId
    } catch (e) { }
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId! },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!game) {
    return NextResponse.json({ error: "game not found" }, { status: 404 })
  }

  const gameState = (game.state as any) || {}

  const getActiveRoleAlive = (): boolean => {
    const p = game.players
    const isAlive = (player: any) => (player.state as any)?.isAlive ?? true
    if (game.phase === "mafia") return p.some(x => ["mafia", "don"].includes(x.role || "") && isAlive(x))
    if (game.phase === "don") return p.some(x => x.role === "don" && isAlive(x))
    if (game.phase === "commissar") return p.some(x => x.role === "commissar" && isAlive(x))
    if (game.phase === "doctor") return p.some(x => x.role === "doctor" && isAlive(x))
    return true
  }

  const getDuration = (): number => {
    if (game.phase === "nomination_defense" || game.phase === "revote_defense") return 30_000
    if (game.phase === "night_kill_speech" || game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") return 60_000
    if (game.status === "voting") return 10_000
    if (game.status === "day") return 60_000
    if (game.status === "night") {
      let roleExists = true
      if (game.phase === "don") roleExists = game.players.some(x => x.role === "don")
      if (game.phase === "commissar") roleExists = game.players.some(x => x.role === "commissar")
      if (game.phase === "doctor") roleExists = game.players.some(x => x.role === "doctor")

      if (!roleExists) return 0
      return getActiveRoleAlive() ? 30_000 : 10_000
    }
    return 30_000
  }

  return NextResponse.json({
    status: game.status,
    dayNumber: game.dayNumber,
    phase: game.phase,
    phaseDuration: getDuration() / 1000,
    players: game.players.map(p => {
      const pState = (p.state as any) || {}
      return {
        userId: p.userId,
        isAlive: pState.isAlive ?? true,
        healsUsed: pState.healsUsed ?? 0,
        role: p.userId === currentUserId || game.status === "finished" ? (p.role || undefined) : undefined,
        checkedPlayers: pState.checkedPlayers || [],
        user: {
          username: p.user.username,
          avatarUrl: p.user.avatarUrl,
        },
        number: p.number,
        investigation: (p.personal as any)?.investigation || {}
      }
    }),
    votes: gameState.votes || {},
    checkResult: gameState.checkResult || null,
    commissarChecks: gameState.commissarChecks || [],
    donChecks: gameState.donChecks || [],
    mafiaVotes: gameState.mafiaVotes || {},
    lastCheck: gameState.lastCheck || null,
    lastHeal: gameState.lastHeal || null,
    currentHeal: gameState.heal || null,
    currentNightDonCheck: gameState.currentNightDonCheck || null,
    currentNightCommissarCheck: gameState.currentNightCommissarCheck || null,
    currentSpeakerIndex: gameState.currentSpeakerIndex || 0,
    phaseStartedAt: gameState.phaseStartedAt || null,
    nominations: gameState.nominations || [],
    revoteCandidates: gameState.revoteCandidates || [],
    nominationSpeakerIndex: gameState.nominationSpeakerIndex || 0,
    nightKilledId: gameState.nightKilledId || null,
    firstSpeakerUserId: gameState.firstSpeakerUserId || null,
  })
}