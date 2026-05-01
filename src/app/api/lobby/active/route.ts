import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ lobby: null })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

    const lobbyPlayer = await prisma.lobbyPlayer.findFirst({
      where: {
        userId: payload.userId,
        lobby: {
          gameSessions: {
            some: {
              status: {
                not: "finished",
              },
            },
          },
        },
      },
      include: {
        lobby: {
          include: {
            gameSessions: {
              where: {
                status: {
                  not: "finished",
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    if (!lobbyPlayer) {
      return NextResponse.json({ lobby: null })
    }

    const session = lobbyPlayer.lobby.gameSessions[0]

    if (!session) {
      return NextResponse.json({ lobby: null })
    }

    return NextResponse.json({
      lobby: lobbyPlayer.lobby,
      sessionId: session.id,
    })
  } catch {
    return NextResponse.json({ lobby: null })
  }
}