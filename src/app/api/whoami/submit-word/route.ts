import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { distributeWords } from "@/game-engine/whoami/setup"

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
    const userId = payload.userId

    const { sessionId, word } = await req.json()

    if (!sessionId || !word || !word.trim()) {
      return NextResponse.json({ error: "Missing sessionId or word" }, { status: 400 })
    }

    const game = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    })

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    if (game.status !== "writing" || game.phase !== "submit_words") {
      return NextResponse.json({ error: "Not in word submission phase" }, { status: 400 })
    }

    // Перевіряємо чи гравець в грі
    const isPlayer = game.players.some(p => p.userId === userId)
    if (!isPlayer) {
      return NextResponse.json({ error: "You are not in this game" }, { status: 403 })
    }

    const actions = (game.actions as any) || {}
    const submittedWords = actions.submittedWords || {}

    // Перевіряємо чи гравець вже ввів слово
    if (submittedWords[userId]) {
      return NextResponse.json({ error: "You already submitted a word" }, { status: 400 })
    }

    // Зберігаємо слово
    submittedWords[userId] = word.trim()

    // Перевіряємо чи всі ввели слова
    const allSubmitted = game.players.every(p => submittedWords[p.userId])

    if (allSubmitted) {
      // Розподіляємо слова
      const assignments = distributeWords(submittedWords)

      // Оновлюємо role кожного гравця на призначене слово
      for (const player of game.players) {
        const assignedWord = assignments[player.userId]?.word || "player"
        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: { role: assignedWord },
        })
      }

      // Переходимо до фази гри
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: "playing",
          phase: "asking",
          actions: {
            ...actions,
            submittedWords,
            assignments,
            currentTurnIndex: 0,
            answers: {},
          },
        },
      })

      return NextResponse.json({ success: true, allSubmitted: true })
    } else {
      // Ще не всі ввели — просто зберігаємо
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          actions: {
            ...actions,
            submittedWords,
          },
        },
      })

      return NextResponse.json({ success: true, allSubmitted: false })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
