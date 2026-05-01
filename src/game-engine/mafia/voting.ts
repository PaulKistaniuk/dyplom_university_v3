export function resolveVoting(votes: Record<string, string>) {
  const count: Record<string, number> = {}

  for (const voter in votes) {
    const target = votes[voter]
    if (!target) continue

    count[target] = (count[target] || 0) + 1
  }

  let maxVotes = 0

  for (const userId in count) {
    if (count[userId] > maxVotes) {
      maxVotes = count[userId]
    }
  }

  const leaders = Object.keys(count).filter(
    userId => count[userId] === maxVotes
  )

  // нічия
  if (leaders.length !== 1) {
    return { eliminated: null, tie: true, leaders }
  }

  return { eliminated: leaders[0], tie: false }
}