import { PrismaClient } from "@prisma/client"
import { resolveNight } from "../mafia/night"
import { resolveVoting } from "../mafia/voting"
import { checkWin } from "../mafia/win"

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log("Cleaning old test games...")
  await prisma.gameResult.deleteMany({})
  await prisma.gamePlayer.deleteMany({})
  await prisma.gameSession.deleteMany({})
  await prisma.lobbyPlayer.deleteMany({})
  await prisma.lobby.deleteMany({})
}

async function getOrCreateTestUsers() {
  const users = []
  for (let i = 1; i <= 7; i++) {
    const username = `user${i}`
    let user = await prisma.user.findUnique({
      where: { username },
    })
    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          passwordHash: "dummy",
        },
      })
    }
    users.push(user)
  }
  return users
}

async function run4PlayerMafiaSimulation() {
  console.log("\n==========================================")
  console.log("STARTING 4-PLAYER MAFIA SIMULATION")
  console.log("==========================================")

  const users = await getOrCreateTestUsers()
  const u1 = users[0] // Mafia/Don
  const u2 = users[1] // Commissar
  const u3 = users[2] // Doctor
  const u4 = users[3] // Citizen

  // 1. Create Lobby
  console.log("1. Creating Lobby...")
  const lobby = await prisma.lobby.create({
    data: {
      name: "Test 4-player Lobby",
      gameType: "mafia",
      maxPlayers: 4,
      ownerId: u1.id,
      revealRoles: true,
      lastWords: true,
      players: {
        create: [
          { userId: u1.id, number: 1, isReady: true },
          { userId: u2.id, number: 2, isReady: true },
          { userId: u3.id, number: 3, isReady: true },
          { userId: u4.id, number: 4, isReady: true },
        ],
      },
    },
    include: { players: true },
  })
  console.log(`Lobby created. ID: ${lobby.id}. Players joined: ${lobby.players.length}`)

  // 2. Start Game
  console.log("2. Starting Game...")
  const session = await prisma.gameSession.create({
    data: {
      lobbyId: lobby.id,
      gameType: "mafia",
      status: "night",
      phase: "mafia",
      dayNumber: 1,
      settings: {
        revealRoles: lobby.revealRoles,
        lastWords: lobby.lastWords,
      },
      state: {
        phaseStartedAt: Date.now(),
        currentSpeakerIndex: 0,
        speakersCount: 0,
        nominations: [],
        votes: {},
        mafiaVotes: {},
        heal: null,
        lastHeal: null,
        currentNightDonCheck: null,
        currentNightCommissarCheck: null,
        lastCheck: null,
        checkResult: null,
        nightKilledId: null,
        revoteCandidates: [],
        nominationSpeakerIndex: 0,
      },
      actions: {
        timeline: [],
      },
    },
  })

  // Assign roles specifically for predictable simulation
  const roles = ["don", "commissar", "doctor", "citizen"]
  const lobbyPlayers = [u1, u2, u3, u4]

  await prisma.gamePlayer.createMany({
    data: lobbyPlayers.map((u, i) => ({
      userId: u.id,
      gameId: session.id,
      role: roles[i],
      number: i + 1,
      state: {
        isAlive: true,
        healsUsed: 0,
        selfHeals: 0,
        checksUsed: 0,
        checkedPlayers: [],
        hasVoted: false,
      },
      personal: {
        investigation: {},
      },
    })),
  })

  console.log("Game Session created. Roles assigned: Don, Commissar, Doctor, Citizen")

  // Fetch updated game with players
  let game = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { players: true },
  })

  if (!game) throw new Error("Game session not found")
  let gameState = game.state as any
  let gameActions = game.actions as any
  let gamePlayers = game.players

  // 3. Mafia Night Vote
  console.log("3. Night 1: Mafia shooting Citizen (u4)...")
  gameState.mafiaVotes = { [u1.id]: u4.id }
  gameState.donKill = u4.id

  gameActions.timeline.push({
    type: "night_action",
    action: "kill_vote",
    userId: u1.id,
    targetId: u4.id,
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Auto transition from mafia -> don
  console.log("Transitioning Night phase: mafia -> don")
  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      phase: "don",
      state: { ...gameState, phaseStartedAt: Date.now() },
      actions: gameActions,
    },
    include: { players: true },
  })
  gameState = game.state as any
  gameActions = game.actions as any

  // 4. Don check Commissar
  console.log("4. Don checks u2 (Commissar)...")
  const donPlayer = game.players.find(p => p.userId === u1.id)!
  const targetCheck = game.players.find(p => p.userId === u2.id)!

  // Update don't checks used
  const donState = donPlayer.state as any
  donState.checkedPlayers = [u2.id]
  await prisma.gamePlayer.update({
    where: { id: donPlayer.id },
    data: { state: donState },
  })

  gameState.donChecks = [{ by: u1.id, targetId: u2.id, result: "commissar" }]
  gameState.currentNightDonCheck = u2.id

  gameActions.timeline.push({
    type: "night_action",
    action: "don_check",
    userId: u1.id,
    targetId: u2.id,
    result: "commissar",
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Transition don -> commissar
  console.log("Transitioning Night phase: don -> commissar")
  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      phase: "commissar",
      state: { ...gameState, phaseStartedAt: Date.now() },
      actions: gameActions,
    },
    include: { players: true },
  })
  gameState = game.state as any
  gameActions = game.actions as any

  // 5. Commissar checks Don
  console.log("5. Commissar checks u1 (Don)...")
  const commPlayer = game.players.find(p => p.userId === u2.id)!
  const commState = commPlayer.state as any
  commState.checkedPlayers = [u1.id]
  await prisma.gamePlayer.update({
    where: { id: commPlayer.id },
    data: { state: commState },
  })

  gameState.commissarChecks = [{ by: u2.id, targetId: u1.id, result: "mafia" }]
  gameState.currentNightCommissarCheck = u1.id
  gameState.check = u1.id

  gameActions.timeline.push({
    type: "night_action",
    action: "check",
    userId: u2.id,
    targetId: u1.id,
    result: "mafia",
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Transition commissar -> doctor
  console.log("Transitioning Night phase: commissar -> doctor")
  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      phase: "doctor",
      state: { ...gameState, phaseStartedAt: Date.now() },
      actions: gameActions,
    },
    include: { players: true },
  })
  gameState = game.state as any
  gameActions = game.actions as any

  // 6. Doctor heals Citizen
  console.log("6. Doctor heals u4 (Citizen)...")
  gameState.heal = u4.id

  gameActions.timeline.push({
    type: "night_action",
    action: "heal",
    userId: u3.id,
    targetId: u4.id,
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Transition doctor -> day (discussion)
  console.log("Transitioning Night -> Day (Discussion)")
  const result = resolveNight(gameState, game.players)
  console.log("Night resolved. KilledPlayerId:", result.killedPlayerId, "| CheckResult:", result.checkResult)

  // Verify that the doctor heal was successful and u4 is alive
  if (result.killedPlayerId !== null) {
    throw new Error("Simulation failed: u4 should have been saved by the Doctor")
  }
  if (result.checkResult !== "mafia") {
    throw new Error(`Simulation failed: Check result on u1 should be 'mafia', got ${result.checkResult}`)
  }

  // Set next phase
  const nextPhase = "discussion"
  gameState = {
    ...gameState,
    lastCheck: result.checkedPlayerId,
    checkResult: result.checkResult,
    lastHeal: gameState.heal,
    currentSpeakerIndex: 0,
    speakersCount: 1,
    phaseStartedAt: Date.now(),
    heal: null,
    currentNightDonCheck: null,
    currentNightCommissarCheck: null,
    check: null,
    nightKilledId: result.killedPlayerId,
    nominations: [],
    firstSpeakerUserId: u1.id,
    nominationSpeakerIndex: 0,
    revoteCandidates: [],
  }

  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      status: "day",
      phase: nextPhase,
      state: gameState,
      actions: gameActions,
    },
    include: { players: true },
  })
  gameState = game.state as any
  gameActions = game.actions as any

  console.log("Day discussion started. Active speaker (first):", u1.username)

  // 7. Day discussion & nomination
  console.log("7. Don (u1) nominates Doctor (u3)...")
  gameState.nominations = [u3.id]
  gameActions.timeline.push({
    type: "nomination",
    voterId: u1.id,
    targetId: u3.id,
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Speakers count increments, move speaker index to next player (u2)
  gameState.speakersCount = 2
  gameState.currentSpeakerIndex = 1

  console.log("Next speaker turn: u2 (Commissar)")
  // Commissar nominates Don (u1)
  console.log("Commissar (u2) nominates Don (u1)...")
  gameState.nominations.push(u1.id)
  gameActions.timeline.push({
    type: "nomination",
    voterId: u2.id,
    targetId: u1.id,
    dayNumber: game.dayNumber,
    timestamp: Date.now(),
  })

  // Cycle through other speakers (Doctor, Citizen) to complete the day discussion
  gameState.speakersCount = 5 // exceeds alivePlayers.length (4) to trigger defense
  gameState.phaseStartedAt = Date.now()

  // Transition discussion -> nomination_defense
  console.log("Transitioning Day: discussion -> nomination_defense")
  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      phase: "nomination_defense",
      state: { ...gameState, nominationSpeakerIndex: 0, phaseStartedAt: Date.now() },
      actions: gameActions,
    },
    include: { players: true },
  })
  gameState = game.state as any
  gameActions = game.actions as any

  // 8. Nomination defense & voting
  console.log("8. Transitioning nomination_defense -> voting")
  // Simulating defense end
  game = await prisma.gameSession.update({
    where: { id: game.id },
    data: {
      status: "voting",
      phase: "voting",
      state: { ...gameState, votes: {}, phaseStartedAt: Date.now() },
    },
    include: { players: true },
  })
  gameState = game.state as any

  // Players voting: u1, u2, u3 vote for Don (u1); u4 votes Doctor (u3)
  console.log("Players casting votes...")
  gameState.votes = {
    [u1.id]: u3.id, // Don votes Doctor
    [u2.id]: u1.id, // Commissar votes Don
    [u3.id]: u1.id, // Doctor votes Don
    [u4.id]: u1.id, // Citizen votes Don
  }

  gameActions.timeline.push({ type: "vote", voterId: u1.id, targetId: u3.id, dayNumber: game.dayNumber, phase: "voting", timestamp: Date.now() })
  gameActions.timeline.push({ type: type => "vote", voterId: u2.id, targetId: u1.id, dayNumber: game.dayNumber, phase: "voting", timestamp: Date.now() })
  gameActions.timeline.push({ type: "vote", voterId: u3.id, targetId: u1.id, dayNumber: game.dayNumber, phase: "voting", timestamp: Date.now() })
  gameActions.timeline.push({ type: "vote", voterId: u4.id, targetId: u1.id, dayNumber: game.dayNumber, phase: "voting", timestamp: Date.now() })

  // Resolve voting
  const voteResult = resolveVoting(gameState.votes)
  console.log("Voting resolved. Eliminated:", voteResult.eliminated, "| Tie:", voteResult.tie)

  if (voteResult.eliminated !== u1.id) {
    throw new Error(`Simulation failed: Don (u1) should be eliminated, got ${voteResult.eliminated}`)
  }

  // Update Don't isAlive inside state to false
  const eliminatedPlayer = game.players.find(p => p.userId === voteResult.eliminated)!
  const elimState = eliminatedPlayer.state as any
  elimState.isAlive = false
  await prisma.gamePlayer.update({
    where: { id: eliminatedPlayer.id },
    data: { state: elimState },
  })

  // Win check
  const afterVotePlayers = await prisma.gamePlayer.findMany({
    where: { gameId: game.id }
  })
  const winner = checkWin(afterVotePlayers)
  console.log("Win check result after vote:", winner)

  if (winner !== "citizens") {
    throw new Error(`Simulation failed: Citizens should win since Don was the only mafia, got ${winner}`)
  }

  // End Game session
  await prisma.gameSession.update({
    where: { id: game.id },
    data: { status: "finished" },
  })
  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: "finished" },
  })

  // Save Game Results
  const resultsData = afterVotePlayers.map((p) => {
    const isMafiaTeam = p.role === "mafia" || p.role === "don"
    const isWin = (winner === "mafia" && isMafiaTeam) || (winner === "citizens" && !isMafiaTeam)
    return {
      gameId: game!.id,
      userId: p.userId,
      gameType: "mafia",
      result: isWin ? "win" : "lose",
      stats: { role: p.role },
    }
  })
  await prisma.gameResult.createMany({ data: resultsData })

  console.log("Simulation finished successfully! Citizens win, Don eliminated.")
}

async function runWhoAmISimulation() {
  console.log("\n==========================================")
  console.log("STARTING WHO AM I SIMULATION")
  console.log("==========================================")

  const users = await getOrCreateTestUsers()
  const u1 = users[0]
  const u2 = users[1]

  // Create Lobby
  console.log("1. Creating Lobby...")
  const lobby = await prisma.lobby.create({
    data: {
      name: "Test Who Am I Lobby",
      gameType: "whoami",
      maxPlayers: 2,
      ownerId: u1.id,
      players: {
        create: [
          { userId: u1.id, number: 1, isReady: true },
          { userId: u2.id, number: 2, isReady: true },
        ],
      },
    },
    include: { players: true },
  })

  // Start Session
  console.log("2. Starting Who Am I Game Session...")
  const turnOrder = [u1.id, u2.id]
  const session = await prisma.gameSession.create({
    data: {
      lobbyId: lobby.id,
      gameType: "whoami",
      status: "writing",
      phase: "submit_words",
      dayNumber: 0,
      settings: {},
      actions: {
        submittedWords: {},
        assignments: {},
        turnOrder: turnOrder,
        currentTurnIndex: 0,
        answers: {},
        winners: [],
        gameLog: [],
      },
    },
  })

  await prisma.gamePlayer.createMany({
    data: lobby.players.map(p => ({
      userId: p.userId,
      gameId: session.id,
      role: "player",
      number: p.number,
      state: {},
      personal: {},
    })),
  })

  console.log("Who Am I Game session and players initialized with JSON support.")

  // Simulate Word submission
  console.log("3. Submitting words...")
  const game = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { players: true },
  })
  if (!game) throw new Error("Game not found")

  const actions = game.actions as any
  actions.submittedWords[u1.id] = "Spider-Man"
  actions.submittedWords[u2.id] = "Batman"

  await prisma.gameSession.update({
    where: { id: game.id },
    data: { actions },
  })

  console.log("Words submitted successfully. Game Session actions updated.")
}

async function run() {
  try {
    await cleanDatabase()
    await run4PlayerMafiaSimulation()
    await runWhoAmISimulation()
    console.log("\nALL SIMULATIONS COMPLETED SUCCESSFULLY! \u2705")
    process.exit(0)
  } catch (error) {
    console.error("Simulation failed with error:", error)
    process.exit(1)
  }
}

run()
