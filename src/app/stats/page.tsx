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
    const fetchGameDetails = async () => {
      if (!selectedId) {
        setSelectedGame(null)
        return
      }

      // Шукаємо гру в списку історії, щоб дізнатись її тип
      const gameFromHistory = history.find(h => h.id === selectedId)
      
      if (gameFromHistory) {
        if (gameFromHistory.gameType === "mafia") {
          // ДЛЯ МАФІЇ: Робимо детальний запит на бекенд, щоб отримати timeline, snapshots та повних players
          try {
            const res = await fetch(`/api/stats?gameId=${selectedId}`)
            const detailedGame = await res.json()
            setSelectedGame(detailedGame)
          } catch (err) {
            console.error("Failed to fetch detailed mafia stats:", err)
          }
        } else {
          // ДЛЯ "ХТО Я": Даних з історії (бокової панелі) цілком достатньо, нічого не ламаємо
          setSelectedGame(gameFromHistory)
        }
      }
    }

    fetchGameDetails()
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

  // АГРЕГОВАНА СТАТИСТИКА
  const totalGames = filteredHistory.length
  const totalWins = filteredHistory.filter(h => h.result === "win").length
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  // Специфічна статистика для "Хто я"
  const whoAmIHistory = filteredHistory.filter(h => h.gameType === "whoami")
  const championStats = whoAmIHistory.filter(h => h.stats.settings?.gameMode === "champion")
  const loserStats = whoAmIHistory.filter(h => h.stats.settings?.gameMode === "loser")

  const medals = {
    gold: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 1).length,
    silver: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 2).length,
    bronque: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.rank === 3).length,
    skull: filteredHistory.filter(h => h.gameType === "whoami" && h.stats.settings?.gameMode === "loser" && h.result === "lose").length
  }

  const [statView, setStatView] = useState("champion")

  const handleSelectGame = (game: any) => {
    router.push(`/stats?gameId=${game.id}`)
    setSelectedGame(game)
  }

  if (!user) return <div style={styles.center}>Будь ласка, увійдіть...</div>

  return (
    <div style={styles.layout}>
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
                  {new Date(game.createdAt).toLocaleDateString()} • {game.stats?.totalPlayers || game.stats?.alivePlayers?.length || 0} гравців
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
            {selectedGame.gameType === "whoami" ? (
              <WhoAmIDashboard game={selectedGame} />
            ) : (
              <MafiaDashboard game={selectedGame} />
            )}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📊</div>
            <h2>Виберіть гру для аналізу</h2>
            <p>Скористайтеся фільтрами справа для швидкого пошуку</p>
          </div>
        )}
      </div>

      {/* ПРАВА КОЛОНКА */}
      <div style={styles.rightSidebar}>
        <div style={{ padding: "1.25rem", height: "100%", overflowY: "auto" }}>
          <div style={{ ...styles.card, marginBottom: "1rem", borderLeft: "4px solid #38bdf8" }}>
            <h3 style={styles.sidebarSectionTitle}>Загальна</h3>
            <div style={styles.statRow}><span>Всього ігор:</span> <b>{totalGames}</b></div>
            <div style={styles.statRow}><span>Вінрейт:</span> <b style={{ color: "#38bdf8" }}>{winRate}%</b></div>
          </div>

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
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// НАДІЙНИЙ КОМПОНЕНТ СТАТИСТИКИ МАФІЇ (БЕЗ TS ПОМИЛОК)
// ==========================================
function MafiaDashboard({ game }: { game: any }) {
  // Дані можуть лежати прямо в game або всередині game.stats/game.actions
  const mafiaData = game.stats?.timeline ? game.stats : game;
  const timeline = mafiaData.timeline || [];
  const snapshots = mafiaData.snapshots || { days: [], nights: [], votings: [] };
  
  // Мапа користувачів для читабельних імен
  const playerMap = mafiaData.playerMap || {};
  const getPlayerName = (id: string) => playerMap[id] || `Гравець #${id.slice(0, 4)}`;

  // Визначаємо команду переможців
  const winnerTeam = mafiaData.winnerTeam || (game.result === "win" ? "Мирні Гравці / ШЕРИФ" : "Мафія");

  // Генеруємо список вкладок динамічно
  const [activeTab, setActiveTab] = useState("general");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const tabs = [{ id: "general", label: "Загальна" }];
  const totalNights = snapshots.nights?.length || 0;
  const totalDays = snapshots.days?.length || 0;
  const maxCycles = Math.max(totalNights, totalDays);

  for (let i = 1; i <= maxCycles; i++) {
    if (snapshots.nights?.some((n: any) => n.night === i)) {
      tabs.push({ id: `night_${i}`, label: `Ніч ${i}` });
    }
    if (snapshots.days?.some((d: any) => d.day === i)) {
      tabs.push({ id: `day_${i}`, label: `День ${i}` });
    }
  }

  // Отримуємо чистий список гравців із бази даних
  const dbPlayers = mafiaData.players || [];

  // Якщо база повернула масив, використовуємо порядок розсадки (userId), інакше робимо фолбек на унікальний сет із логів
  const allSessionPlayers: string[] = dbPlayers.length > 0
    ? dbPlayers.map((p: any) => p.userId)
    : (Array.from(new Set([
        ...(snapshots.days?.[0]?.alivePlayers || []),
        ...(snapshots.nights?.[0]?.alivePlayers || []),
        ...timeline.filter((t: any) => t.playerId).map((t: any) => t.playerId)
      ])) as string[]);

  // Повертає роль безпосередньо з бази даних, або робить фолбек якщо гра стара
  const getPlayerRole = (id: string) => {
    const dbPlayer = dbPlayers.find((p: any) => p.userId === id);
    if (dbPlayer?.role) return dbPlayer.role;

    const playerRoles = mafiaData.playerRoles || {}; 
    if (playerRoles[id]) return playerRoles[id];
    
    if (timeline.some((t: any) => t.action === "kill_vote" && t.userId === id)) return "Мафія / Дон";
    if (snapshots.nights?.some((n: any) => n.commissarCheck?.playerId === id)) return "Комісар";
    return "Мирний Житель";
  };

  // Повертає номер стільця гравця
  const getPlayerNumber = (id: string) => {
    const dbPlayer = dbPlayers.find((p: any) => p.userId === id);
    return dbPlayer ? dbPlayer.number : null;
  };

  // Поточний вибраний гравець для кабінету аналітики
  const currentSelectedPlayer = dbPlayers.find((p: any) => p.userId === selectedPlayerId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ПАНЕЛЬ ВКЛАДОК */}
      <div style={mafiaStyles.tabContainer}>
        {tabs.map((tab: any) => (
          <button
            key={tab.id}
            style={{
              ...mafiaStyles.tabButton,
              borderBottomColor: activeTab === tab.id ? "#38bdf8" : "transparent",
              color: activeTab === tab.id ? "#38bdf8" : "#94a3b8",
              backgroundColor: activeTab === tab.id ? "rgba(56, 189, 248, 0.05)" : "transparent"
            }}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedPlayerId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ВМІСТ ВКЛАДОК */}
      <div style={{ flex: 1, overflow: "hidden", marginTop: "1rem" }}>
        
        {/* === ЗАГАЛЬНА ВКЛАДКА === */}
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={mafiaStyles.winnerBanner}>
              🏆 Перемогу здобула команда: <span style={{ color: winnerTeam.toLowerCase().includes("мафія") ? "#ef4444" : "#22c55e" }}>{winnerTeam}</span>
            </div>
            
            <div style={{ display: "flex", gap: "1.5rem", flex: 1, overflow: "hidden", marginTop: "1rem" }}>
              {/* Лівий блок (60%) — Картки гравців у порядку стільців */}
              <div style={{ flex: "0 0 60%", overflowY: "auto", paddingRight: "4px" }}>
                <h3 style={styles.subTitle}>🎭 Ролі учасників сесії</h3>
                <div style={mafiaStyles.playerCardsGrid}>
                  {/* ФІКС ТУТ: явно типізовано (pid: string) */}
                  {/* Тимчасовий сирий вивід даних в один рядок для дебагу */}
                  <div style={{ background: "#111", color: "#00ff00", padding: "10px", fontSize: "11px", wordBreak: "break-all", whiteSpace: "nowrap", overflowX: "auto" }}>
                    {JSON.stringify(game)}
                  </div>
                  {allSessionPlayers.map((pid: string) => {
                    const role = getPlayerRole(pid);
                    const isMafia = role.toLowerCase().includes("мафія") || role.toLowerCase().includes("дон");
                    const seatNumber = getPlayerNumber(pid);
                    
                    return (
                      <div key={pid} style={mafiaStyles.playerCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", fontSize: "1.05rem" }}>
                            {seatNumber !== null ? `[№${seatNumber}] ` : ""}{getPlayerName(pid)}
                          </span>
                          {pid === game.userId && <span style={mafiaStyles.youBadge}>ВИ</span>}
                        </div>
                        <div style={{ 
                          marginTop: "8px", 
                          fontSize: "0.85rem", 
                          fontWeight: "600",
                          color: isMafia ? "#ef4444" : "#38bdf8"
                        }}>
                          🕵️‍♂️ {role}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Правий блок (40%) — Логи гри */}
              <div style={{ flex: "1", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h3 style={styles.subTitle}>📜 Повний лог подій</h3>
                <div style={mafiaStyles.logBox}>
                  {timeline.map((event: any, idx: number) => (
                    <div key={idx} style={mafiaStyles.logEntry}>
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        [{event.day ? `День ${event.day}` : `Ніч ${event.dayNumber || '?'}`}]
                      </span>
                      {event.type === "speech" && (
                        <span> 🗣️ <b>{getPlayerName(event.playerId)}</b> тримав промову ({event.speechType === "discussion" ? "обговорення" : "захист"}) тривалістю <b>{event.durationSec}с</b></span>
                      )}
                      {event.type === "night_action" && event.action === "kill_vote" && (
                        <span> 🔫  Мафіозі <b>{getPlayerName(event.userId)}</b> проголосував на ліквідацію <b>{getPlayerName(event.targetId)}</b></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === ВКЛАДКА ДЕНЬ X === */}
        {activeTab.startsWith("day_") && (() => {
          const dayNum = parseInt(activeTab.split("_")[1]);
          const daySnapshot = snapshots.days?.find((d: any) => d.day === dayNum) || {};
          const prevNightSnapshot = snapshots.nights?.find((n: any) => n.night === dayNum) || {};
          
          const aliveList = daySnapshot.alivePlayers || [];
          const deadList = daySnapshot.deadPlayers || [];

          const selectedPlayerSpeeches = timeline.filter((t: any) => t.day === dayNum && t.playerId === selectedPlayerId && t.type === "speech");
          const mainSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "discussion");
          const defenseSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "defense");
          const reDefenseSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "re_discussion" || s.speechType === "justification_again");

          const nominationsMade = daySnapshot.nominations?.[selectedPlayerId || ""] || null;

          return (
            <div style={{ display: "flex", gap: "1.5rem", height: "100%", overflow: "hidden" }}>
              {/* ЛІВА ЧАСТИНА: Списки гравців за стільцями */}
              <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                <div style={mafiaStyles.nightSummaryCard}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#fbbf24", fontSize: "0.9rem", textTransform: "uppercase" }}>🌃 Підсумки ночі {dayNum}</h4>
                  <div style={mafiaStyles.summaryItem}>
                    <span>Жертва мафії:</span> 
                    <b>{prevNightSnapshot.killedPlayerId ? getPlayerName(prevNightSnapshot.killedPlayerId) : "Ніхто (Промах)"}</b>
                  </div>
                  <div style={mafiaStyles.summaryItem}>
                    <span>Візит лікаря:</span> 
                    <b>{prevNightSnapshot.savedPlayerId ? getPlayerName(prevNightSnapshot.savedPlayerId) : "Не було лікування"}</b>
                  </div>
                  <div style={mafiaStyles.summaryItem}>
                    <span>Перевірка Дона:</span> 
                    <b>{prevNightSnapshot.donCheck?.targetId ? `${getPlayerName(prevNightSnapshot.donCheck.targetId)} (${prevNightSnapshot.donCheck.result ? 'Шериф!' : 'Ні'})` : "Не перевіряв"}</b>
                  </div>
                  <div style={mafiaStyles.summaryItem}>
                    <span>Перевірка Комісара:</span> 
                    <b>{prevNightSnapshot.commissarCheck?.targetId ? `${getPlayerName(prevNightSnapshot.commissarCheck.targetId)} (${prevNightSnapshot.commissarCheck.result ? 'Мафія!' : 'Мирний'})` : "Не перевіряв"}</b>
                  </div>
                </div>

                <div style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Гравці на цей день</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
                    {/* ФІКС ТУТ: явно типізовано (pid: string) */}
                    {allSessionPlayers.map((pid: string) => {
                      const isAlive = aliveList.includes(pid);
                      const isJustDead = deadList.includes(pid);
                      const seatNumber = getPlayerNumber(pid);

                      return (
                        <div
                          key={pid}
                          style={{
                            ...mafiaStyles.selectablePlayerRow,
                            borderColor: selectedPlayerId === pid ? "#38bdf8" : "transparent",
                            backgroundColor: selectedPlayerId === pid ? "rgba(56, 189, 248, 0.1)" : "rgba(30, 41, 59, 0.4)"
                          }}
                          onClick={() => setSelectedPlayerId(pid)}
                        >
                          <span style={{ textDecoration: !isAlive ? "line-through" : "none", color: isAlive ? "#f8fafc" : "#64748b" }}>
                            {seatNumber !== null ? `${seatNumber}. ` : ""}{getPlayerName(pid)}
                          </span>
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            backgroundColor: isAlive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: isAlive ? "#22c55e" : "#ef4444"
                          }}>
                            {isAlive ? "Живий" : isJustDead ? "Вбитий вночі" : "Мертвий"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ПРАВА ЧАСТИНА: Персональний кабінет */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {selectedPlayerId ? (
                  <div style={mafiaStyles.personalInvestigationContainer}>
                    <h3 style={{ margin: "0 0 1rem 0", color: "#38bdf8" }}>
                      📊 Персональний кабінет аналітики: <span style={{ color: "#fff" }}>{getPlayerName(selectedPlayerId)}</span>
                    </h3>
                    
                    <div style={mafiaStyles.investigationGrid}>
                      <div style={mafiaStyles.investigationItem}>
                        <span style={mafiaStyles.investigationLabel}>Основна промова (Discussion)</span>
                        <b style={{ fontSize: "1.2rem" }}>{mainSpeech ? `${mainSpeech.durationSec} секунд` : "Не виступав / Був мертвий"}</b>
                      </div>

                      <div style={mafiaStyles.investigationItem}>
                        <span style={mafiaStyles.investigationLabel}>Виставлення на голосування (Номінація)</span>
                        <b>{nominationsMade ? `Виставив гравця: ${getPlayerName(nominationsMade)}` : "Нікого не виставив"}</b>
                      </div>

                      <div style={mafiaStyles.investigationItem}>
                        <span style={mafiaStyles.investigationLabel}>Промова виправдання (Захист)</span>
                        <b style={{ color: defenseSpeech ? "#fbbf24" : "#94a3b8" }}>
                          {defenseSpeech ? `${defenseSpeech.durationSec} секунд` : "Не виставлявся на голосування"}
                        </b>
                      </div>

                      <div style={mafiaStyles.investigationItem}>
                        <span style={mafiaStyles.investigationLabel}>Повторне виправдання (Перестрілка)</span>
                        <b style={{ color: reDefenseSpeech ? "#fbbf24" : "#94a3b8" }}>
                          {reDefenseSpeech ? `${reDefenseSpeech.durationSec} секунд` : "Не брав участі"}
                        </b>
                      </div>
                    </div>

                    <div style={{ marginTop: "1.5rem" }}>
                      <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>🗳️ Голосування гравця в цей день</h4>
                      <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "10px", border: "1px solid #334155" }}>
                        <div style={mafiaStyles.summaryItem}>
                          <span>Основне голосування:</span>
                          <b>{daySnapshot.nominations?.[selectedPlayerId] ? `Проголосував проти ${getPlayerName(daySnapshot.nominations[selectedPlayerId])}` : "Голос не зафіксовано / Не голосував"}</b>
                        </div>
                        <div style={{ ...mafiaStyles.summaryItem, marginTop: "8px", borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                          <span>Повторне голосування:</span>
                          <b style={{ color: "#64748b" }}>Дані відсутні (одностайне рішення)</b>
                        </div>
                      </div>
                    </div>

                    {/* ДИНАМІЧНИЙ ВИВІД ОЦІНОК ТА ML-МЕТРИК З ТАБЛИЦІ GAMEPLAYER */}
                    {currentSelectedPlayer && (Object.keys(currentSelectedPlayer.state).length > 0 || Object.keys(currentSelectedPlayer.personal).length > 0) && (
                      <div style={{ marginTop: "1.5rem" }}>
                        <h4 style={{ margin: "0 0 8px 0", color: "#a855f7" }}>🧠 Системні метрики гравця (БД & ML)</h4>
                        <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "10px", border: "1px solid #334155", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          {currentSelectedPlayer.state?.fouls !== undefined && (
                            <div style={mafiaStyles.summaryItem}>
                              <span>Кількість фолів:</span>
                              <b style={{ color: currentSelectedPlayer.state.fouls >= 3 ? "#ef4444" : "#fff" }}>{currentSelectedPlayer.state.fouls}</b>
                            </div>
                          )}
                          {currentSelectedPlayer.personal?.mlScore !== undefined && (
                            <div style={mafiaStyles.summaryItem}>
                              <span>ML-Оцінка гри:</span>
                              <b style={{ color: "#22c55e" }}>{currentSelectedPlayer.personal.mlScore}</b>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div style={mafiaStyles.emptyInvestigationField}>
                    <div style={{ fontSize: "2.5rem" }}>🖱️</div>
                    <p style={{ marginTop: "10px", margin: 0 }}>Виберіть конкретного гравця зі списку ліворуч,</p>
                    <p style={{ color: "#64748b", fontSize: "0.85rem" }}>щоб заповнити порожнє поле його персональним розслідуванням, часом промов та голосами.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* === ВКЛАДКА НІЧ X === */}
        {activeTab.startsWith("night_") && (() => {
          const nightNum = parseInt(activeTab.split("_")[1]);
          const nightSnapshot = snapshots.nights?.find((n: any) => n.night === nightNum) || {};
          const votesMap = nightSnapshot.mafiaVotes || {};
          
          return (
            <div style={mafiaStyles.nightContainer}>
              <h3 style={{ ...styles.subTitle, color: "#a855f7" }}>🌌 Детальний аналіз таємних дій Ночі #{nightNum}</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
                <div style={styles.card}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#ef4444" }}>🔫 Дії чорної команди (Мафія)</h4>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Координація вогню та фінальний вибір мети:</p>
                  <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginTop: "8px" }}>
                    {Object.keys(votesMap).length > 0 ? (
                      Object.entries(votesMap).map(([mafiaId, targetId]: [string, any]) => (
                        <div key={mafiaId} style={{ marginBottom: "6px", fontSize: "0.9rem" }}>
                          🥷 <b>{getPlayerName(mafiaId)}</b> висловив вотум смерті проти 🎯 <b>{getPlayerName(targetId)}</b>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Договір було проведено наосліп без явних голосувань.</div>
                    )}
                    <div style={{ marginTop: "10px", borderTop: "1px solid #334155", paddingTop: "8px", fontWeight: "bold", color: "#ef4444" }}>
                      Підсумок замаху: {nightSnapshot.killedPlayerId ? `Вбито гравця ${getPlayerName(nightSnapshot.killedPlayerId)}` : "Нікого не вбито (Промах / Сав)"}
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#22c55e" }}>🩺 Медична служба (Лікар)</h4>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Кого міг полікувати і кого вибрав у цю ніч:</p>
                  <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginTop: "8px", height: "calc(100% - 40px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                      🏥 Обраний на лікування: <span style={{ color: "#22c55e" }}>{nightSnapshot.savedPlayerId ? getPlayerName(nightSnapshot.savedPlayerId) : "Ніхто / Себе"}</span>
                    </div>
                    {nightSnapshot.savedPlayerId && nightSnapshot.killedPlayerId === nightSnapshot.savedPlayerId && (
                      <div style={{ color: "#22c55e", fontWeight: "bold", marginTop: "8px", fontSize: "0.85rem" }}>🎉 Лікар успішно відбив нічний постріл мафії!</div>
                    )}
                  </div>
                </div>

                <div style={styles.card}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#f43f5e" }}>🕶️ Пошуки Шерифа (Дон Мафії)</h4>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Кого перевіряв лідер угруповання:</p>
                  <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginTop: "8px" }}>
                    {nightSnapshot.donCheck?.targetId ? (
                      <div>
                        Перевірив гравця: <b>{getPlayerName(nightSnapshot.donCheck.targetId)}</b> <br/>
                        Результат: <b style={{ color: nightSnapshot.donCheck.result ? "#ef4444" : "#22c55e" }}>{nightSnapshot.donCheck.result ? "Знайшов справжнього Комісара! 🔍" : "Звичайний мирний житель"}</b>
                      </div>
                    ) : (
                      <div style={{ color: "#64748b" }}>Цієї ночі Дон не проводив перевірок.</div>
                    )}
                  </div>
                </div>

                <div style={styles.card}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#38bdf8" }}>🛡️ Слідство правоохоронців (Комісар)</h4>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Рентгенівські знімки нічних таємниць:</p>
                  <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginTop: "8px" }}>
                    {nightSnapshot.commissarCheck?.targetId ? (
                      <div>
                        Перевірив гравця: <b>{getPlayerName(nightSnapshot.commissarCheck.targetId)}</b> <br/>
                        Результат: <b style={{ color: nightSnapshot.commissarCheck.result ? "#ef4444" : "#22c55e" }}>{nightSnapshot.commissarCheck.result ? "Червона загроза! Знайдено МАФІЮ 🚨" : "Гравець чистий (Мирний)"}</b>
                      </div>
                    ) : (
                      <div style={{ color: "#64748b" }}>Комісар спав або був ліквідований раніше.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// Потрібні додаткові стилі спеціально для мафії
const mafiaStyles: Record<string, React.CSSProperties> = {
  tabContainer: {
    display: "flex",
    gap: "4px",
    borderBottom: "1px solid #334155",
    overflowX: "auto",
    paddingBottom: "1px"
  },
  tabButton: {
    padding: "0.6rem 1.2rem",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    transition: "all 0.2s",
    whiteSpace: "nowrap"
  },
  winnerBanner: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "1rem 1.5rem",
    fontSize: "1.2rem",
    fontWeight: "bold",
    textAlign: "center"
  },
  playerCardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "10px",
    marginTop: "0.5rem"
  },
  playerCard: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "1rem",
  },
  youBadge: {
    fontSize: "0.65rem",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    padding: "1px 5px",
    borderRadius: "4px",
    fontWeight: "bold"
  },
  logBox: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "1rem",
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  logEntry: {
    fontSize: "0.85rem",
    borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
    paddingBottom: "6px",
    color: "#f8fafc"
  },
  nightSummaryCard: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "1rem"
  },
  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    marginBottom: "4px"
  },
  selectablePlayerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s"
  },
  emptyInvestigationField: {
    flex: 1,
    border: "2px dashed #334155",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    textAlign: "center",
    padding: "2rem"
  },
  personalInvestigationContainer: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "1.5rem",
    flex: 1,
    overflowY: "auto"
  },
  investigationGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "0.5rem"
  },
  investigationItem: {
    backgroundColor: "#0f172a",
    border: "1px solid #22d3ee22",
    borderRadius: "10px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  investigationLabel: {
    fontSize: "0.75rem",
    color: "#64748b",
    textTransform: "uppercase"
  },
  nightContainer: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "1.5rem",
    height: "100%",
    overflowY: "auto"
  }
};

// ==========================================
// КОМПОНЕНТ ДЛЯ СТАРОЇ ГРИ "ХТО Я" (ЗАЛИШИВСЯ БЕЗ ЗМІН)
// ==========================================
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

  const getRankInfo = (rank: number, result: string, userId: string) => {
    if (isChampionMode) {
      if (result === "win") return { label: "🏆 Перемога", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" }
      return { label: "Програв", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" }
    }
    if (!winners.includes(userId)) return { label: "💀 Програв (Лузер)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" }
    if (rank === 1) return { label: "🥇 1-ше місце", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" }
    if (rank === 2) return { label: "🥈 2-ге місце", color: "#cbd5e1", bg: "rgba(203, 213, 225, 0.1)" }
    if (rank === 3) return { label: "🥉 3-тє місце", color: "#cd7f32", bg: "rgba(205, 127, 50, 0.1)" }
    return { label: `Вгадав (${rank}-й)`, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" }
  }

  const myInfo = getRankInfo(myRank, game.result, game.userId)

  return (
    <div style={styles.innerGrid}>
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

      <div style={styles.innerRight}>
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
                    <tr key={pid} style={{ borderBottom: "1px solid #1e293b", backgroundColor: rank > 0 && rank <= 3 ? info.bg : "transparent" }}>
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
                            <div key={pid} style={{ display: "flex", gap: "4px", backgroundColor: "#0f172a", padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", border: "1px solid #334155" }}>
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

// СТИЛІ (ЗАЛИШИЛИСЬ ОРИГІНАЛЬНИМИ З ТВОГО ФАЙЛУ)
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
  },
  sidebarSectionTitle: {
    margin: "0 0 10px 0",
    fontSize: "0.9rem",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  }
}