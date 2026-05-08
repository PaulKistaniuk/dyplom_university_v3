"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "./lobby.module.css"

export default function LobbyListPage() {
  const [allLobbies, setAllLobbies] = useState<any[]>([])
  const [filteredLobbies, setFilteredLobbies] = useState<any[]>([])
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [filters, setFilters] = useState({
    gameType: "all",
    status: "waiting",
    players: "all"
  })

  const router = useRouter()

  useEffect(() => {
    const fetchLobbies = () => {
      fetch("/api/lobby")
        .then(res => res.json())
        .then(data => {
          const fetched = data.lobbies || []
          setAllLobbies(fetched)
        })
    }

    fetchLobbies()
    const interval = setInterval(fetchLobbies, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let result = allLobbies

    if (filters.gameType !== "all") {
      result = result.filter(l => l.gameType === filters.gameType)
    }

    if (filters.status !== "all") {
      result = result.filter(l => l.status === filters.status)
    }

    if (filters.players !== "all") {
      const [min, max] = filters.players.split("-").map(Number)
      result = result.filter(l => l.players.length >= min && (max ? l.players.length <= max : true))
    }

    setFilteredLobbies(result)
  }, [allLobbies, filters])

  const handleCreateLobby = (game: string) => {
    router.push(`/lobby/create?game=${game}`)
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid}>

        {/* Left Column: Actions */}
        <div className={styles.sidebar}>
          <div className={styles.sectionTitle}>Дії</div>
          <div className={styles.dropdownContainer}>
            <button
              className={styles.button}
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            >
              Створити лобі
            </button>
            {showCreateDropdown && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownItem} onClick={() => handleCreateLobby("mafia")}>
                  Мафія
                </div>
                <div className={styles.dropdownItem} onClick={() => router.push("/lobby/create-whoami")}>
                  Хто я?
                </div>
                <div className={styles.dropdownItem} style={{ opacity: 0.5, cursor: "not-allowed" }}>
                  Бункер (В розробці)
                </div>
                <div className={styles.dropdownItem} style={{ opacity: 0.5, cursor: "not-allowed" }}>
                  Своя Гра(В розробці)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Lobby List */}
        <div className={styles.content}>
          <div className={styles.sectionTitle}>Доступні лобі</div>

          {filteredLobbies.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Лобі не знайдено. Спробуйте змінити фільтри або створіть власне!</p>
            </div>
          ) : (
            filteredLobbies.map(lobby => (
              <div
                key={lobby.id}
                className={`${styles.card} ${styles.lobbyCard}`}
                onClick={() => router.push(`/lobby/${lobby.id}`)}
              >
                <div className={styles.lobbyInfo}>
                  <h3>{lobby.name || `Лобі #${lobby.id.slice(0, 4)}`}</h3>
                  <p>Гра: {lobby.gameType === "mafia" ? "Мафія" : lobby.gameType === "whoami" ? "Хто я?" : lobby.gameType}</p>
                </div>
                <div className={styles.lobbyStatus}>
                  <div className={styles.badge + " " + (
                    lobby.status === "waiting" ? styles.badgeWaiting :
                      lobby.status === "playing" ? styles.badgePlaying : styles.badgeFinished
                  )}>
                    {lobby.status === "waiting" ? "Очікування" :
                      lobby.status === "playing" ? "Грають" : "Завершено"}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>
                    Гравців: <span style={{ color: "var(--moon-text)" }}>{lobby.players.length} / {lobby.maxPlayers || 10}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Filters */}
        <div className={styles.sidebar}>
          <div className={styles.sectionTitle}>Фільтри</div>
          <div className={styles.card}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Гра</label>
                <select
                  className={styles.select}
                  value={filters.gameType}
                  onChange={(e) => setFilters({ ...filters, gameType: e.target.value })}
                >
                  <option value="all">Всі ігри</option>
                  <option value="mafia">Мафія</option>
                  <option value="whoami">Хто я?</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Статус</label>
                <select
                  className={styles.select}
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="all">Всі</option>
                  <option value="waiting">Очікування</option>
                  <option value="playing">В грі</option>
                  <option value="finished">Завершено</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Гравці</label>
                <select
                  className={styles.select}
                  value={filters.players}
                  onChange={(e) => setFilters({ ...filters, players: e.target.value })}
                >
                  <option value="all">Будь-яка к-сть</option>
                  <option value="0-5">1-5 гравців</option>
                  <option value="6-10">6-10 гравців</option>
                  <option value="11-15">11+ гравців</option>
                </select>
              </div>

              <button
                className={styles.button + " " + styles.buttonSecondary}
                style={{ marginTop: "0.5rem" }}
                onClick={() => setFilters({ gameType: "all", status: "waiting", players: "all" })}
              >
                Скинути
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}