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

  const selectSeat = async (seatNumber: number) => {
    if (lobby?.status !== "waiting") return

    const res = await fetch("/api/lobby/seat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        lobbyId: id,
        number: seatNumber,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error || "Не вдалося зайняти місце")
      return
    }

    const updated = await fetch(`/api/lobby/${id}`).then(r => r.json())
    setLobby(updated.lobby)
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

  const getLatestSession = () => {
    return lobby?.gameSessions?.[0] || null
  }

  const getLobbyResultText = () => {
    if (!lobby || lobby.status !== "finished") return null

    const lastSession = getLatestSession()
    const state = lastSession?.state || {}
    const actions = lastSession?.actions || {}
    const settings = lastSession?.settings || actions.settings || state.settings || {}

    if (lobby.gameType === "mafia") {
      const winnerTeam = String(state.winnerTeam || actions.winnerTeam || "").toLowerCase()

      if (winnerTeam.includes("маф")) {
        return "Результат: перемогла команда Мафії"
      }

      if (winnerTeam.includes("мир") || winnerTeam.includes("citizen")) {
        return "Результат: перемогло мирне місто"
      }

      return "Результат: гру завершено"
    }

    if (lobby.gameType === "whoami") {
      const winners = actions.winners || state.winners || []
      const winnerId = Array.isArray(winners) ? winners[0] : null

      const winnerPlayer = lobby.players?.find((p: any) => p.userId === winnerId)
      const winnerName = winnerPlayer?.user?.username || "невідомо"

      if (winnerId) {
        if (settings.gameMode === "loser") {
          return `Результат: абсолютний переможець ${winnerName}`
        }

        return `Результат: переможець ${winnerName}`
      }

      return "Результат: гру завершено"
    }

    return "Результат: гру завершено"
  }

  const getActiveGameHref = () => {
    const lastSession = getLatestSession()
    if (!lastSession?.id) return null

    if (lobby?.gameType === "whoami") {
      return `/game/whoami/${lastSession.id}`
    }

    return `/game/${lastSession.id}`
  }

  const getPlayerBySeat = (seatNumber: number) => {
    return lobby.players.find((p: any) => p.number === seatNumber)
  }

  const currentPlayer = lobby.players.find((p: any) => p.userId === user?.id)

  const renderGameRules = () => {
    if (lobby.gameType === "mafia") {
      return (
        <>
          <details className={styles.rulesItem} open>
            <summary>🎭 Суть гри</summary>
            <p>
              Гравці отримують приховані ролі та діляться на дві команди: мирне місто і мафію.
              Мирні мають знайти мафію, а мафія — прибрати достатню кількість мирних гравців.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>🌙 Ніч</summary>
            <p>
              Уночі мафія обирає ціль для вбивства. Дон може перевірити гравця на роль комісара,
              комісар перевіряє гравця на належність до мафії, а лікар може врятувати одного гравця.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>☀️ День</summary>
            <p>
              Удень гравці по черзі говорять, обговорюють підозри та можуть виставляти інших
              гравців на голосування. Після завершення обговорення відбувається голосування.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>🗳️ Голосування</summary>
            <p>
              Якщо гравця виставлено на голосування, учасники можуть проголосувати проти одного
              з кандидатів. Гравець, який набрав найбільше голосів, залишає гру.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>🏆 Перемога</summary>
            <p>
              Мирне місто перемагає, якщо всі представники мафії вибувають з гри. Мафія перемагає,
              якщо її кількість стає достатньою для контролю голосування.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>📊 Оцінювання</summary>
            <p>
              Після завершення гри система формує персональну оцінку гравців, значки та пояснення
              за діями під час гри: промовами, голосуваннями, перевірками, номінаціями та іншими подіями.
            </p>
          </details>
        </>
      )
    }

    if (lobby.gameType === "whoami") {
      return (
        <>
          <details className={styles.rulesItem} open>
            <summary>🎯 Суть гри</summary>
            <p>
              Кожен гравець отримує слово або персонажа, якого він не бачить. Завдання — ставити
              питання іншим гравцям і першим здогадатися, ким або чим він є.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>✍️ Підготовка</summary>
            <p>
              Слова можуть задавати самі гравці або інше джерело залежно від налаштувань лобі.
              Після розподілу кожен бачить слова інших, але не бачить власне.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>❓ Хід гри</summary>
            <p>
              Гравці ходять по черзі. У свій хід гравець ставить питання, на яке інші відповідають
              “так”, “ні” або “можливо”. Після цього гравець може спробувати вгадати своє слово.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>🏆 До чемпіона</summary>
            <p>
              У режимі “до чемпіона” перемагає гравець, який першим правильно вгадав своє слово.
              Інші гравці можуть продовжити гру для визначення наступних місць.
            </p>
          </details>

          <details className={styles.rulesItem}>
            <summary>💀 До лузера</summary>
            <p>
              У режимі “до лузера” гра триває, доки не залишиться останній гравець, який не вгадав
              своє слово. Переможцями вважаються ті, хто впорався раніше.
            </p>
          </details>
        </>
      )
    }

    return (
      <details className={styles.rulesItem} open>
        <summary>📘 Правила</summary>
        <p>Правила для цього режиму гри ще не додані.</p>
      </details>
    )
  }

  const latestSession = getLatestSession()
  const activeGameHref = getActiveGameHref()
  const isWaitingLobby = lobby?.status === "waiting"
  const isPlayingLobby = lobby?.status === "playing"
  const isFinishedLobby = lobby?.status === "finished"
  const finishedResultText = getLobbyResultText()

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid} style={{ gridTemplateColumns: "280px 1fr 350px" }}>

        {/* Center: Rules */}
        <div className={styles.sidebar}>
          <div className={styles.sectionTitle}>Правила</div>

          <div className={styles.rulesCard}>
            {renderGameRules()}

            {lobby.gameType === "mafia" && (
              <div className={styles.modelNotice}>
                <div className={styles.modelNoticeIcon}>🤖</div>
                <div>
                  <b>Навчання моделі</b>
                  <p>Ваші ігри будуть використовуватись для навчання моделі оцінювання.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Players and Info */}
        <div className={styles.content}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 className={styles.sectionTitle} style={{ margin: 0 }}>{lobby.name}</h1>
            <div className={styles.badge + " " + (
              lobby.status === "waiting"
                ? styles.badgeWaiting
                : lobby.status === "playing"
                  ? styles.badgePlaying
                  : styles.badgeFinished
            )}>
              {lobby.status === "waiting"
                ? "Очікування"
                : lobby.status === "playing"
                  ? "Гра триває"
                  : "Завершено"}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.filterLabel} style={{ marginBottom: "1rem" }}>Гравці ({lobby.players.length} / {lobby.maxPlayers})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {Array.from({ length: lobby.maxPlayers }).map((_, index) => {
                const seatNumber = index + 1
                const player = getPlayerBySeat(seatNumber)
                const isCurrentUserSeat = player?.userId === user?.id
                const canSelectSeat = lobby.status === "waiting" && !player

                if (player) {
                  return (
                    <div
                      key={`seat-${seatNumber}`}
                      className={styles.card}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "0.75rem",
                        backgroundColor: player.isReady ? "rgba(34, 197, 94, 0.05)" : "var(--moon-surface-light)",
                        borderColor: isCurrentUserSeat
                          ? "var(--moon-accent)"
                          : player.isReady
                            ? "#22c55e"
                            : "var(--moon-border)",
                        boxShadow: isCurrentUserSeat ? "0 0 0 1px var(--moon-accent)" : "none",
                      }}
                    >
                      <div className={styles.seatNumberBadge}>№{seatNumber}</div>

                      <img
                        src={player.user.avatarUrl || "/default-avatar.png"}
                        width={40}
                        height={40}
                        style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid var(--moon-border)" }}
                        alt="avatar"
                      />

                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {player.user.username}
                          {player.user.id === lobby.ownerId && " 👑"}
                          {isCurrentUserSeat}
                        </div>

                        <div style={{ fontSize: "0.75rem", color: player.isReady ? "#22c55e" : "var(--moon-text-dim)" }}>
                          {player.isReady ? "Готовий" : "Очікує"}
                        </div>
                      </div>

                      {player.isReady && <div style={{ color: "#22c55e", fontWeight: "bold" }}>✓</div>}
                    </div>
                  )
                }

                return (
                  <button
                    key={`seat-${seatNumber}`}
                    type="button"
                    className={`${styles.card} ${styles.emptySeatCard}`}
                    disabled={!canSelectSeat}
                    onClick={() => selectSeat(seatNumber)}
                  >
                    <div className={styles.seatNumberBadge}>№{seatNumber}</div>

                    <div className={styles.emptySeatPlus}>+</div>

                    <div>
                      <div className={styles.emptySeatTitle}>Вільне місце</div>
                      {lobby.status === "waiting" && (
                        <div className={styles.emptySeatHint}>
                          {currentPlayer ? "Змінити місце" : "Зайняти місце"}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
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
              {isWaitingLobby && (
                <>
                  {isInLobby && (
                    <button
                      className={styles.button + " " + (lobby.players.find((p: any) => p.userId === user?.id)?.isReady ? styles.buttonSecondary : "")}
                      onClick={toggleReady}
                    >
                      {lobby.players.find((p: any) => p.userId === user?.id)?.isReady ? "Не готовий" : "Я готовий!"}
                    </button>
                  )}

                  {isOwner && (
                    <button
                      className={styles.button}
                      disabled={!allReady}
                      style={{ opacity: allReady ? 1 : 0.5, cursor: allReady ? "pointer" : "not-allowed" }}
                      onClick={startGame}
                    >
                      Почати гру
                    </button>
                  )}

                  {!isInLobby ? (
                    <button className={styles.button} onClick={joinLobby}>
                      Приєднатися
                    </button>
                  ) : (
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
                  )}
                </>
              )}

              {isFinishedLobby && (
                <div className={styles.lobbyStateBox}>
                  <div className={styles.lobbyStateIcon}>🏁</div>
                  <h3>Гра завершена</h3>
                  <p>{finishedResultText}</p>
                </div>
              )}
            </div>
            
            {isWaitingLobby && !allReady && isOwner && lobby.players.length < minPlayers && (
              <div style={{ fontSize: "0.75rem", color: "#f87171", textAlign: "center" }}>
                Потрібно мінімум {minPlayers} гравці
              </div>
            )}

            {isWaitingLobby && !allReady && isOwner && lobby.players.length >= minPlayers && (
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