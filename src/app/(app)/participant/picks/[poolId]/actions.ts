'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitPicks(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const golferIds = JSON.parse(formData.get('golferIds') as string)

  const { error } = await supabase.from('entries').upsert({
    pool_id: poolId,
    user_id: user.id,
    golfer_ids: golferIds,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'pool_id,user_id'
  })

  if (error) {
    console.error(error)
    throw new Error('Failed to submit picks')
  }

  redirect(`/participant/picks/${poolId}`)
}
