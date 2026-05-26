import { describe, expect, it } from "vitest"
import { assignRoles } from "../setup"

describe("assignRoles", () => {
  it("assigns 4 roles for 4 players", () => {
    const roles = assignRoles(["u1", "u2", "u3", "u4"])

    expect(roles).toHaveLength(4)
    expect(roles.filter(role => role === "mafia")).toHaveLength(1)
    expect(roles.filter(role => role === "citizen")).toHaveLength(3)
  })

  it("adds commissar for 5 players", () => {
    const roles = assignRoles(["u1", "u2", "u3", "u4", "u5"])

    expect(roles).toHaveLength(5)
    expect(roles).toContain("mafia")
    expect(roles).toContain("commissar")
  })

  it("adds don, commissar and doctor for 6 players", () => {
    const roles = assignRoles(["u1", "u2", "u3", "u4", "u5", "u6"])

    expect(roles).toHaveLength(6)
    expect(roles).toContain("don")
    expect(roles).toContain("commissar")
    expect(roles).toContain("doctor")
  })

  it("assigns 10 roles for 10 players", () => {
    const roles = assignRoles(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"])

    expect(roles).toHaveLength(10)
    expect(roles.filter(role => role === "mafia")).toHaveLength(2)
    expect(roles).toContain("don")
    expect(roles).toContain("commissar")
    expect(roles).toContain("doctor")
  })
})