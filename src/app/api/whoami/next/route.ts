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

    const { sessionId, action, text } = await req.json()
    // action: "ask" — гравець задає питання (усно або в чат)

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
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

    // Тільки гравець, чий хід, може виконати дію
    if (userId !== currentTurnUserId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 })
    }

    if (action === "ask") {
      const chatMode = (game.lobby.settings as any)?.chatMode || "nochat"
      
      // Якщо режим чату, текст обов'язковий
      if (chatMode === "chat" && (!text || !text.trim())) {
        return NextResponse.json({ error: "Будь ласка, введіть ваше питання" }, { status: 400 })
      }

      const gameLog = actions.gameLog || []
      
      // Додамо запис про питання
      gameLog.push({
        playerId: userId,
        type: "question",
        text: text?.trim() || null, 
        timestamp: Date.now(),
      })

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: "answering",
          actions: {
            ...actions,
            answers: {}, 
            gameLog,
          },
        },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
