import { describe, it, expect } from 'vitest'
import {
  getHoleScore,
  getEntryHoleScore,
  calculateEntryTotalScore,
  calculateEntryBirdies,
  rankEntries,
  deriveCompletedHoles,
} from '../scoring'
import type { TournamentScore, Entry, GolferStatus } from '../supabase/types'

describe('scoring', () => {
  describe('getHoleScore', () => {
    it('returns the score for a given hole', () => {
      const score: TournamentScore = {
        golfer_id: 'g1',
        tournament_id: 't1',
        hole_1: -1,
        hole_2: 0,
        hole_3: 1,
        hole_4: -2,
        hole_5: 0, hole_6: 0, hole_7: 0, hole_8: 0, hole_9: 0,
        hole_10: 0, hole_11: 0, hole_12: 0, hole_13: 0, hole_14: 0,
        hole_15: 0, hole_16: 0, hole_17: 0, hole_18: 0,
        total_birdies: 2,
        status: 'active'
      }
      
      expect(getHoleScore(score, 1)).toBe(-1)
      expect(getHoleScore(score, 2)).toBe(0)
      expect(getHoleScore(score, 4)).toBe(-2)
    })

    it('returns null for unplayed holes', () => {
      const score: TournamentScore = {
        golfer_id: 'g1',
        tournament_id: 't1',
        hole_1: -1,
        hole_2: null,
        hole_3: null,
        hole_4: null, hole_5: null, hole_6: null, hole_7: null, hole_8: null, hole_9: null,
        hole_10: null, hole_11: null, hole_12: null, hole_13: null, hole_14: null,
        hole_15: null, hole_16: null, hole_17: null, hole_18: null,
        total_birdies: 1,
        status: 'active'
      }
      
      expect(getHoleScore(score, 2)).toBe(null)
    })
  })

  describe('getEntryHoleScore', () => {
    it('returns lowest score among golfers', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
        ['g2', createScore('g2', [0, -1, 0])],
        ['g3', createScore('g3', [1, 0, -1])],
        ['g4', createScore('g4', [0, 1, 0])],
      ])
      
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 1)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 2)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 3)).toBe(-1)
    })
  })

  describe('rankEntries', () => {
    it('ranks by total score, then birdies for tiebreaker', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2', 'g3', 'g4']),
        createEntry('e2', ['g5', 'g6', 'g7', 'g8']),
      ]
      
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, -1], 2)],
        ['g2', createScoreWithBirdies('g2', [0, 0, 0], 0)],
        ['g3', createScoreWithBirdies('g3', [0, 0, 0], 0)],
        ['g4', createScoreWithBirdies('g4', [0, 0, 0], 0)],
        ['g5', createScoreWithBirdies('g5', [-1, 0, -1], 0)],
        ['g6', createScoreWithBirdies('g6', [0, 0, 0], 0)],
        ['g7', createScoreWithBirdies('g7', [0, 0, 0], 0)],
        ['g8', createScoreWithBirdies('g8', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      
      expect(ranked[0].totalScore).toBe(-2)
      expect(ranked[0].totalBirdies).toBe(2)
      expect(ranked[1].totalScore).toBe(-2)
      expect(ranked[1].totalBirdies).toBe(0)
    })

    it('assigns shared rank when entries have identical score and birdies', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
        createEntry('e3', ['g3']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-2, -1, 0], 3)],
        ['g2', createScoreWithBirdies('g2', [-2, -1, 0], 3)],
        ['g3', createScoreWithBirdies('g3', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // e1 and e2 are tied: same score (-3) and same birdies (3)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalScore).toBe(-3)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[1].totalScore).toBe(-3)
      // e3 skips to rank 3 (not 2)
      expect(ranked[2].rank).toBe(3)
      expect(ranked[2].totalScore).toBe(0)
    })

    it('does not share rank when score matches but birdies differ', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-2, 0, 0], 2)],
        ['g2', createScoreWithBirdies('g2', [-2, 0, 0], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // Same score but different birdies → different ranks
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalBirdies).toBe(2)
      expect(ranked[1].rank).toBe(2)
      expect(ranked[1].totalBirdies).toBe(1)
    })

    it('handles three-way tie correctly', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
        createEntry('e3', ['g3']),
        createEntry('e4', ['g4']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1)],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1)],
        ['g3', createScoreWithBirdies('g3', [-1, 0, 0], 1)],
        ['g4', createScoreWithBirdies('g4', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[2].rank).toBe(1)
      expect(ranked[3].rank).toBe(4) // skips 2 and 3
    })
  })

  describe('withdrawal handling', () => {
    it('skips withdrawn golfer when computing best-ball hole score', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
        ['g2', createScore('g2', [0, -1, 0], 'withdrawn')],
      ])

      // g2 is withdrawn — only g1's scores should be used
      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 1)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 2)).toBe(0)
    })

    it('returns null if all golfers in entry are withdrawn', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0], 'withdrawn')],
        ['g2', createScore('g2', [0, -1], 'withdrawn')],
      ])

      expect(getEntryHoleScore(golferScores, ['g1', 'g2'], 1)).toBe(null)
    })

    it('still includes withdrawn golfer birdies earned before withdrawal', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1)],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1, 'withdrawn')],
      ])

      // Birdies include ALL golfers regardless of status — birdies were earned
      expect(calculateEntryBirdies(golferScores, ['g1', 'g2'])).toBe(2)
    })

    it('ranks entries with withdrawn golfers correctly', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3', 'g4']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        // e1: g1 active (-2 total), g2 withdrawn (scores ignored for holes)
        ['g1', createScoreWithBirdies('g1', [-1, -1, 0], 2)],
        ['g2', createScoreWithBirdies('g2', [-2, 0, 0], 1, 'withdrawn')],
        // e2: both active, best ball = -1 per hole = -3 total
        ['g3', createScoreWithBirdies('g3', [-1, 0, -1], 2)],
        ['g4', createScoreWithBirdies('g4', [0, -1, 0], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)

      // e2 best-ball: min(-1,0), min(0,-1), min(-1,0) = -1, -1, -1 = -3
      // e1 best-ball: only g1 active: -1, -1, 0 = -2
      expect(ranked[0].id).toBe('e2')
      expect(ranked[0].totalScore).toBe(-3)
      expect(ranked[1].id).toBe('e1')
      expect(ranked[1].totalScore).toBe(-2)
    })

    it('returns empty array when no entries are provided', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
      ])

      const ranked = rankEntries([], golferScores, 3)
      expect(ranked).toEqual([])
    })

    it('ranks a single entry as rank 1', () => {
      const entries: Entry[] = [createEntry('e1', ['g1'])]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 1], 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      expect(ranked).toHaveLength(1)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[0].totalScore).toBe(0)
    })

    it('handles entry where all golfers are withdrawn', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, 0], 1, 'withdrawn')],
        ['g2', createScoreWithBirdies('g2', [-1, 0, 0], 1, 'withdrawn')],
        ['g3', createScoreWithBirdies('g3', [-1, -1, 0], 2)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      // e1 has totalScore = 0 (no active golfers → all null holes → break immediately)
      // e2 has totalScore = -2
      expect(ranked[0].id).toBe('e2')
      expect(ranked[0].totalScore).toBe(-2)
      expect(ranked[1].id).toBe('e1')
      expect(ranked[1].totalScore).toBe(0)
    })
  })

  describe('deriveCompletedHoles', () => {
    it('returns 0 when no golfers have started', () => {
      const allScores: TournamentScore[] = [
        {
          ...createScore('g1', []),
          hole_1: null,
          hole_2: null,
          hole_3: null,
          hole_4: null,
          hole_5: null,
          hole_6: null,
          hole_7: null,
          hole_8: null,
          hole_9: null,
          hole_10: null,
          hole_11: null,
          hole_12: null,
          hole_13: null,
          hole_14: null,
          hole_15: null,
          hole_16: null,
          hole_17: null,
          hole_18: null,
        },
      ]

      expect(deriveCompletedHoles(allScores)).toBe(0)
    })

    it('uses minimum contiguous thru value among started golfers', () => {
      const allScores: TournamentScore[] = [
        {
          ...createScore('g1', [0, -1, 1, 0]),
          hole_5: null,
          hole_6: null,
          hole_7: null,
          hole_8: null,
          hole_9: null,
          hole_10: null,
          hole_11: null,
          hole_12: null,
          hole_13: null,
          hole_14: null,
          hole_15: null,
          hole_16: null,
          hole_17: null,
          hole_18: null,
        },
        {
          ...createScore('g2', [0, 0]),
          hole_3: null,
          hole_4: null,
          hole_5: null,
          hole_6: null,
          hole_7: null,
          hole_8: null,
          hole_9: null,
          hole_10: null,
          hole_11: null,
          hole_12: null,
          hole_13: null,
          hole_14: null,
          hole_15: null,
          hole_16: null,
          hole_17: null,
          hole_18: null,
        },
      ]

      expect(deriveCompletedHoles(allScores)).toBe(2)
    })
  })
})

function createScore(golferId: string, holes: number[], status: GolferStatus = 'active'): TournamentScore {
  const score: any = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: 0,
    status
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : 0
  }
  return score as TournamentScore
}

function createScoreWithBirdies(golferId: string, holes: number[], birdies: number, status: GolferStatus = 'active'): TournamentScore {
  return {
    ...createScore(golferId, holes, status),
    total_birdies: birdies
  }
}

function createEntry(id: string, golferIds: string[]): Entry {
  return {
    id,
    pool_id: 'p1',
    user_id: id,
    golfer_ids: golferIds,
    total_birdies: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}
