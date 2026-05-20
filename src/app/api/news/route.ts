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

    try {
      jwt.verify(token, process.env.JWT_SECRET!)
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all news items sorted by release date descending
    const news = await prisma.news.findMany({
      orderBy: { date: "desc" },
    })

    return NextResponse.json(news)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
