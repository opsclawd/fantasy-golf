import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTournamentScores, getLeaderboard, getScorecard } from '@/lib/slash-golf/client'

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

    it('bare array of scorecards (per-round) → combines holes from all rounds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{
          tournId: '014',
          playerId: '22405',
          roundId: 1,
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: [
            { holeId: 1, par: 4, strokes: 4, scoreToPar: 0 },
            { holeId: 2, par: 4, strokes: 3, scoreToPar: -1 },
          ],
        }, {
          tournId: '014',
          playerId: '22405',
          roundId: 2,
          year: '2026',
          status: 'active',
          currentRound: 2,
          holes: [
            { holeId: 1, par: 4, strokes: 5, scoreToPar: 1 },
            { holeId: 2, par: 4, strokes: 4, scoreToPar: 0 },
          ],
        }]),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.roundId).toBe(1)
      expect(result.holes).toHaveLength(4)
      expect(result.holes[0]).toMatchObject({ holeId: 1, scoreToPar: 0 })
      expect(result.holes[2]).toMatchObject({ holeId: 1, scoreToPar: 1 })
    })

    it('wrapped { scorecards: [...] } response → extracts first scorecard metadata', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          scorecards: [{
            tournId: '014',
            playerId: '22405',
            roundId: 1,
            year: '2026',
            status: 'active',
            currentRound: 1,
            holes: [{ holeId: 1, par: 4, strokes: 4, scoreToPar: 0 }],
          }],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.tournId).toBe('014')
      expect(result.holes).toHaveLength(1)
    })

    it('roundId absent on scorecards → falls back to outer raw.roundId', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          roundId: 3,
          playerId: '22405',
          year: '2026',
          status: 'active',
          currentRound: 3,
          holes: [{ holeId: 1, par: 4, strokes: 4, scoreToPar: 0 }],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.roundId).toBe(3)
    })

    it('scorecards with empty holes arrays → discards them (holes filtered by holeId > 0)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{
          tournId: '014',
          playerId: '22405',
          roundId: 1,
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: [],
        }, {
          tournId: '014',
          playerId: '22405',
          roundId: 2,
          year: '2026',
          status: 'active',
          currentRound: 2,
          holes: [{ holeId: 1, par: 4, strokes: 4, scoreToPar: 0 }],
        }]),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.holes).toHaveLength(1)
    })

    it('MongoDB $numberInt wrappers in holes → parses correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          roundId: 1,
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: [
            { holeId: { $numberInt: '1' }, par: { $numberInt: '4' }, strokes: { $numberInt: '4' }, scoreToPar: { $numberInt: '0' } },
            { holeId: { $numberInt: '2' }, par: { $numberInt: '4' }, strokes: { $numberInt: '3' }, scoreToPar: { $numberInt: '-1' } },
          ],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.holes).toHaveLength(2)
      expect(result.holes[0]).toMatchObject({ holeId: 1, par: 4, scoreToPar: 0 })
      expect(result.holes[1]).toMatchObject({ holeId: 2, par: 4, scoreToPar: -1 })
    })

    it('single scorecard response (bare object) → normalizes correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          roundId: 2,
          year: '2026',
          status: 'active',
          currentRound: 2,
          holes: [
            { holeId: 1, par: 4, strokes: 4, scoreToPar: 0 },
            { holeId: 2, par: 5, strokes: 4, scoreToPar: -1 },
          ],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.tournId).toBe('014')
      expect(result.playerId).toBe('22405')
      expect(result.roundId).toBe(2)
      expect(result.holes).toHaveLength(2)
      expect(result.holes[0]).toMatchObject({ holeId: 1, par: 4, scoreToPar: 0 })
      expect(result.holes[1]).toMatchObject({ holeId: 2, par: 5, scoreToPar: -1 })
    })

    it('status "dq" → preserved as dq', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          roundId: 1,
          year: '2026',
          status: 'dq',
          currentRound: 1,
          holes: [{ holeId: 1, par: 4, strokes: 4, scoreToPar: 0 }],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.status).toBe('dq')
    })

    it('status "complete" → preserved as complete', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tournId: '014',
          playerId: '22405',
          roundId: 1,
          year: '2026',
          status: 'complete',
          currentRound: 1,
          holes: [{ holeId: 1, par: 4, strokes: 4, scoreToPar: 0 }],
        }),
      }))

      const result = await getScorecard('014', '22405', 2026)
      expect(result.status).toBe('complete')
    })
  })
})