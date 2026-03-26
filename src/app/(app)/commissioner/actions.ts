'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createPool(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  const poolName = formData.get('poolName') as string
  const tournamentId = formData.get('tournamentId') as string
  const tournamentName = formData.get('tournamentName') as string
  const deadline = formData.get('deadline') as string

  const { error } = await supabase.from('pools').insert({
    name: poolName,
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    deadline,
    status: 'open',
  })

  if (error) {
    console.error(error)
    throw new Error('Failed to create pool')
  }

  redirect('/commissioner')
}
