import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus, Entry } from '../supabase/types'
import type { GolferLike } from '../golfer-detail'
import { getGolferScorecard, getGolferContribution, getEntryGolferSummaries, getGolferPoolContext } from '../golfer-detail'

function createScore(
  golferId: string,
  roundId: number,
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
  }
}

describe('golfer-detail', () => {
  describe('getGolferScorecard', () => {
    it('returns round-level data for an active golfer', () => {
      const score = createScore('g1', 3, -2, -4, 'active', 2)
      const card = getGolferScorecard(score)

      expect(card.golferId).toBe('g1')
      expect(card.status).toBe('active')
      expect(card.totalBirdies).toBe(2)
      expect(card.completedRounds).toBe(3)
      expect(card.totalScore).toBe(-4)
      expect(card.rounds).toEqual([
        {
          round: 3,
          score: -2,
          total: -4,
          position: null,
          roundStatus: null,
          teeTime: null,
        },
      ])
    })

    it('returns zero total for a golfer with no round data', () => {
      const score = createScore('g1', 0, null, null, 'active')
      const card = getGolferScorecard(score)

      expect(card.completedRounds).toBe(0)
      expect(card.totalScore).toBe(0)
      expect(card.rounds?.[0].score).toBeNull()
    })

    it('includes status for withdrawn golfers', () => {
      const score = createScore('g1', 2, -1, -1, 'withdrawn', 1)
      const card = getGolferScorecard(score)

      expect(card.status).toBe('withdrawn')
      expect(card.completedRounds).toBe(2)
      expect(card.totalScore).toBe(-1)
    })
  })

  describe('getEntryGolferSummaries', () => {
    it('returns a summary for each golfer in the entry', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 3, -2, -4, 'active', 2)],
        ['g2', createScore('g2', 3, -1, -1, 'active', 1)],
      ])

      const golfers: GolferLike[] = [
        { id: 'g1', name: 'Tiger Woods', country: 'USA' },
        { id: 'g2', name: 'Rory McIlroy', country: 'NIR' },
      ]

      const summaries = getEntryGolferSummaries(
        ['g1', 'g2'],
        golferScores,
        golfers
      )

      expect(summaries).toHaveLength(2)
      expect(summaries[0].golferId).toBe('g1')
      expect(summaries[0].name).toBe('Tiger Woods')
      expect(summaries[0].totalScore).toBe(-4)
      expect(summaries[0].status).toBe('active')
      expect(summaries[0].contributingRounds).toBe(1)

      expect(summaries[1].golferId).toBe('g2')
      expect(summaries[1].name).toBe('Rory McIlroy')
    })

    it('handles golfer with no score data', () => {
      const golferScores = new Map<string, TournamentScore>()
      const golfers: GolferLike[] = [
        { id: 'g1', name: 'Tiger Woods', country: 'USA' },
      ]

      const summaries = getEntryGolferSummaries(['g1'], golferScores, golfers)

      expect(summaries).toHaveLength(1)
      expect(summaries[0].totalScore).toBe(0)
      expect(summaries[0].status).toBe('active')
      expect(summaries[0].contributingRounds).toBe(0)
    })

    it('handles golfer not in golfers list', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -1, 'active', 1)],
      ])

      const summaries = getEntryGolferSummaries(['g1'], golferScores, [])

      expect(summaries[0].name).toBe('g1')
    })
  })

  describe('getGolferContribution', () => {
    it('marks the golfer when their round matches the best ball', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -1, 'active', 1)],
        ['g2', createScore('g2', 1, 0, 0, 'active', 1)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      expect(contribution.rounds[0]).toEqual({
        round: 1,
        golferScore: -1,
        bestBallScore: -1,
        isContributing: true,
      })
      expect(contribution.totalContributingRounds).toBe(1)
    })

    it('marks as contributing when golfer ties for best ball', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -1, 'active')],
        ['g2', createScore('g2', 1, -1, -1, 'active')],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      expect(contribution.rounds[0].isContributing).toBe(true)
    })

    it('returns non-contributing when golfer is withdrawn', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -1, 'withdrawn', 1)],
        ['g2', createScore('g2', 1, 0, 0, 'active', 1)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      expect(contribution.isWithdrawn).toBe(true)
      expect(contribution.rounds[0].isContributing).toBe(false)
    })

    it('handles golfer not found in scores map', () => {
      const golferScores = new Map<string, TournamentScore>()
      const contribution = getGolferContribution('g1', ['g1'], golferScores)

      expect(contribution.isWithdrawn).toBe(false)
      expect(contribution.totalContributingRounds).toBe(0)
    })

    it('counts total contributing rounds', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', 1, -1, -3, 'active', 3)],
        ['g2', createScore('g2', 1, 0, 0, 'active', 2)],
      ])

      const contribution = getGolferContribution('g1', ['g1', 'g2'], golferScores)

      expect(contribution.totalContributingRounds).toBe(1)
    })
  })

  describe('getGolferPoolContext', () => {
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

    it('finds all entries containing a given golfer', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2']),
        createEntry('e2', ['g3', 'g4']),
        createEntry('e3', ['g1', 'g4']),
      ]

      const context = getGolferPoolContext('g1', entries)

      expect(context.totalEntries).toBe(3)
      expect(context.entriesWithGolfer).toBe(2)
      expect(context.entryIds).toEqual(['e1', 'e3'])
      expect(context.pickRate).toBeCloseTo(2 / 3)
    })

    it('returns zero when no entries contain the golfer', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g2', 'g3']),
      ]

      const context = getGolferPoolContext('g1', entries)

      expect(context.entriesWithGolfer).toBe(0)
      expect(context.entryIds).toEqual([])
      expect(context.pickRate).toBe(0)
    })

    it('handles empty entries list', () => {
      const context = getGolferPoolContext('g1', [])

      expect(context.totalEntries).toBe(0)
      expect(context.entriesWithGolfer).toBe(0)
      expect(context.pickRate).toBe(0)
    })
  })
})
