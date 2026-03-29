'use client'

import { ScoreDisplay } from './score-display'
import type { GolferScorecard as ScorecardType } from '@/lib/golfer-detail'

interface GolferScorecardProps {
  scorecard: ScorecardType
}

export function GolferScorecard({ scorecard }: GolferScorecardProps) {
  const frontNine = scorecard.holes.slice(0, 9)
  const backNine = scorecard.holes.slice(9, 18)

  const frontTotal = frontNine.reduce((sum, h) => sum + (h.score ?? 0), 0)
  const backTotal = backNine.reduce((sum, h) => sum + (h.score ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Thru {scorecard.completedHoles} holes
          </span>
          {scorecard.status !== 'active' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {scorecard.status === 'withdrawn' ? 'WD' : 'CUT'}
            </span>
          )}
        </div>
        <div className="text-sm">
          Total: <span className="font-mono font-semibold"><ScoreDisplay score={scorecard.totalScore} /></span>
        </div>
      </div>

      {/* Front 9 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Front nine scores">
          <thead>
            <tr className="bg-gray-50">
              {frontNine.map(h => (
                <th key={h.hole} className="px-2 py-1 text-center text-xs text-gray-500 font-normal">
                  {h.hole}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-xs text-gray-700 font-semibold border-l">OUT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {frontNine.map(h => (
                <td key={h.hole} className="px-2 py-1 text-center font-mono">
                  {h.score !== null ? <ScoreDisplay score={h.score} /> : <span className="text-gray-300">-</span>}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-mono font-semibold border-l">
                <ScoreDisplay score={frontTotal} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Back 9 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Back nine scores">
          <thead>
            <tr className="bg-gray-50">
              {backNine.map(h => (
                <th key={h.hole} className="px-2 py-1 text-center text-xs text-gray-500 font-normal">
                  {h.hole}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-xs text-gray-700 font-semibold border-l">IN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {backNine.map(h => (
                <td key={h.hole} className="px-2 py-1 text-center font-mono">
                  {h.score !== null ? <ScoreDisplay score={h.score} /> : <span className="text-gray-300">-</span>}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-mono font-semibold border-l">
                <ScoreDisplay score={backTotal} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
