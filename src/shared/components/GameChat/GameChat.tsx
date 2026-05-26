"use client"

import { useState, useEffect, useRef } from "react"
import styles from "./GameChat.module.css"
import { useSocket } from "@/shared/hooks/useSocket"

interface GameChatProps {
  sessionId: string
  logs: any[]
  user: any
  isAlive: boolean
  role?: string | null
  gameState?: {
    phase: string
    dayNumber: number
    players: any[]
    status: string
  }
}

export const GameChat = ({ sessionId, logs, user, isAlive, role, gameState }: GameChatProps) => {
  const [activeTab, setActiveTab] = useState<"logs" | "chat" | "ai">("logs")
  const { messages, sendMessage } = useSocket(sessionId)
  const [inputText, setInputText] = useState("")
  const [aiMessages, setAiMessages] = useState<any[]>([
    { id: "ai-1", text: "Привіт! Я твій асистент. Питай будь-що про правила гри Мафія.", isAi: true }
  ])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const isMafiaRole = role === "mafia" || role === "don"
  const isMafiaNightChat =
    gameState?.status === "night" &&
    gameState?.phase === "mafia" &&
    isMafiaRole
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, logs, aiMessages, activeTab, isAiLoading])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const textToSend = inputText
    setInputText("")

    if (activeTab === "chat") {
      if (!isAlive) return
      sendMessage({
        username: user.username,
        avatar: user.avatarUrl || "/default_user.png",
        text: textToSend,
        userId: user.id,
        channel: isMafiaNightChat ? "mafia" : "public",
      })
    } else if (activeTab === "ai") {
      const newUserMsg = { id: Date.now().toString(), text: textToSend, isAi: false }
      setAiMessages(prev => [...prev, newUserMsg])
      
      setIsAiLoading(true)
      try {
        const myPlayer = gameState?.players.find(p => p.userId === user.id)
        const res = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: textToSend,
            context: {
              phase: gameState?.phase,
              dayNumber: gameState?.dayNumber,
              totalPlayers: gameState?.players.length,
              alivePlayers: gameState?.players.filter(p => p.isAlive).length,
              myRole: myPlayer?.role,
              isAlive: myPlayer?.isAlive
            }
          })
        })
        const data = await res.json()
        setAiMessages(prev => [...prev, { 
          id: (Date.now()+1).toString(), 
          text: data.text, 
          isAi: true 
        }])
      } catch (error) {
        setAiMessages(prev => [...prev, { 
          id: (Date.now()+1).toString(), 
          text: "Помилка з'єднання з асистентом.", 
          isAi: true 
        }])
      } finally {
        setIsAiLoading(false)
      }
    }
  }

  // Простий рендер для жирного тексту (Markdown-style **)
  const formatText = (text: string) => {
    if (!text.includes("**")) return text
    const parts = text.split("**")
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)
  }

  const visibleMessages = messages.filter((msg: any) => {
    if (msg.channel !== "mafia") return true
    return isMafiaRole
  })

  return (
    <div className={styles.chatContainer}>
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === "logs" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          📜 Події
        </button>
        <button 
          className={`${styles.tab} ${activeTab === "chat" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Гравці
        </button>
        <button 
          className={`${styles.tab} ${activeTab === "ai" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          🤖 Асистент
        </button>
      </div>

      <div className={styles.messagesArea} ref={scrollRef}>
        {activeTab === "logs" && logs.map((log) => (
          <div key={log.id} className={styles.logMsg}>
            {log.text}
          </div>
        ))}

        {activeTab === "chat" && visibleMessages.map((msg) => {
          const isMe = msg.userId === user.id
          return (
            <div key={msg.id} className={`${styles.msgWrapper} ${isMe ? styles.msgLeft : styles.msgRight}`}>
              <div className={styles.userInfo}>
                <img src={msg.avatar} alt="" className={styles.avatar} />
                <span className={styles.username}>{msg.username}</span>
              </div>
              <div className={`${styles.bubble} ${isMe ? styles.bubbleLeft : styles.bubbleRight}`}>
                {msg.channel === "mafia" && (
                  <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.75, marginBottom: "4px" }}>
                    Чат мафії
                  </span>
                )}
                {msg.text}
              </div>
            </div>
          )
        })}

        {activeTab === "ai" && aiMessages.map((msg) => (
          <div key={msg.id} className={`${styles.bubble} ${msg.isAi ? styles.aiBubble : styles.userAiBubble}`}>
            {formatText(msg.text)}
          </div>
        ))}

        {activeTab === "ai" && isAiLoading && (
          <div className={`${styles.bubble} ${styles.aiBubble}`} style={{ opacity: 0.7 }}>
            Асистент міркує...
          </div>
        )}
      </div>

      {(activeTab === "chat" || activeTab === "ai") && (
        <form className={styles.inputArea} onSubmit={handleSend}>
          {activeTab === "chat" && !isAlive ? (
            <div className={styles.deadOverlay}>Мертві не можуть писати в чат</div>
          ) : (
            <>
              <input 
                className={styles.input}
                placeholder={
                  activeTab === "chat"
                    ? isMafiaNightChat
                      ? "Написати мафії..."
                      : "Написати гравцям..."
                    : "Запитати асистента..."
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className={styles.sendBtn}>🚀</button>
            </>
          )}
        </form>
      )}
    </div>
  )
}
