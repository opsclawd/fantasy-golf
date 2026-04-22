import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { upsertTournamentScore } from '../scoring-queries'

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
})
