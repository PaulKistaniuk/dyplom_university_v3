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

  // ФІЛЬТРИ
  const [filterGameType, setFilterGameType] = useState("all")
  const [filterDate, setFilterDate] = useState("all") // all, today, week, year, custom
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [filterLimit, setFilterLimit] = useState(50)
  const [filterMode, setFilterMode] = useState("all")
  const [filterRole, setFilterRole] = useState("all")

  const selectedId = searchParams?.get("gameId")

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

  // ЛОГІКА ФІЛЬТРАЦІЇ
  const filteredHistory = history.filter(game => {
    // 1. Тип гри
    if (filterGameType !== "all" && game.gameType !== filterGameType) return false

    // 2. Дати
    const gDate = new Date(game.createdAt)
    const now = new Date()
    if (filterDate === "today") {
      if (gDate.toDateString() !== now.toDateString()) return false
    } else if (filterDate === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (gDate < weekAgo) return false
    } else if (filterDate === "year") {
      if (gDate.getFullYear() !== now.getFullYear()) return false
    } else if (filterDate === "custom") {
      if (customStart && gDate < new Date(customStart)) return false
      if (customEnd && gDate > new Date(customEnd)) return false
    }

    // 3. Специфічні режими
    if (filterMode !== "all") {
      if (game.gameType === "whoami" && game.stats.settings?.gameMode !== filterMode) return false
      if (game.gameType === "mafia" && (game.stats.settings?.revealRoles ? "reveal" : "no-reveal") !== filterMode) return false
    }

    // 4. Ролі (Мафія)
    if (filterRole !== "all" && game.gameType === "mafia") {
      if (game.stats.role !== filterRole) return false
    }

    return true
  }).slice(0, filterLimit)

  // АГРЕГОВАНА СТАТИСТИКА (по відфільтрованому списку)
  const totalGames = filteredHistory.length
  const totalWins = filteredHistory.filter(h => h.result === "win").length
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  // Специфічна статистика для "Хто я"
  const whoAmIHistory = filteredHistory.filter(h => h.gameType === "whoami")
  const championStats = whoAmIHistory.filter(h => h.stats.settings?.gameMode === "champion")
  const loserStats = whoAmIHistory.filter(h => h.stats.settings?.gameMode === "loser")

  // Медалі (Who Am I)
  const medals = {
    gold: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 1).length,
    silver: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 2).length,
    bronze: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 3).length,
    skull: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.settings?.gameMode === "loser" && h.result === "lose").length
  }

  // РЕЖИМ СТАТИСТИКИ (для другого блоку)
  const [statView, setStatView] = useState("champion") // champion or loser

  // Ролі Мафії
  const mafiaRoles = filteredHistory.filter(h => h.gameType === "mafia")
  const roleStats: Record<string, { wins: number, total: number }> = {}
  mafiaRoles.forEach(h => {
    const r = h.stats.role || "unknown"
    if (!roleStats[r]) roleStats[r] = { wins: 0, total: 0 }
    roleStats[r].total++
    if (h.result === "win") roleStats[r].wins++
  })

  const sortedRoles = Object.entries(roleStats).sort((a, b) => {
    const rateA = a[1].wins / a[1].total
    const rateB = b[1].wins / b[1].total
    if (rateA !== rateB) return rateB - rateA
    return a[1].total - b[1].total // Ваше уточнення: якщо вінрейт рівний, то менше ігор = вище
  })

  const favoriteRole = sortedRoles[0] ? sortedRoles[0][0] : "—"
  const leastFavoriteRole = sortedRoles.length > 1 ? sortedRoles[sortedRoles.length - 1][0] : "—"

  const handleSelectGame = (game: any) => {
    router.push(`/stats?gameId=${game.id}`)
    setSelectedGame(game)
  }

  if (!user) return <div style={styles.center}>Будь ласка, увійдіть...</div>

  return (
    <div style={styles.layout}>
      {/* ГЛОБАЛЬНИЙ СКРОЛБАР */}
      <style>{`
        *::-webkit-scrollbar { width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        *::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>

      {/* ЛІВА КОЛОНКА */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Матчі ({totalGames})</h2>
        <div style={styles.gameList}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map(game => (
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
                    fontWeight: "bold"
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
              Нічого не знайдено
            </div>
          )}
        </div>
      </div>

      {/* ЦЕНТРАЛЬНА КОЛОНКА */}
      <div style={styles.mainContent}>
        {selectedGame ? (
          <div style={styles.detailWrapper}>
            <div style={styles.detailHeader}>
              <div>
                <h1 style={{ fontSize: "1.5rem", color: "#f8fafc", margin: 0 }}>
                  Партія #{selectedGame.id.slice(0, 8)}
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "4px" }}>
                  {new Date(selectedGame.createdAt).toLocaleString()}
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => { router.push("/stats"); setSelectedGame(null) }}>Закрити ×</button>
            </div>
            {selectedGame.gameType === "whoami" ? <WhoAmIDashboard game={selectedGame} /> : <div style={styles.legacyBox}>Статистика для Мафії в розробці...</div>}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📊</div>
            <h2>Виберіть гру для аналізу</h2>
            <p>Скористайтеся фільтрами справа для швидкого пошуку</p>
          </div>
        )}
      </div>

      {/* ПРАВА КОЛОНКА: ФІЛЬТРИ ТА АНАЛІТИКА */}
      <div style={styles.rightSidebar}>
        <div style={{ padding: "1.25rem", height: "100%", overflowY: "auto" }}>

          {/* АНАЛІТИКА: БЛОК 1 (ЗАГАЛЬНА) */}
          <div style={{ ...styles.card, marginBottom: "1rem", borderLeft: "4px solid #38bdf8" }}>
            <h3 style={styles.sidebarSectionTitle}>Загальна</h3>
            <div style={styles.statRow}><span>Всього ігор:</span> <b>{totalGames}</b></div>
            <div style={styles.statRow}><span>Вінрейт:</span> <b style={{ color: "#38bdf8" }}>{winRate}%</b></div>
          </div>

          {/* АНАЛІТИКА: БЛОК 2 (ДИНАМІЧНИЙ ДЛЯ ХТО Я) */}
          {filterGameType === "whoami" && (
            <div style={{ ...styles.card, marginBottom: "1.5rem", borderLeft: "4px solid #fbbf24" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <select
                  style={{ ...styles.select, width: "auto", padding: "2px 8px", fontSize: "0.75rem" }}
                  value={statView}
                  onChange={e => setStatView(e.target.value)}
                >
                  <option value="champion">🏆 До чемпіона</option>
                  <option value="loser">💀 До лузера</option>
                </select>
              </div>

              {statView === "champion" ? (
                <>
                  <div style={styles.statRow}><span>Всього ігор:</span> <b>{championStats.length}</b></div>
                  <div style={styles.statRow}><span>Перемог:</span> <b style={{ color: "#22c55e" }}>{championStats.filter(h => h.result === "win").length}</b></div>
                  <div style={styles.statRow}><span>Поразок:</span> <b style={{ color: "#ef4444" }}>{championStats.filter(h => h.result === "lose").length}</b></div>
                </>
              ) : (
                <>
                  <div style={styles.statRow}><span>Всього ігор:</span> <b>{loserStats.length}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                    <div style={styles.medalBox} title="Золото">🥇<b>{loserStats.filter(h => h.stats.rank === 1).length}</b></div>
                    <div style={styles.medalBox} title="Срібло">🥈<b>{loserStats.filter(h => h.stats.rank === 2).length}</b></div>
                    <div style={styles.medalBox} title="Бронза">🥉<b>{loserStats.filter(h => h.stats.rank === 3).length}</b></div>
                    <div style={styles.medalBox} title="Лузер">💀<b style={{ color: "#ef4444" }}>{medals.skull}</b></div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ФІЛЬТРИ */}
          <div style={{ ...styles.card, backgroundColor: "rgba(15, 23, 42, 0.4)" }}>
            <h3 style={styles.sidebarSectionTitle}>Фільтри</h3>

            <div style={styles.filterGroup}>
              <label style={styles.label}>Гра</label>
              <select style={styles.select} value={filterGameType} onChange={e => setFilterGameType(e.target.value)}>
                <option value="all">Всі ігри</option>
                <option value="whoami">Хто я?</option>
                <option value="mafia">Мафія</option>
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.label}>Період</label>
              <select style={styles.select} value={filterDate} onChange={e => setFilterDate(e.target.value)}>
                <option value="all">За весь час</option>
                <option value="today">Сьогодні</option>
                <option value="week">Тиждень</option>
                <option value="year">Рік</option>
                <option value="custom">Кастомний...</option>
              </select>
              {filterDate === "custom" && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <input type="date" style={styles.input} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  <input type="date" style={styles.input} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              )}
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.label}>Кількість</label>
              <select style={styles.select} value={filterLimit} onChange={e => setFilterLimit(Number(e.target.value))}>
                <option value={5}>5 матчів</option>
                <option value={10}>10 матчів</option>
                <option value={20}>20 матчів</option>
                <option value={50}>50 матчів</option>
              </select>
            </div>

            {filterGameType === "whoami" && (
              <div style={styles.filterGroup}>
                <label style={styles.label}>Режим гри</label>
                <select style={styles.select} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                  <option value="all">Усі режими</option>
                  <option value="champion">Чемпіон</option>
                  <option value="loser">Лузер</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ПЕРЕРОБЛЕНИЙ ДАШБОРД (Дві колонки + Медалі)
function WhoAmIDashboard({ game }: { game: any }) {
  const stats = game.stats
  const playerMap = stats.playerMap || {}
  const winners = stats.winners || []
  const assignments = stats.allAssignments || {}

  if (!stats.fullLog) {
    return <div style={styles.legacyBox}>Ця гра була зіграна на старій версії двигуна. Детальні логи недоступні.</div>
  }

  const isChampionMode = stats.settings?.gameMode === "champion"
  const myRank = stats.rank || (game.result === "win" ? 1 : 0)
  const isLoser = !winners.includes(game.userId) && winners.length > 0

  // Функція для визначення стилів рангу
  const getRankInfo = (rank: number, result: string, userId: string) => {
    if (isChampionMode) {
      if (result === "win") return { label: "🏆 Перемога", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" }
      return { label: "Програв", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" }
    }

    // Режим лузера
    if (!winners.includes(userId)) return { label: "💀 Програв (Лузер)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" }
    if (rank === 1) return { label: "🥇 1-ше місце", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" }
    if (rank === 2) return { label: "🥈 2-ге місце", color: "#cbd5e1", bg: "rgba(203, 213, 225, 0.1)" }
    if (rank === 3) return { label: "🥉 3-тє місце", color: "#cd7f32", bg: "rgba(205, 127, 50, 0.1)" }
    return { label: `Вгадав (${rank}-й)`, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" }
  }

  const myInfo = getRankInfo(myRank, game.result, game.userId)

  return (
    <div style={styles.innerGrid}>
      {/* ВНУТРІШНЯ ЛІВА: ІНФОРМАЦІЯ (30%) */}
      <div style={styles.innerLeft}>
        <div style={styles.miniCard}>
          <span style={styles.cardLabel}>Ваше слово</span>
          <b style={{ fontSize: "1.4rem", color: "#fbbf24" }}>{stats.assignedWord}</b>
        </div>

        <div style={{ ...styles.miniCard, borderColor: myInfo.color + "44", backgroundColor: myInfo.bg }}>
          <span style={{ ...styles.cardLabel, color: myInfo.color }}>Ваш результат</span>
          <b style={{ fontSize: "1.4rem", color: myInfo.color }}>{myInfo.label}</b>
        </div>

        <div style={styles.miniCard}>
          <span style={styles.cardLabel}>Учасників</span>
          <b style={{ fontSize: "1.2rem", color: "#f8fafc" }}>{stats.totalPlayers} гравців</b>
        </div>

        <div style={styles.miniCard}>
          <span style={styles.cardLabel}>Налаштування</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <div style={styles.settingItem}>
              <span>Режим:</span>
              <b style={{ color: "#38bdf8" }}>{isChampionMode ? "До переможця" : "До лузера"}</b>
            </div>
            <div style={styles.settingItem}>
              <span>Чат:</span>
              <b>{stats.settings?.chatMode === "chat" ? "Текстовий" : "Усний"}</b>
            </div>
            <div style={styles.settingItem}>
              <span>Слова:</span>
              <b>{stats.settings?.wordSource === "ai" ? "ШІ" : "Гравці"}</b>
            </div>
          </div>
        </div>
      </div>

      {/* ВНУТРІШНЯ ПРАВА: МАПА ТА ТАЙМЛАЙН (70%) */}
      <div style={styles.innerRight}>
        {/* Мапа слів */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={styles.subTitle}>🗺️ Мапа слів</h3>
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155" }}>
                  <th style={styles.th}>Гравець</th>
                  <th style={styles.th}>Слово</th>
                  <th style={styles.th}>Ким загадано</th>
                  <th style={styles.th}>Місце</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(assignments).map(([pid, assign]: [string, any]) => {
                  const rank = assign.rank || 0
                  const isUserWinner = winners.includes(pid)
                  const info = getRankInfo(rank, isUserWinner ? "win" : "lose", pid)

                  return (
                    <tr key={pid} style={{
                      borderBottom: "1px solid #1e293b",
                      backgroundColor: rank > 0 && rank <= 3 ? info.bg : "transparent"
                    }}>
                      <td style={styles.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {playerMap[pid] || "Гравець"}
                          {pid === game.userId && <span style={{ fontSize: "0.6rem", color: "#38bdf8", border: "1px solid #38bdf8", padding: "1px 4px", borderRadius: "4px" }}>ВИ</span>}
                        </div>
                      </td>
                      <td style={{ ...styles.td, color: "#f8fafc", fontWeight: "bold" }}>{assign.word}</td>
                      <td style={{ ...styles.td, color: "#94a3b8", fontSize: "0.85rem" }}>{playerMap[assign.assignedBy] || "Система"}</td>
                      <td style={{ ...styles.td, color: info.color, fontWeight: "bold", fontSize: "0.85rem" }}>
                        {info.label.split(' ')[0]} {info.label.split(' ')[1] === 'місце' ? 'місце' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Таймлайн з власним скролом у блоці */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <h3 style={styles.subTitle}>⏳ Хронологія гри</h3>
          <div style={styles.chronologyBlock}>
            <div style={styles.scrollableLog}>
              {stats.fullLog.map((log: any, idx: number) => (
                <div key={idx} style={styles.timelineEntry}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        backgroundColor: log.type === "question" ? "#38bdf822" : "#22c55e22",
                        color: log.type === "question" ? "#38bdf8" : "#22c55e",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        textTransform: "uppercase"
                      }}>
                        {log.type === "question" ? "Питання" : "Вгадування"}
                      </span>
                      <b style={{ fontSize: "0.9rem" }}>{playerMap[log.playerId]}</b>
                    </div>
                    <span style={{ color: "#475569", fontSize: "0.75rem" }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
                    {log.type === "question" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <span>{log.text || "Запитав усно..."}</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {Object.entries(log.answersSnapshot || {}).map(([pid, ans]: [string, any]) => (
                            <div key={pid} style={{
                              display: "flex", gap: "4px", backgroundColor: "#0f172a", padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", border: "1px solid #334155"
                            }}>
                              <span style={{ color: "#64748b" }}>{playerMap[pid]}:</span>
                              <b style={{ color: ans === 'yes' ? '#22c55e' : ans === 'no' ? '#ef4444' : '#eab308' }}>
                                {ans === 'yes' ? 'ТАК' : ans === 'no' ? 'НІ' : '???'}
                              </b>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: log.correct ? "#22c55e" : "#ef4444", fontWeight: "bold" }}>
                        Вгадав: {log.text} — {log.correct ? "Успішно! 🎉" : "Помилка"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    height: "calc(99vh - 64px)",
    maxHeight: "calc(100vh - 64px)",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    flex: "0 0 300px",
    borderRight: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(30, 41, 59, 0.2)",
  },
  sidebarTitle: {
    padding: "1.25rem 1.5rem",
    margin: 0,
    fontSize: "1.1rem",
    borderBottom: "1px solid #334155",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#94a3b8",
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
    borderRadius: "12px",
    border: "1px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  detailWrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    padding: "1.5rem 2.5rem",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #1e293b",
  },
  innerGrid: {
    display: "flex",
    gap: "2rem",
    flex: 1,
    overflow: "hidden",
  },
  innerLeft: {
    flex: "0 0 280px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  innerRight: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  scrollableLog: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    paddingRight: "10px",
  },
  chronologyBlock: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: "14px",
    border: "1px solid #334155",
    padding: "1rem",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  },
  miniCard: {
    backgroundColor: "#1e293b",
    padding: "1.25rem",
    borderRadius: "14px",
    border: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
  },
  cardLabel: {
    fontSize: "0.75rem",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "6px",
  },
  settingItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  subTitle: {
    color: "#38bdf8",
    marginBottom: "1rem",
    fontSize: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "14px",
    border: "1px solid #334155",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "0.75rem 1rem",
    fontSize: "0.7rem",
    color: "#64748b",
    textAlign: "left",
  },
  td: {
    padding: "0.75rem 1rem",
  },
  timelineEntry: {
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    padding: "1rem",
    borderRadius: "12px",
    border: "1px solid #334155",
  },
  rightSidebar: {
    flex: "0 0 280px",
    borderLeft: "1px solid #334155",
    padding: "1.5rem",
    backgroundColor: "rgba(30, 41, 59, 0.2)",
    display: "flex",
    flexDirection: "column",
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "1.25rem",
    borderRadius: "14px",
    border: "1px solid #334155",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.8rem",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  filterGroup: {
    marginBottom: "1rem"
  },
  label: {
    fontSize: "0.7rem",
    color: "#64748b",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "6px",
    letterSpacing: "0.05em"
  },
  select: {
    width: "100%",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    border: "1px solid #334155",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "0.85rem",
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.2s"
  },
  input: {
    width: "100%",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    border: "1px solid #334155",
    padding: "8px",
    borderRadius: "8px",
    fontSize: "0.8rem",
    outline: "none"
  },
  medalBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    fontSize: "0.8rem"
  },
  closeBtn: {
    backgroundColor: "#334155",
    color: "#f8fafc",
    border: "none",
    padding: "0.6rem 1.2rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    transition: "all 0.2s",
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
  legacyBox: {
    padding: "3rem",
    textAlign: "center",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    border: "1px dashed #ef4444",
    borderRadius: "14px",
    color: "#ef4444",
  },
  center: {
    display: "flex",
    height: "100vh",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
  }
}
