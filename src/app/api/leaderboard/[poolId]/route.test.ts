import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { classifyFreshness } from '@/lib/freshness'
import { rankEntries } from '@/lib/scoring'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/freshness', () => ({
  classifyFreshness: vi.fn(),
}))

vi.mock('@/lib/scoring', () => ({
  deriveCompletedRounds: vi.fn(),
  rankEntries: vi.fn(),
}))

describe('GET /api/leaderboard/[poolId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(classifyFreshness).mockReturnValue('current')
  })

  it('preserves ranked entries when no tournament scores are available', async () => {
    const pool = {
      id: 'pool-1',
      status: 'live',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: null,
      tournament_id: 't-1',
    }
    const entries = [{ id: 'entry-1', golfer_ids: ['g1'], user_id: 'u1' }]
    const rankedEntries = [
      {
        id: 'entry-1',
        golfer_ids: ['g1'],
        user_id: 'u1',
        rank: 1,
        totalScore: 0,
        totalBirdies: 0,
      },
    ]

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: pool, error: null }),
              }),
            }),
          }
        }

        if (table === 'entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: entries }),
            }),
          }
        }

        if (table === 'tournament_scores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)

    vi.mocked(rankEntries).mockReturnValue(rankedEntries as never)

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(rankEntries).toHaveBeenCalledWith(entries, expect.any(Map), 0)
    expect(body.data.entries).toEqual(rankedEntries)
    expect(body.data.completedRounds).toBe(0)
  })
})
