/**
 * Розподіляє слова між гравцями так, щоб ніхто не отримав своє власне слово.
 * @param submittedWords — Map userId → слово, яке загадав гравець
 * @returns Map userId → { word, assignedBy } — призначені слова
 */
export function distributeWords(
  submittedWords: Record<string, string>
): Record<string, { word: string; assignedBy: string }> {
  const userIds = Object.keys(submittedWords)

  if (userIds.length < 2) {
    throw new Error("Need at least 2 players to distribute words")
  }

  // Створюємо масив слів із прив'язкою до авторів
  const wordEntries = userIds.map(uid => ({ authorId: uid, word: submittedWords[uid] }))

  // Derangement: перемішуємо так, щоб жоден гравець не отримав своє слово
  let shuffled: typeof wordEntries
  let attempts = 0
  const maxAttempts = 1000

  do {
    shuffled = [...wordEntries].sort(() => Math.random() - 0.5)
    attempts++
    if (attempts > maxAttempts) {
      throw new Error("Failed to generate valid word distribution")
    }
  } while (shuffled.some((entry, i) => entry.authorId === userIds[i]))

  // Формуємо результат
  const assignments: Record<string, { word: string; assignedBy: string }> = {}
  userIds.forEach((uid, i) => {
    assignments[uid] = {
      word: shuffled[i].word,
      assignedBy: shuffled[i].authorId,
    }
  })

  return assignments
}
