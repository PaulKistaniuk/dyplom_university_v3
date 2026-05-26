import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { evaluateAndSaveGameResults } from "@/server/services/mafia/evaluationService"

function hasEnoughData(session: any) {
  const state = session.state || {}
  const actions = session.actions || {}

  const timeline = state.timeline || actions.timeline || []
  const snapshots = state.snapshots || actions.snapshots || {}

  const hasPlayers = session.players?.length >= 4
  const hasTimeline = Array.isArray(timeline) && timeline.length > 0

  const hasAnySnapshot =
    (snapshots.days?.length || 0) > 0 ||
    (snapshots.nights?.length || 0) > 0 ||
    (snapshots.votings?.length || 0) > 0

  const hasResults = session.resultsCount > 0

  return {
    ok: hasPlayers && (hasTimeline || hasAnySnapshot) && hasResults,
    reason: {
      hasPlayers,
      hasTimeline,
      hasAnySnapshot,
      hasResults,
    }
  }
}

function getEvaluation(player: any) {
  return player?.personal?.evaluation || null
}

function stableStringify(value: any) {
  return JSON.stringify(value ?? null, Object.keys(value ?? {}).sort(), 2)
}

function describeEvaluation(evaluation: any) {
  if (!evaluation) return "no evaluation"

  return `${evaluation.title || "Гравець"} | ${evaluation.score ?? "?"}% | badges: ${(evaluation.badges || []).join(", ") || "-"}`
}

async function loadSessionPlayers(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: {
          user: {
            select: {
              username: true,
            }
          }
        },
        orderBy: {
          number: "asc",
        }
      }
    }
  })

  return session?.players || []
}

async function main() {
  const targetSessionId = process.argv[2]

  const sessions = await prisma.gameSession.findMany({
    where: {
      gameType: "mafia",
      status: "finished",
      ...(targetSessionId ? { id: targetSessionId } : {}),
    },
    include: {
      players: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  if (targetSessionId && sessions.length === 0) {
    console.log("SKIP: Mafia GameSession not found or not finished:", targetSessionId)
    await prisma.$disconnect()
    return
  }

  let processed = 0
  let unchanged = 0
  let changed = 0
  let skipped = 0
  let failed = 0

  for (const session of sessions) {
    const resultsCount = await prisma.gameResult.count({
      where: {
        gameId: session.id,
      },
    })

    const check = hasEnoughData({
      ...session,
      resultsCount,
    })

    if (!check.ok) {
      skipped++
      console.log("SKIP", session.id, check.reason)
      continue
    }

    try {
      const beforePlayers = await loadSessionPlayers(session.id)
      const beforeMap = new Map(
        beforePlayers.map((p: any) => [
          p.userId,
          {
            username: p.user?.username || `user_${p.number}`,
            number: p.number,
            role: p.role,
            evaluation: getEvaluation(p),
          }
        ])
      )

      await evaluateAndSaveGameResults(session.id)

      const afterPlayers = await loadSessionPlayers(session.id)

      const changedPlayers: any[] = []

      for (const afterPlayer of afterPlayers as any[]) {
        const before = beforeMap.get(afterPlayer.userId)
        const beforeEvaluation = before?.evaluation || null
        const afterEvaluation = getEvaluation(afterPlayer)

        const beforeStr = stableStringify(beforeEvaluation)
        const afterStr = stableStringify(afterEvaluation)

        if (beforeStr !== afterStr) {
          changedPlayers.push({
            userId: afterPlayer.userId,
            username: afterPlayer.user?.username || before?.username || `user_${afterPlayer.number}`,
            number: afterPlayer.number,
            role: afterPlayer.role,
            before: beforeEvaluation,
            after: afterEvaluation,
          })
        }
      }

      processed++

      if (changedPlayers.length === 0) {
        unchanged++
        console.log(`UNCHANGED ${session.id}: результати такі ж самі`)
      } else {
        changed++
        console.log(`CHANGED ${session.id}: змінено гравців: ${changedPlayers.length}`)

        changedPlayers.forEach((p) => {
          console.log(`  №${p.number} ${p.username} (${p.role})`)
          console.log(`    before: ${describeEvaluation(p.before)}`)
          console.log(`    after:  ${describeEvaluation(p.after)}`)
        })
      }
    } catch (e) {
      failed++
      console.error("FAIL", session.id, e)
    }
  }

  console.log({
    total: sessions.length,
    processed,
    changed,
    unchanged,
    skipped,
    failed,
  })

  await prisma.$disconnect()
}

main()