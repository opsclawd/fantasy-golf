import Link from 'next/link'
import { StatusChip } from './StatusChip'
import type { Pool } from '@/lib/supabase/types'
import { getTournamentLockInstant } from '@/lib/picks'

interface PoolCardProps {
  pool: Pool
  href: string
  entryCount?: number
}

export function PoolCard({ pool, href, entryCount }: PoolCardProps) {
  const deadlineInstant = pool.deadline ? getTournamentLockInstant(pool.deadline, pool.timezone) : null
  const formattedDeadline = deadlineInstant
    ? deadlineInstant.toLocaleDateString(undefined, { timeZone: pool.timezone })
    : 'TBD'

  return (
    <Link href={href}>
      <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{pool.name}</h3>
          <StatusChip status={pool.status} />
        </div>
        <p className="text-gray-500 text-sm">{pool.tournament_name}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>Deadline: {formattedDeadline}</span>
          {entryCount !== undefined && <span>{entryCount} entries</span>}
        </div>
      </div>
    </Link>
  )
}
