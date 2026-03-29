import type { TournamentScore, GolferStatus } from './supabase/types'
import { getHoleScore, getEntryHoleScore } from './scoring'

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

export interface HoleContribution {
  hole: number
  golferScore: number | null
  bestBallScore: number | null
  isContributing: boolean
}

export interface GolferContribution {
  golferId: string
  isWithdrawn: boolean
  holes: HoleContribution[]
  totalContributingHoles: number
}

export function getGolferContribution(
  golferId: string,
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>
): GolferContribution {
  const golferScore = golferScores.get(golferId)
  const isWithdrawn = golferScore?.status === 'withdrawn' || golferScore?.status === 'cut'

  const holes: HoleContribution[] = []
  let totalContributingHoles = 0

  for (let i = 1; i <= 18; i++) {
    const golferHoleScore = golferScore ? getHoleScore(golferScore, i) : null
    const bestBallScore = getEntryHoleScore(golferScores, entryGolferIds, i)

    const isContributing =
      !isWithdrawn &&
      golferHoleScore !== null &&
      bestBallScore !== null &&
      golferHoleScore === bestBallScore

    if (isContributing) totalContributingHoles++

    holes.push({
      hole: i,
      golferScore: golferHoleScore,
      bestBallScore,
      isContributing,
    })
  }

  return {
    golferId,
    isWithdrawn,
    holes,
    totalContributingHoles,
  }
}
