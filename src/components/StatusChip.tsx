import type { PoolStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB',
    classes: 'border-green-200 bg-green-50 text-green-900',
  },
  live: {
    label: 'Live',
    icon: '\u25CF',
    classes: 'border-green-200 bg-green-50 text-green-900',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713',
    classes: 'border-stone-200 bg-stone-100 text-stone-900',
  },
  archived: {
    label: 'Archived',
    icon: '\u25A3',
    classes: 'border-stone-200 bg-stone-100 text-stone-700',
  },
}

interface StatusChipProps {
  status: PoolStatus
  deadline?: string
  timezone?: string
}

export function StatusChip({ status, deadline, timezone }: StatusChipProps) {
  const config = STATUS_CONFIG[status]

  const deadlineText =
    status === 'open' && deadline && timezone
      ? formatDeadline(deadline, timezone)
      : null

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-label={`Pool status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className={sectionHeadingClasses().replace('text-green-700/70', 'text-current')}>
        {config.label}
      </span>
      {deadlineText && (
        <span className="text-[0.7rem] font-normal normal-case tracking-normal">
          {deadlineText}
        </span>
      )}
    </span>
  )
}

function formatDeadline(deadline: string, timezone: string): string {
  const lockInstant = getTournamentLockInstant(deadline, timezone)
  if (!lockInstant) return ''

  return lockInstant.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: timezone,
  })
}
