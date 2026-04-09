import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { searchPlayers } from '@/lib/golfer-catalog/rapidapi'
import { buildManualAddQuery, decideCatalogRun } from '@/lib/golfer-catalog/service'
import { getMonthlyApiUsage, insertGolferSyncRun } from '@/lib/golfer-catalog/queries'
import { getGolfers } from '@/lib/slash-golf/client'
import { getPoolById, insertAuditEvent, updatePoolConfig, updatePoolStatus } from '@/lib/pool-queries'
import { canReopenPool } from '@/lib/pool'
import { buildTournamentRosterInsert } from '@/lib/tournament-roster/queries'

import { startPool, updatePoolConfigAction, reopenPool, archivePool } from '../actions'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('redirect') }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/golfer-catalog/rapidapi', () => ({
  searchPlayers: vi.fn(),
}))

vi.mock('@/lib/golfer-catalog/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/golfer-catalog/service')>('@/lib/golfer-catalog/service')
  return {
    ...actual,
    buildManualAddQuery: vi.fn(),
    decideCatalogRun: vi.fn(),
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

vi.mock('@/lib/slash-golf/client', () => ({
  getGolfers: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
  updatePoolStatus: vi.fn().mockResolvedValue({ error: null }),
  updatePoolConfig: vi.fn(),
  insertAuditEvent: vi.fn().mockResolvedValue({ error: null }),
  insertPool: vi.fn(),
  insertPoolMember: vi.fn(),
}))

vi.mock('@/lib/pool', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pool')>('@/lib/pool')
  return {
    ...actual,
    canReopenPool: vi.fn(),
  }
})

vi.mock('@/lib/tournament-roster/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tournament-roster/queries')>('@/lib/tournament-roster/queries')
  return {
    ...actual,
    buildTournamentRosterInsert: vi.fn(actual.buildTournamentRosterInsert),
  }
})

const commissioner = { id: 'user-1' }
const lockedPool = {
  id: 'pool-1',
  commissioner_id: 'user-1',
  name: 'Masters Pool',
  tournament_id: 'tournament-1',
  tournament_name: 'The Masters',
  year: 2026,
  deadline: '2026-04-09T00:00:00+00:00',
  timezone: 'America/New_York',
  format: 'best_ball',
  picks_per_entry: 4,
  invite_code: 'invite1',
  status: 'open',
  created_at: '2026-04-01T00:00:00Z',
  refreshed_at: null,
  last_refresh_error: null,
}

const completedPool = {
  ...lockedPool,
  status: 'complete',
}

function mockAuthenticatedClient() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: commissioner } }),
    },
  } as never)
}

describe('commissioner pool lock actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-09T05:00:00Z'))
    mockAuthenticatedClient()
    vi.mocked(getPoolById).mockResolvedValue(lockedPool as never)
    vi.mocked(getMonthlyApiUsage).mockResolvedValue(0)
    vi.mocked(insertGolferSyncRun).mockResolvedValue({ data: null, error: null })
    vi.mocked(decideCatalogRun).mockReturnValue({ allowed: true })
    vi.mocked(buildManualAddQuery).mockReturnValue({ firstName: 'Collin', lastName: 'Morikawa' })
    vi.mocked(searchPlayers).mockResolvedValue([])
    vi.mocked(getGolfers).mockResolvedValue([])
    vi.mocked(buildTournamentRosterInsert).mockImplementation((args) => ({
      tournament_id: args.tournamentId,
      id: 'golfer-1',
      external_player_id: 'golfer-1',
      name: 'Golfer',
      search_name: 'golfer',
      country: '',
      world_rank: null,
      is_active: true,
      source: args.source,
      last_synced_at: args.syncedAt,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks manually starting an open pool after its lock instant', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(startPool(null, formData)).resolves.toEqual({
      error: 'This pool is locked. It can no longer be started.',
    })

    expect(updatePoolStatus).not.toHaveBeenCalled()
    expect(insertAuditEvent).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('blocks commissioner config changes after the lock instant even if the new deadline is future-dated', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('tournamentId', 'tournament-2')
    formData.set('tournamentName', 'The Masters 2027')
    formData.set('year', '2027')
    formData.set('deadline', '2026-04-15T00:00:00+00:00')
    formData.set('timezone', 'America/New_York')
    formData.set('format', 'best_ball')
    formData.set('picksPerEntry', '4')

    await expect(updatePoolConfigAction(null, formData)).resolves.toEqual({
      error: 'This pool is locked. Configuration can no longer be changed.',
    })

    expect(updatePoolConfig).not.toHaveBeenCalled()
    expect(insertAuditEvent).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('reopenPool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T05:00:00Z'))
    mockAuthenticatedClient()
    vi.mocked(getPoolById).mockResolvedValue(completedPool as never)
    vi.mocked(canReopenPool).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reopens a completed pool before the deadline', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(reopenPool(null, formData)).rejects.toThrow('redirect')

    expect(updatePoolStatus).toHaveBeenCalledWith(expect.anything(), 'pool-1', 'open', 'complete')
    expect(insertAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'poolReopened',
        details: { previousStatus: 'complete' },
      })
    )
  })

  it('archives a completed pool', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(archivePool(null, formData)).rejects.toThrow('redirect')

    expect(updatePoolStatus).toHaveBeenCalledWith(expect.anything(), 'pool-1', 'archived', 'complete')
    expect(insertAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'poolArchived',
        details: { previousStatus: 'complete' },
      })
    )
  })

  it('rejects reopening after the deadline has passed', async () => {
    vi.setSystemTime(new Date('2026-04-10T05:00:00Z'))
    vi.mocked(canReopenPool).mockReturnValue(false)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(reopenPool(null, formData)).resolves.toEqual({
      error: 'This pool can no longer be reopened because the deadline has passed.',
    })

    expect(updatePoolStatus).not.toHaveBeenCalled()
  })

  it('reopens a live pool before the deadline', async () => {
    vi.setSystemTime(new Date('2026-04-08T05:00:00Z'))
    vi.mocked(getPoolById).mockResolvedValue({ ...completedPool, status: 'live' } as never)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(reopenPool(null, formData)).rejects.toThrow('redirect')

    expect(updatePoolStatus).toHaveBeenCalledWith(expect.anything(), 'pool-1', 'open', 'live')
    expect(insertAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'poolReopened',
        details: { previousStatus: 'live' },
      })
    )
  })
})
