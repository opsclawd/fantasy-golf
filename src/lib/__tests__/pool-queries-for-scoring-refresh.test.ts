import { describe, expect, it, vi } from 'vitest'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '../pool-queries'

describe('pool-queries (refresh pipeline deps)', () => {
  describe('getPoolsByTournament', () => {
    function createSupabase(results: unknown[]) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: results, error: null }).then(onFulfilled),
      }
      return { supabase: { from: vi.fn(() => builder) } }
    }

    it('returns pools filtered by tournament_id', async () => {
      const pools = [{ id: 'pool-1', tournament_id: 't-1', status: 'live' }]
      const { supabase } = createSupabase(pools)

      const result = await getPoolsByTournament(supabase as never, 't-1')

      expect(supabase.from).toHaveBeenCalledWith('pools')
      expect(result).toEqual(pools)
    })

    it('returns empty array when no pools match', async () => {
      const { supabase } = createSupabase([])

      const result = await getPoolsByTournament(supabase as never, 't-999')

      expect(result).toEqual([])
    })

    it('throws when query fails', async () => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: () => {
          throw new Error('db is down')
        },
      }
      const supabase = { from: vi.fn(() => builder) }

      await expect(
        getPoolsByTournament(supabase as never, 't-1')
      ).rejects.toThrow('db is down')
    })
  })

  describe('getEntriesForPool', () => {
    function createSupabase(result: unknown[]) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { data: unknown[] }) => unknown) =>
          Promise.resolve({ data: result }).then(onFulfilled),
      }
      return { supabase: { from: vi.fn(() => builder) } }
    }

    it('returns entries for a specific pool', async () => {
      const entries = [{ id: 'e1', pool_id: 'pool-1' }, { id: 'e2', pool_id: 'pool-1' }]
      const { supabase } = createSupabase(entries)

      const result = await getEntriesForPool(supabase as never, 'pool-1')

      expect(supabase.from).toHaveBeenCalledWith('entries')
      expect(result).toEqual(entries)
    })

    it('returns empty array when pool has no entries', async () => {
      const { supabase } = createSupabase([])

      const result = await getEntriesForPool(supabase as never, 'pool-999')

      expect(result).toEqual([])
    })
  })

  describe('updatePoolRefreshMetadata', () => {
    it('calls pools.update() with refreshed_at on success', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        refreshed_at: '2026-04-28T12:00:00Z',
        last_refresh_error: null,
      })

      expect(result.error).toBeNull()
      expect(builder.update).toHaveBeenCalledWith({
        refreshed_at: '2026-04-28T12:00:00Z',
        last_refresh_error: null,
      })
    })

    it('calls pools.update() with last_refresh_error on failure', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        last_refresh_error: 'API timeout',
      })

      expect(result.error).toBeNull()
      expect(builder.update).toHaveBeenCalledWith({
        last_refresh_error: 'API timeout',
      })
    })

    it('throws on update failure', async () => {
      const builder: any = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: () => {
          throw new Error('connection refused')
        },
      }
      const supabase = { from: vi.fn(() => builder) }

      await expect(updatePoolRefreshMetadata(supabase as never, 'pool-1', {
        last_refresh_error: 'timeout',
      })).rejects.toThrow('connection refused')
    })
  })

  describe('insertAuditEvent', () => {
    it('calls audit_events.insert() with correct fields', async () => {
      const builder: any = {
        insert: vi.fn(() => builder),
        then: (onFulfilled: (value: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(onFulfilled),
      }
      const supabase = { from: vi.fn(() => builder) }

      const result = await insertAuditEvent(supabase as never, {
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: { completedRounds: 1 },
      })

      expect(result.error).toBeNull()
      expect(builder.insert).toHaveBeenCalledWith({
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: { completedRounds: 1 },
      })
    })

    it('throws on insert failure', async () => {
      const builder: any = {
        insert: vi.fn(() => builder),
        then: () => {
          throw new Error('insert failed')
        },
      }
      const supabase = { from: vi.fn(() => builder) }

      await expect(insertAuditEvent(supabase as never, {
        pool_id: 'pool-1',
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: {},
      })).rejects.toThrow('insert failed')
    })
  })
})