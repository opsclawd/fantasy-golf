import { describe, expect, it, vi } from 'vitest'
import { getPoolsForMember } from '../entry-queries'

function createSupabaseForMemberPools(memberRows: unknown[], entryRows: unknown[] = []) {
  const memberBuilder: any = {
    select: vi.fn(() => memberBuilder),
    eq: vi.fn(() => memberBuilder),
    order: vi.fn(() => memberBuilder),
    then: (onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: memberRows, error: null }).then(onFulfilled, onRejected),
  }

  const entryBuilder: any = {
    select: vi.fn(() => entryBuilder),
    eq: vi.fn(() => entryBuilder),
    in: vi.fn(() => entryBuilder),
    then: (onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: entryRows, error: null }).then(onFulfilled, onRejected),
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'pool_members') return memberBuilder
      if (table === 'entries') return entryBuilder
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { supabase }
}

describe('getPoolsForMember', () => {
  it('filters archived pools out of member pools', async () => {
    const { supabase } = createSupabaseForMemberPools([
      {
        pool_id: 'p1',
        role: 'player',
        pools: [{ id: 'p1', name: 'Open Pool', tournament_name: 'T', status: 'open', deadline: '2026-04-09T00:00:00Z', timezone: 'America/New_York', picks_per_entry: 4 }],
      },
      {
        pool_id: 'p2',
        role: 'player',
        pools: [{ id: 'p2', name: 'Archived Pool', tournament_name: 'T', status: 'archived', deadline: '2026-04-09T00:00:00Z', timezone: 'America/New_York', picks_per_entry: 4 }],
      },
    ])

    const result = await getPoolsForMember(supabase as any, 'user-1')

    expect(result).toHaveLength(1)
    expect(result[0].pool_id).toBe('p1')
  })
})
