import { ScoreDisplay } from './score-display'

export interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

interface LeaderboardRowProps {
  entry: RankedEntry
  isTied: boolean
  golferNames: Record<string, string>
  withdrawnGolferIds: Set<string>
  onSelectGolfer: (golferId: string) => void
}

export function LeaderboardRow({
  entry,
  isTied,
  golferNames,
  withdrawnGolferIds,
  onSelectGolfer,
}: LeaderboardRowProps) {
  return (
    <tr className="border-t border-slate-200/80 align-top first:border-t-0">
      <td className="px-4 py-4 sm:px-5">
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-slate-900 px-2 py-1 text-sm font-semibold text-white">
          {isTied ? `T${entry.rank}` : entry.rank}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold text-slate-900">{entry.user_id.slice(0, 9)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.golfer_ids.map((id) => {
            const isWithdrawn = withdrawnGolferIds.has(id)

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectGolfer(id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition hover:-translate-y-px ${
                  isWithdrawn
                    ? 'bg-amber-100 text-amber-900 line-through'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                }`}
                aria-label={`View details for ${golferNames[id] ?? id}`}
              >
                {golferNames[id] ?? id}
              </button>
            )
          })}
        </div>
      </td>
      <td className="px-4 py-4 text-right text-lg font-semibold text-slate-950 sm:px-5">
        <ScoreDisplay score={entry.totalScore} />
      </td>
      <td className="px-4 py-4 text-right text-sm font-medium text-slate-600 sm:px-5">
        {entry.totalBirdies}
      </td>
    </tr>
  )
}
