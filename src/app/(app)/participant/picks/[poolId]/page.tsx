import { LockBanner } from '@/components/LockBanner'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { EntryGolferBreakdown } from '@/components/EntryGolferBreakdown'
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { getEntryByPoolAndUser } from '@/lib/entry-queries'
import { classifyFreshness } from '@/lib/freshness'
import { isPoolLocked } from '@/lib/picks'
import { getPoolById, isPoolMember } from '@/lib/pool-queries'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { getGolfersByIds } from '@/lib/golfer-queries'
import { createClient } from '@/lib/supabase/server'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'
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

  let golferScoresMap = new Map<string, TournamentScore>()
  let golfersList: Golfer[] = []

  const showBreakdown = hasEntry && (pool.status === 'live' || pool.status === 'complete')

  if (showBreakdown) {
    const [scores, golfers] = await Promise.all([
      getScoresForTournament(supabase, pool.tournament_id),
      getGolfersByIds(supabase, existingGolferIds),
    ])

    golferScoresMap = new Map(scores.map(s => [s.golfer_id, s]))
    golfersList = golfers
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{pool.name}</h1>
      <p className="text-gray-500 mb-4">{pool.tournament_name}</p>

      <LockBanner isLocked={isLocked} deadline={pool.deadline} poolStatus={pool.status} />

      {(pool.status === 'live' || pool.status === 'complete') && (
        <TrustStatusBar
          className="mb-4"
          isLocked={isLocked}
          poolStatus={pool.status}
          freshness={classifyFreshness(pool.refreshed_at)}
          refreshedAt={pool.refreshed_at}
          lastRefreshError={pool.last_refresh_error}
        />
      )}

      {isLocked && hasEntry ? (
        <>
        <SubmissionConfirmation
          golferNames={existingGolferNames}
          golferIds={existingGolferIds}
          isLocked={true}
          poolName={pool.name}
        />
        {showBreakdown && (
          <div className="mt-6">
            <EntryGolferBreakdown
              golferIds={existingGolferIds}
              golfers={golfersList}
              golferScoresRecord={Object.fromEntries(golferScoresMap)}
            />
          </div>
        )}
        </>
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
