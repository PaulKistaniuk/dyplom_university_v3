import { prisma } from "../../../lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      sex: true,
      createdAt: true,
    },
  })

  return NextResponse.json(users)
}