import { beforeEach, describe, expect, it, vi } from 'vitest'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyApiUsage, insertGolferSyncRun } from '@/lib/golfer-catalog/queries'
import { buildManualAddQuery, decideCatalogRun } from '@/lib/golfer-catalog/service'
import { searchPlayers } from '@/lib/golfer-catalog/rapidapi'
import { getPoolById } from '@/lib/pool-queries'
import { getGolfers } from '@/lib/slash-golf/client'
import { buildTournamentRosterInsert } from '@/lib/tournament-roster/queries'

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
    buildManualAddQuery: vi.fn(),
  }
})

vi.mock('@/lib/golfer-catalog/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/golfer-catalog/queries')>('@/lib/golfer-catalog/queries')
  return {
    ...actual,
    getMonthlyApiUsage: vi.fn(),
    insertGolferSyncRun: vi.fn(),
  }
})

vi.mock('@/lib/golfer-catalog/rapidapi', () => ({
  searchPlayers: vi.fn(),
}))

vi.mock('@/lib/slash-golf/client', () => ({
  getGolfers: vi.fn(),
}))

vi.mock('@/lib/tournament-roster/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tournament-roster/queries')>('@/lib/tournament-roster/queries')
  return {
    ...actual,
    buildTournamentRosterInsert: vi.fn(actual.buildTournamentRosterInsert),
  }
})

import { addMissingGolferAction, refreshGolferCatalogAction } from '../actions'

const commissioner = { id: 'user-1' }
const pool = {
  id: 'pool-1',
  commissioner_id: 'user-1',
  tournament_id: 'tournament-1',
  year: 2026,
}

let supabaseMock: any
let upsertMock: ReturnType<typeof vi.fn>

function mockAuthenticatedSupabase() {
  upsertMock = vi.fn().mockResolvedValue({ error: null })
  supabaseMock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: commissioner } }),
    },
    from: vi.fn(() => ({ upsert: upsertMock })),
  }

  vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

  return { supabase: supabaseMock, upsert: upsertMock }
}

describe('tournament roster commissioner actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockAuthenticatedSupabase()
    vi.mocked(getPoolById).mockResolvedValue(pool as never)
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(0)
    vi.mocked(insertGolferSyncRun).mockResolvedValue({ data: null, error: null })
  })

  it('refreshes the tournament roster for the pool tournament', async () => {
    const golfers = [
      {
        id: '50525',
        name: 'Collin Morikawa',
        country: 'USA',
        playerId: '50525',
        firstName: 'Collin',
        lastName: 'Morikawa',
        worldRank: 4,
      },
    ]

    vi.mocked(getMonthlyApiUsage).mockResolvedValue(199)
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(getGolfers).mockResolvedValue(golfers)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'manual_add')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({ success: true })

    expect(getMonthlyApiUsage).toHaveBeenCalledWith(expect.anything(), expect.any(Date))
    expect(getGolfers).toHaveBeenCalledWith('tournament-1', 2026)
    expect(buildTournamentRosterInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament-1',
        source: 'refresh',
        syncedAt: expect.any(String),
      }),
    )
    expect(supabaseMock.from).toHaveBeenCalledWith('tournament_golfers')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tournament_id: 'tournament-1',
          id: '50525',
          external_player_id: '50525',
          name: 'Collin Morikawa',
          search_name: 'collin morikawa',
          country: 'USA',
          world_rank: 4,
          is_active: true,
          source: 'refresh',
        }),
      ]),
      { onConflict: 'tournament_id,external_player_id' },
    )
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

  it('adds a missing golfer to the tournament roster', async () => {
    const player = {
      playerId: '50525',
      firstName: 'Collin',
      lastName: 'Morikawa',
      country: 'USA',
      worldRank: 4,
    }

    vi.mocked(getMonthlyApiUsage).mockResolvedValue(12)
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([player])

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({ success: true })

    expect(getMonthlyApiUsage).toHaveBeenCalledWith(expect.anything(), expect.any(Date))
    expect(searchPlayers).toHaveBeenCalledWith({ firstName: 'Collin', lastName: 'Morikawa' })
    expect(buildTournamentRosterInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament-1',
        source: 'manual_add',
        syncedAt: expect.any(String),
      }),
    )
    expect(supabaseMock.from).toHaveBeenCalledWith('tournament_golfers')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tournament_id: 'tournament-1',
          id: '50525',
          external_player_id: '50525',
          name: 'Collin Morikawa',
          search_name: 'collin morikawa',
          country: 'USA',
          world_rank: 4,
          is_active: true,
          source: 'manual_add',
        }),
      ]),
      { onConflict: 'tournament_id,external_player_id' },
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

})
