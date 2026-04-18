import Link from 'next/link'
import { StatusChip } from './StatusChip'
import { Card } from './ui/Card'
import type { Pool } from '@/lib/supabase/types'
import { getTournamentLockInstant } from '@/lib/picks'

interface PoolCardProps {
  pool: Pool
  href: string
  entryCount?: number
  submissionStatus?: string
}

export function PoolCard({ pool, href, entryCount, submissionStatus }: PoolCardProps) {
  const deadlineInstant = pool.deadline ? getTournamentLockInstant(pool.deadline, pool.timezone) : null
  const formattedDeadline = deadlineInstant
    ? deadlineInstant.toLocaleDateString(undefined, { timeZone: pool.timezone })
    : 'TBD'

  return (
    <Link href={href}>
      <Card
        accent="left"
        className="p-5 hover:bg-green-50/90 hover:border-l-green-600 hover:shadow-[0_18px_60px_-24px_rgba(21,128,61,0.18)] transition-colors cursor-pointer"
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-stone-900">{pool.name}</h3>
          <StatusChip status={pool.status} />
        </div>
        <p className="text-sm text-stone-600">{pool.tournament_name}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-stone-600">
          <span>Deadline: {formattedDeadline}</span>
          {entryCount !== undefined && <span>{entryCount} entries</span>}
        </div>
        {submissionStatus !== undefined && (
          <p className="mt-2 text-sm text-stone-600">{submissionStatus}</p>
        )}
      </Card>
    </Link>
  )
}
