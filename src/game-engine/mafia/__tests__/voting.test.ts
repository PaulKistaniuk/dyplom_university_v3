import { describe, expect, it } from "vitest"
import { resolveVoting } from "../voting"

describe("resolveVoting", () => {
  it("eliminates player with the most votes", () => {
    const votes = {
      user1: "user3",
      user2: "user3",
      user4: "user2",
    }

    expect(resolveVoting(votes)).toEqual({
      eliminated: "user3",
      tie: false,
    })
  })

  it("returns tie when several players have the same max votes", () => {
    const votes = {
      user1: "user3",
      user2: "user4",
    }

    const result = resolveVoting(votes)

    expect(result.eliminated).toBeNull()
    expect(result.tie).toBe(true)
    expect(result.leaders).toEqual(expect.arrayContaining(["user3", "user4"]))
  })

  it("ignores empty votes", () => {
    const votes = {
      user1: "user3",
      user2: "",
      user4: "user3",
    }

    expect(resolveVoting(votes)).toEqual({
      eliminated: "user3",
      tie: false,
    })
  })
})