import type { Pool } from '@/lib/supabase/types'
import { metricCardClasses, sectionHeadingClasses } from '@/components/uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

interface PoolStatusSectionProps {
  pool: Pool
  memberCount: number
  entryCount: number
  isLocked: boolean
  pendingCount: number
}

export function PoolStatusSection({
  pool,
  memberCount,
  entryCount,
  isLocked,
  pendingCount,
}: PoolStatusSectionProps) {
  const lockInstant = getTournamentLockInstant(pool.deadline, pool.timezone)
  const formattedDeadline = lockInstant
    ? lockInstant.toLocaleString(undefined, {
        timeZone: pool.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Deadline unavailable'

  return (
    <section className="grid gap-4 md:grid-cols-4" aria-label="Pool overview">
      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Players joined</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{memberCount}</p>
      </article>

      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Entries submitted</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{entryCount}</p>
      </article>

      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Awaiting picks</p>
        <p className="mt-3 text-4xl font-semibold text-slate-950">{pendingCount}</p>
      </article>

      <article className={metricCardClasses()}>
        <p className={sectionHeadingClasses()}>Lock state</p>
        <p className="mt-3 text-lg font-semibold text-slate-950">
          {pool.status === 'archived' ? 'Archived' : isLocked ? 'Locked' : 'Open'}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {formattedDeadline}
        </p>
      </article>
    </section>
  )
}
