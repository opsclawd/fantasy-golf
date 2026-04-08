import type { TournamentScore, GolferStatus, Entry } from './supabase/types'

export interface RoundResult {
  round: number
  score: number | null
  total: number | null
  position: string | null
  roundStatus: string | null
  teeTime: string | null
}

export interface GolferScorecard {
  golferId: string
  status: GolferStatus
  totalBirdies: number
  completedRounds: number
  totalScore: number
  rounds?: RoundResult[]
}

export function getGolferScorecard(score: TournamentScore): GolferScorecard {
  return {
    golferId: score.golfer_id,
    status: score.status,
    totalBirdies: score.total_birdies,
    completedRounds: score.round_id ?? 0,
    totalScore: score.total_score ?? 0,
  }
}

export interface RoundContribution {
  round: number
  golferScore: number | null
  bestBallScore: number | null
  isContributing: boolean
}

export interface GolferContribution {
  golferId: string
  isWithdrawn: boolean
  rounds: RoundContribution[]
  totalContributingRounds: number
}

export function getGolferContribution(
  golferId: string,
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>
): GolferContribution {
  const golferScore = golferScores.get(golferId)
  const isWithdrawn = golferScore?.status === 'withdrawn' || golferScore?.status === 'cut'

  const rounds: RoundContribution[] = []
  let totalContributingRounds = 0

  const golferTotalScore = golferScore?.total_score ?? null
  const bestBallScore = entryGolferIds
    .map((id) => golferScores.get(id))
    .map((score) => score?.total_score ?? null)
    .filter((score): score is number => score !== null)
    .sort((a, b) => a - b)[0] ?? null

  const isContributing = !isWithdrawn && golferTotalScore !== null && bestBallScore !== null && golferTotalScore === bestBallScore

  if (isContributing) totalContributingRounds = 1

  rounds.push({
    round: golferScore?.round_id ?? 1,
    golferScore: golferTotalScore,
    bestBallScore,
    isContributing,
  })

  return {
    golferId,
    isWithdrawn,
    rounds,
    totalContributingRounds,
  }
}

export interface GolferSummary {
  golferId: string
  name: string
  country: string
  status: GolferStatus
  totalScore: number
  totalBirdies: number
  completedRounds: number
  contributingRounds: number
}

export function getEntryGolferSummaries(
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>,
  golfers: GolferLike[]
): GolferSummary[] {
  const golferMap = new Map(golfers.map(g => [g.id, g]))

  return entryGolferIds.map(golferId => {
    const golfer = golferMap.get(golferId)
    const score = golferScores.get(golferId)

    const scorecard = score
      ? getGolferScorecard(score)
      : { completedRounds: 0, totalScore: 0, totalBirdies: 0, status: 'active' as GolferStatus }

    const contribution = getGolferContribution(golferId, entryGolferIds, golferScores)

      return {
        golferId,
        name: golfer?.name ?? golferId,
        country: golfer?.country ?? '',
        status: scorecard.status,
        totalScore: scorecard.totalScore,
        totalBirdies: score?.total_birdies ?? 0,
        completedRounds: scorecard.completedRounds,
        contributingRounds: contribution.totalContributingRounds,
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
export type GolferLike = {
  id: string
  name: string
  country: string
}
