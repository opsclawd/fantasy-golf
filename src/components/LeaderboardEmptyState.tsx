import type { PoolStatus } from '@/lib/supabase/types'
import { DataAlert } from './DataAlert'
import { sectionHeadingClasses } from './uiStyles'

interface LeaderboardEmptyStateProps {
  poolStatus: PoolStatus
  hasEntries: boolean
  hasScores: boolean
  lastRefreshError: string | null
}

export function LeaderboardEmptyState({
  poolStatus,
  hasEntries,
  hasScores,
  lastRefreshError,
}: LeaderboardEmptyStateProps) {
  let title: string
  let description: string

  if (poolStatus === 'open') {
    title = 'Waiting for tournament to start'
    description = hasEntries
      ? 'Entries have been submitted. Standings will appear once the tournament goes live and scoring begins.'
      : 'No entries submitted yet. Share the invite link so players can join and make their picks.'
  } else if (!hasEntries) {
    title = 'No entries in this pool'
    description = 'This pool has no entries. Standings cannot be calculated without participants.'
  } else if (!hasScores) {
    title = 'Waiting for scores'
    description = 'The tournament is live but no scoring data has been received yet. Standings will appear once the first scores come in.'
  } else {
    title = 'Standings unavailable'
    description = 'We were unable to compute standings. This is likely a temporary issue.'
  }

  return (
    <div className="px-6 py-10 text-center sm:px-10" role="status">
      <div className="mx-auto max-w-xl">
        <p className={sectionHeadingClasses()}>Leaderboard status</p>
        <p className="mt-3 text-2xl font-semibold text-slate-950">{title}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {lastRefreshError && poolStatus === 'live' && (
        <DataAlert
          variant="warning"
          title="Last refresh failed"
          message={lastRefreshError}
          className="mx-auto mt-6 max-w-xl text-left"
        />
      )}
    </div>
  )
}
