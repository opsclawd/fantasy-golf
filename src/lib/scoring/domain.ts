import type { GolferStatus, Entry } from '@/lib/supabase/types'

export interface PlayerHoleScore {
  golferId: string
  roundId: number
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}

export interface EntryHoleResult {
  roundId: number
  bestBallScore: number | null
  isComplete: boolean
}

export interface EntryScoreAccumulator {
  totalScore: number | null
  totalBirdies: number
  completedHoles: number
  activeGolferIds: string[]
}

export interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number
  rank: number
  isTied: boolean
}

export type GolferRoundScoresMap = Map<string, PlayerHoleScore[]>

export function isActiveGolfer(status: GolferStatus): boolean {
  return status === 'active'
}

export function isBirdie(scoreToPar: number): boolean {
  return scoreToPar <= -1
}

export function computeEntryScore(
  golferRoundScores: GolferRoundScoresMap,
  activeGolferIds: string[]
): EntryScoreAccumulator {
  let totalScore: number | null = 0
  let totalBirdies = 0
  let completedHoles = 0

  const activeSet = new Set(activeGolferIds)

  const roundScoresByRound = new Map<number, { scoreToPar: number | null; isComplete: boolean; golferId: string }[]>()

  for (const [golferId, rounds] of golferRoundScores) {
    if (!activeSet.has(golferId)) continue

    for (const round of rounds) {
      if (!roundScoresByRound.has(round.roundId)) {
        roundScoresByRound.set(round.roundId, [])
      }
      roundScoresByRound.get(round.roundId)!.push({
        scoreToPar: round.scoreToPar,
        isComplete: round.isComplete,
        golferId,
      })
    }
  }

  const sortedRoundIds = Array.from(roundScoresByRound.keys()).sort((a, b) => a - b)

  const golfersActiveAtRound = new Map<number, Set<string>>()

  for (const roundId of sortedRoundIds) {
    const roundScores = roundScoresByRound.get(roundId)!
    const activeInThisRound = new Set<string>()
    for (const rs of roundScores) {
      const status = golferRoundScores.get(rs.golferId)?.find(r => r.roundId === roundId)?.status
      if (status === 'active') {
        activeInThisRound.add(rs.golferId)
      }
    }
    golfersActiveAtRound.set(roundId, activeInThisRound)
  }

  for (const roundId of sortedRoundIds) {
    const roundScores = roundScoresByRound.get(roundId)!
    const activeInThisRound = golfersActiveAtRound.get(roundId)!

    const allComplete = roundScores.every(r => {
      const golferRounds = golferRoundScores.get(r.golferId)
      const golferRound = golferRounds?.find(gr => gr.roundId === roundId)
      return golferRound?.isComplete ?? false
    })
    if (!allComplete) continue

    const scores: number[] = []
    for (const { scoreToPar, golferId } of roundScores) {
      if (scoreToPar === null) continue
      if (!activeInThisRound.has(golferId)) continue
      scores.push(scoreToPar)
    }

    if (scores.length === 0) continue

    const bestBall = Math.min(...scores)
    totalScore = (totalScore !== null ? totalScore : 0) + bestBall
    completedHoles++

    if (isBirdie(bestBall)) {
      totalBirdies++
    }
  }

  return {
    totalScore,
    totalBirdies,
    completedHoles,
    activeGolferIds,
  }
}

export function rankEntries(
  entries: Entry[],
  golferRoundScores: GolferRoundScoresMap,
  _completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {
  const withScores = entries.map(entry => {
    const scoreResult = computeEntryScore(golferRoundScores, entry.golfer_ids)
    return {
      ...entry,
      totalScore: scoreResult.totalScore,
      totalBirdies: scoreResult.totalBirdies,
    }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return (a.totalScore ?? Infinity) - (b.totalScore ?? Infinity)
    }
    return b.totalBirdies - a.totalBirdies
  })

  const ranked: (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] = []
  for (let i = 0; i < withScores.length; i++) {
    let rank: number
    let isTied = false

    if (
      i > 0 &&
      withScores[i].totalScore === withScores[i - 1].totalScore &&
      withScores[i].totalBirdies === withScores[i - 1].totalBirdies
    ) {
      rank = ranked[i - 1].rank
      isTied = true
    } else {
      rank = i + 1
    }
    ranked.push({ ...withScores[i], rank, isTied })
  }
  return ranked
}

export function deriveCompletedRounds(
  allScores: { round_id?: number | null }[]
): number {
  const rounds = allScores
    .map((score) => score.round_id)
    .filter((roundId): roundId is number => typeof roundId === 'number' && Number.isFinite(roundId))
  return rounds.length > 0 ? Math.max(...rounds) : 0
}