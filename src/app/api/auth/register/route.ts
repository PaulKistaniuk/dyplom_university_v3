import { NextRequest, NextResponse } from "next/server"
import { registerUser } from "../../../../server/services/authService"

export async function POST(req: NextRequest) {
  try {
    const { email, password, username, sex, avatarUrl } = await req.json()

    if (!email || !password || !username || !sex) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const user = await registerUser(email, password, username, sex, avatarUrl)

    return NextResponse.json({ user })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}