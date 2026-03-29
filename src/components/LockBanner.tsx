interface LockBannerProps {
  isLocked: boolean
  deadline: string
  poolStatus: string
}

function getLockedMessage(poolStatus: string): string {
  switch (poolStatus) {
    case 'live':
      return 'The tournament is live. No changes allowed.'
    case 'complete':
      return 'This tournament is complete.'
    default:
      return 'The picks deadline has passed.'
  }
}

function formatDeadline(deadline: string): string {
  const fallback = 'Deadline not available'
  if (!deadline.trim()) {
    return fallback
  }

  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) {
    return fallback
  }

  return deadlineDate.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function LockBanner({ isLocked, deadline, poolStatus }: LockBannerProps) {
  const lockedMessage = getLockedMessage(poolStatus)

  if (isLocked) {
    return (
      <div
        className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2"
        role="status"
      >
        <span aria-hidden="true" className="text-lg">&#x1F512;</span>
        <div>
          <p className="font-medium text-gray-800">Picks are locked</p>
          <p className="text-sm text-gray-600">{lockedMessage}</p>
        </div>
      </div>
    )
  }

  const formattedDeadline = formatDeadline(deadline)

  return (
    <div
      className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
      role="status"
    >
      <span aria-hidden="true" className="text-lg">&#x1F513;</span>
      <div>
        <p className="font-medium text-green-800">Picks are open</p>
        <p className="text-sm text-green-700">
          Deadline: {formattedDeadline}
        </p>
      </div>
    </div>
  )
}
