import type { PoolStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB', // circle outline
    classes: 'border-green-200 bg-green-50 text-green-900',
  },
  live: {
    label: 'Live',
    icon: '\u25CF', // filled circle
    classes: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713', // checkmark
    classes: 'border-stone-200 bg-stone-100 text-stone-900',
  },
  archived: {
    label: 'Archived',
    icon: '\u25A3', // filled square
    classes: 'border-stone-200 bg-stone-100 text-stone-700',
  },
}

export function StatusChip({ status }: { status: PoolStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-label={`Pool status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className={sectionHeadingClasses().replace('text-green-800/70', 'text-current')}>
        {config.label}
      </span>
    </span>
  )
}
