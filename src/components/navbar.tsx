"use client"

import { useAuth } from "@/shared/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function Navbar() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [activeGame, setActiveGame] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    })

    window.location.href = "/login"
  }

  const fetchActiveGame = () => {
    if (!user) return
    fetch("/api/lobby/active", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => {
        setActiveGame(data)
      })
      .catch(() => {
        setActiveGame(null)
      })
  }

  useEffect(() => {
    fetchActiveGame()
    const interval = setInterval(fetchActiveGame, 5000)
    return () => clearInterval(interval)
  }, [user])

  if (loading) return null

  const getBtnStyle = (id: string, isAccent = false) => ({
    background: hoveredBtn === id ? (isAccent ? "#0284c7" : "#475569") : (isAccent ? "#0ea5e9" : "#334155"),
    color: "#f8fafc",
    border: `1px solid ${isAccent ? "#0284c7" : "#475569"}`,
    padding: "6px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: "500",
    transition: "all 0.2s",
    transform: hoveredBtn === id ? "translateY(-1px)" : "none",
    boxShadow: hoveredBtn === id ? "0 4px 6px -1px rgba(0, 0, 0, 0.2)" : "none"
  })

  const dropdownItemStyle = {
    padding: "10px 16px",
    cursor: "pointer",
    color: "#f8fafc",
    fontSize: "0.875rem",
    transition: "background 0.2s",
    borderBottom: "1px solid #334155",
    display: "block",
    textDecoration: "none"
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.75rem 1.5rem",
        backgroundColor: "#1e293b",
        borderBottom: "1px solid #334155",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          cursor: "pointer",
          fontSize: "1.25rem",
          fontWeight: "800",
          color: "#38bdf8",
          letterSpacing: "-0.025em"
        }}
        onClick={() => router.push("/")}
      >
        Paulame Studio
      </div>

      {user ? (
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>

          <button
            style={getBtnStyle("lobbies")}
            onClick={() => router.push("/lobby")}
            onMouseEnter={() => setHoveredBtn("lobbies")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            Lobbies
          </button>

          <button
            style={getBtnStyle("news")}
            onClick={() => router.push("/news")}
            onMouseEnter={() => setHoveredBtn("news")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            News
          </button>

          {activeGame?.sessionId && (
            <button
              style={getBtnStyle("active", true)}
              onClick={() => {
                const sid = activeGame.sessionId
                if (activeGame.gameType === "whoami") {
                  router.push(`/game/whoami/${sid}`)
                } else {
                  router.push(`/game/${sid}`)
                }
              }}
              onMouseEnter={() => setHoveredBtn("active")}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              Active Game
            </button>
          )}

          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginLeft: "1rem",
              borderLeft: "1px solid #334155",
              paddingLeft: "1rem",
              paddingBottom: "0.5rem",
              paddingTop: "0.5rem",
              cursor: "pointer"
            }}
            onMouseEnter={() => setShowDropdown(true)}
            onMouseLeave={() => setShowDropdown(false)}
          >
            <span style={{ fontWeight: "600", fontSize: "0.875rem" }}>{user.username}</span>
            <img
              src={user.avatarUrl || "/default_user.png"}
              width={32}
              height={32}
              style={{ borderRadius: "50%", border: "2px solid #38bdf8" }}
              alt="avatar"
            />

            {showDropdown && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "-4px", // Remove gap to prevent mouseLeave
                paddingTop: "8px", // Bridge gap
                width: "160px",
                zIndex: 110
              }}>
                <div style={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                  overflow: "hidden"
                }}>
                  <div style={dropdownItemStyle} onClick={() => router.push("/profile")} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#334155"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>Профіль</div>
                  <div style={dropdownItemStyle} onClick={() => router.push("/stats")} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#334155"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>Статистика</div>
                  <div
                    style={{ ...dropdownItemStyle, borderBottom: "none", color: "#94a3b8" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#334155"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    onClick={handleLogout}
                  >
                    Вийти
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button style={getBtnStyle("login", true)} onClick={() => router.push("/login")} onMouseEnter={() => setHoveredBtn("login")} onMouseLeave={() => setHoveredBtn(null)}>
            Login
          </button>
        </div>
      )}
    </div>
  )
}