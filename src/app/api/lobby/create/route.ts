import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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

    const body = await req.json()
    const { name, gameType, maxPlayers, isPrivate, revealRoles, lastWords, settings } = body

    if (!name || !gameType || !maxPlayers) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Мінімум гравців залежить від типу гри
    const minPlayers = gameType === "whoami" ? 2 : 4
    if (maxPlayers < minPlayers) {
      return NextResponse.json({ error: `Min ${minPlayers} players for this game` }, { status: 400 })
    }

    const lobby = await prisma.lobby.create({
      data: {
        name,
        gameType,
        maxPlayers,
        isPrivate: isPrivate ?? false,
        revealRoles: revealRoles ?? false,
        lastWords: lastWords ?? true,
        settings: settings ?? {},
        ownerId: payload.userId,

        players: {
          create: {
            userId: payload.userId,
          },
        },
      },
      include: {
        players: true,
      },
    })

    return NextResponse.json({ lobby })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
