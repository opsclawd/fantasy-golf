import type { Pool } from '@/lib/supabase/types'
import { metricCardClasses, sectionHeadingClasses } from '@/components/uiStyles'

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
        <p className="mt-3 text-lg font-semibold text-slate-950">{isLocked ? 'Locked' : 'Open until deadline'}</p>
        <p className="mt-2 text-sm text-slate-500">
          {pool.deadline ? new Date(pool.deadline).toLocaleString() : 'Deadline unavailable'}
        </p>
      </article>
    </section>
  )
}
