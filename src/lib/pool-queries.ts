import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pool, PoolMember, AuditEvent, PoolStatus, LockAcquireResult } from './supabase/types'
import { getTournamentLockInstant } from './picks'

const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function insertPool(
  supabase: SupabaseClient,
  pool: Omit<Pool, 'id' | 'created_at'>
): Promise<{ data: Pool | null; error: string | null }> {
  const { data, error } = await supabase
    .from('pools')
    .insert(pool)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Pool, error: null }
}

export async function insertPoolMember(
  supabase: SupabaseClient,
  member: Omit<PoolMember, 'id' | 'joined_at'>
): Promise<{ error: string | null; code: string | null }> {
  const { error } = await supabase.from('pool_members').insert(member)
  if (error) return { error: error.message, code: error.code ?? null }
  return { error: null, code: null }
}

export async function getPoolById(
  supabase: SupabaseClient,
  poolId: string
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()
  return data as Pool | null
}

export async function getPoolByInviteCode(
  supabase: SupabaseClient,
  inviteCode: string
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  return data as Pool | null
}

export async function getPoolsByCommissioner(
  supabase: SupabaseClient,
  commissionerId: string
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('commissioner_id', commissionerId)
    .order('created_at', { ascending: false })
  return (data as Pool[]) || []
}

export async function getPoolsByTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false })

  return (data as Pool[]) || []
}

export async function getPoolMembers(
  supabase: SupabaseClient,
  poolId: string
): Promise<PoolMember[]> {
  const { data } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', poolId)
    .order('joined_at', { ascending: true })
  return (data as PoolMember[]) || []
}

export async function isPoolMember(
  supabase: SupabaseClient,
  poolId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .single()
  return data !== null
}

export async function updatePoolStatus(
  supabase: SupabaseClient,
  poolId: string,
  status: PoolStatus,
  expectedCurrentStatus?: PoolStatus
): Promise<{ error: string | null }> {
  let query = supabase
    .from('pools')
    .update({ status })
    .eq('id', poolId)

  if (expectedCurrentStatus) {
    query = query.eq('status', expectedCurrentStatus)
  }

  const { data, error } = await query.select('id')

  if (error) return { error: error.message }
  if (expectedCurrentStatus && (!data || data.length === 0)) {
    return { error: 'Pool state changed. Please refresh and try again.' }
  }

  return { error: null }
}

export async function updatePoolConfig(
  supabase: SupabaseClient,
  poolId: string,
  updates: {
    tournament_id?: string
    tournament_name?: string
    year?: number
    deadline?: string
    timezone?: string
    format?: string
    picks_per_entry?: number
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function insertAuditEvent(
  supabase: SupabaseClient,
  event: Omit<AuditEvent, 'id' | 'created_at'>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('audit_events').insert(event)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getAuditEventsForPool(
  supabase: SupabaseClient,
  poolId: string,
  options?: { actionFilter?: string[]; limit?: number }
): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_events')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })

  if (options?.actionFilter?.length) {
    query = query.in('action', options.actionFilter)
  }

  if (
    typeof options?.limit === 'number' &&
    Number.isFinite(options.limit) &&
    Number.isInteger(options.limit) &&
    options.limit > 0
  ) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch audit events for pool ${poolId}: ${error.message}`)
  }

  return (data as AuditEvent[]) || []
}

export async function getEntriesForPool(
  supabase: SupabaseClient,
  poolId: string
): Promise<unknown[]> {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)
  return data || []
}

export async function updatePoolRefreshMetadata(
  supabase: SupabaseClient,
  poolId: string,
  metadata: { refreshed_at?: string; last_refresh_error?: string | null; last_refresh_success_at?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update(metadata)
    .eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getActivePool(
  supabase: SupabaseClient
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'live')
    .limit(1)
    .maybeSingle()
  return data as Pool | null
}

export async function getOpenPoolsPastDeadline(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'open')

  return ((data as Pool[]) || []).filter((pool) => {
    if (pool.status !== 'open') {
      return false
    }

    const lockAt = getTournamentLockInstant(pool.deadline, pool.timezone)
    return lockAt !== null && lockAt.getTime() <= now.getTime()
  })
}

export async function recordPoolDeletion(
  supabase: SupabaseClient,
  record: Omit<import('./supabase/types').PoolDeletion, 'id' | 'deleted_at'>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pool_deletions')
    .upsert(record, { onConflict: 'pool_id' })

  if (error) return { error: error.message }
  return { error: null }
}

export async function deletePoolById(
  supabase: SupabaseClient,
  poolId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pools').delete().eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function acquireRefreshLock(
  supabase: SupabaseClient,
  tournamentId: string,
  lockId: string
): Promise<LockAcquireResult> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS)

  const lockRecord = {
    tournament_id: tournamentId,
    locked_by: lockId,
    locked_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }

  const { error: insertError } = await (supabase as any)
    .from('refresh_locks')
    .insert(lockRecord)

  if (!insertError) {
    return { acquired: true, lockId }
  }

  if (insertError.code === '23505') {
    const { data: existing } = await (supabase as any)
      .from('refresh_locks')
      .select('locked_by, expires_at')
      .eq('tournament_id', tournamentId)
      .single()

    if (existing) {
      const existingExpiry = new Date(existing.expires_at)
      if (existingExpiry <= now) {
        const { error: updateError } = await (supabase as any)
          .from('refresh_locks')
          .update({
            locked_by: lockId,
            locked_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq('tournament_id', tournamentId)
          .eq('expires_at', existing.expires_at)

        if (!updateError) {
          return { acquired: true, lockId }
        }
      }
      return {
        acquired: false,
        heldBy: existing.locked_by,
        expiresAt: existing.expires_at,
      }
    }
  }

  return { acquired: false }
}

export async function releaseRefreshLock(
  supabase: SupabaseClient,
  tournamentId: string,
  lockId: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase as any)
    .from('refresh_locks')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('locked_by', lockId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function updatePoolRefreshTelemetry(
  supabase: SupabaseClient,
  poolId: string,
  telemetry: { refresh_attempt_count?: 'increment'; last_refresh_attempt_at?: string }
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}

  if (telemetry.refresh_attempt_count === 'increment') {
    const { data: pool } = await supabase
      .from('pools')
      .select('refresh_attempt_count')
      .eq('id', poolId)
      .single()
    updates.refresh_attempt_count = (pool?.refresh_attempt_count ?? 0) + 1
  }

  if (telemetry.last_refresh_attempt_at) {
    updates.last_refresh_attempt_at = telemetry.last_refresh_attempt_at
  }

  if (Object.keys(updates).length === 0) {
    return { error: null }
  }

  const { error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId)

  if (error) return { error: error.message }
  return { error: null }
}
