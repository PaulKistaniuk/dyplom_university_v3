import { describe, expect, it } from "vitest"
import { resolveNight } from "../night"

const players = [
  { userId: "mafia1", role: "mafia" },
  { userId: "don1", role: "don" },
  { userId: "citizen1", role: "citizen" },
  { userId: "doctor1", role: "doctor" },
  { userId: "commissar1", role: "commissar" },
]

describe("resolveNight", () => {
  it("selects kill target by mafia votes", () => {
    const result = resolveNight(
      {
        mafiaVotes: {
          mafia1: "citizen1",
          don1: "citizen1",
        },
      },
      players
    )

    expect(result.killedPlayerId).toBe("citizen1")
  })

  it("uses donKill as priority target", () => {
    const result = resolveNight(
      {
        mafiaVotes: {
          mafia1: "citizen1",
          don1: "doctor1",
        },
        donKill: "commissar1",
      },
      players
    )

    expect(result.killedPlayerId).toBe("commissar1")
  })

  it("doctor heal prevents kill", () => {
    const result = resolveNight(
      {
        mafiaVotes: {
          mafia1: "citizen1",
          don1: "citizen1",
        },
        heal: "citizen1",
      },
      players
    )

    expect(result.killedPlayerId).toBeNull()
  })

  it("returns mafia check result for mafia target", () => {
    const result = resolveNight(
      {
        check: "don1",
      },
      players
    )

    expect(result.checkResult).toBe("mafia")
    expect(result.checkedPlayerId).toBe("don1")
  })

  it("returns citizen check result for non-mafia target", () => {
    const result = resolveNight(
      {
        check: "doctor1",
      },
      players
    )

    expect(result.checkResult).toBe("citizen")
  })
})