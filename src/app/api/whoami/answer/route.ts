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

    const { sessionId, answer } = await req.json()

    if (!sessionId || !answer) {
      return NextResponse.json({ error: "Missing sessionId or answer" }, { status: 400 })
    }

    if (!["yes", "no", "maybe"].includes(answer)) {
      return NextResponse.json({ error: "Invalid answer. Use: yes, no, maybe" }, { status: 400 })
    }

    const game = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    })

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    if (game.status !== "playing" || game.phase !== "answering") {
      return NextResponse.json({ error: "Not in answering phase" }, { status: 400 })
    }

    const actions = (game.actions as any) || {}
    const turnOrder = actions.turnOrder || []
    const currentTurnIndex = actions.currentTurnIndex || 0
    const currentTurnUserId = turnOrder[currentTurnIndex]

    // Гравець, чий хід, не відповідає на своє ж питання
    if (userId === currentTurnUserId) {
      return NextResponse.json({ error: "You cannot answer your own question" }, { status: 400 })
    }

    // Перевіряємо чи гравець в грі
    const isPlayer = game.players.some(p => p.userId === userId)
    if (!isPlayer) {
      return NextResponse.json({ error: "You are not in this game" }, { status: 403 })
    }

    const answers = actions.answers || {}

    // Перевіряємо чи вже відповів
    if (answers[userId]) {
      return NextResponse.json({ error: "You already answered" }, { status: 400 })
    }

    answers[userId] = answer

    // Перевіряємо чи всі (крім того хто задає) відповіли
    const otherPlayers = game.players.filter(p => p.userId !== currentTurnUserId)
    const allAnswered = otherPlayers.every(p => answers[p.userId])

    if (allAnswered) {
      // Всі відповіли — переходимо до наступного ходу
      const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length

      // Пропускаємо гравців, які вже вгадали (якщо режим "На лузера" буде додано пізніше)
      // Зараз режим "На чемпіона" — гра закінчується після першого вгадування

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: "asking",
          actions: {
            ...actions,
            answers: {},
            currentTurnIndex: nextTurnIndex,
          },
        },
      })

      return NextResponse.json({ success: true, allAnswered: true })
    } else {
      // Ще не всі — просто зберігаємо
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          actions: {
            ...actions,
            answers,
          },
        },
      })

      return NextResponse.json({ success: true, allAnswered: false })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
