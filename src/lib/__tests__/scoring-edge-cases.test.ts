import { describe, it, expect } from 'vitest'
import type { GolferStatus } from '../supabase/types'
import type { Entry } from '../supabase/types'
import {
  computeEntryScore,
  rankEntries,
  type GolferRoundScoresMap,
  type PlayerHoleScore,
} from '../scoring/domain'

function makePlayerHoleScore(roundId: number, scoreToPar: number, status: GolferStatus, isComplete: boolean): PlayerHoleScore {
  return { roundId, scoreToPar: scoreToPar as number, status, isComplete }
}

function makeGolferRoundScoresMapentries(entries: [string, PlayerHoleScore[]][]): GolferRoundScoresMap {
  return new Map(entries)
}

describe('scoring edge cases', () => {
  describe('computeEntryScore', () => {
    it('all golfers have every round incomplete → totalScore 0, completedHoles 0', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', false)]],
        ['g2', [makePlayerHoleScore(1, 0, 'active', false)]],
        ['g3', [makePlayerHoleScore(1, 1, 'active', false)]],
        ['g4', [makePlayerHoleScore(1, -2, 'active', false)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3', 'g4'])

      expect(result.totalScore).toBe(0)
      expect(result.completedHoles).toBe(0)
      expect(result.totalBirdies).toBe(0)
    })

    it('entry contains golfer ID not in score map → silently skipped', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, 0, 'active', true)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3'])

      expect(result.totalScore).toBe(-1)
      expect(result.completedHoles).toBe(1)
    })

    it('entry has fewer than 4 golfers → computes valid score from available', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -2, 'active', true)]],
        ['g2', [makePlayerHoleScore(1, -1, 'active', true)]],
        ['g3', [makePlayerHoleScore(1, 0, 'active', true)]],
      ])

      const result = computeEntryScore(scores, ['g1', 'g2', 'g3'])

      expect(result.totalScore).toBe(-2)
      expect(result.completedHoles).toBe(1)
    })
  })

  describe('rankEntries', () => {
    it('empty entries array → returns empty array without crash', () => {
      const scores = makeGolferRoundScoresMapentries([
        ['g1', [makePlayerHoleScore(1, -1, 'active', true)]],
      ])

      const ranked = rankEntries([], scores, 1)

      expect(ranked).toEqual([])
    })

    it('empty golferRoundScores map → all entries get totalScore 0', () => {
      const entries: Entry[] = [
        { id: 'e1', pool_id: 'p1', user_id: 'u1', golfer_ids: ['g1', 'g2', 'g3', 'g4'], total_birdies: 0, created_at: '', updated_at: '' },
      ]

      const ranked = rankEntries(entries, new Map(), 1)

      expect(ranked).toHaveLength(1)
      expect(ranked[0].totalScore).toBe(0)
      expect(ranked[0].rank).toBe(1)
    })
  })
})