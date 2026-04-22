import { describe, it, expect } from 'vitest'
import type { GolferStatus } from '../supabase/types'
import type { Entry } from '../supabase/types'

import {
  computeEntryScore,
  rankEntries,
  deriveCompletedRounds,
  isActiveGolfer,
  type GolferRoundScoresMap,
  type PlayerHoleScore,
} from '../scoring/domain'

function makePlayerHoleScore(roundId: number, scoreToPar: number, status: GolferStatus, isComplete: boolean): PlayerHoleScore {
  return { roundId, scoreToPar: scoreToPar as number, status, isComplete }
}

function makeGolferRoundScoresMapentries(entries: [string, PlayerHoleScore[]][]): GolferRoundScoresMap {
  return new Map(entries)
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
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, 0, 'active', true)]],
        ['g4', [makePlayerHoleScore(1, 1, 'active', true)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(1)
      expect(result.completedHoles).toBe(1)
    })

    it('one golfer cut — excluded post-cut', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [
          makePlayerHoleScore(1, -1, 'active', true),
          makePlayerHoleScore(2, -2, 'cut', true),
        ]],
        ['g2', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, -1, 'active', true),
        ]],
        ['g3', [
          makePlayerHoleScore(1, 1, 'active', true),
          makePlayerHoleScore(2, 0, 'active', true),
        ]],
        ['g4', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, 1, 'active', true),
        ]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(2)
      expect(result.completedHoles).toBe(2)
    })

    it('one golfer WD mid-round — excluded post-WD', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [
          makePlayerHoleScore(1, -1, 'active', true),
          makePlayerHoleScore(2, -2, 'withdrawn', true),
        ]],
        ['g2', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, -1, 'active', true),
        ]],
        ['g3', [
          makePlayerHoleScore(1, 1, 'active', true),
          makePlayerHoleScore(2, 0, 'active', true),
        ]],
        ['g4', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, 1, 'active', true),
        ]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(-2)
      expect(result.totalBirdies).toBe(2)
    })

    it('partial round — only completed holes count', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [
          makePlayerHoleScore(1, -1, 'active', true),
          makePlayerHoleScore(2, -2, 'active', false),
        ]],
        ['g2', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, -1, 'active', true),
        ]],
        ['g3', [
          makePlayerHoleScore(1, 1, 'active', true),
          makePlayerHoleScore(2, 0, 'active', true),
        ]],
        ['g4', [
          makePlayerHoleScore(1, 0, 'active', true),
          makePlayerHoleScore(2, 1, 'active', true),
        ]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(-1)
      expect(result.totalBirdies).toBe(1)
      expect(result.completedHoles).toBe(1)
    })

    it('tie on score, broken by birdies', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g4', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g5', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g6', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g7', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g8', [makePlayerHoleScore(1, -2, 'active', true)]],
      ])

      const entry1Score = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])
      const entry2Score = computeEntryScore(scores, ['g5', 'g6', 'g7', 'g8'])

      expect(entry1Score.totalScore).toBe(-1)
      expect(entry1Score.totalBirdies).toBe(1)
      expect(entry2Score.totalScore).toBe(-2)
      expect(entry2Score.totalBirdies).toBe(1)
    })

    it('tie on score and birdies — shared rank', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g4', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g5', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g6', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g7', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g8', [makePlayerHoleScore(1, -1, 'active', true)]],
      ])

      const entry1Score = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])
      const entry2Score = computeEntryScore(scores, ['g5', 'g6', 'g7', 'g8'])

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
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g4', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g5', [makePlayerHoleScore(1, 0, 'active', true)]],
        ['g6', [makePlayerHoleScore(1, 0, 'active', true)]],
        ['g7', [makePlayerHoleScore(1, 0, 'active', true)]],
        ['g8', [makePlayerHoleScore(1, 0, 'active', true)]],
      ])

      const entries: Entry[] = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
        { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g5', 'g6', 'g7', 'g8'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, scores, 1)

      expect(ranked[0].id).toBe('e1')
      expect(ranked[0].totalScore).toBe(-1)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].id).toBe('e2')
      expect(ranked[1].totalScore).toBe(0)
      expect(ranked[1].rank).toBe(2)
    })

    it('assigns shared rank when score and birdies are identical', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g4', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g5', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g6', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g7', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g8', [makePlayerHoleScore(1, -1, 'active', true)]],
      ])

      const entries: Entry[] = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
        { id: 'e2', pool_id: 'p1', user_id: 'u2', golfer_ids: ['g5', 'g6', 'g7', 'g8'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, scores, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1)
    })
  })
})