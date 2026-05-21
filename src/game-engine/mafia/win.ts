export function checkWin(players: any[]) {
  const alive = players.filter(p => {
    const isAlive = (p.state as any)?.isAlive ?? p.isAlive
    return isAlive !== false
  })

  const mafia = alive.filter(p => p.role === "mafia" || p.role === "don")
  const citizens = alive.filter(p => p.role !== "mafia" && p.role !== "don")

  if (mafia.length === 0) {
    return "citizens"
  }

  if (mafia.length >= citizens.length) {
    return "mafia"
  }

  return null
}