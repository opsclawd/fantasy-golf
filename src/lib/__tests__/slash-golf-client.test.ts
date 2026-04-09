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
        strokes: null,
        score_to_par: null,
        course_id: null,
        course_name: null,
        total_score: -1,
        total_strokes_from_completed_rounds: null,
        position: null,
        current_hole: null,
        thru: 2,
        starting_hole: null,
        current_round: null,
        current_round_score: -1,
        tee_time: null,
        tee_time_timestamp: null,
        is_amateur: null,
        updated_at: null,
        rounds: [],
        total: -1,
        total_birdies: 0,
        status: 'active',
      },
    ])
  })
})
