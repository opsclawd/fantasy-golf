import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updatePoolStatus } from '../pool-queries'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

describe('pool state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open -> live: transitions when deadline passes', async () => {
    const mockEq = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'pool-1' }], error: null }),
    })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    })
    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
    })
    const supabase = { from: mockFrom } as any

    const result = await updatePoolStatus(supabase, 'pool-1', 'live', 'open')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'live' })
    expect(mockEq).toHaveBeenCalledWith('id', 'pool-1')
    expect(mockEq).toHaveBeenCalledWith('status', 'open')
  })

  it('live -> complete: transitions when tournament ends', async () => {
    const mockEq = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'pool-1' }], error: null }),
    })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    })
    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
    })
    const supabase = { from: mockFrom } as any

    const result = await updatePoolStatus(supabase, 'pool-1', 'complete', 'live')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'complete' })
  })

  it('complete -> archived: commissioner archives pool', async () => {
    const mockEq = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'pool-1' }], error: null }),
    })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    })
    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
    })
    const supabase = { from: mockFrom } as any

    const result = await updatePoolStatus(supabase, 'pool-1', 'archived', 'complete')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'archived' })
  })

  it('optimistic locking: rejects transition when status already changed', async () => {
    const mockEq = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: mockEq,
    })
    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
    })
    const supabase = { from: mockFrom } as any

    const result = await updatePoolStatus(supabase, 'pool-1', 'live', 'open')

    expect(result.error).toBe('Pool state changed. Please refresh and try again.')
  })
})
