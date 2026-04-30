import { panelClasses, sectionHeadingClasses } from './uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

interface LockBannerProps {
  isLocked: boolean
  deadline: string
  poolStatus: string
  timezone: string
}

function getLockedMessage(poolStatus: string): string {
  switch (poolStatus) {
    case 'live':
      return 'The tournament is live. No changes allowed.'
    case 'complete':
      return 'This tournament is complete.'
    case 'archived':
      return 'This pool is archived. Picks are read-only.'
    default:
      return 'The picks deadline has passed.'
  }
}

function formatDeadline(deadline: string, timeZone: string): string {
  const fallback = 'Deadline not available'
  const deadlineInstant = getTournamentLockInstant(deadline, timeZone)
  if (!deadlineInstant) {
    return fallback
  }

  return deadlineInstant.toLocaleString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function isWithin24Hours(deadline: string, timeZone: string, now: Date = new Date()): boolean {
  const lockAt = getTournamentLockInstant(deadline, timeZone)
  if (!lockAt) return false
  const hoursRemaining = (lockAt.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hoursRemaining > 0 && hoursRemaining <= 24
}

export function LockBanner({ isLocked, deadline, poolStatus, timezone }: LockBannerProps) {
  const lockedMessage = getLockedMessage(poolStatus)

  if (isLocked) {
    return (
      <div
        className={`${panelClasses()} mb-4 flex items-center gap-3 border border-stone-200 bg-stone-100/90 p-4`}
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white/75 text-lg"
        >
          &#x1F512;
        </span>
        <div>
          <p className={sectionHeadingClasses()}>Tournament lock</p>
          <p className="text-base font-semibold text-stone-950">Picks are locked</p>
          <p className="text-sm text-stone-700">{lockedMessage}</p>
        </div>
      </div>
    )
  }

  const formattedDeadline = formatDeadline(deadline, timezone)
  const within24Hours = poolStatus === 'open' && isWithin24Hours(deadline, timezone)

  return (
    <div
      className={`${panelClasses()} mb-4 flex items-center gap-3 border ${
        within24Hours ? 'border-amber-200 bg-amber-100/90' : 'border-green-200 bg-green-100/90'
      } p-4`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
          within24Hours ? 'border-amber-200' : 'border-green-200'
        } bg-white/75 text-lg`}
      >
        {within24Hours ? '⚠️' : '&#x1F513;'}
      </span>
      <div>
        <p className={`${sectionHeadingClasses()} ${within24Hours ? 'text-amber-900' : 'text-green-900'}`}>
          Tournament lock
        </p>
        <p className={`text-base font-semibold ${within24Hours ? 'text-amber-950' : 'text-green-950'}`}>
          {within24Hours ? 'Picks close soon' : 'Picks are open'}
        </p>
        <p className={`text-sm ${within24Hours ? 'text-amber-800' : 'text-green-800'}`}>
          Deadline: {formattedDeadline}
          {within24Hours && ` (${timezone})`}
        </p>
      </div>
    </div>
  )
}
