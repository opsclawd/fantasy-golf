import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { acquireRefreshLock, releaseRefreshLock } from '../pool-queries'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

describe('acquireRefreshLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: acquires lock when no existing lock', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
    })
    const supabase = { from: mockFrom } as any

    const result = await acquireRefreshLock(supabase, 'tournament-1', 'lock-id-1')

    expect(result.acquired).toBe(true)
    expect(result.lockId).toBe('lock-id-1')
  })

  it('conflict: returns heldBy when lock exists and not expired', async () => {
    const futureDate = new Date(Date.now() + 60000).toISOString()
    
    const mockSingle = vi.fn().mockResolvedValue({
      data: { locked_by: 'other-lock', expires_at: futureDate },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    })
    const mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    })
    const supabase = { from: mockFrom } as any

    const result = await acquireRefreshLock(supabase, 'tournament-1', 'lock-id-2')

    expect(result.acquired).toBe(false)
    expect(result.heldBy).toBe('other-lock')
    expect(result.expiresAt).toBe(futureDate)
  })

  it('expiry: claims expired lock when no other holder', async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    
    const mockSingle = vi.fn().mockResolvedValue({
      data: { locked_by: 'expired-lock', expires_at: pastDate },
      error: null,
    })
    const mockEq3 = vi.fn().mockResolvedValue({ error: null })
    const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockInsert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    })
    const mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    })
    const supabase = { from: mockFrom } as any

    const result = await acquireRefreshLock(supabase, 'tournament-1', 'lock-id-3')

    expect(result.acquired).toBe(true)
    expect(result.lockId).toBe('lock-id-3')
  })
})

describe('releaseRefreshLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: releases lock when lockId matches', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockEq1 = vi.fn().mockImplementation(() => ({ eq: mockEq2 }))
    const mockDelete = vi.fn().mockReturnValue({
      eq: mockEq1,
    })
    const mockFrom = vi.fn().mockReturnValue({
      delete: mockDelete,
    })
    const supabase = { from: mockFrom } as any

    const result = await releaseRefreshLock(supabase, 'tournament-1', 'lock-id-1')

    expect(result.error).toBeNull()
    expect(mockEq1).toHaveBeenCalledWith('tournament_id', 'tournament-1')
    expect(mockEq2).toHaveBeenCalledWith('locked_by', 'lock-id-1')
  })

  it('error: returns error when release fails', async () => {
    const mockEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'some error' } }),
    })
    const mockDelete = vi.fn().mockReturnValue({
      eq: mockEq1,
    })
    const mockFrom = vi.fn().mockReturnValue({
      delete: mockDelete,
    })
    const supabase = { from: mockFrom } as any

    const result = await releaseRefreshLock(supabase, 'tournament-1', 'lock-id-1')

    expect(result.error).toBe('some error')
  })
})
