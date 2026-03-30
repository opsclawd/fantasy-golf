'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrustStatusBar } from './TrustStatusBar'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import { GolferDetailSheet } from './GolferDetailSheet'
import { DataAlert } from './DataAlert'
import { LeaderboardHeader } from './LeaderboardHeader'
import { LeaderboardRow, type RankedEntry } from './LeaderboardRow'
import { shouldRenderLeaderboardTrustStatus } from './leaderboard-trust-status'
import { panelClasses, scrollRegionFocusClasses } from './uiStyles'
import type { FreshnessStatus, PoolStatus, TournamentScore, Golfer } from '@/lib/supabase/types'

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
  /** Hide the TrustStatusBar in the leaderboard header */
  hideTrustStatusHeader?: boolean
}

const DEFAULT_POLL_INTERVAL = 30_000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function Leaderboard({
  poolId,
  pollInterval = DEFAULT_POLL_INTERVAL,
  hideTrustStatusHeader = false,
}: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

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
      <div className={`${panelClasses()} p-8 text-center text-slate-500`} role="status" aria-live="polite">
        Loading leaderboard...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={`${panelClasses()} p-8 text-center`}>
        <DataAlert variant="error" title="Unable to load leaderboard" message={fetchError} />
      </div>
    )
  }

  if (!data) return null

  const { entries, completedHoles, refreshedAt, freshness, poolStatus, lastRefreshError, golferStatuses } = data
  const hasEntries = entries.length > 0
  const hasScores = completedHoles > 0
  const showTrustStatusHeader = shouldRenderLeaderboardTrustStatus(poolStatus, hideTrustStatusHeader)

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
    <div className={`${panelClasses()} overflow-hidden`}>
      <LeaderboardHeader completedHoles={completedHoles} />
      {showTrustStatusHeader && (
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <TrustStatusBar
            className="border"
            isLocked={true}
            poolStatus={poolStatus}
            freshness={freshness}
            refreshedAt={refreshedAt}
            lastRefreshError={lastRefreshError}
          />
        </div>
      )}

      {!hasEntries || !hasScores ? (
        <LeaderboardEmptyState
          poolStatus={poolStatus}
          hasEntries={hasEntries}
          lastRefreshError={lastRefreshError}
        />
      ) : (
        <div
          className={`overflow-x-auto px-2 pb-2 ${scrollRegionFocusClasses()} sm:px-3 sm:pb-3`}
          tabIndex={0}
          aria-label="Leaderboard standings"
        >
          <table className="min-w-[40rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:min-w-full">
            <caption className="sr-only">Live leaderboard rankings for pool entries</caption>
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-5">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-5">
                  Entry
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-5">
                  Score
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-5">
                  Birdies
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isTied =
                  (index > 0 && entries[index - 1].rank === entry.rank) ||
                  (index < entries.length - 1 && entries[index + 1]?.rank === entry.rank)

                return (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    isTied={isTied}
                    golferNames={data.golferNames}
                    withdrawnGolferIds={withdrawnGolferIds}
                    onSelectGolfer={setSelectedGolferId}
                  />
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
