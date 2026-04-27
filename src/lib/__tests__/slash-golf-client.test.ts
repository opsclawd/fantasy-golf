import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTournamentScores, getTournamentMeta, getLeaderboard, getScorecard, getStats } from '@/lib/slash-golf/client'

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

  it('preserves zero values from Mongo numeric wrappers', async () => {
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
            lastName: 'Player',
            firstName: 'Even',
            isAmateur: false,
            playerId: '99999',
            courseId: '014',
            status: 'active',
            currentRound: 2,
            total: { $numberInt: '0' },
            currentRoundScore: { $numberInt: '0' },
            position: 'T1',
            totalStrokesFromCompletedRounds: '72',
            roundComplete: false,
            rounds: [
              {
                scoreToPar: { $numberInt: '0' },
                roundId: 1,
                courseId: '014',
                courseName: 'Augusta National Golf Club',
                strokes: { $numberInt: '72' },
              },
            ],
            thru: '9',
            startingHole: 1,
            currentHole: 10,
          },
        ],
      }),
    }))

    const scores = await getTournamentScores('014', 2026)

    expect(scores).toHaveLength(1)
    const golfer = scores[0]!
    expect(golfer.total_score).toBe(0)
    expect(golfer.current_round_score).toBe(0)
    expect(golfer.rounds!).toHaveLength(1)
    const round = golfer.rounds![0]!
    expect(round.score_to_par).toBe(0)
    expect(round.strokes).toBe(72)
  })

  it('getTournamentMeta returns normalized tournament metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orgId: '1',
        year: '2026',
        tournId: '014',
        name: 'The Masters',
        status: 'In Progress',
        currentRound: 2,
        courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
        format: 'stroke',
        date: '2026-04-10',
      }),
    }))

    const meta = await getTournamentMeta('014', 2026)
    expect(meta).toMatchObject({
      tournId: '014',
      name: 'The Masters',
      year: '2026',
      status: 'In Progress',
      currentRound: 2,
      courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
    })
  })

  it('getLeaderboard returns normalized leaderboard with round status', async () => {
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
          { playerId: '22405', lastName: 'Rose', firstName: 'Justin', isAmateur: false, status: 'active' },
        ],
      }),
    }))

    const board = await getLeaderboard('014', 2026)
    expect(board.tournId).toBe('014')
    expect(board.roundStatus).toBe('In Progress')
    expect(board.leaderboardRows).toHaveLength(1)
    expect(board.leaderboardRows[0].status).toBe('active')
  })
})

describe('getTournamentMeta', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns normalized tournament metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orgId: '1',
        year: '2026',
        tournId: '014',
        name: 'The Masters',
        status: 'In Progress',
        currentRound: 2,
        courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
        format: 'stroke',
        date: '2026-04-10',
      }),
    }))

    const meta = await getTournamentMeta('014', 2026)
    expect(meta).toMatchObject({
      tournId: '014',
      name: 'The Masters',
      year: '2026',
      status: 'In Progress',
      currentRound: 2,
      courses: [{ courseId: '014', courseName: 'Augusta National Golf Club' }],
    })
  })
})

describe('getLeaderboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns normalized leaderboard with round status', async () => {
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
          { playerId: '22405', lastName: 'Rose', firstName: 'Justin', isAmateur: false, status: 'active' },
        ],
      }),
    }))

    const board = await getLeaderboard('014', 2026)
    expect(board.tournId).toBe('014')
    expect(board.roundStatus).toBe('In Progress')
    expect(board.leaderboardRows).toHaveLength(1)
    expect(board.leaderboardRows[0].status).toBe('active')
  })
})

describe('getScorecard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns per-hole scorecard for a golfer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tournId: '014',
        playerId: '22405',
        year: '2026',
        status: 'active',
        currentRound: 2,
        holes: [
          { holeId: 1, par: 4, strokes: 4, scoreToPar: 0 },
          { holeId: 2, par: 5, strokes: 4, scoreToPar: -1 },
        ],
      }),
    }))

    const scorecard = await getScorecard('014', '22405', 2026)
    expect(scorecard.tournId).toBe('014')
    expect(scorecard.playerId).toBe('22405')
    expect(scorecard.holes).toHaveLength(2)
    expect(scorecard.holes[0]).toMatchObject({ holeId: 1, par: 4, scoreToPar: 0 })
    expect(scorecard.holes[1]).toMatchObject({ holeId: 2, par: 5, scoreToPar: -1 })
  })
})

describe('getStats', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns player ranking stats', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tournId: '014',
        playerId: '22405',
        worldRank: 12,
        projectedOWGR: 8.5,
      }),
    }))

    const stats = await getStats('014', '22405', 2026)
    expect(stats.playerId).toBe('22405')
    expect(stats.worldRank).toBe(12)
  })
})
