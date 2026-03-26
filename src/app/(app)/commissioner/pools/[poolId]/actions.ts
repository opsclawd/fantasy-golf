'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function startPool(_prevState: unknown, formData: FormData) {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/sign-in')
  }

  const { data: pool } = await supabase
    .from('pools')
    .select('status')
    .eq('id', poolId)
    .single()

  if (!pool || pool.status !== 'open') {
    return { error: 'Pool cannot be started' }
  }

  const { error } = await supabase
    .from('pools')
    .update({ status: 'live' })
    .eq('id', poolId)

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

  const { data: pool } = await supabase
    .from('pools')
    .select('status')
    .eq('id', poolId)
    .single()

  if (!pool || pool.status !== 'live') {
    return { error: 'Pool cannot be closed' }
  }

  const { error } = await supabase
    .from('pools')
    .update({ status: 'complete' })
    .eq('id', poolId)

  if (error) {
    console.error('Failed to close pool:', error)
    return { error: 'Failed to close pool' }
  }

  redirect(`/commissioner/pools/${poolId}`)
}
