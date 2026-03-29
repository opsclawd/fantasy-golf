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
  const hasEntry = Boolean(existingEntry)
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
      <div>
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        <p className="text-gray-500">{pool.tournament_name}</p>
      </div>

      <LockBanner isLocked={isLocked} deadline={pool.deadline} poolStatus={pool.status} />

      {isLocked && hasEntry ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <SubmissionConfirmation
            golferNames={existingGolferNames}
            golferIds={existingGolferIds}
            isLocked={isLocked}
            poolName={pool.name}
          />
        </div>
      ) : isLocked && !hasEntry ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">
            Picks are locked for this pool. You did not submit an entry before the deadline.
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <PicksForm
            poolId={poolId}
            poolName={pool.name}
            picksPerEntry={pool.picks_per_entry}
            existingGolferIds={existingGolferIds}
            existingGolferNames={existingGolferNames}
            isLocked={isLocked}
          />
        </div>
      )}
    </div>
  )
}
