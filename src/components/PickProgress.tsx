interface PickProgressProps {
  current: number
  required: number
}

export function PickProgress({ current, required }: PickProgressProps) {
  const remaining = Math.max(0, required - current)
  const isComplete = remaining === 0
  const percentage = required > 0 ? Math.min(100, (current / required) * 100) : 0

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isComplete ? (
            <span className="text-green-700">
              <span aria-hidden="true">&#x2713; </span>
              All {required} golfers selected - ready to submit
            </span>
          ) : (
            <span>
              {current} of {required} golfers selected
            </span>
          )}
        </span>
        {!isComplete && (
          <span className="text-amber-700 font-medium">
            {remaining} remaining
          </span>
        )}
      </div>
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-label={`${current} of ${required} golfers selected`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
