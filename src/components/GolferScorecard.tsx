'use client'

import { ScoreDisplay } from './score-display'
import type { GolferScorecard as ScorecardType } from '@/lib/golfer-detail'

interface GolferScorecardProps {
  scorecard: ScorecardType
}

export function GolferScorecard({ scorecard }: GolferScorecardProps) {
  const round = scorecard.rounds?.[0]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Round {round?.round ?? scorecard.completedRounds}
          </span>
          {scorecard.status !== 'active' && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {scorecard.status === 'withdrawn' ? 'WD' : 'CUT'}
            </span>
          )}
        </div>
        <div className="text-sm">
          Total: <span className="font-mono font-semibold"><ScoreDisplay score={scorecard.totalScore} /></span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <div className="flex flex-wrap gap-4">
          <span>Round score: <strong className="font-mono"><ScoreDisplay score={round?.score ?? 0} /></strong></span>
          {round?.position ? <span>Position: {round.position}</span> : null}
          {round?.roundStatus ? <span>Status: {round.roundStatus}</span> : null}
          {round?.teeTime ? <span>Tee time: {round.teeTime}</span> : null}
        </div>
      </div>
    </div>
  )
}
