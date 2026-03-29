interface LockBannerProps {
  isLocked: boolean
  deadline: string
  poolStatus: string
}

export function LockBanner({ isLocked, deadline, poolStatus }: LockBannerProps) {
  if (isLocked) {
    return (
      <div
        className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2"
        role="status"
      >
        <span aria-hidden="true" className="text-lg">&#x1F512;</span>
        <div>
          <p className="font-medium text-gray-800">Picks are locked</p>
          <p className="text-sm text-gray-600">
            {poolStatus === 'live'
              ? 'The tournament is live. No changes allowed.'
              : poolStatus === 'complete'
                ? 'This tournament is complete.'
                : 'The picks deadline has passed.'}
          </p>
        </div>
      </div>
    )
  }

  const deadlineDate = new Date(deadline)
  const formattedDeadline = deadlineDate.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

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
