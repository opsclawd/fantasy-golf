import type { Entry } from '../supabase/types'

export type GolferStatus = 'active' | 'withdrawn' | 'cut'

export interface PlayerRoundScore {
  golferId: string
  roundId: number
  scoreToPar: number | null
  strokes: number | null
  status: GolferStatus
  birdies: number
}

export type PerGolferRounds = Map<string, PlayerRoundScore[]>

export interface EntryScoreAccumulator {
  totalScore: number
  totalBirdies: number
}

export interface EntryLeaderboardSummary extends Entry {
  totalScore: number
  totalBirdies: number
  rank: number
}

export function computeEntryScore(
  perGolferRounds: PerGolferRounds,
  golferIds: string[],
  completedRounds: number
): EntryScoreAccumulator {
  let totalScore = 0
  let totalBirdies = 0

  for (let roundNum = 1; roundNum <= completedRounds; roundNum++) {
    let bestScoreToPar: number | null = null
    let roundBirdies = 0

    for (const golferId of golferIds) {
      const rounds = perGolferRounds.get(golferId)
      if (!rounds) continue

      const round = rounds.find((r) => r.roundId === roundNum)
      if (!round) continue
      if (round.status === 'withdrawn' || round.status === 'cut') continue

      if (round.scoreToPar !== null && (bestScoreToPar === null || round.scoreToPar < bestScoreToPar)) {
        bestScoreToPar = round.scoreToPar
      }
      roundBirdies += round.birdies
    }

    if (bestScoreToPar !== null) {
      totalScore += bestScoreToPar
    }
    totalBirdies += roundBirdies
  }

  return { totalScore, totalBirdies }
}

export function deriveCompletedRounds(allScores: PlayerRoundScore[]): number {
  const rounds = allScores
    .map((score) => score.roundId)
    .filter((roundId): roundId is number => Number.isFinite(roundId))
  return rounds.length > 0 ? Math.max(...rounds) : 0
}

export function rankEntriesDomain(
  entries: Entry[],
  perGolferRounds: PerGolferRounds,
  completedRounds: number
): EntryLeaderboardSummary[] {
  const withScores = entries.map((entry) => {
    const { totalScore, totalBirdies } = computeEntryScore(
      perGolferRounds,
      entry.golfer_ids,
      completedRounds
    )
    return {
      ...entry,
      totalScore,
      totalBirdies,
    }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return a.totalScore - b.totalScore
    }
    return b.totalBirdies - a.totalBirdies
  })

  const ranked: EntryLeaderboardSummary[] = []
  for (let i = 0; i < withScores.length; i++) {
    let rank: number
    if (
      i > 0 &&
      withScores[i].totalScore === withScores[i - 1].totalScore &&
      withScores[i].totalBirdies === withScores[i - 1].totalBirdies
    ) {
      rank = ranked[i - 1].rank
    } else {
      rank = i + 1
    }
    ranked.push({ ...withScores[i], rank })
  }
  return ranked
}
