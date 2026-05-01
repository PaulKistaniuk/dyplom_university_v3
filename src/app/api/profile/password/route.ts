import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = payload.userId;
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid old password" }, { status: 400 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Failed to update password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
