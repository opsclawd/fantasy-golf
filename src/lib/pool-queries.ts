import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pool, PoolMember, AuditEvent, PoolStatus } from './supabase/types'

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
  status: PoolStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update({ status })
    .eq('id', poolId)
  if (error) return { error: error.message }
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
