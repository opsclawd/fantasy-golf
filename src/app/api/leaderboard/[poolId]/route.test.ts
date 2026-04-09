import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const originalEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  CRON_SECRET: process.env.CRON_SECRET,
}

describe('GET /api/leaderboard/[poolId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(classifyFreshness).mockReturnValue('current')
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.CRON_SECRET = 'secret'
  })

  afterEach(() => {
    if (originalEnv.NEXT_PUBLIC_APP_URL === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
    }

    if (originalEnv.CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalEnv.CRON_SECRET
    }

    vi.restoreAllMocks()
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
    expect(body.data.isRefreshing).toBe(false)
  })

  it('returns isRefreshing true and triggers background refresh when data is stale', async () => {
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

    vi.mocked(classifyFreshness).mockReturnValue('stale')

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

    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/app/'
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.isRefreshing).toBe(true)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/app/api/scoring/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ poolId: 'pool-1' }),
      })
    )
  })

  it('surfaces refresh failures instead of a perpetual refreshing state', async () => {
    const pool = {
      id: 'pool-1',
      status: 'live',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: 'PGATour API timed out',
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

    vi.mocked(classifyFreshness).mockReturnValue('stale')

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

    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/app/'
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.isRefreshing).toBe(false)
    expect(body.data.lastRefreshError).toBe('PGATour API timed out')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/app/api/scoring/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ poolId: 'pool-1' }),
      })
    )
  })
})
