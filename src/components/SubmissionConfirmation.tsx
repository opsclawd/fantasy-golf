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
        className="p-4 bg-green-50 border border-green-200 rounded-lg"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 mb-2">
          <span aria-hidden="true" className="text-green-700 text-lg">
            &#x2713;
          </span>
          <p className="font-semibold text-green-800">
            Entry submitted for {poolName}
          </p>
        </div>
        <p className="text-sm text-green-700">
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
              className="p-2 bg-gray-50 rounded flex items-center gap-2"
            >
              <span className="text-xs text-gray-400 w-5 text-right">
                {index + 1}.
              </span>
              <span>{golferNames[id] || id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
