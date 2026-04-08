import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus } from '../supabase/types'
import { computeScoreDiff, buildRefreshAuditDetails } from '../audit'

function createScore(
  golferId: string,
  roundId: number | null,
  roundScore: number | null,
  totalScore: number | null,
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundId,
    round_score: roundScore,
    total_score: totalScore,
    total_birdies: birdies,
    status,
    position: null,
    round_status: null,
    current_hole: null,
    tee_time: null,
    updated_at: null,
  }
}

describe('audit', () => {
  describe('computeScoreDiff', () => {
    it('returns empty diff when scores are identical', () => {
      const oldScore = createScore('g1', 1, -1, -2)
      const newScore = createScore('g1', 1, -1, -2)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(false)
      expect(diff.fields).toEqual({})
    })

    it('detects round score changes', () => {
      const oldScore = createScore('g1', 1, -1, -2)
      const newScore = createScore('g1', 1, -2, -3)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.fields).toEqual({ round_score: { old: -1, new: -2 }, total_score: { old: -2, new: -3 } })
    })

    it('detects round id changes', () => {
      const oldScore = createScore('g1', 1, -1, -2)
      const newScore = createScore('g1', 2, -1, -3)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.fields.round_id).toEqual({ old: 1, new: 2 })
    })

    it('detects status changes', () => {
      const oldScore = createScore('g1', 1, -1, -2, 'active')
      const newScore = createScore('g1', 1, -1, -2, 'withdrawn')
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.statusChange).toEqual({ old: 'active', new: 'withdrawn' })
    })

    it('detects birdie count changes', () => {
      const oldScore = createScore('g1', 1, -1, -2, 'active', 1)
      const newScore = createScore('g1', 1, -1, -2, 'active', 2)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.birdiesChange).toEqual({ old: 1, new: 2 })
    })
  })

  describe('buildRefreshAuditDetails', () => {
    it('summarizes diffs across multiple golfers', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -2)],
        ['g2', createScore('g2', 1, 0, 0)],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', 2, -2, -3),
        createScore('g2', 1, 0, 0),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 2)
      expect(details.completedRounds).toBe(2)
      expect(details.golferCount).toBe(2)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.diffs.g1.fields.round_id).toEqual({ old: 1, new: 2 })
    })

    it('returns empty diffs when nothing changed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -2)],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', 1, -1, -2),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual([])
      expect(details.diffs).toEqual({})
    })

    it('handles new golfers not in old scores', () => {
      const oldScores = new Map<string, TournamentScore>()
      const newScores: TournamentScore[] = [
        createScore('g1', 1, -1, -2),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.newGolfers).toEqual(['g1'])
    })

    it('detects golfers dropped from external feed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -2)],
        ['g2', createScore('g2', 1, 0, 0)],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', 1, -1, -2),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.droppedGolfers).toEqual(['g2'])
    })

    it('dedupes changed golfers when duplicate incoming rows exist', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -2)],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', 2, -2, -3),
        createScore('g1', 2, -2, -3),
      ]

      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)

      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.newGolfers).toEqual([])
      expect(details.diffs.g1.fields.round_id).toEqual({ old: 1, new: 2 })
    })

    it('dedupes new golfers when duplicate incoming rows exist', () => {
      const oldScores = new Map<string, TournamentScore>()
      const newScores: TournamentScore[] = [
        createScore('g3', 1, -1, -2),
        createScore('g3', 1, -1, -2),
      ]

      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)

      expect(details.newGolfers).toEqual(['g3'])
      expect(details.changedGolfers).toEqual(['g3'])
      expect(details.diffs).toEqual({})
    })
  })
})
