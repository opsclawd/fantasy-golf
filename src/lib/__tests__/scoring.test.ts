import { describe, it, expect } from 'vitest'
import {
  getEntryRoundScore,
  calculateEntryTotalScore,
  calculateEntryBirdies,
  rankEntriesLegacy as rankEntries,
  deriveCompletedRounds,
  buildGolferRoundScoresMap,
  isScoringRelevantGolfer,
  getRequiredScoringGolferIds,
  validateHoleDataCompleteness,
  getLatestCompleteRound,
  filterHolesByRound,
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
      expect(ranked[1].totalScore).toBe(-2)
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

    it('gives different ranks when birdies differ', () => {
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

  describe('isScoringRelevantGolfer', () => {
    it('returns false for cut, withdrawn, and dq statuses', () => {
      expect(isScoringRelevantGolfer('cut')).toBe(false)
      expect(isScoringRelevantGolfer('withdrawn')).toBe(false)
      expect(isScoringRelevantGolfer('dq')).toBe(false)
    })

    it('returns true for active, complete, and omitted statuses', () => {
      expect(isScoringRelevantGolfer('active')).toBe(true)
      expect(isScoringRelevantGolfer('complete')).toBe(true)
      expect(isScoringRelevantGolfer(undefined)).toBe(true)
      expect(isScoringRelevantGolfer(null)).toBe(true)
    })
  })

  describe('getRequiredScoringGolferIds', () => {
    it('extracts unique scoring-relevant golfer IDs across entries', () => {
      const entries: Array<{ golfer_ids?: string[] }> = [
        { golfer_ids: ['g1', 'g2'] },
        { golfer_ids: ['g2', 'g3', 'g4'] },
      ]
      const statuses = new Map<string, GolferStatus>([
        ['g1', 'active'],
        ['g2', 'complete'],
        ['g3', 'cut'],
        ['g4', 'withdrawn'],
      ])

      const required = getRequiredScoringGolferIds(entries, statuses)
      expect(Array.from(required).sort()).toEqual(['g1', 'g2'])
    })

    it('returns an empty set when entries have no golfers or all are excluded', () => {
      expect(getRequiredScoringGolferIds([], new Map()).size).toBe(0)
      expect(
        getRequiredScoringGolferIds(
          [{ golfer_ids: ['g1'] }],
          new Map([['g1', 'cut']])
        ).size
      ).toBe(0)
    })
  })

  describe('validateHoleDataCompleteness', () => {
    it('returns isValid: true when required golfers list is empty', () => {
      const result = validateHoleDataCompleteness([], new Map(), 1)
      expect(result.isValid).toBe(true)
      expect(result.missingGolferIds).toEqual([])
    })

    it('returns isValid: false when holesByGolfer is completely empty and required golfers exist', () => {
      const result = validateHoleDataCompleteness(['g1', 'g2'], new Map(), 1)
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('No hole data')
      expect(result.missingGolferIds).toEqual(['g1', 'g2'])
    })

    it('returns isValid: false when one required golfer has holes and another is missing', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])

      const result = validateHoleDataCompleteness(['g1', 'g2'], holesByGolfer, 1)
      expect(result.isValid).toBe(false)
      expect(result.missingGolferIds).toEqual(['g2'])
      expect(result.reason).toContain('Missing hole data for required golfer(s): g2')
    })

    it('returns isValid: true when all required golfers have hole rows for all completed rounds', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
        ['g2', [
          { golfer_id: 'g2', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g2', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])

      const result = validateHoleDataCompleteness(['g1', 'g2'], holesByGolfer, 2)
      expect(result.isValid).toBe(true)
      expect(result.missingGolferIds).toEqual([])
    })

    it('returns isValid: false when a required golfer has round 1 holes but is missing round 2 holes when completedRounds is 2', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
        ['g2', [
          { golfer_id: 'g2', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])

      const result = validateHoleDataCompleteness(['g1', 'g2'], holesByGolfer, 2)
      expect(result.isValid).toBe(false)
      expect(result.missingGolferIds).toEqual(['g2'])
    })
  })

  describe('getLatestCompleteRound', () => {
    it('returns 0 when completedRounds <= 0 or required golfers list is empty', () => {
      expect(getLatestCompleteRound([], new Map(), 2)).toBe(0)
      expect(getLatestCompleteRound(['g1'], new Map(), 0)).toBe(0)
    })

    it('returns 0 when round 1 is missing for a required golfer', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])
      expect(getLatestCompleteRound(['g1', 'g2'], holesByGolfer, 1)).toBe(0)
    })

    it('returns 1 when round 1 is complete for all golfers but round 2 is missing for one', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
        ['g2', [
          { golfer_id: 'g2', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])
      expect(getLatestCompleteRound(['g1', 'g2'], holesByGolfer, 2)).toBe(1)
    })

    it('returns 2 when both rounds 1 and 2 are complete for all golfers', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
        ['g2', [
          { golfer_id: 'g2', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g2', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])
      expect(getLatestCompleteRound(['g1', 'g2'], holesByGolfer, 2)).toBe(2)
    })
  })

  describe('filterHolesByRound', () => {
    it('filters hole map entries to only include holes up to maxRound', () => {
      const holesByGolfer = new Map<string, TournamentHole[]>([
        ['g1', [
          { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
          { golfer_id: 'g1', tournament_id: 't1', round_id: 3, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
        ]],
      ])

      const filtered = filterHolesByRound(holesByGolfer, 2)
      const g1Holes = filtered.get('g1') || []
      expect(g1Holes.length).toBe(2)
      expect(g1Holes.map(h => h.round_id)).toEqual([1, 2])
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
