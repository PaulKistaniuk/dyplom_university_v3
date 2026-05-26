export function normalizeRole(role: any) {
  return String(role || "").trim().toLowerCase()
}

export function isMafiaRole(role: string) {
  return ["mafia", "don", "мафія", "дон"].includes(normalizeRole(role))
}

export function isCitizenRole(role: string) {
  return [
    "citizen",
    "commissar",
    "doctor",
    "мирний",
    "мирний житель",
    "комісар",
    "лікар",
    "sheriff",
    "sherif",
  ].includes(normalizeRole(role))
}

export function resolveCitizensWinByGameResult(role: string, result: string) {
  const normalizedRole = normalizeRole(role)
  const normalizedResult = String(result || "").trim().toLowerCase()

  if (normalizedResult !== "win" && normalizedResult !== "lose") {
    throw new Error(`Unknown GameResult.result value: ${result}`)
  }

  if (isCitizenRole(normalizedRole)) {
    return normalizedResult === "win"
  }

  if (isMafiaRole(normalizedRole)) {
    return normalizedResult === "lose"
  }

  throw new Error(`Unknown mafia role in GameResult.stats.role: ${role}`)
}

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}