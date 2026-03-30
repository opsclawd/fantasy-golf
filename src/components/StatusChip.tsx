import type { PoolStatus } from '@/lib/supabase/types'

import { sectionHeadingClasses } from './uiStyles'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB', // circle outline
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  live: {
    label: 'Live',
    icon: '\u25CF', // filled circle
    classes: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713', // checkmark
    classes: 'border-slate-200 bg-slate-100 text-slate-900',
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
      <span className={sectionHeadingClasses().replace('text-emerald-800/70', 'text-current')}>
        {config.label}
      </span>
    </span>
  )
}
