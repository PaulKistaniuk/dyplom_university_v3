import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = payload.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        sex: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            gameHistory: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      sex: user.sex,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      gamesPlayed: user._count.gameHistory
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
