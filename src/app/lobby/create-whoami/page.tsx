"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "../lobby.module.css"

export default function CreateWhoAmILobbyPage() {
  const [name, setName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(4)
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
            wordSource: "players",
            chatMode: "nochat",
            gameMode: "champion",
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
          <p>Ви створюєте лобі для гри <b>Хто я?</b>. Кожний гравець загадає слово, які будуть випадковим чином розподілені між учасниками.</p>
        </div>
      </div>
    </div>
  )
}
