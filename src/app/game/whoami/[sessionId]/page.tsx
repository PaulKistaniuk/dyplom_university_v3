"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/shared/hooks/useAuth"

export default function WhoAmIGamePage() {
  const params = useParams()
  const sessionId = params?.sessionId as string
  const { user } = useAuth()
  const [game, setGame] = useState<any>(null)
  const [word, setWord] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guessText, setGuessText] = useState("")
  const [questionText, setQuestionText] = useState("")
  const [logFilter, setLogFilter] = useState("all") // "all" | "mine"
  const [showGuessInput, setShowGuessInput] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Знаходимо останнє питання для відображення в фазі відповідей
  const lastQuestion = game?.gameLog?.slice().reverse().find((l: any) => l.type === "question")

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
    const isChat = game.settings?.chatMode === "chat"

    if (isChat && !questionText.trim()) {
      alert("Будь ласка, введіть текст питання")
      return
    }

    try {
      const res = await fetch("/api/whoami/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "ask",
          text: isChat ? questionText.trim() : null
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Помилка при відправці питання")
      } else {
        setQuestionText("")
      }
      fetchState()
    } catch (err) {
      alert("Помилка зв'язку з сервером")
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
    <div style={styles.layout}>
      {/* ЛІВА ЧАСТИНА (60% ширини) */}
      <div style={styles.leftColumn}>

        {/* ВЕРХНЯ ЧАСТИНА: ВЕБ-КАМЕРИ / ГРАВЦІ (50% висоти) */}
        <div style={styles.webcamArea}>
          <div style={styles.playersGrid}>
            {game.players?.map((p: any) => {
              const isCurrentTurn = p.userId === game.currentTurnUserId && game.status === "playing"
              const isWinner = p.guessed || game.winners?.includes(p.userId)
              const rank = p.rank || 0
              const isMe = p.userId === user.id
              const gameMode = game.settings?.gameMode || "champion"

              const getRankStyles = (r: number, mode: string) => {
                if (mode === "champion") {
                  return { color: "#fbbf24", label: "🏆 Переможець!" }
                }
                if (r === 1) return { color: "#fbbf24", label: "🥇 1-ше місце" }
                if (r === 2) return { color: "#cbd5e1", label: "🥈 2-ге місце" }
                if (r === 3) return { color: "#b45309", label: "🥉 3-тє місце" }
                return { color: "#22c55e", label: "✅ Вгадав" }
              }

              const rankInfo = isWinner ? getRankStyles(rank, gameMode) : null

              return (
                <div key={p.userId} style={{
                  ...styles.playerCard,
                  border: isWinner
                    ? `2px solid ${rankInfo?.color}`
                    : isCurrentTurn
                      ? "2px solid #38bdf8"
                      : "1px solid #334155",
                  boxShadow: isWinner ? `0 0 20px ${rankInfo?.color}33` : "none",
                  opacity: p.guessed && !isWinner && game.status !== "finished" ? 0.6 : 1,
                }}>
                  {/* Бульбашка відповіді */}
                  {game.phase === "answering" && p.currentAnswer && (
                    <div style={{
                      ...styles.answerBubble,
                      backgroundColor: p.currentAnswer === "yes" ? "#22c55e" : p.currentAnswer === "no" ? "#ef4444" : "#eab308",
                    }}>
                      {p.currentAnswer === "yes" ? "ТАК" : p.currentAnswer === "no" ? "НІ" : "???"}
                    </div>
                  )}

                  {/* Слово */}
                  <div style={{
                    ...styles.wordBadge,
                    color: isMe && game.status !== "finished" && !p.guessed ? "#334155" : "#f8fafc",
                  }}>
                    {isMe && game.status !== "finished" && !p.guessed ? "???" : (p.word || "—")}
                  </div>

                  {/* Аватарка */}
                  <div style={{ position: "relative" }}>
                    <img
                      src={p.user.avatarUrl || "/default_user.png"}
                      alt=""
                      style={{
                        ...styles.avatar,
                        border: isWinner ? `3px solid ${rankInfo?.color}` : "3px solid #334155",
                      }}
                    />
                    {isWinner && rank === 1 && (
                      <div style={styles.crownIcon}>🏆</div>
                    )}
                  </div>

                  <div style={styles.playerName}>
                    {p.user.username}{isMe && " (Ви)"}
                  </div>

                  {isWinner && (
                    <div style={{ color: rankInfo?.color, fontSize: "0.75rem", fontWeight: "bold" }}>
                      {rankInfo?.label}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* НИЖНЯ ЧАСТИНА: СТАТУС ТА КЕРУВАННЯ (50% висоти) */}
        <div style={styles.statusArea}>
          <div style={styles.card}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: "#38bdf8", fontSize: "1.25rem", margin: 0 }}>
                {game.status === "finished" ? "Гру завершено!" : "Хто я?"}
              </h2>
              {game.status === "playing" && (
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  Хід гравця: <b style={{ color: "#f8fafc" }}>{game.players?.find((p: any) => p.userId === game.currentTurnUserId)?.user.username}</b>
                </p>
              )}
            </div>

            {/* Блок дій */}
            {game.status === "playing" && (
              <div style={{ marginTop: "1.5rem" }}>
                {isMyTurn ? (
                  game.phase === "answering" ? (
                    <div style={{ textAlign: "center" }}>
                      <h3 style={{ color: "#fbbf24", marginBottom: "0.5rem" }}>
                        {lastQuestion?.text ? `❓ ${lastQuestion.text}` : "🎙️ Озвучте своє питання"}
                      </h3>
                      <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                        Чекаємо, поки інші гравці дадуть відповідь "Так" чи "Ні"
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {!showGuessInput ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
                          {game.settings?.chatMode === "chat" && (
                            <input
                              style={{ ...styles.input, width: "100%", maxWidth: "400px" }}
                              placeholder="Ваше питання (наприклад: Я живий?)..."
                              value={questionText}
                              onChange={e => setQuestionText(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleAskQuestion()}
                            />
                          )}
                          <div style={{ display: "flex", gap: "1rem" }}>
                            <button style={styles.button} onClick={handleAskQuestion}>
                              Задати питання {game.settings?.chatMode === "chat" ? "(в чат)" : "(усно)"}
                            </button>
                            <button
                              style={{ ...styles.button, backgroundColor: "#334155", color: "#f8fafc" }}
                              onClick={() => setShowGuessInput(true)}
                            >
                              Спробувати вгадати
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "1rem" }}>
                          <input
                            style={{ ...styles.input, flex: 1 }}
                            placeholder="Я думаю, що я..."
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
                  <div>
                    {myPlayer?.currentAnswer ? (
                      <div style={{ textAlign: "center" }}>
                        <p style={{ color: "#fbbf24", fontWeight: "bold", marginBottom: "0.5rem" }}>
                          {lastQuestion?.text ? `❓ ${lastQuestion.text}` : "Йде обговорення..."}
                        </p>
                        <div style={{ color: "#94a3b8" }}>
                          Ви відповіли: <b style={{ color: "#f8fafc" }}>{myPlayer.currentAnswer === "yes" ? "Так" : myPlayer.currentAnswer === "no" ? "Ні" : "Вагаюсь"}</b>. Чекаємо решту.
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center" }}>
                        <h3 style={{ color: "#f8fafc", marginBottom: "1rem" }}>
                          {lastQuestion?.text ? `❓ ${lastQuestion.text}` : "Вам задали питання!"}
                        </h3>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                          <button style={{ ...styles.button, backgroundColor: "#22c55e", color: "#0f172a" }} onClick={() => handleAnswer("yes")}>Так</button>
                          <button style={{ ...styles.button, backgroundColor: "#ef4444", color: "#f8fafc" }} onClick={() => handleAnswer("no")}>Ні</button>
                          <button style={{ ...styles.button, backgroundColor: "#eab308", color: "#0f172a" }} onClick={() => handleAnswer("maybe")}>Вагаюсь</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "#94a3b8" }}>
                    Очікуйте своєї черги...
                  </div>
                )}
              </div>
            )}

            {game.status === "finished" && (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <p style={{ color: "#fbbf24", fontWeight: "bold" }}>🏆 Гру завершено! Перегляньте результати.</p>
                <button
                  style={{ ...styles.button, marginTop: "1rem", backgroundColor: "#334155", color: "#f8fafc" }}
                  onClick={() => window.location.href = "/lobby"}
                >
                  Повернутися в лобі
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ПРАВА ЧАСТИНА (40% ширини) — СТОРІБОРД */}
      <div style={styles.rightColumn}>
        <div style={styles.storyboard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ color: "#38bdf8", margin: 0, fontSize: "1.1rem" }}>Історія гри</h3>
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#0f172a", padding: "2px", borderRadius: "6px" }}>
              <button
                onClick={() => setLogFilter("all")}
                style={{
                  ...styles.filterBtn,
                  backgroundColor: logFilter === "all" ? "#334155" : "transparent",
                  color: logFilter === "all" ? "#f8fafc" : "#64748b"
                }}
              >Всі</button>
              <button
                onClick={() => setLogFilter("mine")}
                style={{
                  ...styles.filterBtn,
                  backgroundColor: logFilter === "mine" ? "#334155" : "transparent",
                  color: logFilter === "mine" ? "#f8fafc" : "#64748b"
                }}
              >Мої</button>
            </div>
          </div>

          <div style={styles.logList}>
            {game.gameLog?.length > 0 ? (
              game.gameLog.slice().reverse()
                .filter((l: any) => logFilter === "all" || l.playerId === user?.id)
                .map((log: any, idx: number) => {
                  const player = game.players?.find((p: any) => p.userId === log.playerId)
                  const answers = log.answersSnapshot || {}

                  return (
                    <div key={idx} style={styles.logEntry}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", color: "#38bdf8", fontSize: "0.85rem" }}>
                          {player?.user.username || "Гравець"}
                        </span>
                        <span style={{ color: "#475569", fontSize: "0.7rem" }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        {log.type === "question" ? (
                          <>
                            <div style={{ fontSize: "0.9rem", marginBottom: "6px" }}>
                              <span style={{ color: "#94a3b8" }}>Запитав:</span>{" "}
                              <span style={{ color: "#f8fafc", fontStyle: log.text ? "normal" : "italic" }}>
                                {log.text || "усно..."}
                              </span>
                            </div>
                            {/* Візуалізація відповідей крапками */}
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {game.players?.filter((p: any) => p.userId !== log.playerId).map((p: any) => (
                                <div
                                  key={p.userId}
                                  title={`${p.user.username}: ${answers[p.userId] === 'yes' ? 'Так' : answers[p.userId] === 'no' ? 'Ні' : '?'}`}
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    backgroundColor: answers[p.userId] === "yes" ? "#22c55e" : answers[p.userId] === "no" ? "#ef4444" : answers[p.userId] === "maybe" ? "#eab308" : "#475569"
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : log.type === "guess" ? (
                          <div style={{ fontSize: "0.9rem" }}>
                            <span style={{ color: "#94a3b8" }}>Спроба вгадати:</span>{" "}
                            <span style={{ color: log.correct ? "#22c55e" : "#ef4444" }}>
                              {log.text} — {log.correct ? "Правильно! 🏆" : "Помилка ❌"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })
            ) : (
              <p style={{ color: "#475569", fontSize: "0.85rem", textAlign: "center", marginTop: "2rem" }}>
                Тут з'являтимуться події гри...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Стилі
const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    height: "90vh",
    maxHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: "hidden",
  },
  leftColumn: {
    flex: "0 0 60%",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #334155",
    height: "100%",
  },
  rightColumn: {
    flex: "0 0 40%",
    backgroundColor: "#0f172a",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  webcamArea: {
    flex: "0 0 55%",
    padding: "1.5rem",
    overflowY: "auto",
    borderBottom: "1px solid #334155",
    backgroundColor: "rgba(30, 41, 59, 0.3)",
  },
  statusArea: {
    flex: "1",
    padding: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
  },
  playersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "1.5rem",
  },
  playerCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "1rem",
    textAlign: "center",
    position: "relative",
    transition: "all 0.3s",
  },
  answerBubble: {
    position: "absolute",
    top: "-10px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "#fff",
    zIndex: 10,
    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
  },
  wordBadge: {
    backgroundColor: "#0f172a",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: "bold",
    marginBottom: "0.75rem",
    minHeight: "1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: "70px",
    height: "70px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  crownIcon: {
    position: "absolute",
    top: "-15px",
    right: "15px",
    fontSize: "1.5rem",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
  },
  playerName: {
    marginTop: "0.5rem",
    fontSize: "0.9rem",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  storyboard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #334155",
  },
  logList: {
    flex: 1,
    overflowY: "auto",
    paddingRight: "0.5rem",
  },
  logEntry: {
    backgroundColor: "#0f172a",
    padding: "0.75rem",
    borderRadius: "8px",
    marginBottom: "0.75rem",
    borderLeft: "3px solid #38bdf8",
  },
  filterBtn: {
    border: "none",
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    padding: "2rem",
    width: "100%",
    maxWidth: "500px",
    border: "1px solid #334155",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
  },
  input: {
    backgroundColor: "#334155",
    border: "1px solid #475569",
    color: "#f8fafc",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    padding: "0.75rem 1.25rem",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "0.95rem",
    transition: "all 0.2s",
  },
}

