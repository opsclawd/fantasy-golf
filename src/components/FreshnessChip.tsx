import type { FreshnessStatus } from '@/lib/supabase/types'

const FRESHNESS_CONFIG: Record<
  FreshnessStatus,
  { label: string; icon: string; classes: string; srText: string }
> = {
  current: {
    label: 'Current',
    icon: '\u2713', // checkmark
    classes: 'bg-green-100 text-green-800',
    srText: 'Data is current',
  },
  stale: {
    label: 'Stale',
    icon: '\u26A0', // warning
    classes: 'bg-amber-100 text-amber-800',
    srText: 'Data may be outdated',
  },
  unknown: {
    label: 'No data yet',
    icon: '\u2014', // em dash
    classes: 'bg-gray-100 text-gray-600',
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
      className={`inline-flex min-w-0 shrink items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.classes}`}
      role="status"
      aria-live="polite"
      aria-label={config.srText}
    >
      <span aria-hidden="true" className="shrink-0">
        {config.icon}
      </span>
      <span className="truncate">{config.label}</span>
      {timeLabel && (
        <span className="ml-1 min-w-0 truncate text-xs opacity-75">{timeLabel}</span>
      )}
    </span>
  )
}
