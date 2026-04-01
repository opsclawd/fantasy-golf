'use client'

import { useState, useMemo } from 'react'
import { ScoreDisplay } from './score-display'
import { GolferDetailSheet } from './GolferDetailSheet'
import { panelClasses, sectionHeadingClasses } from './uiStyles'
import { getGolferScorecard, getGolferPoolContext } from '@/lib/golfer-detail'
import { buildFallbackGolfer } from '@/lib/golfer-catalog/service'
import type { TournamentScore, Entry } from '@/lib/supabase/types'
import type { TournamentRosterGolfer } from '@/lib/tournament-roster/queries'

interface CommissionerGolferPanelProps {
  golfers: TournamentRosterGolfer[]
  golferScoresRecord: Record<string, TournamentScore>
  entries: Entry[]
}

export function CommissionerGolferPanel({
  golfers,
  golferScoresRecord,
  entries,
}: CommissionerGolferPanelProps) {
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const golferScores = useMemo(
    () => new Map(Object.entries(golferScoresRecord)),
    [golferScoresRecord]
  )

  // Only show golfers that appear in at least one entry
  const pickedGolferIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries) {
      for (const id of entry.golfer_ids) {
        ids.add(id)
      }
    }
    return ids
  }, [entries])

  const golferMap = useMemo(
    () => new Map(golfers.map(g => [g.id, g])),
    [golfers]
  )

  const pickedGolfers = useMemo(() => {
    return Array.from(pickedGolferIds)
      .map(id => {
        const golfer = golferMap.get(id)
        const score = golferScores.get(id)
        const context = getGolferPoolContext(id, entries)
        const scorecard = score ? getGolferScorecard(score) : null

        return {
          id,
          name: golfer?.name ?? id,
          country: golfer?.country ?? '',
          status: scorecard?.status ?? 'active',
          totalScore: scorecard?.totalScore ?? 0,
          completedHoles: scorecard?.completedHoles ?? 0,
          pickRate: context.pickRate,
          entriesWithGolfer: context.entriesWithGolfer,
        }
      })
      .sort((a, b) => a.totalScore - b.totalScore)
  }, [pickedGolferIds, golferMap, golferScores, entries])

  const filteredGolfers = pickedGolfers.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  const selectedGolfer: TournamentRosterGolfer | null = selectedGolferId
    ? golferMap.get(selectedGolferId) ?? (buildFallbackGolfer(selectedGolferId) as TournamentRosterGolfer)
    : null

  const selectedGolferScore = selectedGolferId
    ? golferScores.get(selectedGolferId) ?? null
    : null

  return (
    <div className={[panelClasses(), 'overflow-hidden'].join(' ')}>
      <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(242,247,241,0.92))] px-5 py-5">
        <p className={sectionHeadingClasses()}>Commissioner view</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          Golfer overview ({pickedGolfers.length})
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Review who picked each golfer, current scoring posture, and tap into detail without losing trust cues.
        </p>
      </div>

      <div className="border-b border-slate-200/70 bg-white/70 px-4 py-4">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          aria-label="Search golfers"
        />
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Golfer</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Picked By</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGolfers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10">
                  <div className="mx-auto max-w-md rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center">
                    <p className={sectionHeadingClasses()}>Golfer search</p>
                    <p className="mt-3 text-base font-semibold text-slate-950">
                      No golfers match this search yet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Try a different player name to review scoring context and pool exposure.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredGolfers.map(g => {
                const isInactive = g.status === 'withdrawn' || g.status === 'cut'
                return (
                  <tr
                    key={g.id}
                    className="cursor-pointer border-t border-slate-200/70 transition hover:bg-emerald-50/40"
                    onClick={() => setSelectedGolferId(g.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedGolferId(g.id)
                      }
                    }}
                    aria-label={`View ${g.name} details`}
                  >
                    <td className="px-4 py-3">
                      <div className={`font-medium text-slate-900 ${isInactive ? 'line-through text-slate-400' : ''}`}>
                        {g.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{g.country || 'Country pending'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                      <ScoreDisplay score={g.totalScore} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {g.entriesWithGolfer}/{entries.length}
                      <span className="ml-1 text-xs text-slate-500">
                        ({Math.round(g.pickRate * 100)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {g.status === 'withdrawn' ? 'WD' : 'CUT'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedGolfer && (
        <GolferDetailSheet
          golfer={selectedGolfer}
          score={selectedGolferScore}
          onClose={() => setSelectedGolferId(null)}
        />
      )}
    </div>
  )
}
