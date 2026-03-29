import type { PoolStatus } from '@/lib/supabase/types'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB', // circle outline
    classes: 'bg-green-100 text-green-800',
  },
  live: {
    label: 'Live',
    icon: '\u25CF', // filled circle
    classes: 'bg-blue-100 text-blue-800',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713', // checkmark
    classes: 'bg-gray-100 text-gray-800',
  },
}

export function StatusChip({ status }: { status: PoolStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
      role="status"
      aria-label={`Pool status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
