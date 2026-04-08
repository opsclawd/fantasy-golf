import { TournamentScore, Entry } from './supabase/types'

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
