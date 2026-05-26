"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import styles from "./game.module.css"
import { GameChat } from "@/shared/components/GameChat/GameChat"

interface ChatMessage {
  id: string
  text: string
  type: "system" | "user" | "self"
}

type InvestigationMark = "R" | "G" | "B"

export default function GamePage() {
  const params = useParams()
  const sessionId = params?.sessionId as string
  const [state, setState] = useState<any>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("game")

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const prevStateRef = useRef<any>(null)

  const me = state?.players?.find((p: any) => p.userId === userId)
  const alivePlayers = state?.players?.filter((p: any) => p.isAlive) || []

  const phaseLabels: Record<string, string> = {
    mafia: "мафія обирає жертву",
    don: "дон шукає комісара",
    commissar: "комісар шукає мафію",
    doctor: "лікар рятує",
    discussion: "дискусія",
    nomination_defense: "виправдання",
    voting: "голосування",
    revote_defense: "повторні виправдання",
    night_kill_speech: "промова убитого вночі",
    voting_elim_speech: "промова вигнаного гравця",
  }

  let activeSpeaker: any = null
  if (state?.status === "day") {
    if (state.phase === "discussion") activeSpeaker = alivePlayers[state.currentSpeakerIndex || 0]
    else if (state.phase === "night_kill_speech" || state.phase === "voting_elim_speech") activeSpeaker = state.players?.find((p: any) => p.userId === state.nightKilledId)
    else if (state.phase === "single_elim_speech") activeSpeaker = state.players?.find((p: any) => p.userId === (state.nominations || [])[0])
    else if (state.phase === "nomination_defense") activeSpeaker = state.players?.find((p: any) => p.userId === (state.nominations || [])[state.nominationSpeakerIndex || 0])
  } else if (state?.status === "voting" && state.phase === "revote_defense") {
    activeSpeaker = state.players?.find((p: any) => p.userId === (state.revoteCandidates || [])[state.nominationSpeakerIndex || 0])
  }

  // Chat Logging Logic (System Logs)
  useEffect(() => {
    if (!state) return
    const prev = prevStateRef.current
    const newLogs: string[] = []

    if (!prev || prev.phase !== state.phase || prev.status !== state.status) {
      const statusText = state.status === "night" ? `Ніч ${state.dayNumber}` : `День ${state.dayNumber}`
      const phaseText = phaseLabels[state.phase] || state.phase
      newLogs.push(`--- ${statusText}: ${phaseText} ---`)
    }

    if (activeSpeaker && (!prev || prev.activeSpeakerId !== activeSpeaker.userId)) {
      newLogs.push(`Слово має гравець №${activeSpeaker.number ?? getPlayerNumber(activeSpeaker.userId)} (${activeSpeaker.user.username})`)
    }

    if (state.nominations?.length > (prev?.nominations?.length || 0)) {
      const latestId = state.nominations[state.nominations.length - 1]
      const player = state.players.find((p: any) => p.userId === latestId)
      if (player) {
        newLogs.push(`Гравця №${player.number ?? getPlayerNumber(player.userId)} (${player.user.username}) номіновано на голосування`)
      }
    }

    state.players.forEach((p: any, idx: number) => {
      const prevP = prev?.players?.find((x: any) => x.userId === p.userId)
      if (prevP && prevP.isAlive && !p.isAlive) {
        newLogs.push(`Гравець №${p.number ?? getPlayerNumber(p.userId)} (${p.user.username}) залишає гру 💀`)
      }
    })

    if (newLogs.length > 0) {
      setChatMessages(prev => [
        ...prev,
        ...newLogs.map(text => ({ id: Math.random().toString(36), text, type: "system" as const }))
      ])
    }

    prevStateRef.current = { ...state, activeSpeakerId: activeSpeaker?.userId }
  }, [state, activeSpeaker])

  const myChecks =
    role === "commissar"
      ? state?.commissarChecks?.filter((c: any) => c.by === userId) || []
      : role === "don"
        ? state?.donChecks?.filter((c: any) => c.by === userId) || []
        : []
  const myCheckedPlayers = Array.isArray(me?.checkedPlayers) ? me.checkedPlayers : []
  const selfHealUsed = (me?.healsUsed || 0) > 0

  let hasActedThisPhase = false
  if (state?.status === "voting") {
    hasActedThisPhase = false
  } else if (state?.status === "night") {
    if (state.phase === "mafia" && (role === "mafia" || role === "don")) {
      hasActedThisPhase = !!state.mafiaVotes?.[userId as string]
    } else if (state.phase === "don" && role === "don") {
      hasActedThisPhase = !!state.currentNightDonCheck
    } else if (state.phase === "commissar" && role === "commissar") {
      hasActedThisPhase = !!state.currentNightCommissarCheck
    } else if (state.phase === "doctor" && role === "doctor") {
      hasActedThisPhase = !!state.currentHeal
    }
  }

  const [actedLocally, setActedLocally] = useState(false)
  const [hasNominatedDay, setHasNominatedDay] = useState(false)
  const [hasVotedDay, setHasVotedDay] = useState(false)

  useEffect(() => {
    setActedLocally(false)
    setHasNominatedDay(false)
    setHasVotedDay(false)
  }, [state?.phase, state?.currentSpeakerIndex])

  const canAct = !hasActedThisPhase && !actedLocally

  // timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isActiveNightRole =
    state?.status === "night" && (
      (state.phase === "mafia" && (role === "mafia" || role === "don")) ||
      (state.phase === "don" && role === "don") ||
      (state.phase === "commissar" && role === "commissar") ||
      (state.phase === "doctor" && role === "doctor")
    )

  const getTimerDuration = (): number => state?.phaseDuration || 30

  const shouldShowTimer = !!(state && (
    state.status === "day" ||
    state.status === "voting" ||
    (state.status === "night" && isActiveNightRole)
  ))

  const shouldRunTimer = !!(state?.phaseStartedAt && (
    state.status === "day" ||
    state.status === "voting" ||
    state.status === "night"
  ))

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!shouldRunTimer || !state?.phaseStartedAt) {
      setTimeLeft(null)
      return
    }
    const duration = getTimerDuration()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - state.phaseStartedAt) / 1000)
      setTimeLeft(Math.max(0, duration - elapsed))
    }
    tick()
    timerRef.current = setInterval(tick, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state?.phaseStartedAt, state?.status, state?.phase, shouldRunTimer])

  useEffect(() => {
    if (timeLeft !== 0) return
    if (!state) return
    if (pendingAction === "AUTO_NEXT") return

    setPendingAction("AUTO_NEXT")
    fetch("/api/game/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, auto: true }),
    })
  }, [timeLeft])

  useEffect(() => {
    setPendingAction(null)
  }, [state])

  useEffect(() => {
    fetch(`/api/game/role?sessionId=${sessionId}`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setRole(data.role))
  }, [])

  useEffect(() => {
    fetch(`/api/game/state?sessionId=${sessionId}`)
      .then(res => res.json())
      .then(data => setState(data))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/game/state?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => setState(data))
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId])

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.json())
      .then(data => setUserId(data.user.id))
  }, [])

  if (!state || !state.players) return <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження стану гри...</div>
  if (!me) return <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження гравців...</div>

  const getPhaseDetail = () => {
    if (activeSpeaker) {
      if (state.phase === "nomination_defense" || state.phase === "revote_defense") {
        return `Виправдання гравця №${activeSpeaker.number ?? getPlayerNumber(activeSpeaker.userId)}`
      }
      return `Промова гравця №${activeSpeaker.number ?? getPlayerNumber(activeSpeaker.userId)}`
    }
    return ""
  }

  const handleAction = (type: string, targetId: string) => {
    setPendingAction(targetId)
    setActedLocally(true)
    fetch("/api/game/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, actionType: type, targetId }),
    })
  }

  const handleNominate = (targetId: string) => {
    setPendingAction(targetId)
    setHasNominatedDay(true)
    fetch("/api/game/nominate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetId }),
    })
  }

  const handleVote = (targetId: string) => {
    setPendingAction(targetId)
    setHasVotedDay(true)
    fetch("/api/game/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetId }),
    })
  }

  const handleInvestigationChange = async (targetUserId: string, mark: InvestigationMark) => {
    if (!me?.isAlive) return
    if (targetUserId === userId) return

    setState((prev: any) => {
      if (!prev) return prev

      return {
        ...prev,
        players: prev.players.map((p: any) => {
          if (p.userId !== userId) return p

          return {
            ...p,
            investigation: {
              ...(p.investigation || {}),
              [targetUserId]: mark,
            },
          }
        }),
      }
    })

  try {
    const res = await fetch("/api/game/investigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId,
        targetUserId,
        mark,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      console.error("Failed to save investigation:", data.error || res.statusText)
    }
  } catch (error) {
    console.error("Failed to save investigation:", error)
  }
}

  const getPlayerNumber = (playerId: string) => {
    return state.players.find((p: any) => p.userId === playerId)?.number ?? "?"
  }
  
  const isDiscussion = state.phase === "discussion"

  const isFinished = state.status === "finished"

  const getWinnerLabel = () => {
    const winnerTeam =
      state.winner ||
      state.state?.winner ||
      state.winnerTeam ||
      state.state?.winnerTeam

    if (winnerTeam === "mafia" || winnerTeam === "Мафія") {
      return "Перемогла Мафія"
    }

    if (winnerTeam === "citizens" || winnerTeam === "Мирне місто") {
      return "Перемогло Мирне місто"
    }

    const aliveMafia = state.players?.some(
      (p: any) => p.isAlive && (p.role === "mafia" || p.role === "don")
    )

    return aliveMafia ? "Перемогла Мафія" : "Перемогло Мирне місто"
  }

  const renderRoleSticker = (
    pRole: string,
    isCheck: boolean = false,
    checkType: "commissar" | "don" = "commissar"
  ) => {
    let label = ""
    let color = ""

    if (isCheck) {
      if (checkType === "don") {
        if (pRole === "commissar") {
          label = "Комісар"
          color = "var(--role-commissar)"
        } else {
          label = "Мирний громадянин"
          color = "var(--role-citizen)"
        }
      } else {
        if (pRole === "mafia" || pRole === "don") {
          label = "Мафія"
          color = "var(--role-mafia)"
        } else {
          label = "Мирний громадянин"
          color = "var(--role-citizen)"
        }
      }
    } else {
      switch (pRole) {
        case "citizen": label = "Мирний громадянин"; color = "var(--role-citizen)"; break;
        case "mafia": label = "Мафія"; color = "var(--role-mafia)"; break;
        case "don": label = "Дон"; color = "var(--role-mafia)"; break;
        case "commissar": label = "Комісар"; color = "var(--role-commissar)"; break;
        case "doctor": label = "Лікар"; color = "var(--role-doctor)"; break;
        default: label = pRole; color = "var(--moon-text)";
      }
    }

    return (
      <span className={styles.checkResult} style={{ color }}>
        {label}
      </span>
    )
  }

  const getInvestigationMark = (targetUserId: string): InvestigationMark => {
    const mark = me?.investigation?.[targetUserId]
    return mark === "R" || mark === "B" || mark === "G" ? mark : "G"
  }

  const getPlayerInvestigationMark = (ownerUserId: string, targetUserId: string): InvestigationMark => {
    const owner = state.players.find((p: any) => p.userId === ownerUserId)
    const mark = owner?.investigation?.[targetUserId]
    return mark === "R" || mark === "B" || mark === "G" ? mark : "G"
  }

  const getInvestigationClass = (mark: InvestigationMark) => {
    if (mark === "R") return styles.investigationRed
    if (mark === "B") return styles.investigationBlack
    return styles.investigationGray
  }

  const investigationPlayers = state.players.filter((p: any) => p.userId !== userId)

  const activeSpeakerInvestigationPlayers = activeSpeaker
    ? state.players.filter((p: any) => p.userId !== activeSpeaker.userId)
    : []

  return (
    <div className={styles.container}>
      {/* 1. Info Bar */}
      <div className={styles.infoBar}>
        <div className={styles.sticker}>
          {isFinished ? "Кінець гри" : `${state.status === "night" ? "№ Ніч" : "№ День"} ${state.dayNumber}`}
        </div>

        <div className={styles.phaseIcon}>
          {isFinished ? "🏁" : state.status === "night" ? "🌙" : "☀️"}
        </div>

        <div className={styles.phaseLabel}>
          {isFinished ? getWinnerLabel() : phaseLabels[state.phase] || state.phase}
        </div>

        <div className={styles.phaseDetail}>
          {!isFinished && getPhaseDetail()}

          {!isFinished && shouldShowTimer && timeLeft !== null && (
            <span style={{ marginLeft: "10px", color: timeLeft <= 5 ? "#ef4444" : "var(--moon-accent)", fontWeight: "bold" }}>
              ⏱️ {timeLeft}s
            </span>
          )}

          {!isFinished && activeSpeaker?.userId === userId && (
            <button
              className={styles.actionButton}
              style={{ marginLeft: "15px", width: "auto", padding: "4px 12px", background: "var(--moon-surface-light)", fontSize: "0.75rem" }}
              onClick={() => fetch("/api/game/next", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) })}
            >
              Закінчити промову
            </button>
          )}
        </div>
      </div>

      {/* 2. Tabs */}
      <div className={styles.tabsContainer}>
        <div className={`${styles.tab} ${activeTab === "game" ? styles.activeTab : ""}`} onClick={() => setActiveTab("game")}>Гра</div>
        <div className={`${styles.tab} ${activeTab === "webcams" ? styles.activeTab : ""}`} onClick={() => setActiveTab("webcams")}>Вебкамери</div>
        <div className={`${styles.tab} ${activeTab === "investigation" ? styles.activeTab : ""}`} onClick={() => setActiveTab("investigation")}>Розслідування</div>
      </div>

      {/* 3. Chat Toggle */}
      <button
        className={styles.chatToggleBtn}
        onClick={() => setIsChatCollapsed(!isChatCollapsed)}
      >
        {isChatCollapsed ? "◀" : "▶"}
      </button>

      <div className={styles.mainLayout}>
        <div className={styles.gameArea}>
          {activeTab === "game" && (
            <div className={styles.gameColumns}>
              {/* Players Grid */}
              <div className={styles.playersColumn}>
                <div className={`${styles.playerCardsGrid} ${isDiscussion ? styles.discussionGrid : ""}`}>
                  {state.players.map((p: any, index: number) => {
                    const isNominated = (state.status === "day" || state.status === "voting") && (state.nominations || []).includes(p.userId)
                    const isSpeaking = activeSpeaker?.userId === p.userId
                    const isMyTeammate = (role === "mafia" || role === "don") && (p.role === "mafia" || p.role === "don") && p.userId !== userId
                    const myCheck = myChecks.find((c: any) => c.targetId === p.userId)

                    const canKill = !isFinished && state.status === "night" && state.dayNumber > 1 && state.phase === "mafia" && p.isAlive && (role === "mafia" || role === "don") && me?.isAlive && canAct
                    const canDonCheck = !isFinished && state.status === "night" && state.dayNumber > 1 && state.phase === "don" && role === "don" && p.isAlive && me?.isAlive && canAct && p.userId !== userId && !["mafia", "don"].includes(p.role) && !myCheckedPlayers.includes(p.userId)
                    const canCommissarCheck = !isFinished && state.status === "night" && state.dayNumber > 1 && state.phase === "commissar" && role === "commissar" && p.isAlive && me?.isAlive && canAct && !myCheckedPlayers.includes(p.userId) && p.userId !== userId
                    const canHeal = !isFinished && state.status === "night" && state.dayNumber > 1 && state.phase === "doctor" && role === "doctor" && p.isAlive && me?.isAlive && canAct && p.userId !== state.lastHeal && !(p.userId === userId && selfHealUsed)
                    const canNominate = !isFinished && state.status === "day" && state.dayNumber > 1 && state.phase === "discussion" && p.isAlive && p.userId !== userId && activeSpeaker?.userId === userId && !hasNominatedDay && !(state.nominations || []).includes(p.userId)
                    const canVote = !isFinished && state.status === "voting" && p.isAlive && me?.isAlive && !hasVotedDay && userId && !state.votes?.[userId] && ((state.phase === "voting" && (state.nominations || []).includes(p.userId)) || (state.phase === "revote" && (state.revoteCandidates || []).includes(p.userId)))

                    let cardClass = styles.playerCard
                    if (!p.isAlive) cardClass += ` ${styles.dead}`
                    else if (isSpeaking) cardClass += ` ${styles.speaking}`
                    else cardClass += ` ${styles.alive}`

                    return (
                      <div key={p.userId} className={cardClass}>
                        <div className={styles.cardSticker}>№ {p.number ?? index + 1}</div>
                        {isNominated && <div className={styles.nominationSticker}>!</div>}

                        <div className={styles.avatarWrapper}>
                          <img src={p.user?.avatarUrl || "/default_user.png"} alt="avatar" className={styles.avatarImage} />
                        </div>

                        <div className={styles.nickname}>
                          {p.user.username}
                        </div>

                        <div className={styles.cardPlaceholders}>
                          <div className={`${styles.placeholder} ${styles.statusPlaceholder}`}>
                            {isSpeaking && (
                              state.phase === "discussion" ? "" :
                                state.phase === "nomination_defense" || state.phase === "revote_defense" ? "виправдання" :
                                  state.phase === "night_kill_speech" || state.phase === "voting_elim_speech" ? "остання промова" : "🎤"
                            )}
                          </div>

                          <div className={styles.placeholder}>
                            {canKill && <button className={`${styles.actionButton} ${styles.killBtn}`} onClick={() => handleAction("kill", p.userId)}>Убити</button>}
                            {canDonCheck && <button className={`${styles.actionButton} ${styles.checkBtn}`} onClick={() => handleAction("check", p.userId)}>Перевірити</button>}
                            {canCommissarCheck && <button className={`${styles.actionButton} ${styles.checkBtn}`} onClick={() => handleAction("check", p.userId)}>Перевірити</button>}
                            {canHeal && <button className={`${styles.actionButton} ${styles.healBtn}`} onClick={() => handleAction("heal", p.userId)}>Лікувати</button>}
                            {canNominate && <button className={`${styles.actionButton} ${styles.nominateBtn}`} onClick={() => handleNominate(p.userId)}>Номінувати</button>}
                            {canVote && <button className={`${styles.actionButton} ${styles.voteBtn}`} onClick={() => handleVote(p.userId)}>Голосувати</button>}
                          </div>

                          <div className={styles.placeholder}>
                            {isFinished && p.role && renderRoleSticker(p.role)}
                            {!isFinished && p.userId === userId && p.role && renderRoleSticker(p.role)}
                            {!isFinished && isMyTeammate && p.role && renderRoleSticker(p.role)}
                            {!isFinished && myCheck && renderRoleSticker(myCheck.result, true, role === "don" ? "don" : "commissar")}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Investigation Sidebar */}
              {isDiscussion && (
                <div className={styles.investigationColumn}>
                  <div className={styles.investigationArea}>
                    <div className={styles.investigationTitle}>🔍 Розслідування спікера</div>

                    {activeSpeaker ? (
                      <>
                        <div className={styles.speakerInvestigationHeader}>
                          <img
                            src={activeSpeaker.user?.avatarUrl || "/default_user.png"}
                            alt="avatar"
                            className={styles.speakerInvestigationAvatar}
                          />
                          <div>
                            <div className={styles.speakerInvestigationName}>
                              № {activeSpeaker.number ?? getPlayerNumber(activeSpeaker.userId)} {activeSpeaker.user?.username}
                            </div>
                            <div className={styles.speakerInvestigationSubtext}>
                              Позначки цього гравця на момент поточної дискусії
                            </div>
                          </div>
                        </div>

                        <div className={styles.speakerInvestigationList}>
                          {activeSpeakerInvestigationPlayers.map((p: any) => {
                            const mark = getPlayerInvestigationMark(activeSpeaker.userId, p.userId)

                            return (
                              <div
                                key={p.userId}
                                className={`${styles.speakerInvestigationItem} ${getInvestigationClass(mark)} ${!p.isAlive ? styles.investigationDead : ""}`}
                              >
                                <div className={styles.speakerInvestigationPlayer}>
                                  <img
                                    src={p.user?.avatarUrl || "/default_user.png"}
                                    alt="avatar"
                                    className={styles.speakerInvestigationSmallAvatar}
                                  />
                                  <span>
                                    № {p.number ?? getPlayerNumber(p.userId)} {p.user?.username}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <div className={styles.investigationPlaceholder}>
                        Очікування активного спікера...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "webcams" && <div style={{ textAlign: "center", padding: "3rem", color: "var(--moon-text-dim)" }}>Вебкамери будуть доступні незабаром...</div>}
          {activeTab === "investigation" && (
            <div className={styles.fullInvestigationArea}>
              <div className={styles.investigationHeader}>
                <div>
                  <h2 className={styles.investigationPageTitle}>Персональне розслідування</h2>
                  <p className={styles.investigationDescription}>
                    Позначай гравців власними підозрами. Ці позначки бачиш тільки ти.
                  </p>
                </div>
                {!me?.isAlive && (
                  <div className={styles.investigationReadonlyBadge}>
                    Мертвий гравець може тільки переглядати розслідування
                  </div>
                )}
              </div>

              <div className={styles.investigationCardsGrid}>
                {investigationPlayers.map((p: any) => {
                  const mark = getInvestigationMark(p.userId)

                  return (
                    <div
                      key={p.userId}
                      className={`${styles.investigationCard} ${getInvestigationClass(mark)} ${!p.isAlive ? styles.investigationDead : ""}`}
                    >
                      <div className={styles.investigationNumber}>№ {p.number}</div>

                      <img
                        src={p.user?.avatarUrl || "/default_user.png"}
                        alt="avatar"
                        className={styles.investigationAvatar}
                      />

                      <div className={styles.investigationName}>
                        {p.user?.username}
                      </div>

                      <div className={styles.investigationButtons}>
                        <button
                          type="button"
                          className={`${styles.investigationMarkButton} ${styles.markRed}`}
                          disabled={!me?.isAlive}
                          onClick={() => handleInvestigationChange(p.userId, "R")}
                          aria-label="Позначити червоним"
                        />
                        <button
                          type="button"
                          className={`${styles.investigationMarkButton} ${styles.markGray}`}
                          disabled={!me?.isAlive}
                          onClick={() => handleInvestigationChange(p.userId, "G")}
                          aria-label="Позначити сірим"
                        />
                        <button
                          type="button"
                          className={`${styles.investigationMarkButton} ${styles.markBlack}`}
                          disabled={!me?.isAlive}
                          onClick={() => handleInvestigationChange(p.userId, "B")}
                          aria-label="Позначити чорним"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dev skip button */}
          <button
            className={styles.actionButton}
            style={{ width: "auto", padding: "0.5rem 2rem", background: "var(--moon-surface-light)", alignSelf: "flex-start", marginTop: "2rem" }}
            onClick={() => fetch("/api/game/next", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) })}
          >
            Next Phase
          </button>
        </div>

        {/* 4. Chat Sidebar */}
        <div className={`${styles.chatSidebar} ${isChatCollapsed ? styles.chatCollapsed : ""}`}>
          <GameChat
            sessionId={sessionId}
            logs={chatMessages}
            user={{ ...me.user, id: userId }}
            isAlive={!!me?.isAlive}
            role={role}
            gameState={state}
          />
        </div>
      </div>
    </div>
  )
}