"use client"

import { useEffect, useState } from "react"

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/users")
      .then(res => res.json())
      .then(data => setUsers(data))
  }, [])

  return (
    <div>
      <h1>Users</h1>

      {users.map(user => (
        <div key={user.id}>
          <p>{user.email} | {user.username} | {user.sex}</p>
        </div>
      ))}
    </div>
  )
}