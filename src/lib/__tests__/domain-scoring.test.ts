import { describe, it, expect } from 'vitest'
import {
  computeEntryScore,
  rankEntriesDomain,
  deriveCompletedRounds,
} from '../scoring/domain'
import type { PlayerRoundScore, EntryLeaderboardSummary } from '../scoring/domain'
import type { Entry } from '../supabase/types'

describe('scoring/domain', () => {
  describe('computeEntryScore', () => {
    it('takes best-ball per round across all golfers in entry', () => {
      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'active', birdies: 3 },
            { roundId: 2, scoreToPar: -1, strokes: 71, status: 'active', birdies: 2 },
          ],
        },
        {
          golferId: 'g2',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 1 },
            { roundId: 2, scoreToPar: 1, strokes: 73, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g3',
          rounds: [
            { roundId: 1, scoreToPar: 1, strokes: 73, status: 'active', birdies: 0 },
            { roundId: 2, scoreToPar: 2, strokes: 74, status: 'active', birdies: 0 },
          ],
        },
      ])

      const result = computeEntryScore(perGolferRounds, ['g1', 'g2', 'g3'], 2)

      expect(result.totalScore).toBe(-3)
      expect(result.totalBirdies).toBe(6)
    })

    it('skips withdrawn and cut golfers', () => {
      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -1, strokes: 71, status: 'active', birdies: 1 },
          ],
        },
        {
          golferId: 'g2',
          rounds: [
            { roundId: 1, scoreToPar: -3, strokes: 69, status: 'withdrawn', birdies: 4 },
          ],
        },
      ])

      const result = computeEntryScore(perGolferRounds, ['g1', 'g2'], 1)

      expect(result.totalScore).toBe(-1)
      expect(result.totalBirdies).toBe(1)
    })

    it('returns 0 score and 0 birdies when no active golfers have completed rounds', () => {
      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'cut', birdies: 2 },
          ],
        },
      ])

      const result = computeEntryScore(perGolferRounds, ['g1'], 1)

      expect(result.totalScore).toBe(0)
      expect(result.totalBirdies).toBe(0)
    })

    it('returns 0 when no scores exist for any golfer', () => {
      const perGolferRounds = new Map<string, PlayerRoundScore[]>()

      const result = computeEntryScore(perGolferRounds, ['g1', 'g2'], 2)

      expect(result.totalScore).toBe(0)
      expect(result.totalBirdies).toBe(0)
    })
  })

  describe('rankEntriesDomain', () => {
    it('ranks by total score ascending, then birdies descending as tiebreaker', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2', 'g3', 'g4']),
        createEntry('e2', ['g5', 'g6', 'g7', 'g8']),
      ]

      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -1, strokes: 71, status: 'active', birdies: 2 },
          ],
        },
        {
          golferId: 'g2',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g3',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g4',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g5',
          rounds: [
            { roundId: 1, scoreToPar: -1, strokes: 71, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g6',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g7',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
        {
          golferId: 'g8',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
      ])

      const ranked = rankEntriesDomain(entries, perGolferRounds, 1)

      expect(ranked[0].totalScore).toBe(-1)
      expect(ranked[0].totalBirdies).toBe(2)
      expect(ranked[1].totalScore).toBe(-1)
      expect(ranked[1].totalBirdies).toBe(0)
    })

    it('shares rank when entries have identical score and birdies', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
        createEntry('e3', ['g3']),
      ]

      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'active', birdies: 3 },
          ],
        },
        {
          golferId: 'g2',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'active', birdies: 3 },
          ],
        },
        {
          golferId: 'g3',
          rounds: [
            { roundId: 1, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
          ],
        },
      ])

      const ranked = rankEntriesDomain(entries, perGolferRounds, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(1)
      expect(ranked[2].rank).toBe(3)
    })

    it('does not share rank when score matches but birdies differ', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1']),
        createEntry('e2', ['g2']),
      ]

      const perGolferRounds = buildPerGolferRounds('t1', [
        {
          golferId: 'g1',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'active', birdies: 2 },
          ],
        },
        {
          golferId: 'g2',
          rounds: [
            { roundId: 1, scoreToPar: -2, strokes: 70, status: 'active', birdies: 1 },
          ],
        },
      ])

      const ranked = rankEntriesDomain(entries, perGolferRounds, 1)

      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(2)
    })
  })

  describe('deriveCompletedRounds', () => {
    it('returns 0 when no scores have a round_id', () => {
      const scores: PlayerRoundScore[] = []
      expect(deriveCompletedRounds(scores)).toBe(0)
    })

    it('returns the highest round_id', () => {
      const scores: PlayerRoundScore[] = [
        { golferId: 'g1', roundId: 1, scoreToPar: -1, strokes: 71, status: 'active', birdies: 1 },
        { golferId: 'g2', roundId: 2, scoreToPar: 0, strokes: 72, status: 'active', birdies: 0 },
        { golferId: 'g3', roundId: 3, scoreToPar: 1, strokes: 73, status: 'active', birdies: 0 },
      ]
      expect(deriveCompletedRounds(scores)).toBe(3)
    })
  })
})

function buildPerGolferRounds(
  tournamentId: string,
  data: { golferId: string; rounds: Omit<PlayerRoundScore, 'golferId'>[] }[]
): Map<string, PlayerRoundScore[]> {
  const map = new Map<string, PlayerRoundScore[]>()
  for (const { golferId, rounds } of data) {
    map.set(
      golferId,
      rounds.map((r) => ({ ...r, golferId }))
    )
  }
  return map
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