import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankEntries } from '@/lib/scoring'
import { classifyFreshness } from '@/lib/freshness'
import type { TournamentScore } from '@/lib/supabase/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params
  const supabase = await createClient()

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

    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', poolId)

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        data: {
          entries: [],
          completedHoles: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
        },
        error: null,
      })
    }

    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    if (!allScores || allScores.length === 0) {
      return NextResponse.json({
        data: {
          entries: [],
          completedHoles: 0,
          refreshedAt: pool.refreshed_at,
          freshness,
          poolStatus: pool.status,
          lastRefreshError: pool.last_refresh_error,
          golferStatuses: {},
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

    // Calculate completed holes from DB scores
    const completedScores = allScores.filter(s => s.hole_1 !== null)
    const completedHoles =
      completedScores.length > 0
        ? Math.min(
            ...completedScores.map(s => {
              let thru = 0
              for (let i = 1; i <= 18; i++) {
                if ((s as any)[`hole_${i}`] !== null) thru = i
                else break
              }
              return thru
            })
          )
        : 0

    const ranked = rankEntries(entries, golferScoresMap, completedHoles)

    return NextResponse.json({
      data: {
        entries: ranked,
        completedHoles,
        refreshedAt: pool.refreshed_at,
        freshness,
        poolStatus: pool.status,
        lastRefreshError: pool.last_refresh_error,
        golferStatuses,
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
