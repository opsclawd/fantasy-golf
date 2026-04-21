import { TournamentScore, Entry } from './supabase/types'
import {
  rankEntriesDomain,
  type PerGolferRounds,
  type PlayerRoundScore,
  type EntryLeaderboardSummary,
} from './scoring/domain'

function getRoundScore(score: TournamentScore): number | null {
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
  const rounds = allScores
    .map((score) => score.round_id)
    .filter((roundId): roundId is number => typeof roundId === 'number' && Number.isFinite(roundId))
  return rounds.length > 0 ? Math.max(...rounds) : 0
}

export function rankEntries(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedRounds: number
): EntryLeaderboardSummary[] {
  const perGolferRounds = buildPerGolferRoundsFromFlat(golferScores, completedRounds)
  return rankEntriesDomain(entries, perGolferRounds, completedRounds)
}

function buildPerGolferRoundsFromFlat(
  golferScores: Map<string, TournamentScore>,
  _completedRounds: number
): PerGolferRounds {
  const map = new Map<string, PlayerRoundScore[]>()
  
  Array.from(golferScores.entries()).forEach(([golferId, score]) => {
    if (score.round_id === null || !Number.isFinite(score.round_id)) return
    if (score.status === 'withdrawn' || score.status === 'cut') return
    
    const existing = map.get(golferId) || []
    existing.push({
      golferId,
      roundId: score.round_id as number,
      scoreToPar: score.total_score ?? null,
      strokes: null,
      status: score.status,
      birdies: score.total_birdies,
    })
    map.set(golferId, existing)
  })
  
  return map
}