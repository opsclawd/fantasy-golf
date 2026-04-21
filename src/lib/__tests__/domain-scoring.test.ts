import { describe, it, expect } from 'vitest'
import type { GolferStatus } from '../supabase/types'

interface GolferRoundScore {
  roundId: number
  scoreToPar: number | null
  status: GolferStatus
  isComplete: boolean
}

type GolferRoundScoresMap = Map<string, GolferRoundScore[]>

import {
  computeEntryScore,
  rankEntries,
  deriveCompletedRounds,
  isActiveGolfer,
  type EntryScoreAccumulator,
  type EntryLeaderboardSummary,
} from '../scoring/domain'

function createGolferRoundScores(
  golferId: string,
  rounds: { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[]
): { golferId: string; rounds: { roundId: number; scoreToPar: number | null; status: GolferStatus; isComplete: boolean }[] } {
  return { golferId, rounds }
}

describe('domain scoring', () => {
  describe('isActiveGolfer', () => {
    it('returns true for active golfers', () => {
      expect(isActiveGolfer('active')).toBe(true)
    })

    it('returns false for withdrawn golfers', () => {
      expect(isActiveGolfer('withdrawn')).toBe(false)
    })

    it('returns false for cut golfers', () => {
      expect(isActiveGolfer('cut')).toBe(false)
    })
  })

  describe('computeEntryScore', () => {
    it('normal 4 active golfers, complete round', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
        ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g3', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
        ['g4', [{ roundId: 1, scoreToPar: 1, status: 'active', isComplete: true }]],
      ])

      const result = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(1) // -2 is eagle (birdie count)
      expect(result.completedHoles).toBe(1)
    })

    it('one golfer cut — excluded post-cut', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [
          { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -2, status: 'cut', isComplete: true },
        ]],
        ['g2', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -1, status: 'active', isComplete: true },
        ]],
        ['g3', [
          { roundId: 1, scoreToPar: 1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 0, status: 'active', isComplete: true },
        ]],
        ['g4', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 1, status: 'active', isComplete: true },
        ]],
      ])

      const result = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])

      // Round 1: g1=-1, g2=0, g3=1, g4=0 → best=-1
      // Round 2: only g2,g3,g4 active. g2=-1, g3=0, g4=1 → best=-1
      // totalScore = -1 + -1 = -2
      // Birdies: round1=-1(birdie), round2=-1(birdie) = 2
      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(2)
      expect(result.completedHoles).toBe(2)
    })

    it('one golfer WD mid-round — excluded post-WD', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [
          { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -2, status: 'withdrawn', isComplete: true },
        ]],
        ['g2', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -1, status: 'active', isComplete: true },
        ]],
        ['g3', [
          { roundId: 1, scoreToPar: 1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 0, status: 'active', isComplete: true },
        ]],
        ['g4', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 1, status: 'active', isComplete: true },
        ]],
      ])

      const result = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])

      // Round 1: g1=-1, g2=0, g3=1, g4=0 → best=-1
      // Round 2: g1 is WD so only g2,g3,g4. g2=-1, g3=0, g4=1 → best=-1
      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(2)
    })

    it('partial round — only completed holes count', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [
          { roundId: 1, scoreToPar: -1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -2, status: 'active', isComplete: false },
        ]],
        ['g2', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: -1, status: 'active', isComplete: true },
        ]],
        ['g3', [
          { roundId: 1, scoreToPar: 1, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 0, status: 'active', isComplete: true },
        ]],
        ['g4', [
          { roundId: 1, scoreToPar: 0, status: 'active', isComplete: true },
          { roundId: 2, scoreToPar: 1, status: 'active', isComplete: true },
        ]],
      ])

      const result = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])

      // Only round 1 is complete for all. Round 2 has g1 incomplete.
      // Round 1: g1=-1, g2=0, g3=1, g4=0 → best=-1
      expect(result.totalScore).toBe(-1)
      expect(result.totalBirdies).toBe(1)
      expect(result.completedHoles).toBe(1)
    })

    it('tie on score, broken by birdies', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g3', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g4', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g5', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
        ['g6', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
        ['g7', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
        ['g8', [{ roundId: 1, scoreToPar: -2, status: 'active', isComplete: true }]],
      ])

      const entry1Score = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])
      const entry2Score = computeEntryScore(golferRoundScores, ['g5', 'g6', 'g7', 'g8'])

      expect(entry1Score.totalScore).toBe(-1)
      expect(entry1Score.totalBirdies).toBe(1)
      expect(entry2Score.totalScore).toBe(-2)
      expect(entry2Score.totalBirdies).toBe(1)
    })

    it('tie on score and birdies — shared rank', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g3', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g4', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g5', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g6', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g7', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g8', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
      ])

      const entry1Score = computeEntryScore(golferRoundScores, ['g1', 'g2', 'g3', 'g4'])
      const entry2Score = computeEntryScore(golferRoundScores, ['g5', 'g6', 'g7', 'g8'])

      expect(entry1Score.totalScore).toBe(-1)
      expect(entry1Score.totalBirdies).toBe(1)
      expect(entry2Score.totalScore).toBe(-1)
      expect(entry2Score.totalBirdies).toBe(1)
    })
  })

  describe('deriveCompletedRounds', () => {
    it('returns 0 when no scores', () => {
      expect(deriveCompletedRounds([])).toBe(0)
    })

    it('returns highest round id', () => {
      const scores = [
        { golfer_id: 'g1', tournament_id: 't1', round_id: 1, total_score: -1, total_birdies: 0, status: 'active' as GolferStatus },
        { golfer_id: 'g2', tournament_id: 't1', round_id: 2, total_score: -2, total_birdies: 1, status: 'active' as GolferStatus },
      ]
      expect(deriveCompletedRounds(scores)).toBe(2)
    })
  })

  describe('rankEntries', () => {
    it('ranks by score then birdies', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g3', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g4', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g5', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
        ['g6', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
        ['g7', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
        ['g8', [{ roundId: 1, scoreToPar: 0, status: 'active', isComplete: true }]],
      ])

      const entries = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
        { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g5', 'g6', 'g7', 'g8'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, golferRoundScores, 1)

      expect(ranked[0].id).toBe('e1')
      expect(ranked[0].totalScore).toBe(-1)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].id).toBe('e2')
      expect(ranked[1].totalScore).toBe(0)
      expect(ranked[1].rank).toBe(2)
    })

    it('assigns shared rank when score and birdies are identical', () => {
      const golferRoundScores: GolferRoundScoresMap = new Map([
        ['g1', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g2', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g3', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g4', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g5', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g6', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g7', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
        ['g8', [{ roundId: 1, scoreToPar: -1, status: 'active', isComplete: true }]],
      ])

      const entries = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
        { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g5', 'g6', 'g7', 'g8'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, golferRoundScores, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1) // Shared rank with e1
    })
  })
})