interface SubmissionConfirmationProps {
  golferIds: string[]
  golferNamesById?: Record<string, string>
}

export function SubmissionConfirmation({
  golferIds,
  golferNamesById = {},
}: SubmissionConfirmationProps) {
  return (
    <section aria-label="Submission confirmation" className="space-y-4">
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-900">
        <p className="text-sm font-semibold">Picks submitted successfully.</p>
        <p className="mt-1 text-sm">Your entry is saved and will lock at the deadline.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Selected picks</h3>
        <ul className="mt-2 space-y-2" role="list">
          {golferIds.map((id) => (
            <li key={id} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              {golferNamesById[id] || id}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
