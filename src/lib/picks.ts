import type { PoolStatus } from './supabase/types'

export interface PickSubmissionInput {
  golferIds: string[]
  picksPerEntry: number
  isLocked: boolean
}

export type PickValidationResult =
  | { ok: true }
  | { ok: false; error: string }

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
  now: Date = new Date()
): boolean {
  const deadlineTime = Date.parse(deadline)
  if (Number.isNaN(deadlineTime)) {
    return true
  }

  return !(status === 'open' && deadlineTime > now.getTime())
}

export function calculateRemainingPicks(
  currentCount: number,
  picksPerEntry: number
): number {
  return Math.max(0, picksPerEntry - currentCount)
}
