"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/shared/hooks/useAuth"

function StatsPageContent() {
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
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Учасників: {game.stats?.totalPlayers || game.stats?.players?.length || (game.stats?.playerMap ? Object.keys(game.stats.playerMap).length : 0)}
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
// НОВИЙ КОМПОНЕНТ СТАТИСТИКИ МАФІЇ (АДАПТОВАНИЙ ДО БД)
// ==========================================
function MafiaDashboard({ game }: { game: any }) {
  const mafiaData = game.stats?.timeline ? game.stats : game;
  const timeline = mafiaData.timeline || [];
  const snapshots = mafiaData.snapshots || { days: [], nights: [], votings: [] };
  
  const playerMap = mafiaData.playerMap || {};
  const getPlayerName = (id: string) => playerMap[id] || `Гравець #${id?.slice(0, 4) || '?'}`;

  const viewerId = game.userId; 
  const dbPlayers = mafiaData.players || [];

  const getPlayerRole = (id: string) => {
    const dbPlayer = dbPlayers.find((p: any) => p.userId === id);
    if (dbPlayer?.role) return dbPlayer.role;
    const playerRoles = mafiaData.playerRoles || {}; 
    if (playerRoles[id]) return playerRoles[id];
    return "Мирний Житель";
  };

  const getPlayerNumber = (id: string) => {
    const dbPlayer = dbPlayers.find((p: any) => p.userId === id);
    return dbPlayer ? dbPlayer.number : null;
  };

  const getDbPlayer = (id: string) => {
  return dbPlayers.find((p: any) => p.userId === id);
};

const getPlayerAvatar = (id: string) => {
  const dbPlayer = getDbPlayer(id);
  return dbPlayer?.avatarUrl || "";
};

const getPlayerEvaluation = (id: string) => {
  const dbPlayer = getDbPlayer(id);
  return dbPlayer?.personal?.evaluation || null;
};

const getEvaluationBadges = (id: string) => {
  const evaluation = getPlayerEvaluation(id);
  if (!evaluation) return [];

  const rawBadges = Array.isArray(evaluation.badges) ? evaluation.badges : [];
  const title = String(evaluation.title || "").toLowerCase();

  const badges = new Set<string>();

  rawBadges.forEach((badge: string) => {
    const normalized = String(badge).toLowerCase();

    if (normalized.includes("triangle") || normalized.includes("трикут")) badges.add("triangle");
    if (normalized.includes("clutch") || normalized.includes("клатч")) badges.add("clutch");
    if (normalized.includes("mvp")) badges.add("mvp");
    if (normalized.includes("evp")) badges.add("evp");
    if (normalized.includes("unluck") || normalized.includes("повезе")) badges.add("unluck");
  });

  if (title.includes("mvp")) badges.add("mvp");
  if (title.includes("evp")) badges.add("evp");
  if (title.includes("клатч") || title.includes("clutch")) badges.add("clutch");
  if (title.includes("повезе") || title.includes("unluck")) badges.add("unluck");

  return Array.from(badges);
};

const renderEvaluationBadges = (id: string) => {
  const badges = getEvaluationBadges(id);

  if (badges.length === 0) {
    return <span style={mafiaStyles.emptyBadge}>Без значків</span>;
  }

  return (
    <div style={mafiaStyles.badgesWrap}>
      {badges.includes("triangle") && (
        <span style={{ ...mafiaStyles.evalBadge, ...mafiaStyles.triangleBadge }}>▲</span>
      )}
      {badges.includes("clutch") && (
        <span style={{ ...mafiaStyles.evalBadge, ...mafiaStyles.clutchBadge }}>C</span>
      )}
      {badges.includes("unluck") && (
        <span style={{ ...mafiaStyles.evalBadge, ...mafiaStyles.unluckBadge }}>UNLUCK</span>
      )}
      {badges.includes("mvp") && (
        <span style={{ ...mafiaStyles.evalBadge, ...mafiaStyles.mvpBadge }}>MVP</span>
      )}
      {badges.includes("evp") && (
        <span style={{ ...mafiaStyles.evalBadge, ...mafiaStyles.evpBadge }}>EVP</span>
      )}
    </div>
  );
};

  const winnerTeam = mafiaData.winnerTeam || (game.result === "win" ? "Мирне місто" : "Мафія");

  // Збираємо кількість днів на основі snapshots
  const maxDay = Math.max(...(snapshots.days || []).map((d: any) => d.day), 1);

  const [activeTab, setActiveTab] = useState("general");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>('GENERAL_LOG');

  const tabs = [{ id: "general", label: "Загальна" }];
  
  // Правильне формування вкладок: День 1 -> Ніч 1 -> День 2 -> Ніч 2...
  for (let i = 1; i <= maxDay; i++) {
    tabs.push({ id: `day_${i}`, label: `День ${i}` });
    
    // Якщо є нічні дії, які передують наступному дню (dayNumber: i + 1), створюємо вкладку Ночі
    if (timeline.some((t: any) => t.type === 'night_action' && t.dayNumber === i + 1)) {
      tabs.push({ id: `night_${i}`, label: `Ніч ${i+1}` });
    }
  }

  const allSessionPlayers: string[] = dbPlayers.length > 0
    ? dbPlayers.map((p: any) => p.userId)
    : Object.keys(playerMap);

  const getRolePlayers = (roleKeyword: string) => dbPlayers.filter((p: any) => p.role?.toLowerCase().includes(roleKeyword));
  const hasRole = (roleKeyword: string) => getRolePlayers(roleKeyword).length > 0;
  
  const mafiaTeam = dbPlayers.filter((p: any) => {
    const r = p.role?.toLowerCase() || "";
    return r.includes("мафія") || r.includes("дон") || r === "мафія" || r === "дон";
  });
  const donPlayer = getRolePlayers("дон")[0];
  const docPlayer = getRolePlayers("лікар")[0] || getRolePlayers("доктор")[0];
  const comPlayer = getRolePlayers("комісар")[0] || getRolePlayers("шериф")[0];

  // Точне визначення смерті
  const getDeathInfo = (pid: string) => {
    const votingExile = snapshots.votings?.find((v: any) => v.eliminatedPlayerId === pid);
    if (votingExile) return `Вигнаний на голосуванні в День ${votingExile.day}`;

    const deathDay = snapshots.days?.find((d: any) => d.deadPlayers?.includes(pid));
    // Якщо гравець є в мертвих Дня Х, значить він помер у Ніч Х-1
    if (deathDay) return `Вбитий мафією в Ніч ${deathDay.day - 1}`;
    return null;
  };

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
              setSelectedPlayerId(tab.id.startsWith("day_") ? 'GENERAL_LOG' : null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden", marginTop: "1rem" }}>
        
        {/* === ЗАГАЛЬНА ВКЛАДКА === */}
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={mafiaStyles.winnerBanner}>
              🏆 Перемогу здобула команда: <span style={{ color: winnerTeam.toLowerCase().includes("мафія") ? "#ef4444" : "#22c55e" }}>{winnerTeam}</span>
            </div>
            
            <div style={{ display: "flex", gap: "1.5rem", flex: 1, overflow: "hidden", marginTop: "1rem" }}>
              <div style={{ flex: "0 0 60%", overflowY: "auto", paddingRight: "4px" }}>
                <h3 style={styles.subTitle}>🎭 Учасники сесії</h3>

                <div style={mafiaStyles.playerList}>
                  {allSessionPlayers.map((pid: string) => {
                    const role = getPlayerRole(pid);
                    const isMafia = role.toLowerCase().includes("мафія") || role.toLowerCase().includes("дон");
                    const seatNumber = getPlayerNumber(pid);
                    const avatarUrl = getPlayerAvatar(pid);
                    const evaluation = getPlayerEvaluation(pid);

                    return (
                      <div key={pid} style={mafiaStyles.playerListRow}>
                        <div style={mafiaStyles.playerIdentity}>
                          <div style={mafiaStyles.avatarCircle}>
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={getPlayerName(pid)}
                                style={mafiaStyles.avatarImage}
                              />
                            ) : (
                              <span>{getPlayerName(pid).slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={mafiaStyles.playerNameLine}>
                              <span style={mafiaStyles.playerName}>
                                {seatNumber !== null ? `№${seatNumber} ` : ""}{getPlayerName(pid)}
                              </span>
                              {pid === game.userId && <span style={mafiaStyles.youBadge}>ВИ</span>}
                            </div>

                            <div style={{
                              ...mafiaStyles.rolePill,
                              color: isMafia ? "#ef4444" : "#38bdf8",
                              borderColor: isMafia ? "rgba(239, 68, 68, 0.35)" : "rgba(56, 189, 248, 0.35)",
                              backgroundColor: isMafia ? "rgba(239, 68, 68, 0.08)" : "rgba(56, 189, 248, 0.08)"
                            }}>
                              {role}
                            </div>
                          </div>
                        </div>

                        <div style={mafiaStyles.playerEvaluationSide}>
                          {renderEvaluationBadges(pid)}

                          {evaluation?.score !== undefined && (
                            <span style={mafiaStyles.scoreText}>{evaluation.score}%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Універсальний лог подій */}
              <div style={{ flex: "1", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h3 style={styles.subTitle}>📜 Повний лог подій</h3>
                <div style={mafiaStyles.logBox}>
                  {timeline.map((event: any, idx: number) => {
                    // Коригуємо нумерацію: нічні дії, що мають dayNumber X, насправді належать до Ночі X-1
                    const isNight = event.type === 'night_action';
                    const cycleNum = isNight ? (event.dayNumber - 1) : (event.day || event.dayNumber);
                    const prefix = isNight ? `[Ніч ${cycleNum}]` : `[День ${cycleNum}]`;
                    
                    let content = null;
                    if (event.type === 'speech') {
                       const label = event.speechType === 'discussion' ? 'обговорення' : (event.speechType === 'defense' ? 'захист' : 'перестрілка');
                       content = <span>🗣️ <b>{getPlayerName(event.playerId)}</b> тримав промову ({label}) тривалістю <b>{event.durationSec}с</b></span>;
                    } else if (event.type === 'night_action') {
                       if (event.action === 'kill_vote') content = <span>🔫 <b>{getPlayerName(event.userId)}</b> голосував на ліквідацію <b>{getPlayerName(event.targetId)}</b></span>;
                       else if (event.action === 'heal') content = <span>🩺 <b>{getPlayerName(event.userId)}</b> лікував <b>{getPlayerName(event.targetId)}</b></span>;
                       else if (event.action === 'don_check') content = <span>🕶️ <b>{getPlayerName(event.userId)}</b> перевіряв <b>{getPlayerName(event.targetId)}</b></span>;
                       else if (event.action === 'check') content = <span>🛡️ <b>{getPlayerName(event.userId)}</b> перевіряв <b>{getPlayerName(event.targetId)}</b></span>;
                    } else if (event.type === 'nomination') {
                       content = <span>👉 <b>{getPlayerName(event.nominatorId)}</b> виставив на голосування <b>{getPlayerName(event.targetId)}</b></span>;
                    } else if (event.type === 'vote') {
                       content = <span>🗳️ <b>{getPlayerName(event.voterId)}</b> голосував проти <b>{getPlayerName(event.targetId)}</b></span>;
                    }

                    if (!content) return null;
                    return (
                      <div key={idx} style={mafiaStyles.logEntry}>
                        <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{prefix}</span>
                        {" "}{content}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === ВКЛАДКА ДЕНЬ X === */}
        {activeTab.startsWith("day_") && (() => {
          const dayNum = parseInt(activeTab.split("_")[1]);
          const daySnapshot = snapshots.days?.find((d: any) => d.day === dayNum) || {};
          
          // Для дня Х дістаємо події Ночі Х-1 (які в базі мають dayNumber === dayNum)
          const prevNightActions = timeline.filter((t: any) => t.type === 'night_action' && t.dayNumber === dayNum);
          
          // Визначаємо жертву ночі (ФІКС: враховуємо голосування поточного дня, щоб вигнаний вдень гравець не вважався жертвою ночі)
          const prevDayDead = snapshots.days?.find((d: any) => d.day === dayNum - 1)?.deadPlayers || [];
          const todayDead = daySnapshot.deadPlayers || [];
          const todayExiled = snapshots.votings?.filter((v: any) => v.day === dayNum).map((v: any) => v.eliminatedPlayerId).filter(Boolean) || [];
          const nightVictims = todayDead.filter((pid: string) => !prevDayDead.includes(pid) && !todayExiled.includes(pid));
          const nightVictim = nightVictims.length > 0 ? nightVictims[0] : null;

          const docAction = prevNightActions.find((t: any) => t.action === 'heal');
          const donAction = prevNightActions.find((t: any) => t.action === 'don_check');
          const comAction = prevNightActions.find((t: any) => t.action === 'check');

          const aliveList = daySnapshot.alivePlayers || [];
          const deadList = daySnapshot.deadPlayers || [];

          // Голосування та переголосування
          const dayVotings = snapshots.votings?.filter((v: any) => v.day === dayNum) || [];
          const mainVoting = dayVotings.find((v: any) => v.type === "voting");
          const revoting = dayVotings.find((v: any) => v.type === "revoting");
          const lastVoting = dayVotings.length > 0 ? dayVotings[dayVotings.length - 1] : null;

          // Персональні дані вибраного гравця
          const selectedPlayerSpeeches = timeline.filter((t: any) => t.day === dayNum && t.playerId === selectedPlayerId && t.type === "speech");
          const mainSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "discussion");

          // ФІКС: додаємо реальні типи захисту з вашої БД ("nomination_defense")
          const defenseSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "defense" || s.speechType === "nomination_defense");

          // ФІКС: додаємо типи фінальних промов вибуття або перестрілок з вашої БД ("voting_elim", "single_elim")
          const reDefenseSpeech = selectedPlayerSpeeches.find((s: any) => s.speechType === "re_discussion" || s.speechType === "justification_again" || s.speechType === "voting_elim" || s.speechType === "single_elim");

          const nominationsMade = timeline.find((t: any) => (t.dayNumber === dayNum || t.day === dayNum) && t.type === "nomination" && t.nominatorId === selectedPlayerId);

          // Перевіряємо, чи взагали виставляли цього гравця сьогодні (щоб блок не зникав, навіть якщо промова триває 0 сек)
          const isPlayerNominated = timeline.some((t: any) => (t.dayNumber === dayNum || t.day === dayNum) && t.type === "nomination" && t.targetId === selectedPlayerId);
          const playerVote = mainVoting?.votes?.[selectedPlayerId || ""];
          const playerRevote = revoting?.votes?.[selectedPlayerId || ""];

          const deathInfo = selectedPlayerId ? getDeathInfo(selectedPlayerId) : null;

          // Визначаємо, чи був гравець живим на початку цього дня (тобто наприкінці попереднього)
          const prevDaySnapshot = dayNum > 1 ? snapshots.days?.find((d: any) => d.day === dayNum - 1) : null;
          const isSelectedDeadBeforeThisDay = dayNum > 1 ? !(prevDaySnapshot?.alivePlayers?.includes(selectedPlayerId)) : false;

          return (
            <div style={{ display: "flex", gap: "1.5rem", height: "100%", overflow: "hidden" }}>
              {/* ЛІВА ЧАСТИНА: Списки гравців */}
              <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                {dayNum === 1 ? (
                  <div style={{...mafiaStyles.nightSummaryCard, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px'}}>
                    <b style={{ color: "#94a3b8", fontSize: "1rem" }}>🌅 Вночі ще не було дій</b>
                  </div>
                ) : (
                  <div style={mafiaStyles.nightSummaryCard}>
                    <h4 style={{ margin: "0 0 10px 0", color: "#fbbf24", fontSize: "0.9rem", textTransform: "uppercase", borderBottom: "1px solid rgba(251, 191, 36, 0.2)", paddingBottom: "6px" }}>
                      🌃 Підсумки ночі {dayNum}
                    </h4>
                    
                    <div style={mafiaStyles.summaryItem}>
                      <span>Жертва мафії:</span> 
                      <b>{nightVictim ? getPlayerName(nightVictim) : "Ніхто"}</b>
                    </div>

                    {/* Візит лікаря */}
                    {(hasRole("лікар") || hasRole("доктор") || hasRole("doctor") || !!docAction) && (
                      <div style={mafiaStyles.summaryItem}>
                        <span>Візит лікаря:</span> 
                        <b>{docAction ? getPlayerName(docAction.targetId) : "Пропустив хід"}</b>
                      </div>
                    )}

                    {/* Перевірка Дона */}
                    {(hasRole("дон") || hasRole("don") || !!donAction) && (
                      <div style={mafiaStyles.summaryItem}>
                        <span>Перевірка Дона:</span> 
                        <b>{donAction ? (
                          `${getPlayerName(donAction.targetId)} (${
                            donAction.result === 'commissar' || donAction.result === 'sheriff' || donAction.result === 'комісар' || donAction.result === 'шериф'
                              ? 'Комісар' 
                              : 'Мирний'
                          })`
                        ) : "Пропустив хід"}</b>
                      </div>
                    )}

                    {/* Перевірка Комісара */}
                    {(hasRole("комісар") || hasRole("шериф") || hasRole("sheriff") || hasRole("commissar") || !!comAction) && (
                      <div style={mafiaStyles.summaryItem}>
                        <span>Перевірка Комісара:</span> 
                        <b>{comAction ? (
                          `${getPlayerName(comAction.targetId)} (${
                            comAction.result === 'mafia' || comAction.result === 'don' || comAction.result === 'мафія' || comAction.result === 'дон' || comAction.result === true
                              ? 'Мафія' 
                              : 'Мирний'
                          })`
                        ) : "Пропустив хід"}</b>
                      </div>
                    )}

                    {/* ТЕКСТОВИЙ РЕЗУЛЬТАТ ВБИВСТВА */}
                    <div style={{ 
                      marginTop: "10px", 
                      paddingTop: "8px", 
                      borderTop: "1px dashed rgba(255,255,255,0.1)", 
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      color: nightVictim ? "#ef4444" : "#22c55e"
                    }}>
                      📢 {nightVictim ? `Цієї ночі було вбито гравця: ${getPlayerName(nightVictim)}` : "Цієї ночі нікого не вбили"}
                    </div>
                  </div>
                )}

                <div style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
                  <button 
                    style={{
                      ...mafiaStyles.tabButton, 
                      width: "100%", 
                      marginBottom: "10px", 
                      backgroundColor: selectedPlayerId === 'GENERAL_LOG' ? "rgba(56, 189, 248, 0.1)" : "#1e293b",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: selectedPlayerId === 'GENERAL_LOG' ? "#38bdf8" : "#334155" // Фікс React помилки змішування стилів
                    }}
                    onClick={() => setSelectedPlayerId('GENERAL_LOG')}
                  >
                    📖 Загальний журнал подій
                  </button>

                  <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Гравці на цей день</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
                    {allSessionPlayers.map((pid: string) => {
                      const isAlive = aliveList.includes(pid);
                      const isJustDead = deadList.includes(pid);
                      const seatNumber = getPlayerNumber(pid);
                      const role = getPlayerRole(pid);

                      return (
                        <div
                          key={pid}
                          style={{
                            ...mafiaStyles.selectablePlayerRow,
                            borderColor: selectedPlayerId === pid ? "#38bdf8" : "transparent",
                            backgroundColor: selectedPlayerId === pid ? "rgba(56, 189, 248, 0.1)" : "rgba(30, 41, 59, 0.4)",
                            opacity: isAlive ? 1 : 0.6
                          }}
                          onClick={() => setSelectedPlayerId(pid)}
                        >
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ textDecoration: !isAlive ? "line-through" : "none", color: isAlive ? "#f8fafc" : "#64748b" }}>
                              {seatNumber !== null ? `${seatNumber}. ` : ""}{getPlayerName(pid)}
                            </span>
                            <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{role}</span>
                          </div>
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            backgroundColor: isAlive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: isAlive ? "#22c55e" : "#ef4444"
                          }}>
                            {isAlive ? "Живий" : isJustDead ? "Помер" : "Мертвий"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ПРАВА ЧАСТИНА */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                
                {/* ЗАГАЛЬНИЙ ЖУРНАЛ */}
                {selectedPlayerId === 'GENERAL_LOG' && (() => {
                  // 1. Отримуємо всі промови обговорення за цей день
                  const daySpeeches = timeline.filter((t: any) => t.day === dayNum && t.type === "speech" && t.speechType === "discussion");
                  
                  // 2. Отримуємо ID першого гравця, який говорив у цей день
                  const firstSpeakerId = daySpeeches[0]?.playerId || null;

                  // 3. Знаходимо номінації, які взагалі відбулися цього дня
                  const allDayNominations = timeline.filter((t: any) => (t.dayNumber === dayNum || t.day === dayNum) && t.type === "nomination");

                  // ==================== НАДІЙНИЙ ФІКС ВИГНАННЯ ====================
                  // Спочатку шукаємо в таймлайні подію фінального слова гравця, якого вигнали (voting_elim) або вилучили (single_elim) саме цього дня
                  const dayEliminationEvent = timeline.find((t: any) => 
                    t.day === dayNum && 
                    t.type === "speech" && 
                    (t.speechType === "voting_elim" || t.speechType === "single_elim")
                  );

                  let autoExiledPlayerId = dayEliminationEvent?.playerId || null;

                  // Резервний варіант (якщо раптом у таймлайні немає події елімінації, але масиви смертей відрізняються)
                  if (!autoExiledPlayerId) {
                    const prevDayDeadPlayers = dayNum > 1 ? (snapshots.days?.find((d: any) => d.day === dayNum - 1)?.deadPlayers || []) : [];
                    const currentDayDeadPlayers = daySnapshot.deadPlayers || [];
                    const newlyDead = currentDayDeadPlayers.filter((pid: string) => !prevDayDeadPlayers.includes(pid));
                    
                    // Шукаємо справжню нічну жертву безпосередньо з нічного snapshot для цієї доби
                    const currentNightSnapshot = snapshots.nights?.find((n: any) => n.night === dayNum);
                    const actualNightKillId = currentNightSnapshot?.killedPlayerId || currentNightSnapshot?.finalKillTarget || null;
                    
                    autoExiledPlayerId = newlyDead.find((pid: string) => pid !== actualNightKillId) || null;
                  }
                  // ================================================================

                  // 4. Отримуємо точну інформацію про вигнаного гравця
                  const exactExiledPlayerId = lastVoting?.eliminatedPlayerId || todayExiled[0] || autoExiledPlayerId;

                  return (
                    <div style={{...mafiaStyles.personalInvestigationContainer, overflowY: "auto"}}>
                      <h3 style={{ margin: "0 0 1rem 0", color: "#38bdf8" }}>📖 Журнал подій: День {dayNum}</h3>
                      
                      <h4 style={{ color: "#fbbf24", marginBottom: "8px" }}>🗣️ Дискусії та номінації</h4>
                      <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155" }}>
                        {daySpeeches.map((s: any, idx: number) => {
                          let nom = allDayNominations.find((t: any) => t.nominatorId === s.playerId);
                          
                          if (!nom && s.playerId === firstSpeakerId) {
                            nom = allDayNominations.find((t: any) => 
                              !daySpeeches.some((speech: any) => speech.playerId === t.nominatorId)
                            );
                          }

                          return (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                              <span style={{ width: "30%" }}>{getPlayerName(s.playerId)}</span>
                              <span style={{ width: "20%", color: "#94a3b8" }}>{s.durationSec} сек</span>
                              <span style={{ width: "50%", textAlign: "right", color: nom ? "#ef4444" : "#64748b" }}>
                                {nom ? `Виставив: ${getPlayerName(nom.targetId)}` : "Не виставляв"}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {timeline.some((t: any) => t.day === dayNum && t.type === "speech" && (t.speechType === "defense" || t.speechType === "nomination_defense")) && (
                        <>
                          <h4 style={{ color: "#a855f7", marginBottom: "8px" }}>🛡️ Промови виправдання</h4>
                          <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155" }}>
                            {timeline.filter((t: any) => t.day === dayNum && t.type === "speech" && (t.speechType === "defense" || t.speechType === "nomination_defense")).map((s: any, idx: number) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                                <span>{getPlayerName(s.playerId)}</span>
                                <span style={{ color: "#94a3b8" }}>{s.durationSec} сек</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {mainVoting && Object.keys(mainVoting.votes || {}).length > 0 && (
                        <>
                          <h4 style={{ color: "#ef4444", marginBottom: "8px" }}>🗳️ Основне голосування</h4>
                          <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            {Object.entries(mainVoting.votes || {}).map(([voterId, targetId]: [string, any]) => (
                              <div key={voterId} style={{ fontSize: "0.85rem" }}>
                                <b>{getPlayerName(voterId)}</b> ➡️ {getPlayerName(targetId)}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {revoting && Object.keys(revoting.votes || {}).length > 0 && (
                        <>
                          <h4 style={{ color: "#ef4444", marginBottom: "8px" }}>⚖️ Переголосування (Розпил)</h4>
                          <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            {Object.entries(revoting.votes || {}).map(([voterId, targetId]: [string, any]) => (
                              <div key={voterId} style={{ fontSize: "0.85rem" }}>
                                <b>{getPlayerName(voterId)}</b> ➡️ {getPlayerName(targetId)}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* ПІДСУМОК ДНЯ: СТАБІЛЬНЕ ВІДОБРАЖЕННЯ ВИГНАННЯ ГРАВЦЯ */}
                      <div style={{ 
                        marginTop: "1rem", 
                        padding: "12px", 
                        backgroundColor: exactExiledPlayerId ? "rgba(239, 68, 68, 0.1)" : "rgba(56, 189, 248, 0.1)", 
                        borderRadius: "8px", 
                        border: `1px solid ${exactExiledPlayerId ? "#ef4444" : "#38bdf8"}` 
                      }}>
                        <h4 style={{ margin: "0 0 8px 0", color: exactExiledPlayerId ? "#ef4444" : "#38bdf8" }}>🏁 Підсумок дня</h4>
                        <b>
                          {exactExiledPlayerId 
                            ? `Місто вигнало гравця: ${getPlayerName(exactExiledPlayerId)}` 
                            : "Рішення не прийнято. Нікого не вигнано."}
                        </b>
                      </div>

                    </div>
                  );
                })()}

                {/* КАБІНЕТ МЕРТВОГО ГРАВЦЯ */}
                {selectedPlayerId && selectedPlayerId !== 'GENERAL_LOG' && isSelectedDeadBeforeThisDay && (
                  <div style={{...mafiaStyles.personalInvestigationContainer, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column"}}>
                    <div style={{ fontSize: "3rem" }}>💀</div>
                    <h3 style={{ margin: "10px 0", color: "#ef4444" }}>Гравець мертвий</h3>
                    <p style={{ color: "#94a3b8" }}>{deathInfo}</p>
                  </div>
                )}

                {/* ПЕРСОНАЛЬНИЙ КАБІНЕТ ЖИВОГО ГРАВЦЯ */}
                {selectedPlayerId && selectedPlayerId !== 'GENERAL_LOG' && !isSelectedDeadBeforeThisDay && (
                  <div style={mafiaStyles.personalInvestigationContainer}>
                    <h3 style={{ margin: "0 0 1rem 0", color: "#38bdf8" }}>
                      📊 Аналітика: <span style={{ color: "#fff" }}>{getPlayerName(selectedPlayerId)}</span>
                    </h3>
                    
                    <div style={mafiaStyles.investigationGrid}>
                      <div style={mafiaStyles.investigationItem}>
                        <span style={mafiaStyles.investigationLabel}>Основна промова (Discussion)</span>
                        <b style={{ fontSize: "1.2rem" }}>{mainSpeech ? `${mainSpeech.durationSec} секунд` : "Не виступав"}</b>
                      </div>

                      {dayNum > 1 && (
                        <div style={mafiaStyles.investigationItem}>
                          <span style={mafiaStyles.investigationLabel}>Номінація</span>
                          <b>{nominationsMade ? `Виставив: ${getPlayerName(nominationsMade.targetId)}` : "Нікого не виставив"}</b>
                        </div>
                      )}

                      {defenseSpeech && (
                        <div style={mafiaStyles.investigationItem}>
                          <span style={mafiaStyles.investigationLabel}>Промова виправдання (Захист)</span>
                          <b style={{ color: "#fbbf24" }}>{defenseSpeech.durationSec} секунд</b>
                        </div>
                      )}

                      {reDefenseSpeech && (
                        <div style={mafiaStyles.investigationItem}>
                          <span style={mafiaStyles.investigationLabel}>Остання промова</span>
                          <b style={{ color: "#fbbf24" }}>{reDefenseSpeech.durationSec} секунд</b>
                        </div>
                      )}
                    </div>

                    {mainVoting && mainVoting.candidates?.length > 1 && (
                      <div style={{ marginTop: "1.5rem" }}>
                        <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>🗳️ Голосування гравця</h4>
                        <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "10px", border: "1px solid #334155" }}>
                          <div style={mafiaStyles.summaryItem}>
                            <span>Основне голосування:</span>
                            <b>
                              {playerVote 
                                ? `Проголосував проти ${getPlayerName(playerVote)}` 
                                : `Голос в ${mainVoting.candidates ? getPlayerName(mainVoting.candidates[mainVoting.candidates.length - 1]) : "останнього"} (не голосував)`}
                            </b>
                          </div>
                          {revoting && (
                            <div style={{ ...mafiaStyles.summaryItem, marginTop: "8px", borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                              <span>Повторне голосування:</span>
                              <b>{playerRevote ? `Проголосував проти ${getPlayerName(playerRevote)}` : "Не голосував"}</b>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* === ВКЛАДКА НІЧ X === */}
        {activeTab.startsWith("night_") && (() => {
          const nightNum = parseInt(activeTab.split("_")[1]);
          
          // Шукаємо дії ночі Х, які збережені з dayNumber Х+1
          const nightActions = timeline.filter((t: any) => t.type === 'night_action' && t.dayNumber === nightNum + 1);
          
          const mafiaVotesMap: Record<string, string> = {};
          nightActions.filter((t: any) => t.action === 'kill_vote').forEach((t: any) => mafiaVotesMap[t.userId] = t.targetId);
          
          const docAction = nightActions.find((t: any) => t.action === 'heal');
          const donAction = nightActions.find((t: any) => t.action === 'don_check');
          const comAction = nightActions.find((t: any) => t.action === 'check');

          // ОТРИМУЄМО ТОЧНИЙ ЗНІМОК ПОТОЧНОЇ НОЧІ З БД ЗА ЇЇ НОМЕРОМ
          const currentNightSnapshot = snapshots.nights?.find((n: any) => n.night === nightNum + 1);
          const nightVictim = currentNightSnapshot?.killedPlayerId || null;
          const alivePlayersAtNight = currentNightSnapshot?.alivePlayers || [];

          // ФУНКЦІЯ ДЛЯ СТАБІЛЬНОГО ПОШУКУ ID ГРАВЦЯ ЗА РОЛЛЮ (НАВІТЬ ЯКЩО ВІН ВЖЕ МЕРТВИЙ)
          const findFieldInNights = (field: string) => {
            const found = snapshots.nights?.find((n: any) => n[field] && (typeof n[field] === 'string' || n[field].userId));
            if (!found) return null;
            return typeof found[field] === 'string' ? found[field] : found[field].userId;
          };

          // Стабільні ID ключових ролей (шукаємо першу-ліпшу нічну дію в історії кімнати)
          const backupDocId = docAction?.userId || findFieldInNights('doctorHeal') || (typeof docPlayer !== 'undefined' ? docPlayer?.userId : null);
          const backupDonId = donAction?.userId || findFieldInNights('donCheck') || (typeof donPlayer !== 'undefined' ? donPlayer?.userId : null);
          const backupComId = comAction?.userId || findFieldInNights('commissarCheck') || (typeof comPlayer !== 'undefined' ? comPlayer?.userId : null);

          // Визначаємо чи живі ролі у цю конкретну ніч
          const isDocAlive = backupDocId ? alivePlayersAtNight.includes(backupDocId) : true;
          const isDonAlive = backupDonId ? alivePlayersAtNight.includes(backupDonId) : true;
          const isComAlive = backupComId ? alivePlayersAtNight.includes(backupComId) : true;

          // Динамічно збираємо список нікнеймів мафіозі поточного таба
          const dynamicMafiaIds = Array.from(new Set([
            ...Object.keys(mafiaVotesMap),
            backupDonId
          ].filter(Boolean)));
          const dynamicMafiaNames = dynamicMafiaIds.length > 0 
            ? dynamicMafiaIds.map(id => getPlayerName(id)).join(', ') 
            : (typeof mafiaTeam !== 'undefined' && mafiaTeam ? mafiaTeam.map((m:any) => m.username).join(', ') : "Мафія");

          return (
            <div style={mafiaStyles.nightContainer}>
              <h3 style={{ ...styles.subTitle, color: "#a855f7" }}>🌌 Детальний аналіз таємних дій Ночі #{nightNum}</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
                
                {/* БЛОК МАФІЇ */}
                <div style={styles.card}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#ef4444" }}>
                    🔫 Мафія <span style={{fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal"}}>({dynamicMafiaNames})</span>
                  </h4>
                  <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px" }}>
                    {Object.keys(mafiaVotesMap).length > 0 ? (
                      Object.entries(mafiaVotesMap).map(([mafiaId, targetId]: [string, any]) => (
                        <div key={mafiaId} style={{ marginBottom: "6px", fontSize: "0.9rem" }}>
                          🥷 <b>{getPlayerName(mafiaId)}</b> стріляв у 🎯 <b>{getPlayerName(targetId)}</b>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        {!isDonAlive && Object.keys(mafiaVotesMap).length === 0 ? "Покинули гру 💀" : "Пропустили хід (або сліпий договір)"}
                      </div>
                    )}
                  </div>
                </div>

                {/* БЛОК ЛІКАРЯ */}
                {(hasRole("лікар") || hasRole("доктор") || hasRole("doctor") || !!docAction || !!backupDocId) && (
                  <div style={styles.card}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#22c55e" }}>
                      🩺 Лікар <span style={{fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal"}}>({backupDocId ? getPlayerName(backupDocId) : "Активний лікар"})</span>
                    </h4>
                    <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", height: "calc(100% - 40px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                        {docAction ? (
                          <>🏥 Лікував: <span style={{ color: "#22c55e" }}>{getPlayerName(docAction.targetId)}</span></>
                        ) : (
                          <span style={{ color: "#64748b" }}>{isDocAlive ? "Пропустив хід" : "Покинув гру 💀"}</span>
                        )}
                      </div>
                      {docAction && nightVictim === null && Object.keys(mafiaVotesMap).length > 0 && (
                        <div style={{ color: "#22c55e", fontWeight: "bold", marginTop: "8px", fontSize: "0.85rem" }}>🎉 Лікар успішно відбив постріл!</div>
                      )}
                    </div>
                  </div>
                )}

                {/* БЛОК ДОНА */}
                {(hasRole("дон") || hasRole("don") || !!donAction || !!backupDonId) && (
                  <div style={styles.card}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#f43f5e" }}>
                      🕶️ Дон <span style={{fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal"}}>({backupDonId ? getPlayerName(backupDonId) : "Активний дон"})</span>
                    </h4>
                    <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px" }}>
                      {donAction ? (
                        <div>
                          Перевірив: <b>{getPlayerName(donAction.targetId)}</b> <br/>
                          Результат: <b style={{ color: donAction.result === 'commissar' ? "#ef4444" : "#22c55e" }}>{donAction.result === 'commissar' ? "Шериф! 🔍" : "Ні"}</b>
                        </div>
                      ) : (
                        <div style={{ color: "#64748b" }}>{isDonAlive ? "Пропустив хід" : "Покинув гру 💀"}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* БЛОК КОМІСАРА */}
                {(hasRole("комісар") || hasRole("шериф") || hasRole("sheriff") || hasRole("commissar") || !!comAction || !!backupComId) && (
                  <div style={styles.card}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#38bdf8" }}>
                      🛡️ Комісар <span style={{fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal"}}>({backupComId ? getPlayerName(backupComId) : "Активний комісар"})</span>
                    </h4>
                    <div style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px" }}>
                      {comAction ? (
                        <div>
                          Перевірив: <b>{getPlayerName(comAction.targetId)}</b> <br/>
                          Результат: <b style={{ color: comAction.result === 'mafia' ? "#ef4444" : "#22c55e" }}>{comAction.result === 'mafia' ? "МАФІЯ 🚨" : "Мирний"}</b>
                        </div>
                      ) : (
                        <div style={{ color: "#64748b" }}>{isComAlive ? "Пропустив хід" : "Покинув гру 💀"}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* БЛОК: ПІДСУМОК НОЧІ */}
              <div style={{ 
                marginTop: "1.5rem", 
                backgroundColor: nightVictim ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", 
                border: nightVictim ? "1px solid #ef4444" : "1px solid #22c55e", 
                padding: "1rem", 
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <h4 style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  📋 Підсумок Ночі #{nightNum+1}
                </h4>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: nightVictim ? "#f8fafc" : "#22c55e" }}>
                  {nightVictim ? (
                    <span>💀 Убили гравця: <span style={{ color: "#ef4444" }}>{getPlayerName(nightVictim)}</span></span>
                  ) : (
                    <span>🕊️ Нікого не убили (У місті правопорядок)</span>
                  )}
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
  playerList: {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "0.5rem"
},
playerListRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "10px 12px"
},
playerIdentity: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0
},
avatarCircle: {
  width: "42px",
  height: "42px",
  borderRadius: "999px",
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#f8fafc",
  fontWeight: "bold",
  flexShrink: 0,
  overflow: "hidden"
},
avatarImage: {
  width: "100%",
  height: "100%",
  objectFit: "cover"
},
playerNameLine: {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0
},
playerName: {
  fontWeight: "bold",
  fontSize: "0.95rem",
  color: "#f8fafc",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "170px"
},
rolePill: {
  display: "inline-flex",
  alignItems: "center",
  marginTop: "4px",
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid",
  fontSize: "0.72rem",
  fontWeight: "700"
},
playerEvaluationSide: {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0
},
badgesWrap: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "5px",
  flexWrap: "wrap"
},
evalBadge: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "24px",
  height: "22px",
  padding: "0 7px",
  borderRadius: "999px",
  fontSize: "0.68rem",
  fontWeight: "900",
  letterSpacing: "0.03em",
  border: "1px solid transparent"
},
triangleBadge: {
  color: "#22c55e",
  backgroundColor: "rgba(34, 197, 94, 0.12)",
  borderColor: "rgba(34, 197, 94, 0.35)"
},
clutchBadge: {
  color: "#ef4444",
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  borderColor: "rgba(239, 68, 68, 0.35)"
},
unluckBadge: {
  color: "#38bdf8",
  backgroundColor: "rgba(56, 189, 248, 0.12)",
  borderColor: "rgba(56, 189, 248, 0.35)"
},
mvpBadge: {
  color: "#fbbf24",
  backgroundColor: "rgba(251, 191, 36, 0.14)",
  borderColor: "rgba(251, 191, 36, 0.45)"
},
evpBadge: {
  color: "#cbd5e1",
  backgroundColor: "rgba(203, 213, 225, 0.12)",
  borderColor: "rgba(203, 213, 225, 0.35)"
},
emptyBadge: {
  color: "#64748b",
  fontSize: "0.72rem",
  fontWeight: "600"
},
scoreText: {
  color: "#f8fafc",
  fontSize: "0.82rem",
  fontWeight: "800",
  minWidth: "38px",
  textAlign: "right"
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

export default function StatsPage() {
  return (
    <Suspense fallback={<div style={styles.page}>Завантаження статистики...</div>}>
      <StatsPageContent />
    </Suspense>
  )
}