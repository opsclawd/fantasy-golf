import type { PoolStatus } from './supabase/types'

export interface PickSubmissionInput {
  golferIds: string[]
  picksPerEntry: number
  isLocked: boolean
}

export type PickValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export function getTournamentLockInstant(
  deadline: string,
  timezone: string
): Date | null {
  const dateOnly = deadline.split('T')[0].split(' ')[0]
  const parsedDate = new Date(dateOnly + 'T12:00:00')
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const df = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = df.formatToParts(parsedDate)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''

  if (!year || !month || !day) {
    return null
  }

  return new Date(`${year}-${month}-${day}T00:00:00`)
}

export function validatePickSubmission(
  input: PickSubmissionInput
): PickValidationResult {
  if (input.isLocked) {
    return { ok: false, error: 'This pool is locked. Picks can no longer be changed.' }
  }

  if (!Number.isInteger(input.picksPerEntry) || input.picksPerEntry <= 0) {
    return { ok: false, error: 'Invalid picksPerEntry: must be a positive integer.' }
  }

  if (
    input.golferIds.some(
      (id) => typeof id !== 'string' || id.trim().length === 0
    )
  ) {
    return { ok: false, error: 'Invalid golferIds: all IDs must be non-empty strings.' }
  }

  if (new Set(input.golferIds).size !== input.golferIds.length) {
    return { ok: false, error: 'Duplicate golfer selections are not allowed.' }
  }

  const len = input.golferIds.length
  if (len !== input.picksPerEntry) {
    return {
      ok: false,
      error: `Please select exactly ${input.picksPerEntry} golfers. You have selected ${len}.`,
    }
  }

  return { ok: true }
}

export function isPoolLocked(
  status: PoolStatus,
  deadline: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  const lockAt = getTournamentLockInstant(deadline, timezone)
  if (!lockAt) {
    return true
  }

  return !(status === 'open' && lockAt.getTime() > now.getTime())
}

export function isCommissionerPoolLocked(
  status: PoolStatus,
  deadline: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  const lockAt = getTournamentLockInstant(deadline, timezone)
  if (!lockAt) {
    return true
  }

  return status !== 'open' || lockAt.getTime() <= now.getTime()
}

export function calculateRemainingPicks(
  currentCount: number,
  picksPerEntry: number
): number {
  return Math.max(0, picksPerEntry - currentCount)
}

/**
 * Determines if a pool should be automatically locked (transitioned to 'live').
 * Only returns true for 'open' pools whose deadline has passed.
 */
export function shouldAutoLock(
  status: PoolStatus,
  deadline: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  if (status !== 'open') return false

  const lockAt = getTournamentLockInstant(deadline, timezone)
  if (!lockAt) return false

  return now.getTime() >= lockAt.getTime()
}
