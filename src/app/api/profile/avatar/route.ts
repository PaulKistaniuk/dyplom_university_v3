import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = payload.userId;
    const { avatarUrl } = await req.json();

    if (avatarUrl === undefined) {
      return NextResponse.json({ error: "Missing avatarUrl" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Try to delete the old avatar if it's a local upload to prevent garbage accumulation
    if (user.avatarUrl && user.avatarUrl.startsWith("/uploads/")) {
      try {
        const oldFilename = path.basename(user.avatarUrl);
        const oldFilePath = path.join(process.cwd(), "public", "uploads", oldFilename);
        await fs.unlink(oldFilePath);
      } catch (err) {
        console.error("Failed to delete old avatar file:", err);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl }
    });

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error: any) {
    console.error("Failed to update avatar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
