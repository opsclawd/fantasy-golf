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
    <section aria-label="Submission confirmation" className="space-y-4">
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-900">
        <p className="text-sm font-semibold">Entry submitted for {poolName}</p>
        <p className="mt-1 text-sm">
          {isLocked
            ? 'This pool is currently locked. Your submitted picks are final.'
            : 'Picks are saved. You can update them until the pool locks.'}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Selected picks</h3>
        <ul className="mt-2 space-y-2" role="list">
          {golferIds.map((id) => (
            <li key={id} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              {golferNames[id] || id}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
