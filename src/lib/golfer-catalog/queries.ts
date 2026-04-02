import type { SupabaseClient } from '@supabase/supabase-js'

import type { GolferSyncRun } from '@/lib/supabase/types'

type SyncRunInsert = {
  run_type: GolferSyncRun['run_type']
  requested_by: string | null
  tournament_id: string | null
  api_calls_used: number
  status: GolferSyncRun['status']
  summary: Record<string, unknown>
  error_message: string | null
}

export function buildSyncRunInsert(input: {
  runType: GolferSyncRun['run_type']
  requestedBy: string | null
  tournamentId: string | null
  apiCallsUsed: number
  status: GolferSyncRun['status']
  summary: Record<string, unknown>
  errorMessage: string | null
}): SyncRunInsert {
  return {
    run_type: input.runType,
    requested_by: input.requestedBy,
    tournament_id: input.tournamentId,
    api_calls_used: input.apiCallsUsed,
    status: input.status,
    summary: input.summary,
    error_message: input.errorMessage,
  }
}

export async function insertGolferSyncRun(
  supabase: SupabaseClient,
  payload: SyncRunInsert,
): Promise<{ data: GolferSyncRun | null; error: string | null }> {
  const { data, error } = await supabase.from('golfer_sync_runs').insert(payload).select().single()
  if (error) return { data: null, error: error.message }
  return { data: data as GolferSyncRun, error: null }
}

export async function getLatestGolferSyncRun(
  supabase: SupabaseClient,
): Promise<GolferSyncRun | null> {
  const { data, error } = await supabase
    .from('golfer_sync_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load latest golfer sync run: ${error.message}`)
  }

  return data as GolferSyncRun | null
}

export async function getMonthlyApiUsage(
  supabase: SupabaseClient,
  now: Date,
): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const { data, error } = await supabase
    .from('golfer_sync_runs')
    .select('api_calls_used')
    .gte('created_at', monthStart)
    .lt('created_at', nextMonthStart)

  if (error) {
    throw new Error(`Failed to load monthly API usage: ${error.message}`)
  }

  return (data ?? []).reduce((sum, row) => {
    const apiCallsUsed = typeof row.api_calls_used === 'number' && Number.isFinite(row.api_calls_used)
      && row.api_calls_used >= 0
      ? row.api_calls_used
      : 0

    return sum + apiCallsUsed
  }, 0)
}
