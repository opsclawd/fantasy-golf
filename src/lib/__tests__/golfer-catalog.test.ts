import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildSearchName, filterLocalGolfers, isBulkRefreshBlocked } from '@/lib/golfer-catalog/normalize'
import { searchPlayers } from '@/lib/golfer-catalog/rapidapi'
import { getGolfers } from '@/lib/slash-golf/client'
import {
  DEFAULT_CATALOG_RUN_DECISION_INPUTS,
  buildCatalogUsageSummary,
  buildFallbackGolfer,
  buildManualAddQuery,
  buildGolferUpsertPayload,
  buildTournamentFieldUpsertRows,
  buildUsageSnapshot,
  createQuotaPolicy,
  decideCatalogRun,
} from '@/lib/golfer-catalog/service'
import { buildSyncRunInsert, getLatestGolferSyncRun, getMonthlyApiUsage } from '@/lib/golfer-catalog/queries'

describe('golfer catalog helpers', () => {
  it('normalizes golfer names for local search matching', () => {
    expect(buildSearchName(' Collin  Morikawa ')).toBe('collin morikawa')
    expect(buildSearchName('Rory McIlroy')).toBe('rory mcilroy')
  })

  it('collapses repeated internal whitespace and returns empty string for blank input', () => {
    expect(buildSearchName('  Lydia\n\t  Ko  ')).toBe('lydia ko')
    expect(buildSearchName('     ')).toBe('')
  })

  it('blocks bulk refreshes after the hard quota threshold', () => {
    expect(isBulkRefreshBlocked({ usedCalls: 235, hardLimit: 235 })).toBe(true)
    expect(isBulkRefreshBlocked({ usedCalls: 199, hardLimit: 235 })).toBe(false)
  })
})

describe('catalog service', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('creates a stable upsert payload from RapidAPI player data', () => {
    expect(
      buildGolferUpsertPayload({
        playerId: ' 50525 ',
        firstName: 'Collin',
        lastName: 'Morikawa',
        country: 'USA',
        worldRank: 4,
        source: 'manual_add',
      }),
    ).toEqual({
      external_player_id: '50525',
      id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: 4,
      is_active: true,
      source: 'manual_add',
    })
  })

  it('creates a typed fallback golfer with catalog defaults', () => {
    expect(buildFallbackGolfer('g1')).toEqual({
      id: 'g1',
      name: 'g1',
      country: '',
      search_name: 'g1',
      world_rank: null,
      is_active: false,
      source: 'legacy',
      external_player_id: null,
      last_synced_at: null,
    })
  })

  it('reports quota status with warning and block thresholds', () => {
    const policy = createQuotaPolicy({ monthlyLimit: 250, warningAt: 200, blockBulkAt: 235 })

    expect(buildCatalogUsageSummary({ usedCalls: 199, policy }).status).toBe('ok')
    expect(buildCatalogUsageSummary({ usedCalls: 200, policy }).status).toBe('warning')
    expect(buildCatalogUsageSummary({ usedCalls: 235, policy }).status).toBe('blocked')
  })

  it('rejects golfer upserts that would create blank name rows', () => {
    expect(() =>
      buildGolferUpsertPayload({
        playerId: '50525',
        firstName: '   ',
        lastName: '\n',
        source: 'manual_add',
      }),
    ).toThrow('RapidAPI player must include a usable name')
  })

  it('rejects invalid quota policy ordering', () => {
    expect(() => createQuotaPolicy({ monthlyLimit: 200, warningAt: 201, blockBulkAt: 235 })).toThrow(
      'Quota policy thresholds are invalid',
    )
  })

  it('builds a sync run insert payload with summary metadata', () => {
    expect(
      buildSyncRunInsert({
        runType: 'manual_add',
        requestedBy: 'user-1',
        tournamentId: 't1',
        apiCallsUsed: 1,
        status: 'success',
        summary: { golfers_upserted: 1 },
        errorMessage: null,
      }),
    ).toEqual({
      run_type: 'manual_add',
      requested_by: 'user-1',
      tournament_id: 't1',
      api_calls_used: 1,
      status: 'success',
      summary: { golfers_upserted: 1 },
      error_message: null,
    })
  })

  it('exposes only the task 1 query helpers', async () => {
    const queries = await import('@/lib/golfer-catalog/queries')

    expect(queries).not.toHaveProperty('buildGolferUpsertRows')
  })

  it('throws when loading the latest golfer sync run fails', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'permission denied' },
              }),
            }),
          }),
        }),
      }),
    }

    await expect(getLatestGolferSyncRun(supabase as never)).rejects.toThrow(
      'Failed to load latest golfer sync run: permission denied',
    )
  })

  it('ignores malformed monthly usage values while summing valid API calls', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              data: [
                { api_calls_used: 2 },
                { api_calls_used: null },
                { api_calls_used: '3' },
                { api_calls_used: Number.NaN },
                {},
                { api_calls_used: 4 },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }

    await expect(getMonthlyApiUsage(supabase as never, new Date('2026-03-31T00:00:00.000Z'))).resolves.toBe(6)
  })

  it('ignores negative monthly usage values while summing valid API calls', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              data: [
                { api_calls_used: 2 },
                { api_calls_used: -3 },
                { api_calls_used: 4 },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }

    await expect(getMonthlyApiUsage(supabase as never, new Date('2026-03-31T00:00:00.000Z'))).resolves.toBe(6)
  })

  it('builds tournament field upsert rows with tournament sync metadata', () => {
    expect(
      buildTournamentFieldUpsertRows([
        { id: 'g1', name: 'Collin Morikawa', country: 'USA' },
      ], '2026-03-31T00:00:00.000Z'),
    ).toEqual([
      {
        id: 'g1',
        name: 'Collin Morikawa',
        country: 'USA',
        search_name: 'collin morikawa',
        world_rank: null,
        is_active: true,
        source: 'tournament_sync',
        external_player_id: 'g1',
        last_synced_at: '2026-03-31T00:00:00.000Z',
      },
    ])
  })

  it('upserts tournament golfers with tournament_sync source and synced timestamp', () => {
    const syncedAt = '2026-04-01T12:34:56.000Z'

    expect(
      buildTournamentFieldUpsertRows([
        { id: 'g1', name: 'Collin Morikawa', country: 'USA' },
        { id: 'g2', name: 'Rory McIlroy', country: 'NIR' },
      ], syncedAt),
    ).toEqual([
      expect.objectContaining({
        id: 'g1',
        external_player_id: 'g1',
        source: 'tournament_sync',
        last_synced_at: syncedAt,
      }),
      expect.objectContaining({
        id: 'g2',
        external_player_id: 'g2',
        source: 'tournament_sync',
        last_synced_at: syncedAt,
      }),
    ])
  })

  it('builds manual-add search params from commissioner input', () => {
    expect(buildManualAddQuery({ firstName: '  Collin ', lastName: ' Morikawa  ' })).toEqual({
      firstName: 'Collin',
      lastName: 'Morikawa',
    })
  })

  it('omits blank manual-add names after trimming', () => {
    expect(buildManualAddQuery({ firstName: '  ', lastName: ' Morikawa ' })).toEqual({
      lastName: 'Morikawa',
    })
  })

  it('rejects manual-add queries that have no usable name parts', () => {
    expect(() => buildManualAddQuery({ firstName: '  ', lastName: '\n' })).toThrow(
      'Provide firstName or lastName',
    )
  })

  it('trims tournament golfers before building upsert rows', () => {
    expect(
      buildTournamentFieldUpsertRows([
        { id: ' g1 ', name: '  Collin   Morikawa  ', country: ' USA ' },
      ], '2026-03-31T00:00:00.000Z'),
    ).toEqual([
      {
        id: 'g1',
        name: 'Collin Morikawa',
        country: 'USA',
        search_name: 'collin morikawa',
        world_rank: null,
        is_active: true,
        source: 'tournament_sync',
        external_player_id: 'g1',
        last_synced_at: '2026-03-31T00:00:00.000Z',
      },
    ])
  })

  it('rejects tournament golfers with blank ids or names after trimming', () => {
    expect(() =>
      buildTournamentFieldUpsertRows([
        { id: '   ', name: 'Collin Morikawa', country: 'USA' },
      ], '2026-03-31T00:00:00.000Z')).toThrow('Tournament golfer must include a usable id and name')

    expect(() =>
      buildTournamentFieldUpsertRows([
        { id: 'g1', name: '   ', country: 'USA' },
      ], '2026-03-31T00:00:00.000Z')).toThrow('Tournament golfer must include a usable id and name')
  })

  it('builds a usage snapshot from monthly usage and policy', () => {
    expect(buildUsageSnapshot(220).status).toBe('warning')
  })
})

describe('rapidapi boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('fails fast when the RapidAPI key is missing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SLASH_GOLF_API_KEY', '')

    await expect(searchPlayers({ playerId: '50525' })).rejects.toThrow('SLASH_GOLF_API_KEY is required')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('requires at least one search parameter before calling RapidAPI', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SLASH_GOLF_API_KEY', 'test-key')

    await expect(searchPlayers({})).rejects.toThrow('Provide firstName, lastName, or playerId')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects malformed RapidAPI player payloads', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ playerId: 50525, firstName: 'Collin' }],
    })

    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SLASH_GOLF_API_KEY', 'test-key')

    await expect(searchPlayers({ playerId: '50525' })).rejects.toThrow('RapidAPI players response was invalid')
  })

  it('sends trimmed search params and parses a valid player response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ playerId: '50525', firstName: 'Collin', lastName: 'Morikawa', worldRank: 4 }],
    })

    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SLASH_GOLF_API_KEY', 'test-key')

    await expect(
      searchPlayers({ firstName: '  Collin ', lastName: ' Morikawa  ', playerId: ' 50525 ' }),
    ).resolves.toEqual([{ playerId: '50525', firstName: 'Collin', lastName: 'Morikawa', worldRank: 4 }])

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://live-golf-data.p.rapidapi.com/players?firstName=Collin&lastName=Morikawa&playerId=50525',
      {
        cache: 'no-store',
        headers: {
          'X-RapidAPI-Key': 'test-key',
        },
      },
    )
  })

  it('throws a controlled error when tournament golfers payload is not valid', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ somethingElse: [] }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(getGolfers('t1', 2026)).rejects.toThrow('Tournament golfers response was invalid')
  })

  it('treats metadata-only tournament responses as unpublished fields', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orgId: '1',
        year: '2026',
        tournId: '012',
        name: 'RBC Heritage',
        status: 'Not Started',
        currentRound: -1,
        courses: [],
        players: [],
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(getGolfers('012', 2026)).rejects.toThrow('Tournament field has not been published yet.')
  })

  it('parses tournament golfers from a players array payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        players: [
          { playerId: ' 52955 ', firstName: ' Ludvig ', lastName: ' Åberg ', country: ' USA ' },
          null,
          { playerId: ' 50525 ', name: ' Collin Morikawa ', country: ' USA ' },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(getGolfers('t1', 2026)).resolves.toEqual([
      { id: '52955', name: 'Ludvig Åberg', country: 'USA' },
      { id: '50525', name: 'Collin Morikawa', country: 'USA' },
    ])
  })

  it('parses tournament golfers from a players array payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        players: [
          { playerId: ' 52955 ', firstName: ' Ludvig ', lastName: ' Åberg ', country: ' USA ' },
          null,
          { playerId: ' 50525 ', name: ' Collin Morikawa ', country: ' USA ' },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(getGolfers('t1', 2026)).resolves.toEqual([
      { id: '52955', name: 'Ludvig Åberg', country: 'USA' },
      { id: '50525', name: 'Collin Morikawa', country: 'USA' },
    ])
  })

  it('ignores malformed tournament golfer array members safely', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [null, 'bad-row', { playerId: ' g1 ', name: ' Collin Morikawa ', country: ' USA ' }],
    })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(getGolfers('t1', 2026)).resolves.toEqual([
      { id: 'g1', name: 'Collin Morikawa', country: 'USA' },
    ])
  })
})

describe('decideCatalogRun', () => {
  it('exposes the placeholder quota inputs used by commissioner actions', () => {
    expect(DEFAULT_CATALOG_RUN_DECISION_INPUTS).toEqual({
      usedCalls: 0,
      monthlyLimit: 250,
      warningAt: 200,
      blockBulkAt: 235,
    })
  })

  it('blocks bulk refreshes when usage is at the hard threshold', () => {
    expect(
      decideCatalogRun({
        runType: 'monthly_baseline',
        usedCalls: 235,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: false, reason: 'Monthly API budget is reserved for manual golfer adds.' })
  })

  it('allows manual adds while quota remains', () => {
    expect(
      decideCatalogRun({
        runType: 'manual_add',
        usedCalls: 240,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: true })
  })

  it('keeps manual adds available after bulk refreshes are blocked', () => {
    expect(
      decideCatalogRun({
        runType: 'manual_add',
        usedCalls: 249,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: true })
  })

  it('blocks all operations after the monthly limit is reached', () => {
    expect(
      decideCatalogRun({
        runType: 'manual_add',
        usedCalls: 250,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: false, reason: 'Monthly API budget is exhausted.' })
  })

})

describe('filterLocalGolfers', () => {
  it('matches against normalized search names without calling RapidAPI', () => {
    expect(
      filterLocalGolfers(
        [
          { id: '1', name: 'Collin Morikawa', search_name: 'collin morikawa', country: 'USA', is_active: true },
          { id: '2', name: 'Rory McIlroy', search_name: 'rory mcilroy', country: 'NIR', is_active: true },
        ],
        { search: 'morikawa', country: '' },
      ).map((golfer) => golfer.id),
    ).toEqual(['1'])
  })

  it('falls back to normalized name matching when search_name is blank or stale', () => {
    expect(
      filterLocalGolfers(
        [
          { id: '1', name: 'Collin Morikawa', search_name: '', country: 'USA', is_active: true },
          { id: '2', name: 'Rory McIlroy', search_name: 'old value', country: 'NIR', is_active: true },
        ],
        { search: 'McIlroy', country: '' },
      ).map((golfer) => golfer.id),
    ).toEqual(['2'])
  })

  it('applies country filters while excluding inactive golfers', () => {
    expect(
      filterLocalGolfers(
        [
          { id: '1', name: 'Collin Morikawa', search_name: 'collin morikawa', country: 'USA', is_active: true },
          { id: '2', name: 'Ludvig Aberg', search_name: 'ludvig aberg', country: 'SWE', is_active: false },
          { id: '3', name: 'Alex Noren', search_name: 'alex noren', country: 'SWE', is_active: true },
        ],
        { search: '', country: 'SWE' },
      ).map((golfer) => golfer.id),
    ).toEqual(['3'])
  })

  it('still excludes active golfers that fail the current filters even when they are selected elsewhere', () => {
    expect(
      filterLocalGolfers(
        [
          { id: '1', name: 'Collin Morikawa', search_name: 'collin morikawa', country: 'USA', is_active: true },
          { id: '2', name: 'Rory McIlroy', search_name: 'rory mcilroy', country: 'NIR', is_active: true },
        ],
        { search: 'morikawa', country: '' },
      ).map((golfer) => golfer.id),
    ).toEqual(['1'])
  })
})
