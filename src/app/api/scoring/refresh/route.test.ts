import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById } from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
}))

vi.mock('@/lib/scoring-refresh', () => ({
  refreshScoresForPool: vi.fn(),
}))

const originalEnv = { ...process.env }

describe('POST /api/scoring/refresh', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'secret' }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 without auth', async () => {
    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: 'pool-1' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 when poolId is missing', async () => {
    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 404 when pool does not exist', async () => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(getPoolById).mockResolvedValue(null)

    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ poolId: 'nonexistent' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it('returns 200 and refresh data on success', async () => {
    const pool = { id: 'pool-1', tournament_id: 't-1', year: 2026, status: 'live' }
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(getPoolById).mockResolvedValue(pool as never)
    vi.mocked(refreshScoresForPool).mockResolvedValue({
      data: { completedRounds: 2, refreshedAt: '2026-04-08T12:00:00.000Z' },
      error: null,
    })

    const request = new Request('http://localhost/api/scoring/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ poolId: 'pool-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.completedRounds).toBe(2)
    expect(refreshScoresForPool).toHaveBeenCalledWith(expect.anything(), pool)
  })
})