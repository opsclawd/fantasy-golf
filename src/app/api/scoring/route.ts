import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolStatus,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
} from '@/lib/scoring-queries'
import type { TournamentScore } from '@/lib/supabase/types'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json({ message: 'Update in progress' }, { status: 409 })
  }
  isUpdating = true

  try {
    const supabase = createAdminClient()

    // Step 1: Auto-lock any open pools past their deadline
    const poolsToLock = await getOpenPoolsPastDeadline(supabase)
    for (const pool of poolsToLock) {
      const { error } = await updatePoolStatus(supabase, pool.id, 'live', 'open')
      if (!error) {
        await insertAuditEvent(supabase, {
          pool_id: pool.id,
          user_id: null,
          action: 'entryLocked',
          details: { reason: 'deadline_passed', deadline: pool.deadline },
        })
      }
    }

    // Step 2: Find the active (live) pool to refresh scores for
    const pool = await getActivePool(supabase)
    if (!pool) {
      return NextResponse.json({ data: { message: 'No live pool' }, error: null })
    }

    const tournamentPools = await getPoolsByTournament(supabase, pool.tournament_id)
    const livePools = tournamentPools.filter((tournamentPool) => tournamentPool.status === 'live')

    const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
    const oldScoresMap = new Map<string, TournamentScore>()
    for (const score of existingScores) {
      oldScoresMap.set(score.golfer_id, score)
    }

    // Step 3: Fetch scores from external API
    let slashScores
    try {
      slashScores = await getTournamentScores(pool.tournament_id, pool.year)
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'

      // Record the failure but preserve last-known-good state
      await updatePoolRefreshMetadata(supabase, pool.id, {
        last_refresh_error: errorMessage,
      })

      await insertAuditEvent(supabase, {
        pool_id: pool.id,
        user_id: null,
        action: 'scoreRefreshFailed',
        details: { error: errorMessage },
      })

      return NextResponse.json(
        { data: null, error: { code: 'FETCH_FAILED', message: errorMessage } },
        { status: 502 }
      )
    }

    // Step 4: Upsert scores into DB
    const refreshedAt = new Date().toISOString()
    const upsertFailures: Array<{ golfer_id: string; error: string }> = []
    for (const score of slashScores) {
      const upsertResult = await upsertTournamentScore(supabase, {
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        round_id: score.round_id ?? null,
        round_score: score.round_score ?? null,
        total_score: score.total_score ?? null,
        position: score.position ?? null,
        round_status: score.round_status ?? null,
        current_hole: score.current_hole ?? null,
        tee_time: score.tee_time ?? null,
        updated_at: score.updated_at ?? refreshedAt,
        total_birdies: score.total_birdies ?? 0,
        status: score.status ?? 'active',
      } as any)

      if (upsertResult.error) {
        upsertFailures.push({ golfer_id: score.golfer_id, error: upsertResult.error })
      }
    }

    if (upsertFailures.length > 0) {
      const failureMessage = `Upsert failed for ${upsertFailures.length} golfer(s): ${upsertFailures
        .map(failure => `${failure.golfer_id} (${failure.error})`)
        .join(', ')}`

      await updatePoolRefreshMetadata(supabase, pool.id, {
        last_refresh_error: failureMessage,
      })

      await insertAuditEvent(supabase, {
        pool_id: pool.id,
        user_id: null,
        action: 'scoreRefreshFailed',
        details: {
          error: failureMessage,
          failures: upsertFailures,
        },
      })

      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'UPSERT_FAILED',
            message: 'Failed to persist one or more golfer scores',
          },
        },
        { status: 500 }
      )
    }

    // Step 5: Update refresh metadata (success)
    await updatePoolRefreshMetadata(supabase, pool.id, {
      refreshed_at: refreshedAt,
      last_refresh_error: null,
    })

    // Step 6: Compute and broadcast ranked leaderboard
    const allScores = await getScoresForTournament(supabase, pool.tournament_id)

    const golferScoresMap = new Map<string, TournamentScore>()
    for (const score of allScores) {
      golferScoresMap.set(score.golfer_id, score)
    }

    const completedRounds = slashScores.length > 0
      ? Math.max(...slashScores.map((s) => s.round_id ?? 0))
      : 0

    const refreshDetails = buildRefreshAuditDetails(
      oldScoresMap,
      allScores,
      completedRounds,
      allScores.length
    )

    for (const tournamentPool of livePools) {
      const entries = await getEntriesForPool(supabase, tournamentPool.id)
      const ranked = rankEntries(entries as never[], golferScoresMap, completedRounds)

      await supabase.channel('pool_updates').send({
        type: 'broadcast',
        event: 'scores',
        payload: { poolId: tournamentPool.id, ranked, completedRounds, updatedAt: refreshedAt },
      })

      await updatePoolRefreshMetadata(supabase, tournamentPool.id, {
        refreshed_at: refreshedAt,
        last_refresh_error: null,
      })

      await insertAuditEvent(supabase, {
        pool_id: tournamentPool.id,
        user_id: null,
        action: 'scoreRefreshCompleted',
        details: {
          ...refreshDetails,
          entryCount: (entries || []).length,
        },
      })
    }

    return NextResponse.json({
        data: { completedRounds, refreshedAt },
      error: null,
    })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Update failed',
        },
      },
      { status: 500 }
    )
  } finally {
    isUpdating = false
  }
}
