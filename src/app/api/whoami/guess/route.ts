import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
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
    const userId = payload.userId

    const { sessionId, guess } = await req.json()

    if (!sessionId || !guess || !guess.trim()) {
      return NextResponse.json({ error: "Missing sessionId or guess" }, { status: 400 })
    }

    const game = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    })

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    if (game.status !== "playing") {
      return NextResponse.json({ error: "Game is not in playing state" }, { status: 400 })
    }

    const actions = (game.actions as any) || {}
    const turnOrder = actions.turnOrder || []
    const currentTurnIndex = actions.currentTurnIndex || 0
    const currentTurnUserId = turnOrder[currentTurnIndex]

    // Тільки гравець, чий хід, може вгадувати
    if (userId !== currentTurnUserId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 })
    }

    const assignments = actions.assignments || {}
    const myAssignment = assignments[userId]

    if (!myAssignment) {
      return NextResponse.json({ error: "No word assigned to you" }, { status: 400 })
    }

    const gameLog = actions.gameLog || []
    const correctWord = myAssignment.word
    const isCorrect = guess.trim().toLowerCase() === correctWord.toLowerCase()

    // Записуємо спробу в лог
    gameLog.push({
      playerId: userId,
      type: "guess",
      text: guess.trim(),
      correct: isCorrect,
      timestamp: Date.now(),
    })

    if (isCorrect) {
      // Вгадав! Режим "На чемпіона" — гра завершується
      const winners = actions.winners || []
      winners.push(userId)
      myAssignment.guessed = true

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: "finished",
          phase: "finished",
          actions: {
            ...actions,
            assignments,
            winners,
            gameLog,
          },
        },
      })

      // Оновити лобі
      await prisma.lobby.update({
        where: { id: game.lobbyId },
        data: { status: "finished" },
      })

      // Записати GameResult для всіх гравців
      const resultsData = game.players.map(p => {
        const isWinner = p.userId === userId
        const playerAssignment = assignments[p.userId]
        return {
          userId: p.userId,
          gameType: "whoami",
          result: isWinner ? "win" : "lose",
          stats: {
            assignedWord: playerAssignment?.word || "unknown",
            totalPlayers: game.players.length,
          },
        }
      })

      await prisma.gameResult.createMany({ data: resultsData })

      return NextResponse.json({ success: true, correct: true })
    } else {
      // Не вгадав — хід переходить до наступного гравця
      const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: "asking",
          actions: {
            ...actions,
            answers: {},
            currentTurnIndex: nextTurnIndex,
            gameLog,
          },
        },
      })

      return NextResponse.json({ success: true, correct: false })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
