import { describe, it, expect } from 'vitest'
import {
  validatePickSubmission,
  isPoolLocked,
  calculateRemainingPicks,
  shouldAutoLock,
  getTournamentLockInstant,
} from '../picks'

describe('validatePickSubmission', () => {
  it('rejects invalid picksPerEntry invariant values', () => {
    expect(
      validatePickSubmission({
        golferIds: ['g1'],
        picksPerEntry: 0,
        isLocked: false,
      })
    ).toEqual({
      ok: false,
      error: 'Invalid picksPerEntry: must be a positive integer.',
    })

    expect(
      validatePickSubmission({
        golferIds: ['g1'],
        picksPerEntry: -2,
        isLocked: false,
      })
    ).toEqual({
      ok: false,
      error: 'Invalid picksPerEntry: must be a positive integer.',
    })

    expect(
      validatePickSubmission({
        golferIds: ['g1'],
        picksPerEntry: 1.5,
        isLocked: false,
      })
    ).toEqual({
      ok: false,
      error: 'Invalid picksPerEntry: must be a positive integer.',
    })
  })

  it('rejects invalid golfer IDs', () => {
    expect(
      validatePickSubmission({
        golferIds: ['g1', '', 'g3', 'g4'],
        picksPerEntry: 4,
        isLocked: false,
      })
    ).toEqual({
      ok: false,
      error: 'Invalid golferIds: all IDs must be non-empty strings.',
    })

    expect(
      validatePickSubmission({
        golferIds: ['g1', '   ', 'g3', 'g4'],
        picksPerEntry: 4,
        isLocked: false,
      })
    ).toEqual({
      ok: false,
      error: 'Invalid golferIds: all IDs must be non-empty strings.',
    })
  })

  it('returns ok for exact picks count', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4'],
      picksPerEntry: 4,
      isLocked: false,
    })

    expect(result).toEqual({ ok: true })
  })

  it('rejects too few picks', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3'],
      picksPerEntry: 4,
      isLocked: false,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 3.',
    })
  })

  it('rejects too many picks', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4', 'g5'],
      picksPerEntry: 4,
      isLocked: false,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 5.',
    })
  })

  it('rejects locked pools', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4'],
      picksPerEntry: 4,
      isLocked: true,
    })

    expect(result).toEqual({
      ok: false,
      error: 'This pool is locked. Picks can no longer be changed.',
    })
  })

  it('rejects empty picks list', () => {
    const result = validatePickSubmission({
      golferIds: [],
      picksPerEntry: 4,
      isLocked: false,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 0.',
    })
  })

  it('rejects duplicate golfer picks', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g1', 'g4'],
      picksPerEntry: 4,
      isLocked: false,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Duplicate golfer selections are not allowed.',
    })
  })

  it('returns ok for non-default picks_per_entry', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'],
      picksPerEntry: 6,
      isLocked: false,
    })

    expect(result).toEqual({ ok: true })
  })
})

describe('isPoolLocked', () => {
  it('returns true for invalid deadline string', () => {
    expect(isPoolLocked('open', 'not-a-date', new Date('2099-04-09T08:00:00Z'))).toBe(true)
  })

  it('returns false for open pool with future deadline', () => {
    expect(
      isPoolLocked('open', '2099-04-10T08:00:00Z', new Date('2099-04-09T08:00:00Z'))
    ).toBe(false)
  })

  it('returns true for live pool', () => {
    expect(
      isPoolLocked('live', '2099-04-10T08:00:00Z', new Date('2099-04-09T08:00:00Z'))
    ).toBe(true)
  })

  it('returns true for complete pool', () => {
    expect(
      isPoolLocked(
        'complete',
        '2099-04-10T08:00:00Z',
        new Date('2099-04-09T08:00:00Z')
      )
    ).toBe(true)
  })

  it('returns true for open pool with past deadline', () => {
    expect(
      isPoolLocked('open', '2099-04-10T08:00:00Z', new Date('2099-04-11T08:00:00Z'))
    ).toBe(true)
  })

  it('supports explicit now parameter', () => {
    const deadline = '2099-04-10T08:00:00Z'

    expect(isPoolLocked('open', deadline, new Date(2099, 3, 9, 23, 59, 59))).toBe(false)
    expect(isPoolLocked('open', deadline, new Date(2099, 3, 10, 0, 0, 0))).toBe(true)
  })
})

describe('calculateRemainingPicks', () => {
  it('returns remaining picks for partial selection', () => {
    expect(calculateRemainingPicks(2, 4)).toBe(2)
  })

  it('returns zero when picks are filled', () => {
    expect(calculateRemainingPicks(4, 4)).toBe(0)
  })

  it('returns full picks_per_entry when selection is empty', () => {
    expect(calculateRemainingPicks(0, 4)).toBe(4)
  })

  it('returns zero when selection is overfilled', () => {
    expect(calculateRemainingPicks(6, 4)).toBe(0)
  })
})

describe('shouldAutoLock', () => {
  it('returns true when pool is open and deadline has passed', () => {
    expect(
      shouldAutoLock('open', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(true)
  })

  it('returns false when pool is open and deadline is in the future', () => {
    expect(
      shouldAutoLock('open', '2026-04-10T08:00:00Z', new Date(2026, 3, 9, 23, 0, 0))
    ).toBe(false)
  })

  it('returns false when pool is already live', () => {
    expect(
      shouldAutoLock('live', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('returns false when pool is complete', () => {
    expect(
      shouldAutoLock('complete', '2026-04-10T08:00:00Z', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('returns false when deadline is invalid', () => {
    expect(
      shouldAutoLock('open', 'not-a-date', new Date('2026-04-10T09:00:00Z'))
    ).toBe(false)
  })

  it('keeps the pool open through the deadline day until the UTC calendar date rolls over locally', () => {
    const deadline = '2026-04-02T00:00:00'
    const lockAt = getTournamentLockInstant(deadline)

    expect(lockAt?.getFullYear()).toBe(2026)
    expect(lockAt?.getMonth()).toBe(3)
    expect(lockAt?.getDate()).toBe(2)
    expect(lockAt?.getHours()).toBe(0)
    expect(shouldAutoLock('open', deadline, new Date(2026, 3, 1, 23, 59, 59, 999))).toBe(false)
    expect(shouldAutoLock('open', deadline, new Date(2026, 3, 2, 0, 0, 0))).toBe(true)
  })
})

describe('getTournamentLockInstant', () => {
  it('maps a UTC deadline date to browser-local midnight for that calendar day', () => {
    const lockAt = getTournamentLockInstant('2026-04-02T00:00:00+00:00')

    expect(lockAt?.getFullYear()).toBe(2026)
    expect(lockAt?.getMonth()).toBe(3)
    expect(lockAt?.getDate()).toBe(2)
    expect(lockAt?.getHours()).toBe(0)
    expect(lockAt?.getMinutes()).toBe(0)
  })
})
