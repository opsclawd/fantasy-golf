import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import {
  getPoolById,
  insertAuditEvent,
  updatePoolStatus,
  recordPoolDeletion,
  deletePoolById,
} from '@/lib/pool-queries'
import { deletePool } from '../actions'

vi.mock('server-only', () => ({}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('redirect') }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
  updatePoolStatus: vi.fn(),
  insertAuditEvent: vi.fn(),
  recordPoolDeletion: vi.fn(),
  deletePoolById: vi.fn(),
}))

const commissioner = { id: 'user-1' }
const completedPool = {
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
  status: 'complete',
  created_at: '2026-04-01T00:00:00Z',
  refreshed_at: null,
  last_refresh_error: null,
}

function mockAuthenticatedClient() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: commissioner } }) },
  } as never)
}

function mockAdminClient() {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as never)
}

describe('deletePool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedClient()
    mockAdminClient()
    vi.mocked(getPoolById).mockResolvedValue({ ...completedPool, status: 'archived' } as never)
    vi.mocked(updatePoolStatus).mockResolvedValue({ error: null })
    vi.mocked(insertAuditEvent).mockResolvedValue({ error: null })
    vi.mocked(recordPoolDeletion).mockResolvedValue({ error: null })
    vi.mocked(deletePoolById).mockResolvedValue({ error: null })
  })

  it('creates a tombstone and deletes an archived pool', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(deletePool(null, formData)).rejects.toThrow('redirect')

    expect(recordPoolDeletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pool_id: 'pool-1',
        status_at_delete: 'archived',
        snapshot: expect.objectContaining({
          id: 'pool-1',
          name: 'Masters Pool',
          status: 'archived',
        }),
      })
    )

    expect(deletePoolById).toHaveBeenCalledWith(expect.anything(), 'pool-1')
  })

  it('refuses to delete a pool that is not archived', async () => {
    vi.mocked(getPoolById).mockResolvedValue({ ...completedPool, status: 'complete' } as never)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')

    await expect(deletePool(null, formData)).resolves.toEqual({
      error: 'Only open or archived pools can be deleted.',
    })

    expect(deletePoolById).not.toHaveBeenCalled()
  })
})