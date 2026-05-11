"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/shared/hooks/useAuth"
import { useRouter } from "next/navigation"
import styles from "../lobby.module.css"

export default function LobbyPage() {
  const params = useParams()
  const id = params?.id as string
  const { user } = useAuth()
  const [lobby, setLobby] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const redirecting = useRef(false)

  useEffect(() => {
    const fetchLobby = async () => {
      try {
        const res = await fetch(`/api/lobby/${id}`)
        const data = await res.json()
        
        if (data.error) {
          setError(data.error)
          return
        }

        setLobby(data.lobby)

        // Auto-redirect if game started
        if (data.lobby.status === "playing" && data.lobby.gameSessions?.[0]?.id && !redirecting.current) {
          redirecting.current = true
          const sid = data.lobby.gameSessions[0].id
          if (data.lobby.gameType === "whoami") {
            router.push(`/game/whoami/${sid}`)
          } else {
            router.push(`/game/${sid}`)
          }
        }
      } catch (err) {
        console.error("Failed to fetch lobby:", err)
      }
    }

    fetchLobby()
    const interval = setInterval(fetchLobby, 3000)
    return () => clearInterval(interval)
  }, [id, router])

  if (error) return (
    <div className={styles.container}>
      <div className={styles.emptyState}>
        <h2>Помилка</h2>
        <p>{error}</p>
        <button className={styles.button} onClick={() => router.push("/lobby")} style={{ maxWidth: "200px", marginTop: "1rem" }}>
          Назад до списку
        </button>
      </div>
    </div>
  )

  if (!lobby) return (
    <div className={styles.container}>
      <div className={styles.emptyState}>
        <p>Завантаження лобі...</p>
      </div>
    </div>
  )

  const isOwner = user?.id === lobby.ownerId

  const toggleReady = async () => {
    const res = await fetch("/api/lobby/ready", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ lobbyId: id }),
    })

    if (res.ok) {
      const data = await fetch(`/api/lobby/${id}`).then(r => r.json())
      setLobby(data.lobby)
    }
  }

  // Мінімум гравців залежить від типу гри
  const minPlayers = lobby.gameType === "whoami" ? 2 : 4

  const allReady =
    lobby.players.length >= minPlayers &&
    lobby.players.every((p: any) => p.isReady)

  const startGame = async () => {
    const res = await fetch("/api/lobby/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ lobbyId: id }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error)
      return
    }

    if (lobby.gameType === "whoami") {
      router.push(`/game/whoami/${data.sessionId}`)
    } else {
      router.push(`/game/${data.sessionId}`)
    }
  }

  const isInLobby = lobby.players.some(
    (p: any) => p.userId === user?.id
  )

  const joinLobby = async () => {
    const res = await fetch("/api/lobby/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ lobbyId: id }),
    })

    if (!res.ok) {
      const data = await res.json()
      alert(data.error)
      return
    }

    const data = await fetch(`/api/lobby/${id}`).then(r => r.json())
    setLobby(data.lobby)
  }

  const leaveLobby = async () => {
    const res = await fetch("/api/lobby/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ lobbyId: id }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error)
      return
    }

    if (data.deleted) {
      router.push("/lobby")
      return
    }

    const updated = await fetch(`/api/lobby/${id}`).then(r => r.json())
    setLobby(updated.lobby)
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid} style={{ gridTemplateColumns: "1fr 350px" }}>
        
        {/* Left: Players and Info */}
        <div className={styles.content}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 className={styles.sectionTitle} style={{ margin: 0 }}>{lobby.name}</h1>
            <div className={styles.badge + " " + (
              lobby.status === "waiting" ? styles.badgeWaiting : styles.badgePlaying
            )}>
              {lobby.status === "waiting" ? "Очікування" : "У грі"}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.filterLabel} style={{ marginBottom: "1rem" }}>Гравці ({lobby.players.length} / {lobby.maxPlayers})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {lobby.players.map((p: any) => (
                <div key={p.id} className={styles.card} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  padding: "0.75rem",
                  backgroundColor: p.isReady ? "rgba(34, 197, 94, 0.05)" : "var(--moon-surface-light)",
                  borderColor: p.isReady ? "#22c55e" : "var(--moon-border)"
                }}>
                  <img
                    src={p.user.avatarUrl || "/default-avatar.png"}
                    width={40}
                    height={40}
                    style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid var(--moon-border)" }}
                    alt="avatar"
                  />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.user.username}
                      {p.user.id === lobby.ownerId && " 👑"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: p.isReady ? "#22c55e" : "var(--moon-text-dim)" }}>
                      {p.isReady ? "Готовий" : "Очікує"}
                    </div>
                  </div>
                  {p.isReady && <div style={{ color: "#22c55e", fontWeight: "bold" }}>✓</div>}
                </div>
              ))}
              {Array.from({ length: Math.max(0, lobby.maxPlayers - lobby.players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className={styles.card} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  padding: "0.75rem",
                  borderStyle: "dashed",
                  opacity: 0.5,
                  backgroundColor: "transparent"
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px dashed var(--moon-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>+</div>
                  <div style={{ color: "var(--moon-text-dim)", fontSize: "0.85rem" }}>Вільне місце</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions and Settings */}
        <div className={styles.sidebar}>
          <div className={styles.sectionTitle}>Керування</div>
          
          <div className={styles.card} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Гра</div>
              <div style={{ fontWeight: 600, color: "var(--moon-accent)" }}>
                {lobby.gameType === "mafia" ? "Мафія" : lobby.gameType === "whoami" ? "Хто я?" : lobby.gameType}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Власник</div>
              <div>{lobby.owner.username}</div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--moon-border)", margin: "0.5rem 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {isInLobby && lobby.status === "waiting" && (
                <button 
                  className={styles.button + " " + (lobby.players.find((p:any) => p.userId === user?.id)?.isReady ? styles.buttonSecondary : "")}
                  onClick={toggleReady}
                >
                  {lobby.players.find((p:any) => p.userId === user?.id)?.isReady ? "Не готовий" : "Я готовий!"}
                </button>
              )}

              {isOwner && lobby.status === "waiting" && (
                <button 
                  className={styles.button} 
                  disabled={!allReady}
                  style={{ opacity: allReady ? 1 : 0.5, cursor: allReady ? "pointer" : "not-allowed" }}
                  onClick={startGame}
                >
                  Почати гру
                </button>
              )}

              {!isInLobby && lobby.status === "waiting" ? (
                <button className={styles.button} onClick={joinLobby}>
                  Приєднатися
                </button>
              ) : (
                isInLobby && (
                  <button
                    className={styles.button + " " + styles.buttonSecondary}
                    onClick={() => {
                      if (isOwner) {
                        const confirmDelete = confirm("Видалити лобі?")
                        if (!confirmDelete) return
                      }
                      leaveLobby()
                    }}
                  >
                    {isOwner ? "Видалити лобі" : "Вийти"}
                  </button>
                )
              )}
            </div>
            
            {!allReady && isOwner && lobby.players.length < minPlayers && (
              <div style={{ fontSize: "0.75rem", color: "#f87171", textAlign: "center" }}>
                Потрібно мінімум {minPlayers} гравці
              </div>
            )}
            {!allReady && isOwner && lobby.players.length >= minPlayers && (
              <div style={{ fontSize: "0.75rem", color: "var(--moon-text-dim)", textAlign: "center" }}>
                Очікуємо готовності всіх гравців
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.filterLabel} style={{ marginBottom: "0.5rem" }}>Налаштування</div>
            <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {lobby.gameType === "mafia" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Розкриття ролей:</span>
                    <span style={{ color: "var(--moon-accent)" }}>{lobby.revealRoles ? "Так" : "Ні"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Останнє слово:</span>
                    <span style={{ color: "var(--moon-accent)" }}>{lobby.lastWords ? "Так" : "Ні"}</span>
                  </div>
                </>
              ) : lobby.gameType === "whoami" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Джерело:</span>
                    <span style={{ color: "var(--moon-accent)" }}>
                      {(lobby.settings as any)?.wordSource === "ai" ? "ШІ" : "Гравці"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Чат:</span>
                    <span style={{ color: "var(--moon-accent)" }}>
                      {(lobby.settings as any)?.chatMode === "chat" ? "Увімкнено" : "Вимкнено"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Режим:</span>
                    <span style={{ color: "var(--moon-accent)" }}>
                      {(lobby.settings as any)?.gameMode === "loser" ? "До лузера" : "До чемпіона"}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--moon-text-dim)" }}>Стандартні налаштування</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}