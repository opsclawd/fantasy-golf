import type { TournamentScore, GolferStatus, Golfer, Entry } from './supabase/types'
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

export interface GolferSummary {
  golferId: string
  name: string
  country: string
  status: GolferStatus
  totalScore: number
  totalBirdies: number
  completedHoles: number
  contributingHoles: number
}

export function getEntryGolferSummaries(
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>,
  golfers: Golfer[]
): GolferSummary[] {
  const golferMap = new Map(golfers.map(g => [g.id, g]))

  return entryGolferIds.map(golferId => {
    const golfer = golferMap.get(golferId)
    const score = golferScores.get(golferId)

    const scorecard = score
      ? getGolferScorecard(score)
      : { completedHoles: 0, totalScore: 0, totalBirdies: 0, status: 'active' as GolferStatus }

    const contribution = getGolferContribution(golferId, entryGolferIds, golferScores)

    return {
      golferId,
      name: golfer?.name ?? golferId,
      country: golfer?.country ?? '',
      status: scorecard.status,
      totalScore: scorecard.totalScore,
      totalBirdies: score?.total_birdies ?? 0,
      completedHoles: scorecard.completedHoles,
      contributingHoles: contribution.totalContributingHoles,
    }
  })
}

export interface GolferPoolContext {
  totalEntries: number
  entriesWithGolfer: number
  entryIds: string[]
  pickRate: number
}

export function getGolferPoolContext(
  golferId: string,
  entries: Entry[]
): GolferPoolContext {
  const matchingEntries = entries.filter(e => e.golfer_ids.includes(golferId))

  return {
    totalEntries: entries.length,
    entriesWithGolfer: matchingEntries.length,
    entryIds: matchingEntries.map(e => e.id),
    pickRate: entries.length > 0 ? matchingEntries.length / entries.length : 0,
  }
}
