import type { PoolStatus } from './supabase/types'

export interface PickSubmissionInput {
  golferIds: string[]
  picksPerEntry: number
  status: PoolStatus
  deadline: string
}

export type PickValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export function validatePickSubmission(
  input: PickSubmissionInput
): PickValidationResult {
  if (isPoolLocked(input.status, input.deadline)) {
    return { ok: false, error: 'This pool is locked. Picks can no longer be changed.' }
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
  return !(status === 'open' && new Date(deadline) > now)
}

export function calculateRemainingPicks(
  currentCount: number,
  picksPerEntry: number
): number {
  return Math.max(0, picksPerEntry - currentCount)
}
