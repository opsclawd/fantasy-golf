import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus } from '../supabase/types'
import { getGolferScorecard } from '../golfer-detail'

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
})
