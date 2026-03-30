import { panelClasses, sectionHeadingClasses } from './uiStyles'

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
    <div className="space-y-5">
      <section
        className={`${panelClasses()} border border-emerald-200/80 bg-emerald-50/95 p-4`}
        role="status"
        aria-live="polite"
      >
        <p className={`${sectionHeadingClasses()} text-emerald-800`}>Entry locked in</p>
        <h2 className="mt-2 text-lg font-semibold text-emerald-950">{poolName}</h2>
        <p className="mt-1 break-words text-sm text-emerald-900">
          {isLocked
            ? 'Your picks are final for this tournament.'
            : 'Your picks are saved and still editable until lock.'}
        </p>
      </section>

      <section className={`${panelClasses()} p-4`}>
        <p className={sectionHeadingClasses()}>Current picks</p>
        <ul className="mt-3 space-y-2" aria-label="Selected golfers">
          {golferIds.map((id, index) => (
            <li key={id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
              <span className="font-medium text-slate-900">{golferNames[id] || id}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
