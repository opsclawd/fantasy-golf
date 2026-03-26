import { redirect } from 'next/navigation'

function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null })
    }
  }
}

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/participant/pools')
  }
  redirect('/sign-in')
}
