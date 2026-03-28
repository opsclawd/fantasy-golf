import Link from 'next/link'
import { StatusChip } from './StatusChip'
import type { Pool } from '@/lib/supabase/types'

interface PoolCardProps {
  pool: Pool
  href: string
  entryCount?: number
}

export function PoolCard({ pool, href, entryCount }: PoolCardProps) {
  return (
    <Link href={href}>
      <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{pool.name}</h3>
          <StatusChip status={pool.status} />
        </div>
        <p className="text-gray-500 text-sm">{pool.tournament_name}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>Deadline: {new Date(pool.deadline).toLocaleDateString()}</span>
          {entryCount !== undefined && <span>{entryCount} entries</span>}
        </div>
      </div>
    </Link>
  )
}
