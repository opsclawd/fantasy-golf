interface PickProgressProps {
  current: number
  required: number
}

export function PickProgress({ current, required }: PickProgressProps) {
  const safeRequired = Number.isFinite(required) && required > 0 ? Math.floor(required) : 1
  const safeCurrent = Math.max(0, Math.min(safeRequired, Math.floor(current)))
  const remaining = Math.max(0, safeRequired - safeCurrent)
  const isComplete = remaining === 0
  const progressPercent = Math.round((safeCurrent / safeRequired) * 100)

  const detailText = `${safeCurrent} of ${safeRequired}`
  const message = isComplete
    ? 'All required picks selected. Ready to submit.'
    : `${remaining} pick${remaining === 1 ? '' : 's'} remaining`

  return (
    <section aria-label="Pick progress" className="space-y-2" role="status" aria-live="polite">
      <p className="text-sm font-medium text-gray-800">{detailText}</p>
      <p className="text-sm text-gray-700">{message}</p>
      <div
        aria-label="Selected picks progress"
        aria-valuemax={safeRequired}
        aria-valuemin={0}
        aria-valuenow={safeCurrent}
        aria-valuetext={`${safeCurrent} of ${safeRequired}`}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-600' : 'bg-blue-600'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  )
}
