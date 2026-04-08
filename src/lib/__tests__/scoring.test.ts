import { describe, it, expect } from 'vitest'
import {
  getEntryRoundScore,
  calculateEntryTotalScore,
  calculateEntryBirdies,
  rankEntries,
  deriveCompletedRounds,
} from '../scoring'
import type { TournamentScore, Entry, GolferStatus } from '../supabase/types'

describe('scoring', () => {
  describe('getEntryRoundScore', () => {
    it('returns the lowest round score among active golfers', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -1)],
        ['g2', createScore('g2', 0, 0)],
        ['g3', createScore('g3', 1, 1)],
      ])

      expect(getEntryRoundScore(golferScores, ['g1', 'g2', 'g3'])).toBe(-1)
    })

    it('skips withdrawn golfers', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -1)],
        ['g2', createScore('g2', -2, -2, 'withdrawn')],
      ])

      expect(getEntryRoundScore(golferScores, ['g1', 'g2'])).toBe(-1)
    })

    it('returns null when no active scores exist', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -1, 'withdrawn')],
        ['g2', createScore('g2', -2, -2, 'cut')],
      ])

      expect(getEntryRoundScore(golferScores, ['g1', 'g2'])).toBe(null)
    })
  })

  describe('rankEntries', () => {
    it('ranks by total score, then birdies for tiebreaker', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2', 'g3', 'g4']),
        createEntry('e2', ['g5', 'g6', 'g7', 'g8']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -2, 'active', 2)],
        ['g2', createScore('g2', 0, 0)],
        ['g3', createScore('g3', 0, 0)],
        ['g4', createScore('g4', 0, 0)],
        ['g5', createScore('g5', -1, -2, 'active', 0)],
        ['g6', createScore('g6', 0, 0)],
        ['g7', createScore('g7', 0, 0)],
        ['g8', createScore('g8', 0, 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 1)

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
        ['g1', createScore('g1', -2, -3, 'active', 3)],
        ['g2', createScore('g2', -2, -3, 'active', 3)],
        ['g3', createScore('g3', 0, 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[2].rank).toBe(3)
    })

    it('does not share rank when score matches but birdies differ', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -2, -2, 'active', 2)],
        ['g2', createScore('g2', -2, -2, 'active', 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(2)
    })

    it('handles withdrawn golfers correctly', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3', 'g4']),
      ]

      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -2, 'active', 2)],
        ['g2', createScore('g2', -2, -2, 'withdrawn', 1)],
        ['g3', createScore('g3', -1, -3, 'active', 2)],
        ['g4', createScore('g4', 0, 0, 'active', 1)],
      ])

      const ranked = rankEntries(entries, golferScores, 1)

      expect(ranked[0].id).toBe('e2')
      expect(ranked[0].totalScore).toBe(-3)
      expect(ranked[1].id).toBe('e1')
      expect(ranked[1].totalScore).toBe(-2)
    })
  })

  describe('calculateEntry helpers', () => {
    it('sums birdies across all golfers', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', -1, -1, 'active', 1)],
        ['g2', createScore('g2', 0, 0, 'withdrawn', 2)],
      ])

      expect(calculateEntryBirdies(golferScores, ['g1', 'g2'])).toBe(3)
    })

    it('returns zero when no scores are present', () => {
      expect(calculateEntryTotalScore(new Map(), ['g1'], 1)).toBe(0)
    })
  })

  describe('deriveCompletedRounds', () => {
    it('returns 0 when no golfers have started', () => {
      expect(deriveCompletedRounds([{ ...createScore('g1', null, null), round_id: null }])).toBe(0)
    })

    it('returns the highest completed round', () => {
      const allScores: TournamentScore[] = [
        { ...createScore('g1', -1, -2), round_id: 1 },
        { ...createScore('g2', 0, -1), round_id: 2 },
      ]

      expect(deriveCompletedRounds(allScores)).toBe(2)
    })
  })
})

function createScore(
  golferId: string,
  roundScore: number | null,
  totalScore: number | null,
  status: GolferStatus = 'active',
  birdies = 0
): TournamentScore {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundScore === null ? null : 1,
    round_score: roundScore,
    total_score: totalScore,
    total_birdies: birdies,
    status,
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
    updated_at: new Date().toISOString(),
  }
}
