import type { GolferStatus, Entry } from '@/lib/supabase/types'

export interface PlayerHoleScore {
  holeId: number
  roundId: number
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}

export interface EntryHoleResult {
  holeId: number
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
  completedHoles: number
  rank: number
  isTied: boolean
}

export type GolferRoundScoresMap = Map<string, PlayerHoleScore[]>

export function isActiveGolfer(status: GolferStatus): boolean {
  return status === 'active'
}

export function isBirdie(scoreToPar: number): boolean {
  return scoreToPar < 0
}

export function computeEntryScore(
  golferRoundScores: GolferRoundScoresMap,
  activeGolferIds: string[]
): EntryScoreAccumulator {
  let totalScore: number | null = 0
  let totalBirdies = 0
  let completedHoles = 0

  const activeSet = new Set(activeGolferIds)

  const holesIndex = new Map<string, Array<{ golferId: string; scoreToPar: number | null; isComplete: boolean; status: GolferStatus }>>()

  for (const [golferId, rounds] of golferRoundScores) {
    for (const round of rounds) {
      const holeKey = `${round.roundId}-${round.holeId}`
      if (!holesIndex.has(holeKey)) {
        holesIndex.set(holeKey, [])
      }
      holesIndex.get(holeKey)!.push({
        golferId,
        scoreToPar: round.scoreToPar,
        isComplete: round.isComplete,
        status: round.status,
      })
    }
  }

  const roundCompleteness = new Map<number, boolean>()
  for (const [holeKey, entries] of holesIndex) {
    const roundId = parseInt(holeKey.split('-')[0])
    const allComplete = entries.every(e => e.isComplete)
    const current = roundCompleteness.get(roundId)
    roundCompleteness.set(roundId, current === undefined ? allComplete : current && allComplete)
  }

  const activeGolferHoleCounts = new Map<string, Set<string>>()
  for (const [holeKey, entries] of holesIndex) {
    for (const entry of entries) {
      if (!activeSet.has(entry.golferId)) continue
      if (!activeGolferHoleCounts.has(entry.golferId)) {
        activeGolferHoleCounts.set(entry.golferId, new Set())
      }
      activeGolferHoleCounts.get(entry.golferId)!.add(holeKey)
    }
  }

  const allHoleKeys = new Set<string>()
  for (const holeSet of activeGolferHoleCounts.values()) {
    for (const key of holeSet) {
      allHoleKeys.add(key)
    }
  }

  for (const [golferId, holeSet] of activeGolferHoleCounts) {
    if (holeSet.size !== allHoleKeys.size) {
      return {
        totalScore: null,
        totalBirdies: 0,
        completedHoles: 0,
        activeGolferIds,
      }
    }
  }

  for (const holeKey of allHoleKeys) {
    const entries = holesIndex.get(holeKey)
    if (!entries) continue
    const activeGolferIdsWithEntry = entries
      .filter(e => activeSet.has(e.golferId))
      .map(e => e.golferId)
    const hasAllActiveGolfers = activeGolferIdsWithEntry.length === activeGolferIds.length
    if (!hasAllActiveGolfers) {
      return {
        totalScore: null,
        totalBirdies: 0,
        completedHoles: 0,
        activeGolferIds,
      }
    }
  }

  for (const [holeKey, entries] of holesIndex) {
    const roundId = parseInt(holeKey.split('-')[0])

    if (!roundCompleteness.get(roundId)) continue

    const activeEntries = entries.filter(e => activeSet.has(e.golferId) && e.status === 'active')
    if (activeEntries.length === 0) continue

    const validScores = activeEntries
      .map(e => e.scoreToPar)
      .filter((s): s is number => s !== null)

    if (validScores.length === 0) continue

    const bestBall = Math.min(...validScores)
    totalScore = (totalScore !== null ? totalScore : 0) + bestBall
    completedHoles++

    if (isBirdie(bestBall)) totalBirdies++
  }

  return {
    totalScore: totalScore === 0 && completedHoles === 0 ? null : totalScore,
    totalBirdies,
    completedHoles,
    activeGolferIds,
  }
}

export function rankEntries(
  entries: Entry[],
  golferRoundScores: GolferRoundScoresMap,
  _completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; completedHoles: number; rank: number; isTied: boolean })[] {
  const withScores = entries.map(entry => {
    const scoreResult = computeEntryScore(golferRoundScores, entry.golfer_ids)
    return {
      ...entry,
      totalScore: scoreResult.totalScore,
      totalBirdies: scoreResult.totalBirdies,
      completedHoles: scoreResult.completedHoles,
    }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return (a.totalScore ?? Infinity) - (b.totalScore ?? Infinity)
    }
    return b.totalBirdies - a.totalBirdies
  })

  const ranked: (Entry & { totalScore: number | null; totalBirdies: number; completedHoles: number; rank: number; isTied: boolean })[] = []
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