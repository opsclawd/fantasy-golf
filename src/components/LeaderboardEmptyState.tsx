import type { PoolStatus } from '@/lib/supabase/types'

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
    <div className="p-8 text-center" role="status">
      <p className="text-lg font-medium text-gray-700">{title}</p>
      <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">{description}</p>
      {lastRefreshError && poolStatus === 'live' && (
        <div
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
          role="alert"
        >
          <span aria-hidden="true">{'\u26A0'}</span>
          <span>Last refresh failed: {lastRefreshError}</span>
        </div>
      )}
    </div>
  )
}
