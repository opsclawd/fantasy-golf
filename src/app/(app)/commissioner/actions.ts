'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  validateCreatePoolInput,
  validatePoolFormat,
  generateInviteCode,
} from '@/lib/pool'
import { insertPool, insertPoolMember, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat } from '@/lib/supabase/types'

export type CreatePoolState = {
  error?: string
  success?: boolean
} | null

export async function createPool(
  _prevState: CreatePoolState,
  formData: FormData
): Promise<CreatePoolState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const name = (formData.get('poolName') as string) ?? ''
  const tournamentId = (formData.get('tournamentId') as string) ?? ''
  const tournamentName = (formData.get('tournamentName') as string) ?? ''
  const yearStr = (formData.get('year') as string) ?? ''
  const deadline = (formData.get('deadline') as string) ?? ''
  const format = ((formData.get('format') as string) ?? 'best_ball') as PoolFormat
  const picksPerEntryStr = (formData.get('picksPerEntry') as string) ?? '4'
  const year = parseInt(yearStr, 10)
  const picksPerEntry = parseInt(picksPerEntryStr, 10)

  const inputValidation = validateCreatePoolInput({
    name,
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

  const inviteCode = generateInviteCode()

  const { data: pool, error } = await insertPool(supabase, {
    commissioner_id: user.id,
    name: name.trim(),
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    format,
    picks_per_entry: picksPerEntry,
    invite_code: inviteCode,
    status: 'open',
  })

  if (error || !pool) {
    return { error: error ?? 'Failed to create pool.' }
  }

  // Add the commissioner as a pool member with commissioner role
  await insertPoolMember(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    role: 'commissioner',
  })

  // Audit log
  await insertAuditEvent(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    action: 'poolCreated',
    details: { name: pool.name, tournament_id: pool.tournament_id, format: pool.format },
  })

  redirect(`/commissioner/pools/${pool.id}`)
}
