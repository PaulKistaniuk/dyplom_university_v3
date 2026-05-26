import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

type InvestigationMark = "R" | "G" | "B"

export async function POST(req: NextRequest) {
  try {
    const { sessionId, targetUserId, mark } = await req.json()

    if (!sessionId || !targetUserId || !mark) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["R", "G", "B"].includes(mark)) {
      return NextResponse.json({ error: "Invalid investigation mark" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
    const userId = payload.userId

    const gamePlayer = await prisma.gamePlayer.findFirst({
      where: {
        gameId: sessionId,
        userId,
      },
    })

    if (!gamePlayer) {
      return NextResponse.json({ error: "Player not found in this game" }, { status: 404 })
    }

    const state = (gamePlayer.state as any) || {}
    const isAlive = state.isAlive ?? true

    if (!isAlive) {
      return NextResponse.json({ error: "Dead players cannot edit investigation" }, { status: 403 })
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "Cannot investigate yourself" }, { status: 400 })
    }

    const targetPlayer = await prisma.gamePlayer.findFirst({
      where: {
        gameId: sessionId,
        userId: targetUserId,
      },
    })

    if (!targetPlayer) {
      return NextResponse.json({ error: "Target player not found" }, { status: 404 })
    }

    const personal = (gamePlayer.personal as any) || {}
    const investigation = {
      ...(personal.investigation || {}),
      [targetUserId]: mark as InvestigationMark,
    }

    const updated = await prisma.gamePlayer.update({
      where: { id: gamePlayer.id },
      data: {
        personal: {
          ...personal,
          investigation,
        },
      },
    })

    return NextResponse.json({
      success: true,
      investigation: (updated.personal as any)?.investigation || {},
    })
  } catch (error) {
    console.error("Failed to save investigation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}