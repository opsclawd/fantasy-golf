import type { TournamentScore, GolferStatus } from './supabase/types'
import { getHoleScore } from './scoring'

export interface HoleResult {
  hole: number
  score: number | null
}

export interface GolferScorecard {
  golferId: string
  status: GolferStatus
  totalBirdies: number
  holes: HoleResult[]
  completedHoles: number
  totalScore: number
}

export function getGolferScorecard(score: TournamentScore): GolferScorecard {
  const holes: HoleResult[] = []
  let completedHoles = 0
  let totalScore = 0

  for (let i = 1; i <= 18; i++) {
    const holeScore = getHoleScore(score, i)
    holes.push({ hole: i, score: holeScore })
    if (holeScore !== null) {
      completedHoles = i
      totalScore += holeScore
    }
  }

  return {
    golferId: score.golfer_id,
    status: score.status,
    totalBirdies: score.total_birdies,
    holes,
    completedHoles,
    totalScore,
  }
}
