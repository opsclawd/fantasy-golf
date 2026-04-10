import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveCompletedRounds, rankEntries } from '@/lib/scoring'
import { classifyFreshness } from '@/lib/freshness'
import type { TournamentScore } from '@/lib/supabase/types'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

/**
 * Fire-and-forget: trigger a background scoring refresh for this pool.
 * Runs server-side using CRON_SECRET — the client never sees this call.
 * Errors are silently swallowed (stale data is shown with honest timestamp).
 */
// Preserve any deployment path prefix while normalizing trailing slashes.
function buildInternalApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const normalizedBaseUrl = `${baseUrl.replace(/\/+$/, '')}/`

  return new URL(path.replace(/^\//, ''), normalizedBaseUrl).toString()
}

function triggerBackgroundRefresh(poolId: string): void {
  fetch(buildInternalApiUrl('/api/scoring/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ poolId }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silently swallow — user sees stale data with honest timestamp
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  try {
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      )
    }

    const freshness = classifyFreshness(pool.refreshed_at)

    const isStale = freshness === 'stale' || freshness === 'unknown'
    const shouldTriggerRefresh = isStale && pool.status === 'live'
    const isRefreshing = shouldTriggerRefresh && !pool.last_refresh_error

    if (shouldTriggerRefresh) {
      triggerBackgroundRefresh(poolId)
    }

    const { data: entries } = await admin
      .from('entries')
      .select('*')
      .eq('pool_id', poolId)

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        data: {
          entries: [],
          completedRounds: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          isRefreshing,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
          golferNames: {},
          golferCountries: {},
          golferScores: {},
        },
        error: null,
      })
    }

    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    if (!allScores || allScores.length === 0) {
      const rankedWithoutScores = rankEntries(entries, new Map(), 0)

      return NextResponse.json({
        data: {
          entries: rankedWithoutScores,
          completedRounds: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          isRefreshing,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
          golferNames: {},
          golferCountries: {},
          golferScores: {},
        },
        error: null,
      })
    }

    const golferScoresMap = new Map<string, TournamentScore>()
    const golferStatuses: Record<string, string> = {}
    for (const score of allScores) {
      const ts = score as TournamentScore
      golferScoresMap.set(ts.golfer_id, ts)
      if (ts.status !== 'active') {
        golferStatuses[ts.golfer_id] = ts.status
      }
    }

    // Fetch golfer names for display
    const allGolferIds = new Set<string>()
    for (const entry of entries) {
      for (const id of (entry as { golfer_ids: string[] }).golfer_ids) {
        allGolferIds.add(id)
      }
    }

    const golferNames: Record<string, string> = {}
    const golferCountries: Record<string, string> = {}
    const golferRows = await getTournamentRosterGolfers(supabase, pool.tournament_id)

    for (const g of golferRows.filter((golfer) => allGolferIds.has(golfer.id))) {
      golferNames[g.id] = g.name
      golferCountries[g.id] = g.country ?? ''
    }

    const completedRounds = deriveCompletedRounds(allScores as TournamentScore[])

    const ranked = rankEntries(entries, golferScoresMap, completedRounds)

    return NextResponse.json({
      data: {
        entries: ranked,
        completedRounds,
        refreshedAt: pool.refreshed_at,
        freshness,
        isRefreshing,
        poolStatus: pool.status,
        lastRefreshError: pool.last_refresh_error,
        golferStatuses,
        golferNames,
        golferCountries,
        golferScores: Object.fromEntries(golferScoresMap),
      },
      error: null,
    })
  } catch (error) {
    console.error('Leaderboard fetch failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch leaderboard',
        },
      },
      { status: 500 }
    )
  }
}
