'use client'

import { useState, useMemo } from 'react'
import { ScoreDisplay } from './score-display'
import { GolferDetailSheet } from './GolferDetailSheet'
import { getGolferScorecard, getGolferPoolContext } from '@/lib/golfer-detail'
import type { TournamentScore, Golfer, Entry } from '@/lib/supabase/types'

interface CommissionerGolferPanelProps {
  golfers: Golfer[]
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

  const selectedGolfer: Golfer | null = selectedGolferId
    ? golferMap.get(selectedGolferId) ?? { id: selectedGolferId, name: selectedGolferId, country: '' }
    : null

  const selectedGolferScore = selectedGolferId
    ? golferScores.get(selectedGolferId) ?? null
    : null

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Golfer Overview ({pickedGolfers.length})</h2>
        <p className="text-xs text-gray-500 mt-1">Golfers picked by at least one entry</p>
      </div>

      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded text-sm"
          aria-label="Search golfers"
        />
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left">Golfer</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-right">Picked By</th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGolfers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No golfers match your search.
                </td>
              </tr>
            ) : (
              filteredGolfers.map(g => {
                const isInactive = g.status === 'withdrawn' || g.status === 'cut'
                return (
                  <tr
                    key={g.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
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
                    <td className="px-4 py-2">
                      <div className={`font-medium ${isInactive ? 'line-through text-gray-400' : ''}`}>
                        {g.name}
                      </div>
                      <div className="text-xs text-gray-400">{g.country}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <ScoreDisplay score={g.totalScore} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {g.entriesWithGolfer}/{entries.length}
                      <span className="text-xs text-gray-400 ml-1">
                        ({Math.round(g.pickRate * 100)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          {g.status === 'withdrawn' ? 'WD' : 'CUT'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Active</span>
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
