import { describe, expect, it, vi } from 'vitest'
import { getAuditEventsForPool } from '../pool-queries'

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseForAuditEvents(result: QueryResult) {
  const state = {
    limitCalls: [] as number[],
  }

  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn((value: number) => {
      state.limitCalls.push(value)
      return builder
    }),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  const supabase = {
    from: vi.fn(() => builder),
  }

  return { supabase, state }
}

describe('getAuditEventsForPool', () => {
  it('throws when the audit event query fails', async () => {
    const { supabase } = createSupabaseForAuditEvents({
      data: null,
      error: { message: 'db is down' },
    })

    await expect(
      getAuditEventsForPool(supabase as any, 'pool-123')
    ).rejects.toThrow('Failed to fetch audit events for pool pool-123: db is down')
  })

  it('does not apply invalid limit values', async () => {
    const invalidLimits = [0, -1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

    for (const invalidLimit of invalidLimits) {
      const { supabase, state } = createSupabaseForAuditEvents({ data: [], error: null })

      await getAuditEventsForPool(supabase as any, 'pool-123', { limit: invalidLimit })

      expect(state.limitCalls).toHaveLength(0)
    }
  })

  it('applies valid positive integer limits', async () => {
    const { supabase, state } = createSupabaseForAuditEvents({ data: [], error: null })

    await getAuditEventsForPool(supabase as any, 'pool-123', { limit: 5 })

    expect(state.limitCalls).toEqual([5])
  })
})
