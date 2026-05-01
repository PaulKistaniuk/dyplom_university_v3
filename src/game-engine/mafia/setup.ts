export function assignRoles(playerIds: string[]) {
  const count = playerIds.length

  let roles: string[] = []

  if (count === 4) {
    roles = ["mafia", "citizen", "citizen", "citizen"]
  } else if (count === 5) {
    roles = ["mafia", "commissar", "citizen", "citizen", "citizen"]
  } else if (count === 6) {
    roles = ["don", "commissar", "doctor", "citizen", "citizen", "citizen"]
  } else if (count === 7) {
    roles = ["mafia", "don", "commissar", "doctor", "citizen", "citizen", "citizen"]
  } else if (count === 8) {
    roles = ["mafia", "don", "commissar", "doctor", "citizen", "citizen", "citizen", "citizen"]
  } else if (count === 9) {
    roles = ["mafia", "don", "commissar", "doctor", "citizen", "citizen", "citizen", "citizen", "citizen"]
  } else if (count === 10) {
    roles = ["mafia", "mafia", "don", "commissar", "doctor", "citizen", "citizen", "citizen", "citizen", "citizen"]
  }

  return shuffle(roles)
}

function shuffle(arr: any[]) {
  return arr.sort(() => Math.random() - 0.5)
}