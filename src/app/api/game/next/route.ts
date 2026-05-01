import { prisma } from "@/lib/prisma"
import { resolveNight } from "@/game-engine/mafia/night"
import { resolveVoting } from "@/game-engine/mafia/voting"
import { checkWin } from "@/game-engine/mafia/win"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

/**
 * Returns the index (into alivePlayers array) of the first speaker for a given day.
 * Day N starts from the player whose original seat = (N-1) % totalSeats.
 * If that player is dead, we advance to the next alive one.
 * killedThisRound: userId of a player who just died but isn’t yet removed from allPlayers.isAlive.
 */
function getFirstSpeakerIndex(
  dayNumber: number,
  allPlayers: { userId: string; isAlive: boolean }[],
  killedThisRound?: string | null,
): number {
  const isAliveNow = (p: { userId: string; isAlive: boolean }) =>
    p.isAlive && p.userId !== killedThisRound

  const alivePlayers = allPlayers.filter(isAliveNow)
  if (alivePlayers.length === 0) return 0

  const targetSeat = (dayNumber - 1) % allPlayers.length
  for (let i = 0; i < allPlayers.length; i++) {
    const seat = (targetSeat + i) % allPlayers.length
    if (isAliveNow(allPlayers[seat])) {
      return alivePlayers.findIndex(p => p.userId === allPlayers[seat].userId)
    }
  }
  return 0
}

export async function POST(req: NextRequest) {
  const { sessionId, auto } = await req.json()
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  const game = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true, lobby: true },
  })

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 })
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
  const currentUserId = payload.userId

  // Shared: read actions once
  const actions = (game.actions as any) || {}
  const now = Date.now()
  const startedAt: number = actions.phaseStartedAt ?? now

  // Mirror the frontend duration logic
  const getActiveRoleAlive = (): boolean => {
    const p = game.players
    if (game.phase === "mafia") return p.some(x => ["mafia", "don"].includes(x.role) && x.isAlive)
    if (game.phase === "don") return p.some(x => x.role === "don" && x.isAlive)
    if (game.phase === "commissar") return p.some(x => x.role === "commissar" && x.isAlive)
    if (game.phase === "doctor") return p.some(x => x.role === "doctor" && x.isAlive)
    return true
  }

  const getDuration = (): number => {
    if (game.phase === "nomination_defense" || game.phase === "revote_defense") return 30_000
    if (game.phase === "night_kill_speech" || game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") return 60_000
    if (game.status === "voting") return 10_000
    if (game.status === "day") return 60_000
    if (game.status === "night") {
      let roleExists = true
      if (game.phase === "don") roleExists = game.players.some(x => x.role === "don")
      if (game.phase === "commissar") roleExists = game.players.some(x => x.role === "commissar")
      if (game.phase === "doctor") roleExists = game.players.some(x => x.role === "doctor")

      if (!roleExists) return 0
      return getActiveRoleAlive() ? 30_000 : 10_000
    }
    return 30_000
  }

  const isExpired = now - startedAt >= getDuration()

  if (auto && !isExpired) {
    return NextResponse.json({ success: false, error: "Timer not expired yet" }, { status: 400 })
  }

  // Helper for transitioning to night
  const goToNight = async (killedPlayerId?: string | null) => {
    if (killedPlayerId) {
      await prisma.gamePlayer.updateMany({
        where: { gameId: sessionId, userId: killedPlayerId },
        data: { isAlive: false },
      })
    }

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "night",
        phase: "mafia",
        dayNumber: { increment: 1 },
        actions: {
          ...actions,
          votes: {},
          mafiaVotes: {},
          donKill: null,
          heal: null,
          currentNightDonCheck: null,
          currentNightCommissarCheck: null,
          phaseStartedAt: Date.now(),
        },
      },
    })

    // win check
    const after = await prisma.gameSession.findUnique({
      where: { id: sessionId }, include: { players: true },
    })
    const winner = checkWin(after!.players)
    if (winner) {
      await prisma.gameSession.update({ where: { id: sessionId }, data: { status: "finished" } })
      await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })
    }
  }

  // ─── CORE PROGRESSION LOGIC ───────────────────────────────────────────
  // We handle both auto-skip and manual next here.
  // For manual next on phases where a specific user must click (day discussion), we check auth.
  // Other phases anyone can trigger (or auto-skip triggers).

  const alivePlayers = game.players.filter(p => p.isAlive)

  if (game.status === "night") {
    // Auth check for manual
    if (!isExpired && game.phase === "doctor") {
      // no auth for night transitions, handled by button visibility
    }

    if (isExpired || !isExpired) { // Just run the logic
      // removed day 1 instant skip so Night 1 phases play out for mafia introduction

      if (game.phase === "mafia") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { phase: "don", actions: { ...actions, phaseStartedAt: Date.now() } },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "don") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { phase: "commissar", actions: { ...actions, phaseStartedAt: Date.now() } },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "commissar") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { phase: "doctor", actions: { ...actions, phaseStartedAt: Date.now() } },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "doctor") {
        const result = resolveNight(actions, game.players)

        if (result.killedPlayerId) {
          await prisma.gamePlayer.updateMany({
            where: { gameId: sessionId, userId: result.killedPlayerId },
            data: { isAlive: false },
          })
        }

        const doctor = await prisma.gamePlayer.findFirst({
          where: { gameId: sessionId, role: "doctor" },
        })
        if (doctor && actions.heal === doctor.userId) {
          await prisma.gamePlayer.update({
            where: { id: doctor.id },
            data: { healsUsed: { increment: 1 } },
          })
        }

        const nextPhase = (result.killedPlayerId && game.lobby.lastWords) ? "night_kill_speech" : "discussion"
        const firstSpeaker = getFirstSpeakerIndex(game.dayNumber, game.players, result.killedPlayerId)

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "day",
            phase: nextPhase,
            actions: {
              ...actions,
              lastCheck: result.checkedPlayerId,
              checkResult: result.checkResult,
              lastHeal: actions.heal,
              currentSpeakerIndex: firstSpeaker,
              speakersCount: 1,
              phaseStartedAt: Date.now(),
              heal: null,
              currentNightDonCheck: null,
              currentNightCommissarCheck: null,
              nightKilledId: result.killedPlayerId,
              nominations: [],
              firstSpeakerUserId: game.players.filter(p => p.isAlive && p.userId !== result.killedPlayerId)[firstSpeaker]?.userId,
              nominationSpeakerIndex: 0,
              revoteCandidates: [],
            },
          },
        })

        // win check
        const afterNight = await prisma.gameSession.findUnique({
          where: { id: sessionId }, include: { players: true },
        })
        const nightWinner = checkWin(afterNight!.players)
        if (nightWinner) {
          await prisma.gameSession.update({ where: { id: sessionId }, data: { status: "finished" } })
          await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })
        }

        return NextResponse.json({ success: true })
      }
    }
  }

  if (game.status === "day") {
    if (game.phase === "night_kill_speech") {
      // After night kill speech, go to normal discussion
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          phase: "discussion",
          actions: { ...actions, phaseStartedAt: Date.now() },
        },
      })
      return NextResponse.json({ success: true })
    }

    if (game.phase === "discussion") {
      const currentSpeaker = alivePlayers[actions.currentSpeakerIndex || 0]

      if (!isExpired) {
        // Manual auth check
        if (!currentSpeaker || currentSpeaker.userId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      // Check auto-nominate rule for the FIRST speaker
      if (currentSpeaker && currentSpeaker.userId === actions.firstSpeakerUserId && game.dayNumber > 1) {
        const noms = actions.nominations || []
        if (noms.length === 0) {
          const possible = alivePlayers.filter(p => p.userId !== currentSpeaker.userId)
          if (possible.length > 0) {
            const rand = possible[Math.floor(Math.random() * possible.length)]
            noms.push(rand.userId)
            actions.nominations = noms
          }
        }
      }

      const speakersCount = (actions.speakersCount || 1) + 1
      const currentIndex = ((actions.currentSpeakerIndex || 0) + 1) % alivePlayers.length

      if (speakersCount > alivePlayers.length) {
        if (game.dayNumber === 1) {
          await goToNight()
          return NextResponse.json({ success: true })
        } else {
          const noms = actions.nominations || []
          if (noms.length === 0) {
            await goToNight()
            return NextResponse.json({ success: true })
          } else if (noms.length === 1) {
            if (game.lobby.lastWords) {
              await prisma.gameSession.update({
                where: { id: sessionId },
                data: {
                  phase: "single_elim_speech",
                  actions: { ...actions, phaseStartedAt: Date.now(), nominationSpeakerIndex: 0 },
                },
              })
              return NextResponse.json({ success: true })
            } else {
              await goToNight(noms[0])
              return NextResponse.json({ success: true })
            }
          } else {
            await prisma.gameSession.update({
              where: { id: sessionId },
              data: {
                phase: "nomination_defense",
                actions: { ...actions, phaseStartedAt: Date.now(), nominationSpeakerIndex: 0 },
              },
            })
            return NextResponse.json({ success: true })
          }
        }
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            actions: { ...actions, currentSpeakerIndex: currentIndex, speakersCount, phaseStartedAt: Date.now() },
          },
        })
        return NextResponse.json({ success: true })
      }
    }

    if (game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") {
      const eliminatedId = game.phase === "single_elim_speech" ? (actions.nominations || [])[0] : actions.nightKilledId
      await goToNight(eliminatedId)
      return NextResponse.json({ success: true })
    }

    if (game.phase === "nomination_defense") {
      const noms = actions.nominations || []
      const nextIndex = (actions.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        // Manual auth check
        const currentDefendingId = noms[actions.nominationSpeakerIndex || 0]
        if (currentDefendingId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      if (nextIndex >= noms.length) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "voting",
            phase: "voting",
            actions: { ...actions, votes: {}, phaseStartedAt: Date.now() },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            actions: { ...actions, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }
  }

  if (game.status === "voting") {
    if (game.phase === "voting") {
      const noms = actions.nominations || []
      const fallbackTarget = noms[noms.length - 1]

      const votes = actions.votes || {}
      alivePlayers.forEach(p => {
        if (!votes[p.userId]) {
          votes[p.userId] = fallbackTarget
        }
      })

      const result = resolveVoting(votes)
      if (!result.tie) {
        if (game.lobby.lastWords) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              status: "day",
              phase: "voting_elim_speech",
              actions: { ...actions, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now() },
            },
          })
        } else {
          await goToNight(result.eliminated)
        }
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "revote_defense",
            actions: { ...actions, votes: {}, revoteCandidates: result.leaders, nominationSpeakerIndex: 0, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote_defense") {
      const revoteCandidates = actions.revoteCandidates || []
      const nextIndex = (actions.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        // Manual auth check
        const currentDefendingId = revoteCandidates[actions.nominationSpeakerIndex || 0]
        if (currentDefendingId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      if (nextIndex >= revoteCandidates.length) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "revote",
            actions: { ...actions, votes: {}, phaseStartedAt: Date.now() },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            actions: { ...actions, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote") {
      const revoteCandidates = actions.revoteCandidates || []
      const fallbackTarget = revoteCandidates[revoteCandidates.length - 1]

      const votes = actions.votes || {}
      alivePlayers.forEach(p => {
        if (!votes[p.userId]) {
          votes[p.userId] = fallbackTarget
        }
      })

      const result = resolveVoting(votes)
      if (!result.tie) {
        if (game.lobby.lastWords) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              status: "day",
              phase: "voting_elim_speech",
              actions: { ...actions, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now() },
            },
          })
        } else {
          await goToNight(result.eliminated)
        }
      } else {
        await goToNight() // no one eliminated
      }
      return NextResponse.json({ success: true })
    }
  }

  // Fallback win check just in case
  const updatedGame = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true },
  })
  const winner = checkWin(updatedGame!.players)
  if (winner) {
    await prisma.gameSession.update({ where: { id: sessionId }, data: { status: "finished" } })
    await prisma.lobby.update({ where: { id: game.lobbyId }, data: { status: "finished" } })
  }

  return NextResponse.json({ success: true })
}