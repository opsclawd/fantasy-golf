'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canTransitionStatus, validateCreatePoolInput, validatePoolFormat } from '@/lib/pool'
import { getPoolById, updatePoolStatus, updatePoolConfig as updatePoolConfigQuery, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat } from '@/lib/supabase/types'

export async function startPool(_prevState: unknown, formData: FormData) {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/sign-in')
  }

  const pool = await getPoolById(supabase, poolId)

  if (!pool || !canTransitionStatus(pool.status, 'live')) {
    return { error: 'Pool cannot be started' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'live')

  if (error) {
    console.error('Failed to start pool:', error)
    return { error: 'Failed to start pool' }
  }

  redirect(`/commissioner/pools/${poolId}`)
}

export async function closePool(_prevState: unknown, formData: FormData) {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/sign-in')
  }

  const pool = await getPoolById(supabase, poolId)

  if (!pool || !canTransitionStatus(pool.status, 'complete')) {
    return { error: 'Pool cannot be closed' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'complete')

  if (error) {
    console.error('Failed to close pool:', error)
    return { error: 'Failed to close pool' }
  }

  redirect(`/commissioner/pools/${poolId}`)
}

export type UpdatePoolConfigState = {
  error?: string
} | null

export async function updatePoolConfigAction(
  _prevState: UpdatePoolConfigState,
  formData: FormData
): Promise<UpdatePoolConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const poolId = (formData.get('poolId') as string) ?? ''
  if (!poolId) {
    return { error: 'Pool ID is required.' }
  }

  const pool = await getPoolById(supabase, poolId)
  if (!pool) {
    return { error: 'Pool not found.' }
  }

  if (pool.commissioner_id !== user.id) {
    return { error: 'You are not authorized to update this pool.' }
  }

  if (pool.status !== 'open') {
    return { error: 'Pool configuration can only be updated while the pool is open.' }
  }

  const tournamentId = ((formData.get('tournamentId') as string) ?? '').trim()
  const tournamentName = ((formData.get('tournamentName') as string) ?? '').trim()
  const deadline = (formData.get('deadline') as string) ?? ''
  const yearStr = (formData.get('year') as string) ?? ''
  const format = ((formData.get('format') as string) ?? 'best_ball') as PoolFormat
  const picksPerEntryStr = (formData.get('picksPerEntry') as string) ?? ''

  const year = Number.parseInt(yearStr, 10)
  const picksPerEntry = Number.parseInt(picksPerEntryStr, 10)

  if (!Number.isFinite(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: 'Tournament year must be a valid year between 2000 and 2100.' }
  }

  const parsedDeadline = new Date(deadline)
  if (Number.isNaN(parsedDeadline.getTime())) {
    return { error: 'Tournament deadline must be a valid date.' }
  }

  const inputValidation = validateCreatePoolInput({
    name: pool.name,
    tournamentId,
    tournamentName,
    year,
    deadline,
  })

  if (!inputValidation.ok) {
    return { error: inputValidation.error }
  }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) {
    return { error: formatValidation.error }
  }

  const { error: updateError } = await updatePoolConfigQuery(supabase, poolId, {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    format,
    picks_per_entry: picksPerEntry,
  })

  if (updateError) {
    return { error: updateError }
  }

  const { error: auditError } = await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolConfigUpdated',
    details: {
      previous: {
        tournament_id: pool.tournament_id,
        tournament_name: pool.tournament_name,
        year: pool.year,
        deadline: pool.deadline,
        format: pool.format,
        picks_per_entry: pool.picks_per_entry,
      },
      updated: {
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        year,
        deadline,
        format,
        picks_per_entry: picksPerEntry,
      },
    },
  })

  if (auditError) {
    return { error: `Pool updated, but audit logging failed: ${auditError}` }
  }

  redirect(`/commissioner/pools/${poolId}`)
}
