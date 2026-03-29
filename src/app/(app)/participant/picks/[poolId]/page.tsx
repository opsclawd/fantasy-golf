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
  const hasEntry = existingEntry !== null && existingEntry.golfer_ids.length > 0
  const existingGolferIds = existingEntry?.golfer_ids ?? []

  let existingGolferNames: Record<string, string> = {}
  if (existingGolferIds.length > 0) {
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, name')
      .in('id', existingGolferIds)

    if (golfers) {
      existingGolferNames = Object.fromEntries(golfers.map((golfer) => [golfer.id, golfer.name]))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{pool.name}</h1>
      <p className="text-gray-500 mb-4">{pool.tournament_name}</p>

      <LockBanner isLocked={isLocked} deadline={pool.deadline} poolStatus={pool.status} />

      {isLocked && hasEntry ? (
        <SubmissionConfirmation
          golferNames={existingGolferNames}
          golferIds={existingGolferIds}
          isLocked={true}
          poolName={pool.name}
        />
      ) : isLocked && !hasEntry ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg" role="status">
          <p className="text-gray-600">
            You did not submit picks before the deadline.
          </p>
        </div>
      ) : (
        <PicksForm
          poolId={poolId}
          poolName={pool.name}
          picksPerEntry={pool.picks_per_entry}
          existingGolferIds={existingGolferIds}
          existingGolferNames={existingGolferNames}
          isLocked={isLocked}
        />
      )}
    </div>
  )
}
