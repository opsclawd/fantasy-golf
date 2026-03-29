'use server'

import { createClient } from '@/lib/supabase/server'
import { getEntryByPoolAndUser, upsertEntry } from '@/lib/entry-queries'
import { isPoolLocked, validatePickSubmission } from '@/lib/picks'
import { getPoolById, insertAuditEvent, isPoolMember } from '@/lib/pool-queries'
import { redirect } from 'next/navigation'

export type SubmitPicksState = {
  error?: string
  success?: boolean
} | null

export async function submitPicks(formData: FormData): Promise<SubmitPicksState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const saveErrorMessage = 'Failed to save picks. Please try again.'
  const lockErrorMessage = 'This pool is locked. Picks can no longer be changed.'

  if (!user) {
    redirect('/sign-in')
  }

  const rawPoolId = formData.get('poolId')
  const poolId = typeof rawPoolId === 'string' ? rawPoolId.trim() : ''
  if (!poolId) {
    return { error: 'Pool ID is required.' }
  }

  const rawGolferIds = formData.get('golferIds')
  if (typeof rawGolferIds !== 'string') {
    return { error: 'Golfer selections are required.' }
  }

  let golferIds: unknown
  try {
    golferIds = JSON.parse(rawGolferIds)
  } catch {
    return { error: 'Invalid golfer selections payload.' }
  }

  if (!Array.isArray(golferIds)) {
    return { error: 'Invalid golfer selections payload.' }
  }

  if (golferIds.some((id) => typeof id !== 'string')) {
    return { error: 'Invalid golfer selections payload.' }
  }

  const selectedGolferIds = golferIds as string[]

  try {
    const pool = await getPoolById(supabase, poolId)
    if (!pool) {
      return { error: 'Pool not found.' }
    }

    const member = await isPoolMember(supabase, poolId, user.id)
    if (!member) {
      return { error: 'You must join this pool before submitting picks.' }
    }

    const locked = isPoolLocked(pool.status, pool.deadline)
    const validation = validatePickSubmission({
      golferIds: selectedGolferIds,
      picksPerEntry: pool.picks_per_entry,
      isLocked: locked,
    })

    if (!validation.ok) {
      return { error: validation.error }
    }

    const { data: golfers, error: golferLookupError } = await supabase
      .from('golfers')
      .select('id')
      .in('id', selectedGolferIds)

    if (golferLookupError) {
      console.error('Failed to validate golfer IDs', {
        poolId,
        userId: user.id,
        error: golferLookupError,
      })
      return { error: 'Failed to submit picks.' }
    }

    if (!golfers || golfers.length !== selectedGolferIds.length) {
      return { error: 'One or more selected golfers are invalid.' }
    }

    const latestPool = await getPoolById(supabase, poolId)
    if (!latestPool) {
      return { error: 'Pool not found.' }
    }

    if (isPoolLocked(latestPool.status, latestPool.deadline)) {
      return { error: lockErrorMessage }
    }

    const existingEntry = await getEntryByPoolAndUser(supabase, poolId, user.id)
    const auditAction = existingEntry ? 'picksUpdated' : 'picksSubmitted'

    const { error: upsertError } = await upsertEntry(supabase, {
      pool_id: poolId,
      user_id: user.id,
      golfer_ids: selectedGolferIds,
    })

    if (upsertError) {
      console.error('Failed to upsert entry', { poolId, userId: user.id, error: upsertError })
      return { error: 'Failed to submit picks.' }
    }

    const { error: auditError } = await insertAuditEvent(supabase, {
      pool_id: poolId,
      user_id: user.id,
      action: auditAction,
      details: {
        golfer_ids: selectedGolferIds,
        picks_per_entry: pool.picks_per_entry,
      },
    })

    if (auditError) {
      console.error('Failed to insert picks audit event', {
        poolId,
        userId: user.id,
        action: auditAction,
        error: auditError,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected failure while submitting picks', {
      poolId,
      userId: user.id,
      error,
    })
    return { error: saveErrorMessage }
  }
}
