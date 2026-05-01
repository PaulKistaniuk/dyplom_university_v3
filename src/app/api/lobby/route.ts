import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const lobbies = await prisma.lobby.findMany({
      where: {
        status: "waiting",
        isPrivate: false,
      },
      include: {
        players: {
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