'use client'

import { useState, useMemo } from 'react'
import { GolferContribution } from './GolferContribution'
import { GolferDetailSheet } from './GolferDetailSheet'
import { buildFallbackGolfer } from '@/lib/golfer-catalog/service'
import { getEntryGolferSummaries, type GolferLike } from '@/lib/golfer-detail'
import type { TournamentScore } from '@/lib/supabase/types'

interface EntryGolferBreakdownProps {
  golferIds: string[]
  golfers: GolferLike[]
  golferScoresRecord: Record<string, TournamentScore>
}

export function EntryGolferBreakdown({ golferIds, golfers, golferScoresRecord }: EntryGolferBreakdownProps) {
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)

  const golferScores = useMemo(
    () => new Map(Object.entries(golferScoresRecord)),
    [golferScoresRecord]
  )

  const summaries = useMemo(
    () => getEntryGolferSummaries(golferIds, golferScores, golfers),
    [golferIds, golferScores, golfers]
  )

  const selectedGolfer: GolferLike | null = useMemo(() => {
    if (!selectedGolferId) return null
    return (golfers.find(g => g.id === selectedGolferId) ?? buildFallbackGolfer(selectedGolferId)) as GolferLike
  }, [selectedGolferId, golfers])

  const selectedGolferScore = selectedGolferId
    ? golferScores.get(selectedGolferId) ?? null
    : null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Your Golfers</h3>
      <div className="space-y-1.5">
        {summaries.map(summary => (
          <GolferContribution
            key={summary.golferId}
            summary={summary}
            onSelect={setSelectedGolferId}
          />
        ))}
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
