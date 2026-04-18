import { createClient } from '@/lib/supabase/server'
import { PoolCard } from '@/components/PoolCard'
import { getPoolsForMember } from '@/lib/entry-queries'
import { calculateRemainingPicks, isPoolLocked } from '@/lib/picks'
import type { Pool, PoolStatus } from '@/lib/supabase/types'

export default async function ParticipantPools() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const memberships = user ? await getPoolsForMember(supabase, user.id) : []

  return (
    <div>
      <h1 className="text-stone-900 font-semibold text-xl mb-6">My Pools</h1>
      {memberships.length === 0 ? (
        <div className="rounded-3xl border border-stone-200/80 bg-amber-100/60 p-6 text-center">
          <p className="text-stone-600 text-sm">You haven&apos;t joined any pools yet.</p>
          <p className="text-stone-600 text-sm mt-1">Ask your commissioner for a link.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {memberships.map(({ pool_id, pool, entry }) => {
            const isLocked = isPoolLocked(pool.status as PoolStatus, pool.deadline, pool.timezone)
            const selectedCount = entry?.golfer_ids?.length ?? 0
            const remainingPicks = calculateRemainingPicks(selectedCount, pool.picks_per_entry)

            let submissionStatus = 'Picks needed'
            if (isLocked) {
              submissionStatus = 'Locked'
            } else if (remainingPicks === 0) {
              submissionStatus = 'Entry submitted'
            } else if (selectedCount > 0) {
              submissionStatus = `${remainingPicks} remaining picks`
            }

            return (
              <PoolCard
                key={pool_id}
                pool={pool as Pool}
                href={`/participant/picks/${pool_id}`}
                submissionStatus={submissionStatus}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}