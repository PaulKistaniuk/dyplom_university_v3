import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
    const userId = payload.userId

    const gameId = req.nextUrl.searchParams.get("gameId")

    if (gameId) {
      // Деталі конкретної гри
      const result = await prisma.gameResult.findFirst({
        where: { id: gameId, userId },
      })
      
      if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

      // Шукаємо всіх учасників цієї ж сесії (щоб показати повну картину)
      // Оскільки ми не маємо sessionId прямо в GameResult, ми можемо знайти ігри 
      // з тим самим часом створення (+/- 5 секунд) або використовувати лог
      return NextResponse.json(result)
    }

    // Список всіх ігор
    const history = await prisma.gameResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(history)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
