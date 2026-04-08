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
        data: [
          { golfer_id: 'g1', hole_scores: [-1, 0], thru: 2, total: 1 },
        ],
      }),
    }))

    await expect(getTournamentScores('041', 2026)).resolves.toEqual([
      { golfer_id: 'g1', hole_scores: [-1, 0], thru: 2, total: 1 },
    ])
  })
})
