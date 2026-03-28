import type { Pool } from '@/lib/supabase/types'

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
  const deadlinePassed = new Date(pool.deadline) <= new Date()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{memberCount}</div>
        <div className="text-sm text-gray-500">Players Joined</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{entryCount}</div>
        <div className="text-sm text-gray-500">Entries Submitted</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{pendingCount}</div>
        <div className="text-sm text-gray-500">Awaiting Picks</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium">
          {pool.deadline ? new Date(pool.deadline).toLocaleDateString() : '-'}
        </div>
        <div className="text-sm text-gray-500">Picks Deadline</div>
        <div className="mt-1">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
              <span aria-hidden="true">🔒</span> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <span aria-hidden="true">🔓</span> Open
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
