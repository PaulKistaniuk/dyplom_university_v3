"use client"

import { useAuth } from "@/shared/hooks/useAuth"
export const dynamic = "force-dynamic"

export default function NewsPage() {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>

  if (!user) return <p>Not authorized</p>

  return (
    <div>
      <h1>News</h1>

      <h2>Welcome, {user?.username}</h2>

      <div>
        <h3>Update 1</h3>
        <p>Platform development started</p>
      </div>

      <div>
        <h3>Update 2</h3>
        <p>Mafia game in progress</p>
      </div>
    </div>
  )
}