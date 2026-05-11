import { NextRequest, NextResponse } from "next/server"
import { MAFIA_RULES } from "@/lib/mafia-rules"

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json()

    const endpoint = process.env.AI_ENDPOINT || "http://127.0.0.1:1234/v1/chat/completions"

    const contextInfo = context ? `
    ПОТОЧНИЙ СТАН ГРИ:
    - Кількість гравців: ${context.totalPlayers} (живих: ${context.alivePlayers})
    - Поточна фаза: ${context.phase}
    - День: ${context.dayNumber}
    - Роль користувача: ${context.myRole || "Невідома"}
    - Статус користувача: ${context.isAlive ? "Живий" : "Мертвий"}
    ` : "Інформація про поточну гру недоступна."

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `ТИ - ІГРОВИЙ АСИСТЕНТ. ПИШИ КОРОТКО І ПО СУТІ(1-2 РЕЧЕННЯ).

            КОНТЕКСТ ГРИ: ${contextInfo}
            БАЗА ПРАВИЛ ТА FAQ: ${MAFIA_RULES}

            ІНСТРУКЦІЇ:
            1. ПРІОРИТЕТ: Якщо питання про ролі або механіки - бери відповідь з БАЗИ FAQ. Питання "Що мені робити як [роль]?" - це те саме, що "Що робить [роль]?".
            2. СТИЛЬ: Не пиши довгих списків. Замість "У вашій команді є такі ролі..." пиши просто: "У грі: 3 мирних, 1 мафія".
            3. МОВА: Тільки жива українська мова. Слідкуй за відмінками (не "жители", а "жителі").
            4. ВІДМОВА: Відмовляй ТІЛЬКИ якщо питають про речі, зовсім не пов'язані з Мафією (погода, навчання, побут). В інших випадках - допомагай.
            5. ФОРМАТ: Уникай Markdown-списків. Пиши в рядок.`
          },
          { role: "user", content: message }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
    })

    if (!response.ok) {
      throw new Error("AI Server is not responding")
    }

    const data = await response.json()
    const aiResponse = data.choices[0].message.content

    return NextResponse.json({ text: aiResponse })
  } catch (error: any) {
    console.error("AI Assistant Error:", error)
    return NextResponse.json(
      { text: "Вибач, я зараз не можу відповісти. Переконайся, що сервер ШІ запущено." },
      { status: 500 }
    )
  }
}
