import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  let currentUserId = ""
  if (token) {
    try {
      const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
      currentUserId = payload.userId
    } catch (e) {}
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 })
  }

  const actions = (game.actions as any) || {}

  // Формуємо список гравців, приховуючи своє слово
  const players = game.players.map(p => {
    const assignment = actions.assignments?.[p.userId]
    return {
      userId: p.userId,
      // Показуємо слово всім, КРІМ самого гравця (якщо гра не завершена)
      word: game.status === "finished" || p.userId !== currentUserId
        ? (assignment?.word || null)
        : null,
      guessed: assignment?.guessed || false,
      user: {
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
      },
    }
  })

  // Хто вже ввів слово (на етапі submit_words)
  const submittedWords = actions.submittedWords || {}
  const submittedUserIds = Object.keys(submittedWords)

  return NextResponse.json({
    status: game.status,
    phase: game.phase,
    players,
    turnOrder: actions.turnOrder || [],
    currentTurnIndex: actions.currentTurnIndex || 0,
    currentTurnUserId: actions.turnOrder?.[actions.currentTurnIndex] || null,
    answers: actions.answers || {},
    winners: actions.winners || [],
    gameLog: actions.gameLog || [],
    submittedUserIds,
    totalPlayers: game.players.length,
  })
}
