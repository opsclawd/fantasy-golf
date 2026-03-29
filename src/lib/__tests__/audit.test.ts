import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus } from '../supabase/types'
import { computeScoreDiff, buildRefreshAuditDetails } from '../audit'

function createScore(
  golferId: string,
  holes: (number | null)[],
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  const score: Record<string, unknown> = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: birdies,
    status,
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : null
  }
  return score as unknown as TournamentScore
}

describe('audit', () => {
  describe('computeScoreDiff', () => {
    it('returns empty diff when scores are identical', () => {
      const oldScore = createScore('g1', [-1, 0, 1])
      const newScore = createScore('g1', [-1, 0, 1])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(false)
      expect(diff.holes).toEqual({})
    })

    it('detects hole score changes', () => {
      const oldScore = createScore('g1', [-1, 0, 1])
      const newScore = createScore('g1', [-1, -1, 1])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.holes).toEqual({ hole_2: { old: 0, new: -1 } })
    })

    it('detects new hole scores where old was null', () => {
      const oldScore = createScore('g1', [-1])
      const newScore = createScore('g1', [-1, 0])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.holes).toEqual({ hole_2: { old: null, new: 0 } })
    })

    it('detects status changes', () => {
      const oldScore = createScore('g1', [-1, 0], 'active')
      const newScore = createScore('g1', [-1, 0], 'withdrawn')
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.statusChange).toEqual({ old: 'active', new: 'withdrawn' })
    })

    it('detects birdie count changes', () => {
      const oldScore = createScore('g1', [-1, 0], 'active', 1)
      const newScore = createScore('g1', [-1, 0], 'active', 2)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.birdiesChange).toEqual({ old: 1, new: 2 })
    })
  })

  describe('buildRefreshAuditDetails', () => {
    it('summarizes diffs across multiple golfers', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
        ['g2', createScore('g2', [0, 0])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, -1]),
        createScore('g2', [0, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 2)
      expect(details.completedHoles).toBe(2)
      expect(details.golferCount).toBe(2)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.diffs.g1.holes).toEqual({ hole_2: { old: 0, new: -1 } })
    })

    it('returns empty diffs when nothing changed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual([])
      expect(details.diffs).toEqual({})
    })

    it('handles new golfers not in old scores', () => {
      const oldScores = new Map<string, TournamentScore>()
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.newGolfers).toEqual(['g1'])
    })

    it('detects golfers dropped from external feed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
        ['g2', createScore('g2', [0, 1])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.droppedGolfers).toEqual(['g2'])
    })
  })
})
