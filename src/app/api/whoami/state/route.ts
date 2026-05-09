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
    } catch (e) { }
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      lobby: true,
    },
  })

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 })
  }

  const actions = (game.actions as any) || {}
  const assignments = actions.assignments || {}
  const answers = actions.answers || {}

  // Формуємо список гравців, приховуючи своє слово
  const players = game.players.map(p => {
    const assignment = assignments[p.userId]
    const isMe = p.userId === currentUserId
    const isFinished = game.status === "finished"
    const hasGuessed = assignment?.guessed || false

    return {
      userId: p.userId,
      // Показуємо слово всім, КРІМ самого гравця (якщо він ще не вгадав і гра не завершена)
      word: (isMe && !isFinished && !hasGuessed)
        ? null
        : (assignment?.word || null),
      guessed: hasGuessed,
      rank: assignment?.rank || 0,
      currentAnswer: answers[p.userId] || null,
      user: {
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
      },
    }
  })

  // Хто вже ввів слово (на етапі submit_words)
  const submittedWords = actions.submittedWords || {}
  const submittedUserIds = Object.keys(submittedWords)

  const settings = (game.lobby?.settings as any) || {}
  
  // Якщо гравець не знайдений у лобі, або лобі не підвантажилось — лог для дебагу
  if (!game.lobby) {
    console.error(`[WhoAmI State] Lobby not found for session ${sessionId}`)
  }

  return NextResponse.json({
    status: game.status,
    phase: game.phase,
    settings, // Налаштування гри
    players,
    turnOrder: actions.turnOrder || [],
    currentTurnIndex: actions.currentTurnIndex || 0,
    currentTurnUserId: actions.turnOrder?.[actions.currentTurnIndex] || null,
    answers: answers,
    winners: actions.winners || [],
    gameLog: actions.gameLog || [],
    submittedUserIds,
    totalPlayers: game.players.length,
  })
}
