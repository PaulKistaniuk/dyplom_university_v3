"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/shared/hooks/useAuth"

export default function StatsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const selectedId = searchParams.get("gameId")

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    if (selectedId && history.length > 0) {
      const game = history.find(h => h.id === selectedId)
      if (game) setSelectedGame(game)
    }
  }, [selectedId, history])

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/stats")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHistory(data)
    } catch (err) {
      console.error("Failed to fetch history:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectGame = (game: any) => {
    router.push(`/stats?gameId=${game.id}`)
    setSelectedGame(game)
  }

  if (!user) return <div style={styles.center}>Будь ласка, увійдіть...</div>

  return (
    <div style={styles.layout}>
      {/* ЛІВА КОЛОНКА: СПИСОК ІГОР */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Історія ігор</h2>
        <div style={styles.gameList}>
          {history.length > 0 ? (
            history.map(game => (
              <div
                key={game.id}
                style={{
                  ...styles.gameCard,
                  borderColor: selectedId === game.id ? "#38bdf8" : "#334155",
                  backgroundColor: selectedId === game.id ? "rgba(56, 189, 248, 0.1)" : "#1e293b"
                }}
                onClick={() => handleSelectGame(game)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "bold", color: "#f8fafc" }}>
                    {game.gameType === "whoami" ? "Хто я?" : "Мафія"}
                  </span>
                  <span style={{ 
                    color: game.result === "win" ? "#22c55e" : "#ef4444",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    textTransform: "uppercase"
                  }}>
                    {game.result === "win" ? "Перемога" : "Поразка"}
                  </span>
                </div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                  {new Date(game.createdAt).toLocaleDateString()} • {game.stats.totalPlayers} гравців
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "#475569", marginTop: "2rem" }}>
              Ігор ще не було
            </div>
          )}
        </div>
      </div>

      {/* ЦЕНТРАЛЬНА КОЛОНКА: ДЕТАЛІ (60%) */}
      <div style={styles.mainContent}>
        {selectedGame ? (
          <div style={styles.detailWrapper}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
              <div>
                <h1 style={{ fontSize: "2rem", color: "#f8fafc", margin: 0 }}>
                  Деталі партії #{selectedGame.id.slice(0, 8)}
                </h1>
                <p style={{ color: "#94a3b8" }}>
                  Гра була зіграна {new Date(selectedGame.createdAt).toLocaleString()}
                </p>
              </div>
              <button 
                style={styles.closeBtn}
                onClick={() => {
                  router.push("/stats")
                  setSelectedGame(null)
                }}
              >
                Закрити ×
              </button>
            </div>

            {selectedGame.gameType === "whoami" ? (
              <WhoAmIDashboard game={selectedGame} />
            ) : (
              <div style={styles.legacyBox}>Статистика для Мафії в розробці...</div>
            )}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📊</div>
            <h2>Виберіть гру зі списку зліва</h2>
            <p>Щоб переглянути детальний аналіз, лог та результати</p>
          </div>
        )}
      </div>

      {/* ПРАВА КОЛОНКА: ФІЛЬТРИ ТА ПІДСУМОК (Додатково) */}
      <div style={styles.rightSidebar}>
         <div style={styles.card}>
            <h3 style={{ margin: "0 0 1rem 0", color: "#38bdf8", fontSize: "1rem" }}>Загальна статистика</h3>
            <div style={styles.statRow}>
               <span>Всього ігор:</span>
               <b>{history.length}</b>
            </div>
            <div style={styles.statRow}>
               <span>Перемог:</span>
               <b style={{ color: "#22c55e" }}>{history.filter(h => h.result === "win").length}</b>
            </div>
            <div style={styles.statRow}>
               <span>Вінрейт:</span>
               <b>{history.length > 0 ? Math.round((history.filter(h => h.result === "win").length / history.length) * 100) : 0}%</b>
            </div>
         </div>
      </div>
    </div>
  )
}

// Повноцінний Дашборд для Хто я
function WhoAmIDashboard({ game }: { game: any }) {
  const stats = game.stats
  const playerMap = stats.playerMap || {}
  
  if (!stats.fullLog) {
     return <div style={styles.legacyBox}>Ця гра була зіграна на старій версії двигуна. Детальні логи недоступні.</div>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
       {/* Картки результатів */}
       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          <div style={styles.miniCard}>
             <span style={{ fontSize: "0.85rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ваше слово</span>
             <b style={{ fontSize: "1.5rem", color: "#fbbf24" }}>{stats.assignedWord}</b>
          </div>
          <div style={styles.miniCard}>
             <span style={{ fontSize: "0.85rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Місце</span>
             <b style={{ fontSize: "1.5rem", color: "#38bdf8" }}>{stats.rank || (game.result === "win" ? "1" : "—")}</b>
          </div>
          <div style={styles.miniCard}>
             <span style={{ fontSize: "0.85rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Режим</span>
             <b style={{ fontSize: "1.2rem", color: "#f8fafc" }}>
               {stats.settings?.gameMode === "loser" ? "До лузера" : "До чемпіона"}
             </b>
          </div>
       </div>

       {/* Мапа слів (Assignments) */}
       <div>
         <h3 style={{ color: "#38bdf8", marginBottom: "1rem", fontSize: "1.1rem" }}>🗺️ Мапа слів</h3>
         <div style={styles.tableCard}>
            <table style={styles.table}>
               <thead>
                 <tr style={{ borderBottom: "1px solid #334155" }}>
                   <th style={styles.th}>Гравець</th>
                   <th style={styles.th}>Слово</th>
                   <th style={styles.th}>Ким загадано</th>
                 </tr>
               </thead>
               <tbody>
                 {Object.entries(stats.allAssignments).map(([pid, assign]: [string, any]) => (
                   <tr key={pid} style={{ borderBottom: "1px solid #1e293b" }}>
                     <td style={styles.td}>{playerMap[pid] || "Гравець"}</td>
                     <td style={{ ...styles.td, color: "#f8fafc", fontWeight: "bold" }}>{assign.word}</td>
                     <td style={{ ...styles.td, color: "#94a3b8" }}>{playerMap[assign.assignedBy] || "Система"}</td>
                   </tr>
                 ))}
               </tbody>
            </table>
         </div>
       </div>

       {/* Таймлайн подій */}
       <div>
         <h3 style={{ color: "#38bdf8", marginBottom: "1rem", fontSize: "1.1rem" }}>⏳ Хронологія гри</h3>
         <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {stats.fullLog.map((log: any, idx: number) => (
              <div key={idx} style={styles.timelineEntry}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ 
                      backgroundColor: log.type === "question" ? "#38bdf822" : "#22c55e22",
                      color: log.type === "question" ? "#38bdf8" : "#22c55e",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      textTransform: "uppercase"
                    }}>
                      {log.type === "question" ? "Питання" : "Вгадування"}
                    </span>
                    <b style={{ fontSize: "0.95rem" }}>{playerMap[log.playerId]}</b>
                  </div>
                  <span style={{ color: "#475569", fontSize: "0.8rem" }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ paddingLeft: "0", color: "#f8fafc", fontSize: "1rem" }}>
                   {log.type === "question" ? (
                     <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                       <span>{log.text || "Задав питання усно..."}</span>
                       
                       {/* Матриця відповідей */}
                       <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                         {Object.entries(log.answersSnapshot || {}).map(([pid, ans]: [string, any]) => (
                           <div key={pid} style={{
                             display: "flex",
                             alignItems: "center",
                             gap: "6px",
                             backgroundColor: "#0f172a",
                             padding: "4px 8px",
                             borderRadius: "20px",
                             fontSize: "0.75rem",
                             border: `1px solid ${ans === 'yes' ? '#22c55e44' : ans === 'no' ? '#ef444444' : '#47556944'}`
                           }}>
                             <span style={{ color: "#94a3b8" }}>{playerMap[pid]}:</span>
                             <span style={{ 
                               color: ans === 'yes' ? '#22c55e' : ans === 'no' ? '#ef4444' : '#eab308',
                               fontWeight: "bold"
                             }}>
                               {ans === 'yes' ? 'ТАК' : ans === 'no' ? 'НІ' : '???'}
                             </span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <div style={{ color: log.correct ? "#22c55e" : "#ef4444" }}>
                       Спроба вгадати: <b>{log.text}</b> — {log.correct ? "Успішно! 🎉" : "Помилка"}
                     </div>
                   )}
                </div>
              </div>
            ))}
         </div>
       </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    height: "calc(100vh - 64px)",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  sidebar: {
    flex: "0 0 300px",
    borderRight: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(30, 41, 59, 0.2)",
  },
  sidebarTitle: {
    padding: "1.5rem",
    margin: 0,
    fontSize: "1.2rem",
    borderBottom: "1px solid #334155",
  },
  gameList: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  gameCard: {
    padding: "1rem",
    borderRadius: "10px",
    border: "1px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: "2rem",
    position: "relative",
  },
  rightSidebar: {
    flex: "0 0 250px",
    borderLeft: "1px solid #334155",
    padding: "1.5rem",
    backgroundColor: "rgba(30, 41, 59, 0.2)",
  },
  detailWrapper: {
    maxWidth: "1000px",
    margin: "0 auto",
  },
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    textAlign: "center",
  },
  miniCard: {
    backgroundColor: "#1e293b",
    padding: "1.25rem",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    border: "1px solid #334155",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid #334155",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  th: {
    padding: "1rem",
    fontSize: "0.85rem",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    padding: "1rem",
    fontSize: "0.95rem",
  },
  timelineEntry: {
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    padding: "1.25rem",
    borderRadius: "12px",
    border: "1px solid #334155",
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "1.25rem",
    borderRadius: "12px",
    border: "1px solid #334155",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
    color: "#94a3b8",
  },
  closeBtn: {
    backgroundColor: "#334155",
    color: "#f8fafc",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  legacyBox: {
    padding: "3rem",
    textAlign: "center",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    border: "1px dashed #ef4444",
    borderRadius: "12px",
    color: "#ef4444",
    marginTop: "2rem",
  },
  center: {
    display: "flex",
    height: "100vh",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
  }
}
