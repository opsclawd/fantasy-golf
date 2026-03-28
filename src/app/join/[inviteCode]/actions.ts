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

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()

  if (!pool) {
    return { error: 'This invite link is invalid or expired.' }
  }

  const { data: existingMembership } = await supabase
    .from('pool_members')
    .select('id, role')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .single()

  if (!existingMembership) {
    const { error } = await insertPoolMember(supabase, {
      pool_id: pool.id,
      user_id: user.id,
      role: 'player',
    })

    if (error) {
      const normalizedError = error.toLowerCase()
      if (normalizedError.includes('duplicate') || normalizedError.includes('unique')) {
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
      return { error: 'Failed to join pool.' }
    }
  }

  redirect(`/participant/picks/${pool.id}`)
}
