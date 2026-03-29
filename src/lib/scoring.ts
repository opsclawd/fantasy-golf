import { TournamentScore, Entry } from './supabase/types'

export function getHoleScore(score: TournamentScore, hole: number): number | null {
  const key = `hole_${hole}` as keyof TournamentScore
  return score[key] as number | null
}

export function getEntryHoleScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  hole: number
): number | null {
  const scores: number[] = []
  let hasActiveGolferWithoutScore = false

  for (const id of golferIds) {
    const golferScore = golferScores.get(id)

    // Golfer not in scores map at all — no data received yet
    if (!golferScore) {
      hasActiveGolferWithoutScore = true
      continue
    }

    // Skip withdrawn/cut golfers entirely — they don't contribute to best-ball
    if (golferScore.status === 'withdrawn' || golferScore.status === 'cut') continue

    const holeScore = getHoleScore(golferScore, hole)
    if (holeScore === null) {
      hasActiveGolferWithoutScore = true
      continue
    }
    scores.push(holeScore)
  }

  // If we collected at least one valid score, use it (best ball among available)
  if (scores.length > 0) return Math.min(...scores)

  // No scores at all — either all withdrawn or no data
  return null
}

export function calculateEntryTotalScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  completedHoles: number
): number {
  let total = 0
  
  for (let hole = 1; hole <= completedHoles; hole++) {
    const holeScore = getEntryHoleScore(golferScores, golferIds, hole)
    if (holeScore === null) break
    total += holeScore
  }
  
  return total
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

export function rankEntries(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedHoles: number
): (Entry & { totalScore: number; totalBirdies: number; rank: number })[] {
  const withScores = entries.map(entry => {
    const totalScore = calculateEntryTotalScore(golferScores, entry.golfer_ids, completedHoles)
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
