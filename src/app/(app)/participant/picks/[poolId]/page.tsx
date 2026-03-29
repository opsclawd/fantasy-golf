import { LockBanner } from '@/components/LockBanner'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { getEntryByPoolAndUser } from '@/lib/entry-queries'
import { isPoolLocked } from '@/lib/picks'
import { getPoolById, isPoolMember } from '@/lib/pool-queries'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PicksForm } from './PicksForm'

export default async function PicksPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/participant/pools')

  const member = await isPoolMember(supabase, poolId, user.id)
  if (!member) redirect('/participant/pools')

  const existingEntry = await getEntryByPoolAndUser(supabase, poolId, user.id)
  const isLocked = isPoolLocked(pool.status, pool.deadline)
  const selectedIds = existingEntry?.golfer_ids ?? []

  let golferNames: Record<string, string> = {}
  if (selectedIds.length > 0) {
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, name')
      .in('id', selectedIds)

    if (golfers) {
      golferNames = Object.fromEntries(golfers.map((golfer) => [golfer.id, golfer.name]))
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-2">{pool.name}</h1>
      <p className="text-gray-500 mb-6">{pool.tournament_name}</p>

      <LockBanner isLocked={isLocked} deadline={pool.deadline} poolStatus={pool.status} />

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Your Entry</h2>

        {isLocked && existingEntry ? (
          <SubmissionConfirmation
            golferNames={golferNames}
            golferIds={selectedIds}
            isLocked={isLocked}
            poolName={pool.name}
          />
        ) : isLocked ? (
          <p className="text-sm text-gray-600">
            Picks are locked for this pool. You did not submit an entry before the deadline.
          </p>
        ) : (
          <PicksForm
            poolId={poolId}
            poolName={pool.name}
            picksPerEntry={pool.picks_per_entry}
            initialSelectedIds={selectedIds}
            initialGolferNames={golferNames}
            initiallySubmitted={Boolean(existingEntry)}
          />
        )}
      </div>
    </div>
  )
}
