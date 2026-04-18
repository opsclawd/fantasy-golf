interface PickProgressProps {
  current: number
  required: number
}

export function PickProgress({ current, required }: PickProgressProps) {
  const remaining = Math.max(0, required - current)
  const isComplete = remaining === 0
  const percentage = required > 0 ? Math.min(100, (current / required) * 100) : 0
  const ariaValueMax = Math.max(required, 0)
  const ariaValueNow = Math.min(Math.max(current, 0), ariaValueMax)
  const progressLabel = isComplete
    ? `All ${required} of ${required} golfers selected`
    : `${ariaValueNow} of ${required} golfers selected`

  return (
    <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-stone-50/80 p-3" role="status" aria-live="polite" aria-atomic="true">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-stone-900">
          {isComplete ? (
            <span className="text-green-700">
              <span aria-hidden="true">&#x2713; </span>
              All {required} golfers selected - ready-to-submit
            </span>
          ) : (
            <span>
              {current} of {required} golfers selected
            </span>
          )}
        </span>
        {!isComplete && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
            {remaining} remaining
          </span>
        )}
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={ariaValueNow}
        aria-valuemin={0}
        aria-valuemax={ariaValueMax}
        aria-valuetext={progressLabel}
        aria-label={`${current} of ${required} golfers selected`}
      >
        <div
          className={`h-full rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 ${
            isComplete ? 'bg-green-600' : 'bg-green-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
