import { beforeEach, describe, expect, it, vi } from 'vitest'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPoolById, insertAuditEvent, insertPool, insertPoolMember, updatePoolConfig, updatePoolStatus } from '@/lib/pool-queries'
import {
  buildGolferUpsertPayload,
  buildManualAddQuery,
  buildTournamentFieldUpsertRows,
  decideCatalogRun,
} from '@/lib/golfer-catalog/service'
import {
  getGolferByExternalPlayerId,
  getMonthlyApiUsage,
  insertGolferSyncRun,
  upsertGolfers,
} from '@/lib/golfer-catalog/queries'
import { searchPlayers } from '@/lib/golfer-catalog/rapidapi'
import { getGolfers } from '@/lib/slash-golf/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
  updatePoolStatus: vi.fn(),
  updatePoolConfig: vi.fn(),
  insertAuditEvent: vi.fn(),
  insertPool: vi.fn(),
  insertPoolMember: vi.fn(),
}))

vi.mock('@/lib/golfer-catalog/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/golfer-catalog/service')>('@/lib/golfer-catalog/service')
  return {
    ...actual,
    decideCatalogRun: vi.fn(),
    buildTournamentFieldUpsertRows: vi.fn(),
    buildManualAddQuery: vi.fn(),
    buildGolferUpsertPayload: vi.fn(),
  }
})

vi.mock('@/lib/golfer-catalog/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/golfer-catalog/queries')>('@/lib/golfer-catalog/queries')
  return {
    ...actual,
    getMonthlyApiUsage: vi.fn(),
    upsertGolfers: vi.fn(),
    insertGolferSyncRun: vi.fn(),
    getGolferByExternalPlayerId: vi.fn(),
  }
})

vi.mock('@/lib/golfer-catalog/rapidapi', () => ({
  searchPlayers: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getGolfers: vi.fn(),
}))

import { addMissingGolferAction, refreshGolferCatalogAction } from '../actions'

const commissioner = { id: 'user-1' }
const pool = {
  id: 'pool-1',
  commissioner_id: 'user-1',
  tournament_id: 'tournament-1',
  year: 2026,
}

function mockAuthenticatedSupabase() {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: commissioner } }),
    },
  }

  vi.mocked(createClient).mockResolvedValue(supabase as never)

  return supabase
}

describe('golfer catalog commissioner actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockAuthenticatedSupabase()
    vi.mocked(getPoolById).mockResolvedValue(pool as never)
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(0)
    vi.mocked(insertGolferSyncRun).mockResolvedValue({ data: null, error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null } as never)
    vi.mocked(insertPool).mockResolvedValue({ data: null, error: null } as never)
    vi.mocked(insertPoolMember).mockResolvedValue({ error: null } as never)
    vi.mocked(updatePoolConfig).mockResolvedValue({ error: null } as never)
    vi.mocked(updatePoolStatus).mockResolvedValue({ error: null } as never)
  })

  it('returns success only after a tournament refresh upserts golfers and records usage', async () => {
    const rows = [
      {
        id: 'g1',
        name: 'Collin Morikawa',
        country: 'USA',
        search_name: 'collin morikawa',
        world_rank: null,
        is_active: true,
        source: 'tournament_sync' as const,
        external_player_id: 'g1',
        last_synced_at: '2026-03-31T00:00:00.000Z',
      },
    ]

    vi.mocked(getMonthlyApiUsage).mockResolvedValue(199)
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(getGolfers).mockResolvedValue([{ id: 'g1', name: 'Collin Morikawa', country: 'USA' }])
    vi.mocked(buildTournamentFieldUpsertRows).mockReturnValue(rows)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: null })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({ success: true })

    expect(getMonthlyApiUsage).toHaveBeenCalledWith(expect.anything(), expect.any(Date))
    expect(decideCatalogRun).toHaveBeenCalledWith({
      runType: 'pre_tournament',
      usedCalls: 199,
      monthlyLimit: 250,
      warningAt: 200,
      blockBulkAt: 235,
    })
    expect(getGolfers).toHaveBeenCalledWith('tournament-1', 2026)
    expect(buildTournamentFieldUpsertRows).toHaveBeenCalledWith(
      [{ id: 'g1', name: 'Collin Morikawa', country: 'USA' }],
      expect.any(String),
    )
    expect(upsertGolfers).toHaveBeenCalledWith(expect.anything(), rows)
    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'pre_tournament',
        requested_by: 'user-1',
        tournament_id: 'tournament-1',
        api_calls_used: 1,
        status: 'success',
        summary: { golfers_upserted: 1 },
        error_message: null,
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/commissioner/pools/pool-1')
  })

  it('returns a controlled error when monthly quota lookup fails during refresh', async () => {
    vi.mocked(getMonthlyApiUsage).mockRejectedValue(new Error('quota unavailable'))

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Failed to load golfer catalog usage.',
    })

    expect(decideCatalogRun).not.toHaveBeenCalled()
    expect(insertGolferSyncRun).not.toHaveBeenCalled()
  })

  it('returns an explicit error when refresh sync-run logging fails', async () => {
    const rows = [
      {
        id: 'g1',
        name: 'Collin Morikawa',
        country: 'USA',
        search_name: 'collin morikawa',
        world_rank: null,
        is_active: true,
        source: 'tournament_sync' as const,
        external_player_id: 'g1',
        last_synced_at: '2026-03-31T00:00:00.000Z',
      },
    ]

    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(getGolfers).mockResolvedValue([{ id: 'g1', name: 'Collin Morikawa', country: 'USA' }])
    vi.mocked(buildTournamentFieldUpsertRows).mockReturnValue(rows)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: null })
    vi.mocked(insertGolferSyncRun).mockResolvedValue({ data: null, error: 'insert failed' })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Failed to record golfer catalog sync run.',
    })

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('logs and returns the blocked quota message for refresh attempts', async () => {
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(235)
    vi.mocked(decideCatalogRun).mockReturnValue({
      allowed: false,
      reason: 'Monthly API budget is reserved for manual golfer adds.',
    })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Monthly API budget is reserved for manual golfer adds.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'pre_tournament',
        api_calls_used: 0,
        status: 'blocked',
        error_message: 'Monthly API budget is reserved for manual golfer adds.',
      }),
    )
    expect(getGolfers).not.toHaveBeenCalled()
  })

  it('records blocked sync runs without consuming API calls', async () => {
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(235)
    vi.mocked(decideCatalogRun).mockReturnValue({
      allowed: false,
      reason: 'Monthly API budget is reserved for manual golfer adds.',
    })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'monthly_baseline')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Monthly API budget is reserved for manual golfer adds.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'monthly_baseline',
        requested_by: 'user-1',
        tournament_id: 'tournament-1',
        api_calls_used: 0,
        status: 'blocked',
        summary: { reason: 'Monthly API budget is reserved for manual golfer adds.' },
        error_message: 'Monthly API budget is reserved for manual golfer adds.',
      }),
    )
    expect(getGolfers).not.toHaveBeenCalled()
  })

  it('logs and returns a refresh failure when tournament golfer loading fails', async () => {
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(getGolfers).mockRejectedValue(new Error('rapidapi failed'))

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Failed to refresh golfer catalog.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'pre_tournament',
        api_calls_used: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        error_message: 'Failed to refresh golfer catalog.',
      }),
    )
    expect(upsertGolfers).not.toHaveBeenCalled()
  })

  it('logs and returns a refresh failure when golfer upsert fails', async () => {
    const rows = [
      {
        id: 'g1',
        name: 'Collin Morikawa',
        country: 'USA',
        search_name: 'collin morikawa',
        world_rank: null,
        is_active: true,
        source: 'tournament_sync' as const,
        external_player_id: 'g1',
        last_synced_at: '2026-03-31T00:00:00.000Z',
      },
    ]

    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(getGolfers).mockResolvedValue([{ id: 'g1', name: 'Collin Morikawa', country: 'USA' }])
    vi.mocked(buildTournamentFieldUpsertRows).mockReturnValue(rows)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: 'upsert failed' })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({
      error: 'Failed to refresh golfer catalog.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'pre_tournament',
        api_calls_used: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        error_message: 'upsert failed',
      }),
    )
  })

  it('adds a missing golfer and records one API call', async () => {
    const player = {
      playerId: '50525',
      firstName: 'Collin',
      lastName: 'Morikawa',
      country: 'USA',
      worldRank: 4,
    }
    const upsertPayload = {
      id: '50525',
      external_player_id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: 4,
      is_active: true,
      source: 'manual_add' as const,
    }

    vi.mocked(getMonthlyApiUsage).mockResolvedValue(12)
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([player])
    vi.mocked(getGolferByExternalPlayerId).mockResolvedValue(null)
    vi.mocked(buildGolferUpsertPayload).mockReturnValue(upsertPayload)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: null })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({ success: true })

    expect(decideCatalogRun).toHaveBeenCalledWith({
      runType: 'manual_add',
      usedCalls: 12,
      monthlyLimit: 250,
      warningAt: 200,
      blockBulkAt: 235,
    })
    expect(buildManualAddQuery).toHaveBeenCalledWith({ firstName: 'Collin', lastName: 'Morikawa' })
    expect(searchPlayers).toHaveBeenCalledWith({ firstName: 'Collin', lastName: 'Morikawa' })
    expect(getGolferByExternalPlayerId).toHaveBeenCalledWith(expect.anything(), '50525')
    expect(upsertGolfers).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ ...upsertPayload, last_synced_at: expect.any(String) })],
    )
    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        requested_by: 'user-1',
        tournament_id: 'tournament-1',
        api_calls_used: 1,
        status: 'success',
        summary: { golfers_upserted: 1, golfer_name: 'Collin Morikawa' },
        error_message: null,
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/commissioner/pools/pool-1')
  })

  it('returns a controlled error when monthly quota lookup fails during manual add', async () => {
    vi.mocked(getMonthlyApiUsage).mockRejectedValue(new Error('quota unavailable'))

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'Failed to load golfer catalog usage.',
    })

    expect(decideCatalogRun).not.toHaveBeenCalled()
    expect(insertGolferSyncRun).not.toHaveBeenCalled()
  })

  it('returns an explicit error when manual-add sync-run logging fails', async () => {
    const player = {
      playerId: '50525',
      firstName: 'Collin',
      lastName: 'Morikawa',
      country: 'USA',
      worldRank: 4,
    }
    const upsertPayload = {
      id: '50525',
      external_player_id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: 4,
      is_active: true,
      source: 'manual_add' as const,
    }

    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([player])
    vi.mocked(getGolferByExternalPlayerId).mockResolvedValue(null)
    vi.mocked(buildGolferUpsertPayload).mockReturnValue(upsertPayload)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: null })
    vi.mocked(insertGolferSyncRun).mockResolvedValue({ data: null, error: 'insert failed' })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'Failed to record golfer catalog sync run.',
    })

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('logs and returns the blocked quota message for manual adds', async () => {
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(250)
    vi.mocked(decideCatalogRun).mockReturnValue({
      allowed: false,
      reason: 'Monthly API budget is exhausted.',
    })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'Monthly API budget is exhausted.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        api_calls_used: 0,
        status: 'blocked',
        error_message: 'Monthly API budget is exhausted.',
      }),
    )
    expect(searchPlayers).not.toHaveBeenCalled()
  })

  it('logs and returns a no-match failure for manual add searches', async () => {
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([])

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'No golfer matched that search.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        api_calls_used: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        error_message: 'No golfer matched that search.',
      }),
    )
    expect(upsertGolfers).not.toHaveBeenCalled()
  })

  it('records one API call for manual add even when no golfer matches', async () => {
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([])

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'No golfer matched that search.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        requested_by: 'user-1',
        tournament_id: 'tournament-1',
        api_calls_used: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        error_message: 'No golfer matched that search.',
      }),
    )
    expect(upsertGolfers).not.toHaveBeenCalled()
  })

  it('logs and returns a manual-add failure when golfer upsert fails', async () => {
    const player = {
      playerId: '50525',
      firstName: 'Collin',
      lastName: 'Morikawa',
      country: 'USA',
      worldRank: 4,
    }
    const upsertPayload = {
      id: '50525',
      external_player_id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: 4,
      is_active: true,
      source: 'manual_add' as const,
    }

    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([player])
    vi.mocked(getGolferByExternalPlayerId).mockResolvedValue(null)
    vi.mocked(buildGolferUpsertPayload).mockReturnValue(upsertPayload)
    vi.mocked(upsertGolfers).mockResolvedValue({ error: 'upsert failed' })

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({
      error: 'Failed to add golfer.',
    })

    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        api_calls_used: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        error_message: 'upsert failed',
      }),
    )
  })

  it('records a no-op success when the golfer already exists', async () => {
    const player = {
      playerId: '50525',
      firstName: 'Collin',
      lastName: 'Morikawa',
      country: 'USA',
      worldRank: 4,
    }

    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([player])
    vi.mocked(getGolferByExternalPlayerId).mockResolvedValue({
      id: '50525',
      external_player_id: '50525',
    } as never)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({ success: true })

    expect(upsertGolfers).not.toHaveBeenCalled()
    expect(insertGolferSyncRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        run_type: 'manual_add',
        api_calls_used: 1,
        status: 'success',
        summary: { golfers_upserted: 0, golfer_name: 'Collin Morikawa' },
        error_message: null,
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/commissioner/pools/pool-1')
  })
})
