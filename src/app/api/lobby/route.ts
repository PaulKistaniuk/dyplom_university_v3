import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const lobbies = await prisma.lobby.findMany({
      where: {
        isPrivate: false,
        status: {
          in: ["waiting", "finished"],
        },
      },
      include: {
        players: {
          orderBy: {
            number: "asc",
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        gameSessions: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            gameType: true,
            status: true,
            state: true,
            actions: true,
            settings: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ lobbies })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}