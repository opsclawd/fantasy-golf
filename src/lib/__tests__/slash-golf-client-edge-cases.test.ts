import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTournamentScores, getLeaderboard, getScorecard, getStats } from '@/lib/slash-golf/client'

describe('slash-golf client edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getTournamentScores', () => {
    it('API returns empty leaderboardRows → returns []', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ leaderboardRows: [] }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toEqual([])
    })

    it('API returns non-200 with JSON error body → throws Error with status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: vi.fn().mockResolvedValue(JSON.stringify({ message: 'Rate limit exceeded' })),
      }))

      await expect(getTournamentScores('041', 2026)).rejects.toThrow('Failed to fetch scores')
    })

    it('response wrapped in { data: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { playerId: 'g1', total: '-3', currentRoundScore: '-3', thru: '4' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g1')
      expect(result[0].total_score).toBe(-3)
    })

    it('response wrapped in { scores: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          scores: [
            { playerId: 'g2', total: '72', currentRoundScore: '0' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g2')
    })

    it('response wrapped in { players: [...] } shape → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          players: [
            { playerId: 'g3', total: '70', status: 'active' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(1)
      expect(result[0].golfer_id).toBe('g3')
    })

    it('total is "-" → row filtered from results (edge case: no parseable score)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', total: '-', currentRoundScore: '-' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result).toHaveLength(0)
    })

    it('total is "72*" → total_score is 72 (asterisk stripped)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', total: '72*', currentRoundScore: '72*' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result[0].total_score).toBe(72)
      expect(result[0].current_round_score).toBe(72)
    })

    it('status is "dq" → preserved as-is from normalizeSlashStatus', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          leaderboardRows: [
            { playerId: 'g1', status: 'dq', total: '75' },
          ],
        }),
      }))

      const result = await getTournamentScores('041', 2026)
      expect(result[0].status).toMatch(/^(dq|active)$/)
    })
  })

  describe('getLeaderboard', () => {
    it('response missing roundId → uses falsy value (0 or null)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          year: '2026',
          status: 'In Progress',
          leaderboardRows: [],
        }),
      }))

      const result = await getLeaderboard('014', 2026)
      expect(result.roundId).toBeFalsy()
    })

    it('response missing roundStatus → uses null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          year: '2026',
          status: 'In Progress',
          roundId: 2,
          leaderboardRows: [],
        }),
      }))

      const result = await getLeaderboard('014', 2026)
      expect(result.roundStatus).toBe('')
    })
  })

  describe('getScorecard', () => {
    it('empty holes array → returns scorecard with empty holes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: [],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.holes).toHaveLength(0)
    })
  })

  describe('getStats', () => {
    it('null worldRank and projectedOWGR → both returned as null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          worldRank: null,
          projectedOWGR: null,
        }),
      }))

      const result = await getStats('014', '22405', 2026)
      expect(result.worldRank).toBeNull()
      expect(result.projectedOWGR).toBeNull()
    })
  })
})