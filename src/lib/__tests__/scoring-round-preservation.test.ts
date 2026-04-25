import { describe, expect, it, vi } from 'vitest'

import { upsertTournamentScore } from '../scoring-queries'

describe('round preservation across refresh cycles', () => {
  it('second refresh does not overwrite first refresh rounds in archive', async () => {
    const archiveUpserts: unknown[] = []

    const archiveBuilder: any = {
      upsert: vi.fn((value: unknown) => {
        archiveUpserts.push(value)
        return archiveBuilder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    }

    const currentBuilder: any = {
      upsert: vi.fn(() => currentBuilder),
      then: (onFulfilled: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tournament_score_rounds') return archiveBuilder
        if (table === 'tournament_scores') return currentBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    await upsertTournamentScore(
      supabase as never,
      { golfer_id: 'g1', tournament_id: 't1', total_score: -2, total_birdies: 1, status: 'active' },
      {
        golfer_id: 'g1',
        current_round: 2,
        rounds: [
          { round_id: 1, strokes: 70, score_to_par: -2, course_id: 'c1', course_name: 'Course A' },
          { round_id: 2, strokes: 68, score_to_par: -4, course_id: 'c1', course_name: 'Course A' },
        ],
      } as never
    )

    archiveUpserts.length = 0

    await upsertTournamentScore(
      supabase as never,
      { golfer_id: 'g1', tournament_id: 't1', total_score: -5, total_birdies: 2, status: 'active' },
      {
        golfer_id: 'g1',
        current_round: 3,
        rounds: [
          { round_id: 1, strokes: 70, score_to_par: -2, course_id: 'c1', course_name: 'Course A' },
          { round_id: 2, strokes: 68, score_to_par: -4, course_id: 'c1', course_name: 'Course A' },
          { round_id: 3, strokes: 69, score_to_par: -3, course_id: 'c1', course_name: 'Course A' },
        ],
      } as never
    )

    expect(archiveUpserts).toHaveLength(3)

    const r1Upsert = archiveUpserts.find((u: any) => u.round_id === 1)
    const r2Upsert = archiveUpserts.find((u: any) => u.round_id === 2)
    expect(r1Upsert.strokes).toBe(70)
    expect(r2Upsert.strokes).toBe(68)
  })
})