import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
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
    const supabase = await createClient()

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

    const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
    const oldScoresMap = new Map<string, TournamentScore>()
    for (const score of existingScores) {
      oldScoresMap.set(score.golfer_id, score)
    }

    // Step 3: Fetch scores from external API
    let slashScores
    try {
      slashScores = await getTournamentScores(pool.tournament_id)
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
    for (const score of slashScores) {
      const holeScores: Record<string, number | null> = {}
      for (let i = 1; i <= 18; i++) {
        holeScores[`hole_${i}`] = score.hole_scores[i - 1] ?? null
      }

      await upsertTournamentScore(supabase, {
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        ...holeScores,
        total_birdies: countBirdies(score.hole_scores),
      } as any)
    }

    // Step 5: Update refresh metadata (success)
    const refreshedAt = new Date().toISOString()
    await updatePoolRefreshMetadata(supabase, pool.id, {
      refreshed_at: refreshedAt,
      last_refresh_error: null,
    })

    // Step 6: Compute and broadcast ranked leaderboard
    const allScores = await getScoresForTournament(supabase, pool.tournament_id)

    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', pool.id)

    const golferScoresMap = new Map<string, TournamentScore>()
    for (const score of allScores) {
      golferScoresMap.set(score.golfer_id, score)
    }

    const completedHoles = slashScores.length > 0
      ? Math.min(...slashScores.map(s => s.thru))
      : 0

    const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

    // Broadcast via Supabase real-time
    await supabase.channel('pool_updates').send({
      type: 'broadcast',
      event: 'scores',
      payload: { ranked, completedHoles, updatedAt: refreshedAt },
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshCompleted',
      details: buildRefreshAuditDetails(
        oldScoresMap,
        allScores,
        completedHoles,
        (entries || []).length
      ) as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      data: { completedHoles, refreshedAt },
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

function countBirdies(holeScores: (number | null)[]): number {
  return holeScores.filter(s => s !== null && s < 0).length
}
