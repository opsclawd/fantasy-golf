'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function startPool(poolId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('pools')
    .update({ status: 'live' })
    .eq('id', poolId)

  if (error) {
    throw new Error('Failed to start pool')
  }

  redirect(`/commissioner/pools/${poolId}`)
}

export async function closePool(poolId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('pools')
    .update({ status: 'complete' })
    .eq('id', poolId)

  if (error) {
    throw new Error('Failed to close pool')
  }

  redirect(`/commissioner/pools/${poolId}`)
}
