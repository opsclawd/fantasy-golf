import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/StatusChip'
import { getPoolsForMember } from '@/lib/entry-queries'
import { calculateRemainingPicks, isPoolLocked } from '@/lib/picks'
import type { PoolStatus } from '@/lib/supabase/types'
import Link from 'next/link'

export default async function ParticipantPools() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const memberships = user ? await getPoolsForMember(supabase, user.id) : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Pools</h1>
      {memberships.length === 0 ? (
        <p className="text-gray-500">You haven&apos;t joined any pools yet. Ask your commissioner for a link.</p>
      ) : (
        <div className="grid gap-4">
          {memberships.map(({ pool_id, pool, entry }) => {
            const isLocked = isPoolLocked(pool.status as PoolStatus, pool.deadline)
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
            <Link key={pool_id} href={`/participant/picks/${pool_id}`}>
              <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
                <h3 className="font-semibold">{pool.name}</h3>
                <p className="text-gray-500">{pool.tournament_name}</p>
                <div className="mt-2">
                  <StatusChip status={pool.status as PoolStatus} />
                </div>
                <p className="mt-2 text-sm text-gray-600">{submissionStatus}</p>
              </div>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
