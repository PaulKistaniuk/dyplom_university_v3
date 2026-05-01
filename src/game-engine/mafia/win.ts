export function checkWin(players: any[]) {
  const alive = players.filter(p => p.isAlive)

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