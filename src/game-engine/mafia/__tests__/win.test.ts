import { describe, expect, it } from "vitest"
import { checkWin } from "../win"

describe("checkWin", () => {
  it("returns citizens when no mafia players are alive", () => {
    const players = [
      { role: "citizen", state: { isAlive: true } },
      { role: "doctor", state: { isAlive: true } },
      { role: "mafia", state: { isAlive: false } },
    ]

    expect(checkWin(players)).toBe("citizens")
  })

  it("returns mafia when mafia count is greater than or equal to citizens count", () => {
    const players = [
      { role: "mafia", state: { isAlive: true } },
      { role: "citizen", state: { isAlive: true } },
    ]

    expect(checkWin(players)).toBe("mafia")
  })

  it("returns null when the game should continue", () => {
    const players = [
      { role: "mafia", state: { isAlive: true } },
      { role: "citizen", state: { isAlive: true } },
      { role: "citizen", state: { isAlive: true } },
    ]

    expect(checkWin(players)).toBeNull()
  })

  it("ignores dead players", () => {
    const players = [
      { role: "mafia", state: { isAlive: true } },
      { role: "citizen", state: { isAlive: false } },
      { role: "citizen", state: { isAlive: false } },
    ]

    expect(checkWin(players)).toBe("mafia")
  })
})