'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { insertAuditEvent, insertPoolMember } from '@/lib/pool-queries'

export type JoinPoolState = {
  error?: string
} | null

export async function joinPool(
  _prevState: JoinPoolState,
  formData: FormData
): Promise<JoinPoolState> {
  const inviteCode = ((formData.get('inviteCode') as string) ?? '').trim().toLowerCase()

  if (!inviteCode) {
    return { error: 'Invite code is required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/sign-in?redirect=/join/${inviteCode}`)
  }

  const { data: pool, error: poolLookupError } = await supabase
    .from('pools')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()

  if (poolLookupError && poolLookupError.code !== 'PGRST116') {
    return { error: 'Unable to process invite right now.' }
  }

  if (!pool) {
    return { error: 'This invite link is invalid or expired.' }
  }

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from('pool_members')
    .select('id, role')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .single()

  if (membershipLookupError && membershipLookupError.code !== 'PGRST116') {
    return { error: 'Unable to verify membership right now.' }
  }

  if (!existingMembership) {
    const { error, code } = await insertPoolMember(supabase, {
      pool_id: pool.id,
      user_id: user.id,
      role: 'player',
    })

    if (error) {
      const normalizedError = error.toLowerCase()
      const hasDuplicateCode = code === '23505'
      const hasDuplicateMessage = normalizedError.includes('duplicate') || normalizedError.includes('unique')

      if (hasDuplicateCode || hasDuplicateMessage) {
        redirect(`/participant/picks/${pool.id}`)
      }

      return { error: 'Failed to join pool.' }
    }

    const { error: auditError } = await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: user.id,
      action: 'playerJoined',
      details: {},
    })

    if (auditError) {
      console.error('Failed to insert join-pool audit event', {
        poolId: pool.id,
        userId: user.id,
        error: auditError,
      })
    }
  }

  redirect(`/participant/picks/${pool.id}`)
}
