"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/shared/hooks/useAuth"

export default function WhoAmIGamePage() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [game, setGame] = useState<any>(null)
  const [word, setWord] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guessText, setGuessText] = useState("")
  const [showGuessInput, setShowGuessInput] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchState = async () => {
    try {
      const res = await fetch(`/api/whoami/state?sessionId=${sessionId}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setGame(data)

      // Якщо ми вже ввели слово
      if (data.status === "writing" && data.submittedUserIds?.includes(user?.id)) {
        setSubmitted(true)
      }
    } catch (err) {
      console.error("Failed to fetch game state:", err)
    }
  }

  useEffect(() => {
    fetchState()
    pollingRef.current = setInterval(fetchState, 2000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [sessionId, user?.id])

  const handleSubmitWord = async () => {
    if (!word.trim()) return

    try {
      const res = await fetch("/api/whoami/submit-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, word: word.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error)
        return
      }
      setSubmitted(true)
      fetchState()
    } catch (err) {
      alert("Помилка відправки слова")
    }
  }

  const handleAnswer = async (answer: string) => {
    try {
      const res = await fetch("/api/whoami/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answer }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error)
      fetchState()
    } catch (err) {
      alert("Помилка відповіді")
    }
  }

  const handleAskQuestion = async () => {
    try {
      const res = await fetch("/api/whoami/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "ask" }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error)
      fetchState()
    } catch (err) {
      alert("Помилка")
    }
  }

  const handleGuess = async () => {
    if (!guessText.trim()) return
    try {
      const res = await fetch("/api/whoami/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, guess: guessText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error)
      setGuessText("")
      setShowGuessInput(false)
      fetchState()
    } catch (err) {
      alert("Помилка вгадування")
    }
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.centerBox}>
          <h2 style={{ color: "#ef4444" }}>Помилка</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!game || !user) {
    return (
      <div style={styles.container}>
        <div style={styles.centerBox}>
          <p>Завантаження гри...</p>
        </div>
      </div>
    )
  }

  const isMyTurn = game.currentTurnUserId === user.id
  const myPlayer = game.players?.find((p: any) => p.userId === user.id)

  // ===== ФАЗА ВВЕДЕННЯ СЛІВ =====
  if (game.status === "writing") {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h1 style={styles.title}>Хто я? — Введення слів</h1>
          <p style={styles.subtitle}>
            Загадайте слово (людину, персонажа, річ), яке отримає інший гравець
          </p>

          {submitted ? (
            <div style={styles.card}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✅</div>
                <p style={{ fontWeight: "bold", fontSize: "1.1rem" }}>Ваше слово прийнято!</p>
                <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
                  Очікуємо інших гравців... ({game.submittedUserIds?.length || 0}/{game.totalPlayers})
                </p>
              </div>
            </div>
          ) : (
            <div style={styles.card}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input
                  style={styles.input}
                  placeholder="Введіть слово..."
                  value={word}
                  onChange={e => setWord(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmitWord()}
                />
                <button style={styles.button} onClick={handleSubmitWord}>
                  Відправити
                </button>
              </div>
            </div>
          )}

          {/* Список гравців і їх статус */}
          <div style={{ ...styles.card, marginTop: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "#38bdf8" }}>Гравці</h3>
            {game.players?.map((p: any) => {
              const hasSubmitted = game.submittedUserIds?.includes(p.userId)
              return (
                <div key={p.userId} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #334155"
                }}>
                  <img
                    src={p.user.avatarUrl || "/default_user.png"}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #334155" }}
                  />
                  <span style={{ flex: 1 }}>{p.user.username}</span>
                  <span style={{ color: hasSubmitted ? "#22c55e" : "#94a3b8", fontSize: "0.875rem" }}>
                    {hasSubmitted ? "✓ Готово" : "Очікує..."}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ===== ФАЗА ГРИ (playing) АБО ЗАВЕРШЕНО (finished) =====
  return (
    <div style={styles.container}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={styles.title}>
          {game.status === "finished" ? "Гра завершена!" : "Хто я?"}
        </h1>

        {/* Поточний хід */}
        {game.status === "playing" && (
          <div style={{ textAlign: "center", marginBottom: "1.5rem", color: "#94a3b8" }}>
            Хід: <b style={{ color: "#38bdf8" }}>
              {game.players?.find((p: any) => p.userId === game.currentTurnUserId)?.user.username}
            </b>
          </div>
        )}

        {/* Сітка гравців */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem"
        }}>
          {game.players?.map((p: any) => {
            const isCurrentTurn = p.userId === game.currentTurnUserId && game.status === "playing"
            const isWinner = game.winners?.includes(p.userId)
            const isMe = p.userId === user.id

            return (
              <div key={p.userId} style={{
                ...styles.card,
                border: isWinner
                  ? "2px solid #fbbf24"
                  : isCurrentTurn
                    ? "2px solid #38bdf8"
                    : "1px solid #334155",
                boxShadow: isWinner ? "0 0 20px rgba(251, 191, 36, 0.3)" : "none",
                opacity: p.guessed && !isWinner ? 0.5 : 1,
              }}>
                {/* Слово над аватаркою */}
                <div style={{
                  textAlign: "center",
                  padding: "0.5rem",
                  marginBottom: "0.5rem",
                  backgroundColor: "#0f172a",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  color: isMe && game.status !== "finished" ? "#334155" : "#f8fafc",
                  minHeight: "2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {isMe && game.status !== "finished" ? "???" : (p.word || "—")}
                </div>

                {/* Аватарка */}
                <div style={{ textAlign: "center" }}>
                  <img
                    src={p.user.avatarUrl || "/default_user.png"}
                    alt=""
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: isWinner ? "3px solid #fbbf24" : "3px solid #334155",
                    }}
                  />
                  <div style={{ marginTop: "0.5rem", fontWeight: "bold", fontSize: "0.9rem" }}>
                    {p.user.username}
                    {isMe && " (Ви)"}
                  </div>
                  {isWinner && (
                    <div style={{ color: "#fbbf24", fontSize: "0.8rem", fontWeight: "bold" }}>
                      🏆 Переможець!
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Кнопки дій */}
        {game.status === "playing" && (
          <div style={{ ...styles.card, marginBottom: "1.5rem" }}>
            {isMyTurn ? (
              // Мій хід
              game.phase === "answering" ? (
                // Я задав питання — чекаю відповідей
                <div style={{ textAlign: "center" }}>
                  <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>🎙️ Озвучте своє питання</h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                    Очікуємо відповідей від інших гравців...
                  </p>
                </div>
              ) : (
                // Фаза asking — обираю дію
                <div>
                  <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Ваш хід!</h3>
                  {!showGuessInput ? (
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <button style={styles.button} onClick={handleAskQuestion}>
                        Задати питання (усно)
                      </button>
                      <button
                        style={{ ...styles.button, backgroundColor: "#334155", color: "#f8fafc" }}
                        onClick={() => setShowGuessInput(true)}
                      >
                        Спробувати вгадати
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="Хто я?..."
                        value={guessText}
                        onChange={e => setGuessText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleGuess()}
                      />
                      <button style={styles.button} onClick={handleGuess}>
                        Вгадати
                      </button>
                      <button
                        style={{ ...styles.button, backgroundColor: "#334155", color: "#f8fafc" }}
                        onClick={() => { setShowGuessInput(false); setGuessText("") }}
                      >
                        Назад
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : game.phase === "answering" ? (
              // Фаза відповідей: показуємо кнопки (якщо ще не відповів)
              game.answers?.[user.id] ? (
                <div style={{ textAlign: "center", color: "#94a3b8" }}>
                  Ви відповіли: <b>{game.answers[user.id] === "yes" ? "Так" : game.answers[user.id] === "no" ? "Ні" : "Вагаюсь"}</b>. Очікуємо інших...
                </div>
              ) : (
                <div>
                  <h3 style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                    {game.players?.find((p: any) => p.userId === game.currentTurnUserId)?.user.username} задає питання
                  </h3>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button style={{ ...styles.button, backgroundColor: "#22c55e", color: "#0f172a" }} onClick={() => handleAnswer("yes")}>
                      Так
                    </button>
                    <button style={{ ...styles.button, backgroundColor: "#ef4444", color: "#f8fafc" }} onClick={() => handleAnswer("no")}>
                      Ні
                    </button>
                    <button style={{ ...styles.button, backgroundColor: "#eab308", color: "#0f172a" }} onClick={() => handleAnswer("maybe")}>
                      Вагаюсь
                    </button>
                  </div>
                </div>
              )
            ) : (
              // Не мій хід, фаза asking — просто чекаємо
              <div style={{ textAlign: "center", color: "#94a3b8" }}>
                Очікуємо ходу: <b style={{ color: "#38bdf8" }}>
                  {game.players?.find((p: any) => p.userId === game.currentTurnUserId)?.user.username}
                </b>
              </div>
            )}
          </div>
        )}

        {/* Фінальний блок */}
        {game.status === "finished" && (
          <div style={{ ...styles.card, textAlign: "center" }}>
            <h2 style={{ color: "#fbbf24", marginBottom: "1rem" }}>🏆 Гру завершено!</h2>
            <p style={{ color: "#94a3b8" }}>Тепер ви можете побачити ким були всі гравці.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Стилі
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    padding: "2rem",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  centerBox: {
    maxWidth: "500px",
    margin: "4rem auto",
    textAlign: "center",
    color: "#94a3b8",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 800,
    color: "#38bdf8",
    textAlign: "center",
    marginBottom: "0.5rem",
  },
  subtitle: {
    textAlign: "center",
    color: "#94a3b8",
    marginBottom: "1.5rem",
    fontSize: "0.95rem",
  },
  card: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "1.5rem",
  },
  input: {
    backgroundColor: "#334155",
    border: "1px solid #475569",
    color: "#f8fafc",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    fontSize: "1rem",
    outline: "none",
    width: "100%",
  },
  button: {
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "8px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "1rem",
    transition: "all 0.2s",
  },
}
