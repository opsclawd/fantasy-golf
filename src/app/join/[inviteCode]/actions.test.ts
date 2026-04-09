import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import { joinPool } from './actions'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  insertAuditEvent: vi.fn(),
  insertPoolMember: vi.fn(),
}))

describe('joinPool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects archived pools with an error', async () => {
    const redirectError = new Error('NEXT_REDIRECT')
    vi.mocked(redirect).mockImplementation(() => {
      throw redirectError
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'pool-1', name: 'Test Pool', status: 'archived', invite_code: 'abc123' },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'pool_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as never)

    const formData = new FormData()
    formData.set('inviteCode', 'abc123')

    const result = await joinPool(null, formData)

    expect(result).toEqual({ error: 'This pool is archived and can no longer accept new members.' })
    expect(redirect).not.toHaveBeenCalled()
  })
})
