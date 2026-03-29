'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getSafeRedirectPath(redirectTo?: string): string {
  if (redirectTo?.startsWith('/') && !redirectTo.startsWith('//')) {
    return redirectTo
  }

  return '/participant/pools'
}

export async function signIn(email: string, password: string, redirectTo?: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect(getSafeRedirectPath(redirectTo))
}
