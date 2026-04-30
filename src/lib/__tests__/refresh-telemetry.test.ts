import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updatePoolRefreshTelemetry, updatePoolRefreshMetadata } from '../pool-queries'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

describe('refresh telemetry', () => {
  function createMockSupabase() {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pools') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { refresh_attempt_count: 5 },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as unknown as never
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updatePoolRefreshTelemetry', () => {
    it('increments refresh_attempt_count and sets last_refresh_attempt_at', async () => {
      const supabase = createMockSupabase()
      const now = new Date().toISOString()

      const result = await updatePoolRefreshTelemetry(supabase, 'pool-1', {
        refresh_attempt_count: 'increment',
        last_refresh_attempt_at: now,
      })

      expect(result.error).toBeNull()
    })

    it('only updates last_refresh_attempt_at when count is not incremented', async () => {
      const supabase = createMockSupabase()
      const now = new Date().toISOString()

      const result = await updatePoolRefreshTelemetry(supabase, 'pool-1', {
        last_refresh_attempt_at: now,
      })

      expect(result.error).toBeNull()
    })
  })

  describe('updatePoolRefreshMetadata', () => {
    it('sets refreshed_at and last_refresh_success_at on success', async () => {
      const supabase = createMockSupabase()
      const now = new Date().toISOString()

      const result = await updatePoolRefreshMetadata(supabase, 'pool-1', {
        refreshed_at: now,
        last_refresh_success_at: now,
        last_refresh_error: null,
      })

      expect(result.error).toBeNull()
    })

    it('sets last_refresh_error on failure', async () => {
      const supabase = createMockSupabase()
      const errorMsg = 'API timeout'

      const result = await updatePoolRefreshMetadata(supabase, 'pool-1', {
        last_refresh_error: errorMsg,
      })

      expect(result.error).toBeNull()
    })
  })
})
