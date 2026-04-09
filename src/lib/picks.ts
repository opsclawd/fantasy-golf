import type { PoolStatus } from './supabase/types'

export interface PickSubmissionInput {
  golferIds: string[]
  picksPerEntry: number
  isLocked: boolean
}

export type PickValidationResult =
  | { ok: true }
  | { ok: false; error: string }

interface CalendarDateParts {
  year: number
  month: number
  day: number
}

function parseDeadlineDate(deadline: string): CalendarDateParts | null {
  const match = deadline.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function getTimezoneOffsetMillis(date: Date, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })

    const parts = formatter.formatToParts(date)
    const values: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value
      }
    }

    const year = Number(values.year)
    const month = Number(values.month)
    const day = Number(values.day)
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    const second = Number(values.second)

    if (
      [year, month, day, hour, minute, second].some((value) => Number.isNaN(value))
    ) {
      return null
    }

    return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime()
  } catch {
    return null
  }
}

export function getTournamentLockInstant(deadline: string, timeZone: string): Date | null {
  const deadlineDate = parseDeadlineDate(deadline)
  if (!deadlineDate) {
    return null
  }

  const utcMidnight = Date.UTC(deadlineDate.year, deadlineDate.month - 1, deadlineDate.day)
  let lockAt = utcMidnight

  // Recompute once because the zone offset can change between UTC midnight and local midnight.
  for (let i = 0; i < 3; i += 1) {
    const offsetMillis = getTimezoneOffsetMillis(new Date(lockAt), timeZone)
    if (offsetMillis === null) {
      return null
    }

    const nextLockAt = utcMidnight - offsetMillis
    if (nextLockAt === lockAt) {
      break
    }

    lockAt = nextLockAt
  }

  return new Date(lockAt)
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
  timeZone: string,
  now: Date = new Date()
): boolean {
  const lockAt = getTournamentLockInstant(deadline, timeZone)
  if (!lockAt) {
    return true
  }

  return !(status === 'open' && lockAt.getTime() > now.getTime())
}

export function isCommissionerPoolLocked(
  status: PoolStatus,
  deadline: string,
  timeZone: string,
  now: Date = new Date()
): boolean {
  const lockAt = getTournamentLockInstant(deadline, timeZone)
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
  timeZone: string,
  now: Date = new Date()
): boolean {
  if (status !== 'open') return false

  const lockAt = getTournamentLockInstant(deadline, timeZone)
  if (!lockAt) return false

  return now.getTime() >= lockAt.getTime()
}
