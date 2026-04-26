import { rankEntries as domainRankEntries, deriveCompletedRounds as domainDeriveCompletedRounds } from './scoring/domain'
import type { GolferRoundScoresMap } from './scoring/domain'
import { TournamentScore, TournamentHole, Entry, GolferStatus } from './supabase/types'

export function getRoundScore(score: TournamentScore): number | null {
  if (typeof score.total_score === 'number') return score.total_score
  return null
}

export function calculateEntryTotalScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  _completedRounds: number
): number {
  const scores = golferIds
    .map((id) => golferScores.get(id))
    .filter((score): score is TournamentScore => Boolean(score))
    .map(getRoundScore)
    .filter((score): score is number => score !== null)

  return scores.length > 0 ? Math.min(...scores) : 0
}

export function getEntryRoundScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[]
): number | null {
  const scores: number[] = []

  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (!golferScore) continue
    if (golferScore.status === 'withdrawn' || golferScore.status === 'cut') continue
    const roundScore = getRoundScore(golferScore)
    if (roundScore === null) continue
    scores.push(roundScore)
  }

  return scores.length > 0 ? Math.min(...scores) : null
}

export function calculateEntryBirdies(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[]
): number {
  let totalBirdies = 0
  
  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (golferScore) {
      totalBirdies += golferScore.total_birdies || 0
    }
  }
  
  return totalBirdies
}

export function deriveCompletedRounds(allScores: TournamentScore[]): number {
  return domainDeriveCompletedRounds(allScores)
}

export function buildGolferRoundScoresMap(
  holesByGolfer: Map<string, TournamentHole[]>,
  golferStatuses: Map<string, GolferStatus>
): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()

  Array.from(holesByGolfer.entries()).forEach(([golferId, holes]) => {
    const rounds: { holeId: number; roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[] = holes.map(hole => ({
      roundId: hole.round_id,
      holeId: hole.hole_id,
      scoreToPar: hole.score_to_par,
      status: golferStatuses.get(golferId) ?? 'active',
      isComplete: true,
    }))
    result.set(golferId, rounds)
  })

  return result
}

function buildGolferRoundScoresMapFromScores(tournamentScores: Map<string, TournamentScore>): GolferRoundScoresMap {
  const result: GolferRoundScoresMap = new Map()
  Array.from(tournamentScores.entries()).forEach(([golferId, score]) => {
    result.set(golferId, [{
      roundId: score.round_id ?? 1,
      scoreToPar: score.total_score ?? null,
      status: score.status,
      isComplete: true,
    }])
  })
  return result
}

export function rankEntries(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {
  const golferRoundScoresMap = buildGolferRoundScoresMapFromScores(golferScores)
  return domainRankEntries(entries, golferRoundScoresMap, completedRounds) as (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[]
}

export function rankEntriesLegacy(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedRounds: number
): (Entry & { totalScore: number; totalBirdies: number; rank: number })[] {
  const withScores = entries.map(entry => {
    const totalScore = calculateEntryTotalScore(golferScores, entry.golfer_ids, completedRounds)
    const totalBirdies = calculateEntryBirdies(golferScores, entry.golfer_ids)
    return { ...entry, totalScore, totalBirdies }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return a.totalScore - b.totalScore
    }
    return b.totalBirdies - a.totalBirdies
  })

  const ranked: (Entry & { totalScore: number; totalBirdies: number; rank: number })[] = []
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

export function rankEntriesWithHoles(
  entries: Entry[],
  holesByGolfer: Map<string, TournamentHole[]>,
  golferStatuses: Map<string, GolferStatus>,
  completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {
  const golferRoundScoresMap = buildGolferRoundScoresMap(holesByGolfer, golferStatuses)
  return domainRankEntries(entries, golferRoundScoresMap, completedRounds) as (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[]
}