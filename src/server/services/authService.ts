import { prisma } from "../../lib/prisma"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export const registerUser = async (
  email: string,
  password: string,
  username: string,
  sex: string,
  avatarUrl?: string
) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  })

  if (existingUser) {
    throw new Error("User already exists")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
      sex,
      avatarUrl,
    },
  })

  const { password: _, ...safeUser } = user

  return safeUser
}

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) throw new Error("Invalid credentials")

  const isValid = await bcrypt.compare(password, user.password)

  if (!isValid) throw new Error("Invalid credentials")

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  )

  const { password: _, ...safeUser } = user

  return { user: safeUser, token }
}