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

    // З URL дістаємо ID запису результату (наприклад: 23bb8128-...)
    const gameId = req.nextUrl.searchParams.get("gameId")

    if (gameId) {
      // 1. Шукаємо запис статистики за його ID
      const result = await prisma.gameResult.findFirst({
        where: { id: gameId, userId },
      })
      
      if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

      // ============================================================
      // ДОДАТКОВА ЛОГІКА ДЛЯ МАФІЇ
      // ============================================================
      if (result.gameType === "mafia") {
        
        // Шукаємо GameSession за її рідним ID, який лежить у result.gameId!
        const session = await prisma.gameSession.findUnique({
          where: { id: result.gameId }, 
          include: {
            players: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        })

        if (!session) {
          return NextResponse.json({ 
            error: `Мафіозна сесія з ID ${result.gameId} не знайдена в БД.` 
          }, { status: 404 })
        }

        const sessionState = (session.state as any) || {}
        const sessionActions = (session.actions as any) || {}

        // Дістаємо таймлайн та снапшоти днів/ночей
        const timeline = sessionState.timeline || sessionActions.timeline || []
        const snapshots = sessionState.snapshots || sessionActions.snapshots || { days: [], nights: [], votings: [] }

        // Збираємо мапу реальних нікнеймів та ролей учасників матчу (для сумісності)
        const playerMap: Record<string, string> = {}
        const playerRoles: Record<string, string> = {}

        session.players.forEach((p: any) => {
          playerMap[p.userId] = p.user.username
          if (p.role) {
            playerRoles[p.userId] = p.role
          }
        })

        // Формуємо масив чистих збагачених даних по кожному гравцю із БД
        // Сортуємо їх по номеру стільця (p.number), щоб на фронті розсадка була ідеальною
        const players = session.players.map((p: any) => ({
          userId: p.userId,
          username: p.user?.username || "Користувач",
          number: p.number,
          role: p.role || "citizen",
          state: p.state || {},
          personal: p.personal || {}
        })).sort((a: any, b: any) => a.number - b.number)

        // === ТВОЯ ЛОГІКА ВИЗНАЧЕННЯ ПЕРЕМОЖЦЯ ===
        const userRoleStr = (result.stats as any)?.role || playerRoles[userId] || "citizen";
        const isMafiaOrDon = userRoleStr.toLowerCase().includes("mafia") 
                          || userRoleStr.toLowerCase().includes("don")
                          || userRoleStr.toLowerCase() === "мафія" 
                          || userRoleStr.toLowerCase() === "дон";
                          
        const isWin = result.result === "win";

        let calculatedWinner = "";
        if (!isMafiaOrDon && isWin) calculatedWinner = "Мирні Гравці / ШЕРИФ";
        else if (!isMafiaOrDon && !isWin) calculatedWinner = "Мафія";
        else if (isMafiaOrDon && isWin) calculatedWinner = "Мафія";
        else if (isMafiaOrDon && !isWin) calculatedWinner = "Мирні Гравці / ШЕРИФ";

        // Визначаємо фінального переможця
        const finalWinnerTeam = sessionState.winnerTeam || sessionActions.winnerTeam || calculatedWinner;
        // ===========================================

        // Пакуємо все в об'єкт stats для MafiaDashboard
        const extendedStats = {
          ...((result.stats as any) || {}),
          timeline,
          snapshots,
          playerMap,
          playerRoles,
          players, // <--- Передаємо масив гравців на фронтенд
          winnerTeam: finalWinnerTeam,
        }

        return NextResponse.json({
          ...result,
          stats: extendedStats,
        })
      }
      // ============================================================

      // Для інших ігор (наприклад, "whoami") повертаємо чистий результат без змін
      return NextResponse.json(result)
    }

    // === Список всіх ігор для історії (Бокова панель) ===
    const history = await prisma.gameResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    // ФІКС ДЛЯ БОКОВОЇ ПАНЕЛІ: Збагачуємо масив історії кількістю гравців для Мафії
    const enrichedHistory = await Promise.all(
      history.map(async (game) => {
        if (game.gameType === "mafia") {
          const session = await prisma.gameSession.findUnique({
            where: { id: game.gameId },
            select: {
              players: { select: { id: true, userId: true, user: { select: { username: true } } } }
            }
          })

          if (session) {
            const playerMap: Record<string, string> = {}
            session.players.forEach((p: any) => {
              playerMap[p.userId] = p.user.username
            })

            return {
              ...game,
              stats: {
                ...((game.stats as any) || {}),
                playerMap,
                players: session.players
              }
            }
          }
        }
        return game
      })
    )

    return NextResponse.json(enrichedHistory)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}