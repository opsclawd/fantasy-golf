import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JoinPoolForm from './JoinPoolForm'

type JoinPageProps = {
  params: Promise<{ inviteCode: string }>
}

export default async function JoinByInvitePage({ params }: JoinPageProps) {
  const { inviteCode } = await params
  const normalizedInviteCode = inviteCode.trim().toLowerCase()
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, tournament_name, invite_code, status')
    .eq('invite_code', normalizedInviteCode)
    .single()

  if (!pool) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-3">
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-gray-600">
            This invite link is invalid or expired. Ask your commissioner for a fresh link.
          </p>
          <Link href="/participant/pools" className="inline-block text-blue-600 hover:text-blue-800 text-sm">
            Go to My Pools
          </Link>
        </div>
      </main>
    )
  }

  if (pool.status === 'archived') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">Archived pool</h1>
          <p className="text-sm text-gray-600">
            This pool is archived and read-only. You can still view the leaderboard.
          </p>
          <Link href={`/spectator/pools/${pool.id}`} className="inline-block text-blue-600 hover:text-blue-800 text-sm">
            View leaderboard
          </Link>
        </div>
      </main>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/sign-in?redirect=/join/${inviteCode}`)
  }

  const { data: membership } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .single()

  if (membership) {
    redirect(`/participant/picks/${pool.id}`)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Join pool</h1>
          <p className="text-sm text-gray-600 mt-1">You were invited to join this pool.</p>
        </div>

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-500">Pool</p>
          <p className="font-medium">{pool.name}</p>
          <p className="text-sm text-gray-600">{pool.tournament_name}</p>
        </div>

        <JoinPoolForm inviteCode={pool.invite_code} />
      </div>
    </main>
  )
}
