import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { classifyFreshness } from '@/lib/freshness'
import { deriveCompletedRounds } from '@/lib/scoring'
import { rankEntriesWithHoles } from '@/lib/scoring'
import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/freshness', () => ({
  classifyFreshness: vi.fn(),
}))

vi.mock('@/lib/scoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scoring')>()
  return {
    ...actual,
    deriveCompletedRounds: vi.fn(),
    rankEntriesWithHoles: vi.fn(),
  }
})

vi.mock('@/lib/scoring-queries', () => ({
  getTournamentHolesForGolfers: vi.fn(),
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

    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(rankEntriesWithHoles).toHaveBeenCalledWith(entries, expect.any(Map), expect.any(Map), 0)
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

    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

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

    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

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

  it('does not trigger background refresh for archived pools', async () => {
    const pool = {
      id: 'pool-1',
      status: 'archived',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: null,
      tournament_id: 't-1',
    }
    const entries = [{ id: 'entry-1', golfer_ids: ['g1'], user_id: 'u1' }]
    const rankedEntries = [
      { id: 'entry-1', golfer_ids: ['g1'], user_id: 'u1', rank: 1, totalScore: 0, totalBirdies: 0 },
    ]

    vi.mocked(classifyFreshness).mockReturnValue('stale')
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: pool, error: null }) }) }) }
        }
        if (table === 'entries') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: entries }) }) }
        }
        if (table === 'tournament_scores') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })

    expect(response.status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('preserves stale valid round 1 standings when round 2 has missing hole data for a required golfer', async () => {
    const pool = {
      id: 'pool-1',
      status: 'live',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: 'Missing hole data for required golfer(s): g2',
      tournament_id: 't-1',
    }
    const entries = [{ id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1' }]
    const tournamentScores = [
      { golfer_id: 'g1', round_id: 2, total_score: -3, total_birdies: 2, status: 'active' },
      { golfer_id: 'g2', round_id: 2, total_score: -1, total_birdies: 1, status: 'active' },
    ]
    const holesByGolfer = new Map([
      ['g1', [
        { golfer_id: 'g1', tournament_id: 't-1', round_id: 1, hole_id: 1, par: 4, strokes: 4, score_to_par: 0 },
        { golfer_id: 'g1', tournament_id: 't-1', round_id: 2, hole_id: 1, par: 4, strokes: 3, score_to_par: -1 },
      ]],
      ['g2', [
        { golfer_id: 'g2', tournament_id: 't-1', round_id: 1, hole_id: 1, par: 4, strokes: 4, score_to_par: 0 },
      ]],
    ])

    vi.mocked(classifyFreshness).mockReturnValue('stale')
    vi.mocked(deriveCompletedRounds).mockReturnValue(2)
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(holesByGolfer as never)

    const rankedEntries = [
      { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1', rank: 1, totalScore: 0, totalBirdies: 0 },
    ]
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: pool, error: null }) }) }) }
        }
        if (table === 'entries') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: entries }) }) }
        }
        if (table === 'tournament_scores') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: tournamentScores }) }) }
        }
        if (table === 'tournament_golfers') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(rankEntriesWithHoles).toHaveBeenCalledWith(
      entries,
      expect.any(Map),
      expect.any(Map),
      1
    )
    const passedHolesMap = vi.mocked(rankEntriesWithHoles).mock.calls[0][1] as Map<string, any[]>
    const g1Holes = passedHolesMap.get('g1') || []
    expect(g1Holes.every((h: any) => h.round_id <= 1)).toBe(true)

    expect(body.data.completedRounds).toBe(1)
    expect(body.data.freshness).toBe('stale')
    expect(body.data.lastRefreshError).toBe('Missing hole data for required golfer(s): g2')
  })

  it('returns unstarted state when round 1 has missing hole data for a required golfer', async () => {
    const pool = {
      id: 'pool-1',
      status: 'live',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: 'No hole data found for any golfer',
      tournament_id: 't-1',
    }
    const entries = [{ id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1' }]
    const tournamentScores = [
      { golfer_id: 'g1', round_id: 1, total_score: -1, total_birdies: 1, status: 'active' },
      { golfer_id: 'g2', round_id: 1, total_score: 0, total_birdies: 0, status: 'active' },
    ]

    vi.mocked(classifyFreshness).mockReturnValue('stale')
    vi.mocked(deriveCompletedRounds).mockReturnValue(1)
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map() as never)

    const rankedEntries = [
      { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1', rank: 1, totalScore: null, totalBirdies: 0 },
    ]
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: pool, error: null }) }) }) }
        }
        if (table === 'entries') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: entries }) }) }
        }
        if (table === 'tournament_scores') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: tournamentScores }) }) }
        }
        if (table === 'tournament_golfers') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(rankEntriesWithHoles).toHaveBeenCalledWith(
      entries,
      expect.any(Map),
      expect.any(Map),
      0
    )
    expect(body.data.completedRounds).toBe(0)
    expect(body.data.freshness).toBe('stale')
    expect(body.data.lastRefreshError).toContain('No hole data')
  })
})
