import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
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
    })

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
    }

    return NextResponse.json({ lobby })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}