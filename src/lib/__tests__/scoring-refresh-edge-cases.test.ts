import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshScoresForPool } from '../scoring-refresh'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries, deriveCompletedRounds } from '@/lib/scoring/domain'
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
  getTournamentScoreRounds,
} from '@/lib/scoring-queries'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getTournamentScores: vi.fn(),
}))

vi.mock('@/lib/scoring/domain', () => ({
  rankEntries: vi.fn(),
  deriveCompletedRounds: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  buildRefreshAuditDetails: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolsByTournament: vi.fn(),
  getEntriesForPool: vi.fn(),
  updatePoolRefreshMetadata: vi.fn(),
  insertAuditEvent: vi.fn(),
}))

vi.mock('@/lib/scoring-queries', () => ({
  upsertTournamentScore: vi.fn(),
  getScoresForTournament: vi.fn(),
  getTournamentScoreRounds: vi.fn(),
}))

describe('scoring refresh edge cases', () => {
  function createMockSupabase() {
    return {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Unexpected table call')
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
  })

  it('API returns empty slashScores → NO_SCORES error', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([])
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('NO_SCORES')
    expect(result.error!.message).toBe('No golfers returned from scoring API')
  })

  it('partial upsert failure: 3 golfers, 2 OK, 1 fails → UPSERT_FAILED', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
      { golfer_id: 'g2', total: -1, total_birdies: 0, status: 'active' },
      { golfer_id: 'g3', total: 0, total_birdies: 0, status: 'active' },
    ] as never)

    vi.mocked(upsertTournamentScore)
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: 'duplicate key' })

    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.code).toBe('UPSERT_FAILED')
    expect(result.error!.message).toContain('Failed to persist')
  })

  it('updatePoolRefreshMetadata fails on success path → returns success (audit failure is non-fatal)', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata)
      .mockResolvedValueOnce({ error: 'connection refused' })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([] as never)
    vi.mocked(getEntriesForPool).mockResolvedValue([{ id: 'entry-1' }] as never)
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  it('insertAuditEvent fails on success path → returns success (audit failure is non-fatal)', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament).mockResolvedValue([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: -2, total_birdies: 1, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: 'insert failed' })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([] as never)
    vi.mocked(getEntriesForPool).mockResolvedValue([{ id: 'entry-1' }] as never)
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  it('getEntriesForPool returns empty array → broadcast sends with empty ranked array', async () => {
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
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool).mockResolvedValue([])
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 1,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(1)

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  it('deriveCompletedRounds === 0 (tournament not started) → returns success with completedRounds 0', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    const mockSupabase = createMockSupabase()

    vi.mocked(getPoolsByTournament).mockResolvedValue([
      { id: 'pool-1', tournament_id: 't-1', status: 'live' },
    ] as never)
    vi.mocked(getScoresForTournament)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(getTournamentScores).mockResolvedValue([
      { golfer_id: 'g1', total: null, total_birdies: 0, status: 'active' },
    ] as never)
    vi.mocked(upsertTournamentScore).mockResolvedValue({ error: null })
    vi.mocked(updatePoolRefreshMetadata).mockResolvedValue({ error: null })
    vi.mocked(getEntriesForPool).mockResolvedValue([{ id: 'entry-1' }] as never)
    vi.mocked(rankEntries).mockReturnValue([])
    vi.mocked(buildRefreshAuditDetails).mockReturnValue({
      completedRounds: 0,
      golferCount: 1,
      changedGolfers: ['g1'],
      newGolfers: [],
      droppedGolfers: [],
      diffs: {},
    })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(getTournamentScoreRounds).mockResolvedValue([])
    vi.mocked(deriveCompletedRounds).mockReturnValue(0)

    const result = await refreshScoresForPool(mockSupabase, pool)

    expect(result.error).toBeNull()
    expect(result.data!.completedRounds).toBe(0)
  })
})