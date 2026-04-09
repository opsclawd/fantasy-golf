import { panelClasses, sectionHeadingClasses } from './uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

interface LockBannerProps {
  isLocked: boolean
  deadline: string
  timezone: string
  poolStatus: string
}

function getLockedMessage(poolStatus: string): string {
  switch (poolStatus) {
    case 'live':
      return 'The tournament is live. No changes allowed.'
    case 'complete':
      return 'This tournament is complete.'
    default:
      return 'The picks deadline has passed.'
  }
}

function formatDeadline(deadline: string, timezone: string): string {
  const fallback = 'Deadline not available'
  const deadlineInstant = getTournamentLockInstant(deadline, timezone)
  if (!deadlineInstant) {
    return fallback
  }

  return deadlineInstant.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function LockBanner({ isLocked, deadline, timezone, poolStatus }: LockBannerProps) {
  const lockedMessage = getLockedMessage(poolStatus)

  if (isLocked) {
    return (
      <div
        className={`${panelClasses()} mb-4 flex items-center gap-3 border border-slate-200 bg-slate-100/90 p-4`}
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white/75 text-lg"
        >
          &#x1F512;
        </span>
        <div>
          <p className={sectionHeadingClasses()}>Tournament lock</p>
          <p className="text-base font-semibold text-slate-950">Picks are locked</p>
          <p className="text-sm text-slate-700">{lockedMessage}</p>
        </div>
      </div>
    )
  }

  const formattedDeadline = formatDeadline(deadline, timezone)

  return (
    <div
      className={`${panelClasses()} mb-4 flex items-center gap-3 border border-emerald-200 bg-emerald-50/90 p-4`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white/75 text-lg"
      >
        &#x1F513;
      </span>
      <div>
        <p className={`${sectionHeadingClasses()} text-emerald-800`}>Tournament lock</p>
        <p className="text-base font-semibold text-emerald-950">Picks are open</p>
        <p className="text-sm text-emerald-900">
          Deadline: {formattedDeadline}
        </p>
      </div>
    </div>
  )
}
