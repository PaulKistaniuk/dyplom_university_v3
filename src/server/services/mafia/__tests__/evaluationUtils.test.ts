import { describe, expect, it } from "vitest"
import {
  clampScore,
  isCitizenRole,
  isMafiaRole,
  resolveCitizensWinByGameResult,
} from "../evaluationUtils"

describe("evaluationUtils", () => {
  it("detects mafia roles", () => {
    expect(isMafiaRole("mafia")).toBe(true)
    expect(isMafiaRole("don")).toBe(true)
    expect(isMafiaRole("citizen")).toBe(false)
  })

  it("detects citizen roles", () => {
    expect(isCitizenRole("citizen")).toBe(true)
    expect(isCitizenRole("commissar")).toBe(true)
    expect(isCitizenRole("doctor")).toBe(true)
    expect(isCitizenRole("mafia")).toBe(false)
  })

  it("resolves citizens win from citizen role and win result", () => {
    expect(resolveCitizensWinByGameResult("citizen", "win")).toBe(true)
    expect(resolveCitizensWinByGameResult("doctor", "win")).toBe(true)
    expect(resolveCitizensWinByGameResult("commissar", "win")).toBe(true)
  })

  it("resolves mafia win from mafia role and win result", () => {
    expect(resolveCitizensWinByGameResult("mafia", "win")).toBe(false)
    expect(resolveCitizensWinByGameResult("don", "win")).toBe(false)
  })

  it("resolves citizens win when mafia role has lose result", () => {
    expect(resolveCitizensWinByGameResult("mafia", "lose")).toBe(true)
    expect(resolveCitizensWinByGameResult("don", "lose")).toBe(true)
  })

  it("throws error for unknown result", () => {
    expect(() => resolveCitizensWinByGameResult("citizen", "draw")).toThrow()
  })

  it("throws error for unknown role", () => {
    expect(() => resolveCitizensWinByGameResult("alien", "win")).toThrow()
  })

  it("clamps score to 0..100 range", () => {
    expect(clampScore(-10)).toBe(0)
    expect(clampScore(50)).toBe(50)
    expect(clampScore(150)).toBe(100)
  })
})