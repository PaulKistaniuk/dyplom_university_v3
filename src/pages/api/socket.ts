import { Server as NetServer } from "http"
import { NextApiRequest } from "next"
import { Server as ServerIO } from "socket.io"
import { NextApiResponseServerIO } from "@/shared/types/socket"

export const config = {
  api: {
    bodyParser: false,
  },
}

const socketHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    console.log("Initializing Socket.io server...")
    const httpServer: NetServer = res.socket.server as any
    const io = new ServerIO(httpServer, {
      path: "/api/socket",
      addTrailingSlash: false,
    })

    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id)

      socket.on("join_room", (sessionId: string) => {
        socket.join(sessionId)
        console.log(`Socket ${socket.id} joined room ${sessionId}`)
      })

      socket.on("send_message", (data: { sessionId: string; username: string; avatar: string; text: string; userId: string }) => {
        // Розсилаємо всім у кімнаті, включаючи відправника
        io.to(data.sessionId).emit("new_message", {
          ...data,
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now()
        })
      })

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id)
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export default socketHandler
