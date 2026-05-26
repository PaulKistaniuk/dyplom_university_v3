import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"

export const useSocket = (sessionId: string) => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    if (!sessionId) return

    // Ініціалізуємо сервер через API роут
    fetch("/api/socket")

    const socket = io({
      path: "/api/socket",
    })

    socket.on("connect", () => {
      console.log("Connected to socket server")
      setIsConnected(true)
      socket.emit("join_room", sessionId)
    })

    socket.on("new_message", (message: any) => {
      setMessages((prev) => [...prev, message])
    })

    socket.on("disconnect", () => {
      setIsConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [sessionId])

  const sendMessage = (data: {
    username: string
    avatar: string
    text: string
    userId: string
    channel?: "public" | "mafia"
  }) => {
    if (socketRef.current) {
      socketRef.current.emit("send_message", { ...data, sessionId })
    }
  }

  return { isConnected, messages, sendMessage }
}
