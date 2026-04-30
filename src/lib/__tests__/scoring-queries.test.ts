import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TournamentHole } from '../supabase/types'

import { upsertTournamentScore, upsertTournamentHoles } from '../scoring-queries'
import type { TournamentHole } from '../scoring-queries'

describe('tournament_holes queries', () => {
  it('getTournamentHolesForGolfers returns holes grouped by golfer', async () => {
    const mockHoles = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1 },
    ]

    const chain: any = {}
    chain.from = vi.fn(() => chain)
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.order = vi.fn()
      .mockReturnValueOnce(chain)
      .mockReturnValueOnce({
        data: mockHoles,
        error: null,
      })

    const mockSupabase = { from: chain.from }

    const { getTournamentHolesForGolfers } = await import('../scoring-queries')
    const result = await getTournamentHolesForGolfers(mockSupabase as any, 't1', ['g1', 'g2'])

    expect(mockSupabase.from).toHaveBeenCalledWith('tournament_holes')
    expect(result.get('g1')?.length).toBe(2)
    expect(result.get('g1')?.[0].score_to_par).toBe(0)
  })

  it('upsertTournamentHoles writes multiple holes', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    }

    mockSupabase.upsert.mockReturnValue({ error: null })

    const { upsertTournamentHoles } = await import('../scoring-queries')
    const holes: TournamentHole[] = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
    ]

    const result = await upsertTournamentHoles(mockSupabase as any, holes)
    expect(result.error).toBe(null)
    expect(mockSupabase.upsert).toHaveBeenCalled()
  })
})

describe('upsertTournamentScore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('archives each round before writing the current score row', async () => {
    const archiveUpserts: unknown[] = []
    const currentUpserts: unknown[] = []

    const archiveBuilder: any = {
      upsert: vi.fn((value: unknown) => {
        archiveUpserts.push(value)
        return archiveBuilder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled, onRejected),
    }

    const currentBuilder: any = {
      upsert: vi.fn((value: unknown) => {
        currentUpserts.push(value)
        return currentBuilder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled, onRejected),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tournament_score_rounds') return archiveBuilder
        if (table === 'tournament_scores') return currentBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    await expect(
      upsertTournamentScore(
        supabase as never,
        {
          golfer_id: 'g1',
          tournament_id: '014',
          total_score: -1,
          position: 'T11',
          total_birdies: 2,
          status: 'active',
        },
        {
          golfer_id: 'g1',
          current_round: 2,
          current_round_score: 1,
          total: -1,
          total_birdies: 2,
          status: 'active',
          rounds: [
            {
              round_id: 1,
              strokes: 70,
              score_to_par: -2,
              course_id: '014',
              course_name: 'Augusta National Golf Club',
            },
            {
              round_id: 2,
              strokes: 68,
              score_to_par: -4,
              course_id: '014',
              course_name: 'Augusta National Golf Club',
            },
          ],
        } as never
      )
    ).resolves.toEqual({ error: null })

    expect(archiveUpserts).toHaveLength(2)
    expect(archiveUpserts[0]).toMatchObject({
      golfer_id: 'g1',
      tournament_id: '014',
      round_id: 1,
      strokes: 70,
      score_to_par: -2,
    })
    expect(archiveUpserts[1]).toMatchObject({
      golfer_id: 'g1',
      tournament_id: '014',
      round_id: 2,
      strokes: 68,
      score_to_par: -4,
    })
    expect(archiveUpserts[0]).not.toHaveProperty('round_status')
    expect(archiveUpserts[1]).not.toHaveProperty('round_status')
    expect(currentUpserts).toHaveLength(1)
    expect(currentUpserts[0]).toMatchObject({
      golfer_id: 'g1',
      tournament_id: '014',
      round_id: 2,
      total_score: -1,
      status: 'active',
    })
  })

  it('does not write round_status to archive — Board-authorized no-retroactivity rule', async () => {
    const archiveUpserts: unknown[] = []

    const archiveBuilder: any = {
      upsert: vi.fn((value: unknown) => {
        archiveUpserts.push(value)
        return archiveBuilder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled, onRejected),
    }

    const currentBuilder: any = {
      upsert: vi.fn(() => currentBuilder),
      then: (onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled, onRejected),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tournament_score_rounds') return archiveBuilder
        if (table === 'tournament_scores') return currentBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    await expect(
      upsertTournamentScore(
        supabase as never,
        {
          golfer_id: 'g1',
          tournament_id: '014',
          total_score: -1,
          position: 'T11',
          total_birdies: 2,
          status: 'cut',
        },
        {
          golfer_id: 'g1',
          current_round: 3,
          current_round_score: 1,
          total: -1,
          total_birdies: 2,
          status: 'cut',
          rounds: [
            { round_id: 1, strokes: 70, score_to_par: -2, course_id: '014', course_name: 'Augusta' },
            { round_id: 2, strokes: 68, score_to_par: -4, course_id: '014', course_name: 'Augusta' },
            { round_id: 3, strokes: 72, score_to_par: 0, course_id: '014', course_name: 'Augusta' },
          ],
        } as never
      )
    ).resolves.toEqual({ error: null })

    expect(archiveUpserts).toHaveLength(3)
    for (const record of archiveUpserts) {
      expect(record).not.toHaveProperty('round_status')
    }
  })

  it('upsertTournamentHoles persists hole records', async () => {
    const upsertedRecords: unknown[] = []

    const builder: any = {
      upsert: vi.fn((records: unknown) => {
        upsertedRecords.push(...(Array.isArray(records) ? records : [records]))
        return builder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled, onRejected),
    }

    const supabase = {
      from: vi.fn(() => builder),
    } as never

    const holes = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 5, par: 4, score_to_par: 1 },
    ]
    const result = await upsertTournamentHoles(supabase, holes)
    expect(result.error).toBeNull()
    expect(upsertedRecords).toHaveLength(2)
  })
})

describe('upsertTournamentHoles', () => {
  it('persists hole records', async () => {
    const upserts: unknown[] = []
    const builder: any = {
      upsert: vi.fn((value: unknown) => {
        upserts.push(value)
        return builder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    }

    const supabase = {
      from: vi.fn(() => builder),
    }

    const holes: TournamentHole[] = [
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0 },
      { golfer_id: 'g1', tournament_id: 't1', round_id: 1, hole_id: 2, strokes: 5, par: 4, score_to_par: 1 },
    ]

    const result = await upsertTournamentHoles(supabase as never, holes)
    expect(result.error).toBeNull()
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toHaveLength(2)
    expect(upserts[0][0]).toMatchObject({
      golfer_id: 'g1',
      tournament_id: 't1',
      round_id: 1,
      hole_id: 1,
      strokes: 4,
      par: 4,
      score_to_par: 0,
    })
  })

  it('returns early when holes array is empty', async () => {
    const supabase = { from: vi.fn() } as any
    const result = await upsertTournamentHoles(supabase, [])
    expect(result.error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
