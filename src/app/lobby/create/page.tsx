"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "../lobby.module.css"

export default function CreateLobbyPage() {
  const [name, setName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(10)
  const [revealRoles, setRevealRoles] = useState(false)
  const [lastWords, setLastWords] = useState(true)
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
          gameType: "mafia",
          maxPlayers,
          isPrivate: false,
          revealRoles,
          lastWords,
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
        <h1 className={styles.sectionTitle}>Створення лобі</h1>
        
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
              <label className={styles.filterLabel}>Максимум гравців (4-15)</label>
              <input
                className={styles.input}
                type="number"
                min={4}
                max={15}
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  checked={revealRoles}
                  onChange={e => setRevealRoles(e.target.checked)}
                />
                <span style={{ fontSize: "0.95rem" }}>Розкривати ролі після смерті</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  checked={lastWords}
                  onChange={e => setLastWords(e.target.checked)}
                />
                <span style={{ fontSize: "0.95rem" }}>Увімкнути останнє слово</span>
              </label>
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
          <p>Ви створюєте лобі для гри <b>Мафія</b>. Інші гравці зможуть знайти його в списку доступних ігор.</p>
        </div>
      </div>
    </div>
  )
}