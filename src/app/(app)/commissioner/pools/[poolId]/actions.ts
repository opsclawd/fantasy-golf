'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { searchPlayers } from '@/lib/golfer-catalog/rapidapi'
import {
  DEFAULT_CATALOG_RUN_DECISION_INPUTS,
  buildManualAddQuery,
  decideCatalogRun,
} from '@/lib/golfer-catalog/service'
import {
  buildSyncRunInsert,
  getMonthlyApiUsage,
  insertGolferSyncRun,
} from '@/lib/golfer-catalog/queries'
import { getGolfers } from '@/lib/slash-golf/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canTransitionStatus,
  validateCreatePoolInput,
  validatePoolFormat,
  canReopenPool,
} from '@/lib/pool'
import { isCommissionerPoolLocked } from '@/lib/picks'
import {
  getPoolById,
  updatePoolStatus,
  updatePoolConfig as updatePoolConfigQuery,
  insertAuditEvent,
  recordPoolDeletion,
  deletePoolById,
} from '@/lib/pool-queries'
import { buildTournamentRosterInsert } from '@/lib/tournament-roster/queries'
import type { PoolFormat, PoolStatus } from '@/lib/supabase/types'

// --- Status transition actions ---

export type PoolActionState = {
  error?: string
} | null

export async function startPool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can start this pool.' }
  if (pool.status === 'open' && isCommissionerPoolLocked(pool.status, pool.deadline, pool.timezone)) {
    return { error: 'This pool is locked. It can no longer be started.' }
  }

  if (!canTransitionStatus(pool.status as PoolStatus, 'live')) {
    return { error: 'Pool cannot be started from its current state.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'live', 'open')
  if (error) return { error: 'Failed to start pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolStarted',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function closePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can close this pool.' }

  if (!canTransitionStatus(pool.status as PoolStatus, 'complete')) {
    return { error: 'Pool cannot be closed from its current state.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'complete', 'live')
  if (error) return { error: 'Failed to close pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolClosed',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function reopenPool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can reopen this pool.' }
  if (pool.status !== 'complete' && pool.status !== 'live') return { error: 'Only live or completed pools can be reopened.' }
  if (!canReopenPool(pool.status as PoolStatus, pool.deadline, pool.timezone)) {
    return { error: 'This pool can no longer be reopened because the deadline has passed.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'open', pool.status)
  if (error) return { error: 'Failed to reopen pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolReopened',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function archivePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can archive this pool.' }
  if (pool.status !== 'complete') return { error: 'Only completed pools can be archived.' }

  const { error } = await updatePoolStatus(supabase, poolId, 'archived', 'complete')
  if (error) return { error: 'Failed to archive pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolArchived',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function deletePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can delete this pool.' }
  if (pool.status !== 'open' && pool.status !== 'archived') return { error: 'Only open or archived pools can be deleted.' }

  const admin = createAdminClient()

  const snapshot = {
    id: pool.id,
    commissioner_id: pool.commissioner_id,
    name: pool.name,
    tournament_id: pool.tournament_id,
    tournament_name: pool.tournament_name,
    year: pool.year,
    deadline: pool.deadline,
    timezone: pool.timezone,
    format: pool.format,
    picks_per_entry: pool.picks_per_entry,
    invite_code: pool.invite_code,
    status: pool.status,
    created_at: pool.created_at,
    refreshed_at: pool.refreshed_at,
    last_refresh_error: pool.last_refresh_error,
  }

  const tombstone = await recordPoolDeletion(admin, {
    pool_id: pool.id,
    commissioner_id: pool.commissioner_id,
    deleted_by: user.id,
    status_at_delete: pool.status as PoolStatus,
    snapshot,
  })
  if (tombstone.error) return { error: 'Failed to record pool deletion.' }

  const deletion = await deletePoolById(admin, pool.id)
  if (deletion.error) return { error: 'Failed to delete pool.' }

  redirect('/commissioner')
}

// --- Config update action ---

export type UpdatePoolConfigState = {
  error?: string
  success?: boolean
} | null

export async function updatePoolConfigAction(
  _prevState: UpdatePoolConfigState,
  formData: FormData
): Promise<UpdatePoolConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can update this pool.' }
  if (pool.status !== 'open') return { error: 'Pool configuration can only be changed while the pool is open.' }
  if (isCommissionerPoolLocked(pool.status, pool.deadline, pool.timezone)) {
    return { error: 'This pool is locked. Configuration can no longer be changed.' }
  }

  const tournamentId = (formData.get('tournamentId') as string) ?? pool.tournament_id
  const tournamentName = (formData.get('tournamentName') as string) ?? pool.tournament_name
  const deadline = (formData.get('deadline') as string) ?? pool.deadline
  const timezone = (formData.get('timezone') as string) ?? pool.timezone
  const yearStr = ((formData.get('year') as string) ?? String(pool.year)).trim()
  const format = ((formData.get('format') as string) ?? pool.format) as PoolFormat
  const picksPerEntryStr = ((formData.get('picksPerEntry') as string) ?? String(pool.picks_per_entry)).trim()

  if (!/^\d{4}$/.test(yearStr)) {
    return { error: 'Year must be a 4-digit number.' }
  }

  if (!/^\d+$/.test(picksPerEntryStr)) {
    return { error: 'Picks per entry must be a whole number.' }
  }

  const year = parseInt(yearStr, 10)
  const picksPerEntry = parseInt(picksPerEntryStr, 10)

  const inputValidation = validateCreatePoolInput({
    name: pool.name,
    tournamentId,
    tournamentName,
    year,
    deadline,
    timezone,
  })

  if (!inputValidation.ok) return { error: inputValidation.error }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) return { error: formatValidation.error }

  const { error } = await updatePoolConfigQuery(supabase, poolId, {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    timezone: timezone.trim(),
    format,
    picks_per_entry: picksPerEntry,
  })

  if (error) return { error: 'Failed to update pool configuration.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolConfigUpdated',
    details: { tournament_id: tournamentId, format, picks_per_entry: picksPerEntry },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export type GolferCatalogActionState = {
  error?: string
  success?: boolean
} | null

async function recordGolferSyncRunOrError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: Parameters<typeof buildSyncRunInsert>[0],
): Promise<string | null> {
  const { error } = await insertGolferSyncRun(supabase, buildSyncRunInsert(payload))

  if (error) {
    return 'Failed to record golfer catalog sync run.'
  }

  return null
}

export async function refreshGolferCatalogAction(
  _prevState: GolferCatalogActionState,
  formData: FormData,
): Promise<GolferCatalogActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = String(formData.get('poolId') ?? '')
  const runType: 'pre_tournament' = 'pre_tournament'
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) {
    return { error: 'Only the commissioner can refresh the golfer catalog.' }
  }

  let usedCalls: number

  try {
    usedCalls = await getMonthlyApiUsage(supabase, new Date())
  } catch {
    return { error: 'Failed to load golfer catalog usage.' }
  }

  const decision = decideCatalogRun({
    ...DEFAULT_CATALOG_RUN_DECISION_INPUTS,
    runType,
    usedCalls,
  })

  if (!decision.allowed) {
    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType,
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 0,
        status: 'blocked',
        summary: { reason: decision.reason },
        errorMessage: decision.reason,
      })

    if (syncRunError) {
      return { error: syncRunError }
    }

    return { error: decision.reason }
  }

  const nowIso = new Date().toISOString()

  try {
    const golfers = await getGolfers(pool.tournament_id, pool.year)
    const rows = golfers.map((golfer) => buildTournamentRosterInsert({
      tournamentId: pool.tournament_id,
      golfer: { ...golfer, id: golfer.id },
      source: 'refresh',
      syncedAt: nowIso,
    }))
    const { error: upsertError } = await supabase.from('tournament_golfers').upsert(rows, {
      onConflict: 'tournament_id,external_player_id',
    })

    if (upsertError) {
      const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType,
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        errorMessage: upsertError.message,
      })

      if (syncRunError) {
        return { error: syncRunError }
      }

      return { error: 'Failed to refresh golfer catalog.' }
    }

    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType,
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'success',
        summary: { golfers_upserted: rows.length },
        errorMessage: null,
      })

    if (syncRunError) {
      return { error: syncRunError }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh golfer catalog.'

    const syncRunError = await recordGolferSyncRunOrError(supabase, {
      runType,
      requestedBy: user.id,
      tournamentId: pool.tournament_id,
      apiCallsUsed: 1,
      status: message === 'Tournament field has not been published yet.' ? 'blocked' : 'failed',
      summary: {
        golfers_upserted: 0,
        reason: message,
      },
      errorMessage: message,
    })

    if (syncRunError) {
      return { error: syncRunError }
    }

    return {
      error:
        message === 'Tournament field has not been published yet.'
          ? message
          : 'Failed to refresh golfer catalog.',
    }
  }

  revalidatePath(`/commissioner/pools/${poolId}`)
  return { success: true }
}

export async function addMissingGolferAction(
  _prevState: GolferCatalogActionState,
  formData: FormData,
): Promise<GolferCatalogActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = String(formData.get('poolId') ?? '')
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can add golfers.' }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  if (!fullName) {
    return { error: 'Enter at least a first or last name.' }
  }

  let usedCalls: number

  try {
    usedCalls = await getMonthlyApiUsage(supabase, new Date())
  } catch {
    return { error: 'Failed to load golfer catalog usage.' }
  }

  const decision = decideCatalogRun({
    ...DEFAULT_CATALOG_RUN_DECISION_INPUTS,
    runType: 'manual_add',
    usedCalls,
  })

  if (!decision.allowed) {
    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType: 'manual_add',
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 0,
        status: 'blocked',
        summary: { reason: decision.reason },
        errorMessage: decision.reason,
      })

    if (syncRunError) {
      return { error: syncRunError }
    }

    return { error: decision.reason }
  }

  try {
    const players = await searchPlayers(buildManualAddQuery({ firstName, lastName }))
    const player = players[0]

    if (!player) {
      const syncRunError = await recordGolferSyncRunOrError(supabase, {
          runType: 'manual_add',
          requestedBy: user.id,
          tournamentId: pool.tournament_id,
          apiCallsUsed: 1,
          status: 'failed',
          summary: { golfers_upserted: 0 },
          errorMessage: 'No golfer matched that search.',
        })

      if (syncRunError) {
        return { error: syncRunError }
      }

      return { error: 'No golfer matched that search.' }
    }

    const syncedAt = new Date().toISOString()
    const row = buildTournamentRosterInsert({
      tournamentId: pool.tournament_id,
      golfer: { ...player, id: player.playerId },
      source: 'manual_add',
      syncedAt,
    })
    const { error: upsertError } = await supabase.from('tournament_golfers').upsert([row], {
      onConflict: 'tournament_id,external_player_id',
    })

    if (upsertError) {
      const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType: 'manual_add',
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        errorMessage: upsertError.message,
      })

      if (syncRunError) {
        return { error: syncRunError }
      }

      return { error: 'Failed to add golfer.' }
    }

    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType: 'manual_add',
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'success',
        summary: { golfers_upserted: 1, golfer_name: [player.firstName, player.lastName].filter(Boolean).join(' ').trim() },
        errorMessage: null,
      })

    if (syncRunError) {
      return { error: syncRunError }
    }
  } catch {
    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType: 'manual_add',
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        errorMessage: 'Failed to add golfer.',
      })

    if (syncRunError) {
      return { error: syncRunError }
    }

    return { error: 'Failed to add golfer.' }
  }

  revalidatePath(`/commissioner/pools/${poolId}`)
  return { success: true }
}
