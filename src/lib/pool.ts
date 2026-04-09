import type { PoolStatus, PoolFormat, Pool } from './supabase/types'
import { getTournamentLockInstant } from './picks'

export interface CreatePoolInput {
  name: string
  tournamentId: string
  tournamentName: string
  year: number
  deadline: string
  timezone: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string }

const VALID_FORMATS: PoolFormat[] = ['best_ball']

const STATUS_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  open: ['live'],
  live: ['complete'],
  complete: ['open', 'archived'],
  archived: [],
}

export function generateInviteCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(byte => chars[byte % chars.length])
    .join('')
}

export function validateCreatePoolInput(input: CreatePoolInput): ValidationResult {
  const trimmedName = input.name.trim()
  const trimmedTimezone = input.timezone.trim()
  if (!trimmedName) {
    return { ok: false, error: 'Pool name is required.' }
  }
  if (trimmedName.length > 100) {
    return { ok: false, error: 'Pool name must be 100 characters or fewer.' }
  }
  if (!input.tournamentId.trim()) {
    return { ok: false, error: 'Tournament selection is required.' }
  }
  if (!input.deadline.trim()) {
    return { ok: false, error: 'Picks deadline is required.' }
  }
  if (!trimmedTimezone) {
    return { ok: false, error: 'Timezone is required.' }
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmedTimezone })
  } catch {
    return { ok: false, error: 'Timezone must be a valid IANA timezone.' }
  }

  const lockAt = getTournamentLockInstant(input.deadline, trimmedTimezone)
  if (!lockAt || lockAt <= new Date()) {
    return { ok: false, error: 'Picks deadline must be in the future.' }
  }
  return { ok: true }
}

export function validatePoolFormat(
  format: PoolFormat,
  picksPerEntry: number
): ValidationResult {
  if (!VALID_FORMATS.includes(format)) {
    return { ok: false, error: 'Invalid pool format.' }
  }
  if (picksPerEntry < 1 || picksPerEntry > 10) {
    return { ok: false, error: 'Picks per entry must be between 1 and 10.' }
  }
  return { ok: true }
}

export function canTransitionStatus(
  current: PoolStatus,
  target: PoolStatus
): boolean {
  return STATUS_TRANSITIONS[current].includes(target)
}

export function canReopenPool(
  status: PoolStatus,
  deadline: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  if (status !== 'complete' && status !== 'live') return false

  const lockAt = getTournamentLockInstant(deadline, timezone)
  return lockAt !== null && lockAt.getTime() > now.getTime()
}


