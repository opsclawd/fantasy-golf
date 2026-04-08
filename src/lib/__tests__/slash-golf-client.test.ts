import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTournamentScores } from '@/lib/slash-golf/client'

describe('getTournamentScores', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes wrapped score responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        leaderboardRows: [
          { playerId: 'g1', total: '-1', currentRoundScore: '-1', thru: '2' },
        ],
      }),
    }))

    await expect(getTournamentScores('041', 2026)).resolves.toEqual([
      {
        golfer_id: 'g1',
        tournament_id: '',
        round_id: null,
        round_score: -1,
        total_score: -1,
        position: null,
        round_status: null,
        current_hole: null,
        tee_time: null,
        updated_at: null,
        total_birdies: 0,
        status: 'active',
      },
    ])
  })
})
