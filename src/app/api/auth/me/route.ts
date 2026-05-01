import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ user: null })
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
      },
    })

    return NextResponse.json({ user })
  } catch (e) {
    console.log("ME ERROR:", e)
    return NextResponse.json({ user: null })
  }
}