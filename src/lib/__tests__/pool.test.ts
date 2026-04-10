import { describe, it, expect, vi } from 'vitest'
import {
  generateInviteCode,
  validateCreatePoolInput,
  validatePoolFormat,
  canTransitionStatus,
  canReopenPool,
} from '../pool'
import type { Pool } from '../supabase/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('generateInviteCode', () => {
  it('returns a string of 8 alphanumeric characters', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[a-z0-9]{8}$/)
  })

  it('produces only lowercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode()
      expect(code).toMatch(/^[a-z0-9]+$/)
    }
  })

  it('generates unique codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()))
    expect(codes.size).toBe(100)
  })
})

describe('validateCreatePoolInput', () => {
  it('returns ok for valid input', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool 2026',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-11T08:00:00Z',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects empty pool name', () => {
    const result = validateCreatePoolInput({
      name: '',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: false, error: 'Pool name is required.' })
  })

  it('rejects pool name over 100 characters', () => {
    const result = validateCreatePoolInput({
      name: 'x'.repeat(101),
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: false, error: 'Pool name must be 100 characters or fewer.' })
  })

  it('rejects missing tournament', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: '',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: false, error: 'Tournament selection is required.' })
  })

  it('rejects missing deadline', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: false, error: 'Picks deadline is required.' })
  })

  it('rejects deadline in the past', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2020-01-01T00:00:00Z',
      timezone: 'America/New_York',
    })
    expect(result).toEqual({ ok: false, error: 'Picks deadline must be in the future.' })
  })

  it('rejects an invalid timezone', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
      timezone: 'Not/A_Timezone',
    })
    expect(result).toEqual({ ok: false, error: 'Timezone must be a valid IANA timezone.' })
  })

  it('checks deadline validity in the pool timezone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-09T03:00:00Z'))

    try {
      const result = validateCreatePoolInput({
        name: 'Masters Pool',
        tournamentId: 't1',
        tournamentName: 'The Masters',
        year: 2026,
        deadline: '2026-04-09T00:00:00+00:00',
        timezone: 'America/New_York',
      })

      expect(result).toEqual({ ok: true })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('validatePoolFormat', () => {
  it('accepts best_ball format', () => {
    const result = validatePoolFormat('best_ball', 4)
    expect(result).toEqual({ ok: true })
  })

  it('rejects unknown format', () => {
    const result = validatePoolFormat('unknown' as any, 4)
    expect(result).toEqual({ ok: false, error: 'Invalid pool format.' })
  })

  it('rejects picks_per_entry below 1', () => {
    const result = validatePoolFormat('best_ball', 0)
    expect(result).toEqual({ ok: false, error: 'Picks per entry must be between 1 and 10.' })
  })

  it('rejects picks_per_entry above 10', () => {
    const result = validatePoolFormat('best_ball', 11)
    expect(result).toEqual({ ok: false, error: 'Picks per entry must be between 1 and 10.' })
  })
})

describe('canTransitionStatus', () => {
  it('allows complete -> open', () => {
    expect(canTransitionStatus('complete', 'open')).toBe(true)
  })

  it('allows complete -> archived', () => {
    expect(canTransitionStatus('complete', 'archived')).toBe(true)
  })

  it('blocks archived -> anything', () => {
    expect(canTransitionStatus('archived', 'open')).toBe(false)
    expect(canTransitionStatus('archived', 'live')).toBe(false)
    expect(canTransitionStatus('archived', 'complete')).toBe(false)
  })
})

describe('canReopenPool', () => {
  it('allows a completed pool to reopen before the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'))

    expect(
      canReopenPool('complete', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(true)

    vi.useRealTimers()
  })

  it('blocks reopen after the deadline has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'))

    expect(
      canReopenPool('complete', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(false)

    vi.useRealTimers()
  })

  it('blocks reopen for any non-complete pool', () => {
    expect(
      canReopenPool('live', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(false)
  })
})

describe('pool archive migration', () => {
  it('adds archived status and the pool_deletions table', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql'
      ),
      'utf8'
    )

    expect(migration).toContain("check (status in ('open', 'live', 'complete', 'archived'))")
    expect(migration).toContain('create table if not exists public.pool_deletions')
  })
})

describe('pool update RLS policy', () => {
  it('includes a commissioner-only update policy for pools', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260401101000_enable_rls_on_public_tables.sql'),
      'utf8'
    )

    expect(migration).toContain('Pool commissioners can update pools')
    expect(migration).toContain('for update')
    expect(migration).toContain('commissioner_id = auth.uid()')
  })
})
