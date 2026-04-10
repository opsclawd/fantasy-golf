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

  it('normalizes live leaderboard rows with round snapshots', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orgId: '1',
        year: '2026',
        tournId: '014',
        status: 'In Progress',
        roundId: 2,
        roundStatus: 'In Progress',
        timestamp: '2026-04-10T15:23:33.217000',
        leaderboardRows: [
          {
            lastName: 'Rose',
            firstName: 'Justin',
            isAmateur: false,
            playerId: '22405',
            teeTime: '9:55am',
            teeTimeTimestamp: '2026-04-10T13:55:00',
            courseId: '014',
            status: 'active',
            currentRound: 2,
            total: '-1',
            currentRoundScore: '+1',
            position: 'T11',
            totalStrokesFromCompletedRounds: '70',
            roundComplete: false,
            rounds: [
              {
                scoreToPar: '-2',
                roundId: 1,
                courseId: '014',
                courseName: 'Augusta National Golf Club',
                strokes: 70,
              },
            ],
            thru: '4',
            startingHole: 1,
            currentHole: 5,
          },
        ],
      }),
    }))

    const scores = await getTournamentScores('014', 2026)

    expect(scores).toHaveLength(1)
    expect(scores[0]).toMatchObject({
      golfer_id: '22405',
      current_round: 2,
      current_round_score: 1,
      total_score: -1,
      position: 'T11',
      current_hole: 5,
      thru: 4,
      rounds: [
        {
          round_id: 1,
          strokes: 70,
          score_to_par: -2,
          course_id: '014',
          course_name: 'Augusta National Golf Club',
        },
      ],
    })
  })
})
