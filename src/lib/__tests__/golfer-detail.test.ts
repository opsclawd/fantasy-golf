import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus, Golfer } from '../supabase/types'
import { getGolferScorecard, getGolferContribution, getEntryGolferSummaries } from '../golfer-detail'

function createScore(
  golferId: string,
  holes: number[],
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  const score: any = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: birdies,
    status,
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : null
  }
  return score as TournamentScore
}

describe('golfer-detail', () => {
  describe('getGolferScorecard', () => {
    it('returns hole-by-hole scores and total for an active golfer', () => {
      const score = createScore('g1', [-1, 0, 1, -2, 0, 0, 0, 0, 0], 'active', 2)
      const card = getGolferScorecard(score)

      expect(card.golferId).toBe('g1')
      expect(card.status).toBe('active')
      expect(card.totalBirdies).toBe(2)
      expect(card.holes).toHaveLength(18)
      expect(card.holes[0]).toEqual({ hole: 1, score: -1 })
      expect(card.holes[1]).toEqual({ hole: 2, score: 0 })
      expect(card.holes[2]).toEqual({ hole: 3, score: 1 })
      expect(card.holes[3]).toEqual({ hole: 4, score: -2 })
      expect(card.holes[8]).toEqual({ hole: 9, score: 0 })
      expect(card.holes[9]).toEqual({ hole: 10, score: null })
      expect(card.completedHoles).toBe(9)
      expect(card.totalScore).toBe(-2)
    })

    it('returns zero total for a golfer with no completed holes', () => {
      const score = createScore('g1', [], 'active')
      const card = getGolferScorecard(score)

      expect(card.completedHoles).toBe(0)
      expect(card.totalScore).toBe(0)
      expect(card.holes.every((h: { score: number | null }) => h.score === null)).toBe(true)
    })

    it('includes status for withdrawn golfers', () => {
      const score = createScore('g1', [-1, 0], 'withdrawn', 1)
      const card = getGolferScorecard(score)

      expect(card.status).toBe('withdrawn')
      expect(card.completedHoles).toBe(2)
      expect(card.totalScore).toBe(-1)
    })
  })

  describe('getEntryGolferSummaries', () => {
    it('returns a summary for each golfer in the entry', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, -1], 'active', 2)],
        ['g2', createScore('g2', [0, -1, 0], 'active', 1)],
      ])

      const golfers: Golfer[] = [
        { id: 'g1', name: 'Tiger Woods', country: 'USA' },
        { id: 'g2', name: 'Rory McIlroy', country: 'NIR' },
      ]

      const summaries = getEntryGolferSummaries(
        ['g1', 'g2'],
        golferScores,
        golfers
      )

      expect(summaries).toHaveLength(2)
      expect(summaries[0].golferId).toBe('g1')
      expect(summaries[0].name).toBe('Tiger Woods')
      expect(summaries[0].totalScore).toBe(-2)
      expect(summaries[0].status).toBe('active')
      expect(summaries[0].contributingHoles).toBeGreaterThanOrEqual(0)

      expect(summaries[1].golferId).toBe('g2')
      expect(summaries[1].name).toBe('Rory McIlroy')
    })

    it('handles golfer with no score data', () => {
      const golferScores = new Map<string, TournamentScore>()
      const golfers: Golfer[] = [
        { id: 'g1', name: 'Tiger Woods', country: 'USA' },
      ]

      const summaries = getEntryGolferSummaries(['g1'], golferScores, golfers)

      expect(summaries).toHaveLength(1)
      expect(summaries[0].totalScore).toBe(0)
      expect(summaries[0].status).toBe('active')
      expect(summaries[0].contributingHoles).toBe(0)
    })

    it('handles golfer not in golfers list', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1], 'active', 1)],
      ])

      const summaries = getEntryGolferSummaries(['g1'], golferScores, [])

      expect(summaries[0].name).toBe('g1')
    })
  })

  describe('getGolferContribution', () => {
    it('marks holes where the golfer provided the best-ball score', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1], 'active', 1)],
        ['g2', createScore('g2', [0, -1, 0], 'active', 1)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      // Hole 1: g1=-1, g2=0 → g1 is best → contributing
      expect(contribution.holes[0]).toEqual({ hole: 1, golferScore: -1, bestBallScore: -1, isContributing: true })
      // Hole 2: g1=0, g2=-1 → g2 is best → not contributing
      expect(contribution.holes[1]).toEqual({ hole: 2, golferScore: 0, bestBallScore: -1, isContributing: false })
      // Hole 3: g1=1, g2=0 → g2 is best → not contributing
      expect(contribution.holes[2]).toEqual({ hole: 3, golferScore: 1, bestBallScore: 0, isContributing: false })
    })

    it('marks as contributing when golfer ties for best ball', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0], 'active')],
        ['g2', createScore('g2', [-1, 0], 'active')],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      // Both tied at -1 → g1 is contributing (it matches best ball)
      expect(contribution.holes[0].isContributing).toBe(true)
    })

    it('returns null contribution when golfer is withdrawn', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0], 'withdrawn', 1)],
        ['g2', createScore('g2', [0, -1], 'active', 1)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      expect(contribution.isWithdrawn).toBe(true)
      // Withdrawn golfers don't contribute to best-ball
      expect(contribution.holes[0].isContributing).toBe(false)
      expect(contribution.holes[1].isContributing).toBe(false)
    })

    it('handles golfer not found in scores map', () => {
      const golferScores = new Map<string, TournamentScore>()
      const contribution = getGolferContribution('g1', ['g1'], golferScores)

      expect(contribution.isWithdrawn).toBe(false)
      expect(contribution.totalContributingHoles).toBe(0)
    })

    it('counts total contributing holes', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, -2, 0, -1], 'active', 3)],
        ['g2', createScore('g2', [0, 0, -1, -1], 'active', 2)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      // Hole 1: g1=-1 best, Hole 2: g1=-2 best, Hole 3: g2=-1 best, Hole 4: tied -1 → g1 contributing
      expect(contribution.totalContributingHoles).toBe(3)
    })
  })
})
