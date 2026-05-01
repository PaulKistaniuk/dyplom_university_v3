export function resolveNight(actions: any, players: any[]) {
  const heal = actions.heal
  const check = actions.check

  // -------------------------
  // MAFIA VOTING
  // -------------------------
  const mafiaVotes = actions.mafiaVotes || {}

  const count: Record<string, number> = {}

  for (const voter in mafiaVotes) {
    const target = mafiaVotes[voter]
    if (!target) continue

    count[target] = (count[target] || 0) + 1
  }

  let kill: string | null = null
  let maxVotes = 0

  for (const targetId in count) {
    if (count[targetId] > maxVotes) {
      maxVotes = count[targetId]
      kill = targetId
    }
  }

  if (actions.donKill) {
    kill = actions.donKill
  }

  // -------------------------
  // DOCTOR HEAL
  // -------------------------
  let killedPlayerId = kill

  if (kill && kill === heal) {
    killedPlayerId = null
  }

  // -------------------------
  // CHECK
  // -------------------------
  let checkResult = null

  if (check) {
    const target = players.find(p => p.userId === check)

    if (target) {
      checkResult =
        target.role === "mafia" || target.role === "don"
          ? "mafia"
          : "citizen"
    }
  }

  // -------------------------
  return {
    killedPlayerId,
    checkResult,
    checkedPlayerId: check,
  }
}