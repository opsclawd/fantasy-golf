import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { classifyFreshness } from '@/lib/freshness'
import { deriveCompletedRounds, rankEntriesWithHoles } from '@/lib/scoring'
import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/freshness', () => ({
  classifyFreshness: vi.fn(),
}))

vi.mock('@/lib/scoring', () => ({
  deriveCompletedRounds: vi.fn(),
  rankEntriesWithHoles: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  getTournamentHolesForGolfers: vi.fn(),
}))

vi.mock('@/lib/tournament-roster/queries', () => ({
  getTournamentRosterGolfers: vi.fn(),
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

    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())
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

    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())
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
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })

    expect(response.status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds', async () => {
    const pool = {
      id: 'pool-1',
      status: 'live',
      refreshed_at: '2026-03-29T00:00:00.000Z',
      last_refresh_error: null,
      tournament_id: 't-1',
    }
    const entries = [
      { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1' },
      { id: 'entry-2', golfer_ids: ['g3', 'g4'], user_id: 'u2' },
    ]

    const holesByGolfer = new Map<string, import('@/lib/supabase/types').TournamentHole[]>()
    holesByGolfer.set('g1', [
      { golfer_id: 'g1', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g1', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g1', tournament_id: 't-1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
    ])
    holesByGolfer.set('g2', [
      { golfer_id: 'g2', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g2', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g2', tournament_id: 't-1', round_id: 2, hole_id: 1, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
    ])
    holesByGolfer.set('g3', [
      { golfer_id: 'g3', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g3', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
    ])
    holesByGolfer.set('g4', [
      { golfer_id: 'g4', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 3, par: 4, score_to_par: -1, updated_at: '2026-03-29T00:00:00.000Z' },
      { golfer_id: 'g4', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
    ])

    const rankedEntries = [
      { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1', rank: 1, totalScore: -1, totalBirdies: 1, isTied: false },
      { id: 'entry-2', golfer_ids: ['g3', 'g4'], user_id: 'u2', rank: 2, totalScore: 0, totalBirdies: 1, isTied: false },
    ]

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: pool, error: null }) }) }) }
        }
        if (table === 'entries') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: entries }) }) }
        }
        if (table === 'tournament_scores') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ golfer_id: 'g1', tournament_id: 't-1', status: 'active', total_score: 0, position: 1, total_birdies: 0, updated_at: '2026-03-29T00:00:00.000Z' }] }) }) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)

    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(holesByGolfer)
    vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)
    vi.mocked(getTournamentRosterGolfers).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(2)

    const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
      params: Promise.resolve({ poolId: 'pool-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getTournamentHolesForGolfers).toHaveBeenCalledWith(expect.any(Object), 't-1', expect.arrayContaining(['g1', 'g2', 'g3', 'g4']))
    expect(rankEntriesWithHoles).toHaveBeenCalledWith(entries, holesByGolfer, expect.any(Map), 2)
    expect(body.data.entries).toEqual(rankedEntries)
  })
})
