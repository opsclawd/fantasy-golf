import { LockBanner } from '@/components/LockBanner'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { EntryGolferBreakdown } from '@/components/EntryGolferBreakdown'
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { getEntryByPoolAndUser } from '@/lib/entry-queries'
import { classifyFreshness } from '@/lib/freshness'
import { isPoolLocked } from '@/lib/picks'
import { getPoolById, isPoolMember } from '@/lib/pool-queries'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { getTournamentRosterGolfers, type TournamentRosterGolfer } from '@/lib/tournament-roster/queries'
import { createClient } from '@/lib/supabase/server'
import type { TournamentScore } from '@/lib/supabase/types'
import { panelClasses, sectionHeadingClasses } from '@/components/uiStyles'
import { redirect } from 'next/navigation'
import { PicksForm } from './PicksForm'
import type { GolferLike } from '@/lib/golfer-detail'

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
  if (!member) {
    if (pool.status === 'archived') {
      return (
        <div className="rounded-3xl border border-stone-200/80 bg-stone-100 p-4 text-sm sm:p-5" role="status" aria-live="polite">
          <p className="text-stone-600">This pool is archived and read-only.</p>
        </div>
      )
    }
    redirect('/participant/pools')
  }

  const existingEntry = await getEntryByPoolAndUser(supabase, poolId, user.id)
  const isLocked = isPoolLocked(pool.status, pool.deadline, pool.timezone)
  const hasEntry = existingEntry !== null && existingEntry.golfer_ids.length > 0
  const existingGolferIds = existingEntry?.golfer_ids ?? []

  let golferScoresMap = new Map<string, TournamentScore>()
  let golfersList: GolferLike[] = []
  let rosterGolfers: TournamentRosterGolfer[] = []

  const showBreakdown = hasEntry && (pool.status === 'live' || pool.status === 'complete')

  try {
    rosterGolfers = await getTournamentRosterGolfers(supabase, pool.tournament_id)
  } catch {
    rosterGolfers = []
  }

  const rosterGolferMap = new Map(rosterGolfers.map((golfer) => [golfer.id, golfer.name]))
  const existingGolferNames = Object.fromEntries(
    existingGolferIds.map((golferId) => [golferId, rosterGolferMap.get(golferId) ?? golferId]),
  )
  const rosterGolferNames = Object.fromEntries(rosterGolfers.map((golfer) => [golfer.id, golfer.name]))

  if (showBreakdown) {
    const [scores, golfers] = await Promise.all([
      getScoresForTournament(supabase, pool.tournament_id),
      Promise.resolve(rosterGolfers.filter((golfer) => existingGolferIds.includes(golfer.id))),
    ])

    golferScoresMap = new Map(scores.map(s => [s.golfer_id, s]))
    golfersList = golfers
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <section className={`${panelClasses()} p-5 sm:p-6`}>
        <p className={sectionHeadingClasses()}>Participant picks</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">{pool.name}</h1>
        <p className="mt-1 text-sm text-stone-600">{pool.tournament_name}</p>
      </section>

      <LockBanner
        isLocked={isLocked}
        deadline={pool.deadline}
        poolStatus={pool.status}
        timezone={pool.timezone}
      />

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
      ) : isLocked && pool.status === 'archived' && !hasEntry ? (
        <div className="rounded-3xl border border-stone-200/80 bg-stone-100 p-4 text-sm sm:p-5" role="status" aria-live="polite">
          <p className="text-stone-600">
            This pool is archived and read-only.
          </p>
        </div>
      ) : isLocked && !hasEntry ? (
        <div className="rounded-3xl border border-stone-200/80 bg-stone-100 p-4 text-sm sm:p-5" role="status" aria-live="polite">
          <p className="text-stone-600">
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
          rosterGolferNames={rosterGolferNames}
          rosterGolfers={rosterGolfers}
          isLocked={isLocked}
        />
      )}
    </div>
  )
}
