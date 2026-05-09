"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "../lobby.module.css"

export default function CreateWhoAmILobbyPage() {
  const [name, setName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [wordSource, setWordSource] = useState("players")
  const [chatMode, setChatMode] = useState("nochat")
  const [gameMode, setGameMode] = useState("champion")
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Будь ласка, введіть назву лобі")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/lobby/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          gameType: "whoami",
          maxPlayers,
          isPrivate: false,
          settings: {
            wordSource,
            chatMode,
            gameMode,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        return
      }

      router.push(`/lobby/${data.lobby.id}`)
    } catch (err) {
      alert("Сталася помилка при створенні лобі")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1 className={styles.sectionTitle}>Створення лобі — Хто я?</h1>

        <div className={styles.card}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Назва лобі</label>
              <input
                className={styles.input}
                placeholder="Введіть круту назву..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Максимум гравців (2-8)</label>
              <input
                className={styles.input}
                type="number"
                min={2}
                max={8}
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>
                  Джерело слів
                  <span 
                    title="В розробці" 
                    style={{ marginLeft: "6px", cursor: "help", color: "var(--moon-accent)", fontSize: "0.8rem" }}
                  >
                    ⓘ
                  </span>
                </label>
                <select 
                  className={styles.select}
                  value={wordSource}
                  onChange={e => setWordSource(e.target.value)}
                >
                  <option value="players">Гравці</option>
                  <option value="ai" disabled>ШІ (Скоро)</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Режим чату</label>
                <select 
                  className={styles.select}
                  value={chatMode}
                  onChange={e => setChatMode(e.target.value)}
                >
                  <option value="nochat">Усно</option>
                  <option value="chat">Чат</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Режим гри</label>
                <select 
                  className={styles.select}
                  value={gameMode}
                  onChange={e => setGameMode(e.target.value)}
                >
                  <option value="champion">До чемпіона</option>
                  <option value="loser">До лузера</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button
                className={styles.button + " " + styles.buttonSecondary}
                onClick={() => router.push("/lobby")}
                disabled={isLoading}
              >
                Скасувати
              </button>
              <button
                className={styles.button}
                onClick={handleCreate}
                disabled={isLoading}
              >
                {isLoading ? "Створення..." : "Створити"}
              </button>
            </div>

          </div>
        </div>

        <div style={{ marginTop: "2rem", color: "var(--moon-text-dim)", fontSize: "0.85rem", textAlign: "center" }}>
          <p>
            {gameMode === "champion" 
              ? "Гра закінчиться, коли перший гравець вгадає своє слово." 
              : "Гра триватиме, поки не залишиться лише один гравець, який не вгадав."}
          </p>
        </div>
      </div>
    </div>
  )
}

