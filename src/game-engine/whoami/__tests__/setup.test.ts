import { describe, expect, it } from "vitest"
import { distributeWords } from "../setup"

describe("distributeWords", () => {
  it("throws error when there is only one player", () => {
    expect(() => distributeWords({ user1: "Кіт" })).toThrow(
      "Need at least 2 players to distribute words"
    )
  })

  it("assigns every player exactly one word", () => {
    const submittedWords: Record<string, string> = {
      user1: "Кіт",
      user2: "Собака",
      user3: "Лисиця",
    }

    const assignments = distributeWords(submittedWords)

    expect(Object.keys(assignments)).toHaveLength(3)
    expect(assignments.user1.word).toBeDefined()
    expect(assignments.user2.word).toBeDefined()
    expect(assignments.user3.word).toBeDefined()
  })

  it("does not assign player's own word", () => {
    const submittedWords: Record<string, string> = {
      user1: "Кіт",
      user2: "Собака",
      user3: "Лисиця",
      user4: "Вовк",
    }

    const assignments = distributeWords(submittedWords)

    for (const userId of Object.keys(submittedWords)) {
      expect(assignments[userId].word).not.toBe(submittedWords[userId])
      expect(assignments[userId].assignedBy).not.toBe(userId)
    }
  })

  it("keeps all submitted words in assignments", () => {
    const submittedWords: Record<string, string> = {
      user1: "Кіт",
      user2: "Собака",
      user3: "Лисиця",
    }

    const assignments = distributeWords(submittedWords)
    const assignedWords = Object.values(assignments).map((item) => item.word)

    expect(assignedWords.sort()).toEqual(Object.values(submittedWords).sort())
  })
})