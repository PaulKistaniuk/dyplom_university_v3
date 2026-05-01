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

    const history = await prisma.gameResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Failed to fetch game history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
