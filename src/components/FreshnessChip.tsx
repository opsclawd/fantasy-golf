import type { FreshnessStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'

const FRESHNESS_CONFIG: Record<
  FreshnessStatus,
  { label: string; icon: string; classes: string; srText: string }
> = {
  current: {
    label: 'Current',
    icon: '\u2713', // checkmark
    classes: 'border-green-200 bg-green-50 text-green-900',
    srText: 'Data is current',
  },
  stale: {
    label: 'Stale',
    icon: '\u26A0', // warning
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
    srText: 'Data may be outdated',
  },
  unknown: {
    label: 'No data yet',
    icon: '\u2014', // em dash
    classes: 'border-stone-200 bg-stone-100 text-stone-700',
    srText: 'No scoring data available',
  },
}

interface FreshnessChipProps {
  status: FreshnessStatus
  refreshedAt?: string | null
}

export function FreshnessChip({ status, refreshedAt }: FreshnessChipProps) {
  const config = FRESHNESS_CONFIG[status]

  const timeLabel =
    refreshedAt && status !== 'unknown'
      ? `Updated ${new Date(refreshedAt).toLocaleTimeString()}`
      : null

  return (
    <span
      className={`inline-flex min-w-0 shrink items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-live="polite"
      aria-label={config.srText}
    >
      <span aria-hidden="true" className="shrink-0">
        {config.icon}
      </span>
      <span className={`${sectionHeadingClasses().replace('text-green-800/70', 'text-current')} truncate`}>
        {config.label}
      </span>
      {timeLabel && (
        <span className="ml-1 min-w-0 truncate text-xs opacity-75">{timeLabel}</span>
      )}
    </span>
  )
}
