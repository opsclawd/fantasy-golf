import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import { submitPicks } from './actions'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/entry-queries', () => ({
  getEntryByPoolAndUser: vi.fn(),
  upsertEntry: vi.fn(),
}))

vi.mock('@/lib/picks', () => ({
  isPoolLocked: vi.fn(),
  validatePickSubmission: vi.fn(),
}))

vi.mock('@/lib/pool-queries', () => ({
  getPoolById: vi.fn(),
  insertAuditEvent: vi.fn(),
  isPoolMember: vi.fn(),
}))

vi.mock('@/lib/tournament-roster/queries', () => ({
  getTournamentRosterGolfers: vi.fn(),
}))

describe('submitPicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to sign in', async () => {
    const redirectError = new Error('NEXT_REDIRECT')

    vi.mocked(redirect).mockImplementation(() => {
      throw redirectError
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never)

    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('golferIds', '[]')

    await expect(submitPicks(null, formData)).rejects.toThrow(redirectError)
    expect(redirect).toHaveBeenCalledWith('/sign-in')
  })
})
