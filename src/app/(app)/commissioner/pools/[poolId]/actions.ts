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
import {
  canTransitionStatus,
  validateCreatePoolInput,
  validatePoolFormat,
  buildClonePoolInput,
  generateInviteCode,
} from '@/lib/pool'
import {
  getPoolById,
  updatePoolStatus,
  updatePoolConfig as updatePoolConfigQuery,
  insertAuditEvent,
  insertPool,
  insertPoolMember,
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

export async function reusePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const sourcePool = await getPoolById(supabase, poolId)
  if (!sourcePool) return { error: 'Pool not found.' }
  if (sourcePool.commissioner_id !== user.id) {
    return { error: 'Only the commissioner can reuse this pool.' }
  }
  if (sourcePool.status !== 'complete') {
    return { error: 'Only completed pools can be reused.' }
  }

  const cloneInput = buildClonePoolInput(sourcePool)
  let clonedPool: Awaited<ReturnType<typeof getPoolById>> | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inviteCode = generateInviteCode()
    const { data, error: cloneError } = await insertPool(supabase, {
      commissioner_id: user.id,
      name: cloneInput.name,
      tournament_id: '',
      tournament_name: '',
      year: new Date().getFullYear(),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      timezone: sourcePool.timezone,
      format: cloneInput.format,
      picks_per_entry: cloneInput.picks_per_entry,
      invite_code: inviteCode,
      status: 'open',
      refreshed_at: null,
      last_refresh_error: null,
    })

    if (!cloneError && data) {
      clonedPool = data
      break
    }

    const isUniqueViolation =
      cloneError?.includes('23505')
      || cloneError?.toLowerCase().includes('unique')
      || cloneError?.toLowerCase().includes('duplicate')

    if (!isUniqueViolation) {
      return { error: 'Failed to clone pool.' }
    }
  }

  if (!clonedPool) {
    return { error: 'Failed to clone pool.' }
  }

  const { error: memberError } = await insertPoolMember(supabase, {
    pool_id: clonedPool.id,
    user_id: user.id,
    role: 'commissioner',
  })
  if (memberError) {
    return { error: 'Failed to initialize commissioner membership for cloned pool.' }
  }

  const { error: auditError } = await insertAuditEvent(supabase, {
    pool_id: clonedPool.id,
    user_id: user.id,
    action: 'poolCloned',
    details: { source_pool_id: sourcePool.id },
  })
  if (auditError) {
    return { error: 'Pool was cloned, but audit logging failed.' }
  }

  redirect(`/commissioner/pools/${clonedPool.id}`)
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
  } catch {
    const syncRunError = await recordGolferSyncRunOrError(supabase, {
        runType,
        requestedBy: user.id,
        tournamentId: pool.tournament_id,
        apiCallsUsed: 1,
        status: 'failed',
        summary: { golfers_upserted: 0 },
        errorMessage: 'Failed to refresh golfer catalog.',
      })

    if (syncRunError) {
      return { error: syncRunError }
    }

    return { error: 'Failed to refresh golfer catalog.' }
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
