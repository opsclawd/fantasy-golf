import type { PoolStatus } from '@/lib/supabase/types'
import { DataAlert } from './DataAlert'
import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface LeaderboardEmptyStateProps {
  poolStatus: PoolStatus
  hasEntries: boolean
  lastRefreshError: string | null
}

export function LeaderboardEmptyState({
  poolStatus,
  hasEntries,
  lastRefreshError,
}: LeaderboardEmptyStateProps) {
  let title: string
  let description: string
  let eyebrow = 'Leaderboard status'
  let accentClasses = 'border-emerald-200 bg-emerald-50 text-emerald-800'

  if (poolStatus === 'open') {
    title = 'Waiting for tournament to start'
    description = hasEntries
      ? 'Entries have been submitted. Standings will appear once the tournament goes live and scoring begins.'
      : 'No entries submitted yet. Share the invite link so players can join and make their picks.'
    eyebrow = 'Pre-tournament'
  } else if (poolStatus === 'archived') {
    title = 'Archived pool'
    description = hasEntries
      ? 'This pool is archived and read-only. The leaderboard is frozen.'
      : 'This pool is archived and read-only. There are no entries to show yet.'
    eyebrow = 'Archived'
    accentClasses = 'border-slate-200 bg-slate-100 text-slate-700'
  } else if (!hasEntries) {
    title = 'No entries in this pool'
    description = 'This pool has no entries. Standings cannot be calculated without participants.'
    eyebrow = 'Pool setup needed'
    accentClasses = 'border-slate-200 bg-slate-100 text-slate-700'
  } else {
    title = 'Waiting for scores'
    description =
      'The tournament is live but no scoring data has been received yet. Standings will appear once the first scores come in.'
    eyebrow = 'Live scoring pending'
    accentClasses = 'border-amber-200 bg-amber-50 text-amber-800'
  }

  return (
    <div className="px-6 py-10 sm:px-10" role="status">
      <div className={[panelClasses(), 'mx-auto max-w-2xl px-6 py-8 sm:px-8'].join(' ')}>
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(255,255,255,0.92))] text-xl text-slate-700 shadow-sm">
            i
          </div>
          <div className="mt-5 flex justify-center">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accentClasses}`}>
              {eyebrow}
            </span>
          </div>
          <p className={`${sectionHeadingClasses()} mt-5`}>Leaderboard status</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We keep these states explicit so players can tell the difference between a quiet leaderboard and a data problem.
          </p>
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
    </div>
  )
}
