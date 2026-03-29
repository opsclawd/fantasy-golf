'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScoreDisplay } from './score-display'
import { TrustStatusBar } from './TrustStatusBar'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import { GolferDetailSheet } from './GolferDetailSheet'
import { DataAlert } from './DataAlert'
import type { FreshnessStatus, PoolStatus, TournamentScore, Golfer } from '@/lib/supabase/types'

interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

interface LeaderboardData {
  entries: RankedEntry[]
  completedHoles: number
  refreshedAt: string | null
  freshness: FreshnessStatus
  poolStatus: PoolStatus
  lastRefreshError: string | null
  golferStatuses: Record<string, string>
  golferNames: Record<string, string>
  golferCountries: Record<string, string>
  golferScores: Record<string, TournamentScore>
}

interface LeaderboardProps {
  poolId: string
  /** Polling interval in milliseconds. Default: 30 seconds */
  pollInterval?: number
}

const DEFAULT_POLL_INTERVAL = 30_000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function Leaderboard({ poolId, pollInterval = DEFAULT_POLL_INTERVAL }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${poolId}`)
      const json = await res.json()

      if (json.data) {
        setData(json.data)
        setFetchError(null)
      } else if (json.error) {
        setFetchError(json.error.message || 'Failed to load leaderboard')
      } else {
        // Legacy response format (backwards compat during rollout)
        if (json.entries) {
          setData({
            entries: json.entries,
            completedHoles: json.completedHoles ?? 0,
            refreshedAt: json.updatedAt ?? null,
            freshness: 'unknown',
            poolStatus: 'live',
            lastRefreshError: null,
            golferStatuses: {},
            golferNames: {},
            golferCountries: {},
            golferScores: {},
          })
        }
      }
    } catch {
      setFetchError('Network error loading leaderboard')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    fetchLeaderboard()

    // Polling: refetch on interval
    const intervalId = setInterval(fetchLeaderboard, pollInterval)

    // Real-time: supplementary live updates
    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload: unknown) => {
        if (!isObject(payload) || !isObject(payload.payload)) return

        const p = payload.payload as Record<string, unknown>
        if (!Array.isArray(p.ranked)) return

        // On broadcast, trigger a fresh fetch to get full metadata
        fetchLeaderboard()
      })
      .subscribe()

    return () => {
      clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [poolId, pollInterval, fetchLeaderboard, supabase])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500" role="status">
        Loading leaderboard...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <DataAlert variant="error" title="Unable to load leaderboard" message={fetchError} />
      </div>
    )
  }

  if (!data) return null

  const { entries, completedHoles, refreshedAt, freshness, poolStatus, lastRefreshError, golferStatuses } = data
  const hasEntries = entries.length > 0
  const hasScores = completedHoles > 0

  // Detect which golfer IDs in entries are withdrawn
  const withdrawnGolferIds = new Set(
    Object.entries(golferStatuses)
      .filter(([, status]) => status === 'withdrawn' || status === 'cut')
      .map(([id]) => id)
  )

  const selectedGolfer: Golfer | null = selectedGolferId && data
    ? {
        id: selectedGolferId,
        name: data.golferNames[selectedGolferId] ?? selectedGolferId,
        country: data.golferCountries?.[selectedGolferId] ?? '',
      }
    : null

  const selectedGolferScore: TournamentScore | null =
    selectedGolferId && data?.golferScores?.[selectedGolferId]
      ? data.golferScores[selectedGolferId]
      : null

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          {completedHoles > 0 && (
            <span className="text-sm text-gray-500">
              Thru {completedHoles} holes
            </span>
          )}
        </div>
        {(poolStatus === 'live' || poolStatus === 'complete') && (
          <TrustStatusBar
            className="mt-3"
            isLocked={true}
            poolStatus={poolStatus}
            freshness={freshness}
            refreshedAt={refreshedAt}
            lastRefreshError={lastRefreshError}
          />
        )}
      </div>

      {/* Content */}
      {!hasEntries || !hasScores ? (
        <LeaderboardEmptyState
          poolStatus={poolStatus}
          hasEntries={hasEntries}
          hasScores={hasScores}
          lastRefreshError={lastRefreshError}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm">Rank</th>
                <th className="px-4 py-2 text-left text-sm">Entry</th>
                <th className="px-4 py-2 text-right text-sm">Score</th>
                <th className="px-4 py-2 text-right text-sm">Birdies</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isTied =
                  (index > 0 && entries[index - 1].rank === entry.rank) ||
                  (index < entries.length - 1 && entries[index + 1]?.rank === entry.rank)

                const entryHasWithdrawnGolfer = entry.golfer_ids.some(id =>
                  withdrawnGolferIds.has(id)
                )

                return (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1 text-center rounded text-sm ${
                          entry.rank === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : entry.rank === 2
                              ? 'bg-gray-100 text-gray-800'
                              : entry.rank === 3
                                ? 'bg-orange-100 text-orange-800'
                                : ''
                        }`}
                      >
                        {isTied ? `T${entry.rank}` : entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-sm text-gray-700 mb-1">
                        {entry.user_id.slice(0, 8)}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {entry.golfer_ids.map(id => {
                          const isWd = withdrawnGolferIds.has(id)
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setSelectedGolferId(id)}
                              className={`px-1.5 py-0.5 rounded text-xs hover:ring-1 hover:ring-blue-400 ${
                                isWd
                                  ? 'bg-amber-50 text-amber-700 line-through'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                              aria-label={`View details for ${data?.golferNames?.[id] ?? id}`}
                            >
                              {data?.golferNames?.[id] ?? id.slice(0, 8)}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <ScoreDisplay score={entry.totalScore} />
                    </td>
                    <td className="px-4 py-2 text-right">{entry.totalBirdies}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
