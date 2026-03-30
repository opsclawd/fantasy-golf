import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface SelectionSummaryCardProps {
  selectedCount: number
  requiredCount: number
  selectedGolferNames: string[]
  className?: string
}

export function SelectionSummaryCard({
  selectedCount,
  requiredCount,
  selectedGolferNames,
  className,
}: SelectionSummaryCardProps) {
  const remaining = Math.max(requiredCount - selectedCount, 0)
  const isComplete = selectedCount >= requiredCount && requiredCount > 0

  return (
    <section
      className={[
        panelClasses(),
        'border border-sky-200/80 bg-sky-50/90 p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Current entry summary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={sectionHeadingClasses().replace('text-emerald-800/70', 'text-sky-700/80')}>
            Current entry
          </p>
          <p className="mt-2 text-base font-semibold text-slate-950">
            {selectedCount} of {requiredCount} golfers selected
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {isComplete
              ? 'Your card is full and ready to submit.'
              : `${remaining} more ${remaining === 1 ? 'pick' : 'picks'} to finish this entry.`}
          </p>
        </div>
        <span
          className={`inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-white/80 text-sky-800'
          }`}
        >
          {isComplete ? 'Ready' : `${remaining} left`}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-3">
        {selectedGolferNames.length === 0 ? (
          <p className="text-sm text-slate-600">No golfers selected yet.</p>
        ) : (
          <ol className="space-y-2" aria-label="Selected golfers summary">
            {selectedGolferNames.map((name, index) => (
              <li key={`${name}-${index}`} className="flex items-center gap-3 text-sm text-slate-800">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
                  {index + 1}
                </span>
                <span className="font-medium">{name}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
