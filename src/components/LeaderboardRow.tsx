import { ScoreDisplay } from './score-display'
import { TieExplanationBadge } from './TieExplanationBadge'

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
  rowIndex: number
}

export function LeaderboardRow({
  entry,
  isTied,
  golferNames,
  withdrawnGolferIds,
  onSelectGolfer,
  rowIndex,
}: LeaderboardRowProps) {
  return (
    <tr className={`border-t border-stone-200/80 align-top first:border-t-0 ${rowIndex % 2 === 1 ? 'bg-stone-50/60' : 'bg-white'}`}>
      <td className="px-2 py-4 sm:px-5">
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-stone-900 px-1.5 py-0.5 text-xs font-semibold text-white sm:px-2 sm:py-1 sm:text-sm">
          {isTied ? `T${entry.rank}` : entry.rank}
        </span>
      </td>
      <td className="px-2 py-4 sm:px-5">
        <p className="text-sm font-semibold text-stone-900">{entry.user_id.slice(0, 9)}</p>
        {isTied && (
          <TieExplanationBadge isTied={true} entryName={entry.user_id.slice(0, 9)} totalBirdies={entry.totalBirdies} />
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.golfer_ids.map((id) => {
            const isWithdrawn = withdrawnGolferIds.has(id)

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectGolfer(id)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition hover:-translate-y-px sm:px-2.5 sm:py-1 ${
                  isWithdrawn
                    ? 'bg-amber-50 text-amber-800 line-through'
                    : 'bg-green-50 text-green-900 hover:bg-green-100'
                }`}
                aria-label={`View details for ${golferNames[id] ?? id}`}
              >
                {golferNames[id] ?? id}
              </button>
            )
          })}
        </div>
      </td>
      <td className="px-2 py-4 text-right text-base font-semibold text-stone-950 sm:px-5 sm:text-lg">
        <ScoreDisplay score={entry.totalScore} />
      </td>
      <td className="hidden px-2 py-4 text-right text-sm font-medium text-stone-600 sm:table-cell sm:px-5">
        {entry.totalBirdies}
      </td>
    </tr>
  )
}