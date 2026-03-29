interface LockBannerProps {
  isLocked: boolean
  deadline: string | null | undefined
}

function formatDeadline(deadline: string | null | undefined) {
  if (!deadline) {
    return 'TBD'
  }

  const parsed = new Date(deadline)
  if (Number.isNaN(parsed.getTime())) {
    return 'TBD'
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function LockBanner({ isLocked, deadline }: LockBannerProps) {
  const formattedDeadline = formatDeadline(deadline)
  const icon = isLocked ? 'LOCKED' : 'OPEN'
  const title = isLocked ? 'Picks are locked' : 'Picks are open'
  const details = isLocked
    ? `Deadline was ${formattedDeadline}`
    : `Submit picks before ${formattedDeadline}`
  const classes = isLocked
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-green-200 bg-green-50 text-green-900'

  return (
    <div className={`rounded-md border px-4 py-3 ${classes}`} role="status">
      <p className="text-sm font-semibold">
        <span aria-hidden="true" className="mr-2">
          {icon}
        </span>
        {title}
      </p>
      <p className="mt-1 text-sm">{details}</p>
    </div>
  )
}
