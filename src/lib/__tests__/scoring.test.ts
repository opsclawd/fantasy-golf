import { describe, it, expect } from 'vitest'
import {
  getEntryRoundScore,
  calculateEntryTotalScore,
  calculateEntryBirdies,
  deriveCompletedRounds,
  buildGolferRoundScoresMap,
} from '../scoring'
import type { TournamentScore, Entry, GolferStatus, TournamentHole } from '../supabase/types'

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

  describe('buildGolferRoundScoresMap with hole data', () => {
    it('maps tournament holes to PlayerHoleScore entries with holeId', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1 },
        ]],
      ])
      const statuses = new Map<string, GolferStatus>([['g1', 'active']])

      const result = buildGolferRoundScoresMap(holesByGolfer, statuses)

      expect(result.get('g1')?.length).toBe(2)
      expect(result.get('g1')?.[0]).toMatchObject({ roundId: 1, holeId: 1, scoreToPar: 0, isComplete: true })
      expect(result.get('g1')?.[1]).toMatchObject({ roundId: 1, holeId: 2, scoreToPar: -1, isComplete: true })
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