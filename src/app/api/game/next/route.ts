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
  allPlayers: any[],
  killedThisRound?: string | null,
): number {
  const isAliveNow = (p: any) => {
    const isAlive = (p.state as any)?.isAlive ?? true
    return isAlive && p.userId !== killedThisRound
  }

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

  // Shared: read gameState and actions
  const gameState = (game.state as any) || {}
  const actions = (game.actions as any) || {}
  const now = Date.now()
  const startedAt: number = gameState.phaseStartedAt ?? now

  // Mirror the frontend duration logic
  const getActiveRoleAlive = (): boolean => {
    const p = game.players
    const isAlive = (player: any) => (player.state as any)?.isAlive ?? true
    if (game.phase === "mafia") return p.some(x => ["mafia", "don"].includes(x.role || "") && isAlive(x))
    if (game.phase === "don") return p.some(x => x.role === "don" && isAlive(x))
    if (game.phase === "commissar") return p.some(x => x.role === "commissar" && isAlive(x))
    if (game.phase === "doctor") return p.some(x => x.role === "doctor" && isAlive(x))
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
      const gp = await prisma.gamePlayer.findFirst({
        where: { gameId: sessionId, userId: killedPlayerId }
      })
      if (gp) {
        const gpState = (gp.state as any) || {}
        gpState.isAlive = false
        await prisma.gamePlayer.update({
          where: { id: gp.id },
          data: { state: gpState }
        })
      }
    }

    const updatedState = {
      ...gameState,
      votes: {},
      mafiaVotes: {},
      donKill: null,
      heal: null,
      check: null,
      currentNightDonCheck: null,
      currentNightCommissarCheck: null,
      phaseStartedAt: Date.now(),
    }

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "night",
        phase: "mafia",
        dayNumber: { increment: 1 },
        state: updatedState,
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
      
      const resultsData = after!.players.map((p) => {
        const isMafiaTeam = p.role === "mafia" || p.role === "don";
        const isWin = (winner === "mafia" && isMafiaTeam) || (winner === "citizens" && !isMafiaTeam);
        return {
          gameId: sessionId,
          userId: p.userId,
          gameType: "mafia",
          result: isWin ? "win" : "lose",
          stats: { role: p.role },
        };
      });
      await prisma.gameResult.createMany({ data: resultsData });
    }
  }

  // ─── CORE PROGRESSION LOGIC ───────────────────────────────────────────
  const alivePlayers = game.players.filter(p => (p.state as any)?.isAlive ?? true)

  if (game.status === "night") {
    if (isExpired || !isExpired) { // Just run the logic
      if (game.phase === "mafia") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "don",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "don") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "commissar",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "commissar") {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "doctor",
            state: { ...gameState, phaseStartedAt: Date.now() },
          },
        })
        return NextResponse.json({ success: true })
      }

      if (game.phase === "doctor") {
        const result = resolveNight(gameState, game.players)

        if (result.killedPlayerId) {
          const killedPlayer = game.players.find(p => p.userId === result.killedPlayerId)
          if (killedPlayer) {
            const killedState = (killedPlayer.state as any) || {}
            killedState.isAlive = false
            await prisma.gamePlayer.update({
              where: { id: killedPlayer.id },
              data: { state: killedState },
            })
          }
        }

        const doctor = await prisma.gamePlayer.findFirst({
          where: { gameId: sessionId, role: "doctor" },
        })
        if (doctor && gameState.heal === doctor.userId) {
          const docState = (doctor.state as any) || {}
          docState.healsUsed = (docState.healsUsed || 0) + 1
          if (gameState.heal === doctor.userId) {
            docState.selfHeals = (docState.selfHeals || 0) + 1
          }
          await prisma.gamePlayer.update({
            where: { id: doctor.id },
            data: { state: docState },
          })
        }

        const nextPhase = (result.killedPlayerId && game.lobby.lastWords) ? "night_kill_speech" : "discussion"
        const firstSpeaker = getFirstSpeakerIndex(game.dayNumber, game.players, result.killedPlayerId)

        const isAliveNow = (p: any) => ((p.state as any)?.isAlive ?? true) && p.userId !== result.killedPlayerId
        const alivePlayersTemp = game.players.filter(isAliveNow)

        const updatedState = {
          ...gameState,
          lastCheck: result.checkedPlayerId,
          checkResult: result.checkResult,
          lastHeal: gameState.heal,
          currentSpeakerIndex: firstSpeaker,
          speakersCount: 1,
          phaseStartedAt: Date.now(),
          heal: null,
          currentNightDonCheck: null,
          currentNightCommissarCheck: null,
          check: null,
          nightKilledId: result.killedPlayerId,
          nominations: [],
          firstSpeakerUserId: alivePlayersTemp[firstSpeaker]?.userId,
          nominationSpeakerIndex: 0,
          revoteCandidates: [],
        }

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: "day",
            phase: nextPhase,
            state: updatedState,
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

          const resultsData = afterNight!.players.map((p) => {
            const isMafiaTeam = p.role === "mafia" || p.role === "don";
            const isWin = (nightWinner === "mafia" && isMafiaTeam) || (nightWinner === "citizens" && !isMafiaTeam);
            return {
              gameId: sessionId,
              userId: p.userId,
              gameType: "mafia",
              result: isWin ? "win" : "lose",
              stats: { role: p.role },
            };
          });
          await prisma.gameResult.createMany({ data: resultsData });
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
          state: { ...gameState, phaseStartedAt: Date.now() },
        },
      })
      return NextResponse.json({ success: true })
    }

    if (game.phase === "discussion") {
      const currentSpeaker = alivePlayers[gameState.currentSpeakerIndex || 0]

      if (!isExpired) {
        // Manual auth check
        if (!currentSpeaker || currentSpeaker.userId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      // Check auto-nominate rule for the FIRST speaker
      if (currentSpeaker && currentSpeaker.userId === gameState.firstSpeakerUserId && game.dayNumber > 1) {
        const noms = gameState.nominations || []
        if (noms.length === 0) {
          const possible = alivePlayers.filter(p => p.userId !== currentSpeaker.userId)
          if (possible.length > 0) {
            const rand = possible[Math.floor(Math.random() * possible.length)]
            noms.push(rand.userId)
            gameState.nominations = noms
          }
        }
      }

      const speakersCount = (gameState.speakersCount || 1) + 1
      const currentIndex = ((gameState.currentSpeakerIndex || 0) + 1) % alivePlayers.length

      if (speakersCount > alivePlayers.length) {
        if (game.dayNumber === 1) {
          await goToNight()
          return NextResponse.json({ success: true })
        } else {
          const noms = gameState.nominations || []
          if (noms.length === 0) {
            await goToNight()
            return NextResponse.json({ success: true })
          } else if (noms.length === 1) {
            if (game.lobby.lastWords) {
              await prisma.gameSession.update({
                where: { id: sessionId },
                data: {
                  phase: "single_elim_speech",
                  state: { ...gameState, phaseStartedAt: Date.now(), nominationSpeakerIndex: 0 },
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
                state: { ...gameState, phaseStartedAt: Date.now(), nominationSpeakerIndex: 0 },
              },
            })
            return NextResponse.json({ success: true })
          }
        }
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, currentSpeakerIndex: currentIndex, speakersCount, phaseStartedAt: Date.now() },
          },
        })
        return NextResponse.json({ success: true })
      }
    }

    if (game.phase === "single_elim_speech" || game.phase === "voting_elim_speech") {
      const eliminatedId = game.phase === "single_elim_speech" ? (gameState.nominations || [])[0] : gameState.nightKilledId
      await goToNight(eliminatedId)
      return NextResponse.json({ success: true })
    }

    if (game.phase === "nomination_defense") {
      const noms = gameState.nominations || []
      const nextIndex = (gameState.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        // Manual auth check
        const currentDefendingId = noms[gameState.nominationSpeakerIndex || 0]
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
            state: { ...gameState, votes: {}, phaseStartedAt: Date.now() },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }
  }

  if (game.status === "voting") {
    if (game.phase === "voting") {
      const noms = gameState.nominations || []
      const fallbackTarget = noms[noms.length - 1]

      const votes = gameState.votes || {}
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
              state: { ...gameState, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now() },
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
            state: { ...gameState, votes: {}, revoteCandidates: result.leaders, nominationSpeakerIndex: 0, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote_defense") {
      const revoteCandidates = gameState.revoteCandidates || []
      const nextIndex = (gameState.nominationSpeakerIndex || 0) + 1

      if (!isExpired) {
        // Manual auth check
        const currentDefendingId = revoteCandidates[gameState.nominationSpeakerIndex || 0]
        if (currentDefendingId !== currentUserId) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 })
        }
      }

      if (nextIndex >= revoteCandidates.length) {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            phase: "revote",
            state: { ...gameState, votes: {}, phaseStartedAt: Date.now() },
          },
        })
      } else {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            state: { ...gameState, nominationSpeakerIndex: nextIndex, phaseStartedAt: Date.now() },
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (game.phase === "revote") {
      const revoteCandidates = gameState.revoteCandidates || []
      const fallbackTarget = revoteCandidates[revoteCandidates.length - 1]

      const votes = gameState.votes || {}
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
              state: { ...gameState, votes: {}, nightKilledId: result.eliminated, phaseStartedAt: Date.now() },
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

    const resultsData = updatedGame!.players.map((p) => {
      const isMafiaTeam = p.role === "mafia" || p.role === "don";
      const isWin = (winner === "mafia" && isMafiaTeam) || (winner === "citizens" && !isMafiaTeam);
      return {
        gameId: sessionId,
        userId: p.userId,
        gameType: "mafia",
        result: isWin ? "win" : "lose",
        stats: { role: p.role },
      };
    });
    await prisma.gameResult.createMany({ data: resultsData });
  }

  return NextResponse.json({ success: true })
}