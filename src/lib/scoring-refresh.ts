import type { SupabaseClient } from '@supabase/supabase-js'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring/domain'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getPoolsByTournament,
  getEntriesForPool,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import type { Entry } from '@/lib/supabase/types'
import {
  upsertTournamentScore,
  getScoresForTournament,
  getTournamentScoreRounds,
} from '@/lib/scoring-queries'
import type { TournamentScore } from '@/lib/supabase/types'
import type { GolferRoundScoresMap } from '@/lib/scoring/domain'
import { deriveCompletedRounds } from '@/lib/scoring/domain'

interface RefreshablePool {
  id: string
  tournament_id: string
  year: number
  status: string
}

export interface RefreshResult {
  completedRounds: number
  refreshedAt: string
}

export interface RefreshError {
  code: 'NO_SCORES' | 'FETCH_FAILED' | 'UPSERT_FAILED' | 'INTERNAL_ERROR'
  message: string
}

/**
 * Core scoring refresh logic shared by the cron route and the on-demand refresh endpoint.
 *
 * 1. Fetches scores from the external SlashGolf API
 * 2. Upserts scores into the tournament_scores table
 * 3. Updates refresh metadata on all live pools for the tournament
 * 4. Broadcasts ranked leaderboard via Supabase Realtime
 * 5. Writes audit events
 *
 * Returns { data, error } — exactly one will be non-null.
 */
export async function refreshScoresForPool(
  supabase: SupabaseClient,
  pool: RefreshablePool
): Promise<{ data: RefreshResult | null; error: RefreshError | null }> {
  const tournamentPools = await getPoolsByTournament(supabase, pool.tournament_id)
  const livePools = tournamentPools.filter((p) => p.status === 'live')

  const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
  const oldScoresMap = new Map<string, TournamentScore>()
  for (const score of existingScores) {
    oldScoresMap.set(score.golfer_id, score)
  }

  // Step 1: Fetch scores from external API
  let slashScores
  try {
    slashScores = await getTournamentScores(pool.tournament_id, pool.year)
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'

    await updatePoolRefreshMetadata(supabase, pool.id, {
      last_refresh_error: errorMessage,
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshFailed',
      details: { error: errorMessage },
    })

    return {
      data: null,
      error: { code: 'FETCH_FAILED', message: errorMessage },
    }
  }

  if (slashScores.length === 0) {
    const errorMessage = 'No golfers returned from scoring API'

    await updatePoolRefreshMetadata(supabase, pool.id, {
      last_refresh_error: errorMessage,
    })

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshFailed',
      details: { error: errorMessage },
    })

    return {
      data: null,
      error: { code: 'NO_SCORES', message: errorMessage },
    }
  }

  // Step 2: Upsert scores into DB
  // upsertTournamentScore writes to both tournament_scores (current state)
  // and tournament_score_rounds (per-round archive) via the golferScore.rounds array
  const refreshedAt = new Date().toISOString()
  const upsertFailures: Array<{ golfer_id: string; error: string }> = []
  for (const score of slashScores) {
    const upsertResult = await upsertTournamentScore(supabase,
      {
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        total_score: score.total ?? null,
        position: score.position ?? null,
        updated_at: score.updated_at ?? refreshedAt,
        total_birdies: score.total_birdies ?? 0,
        status: score.status ?? 'active',
      },
      score  // full GolferScore — rounds array gets written to tournament_score_rounds
    )

    if (upsertResult.error) {
      upsertFailures.push({ golfer_id: score.golfer_id, error: upsertResult.error })
    }
  }

  if (upsertFailures.length > 0) {
    const failureMessage = `Upsert failed for ${upsertFailures.length} golfer(s): ${upsertFailures
      .map((f) => `${f.golfer_id} (${f.error})`)
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

    return {
      data: null,
      error: { code: 'UPSERT_FAILED', message: 'Failed to persist one or more golfer scores' },
    }
  }

  // Step 3: Update refresh metadata (success)
  await updatePoolRefreshMetadata(supabase, pool.id, {
    refreshed_at: refreshedAt,
    last_refresh_error: null,
  })

  // Step 4: Build golfer round scores map from per-round archive
  const scoreRounds = await getTournamentScoreRounds(supabase, pool.tournament_id)
  const golferRoundScoresMap: GolferRoundScoresMap = new Map()

  for (const round of scoreRounds) {
    if (!golferRoundScoresMap.has(round.golfer_id)) {
      golferRoundScoresMap.set(round.golfer_id, [])
    }
    golferRoundScoresMap.get(round.golfer_id)!.push({
      roundId: round.round_id,
      scoreToPar: round.score_to_par ?? null,
      status: round.status,
      isComplete: round.strokes !== null,
    })
  }

  const allScores = await getScoresForTournament(supabase, pool.tournament_id)
  const completedRounds = deriveCompletedRounds(allScores)

  const golferScoresMap = new Map<string, TournamentScore>()
  for (const score of allScores) {
    golferScoresMap.set(score.golfer_id, score)
  }

  const refreshDetails = buildRefreshAuditDetails(
    oldScoresMap,
    allScores,
    completedRounds,
    allScores.length
  )

  for (const tournamentPool of livePools) {
    const entries = await getEntriesForPool(supabase, tournamentPool.id) as Entry[]
    const ranked = rankEntries(entries, golferRoundScoresMap, completedRounds)

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

  return {
    data: { completedRounds, refreshedAt },
    error: null,
  }
}