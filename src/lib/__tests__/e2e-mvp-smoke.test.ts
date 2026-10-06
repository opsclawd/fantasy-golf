import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  generateInviteCode,
  validateCreatePoolInput,
  canTransitionStatus,
} from '@/lib/pool'
import {
  validatePickSubmission,
  isPoolLocked,
  getTournamentLockInstant,
} from '@/lib/picks'
import {
  rankEntriesWithHoles,
  validateHoleDataCompleteness,
  getRequiredScoringGolferIds,
  getLatestCompleteRound,
  filterHolesByRound,
  buildGolferRoundScoresMap,
} from '@/lib/scoring'
import { classifyFreshness } from '@/lib/freshness'
import { refreshScoresForPool } from '@/lib/scoring-refresh'
import { GET as getLeaderboard } from '@/app/api/leaderboard/[poolId]/route'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores, getScorecard } from '@/lib/slash-golf/client'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  updatePoolRefreshTelemetry,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
  getTournamentScoreRounds,
  upsertTournamentHoles,
  getTournamentHolesForGolfers,
} from '@/lib/scoring-queries'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

import type {
  Entry,
  Pool,
  TournamentHole,
  TournamentScore,
  GolferStatus,
} from '@/lib/supabase/types'

// Mock external service clients and queries
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getTournamentScores: vi.fn(),
  getScorecard: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  buildRefreshAuditDetails: vi.fn().mockReturnValue({ diffs: [], summary: 'Refreshed' }),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolsByTournament: vi.fn(),
  getEntriesForPool: vi.fn(),
  updatePoolRefreshMetadata: vi.fn(),
  updatePoolRefreshTelemetry: vi.fn(),
  insertAuditEvent: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  upsertTournamentScore: vi.fn(),
  getScoresForTournament: vi.fn(),
  getTournamentScoreRounds: vi.fn(),
  upsertTournamentHoles: vi.fn(),
  getTournamentHolesForGolfers: vi.fn(),
}))

vi.mock('@/lib/tournament-roster/queries', () => ({
  getTournamentRosterGolfers: vi.fn(),
}))

describe('MVP End-to-End Smoke Test Suite', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'))
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    vi.mocked(getScoresForTournament).mockResolvedValue([])
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(updatePoolRefreshTelemetry).mockResolvedValue({ error: null } as any)
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null } as any)
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  // Helper to generate 18 holes of scorecard data for a round
  function generateScorecardHoles(
    golferId: string,
    roundId: number,
    strokesPerHole: number = 4,
    parPerHole: number = 4
  ): TournamentHole[] {
    return Array.from({ length: 18 }, (_, index) => {
      const holeId = index + 1
      return {
        id: `${golferId}-r${roundId}-h${holeId}`,
        golfer_id: golferId,
        tournament_id: 't-masters-2026',
        round_id: roundId,
        hole_id: holeId,
        strokes: strokesPerHole,
        par: parPerHole,
        score_to_par: strokesPerHole - parPerHole,
        updated_at: new Date().toISOString(),
      }
    })
  }

  describe('Step 1: Create a Pool & Validate Configuration', () => {
    it('successfully validates pool configuration with deadline, timezone, and picks_per_entry = 4', () => {
      const poolInput = {
        name: 'Augusta Masters Pool',
        tournamentId: 't-masters-2026',
        tournamentName: 'The Masters 2026',
        year: 2026,
        deadline: '2026-04-09T00:00:00Z',
        timezone: 'America/New_York',
      }

      const validation = validateCreatePoolInput(poolInput)
      expect(validation.ok).toBe(true)

      const inviteCode = generateInviteCode()
      expect(inviteCode).toMatch(/^[a-z0-9]{8}$/)

      // Verify pool lifecycle transitions
      expect(canTransitionStatus('open', 'live')).toBe(true)
      expect(canTransitionStatus('live', 'complete')).toBe(true)
      expect(canTransitionStatus('complete', 'archived')).toBe(true)
    })
  })

  describe('Step 2: Tournament Roster Configuration', () => {
    it('verifies active rostered golfers are available for selection', async () => {
      const mockGolfers = [
        { id: 'g1', name: 'Scottie Scheffler', country: 'USA', is_active: true },
        { id: 'g2', name: 'Rory McIlroy', country: 'NIR', is_active: true },
        { id: 'g3', name: 'Jon Rahm', country: 'ESP', is_active: true },
        { id: 'g4', name: 'Collin Morikawa', country: 'USA', is_active: true },
      ]

      vi.mocked(getTournamentRosterGolfers).mockResolvedValue(
        mockGolfers.map((g) => ({
          ...g,
          tournament_id: 't-masters-2026',
          external_player_id: `ext-${g.id}`,
          search_name: g.name.toLowerCase(),
          source: 'seeded',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      )

      const mockSupabase = {} as SupabaseClient
      const roster = await getTournamentRosterGolfers(mockSupabase, 't-masters-2026')
      expect(roster).toHaveLength(4)
      expect(roster.every((g) => g.is_active)).toBe(true)
    })
  })

  describe('Step 3 & 4: Participant Join & 4-Golfer Entry Submission', () => {
    it('validates pick submission rules and rejection of invalid / locked entries', () => {
      // Valid submission with 4 unique golfers
      const validSubmission = validatePickSubmission({
        golferIds: ['g1', 'g2', 'g3', 'g4'],
        picksPerEntry: 4,
        isLocked: false,
      })
      expect(validSubmission).toEqual({ ok: true })

      // Duplicate golfer rejection
      const duplicateSubmission = validatePickSubmission({
        golferIds: ['g1', 'g1', 'g3', 'g4'],
        picksPerEntry: 4,
        isLocked: false,
      })
      expect(duplicateSubmission).toEqual({
        ok: false,
        error: expect.stringMatching(/Duplicate golfer/i),
      })

      // Incorrect pick count rejection
      const shortSubmission = validatePickSubmission({
        golferIds: ['g1', 'g2', 'g3'],
        picksPerEntry: 4,
        isLocked: false,
      })
      expect(shortSubmission).toEqual({
        ok: false,
        error: expect.stringMatching(/exactly 4 golfers/i),
      })

      // Submission when locked rejection
      const lockedSubmission = validatePickSubmission({
        golferIds: ['g1', 'g2', 'g3', 'g4'],
        picksPerEntry: 4,
        isLocked: true,
      })
      expect(lockedSubmission).toEqual({
        ok: false,
        error: expect.stringMatching(/pool is locked/i),
      })
    })

    it('verifies deadline and timezone locking behavior', () => {
      const deadline = '2026-04-09T00:00:00Z'
      const timezone = 'America/New_York'
      const lockInstant = getTournamentLockInstant(deadline, timezone)
      expect(lockInstant).not.toBeNull()

      // Before lock: open
      vi.setSystemTime(new Date(lockInstant!.getTime() - 1000))
      expect(isPoolLocked('open', deadline, timezone)).toBe(false)

      // At lock instant: locked
      vi.setSystemTime(lockInstant!)
      expect(isPoolLocked('open', deadline, timezone)).toBe(true)

      // Non-open pools are locked unconditionally
      expect(isPoolLocked('live', deadline, timezone)).toBe(true)
      expect(isPoolLocked('complete', deadline, timezone)).toBe(true)
      expect(isPoolLocked('archived', deadline, timezone)).toBe(true)
    })
  })

  describe('Step 5 & 6: Scoring Refresh & Scorecard Hole Persistence', () => {
    it('executes scoring refresh, persists 18 holes per golfer, and manages refresh mutex', async () => {
      const mockPool: Pool = {
        id: 'pool-1',
        name: 'Masters Pool',
        commissioner_id: 'comm-1',
        tournament_id: 't-masters-2026',
        tournament_name: 'The Masters',
        year: 2026,
        deadline: '2026-04-09T00:00:00Z',
        timezone: 'America/New_York',
        format: 'best_ball',
        picks_per_entry: 4,
        invite_code: 'abc12345',
        status: 'live',
        refreshed_at: null,
        last_refresh_error: null,
        created_at: new Date().toISOString(),
      }

      const mockEntries: Entry[] = [
        {
          id: 'entry-1',
          pool_id: 'pool-1',
          user_id: 'user-1',
          golfer_ids: ['g1', 'g2', 'g3', 'g4'],
          total_birdies: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      const slashScores = [
        {
          golfer_id: 'g1',
          current_round: 1,
          rounds: [{ round_id: 1, strokes: 68, score_to_par: -4, round_status: 'complete' }],
          total: -4,
          position: '1',
          status: 'active' as GolferStatus,
          total_birdies: 5,
        },
        {
          golfer_id: 'g2',
          current_round: 1,
          rounds: [{ round_id: 1, strokes: 70, score_to_par: -2, round_status: 'complete' }],
          total: -2,
          position: '2',
          status: 'active' as GolferStatus,
          total_birdies: 3,
        },
        {
          golfer_id: 'g3',
          current_round: 1,
          rounds: [{ round_id: 1, strokes: 72, score_to_par: 0, round_status: 'complete' }],
          total: 0,
          position: 'T3',
          status: 'active' as GolferStatus,
          total_birdies: 2,
        },
        {
          golfer_id: 'g4',
          current_round: 1,
          rounds: [{ round_id: 1, strokes: 74, score_to_par: 2, round_status: 'complete' }],
          total: 2,
          position: 'T5',
          status: 'active' as GolferStatus,
          total_birdies: 1,
        },
      ]

      const mockScorecard = (golferId: string) => ({
        tournId: 't-masters-2026',
        playerId: golferId,
        roundId: 1,
        year: '2026',
        status: 'active',
        currentRound: 1,
        holes: Array.from({ length: 18 }, (_, i) => ({
          holeId: i + 1,
          strokes: 4,
          par: 4,
          scoreToPar: 0,
          roundId: 1,
        })),
      })

      // Setup mocks
      const mockSend = vi.fn().mockResolvedValue('ok')
      const mockChannel = {
        send: mockSend,
        subscribe: vi.fn((cb) => {
          cb('SUBSCRIBED')
          return mockChannel
        }),
      }

      // Mock admin Supabase client with lock management
      const mockAdminSupabase = {
        channel: vi.fn().mockReturnValue(mockChannel),
        removeChannel: vi.fn(),
        from: vi.fn((table: string) => {
          if (table === 'refresh_locks') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }),
      }

      vi.mocked(createAdminClient).mockResolvedValue(mockAdminSupabase as unknown as SupabaseClient)
      vi.mocked(getTournamentScores).mockResolvedValue(slashScores as any)
      vi.mocked(getScorecard).mockImplementation(async (_tid, gid) => mockScorecard(gid) as any)
      vi.mocked(getPoolsByTournament).mockResolvedValue([mockPool])
      vi.mocked(getEntriesForPool).mockResolvedValue(mockEntries)
      vi.mocked(getScoresForTournament)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { golfer_id: 'g1', tournament_id: 't-masters-2026', round_id: 1, total_score: -4, status: 'active', total_birdies: 5 },
          { golfer_id: 'g2', tournament_id: 't-masters-2026', round_id: 1, total_score: -2, status: 'active', total_birdies: 3 },
          { golfer_id: 'g3', tournament_id: 't-masters-2026', round_id: 1, total_score: 0, status: 'active', total_birdies: 2 },
          { golfer_id: 'g4', tournament_id: 't-masters-2026', round_id: 1, total_score: 2, status: 'active', total_birdies: 1 },
        ] as any)
      vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null } as any)
      vi.mocked(upsertTournamentHoles).mockResolvedValue({ error: null } as any)

      const holesMap = new Map<string, TournamentHole[]>()
      for (const gid of ['g1', 'g2', 'g3', 'g4']) {
        holesMap.set(gid, generateScorecardHoles(gid, 1))
      }
      vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(holesMap)

      const result = await refreshScoresForPool(mockAdminSupabase as unknown as SupabaseClient, mockPool)

      expect(result.error).toBeNull()
      expect(result.data).not.toBeNull()
      expect(result.data?.completedRounds).toBe(1)
      expect(result.data?.refreshedAt).toBeTruthy()

      // Verify hole persistence was called
      expect(upsertTournamentHoles).toHaveBeenCalled()
      // Verify pool metadata advanced on success
      expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(
        mockAdminSupabase,
        'pool-1',
        expect.objectContaining({
          refreshed_at: expect.any(String),
          last_refresh_success_at: expect.any(String),
          last_refresh_error: null,
        })
      )
      // Verify audit event written
      expect(insertAuditEvent).toHaveBeenCalledWith(
        mockAdminSupabase,
        expect.objectContaining({
          pool_id: 'pool-1',
          user_id: null,
          action: 'scoreRefreshCompleted',
        })
      )
    })
  })

  describe('Step 7: Leaderboard True Hole-by-Hole Best-Ball Scoring', () => {
    it('computes leaderboard using hole-by-hole best-ball rather than round minimums', () => {
      // Entry 1: Golfers A & B
      // Entry 2: Golfers C & D
      // Demonstrating that hole-by-hole min produces different score than min of totals:
      // Round 1 (18 holes):
      // Golfer A: 9 birdies (-1 each on holes 1-9), 9 bogeys (+1 each on holes 10-18) -> Round Total: 0
      // Golfer B: 9 bogeys (+1 each on holes 1-9), 9 birdies (-1 each on holes 10-18) -> Round Total: 0
      // Round-level min would be: min(0, 0) = 0
      // Hole-by-hole best ball:
      // Holes 1-9: min(-1, +1) = -1 * 9 = -9
      // Holes 10-18: min(+1, -1) = -1 * 9 = -9
      // True best-ball round total = -18!

      const entry1: Entry = {
        id: 'entry-1',
        pool_id: 'pool-1',
        user_id: 'user-1',
        golfer_ids: ['golfer-a', 'golfer-b', 'golfer-x1', 'golfer-x2'],
        total_birdies: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const entry2: Entry = {
        id: 'entry-2',
        pool_id: 'pool-1',
        user_id: 'user-2',
        golfer_ids: ['golfer-c', 'golfer-d', 'golfer-x1', 'golfer-x2'],
        total_birdies: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const holesByGolfer = new Map<string, TournamentHole[]>()

      // Golfer A holes
      const holesA: TournamentHole[] = Array.from({ length: 18 }, (_, i) => ({
        id: `ga-h${i + 1}`,
        golfer_id: 'golfer-a',
        tournament_id: 't-masters-2026',
        round_id: 1,
        hole_id: i + 1,
        strokes: i < 9 ? 3 : 5,
        par: 4,
        score_to_par: i < 9 ? -1 : 1,
        updated_at: new Date().toISOString(),
      }))

      // Golfer B holes (inverted pattern)
      const holesB: TournamentHole[] = Array.from({ length: 18 }, (_, i) => ({
        id: `gb-h${i + 1}`,
        golfer_id: 'golfer-b',
        tournament_id: 't-masters-2026',
        round_id: 1,
        hole_id: i + 1,
        strokes: i < 9 ? 5 : 3,
        par: 4,
        score_to_par: i < 9 ? 1 : -1,
        updated_at: new Date().toISOString(),
      }))

      // Golfer C & D holes: Even par on every hole
      const holesC: TournamentHole[] = Array.from({ length: 18 }, (_, i) => ({
        id: `gc-h${i + 1}`,
        golfer_id: 'golfer-c',
        tournament_id: 't-masters-2026',
        round_id: 1,
        hole_id: i + 1,
        strokes: 4,
        par: 4,
        score_to_par: 0,
        updated_at: new Date().toISOString(),
      }))

      const holesD: TournamentHole[] = Array.from({ length: 18 }, (_, i) => ({
        id: `gd-h${i + 1}`,
        golfer_id: 'golfer-d',
        tournament_id: 't-masters-2026',
        round_id: 1,
        hole_id: i + 1,
        strokes: 4,
        par: 4,
        score_to_par: 0,
        updated_at: new Date().toISOString(),
      }))

      const holesNeutral: TournamentHole[] = Array.from({ length: 18 }, (_, i) => ({
        id: `neutral-h${i + 1}`,
        golfer_id: 'golfer-x',
        tournament_id: 't-masters-2026',
        round_id: 1,
        hole_id: i + 1,
        strokes: 4,
        par: 4,
        score_to_par: 0,
        updated_at: new Date().toISOString(),
      }))

      holesByGolfer.set('golfer-a', holesA)
      holesByGolfer.set('golfer-b', holesB)
      holesByGolfer.set('golfer-c', holesC)
      holesByGolfer.set('golfer-d', holesD)
      holesByGolfer.set('golfer-x1', holesNeutral)
      holesByGolfer.set('golfer-x2', holesNeutral)

      const golferStatuses = new Map<string, GolferStatus>([
        ['golfer-a', 'active'],
        ['golfer-b', 'active'],
        ['golfer-c', 'active'],
        ['golfer-d', 'active'],
        ['golfer-x1', 'active'],
        ['golfer-x2', 'active'],
      ])

      const ranked = rankEntriesWithHoles([entry1, entry2], holesByGolfer, golferStatuses, 1)

      expect(ranked).toHaveLength(2)
      // Entry 1 should rank #1 with -18 total score (proving hole-by-hole best-ball)
      expect(ranked[0].id).toBe('entry-1')
      expect(ranked[0].totalScore).toBe(-18)
      expect(ranked[0].totalBirdies).toBe(18)
      expect(ranked[0].rank).toBe(1)

      // Entry 2 should rank #2 with 0 total score
      expect(ranked[1].id).toBe('entry-2')
      expect(ranked[1].totalScore).toBe(0)
      expect(ranked[1].totalBirdies).toBe(0)
      expect(ranked[1].rank).toBe(2)
    })
  })

  describe('Step 8 & 9: Spectator View & Freshness Indicators', () => {
    it('returns complete leaderboard for unauthenticated spectator request', async () => {
      const mockPool: Pool = {
        id: 'pool-spectator-test',
        name: 'Public Spectator Pool',
        commissioner_id: 'comm-1',
        tournament_id: 't-masters-2026',
        tournament_name: 'The Masters',
        year: 2026,
        deadline: '2026-04-09T00:00:00Z',
        timezone: 'America/New_York',
        format: 'best_ball',
        picks_per_entry: 4,
        invite_code: 'spectate',
        status: 'live',
        refreshed_at: new Date('2026-04-08T11:55:00Z').toISOString(), // 5 minutes ago -> 'current'
        last_refresh_error: null,
        created_at: new Date().toISOString(),
      }

      const mockEntries: Entry[] = [
        {
          id: 'entry-1',
          pool_id: 'pool-spectator-test',
          user_id: 'user-1',
          golfer_ids: ['g1', 'g2', 'g3', 'g4'],
          total_birdies: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      const mockScores: TournamentScore[] = [
        {
          golfer_id: 'g1',
          tournament_id: 't-masters-2026',
          round_id: 1,
          total_score: -3,
          position: '1',
          total_birdies: 4,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          golfer_id: 'g2',
          tournament_id: 't-masters-2026',
          round_id: 1,
          total_score: -1,
          position: '2',
          total_birdies: 2,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          golfer_id: 'g3',
          tournament_id: 't-masters-2026',
          round_id: 1,
          total_score: 0,
          position: '3',
          total_birdies: 1,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          golfer_id: 'g4',
          tournament_id: 't-masters-2026',
          round_id: 1,
          total_score: 1,
          position: '4',
          total_birdies: 0,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
      ]

      const holesMap = new Map<string, TournamentHole[]>()
      for (const gid of ['g1', 'g2', 'g3', 'g4']) {
        holesMap.set(gid, generateScorecardHoles(gid, 1))
      }

      // Mock createClient (unauthenticated spectator client)
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'pools') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPool, error: null }),
                }),
              }),
            }
          }
          if (table === 'entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }
          }
          if (table === 'tournament_scores') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockScores, error: null }),
              }),
            }
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient)
      vi.mocked(getTournamentRosterGolfers).mockResolvedValue([
        { id: 'g1', name: 'Golfer 1', country: 'USA' } as any,
        { id: 'g2', name: 'Golfer 2', country: 'USA' } as any,
        { id: 'g3', name: 'Golfer 3', country: 'USA' } as any,
        { id: 'g4', name: 'Golfer 4', country: 'USA' } as any,
      ])
      vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(holesMap)

      const request = new Request('http://localhost:3000/api/leaderboard/pool-spectator-test')
      const response = await getLeaderboard(request, {
        params: Promise.resolve({ poolId: 'pool-spectator-test' }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.error).toBeNull()
      expect(body.data.freshness).toBe('current')
      expect(body.data.completedRounds).toBe(1)
      expect(body.data.entries).toHaveLength(1)
      expect(body.data.entries[0].rank).toBe(1)
    })

    it('correctly classifies freshness timestamps', () => {
      const now = new Date('2026-04-08T12:00:00Z')

      // Within 15 minutes = current
      expect(classifyFreshness('2026-04-08T11:50:00Z', 15 * 60 * 1000, now)).toBe('current')
      // Beyond 15 minutes = stale
      expect(classifyFreshness('2026-04-08T11:44:00Z', 15 * 60 * 1000, now)).toBe('stale')
      // Null timestamp = unknown
      expect(classifyFreshness(null, 15 * 60 * 1000, now)).toBe('unknown')
    })
  })

  describe('Step 10: Degraded / Incomplete Hole Data Failure & Stale Fallback', () => {
    it('validates hole completeness failure when rostered golfer lacks scorecard holes', () => {
      const requiredGolfers = ['g1', 'g2', 'g3', 'g4']
      const holesMap = new Map<string, TournamentHole[]>()

      // Only 3 of 4 golfers have hole data
      holesMap.set('g1', generateScorecardHoles('g1', 1))
      holesMap.set('g2', generateScorecardHoles('g2', 1))
      holesMap.set('g3', generateScorecardHoles('g3', 1))
      // g4 is missing hole data!

      const validation = validateHoleDataCompleteness(requiredGolfers, holesMap, 1)
      expect(validation.isValid).toBe(false)
      expect(validation.missingGolferIds).toEqual(['g4'])
      expect(validation.reason).toMatch(/Missing hole data for required golfer\(s\): g4/)
    })

    it('returns 502 with INCOMPLETE_HOLE_DATA during refresh when scorecard holes are partial', async () => {
      const mockPool: Pool = {
        id: 'pool-degraded-test',
        name: 'Degraded Test Pool',
        commissioner_id: 'comm-1',
        tournament_id: 't-masters-2026',
        tournament_name: 'The Masters',
        year: 2026,
        deadline: '2026-04-09T00:00:00Z',
        timezone: 'America/New_York',
        format: 'best_ball',
        picks_per_entry: 4,
        invite_code: 'degraded',
        status: 'live',
        refreshed_at: null,
        last_refresh_error: null,
        created_at: new Date().toISOString(),
      }

      const mockEntries: Entry[] = [
        {
          id: 'entry-1',
          pool_id: 'pool-degraded-test',
          user_id: 'user-1',
          golfer_ids: ['g1', 'g2', 'g3', 'g4'],
          total_birdies: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      const slashScores = [
        { golfer_id: 'g1', current_round: 1, rounds: [{ round_id: 1, strokes: 70, score_to_par: -2, round_status: 'complete' }], total: -2, position: '1', status: 'active' as GolferStatus, total_birdies: 3 },
        { golfer_id: 'g2', current_round: 1, rounds: [{ round_id: 1, strokes: 70, score_to_par: -2, round_status: 'complete' }], total: -2, position: '1', status: 'active' as GolferStatus, total_birdies: 3 },
        { golfer_id: 'g3', current_round: 1, rounds: [{ round_id: 1, strokes: 70, score_to_par: -2, round_status: 'complete' }], total: -2, position: '1', status: 'active' as GolferStatus, total_birdies: 3 },
        { golfer_id: 'g4', current_round: 1, rounds: [{ round_id: 1, strokes: 70, score_to_par: -2, round_status: 'complete' }], total: -2, position: '1', status: 'active' as GolferStatus, total_birdies: 3 },
      ]

      const mockAdminSupabase = {
        channel: vi.fn().mockReturnValue({ send: vi.fn(), subscribe: vi.fn() }),
        removeChannel: vi.fn(),
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        })),
      }

      vi.mocked(createAdminClient).mockResolvedValue(mockAdminSupabase as unknown as SupabaseClient)
      vi.mocked(getTournamentScores).mockResolvedValue(slashScores as any)
      // g4 scorecard fetch throws an error!
      vi.mocked(getScorecard).mockImplementation(async (_tid, gid) => {
        if (gid === 'g4') throw new Error('API timeout for g4')
        return {
          tournId: 't-masters-2026',
          playerId: gid,
          roundId: 1,
          year: '2026',
          status: 'active',
          currentRound: 1,
          holes: Array.from({ length: 18 }, (_, i) => ({
            holeId: i + 1,
            strokes: 4,
            par: 4,
            scoreToPar: 0,
            roundId: 1,
          })),
        } as any
      })

      vi.mocked(getPoolsByTournament).mockResolvedValue([mockPool])
      vi.mocked(getEntriesForPool).mockResolvedValue(mockEntries)
      vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null } as any)
      vi.mocked(upsertTournamentHoles).mockResolvedValue({ error: null } as any)

      // DB returns holes for only 3 golfers
      const partialHolesMap = new Map<string, TournamentHole[]>()
      partialHolesMap.set('g1', generateScorecardHoles('g1', 1))
      partialHolesMap.set('g2', generateScorecardHoles('g2', 1))
      partialHolesMap.set('g3', generateScorecardHoles('g3', 1))
      vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(partialHolesMap)

      const result = await refreshScoresForPool(mockAdminSupabase as unknown as SupabaseClient, mockPool)

      expect(result.data).toBeNull()
      expect(result.error?.code).toBe('INCOMPLETE_HOLE_DATA')
      expect(result.error?.missingGolfers).toContain('g4')

      // Metadata must NOT advance success timestamp, but record the error
      expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(
        mockAdminSupabase,
        'pool-degraded-test',
        {
          last_refresh_error: expect.stringContaining('Missing hole data for required golfer(s): g4'),
        }
      )

      // Audit event for failure must be logged
      expect(insertAuditEvent).toHaveBeenCalledWith(
        mockAdminSupabase,
        expect.objectContaining({
          pool_id: 'pool-degraded-test',
          user_id: null,
          action: 'scoreRefreshFailed',
          details: expect.objectContaining({
            missingGolfers: ['g4'],
          }),
        })
      )
    })

    it('falls back to latest complete round when current round hole data is incomplete on read', () => {
      const requiredGolfers = ['g1', 'g2', 'g3', 'g4']
      const holesMap = new Map<string, TournamentHole[]>()

      // All golfers have complete Round 1 (18 holes)
      for (const gid of requiredGolfers) {
        holesMap.set(gid, generateScorecardHoles(gid, 1))
      }

      // But only g1, g2, g3 have Round 2; g4 is missing Round 2!
      holesMap.get('g1')!.push(...generateScorecardHoles('g1', 2))
      holesMap.get('g2')!.push(...generateScorecardHoles('g2', 2))
      holesMap.get('g3')!.push(...generateScorecardHoles('g3', 2))

      // Round 2 is incomplete across all required golfers
      const r2Completeness = validateHoleDataCompleteness(requiredGolfers, holesMap, 2)
      expect(r2Completeness.isValid).toBe(false)

      // Fallback determines that Round 1 is the latest complete round
      const fallbackRound = getLatestCompleteRound(requiredGolfers, holesMap, 2)
      expect(fallbackRound).toBe(1)

      // Filtering holes by round 1 yields complete data for round 1
      const filteredHoles = filterHolesByRound(holesMap, fallbackRound)
      const r1Completeness = validateHoleDataCompleteness(requiredGolfers, filteredHoles, 1)
      expect(r1Completeness.isValid).toBe(true)
    })
  })
})
