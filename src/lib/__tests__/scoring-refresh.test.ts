import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshScoresForPool } from '../scoring-refresh'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTournamentScores, getScorecard } from '@/lib/slash-golf/client'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
  upsertTournamentHoles,
  getTournamentHolesForGolfers,
} from '@/lib/scoring-queries'
import { rankEntriesWithHoles } from '@/lib/scoring'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getTournamentScores: vi.fn(),
  getScorecard: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  buildRefreshAuditDetails: vi.fn(),
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
  upsertTournamentHoles: vi.fn(),
  getTournamentHolesForGolfers: vi.fn(),
}))

vi.mock('@/lib/scoring', () => ({
  rankEntriesWithHoles: vi.fn(),
}))

const originalEnv = { ...process.env }

describe('refreshScoresForPool', () => {
  function createMockSupabase() {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'tournament_score_rounds') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
      channel: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as never
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('happy path: fetches scores, upserts, broadcasts, returns { data, error: null }', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { golfer_id: 'g1', total_score: -2, total_birdies: 1, status: 'active', round_id: 1 },
      ] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active', current_round: 1 },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool).mockResolvedValue([{ id: 'entry-1' }] as never)
    vi.mocked(getScorecard).mockResolvedValue({
      tournId: 't-1', playerId: 'g1', roundId: 1, year: '2026', status: 'active', currentRound: 1, holes: [],
    } as never)
    vi.mocked(upsertTournamentHoles).mockResolvedValue({ error: null })
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map() as never)
    vi.mocked(rankEntriesWithHoles).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(result.data!.completedRounds).toBe(1)
    expect(result.data!.refreshedAt).toBeTruthy()
    expect(getTournamentScores).toHaveBeenCalledWith('t-1', 2026)
    expect(upsertTournamentScore).toHaveBeenCalled()
    expect(updatePoolRefreshMetadata).toHaveBeenCalled()
    expect(insertAuditEvent).toHaveBeenCalled()
  })

  it('external API failure: returns { data: null, error: { code: "FETCH_FAILED" } }', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockRejectedValue(new Error('API timeout'))
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('FETCH_FAILED')
    expect(result.error!.message).toBe('API timeout')
  })

  it('upsert failure: returns { data: null, error: { code: "UPSERT_FAILED" } }', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: 'duplicate key' })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('UPSERT_FAILED')
  })

  it('broadcasts to all live pools on the same tournament', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
      { id: 'pool-2', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool)
      .mockResolvedValueOnce([{ id: 'entry-1' }] as never)
      .mockResolvedValueOnce([{ id: 'entry-2' }] as never)
    vi.mocked(getScorecard).mockResolvedValue({
      tournId: 't-1', playerId: 'g1', roundId: 1, year: '2026', status: 'active', currentRound: 1, holes: [],
    } as never)
    vi.mocked(upsertTournamentHoles).mockResolvedValue({ error: null })
    vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map() as never)
    vi.mocked(rankEntriesWithHoles).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    await refreshScoresForPool(mockSupabase, pool)

    expect(getEntriesForPool).toHaveBeenCalledWith(mockSupabase, 'pool-1')
    expect(getEntriesForPool).toHaveBeenCalledWith(mockSupabase, 'pool-2')
    expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(mockSupabase, 'pool-1', expect.any(Object))
    expect(updatePoolRefreshMetadata).toHaveBeenCalledWith(mockSupabase, 'pool-2', expect.any(Object))
  })
})
