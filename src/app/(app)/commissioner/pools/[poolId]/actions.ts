'use server'

import { redirect } from 'next/navigation'
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
  const inviteCode = generateInviteCode()

  const { data: clonedPool, error: cloneError } = await insertPool(supabase, {
    commissioner_id: user.id,
    name: cloneInput.name,
    tournament_id: sourcePool.tournament_id,
    tournament_name: sourcePool.tournament_name,
    year: sourcePool.year,
    deadline: sourcePool.deadline,
    format: cloneInput.format,
    picks_per_entry: cloneInput.picks_per_entry,
    invite_code: inviteCode,
    status: 'open',
  })

  if (cloneError || !clonedPool) {
    return { error: cloneError ?? 'Failed to clone pool.' }
  }

  const { error: memberError } = await insertPoolMember(supabase, {
    pool_id: clonedPool.id,
    user_id: user.id,
    role: 'commissioner',
  })
  if (memberError) {
    return { error: `Pool cloned, but commissioner membership setup failed: ${memberError}` }
  }

  const { error: auditError } = await insertAuditEvent(supabase, {
    pool_id: clonedPool.id,
    user_id: user.id,
    action: 'poolCloned',
    details: { source_pool_id: sourcePool.id },
  })
  if (auditError) {
    return { error: `Pool cloned, but audit logging failed: ${auditError}` }
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
  })

  if (!inputValidation.ok) return { error: inputValidation.error }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) return { error: formatValidation.error }

  const { error } = await updatePoolConfigQuery(supabase, poolId, {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
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
