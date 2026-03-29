import type { SupabaseClient } from '@supabase/supabase-js'
import type { Entry, MemberRole, Pool } from './supabase/types'

type MemberPool = Pick<
  Pool,
  'id' | 'name' | 'tournament_name' | 'status' | 'deadline' | 'picks_per_entry'
>

type EntrySummary = {
  golfer_ids: string[]
}

type PoolMemberWithPool = {
  pool_id: string
  role: MemberRole
  pools: MemberPool | MemberPool[] | null
}

export async function getEntryByPoolAndUser(
  supabase: SupabaseClient,
  poolId: string,
  userId: string
): Promise<Entry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch entry for pool ${poolId}: ${error.message}`)
  }

  return (data as Entry | null) ?? null
}

export async function upsertEntry(
  supabase: SupabaseClient,
  entry: Pick<Entry, 'pool_id' | 'user_id' | 'golfer_ids'>
): Promise<{ data: Entry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('entries')
    .upsert(
      {
        ...entry,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pool_id,user_id' }
    )
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Entry, error: null }
}

export async function getPoolsForMember(
  supabase: SupabaseClient,
  userId: string
): Promise<
  Array<{
    pool_id: string
    role: MemberRole
    pool: MemberPool
    entry: EntrySummary | null
  }>
> {
  const { data: memberRows, error: membersError } = await supabase
    .from('pool_members')
    .select('pool_id, role, pools(id, name, tournament_name, status, deadline, picks_per_entry)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (membersError) {
    throw new Error(`Failed to fetch pools for member ${userId}: ${membersError.message}`)
  }

  if (!memberRows) return []

  const members = memberRows as PoolMemberWithPool[]
  const poolIds = members.map((member) => member.pool_id)
  if (poolIds.length === 0) return []

  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('pool_id, golfer_ids')
    .eq('user_id', userId)
    .in('pool_id', poolIds)

  if (entriesError) {
    throw new Error(`Failed to fetch entries for member ${userId}: ${entriesError.message}`)
  }

  const entryByPoolId = new Map<string, EntrySummary>()
  for (const entry of entries || []) {
    const row = entry as { pool_id: string; golfer_ids: string[] }
    entryByPoolId.set(row.pool_id, { golfer_ids: row.golfer_ids })
  }

  return members.flatMap((member) => {
    const poolValue = Array.isArray(member.pools)
      ? member.pools[0] ?? null
      : member.pools

    if (!poolValue) return []

    return {
      pool_id: member.pool_id,
      role: member.role,
      pool: poolValue,
      entry: entryByPoolId.get(member.pool_id) ?? null,
    }
  })
}
