import { describe, it, expect } from 'vitest'
import {
  generateInviteCode,
  validateCreatePoolInput,
  validatePoolFormat,
  canTransitionStatus,
  buildClonePoolInput,
} from '../pool'
import type { Pool } from '../supabase/types'

describe('generateInviteCode', () => {
  it('returns a string of 8 alphanumeric characters', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[a-z0-9]{8}$/)
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
      deadline: '2026-04-10T08:00:00Z',
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
    })
    expect(result).toEqual({ ok: false, error: 'Picks deadline must be in the future.' })
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
  it('allows open -> live', () => {
    expect(canTransitionStatus('open', 'live')).toBe(true)
  })

  it('allows live -> complete', () => {
    expect(canTransitionStatus('live', 'complete')).toBe(true)
  })

  it('blocks open -> complete', () => {
    expect(canTransitionStatus('open', 'complete')).toBe(false)
  })

  it('blocks live -> open', () => {
    expect(canTransitionStatus('live', 'open')).toBe(false)
  })

  it('blocks complete -> anything', () => {
    expect(canTransitionStatus('complete', 'open')).toBe(false)
    expect(canTransitionStatus('complete', 'live')).toBe(false)
  })
})

describe('buildClonePoolInput', () => {
  it('copies name, format, and picks_per_entry from source pool', () => {
    const source: Pool = {
      id: 'old-id',
      commissioner_id: 'user-1',
      name: 'Masters Pool 2025',
      tournament_id: 'old-tournament',
      tournament_name: 'Old Tournament',
      year: 2025,
      deadline: '2025-04-10T08:00:00Z',
      format: 'best_ball',
      picks_per_entry: 4,
      invite_code: 'oldcode1',
      status: 'complete',
      created_at: '2025-01-01T00:00:00Z',
    }

    const result = buildClonePoolInput(source)

    expect(result.name).toBe('Masters Pool 2025')
    expect(result.format).toBe('best_ball')
    expect(result.picks_per_entry).toBe(4)
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('tournament_id')
    expect(result).not.toHaveProperty('invite_code')
    expect(result).not.toHaveProperty('status')
  })
})
