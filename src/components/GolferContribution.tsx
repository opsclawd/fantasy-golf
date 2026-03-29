'use client'

import { ScoreDisplay } from './score-display'
import type { GolferSummary } from '@/lib/golfer-detail'

interface GolferContributionProps {
  summary: GolferSummary
  onSelect?: (golferId: string) => void
}

export function GolferContribution({ summary, onSelect }: GolferContributionProps) {
  const isInactive = summary.status === 'withdrawn' || summary.status === 'cut'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(summary.golferId)}
      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
      aria-label={`View ${summary.name} details`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isInactive ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {summary.name}
          </span>
          {isInactive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {summary.status === 'withdrawn' ? 'WD' : 'CUT'}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {summary.country}
          {summary.completedHoles > 0 && (
            <span className="ml-2">Thru {summary.completedHoles}</span>
          )}
          {summary.contributingHoles > 0 && (
            <span className="ml-2">
              Best ball on {summary.contributingHoles} hole{summary.contributingHoles !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="ml-3 flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm font-semibold">
            <ScoreDisplay score={summary.totalScore} />
          </div>
          <div className="text-xs text-gray-400">
            {summary.totalBirdies} birdie{summary.totalBirdies !== 1 ? 's' : ''}
          </div>
        </div>
        <span className="text-gray-300 text-sm" aria-hidden="true">&rsaquo;</span>
      </div>
    </button>
  )
}
