interface SubmissionConfirmationProps {
  golferNames: Record<string, string>
  golferIds: string[]
  isLocked: boolean
  poolName: string
}

export function SubmissionConfirmation({
  golferNames,
  golferIds,
  isLocked,
  poolName,
}: SubmissionConfirmationProps) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4"
        role="status"
        aria-live="polite"
      >
        <div className="mb-2 flex items-start gap-2">
          <span aria-hidden="true" className="shrink-0 text-lg text-green-700">
            &#x2713;
          </span>
          <p className="min-w-0 break-words text-sm font-semibold text-green-800 sm:text-base">
            Entry submitted for {poolName}
          </p>
        </div>
        <p className="break-words text-sm text-green-700">
          {isLocked
            ? 'Your picks are locked and cannot be changed.'
            : 'You can edit your picks until the deadline.'}
        </p>
      </div>

      <div>
        <h3 className="font-medium mb-2">Your picks</h3>
          <ul className="space-y-1" aria-label="Selected golfers">
            {golferIds.map((id, index) => (
              <li
                key={id}
                className="flex items-start gap-2 rounded bg-gray-50 p-2"
              >
                <span className="w-5 shrink-0 text-right text-xs text-gray-400">
                  {index + 1}.
                </span>
                <span className="min-w-0 break-words">{golferNames[id] || id}</span>
              </li>
            ))}
          </ul>
      </div>
    </div>
  )
}
