interface PickProgressProps {
  remainingPicks: number
  picksPerEntry: number
}

export function PickProgress({ remainingPicks, picksPerEntry }: PickProgressProps) {
  const safeTotal = Number.isFinite(picksPerEntry) && picksPerEntry > 0 ? Math.floor(picksPerEntry) : 1
  const safeRemaining = Math.max(0, Math.min(safeTotal, Math.floor(remainingPicks)))
  const selectedCount = safeTotal - safeRemaining
  const progressPercent = Math.round((selectedCount / safeTotal) * 100)

  const message =
    safeRemaining === 0
      ? 'All picks selected. Ready to submit.'
      : `${safeRemaining} pick${safeRemaining === 1 ? '' : 's'} remaining`

  return (
    <section aria-label="Pick progress" className="space-y-2">
      <p className="text-sm text-gray-700">{message}</p>
      <div
        aria-label="Selected picks progress"
        aria-valuemax={safeTotal}
        aria-valuemin={0}
        aria-valuenow={selectedCount}
        aria-valuetext={`${selectedCount} of ${safeTotal} picks selected`}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  )
}
