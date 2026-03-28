import type { Entry, Pool, PoolMember } from '@/lib/supabase/types'

type PoolStatusSectionProps = {
  pool: Pool
  members: PoolMember[]
  entries: Entry[]
  latestScoreSyncAt: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No score sync recorded yet'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No score sync recorded yet'
  return parsed.toLocaleString()
}

function getFreshnessState(latestScoreSyncAt: string | null): {
  label: string
  description: string
  className: string
} {
  if (!latestScoreSyncAt) {
    return {
      label: 'No data',
      description: 'No score sync has been recorded for this tournament yet.',
      className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    }
  }

  const parsed = new Date(latestScoreSyncAt)
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: 'Unknown',
      description: 'The latest score timestamp is invalid.',
      className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    }
  }

  const ageMs = Date.now() - parsed.getTime()
  const ageMinutes = Math.floor(ageMs / 60000)

  if (ageMinutes > 30) {
    return {
      label: 'Stale',
      description: `Scores are stale (${ageMinutes} minutes old).`,
      className: 'bg-red-50 text-red-800 border-red-200',
    }
  }

  return {
    label: 'Fresh',
    description: `Scores synced ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago.`,
    className: 'bg-green-50 text-green-800 border-green-200',
  }
}

function getLockState(pool: Pool): {
  label: string
  description: string
  className: string
} {
  if (pool.status !== 'open') {
    return {
      label: 'Locked',
      description: `Pool is ${pool.status}; entries are locked.`,
      className: 'bg-gray-100 text-gray-800 border-gray-200',
    }
  }

  const deadline = new Date(pool.deadline)
  if (Number.isNaN(deadline.getTime())) {
    return {
      label: 'Unknown',
      description: 'Deadline is invalid. Update configuration before starting.',
      className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    }
  }

  if (deadline.getTime() <= Date.now()) {
    return {
      label: 'Locked',
      description: 'Deadline has passed; entries are locked.',
      className: 'bg-gray-100 text-gray-800 border-gray-200',
    }
  }

  return {
    label: 'Open',
    description: `Entries lock at ${deadline.toLocaleString()}.`,
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  }
}

function getSetupHealth(pool: Pool): {
  label: string
  description: string
  className: string
} {
  const hasTournament = Boolean(pool.tournament_id && pool.tournament_name)
  const hasValidDeadline = !Number.isNaN(new Date(pool.deadline).getTime())
  const hasValidFormat = pool.format === 'best_ball' && pool.picks_per_entry > 0

  if (hasTournament && hasValidDeadline && hasValidFormat) {
    return {
      label: 'Ready',
      description: 'Tournament, deadline, and format are configured.',
      className: 'bg-green-50 text-green-800 border-green-200',
    }
  }

  return {
    label: 'Incomplete',
    description: 'Pool setup is incomplete. Tournament, deadline, or format needs attention.',
    className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  }
}

export default function PoolStatusSection({ pool, members, entries, latestScoreSyncAt }: PoolStatusSectionProps) {
  const playerMembers = members.filter(member => member.role === 'player')
  const entryUserIds = new Set(entries.map(entry => entry.user_id))
  const joinedCount = playerMembers.length
  const submittedCount = playerMembers.filter(member => entryUserIds.has(member.user_id)).length
  const pendingCount = Math.max(joinedCount - submittedCount, 0)

  const lockState = getLockState(pool)
  const freshnessState = getFreshnessState(latestScoreSyncAt)
  const setupHealth = getSetupHealth(pool)

  return (
    <section className="bg-white rounded-lg shadow p-4 sm:p-6" aria-labelledby="pool-status-heading">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="pool-status-heading" className="font-semibold">
            Pool Status
          </h2>
          <p className="text-sm text-gray-600 mt-1">Tournament, format, participation, lock state, and freshness.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Tournament</p>
          <p className="font-medium">{pool.tournament_name || 'Not configured'}</p>
          <p className="text-xs text-gray-500">{pool.year}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Format</p>
          <p className="font-medium">{pool.format}</p>
          <p className="text-xs text-gray-500">{pool.picks_per_entry} picks per entry</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pool State</p>
          <p className="font-medium capitalize">{pool.status}</p>
          <p className="text-xs text-gray-500">Deadline: {new Date(pool.deadline).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Joined</p>
          <p className="text-2xl font-semibold">{joinedCount}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Submitted</p>
          <p className="text-2xl font-semibold">{submittedCount}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pending</p>
          <p className="text-2xl font-semibold">{pendingCount}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Readiness</p>
          <p className="text-2xl font-semibold">{pendingCount === 0 ? 'Ready' : 'Waiting'}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`border rounded p-3 ${lockState.className}`}>
          <p className="text-xs uppercase tracking-wide">Lock State</p>
          <p className="font-semibold">{lockState.label}</p>
          <p className="text-sm">{lockState.description}</p>
        </div>

        <div className={`border rounded p-3 ${freshnessState.className}`}>
          <p className="text-xs uppercase tracking-wide">Freshness</p>
          <p className="font-semibold">{freshnessState.label}</p>
          <p className="text-sm">{freshnessState.description}</p>
          <p className="text-xs mt-1">Latest sync: {formatDateTime(latestScoreSyncAt)}</p>
        </div>

        <div className={`border rounded p-3 ${setupHealth.className}`}>
          <p className="text-xs uppercase tracking-wide">Setup Health</p>
          <p className="font-semibold">{setupHealth.label}</p>
          <p className="text-sm">{setupHealth.description}</p>
        </div>
      </div>
    </section>
  )
}
