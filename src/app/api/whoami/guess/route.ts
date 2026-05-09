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
      include: { 
        players: true,
        lobby: true 
      },
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

    const lobbySettings = (game.lobby.settings as any) || {}
    const gameMode = lobbySettings.gameMode || "champion"
    const winners = actions.winners || []

    if (isCorrect) {
      // Вгадав!
      myAssignment.guessed = true
      myAssignment.rank = winners.length + 1
      winners.push(userId)

      // Чи закінчуємо гру?
      let shouldFinish = false
      if (gameMode === "champion") {
        shouldFinish = true
      } else {
        // Режим лузера: граємо поки не залишиться один
        const activePlayersCount = game.players.length - winners.length
        if (activePlayersCount <= 1) {
          shouldFinish = true
        }
      }

      if (shouldFinish) {
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

        await prisma.lobby.update({
          where: { id: game.lobbyId },
          data: { status: "finished" },
        })

        // Записати GameResult
        const resultsData = game.players.map(p => {
          const rank = assignments[p.userId]?.rank || 0
          const isWinner = winners.includes(p.userId)
          return {
            userId: p.userId,
            gameType: "whoami",
            result: isWinner ? "win" : "lose",
            stats: {
              assignedWord: assignments[p.userId]?.word || "unknown",
              totalPlayers: game.players.length,
              rank: rank,
            },
          }
        })

        await prisma.gameResult.createMany({ data: resultsData })

        return NextResponse.json({ success: true, correct: true, finished: true })
      } else {
        // Гра триває, перехід ходу до наступного активного гравця
        let nextTurnIndex = currentTurnIndex
        do {
          nextTurnIndex = (nextTurnIndex + 1) % turnOrder.length
        } while (assignments[turnOrder[nextTurnIndex]]?.guessed)

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "asking",
            actions: {
              ...actions,
              assignments,
              winners,
              currentTurnIndex: nextTurnIndex,
              answers: {},
              gameLog,
            },
          },
        })

        return NextResponse.json({ success: true, correct: true, finished: false })
      }
    } else {
      // Не вгадав — хід переходить до наступного активного гравця
      let nextTurnIndex = currentTurnIndex
      do {
        nextTurnIndex = (nextTurnIndex + 1) % turnOrder.length
      } while (assignments[turnOrder[nextTurnIndex]]?.guessed)

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

