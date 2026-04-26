import type { SupabaseClient } from '@supabase/supabase-js'
import type { TournamentScore, TournamentScoreRound, TournamentHole } from './supabase/types'
import type { GolferScore, GolferScoreRound } from './slash-golf/types'

export async function getTournamentHolesForGolfers(
  supabase: SupabaseClient,
  tournamentId: string,
  golferIds: string[]
): Promise<Map<string, TournamentHole[]>> {
  const { data, error } = await supabase
    .from('tournament_holes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('golfer_id', golferIds)
    .order('round_id', { ascending: true })
    .order('hole_id', { ascending: true })

  if (error) throw new Error(error.message)

  const result = new Map<string, TournamentHole[]>()
  for (const hole of (data as TournamentHole[]) || []) {
    if (!result.has(hole.golfer_id)) {
      result.set(hole.golfer_id, [])
    }
    result.get(hole.golfer_id)!.push(hole)
  }
  return result
}

export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }> {
  if (holes.length === 0) return { error: null }

  const { error } = await supabase
    .from('tournament_holes')
    .upsert(holes, { onConflict: 'golfer_id,tournament_id,round_id,hole_id' })

  if (error) return { error: error.message }
  return { error: null }
}

export async function upsertTournamentScoreRound(
  supabase: SupabaseClient,
  score: Omit<TournamentScoreRound, 'id'>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_score_rounds')
    .upsert(score, { onConflict: 'golfer_id,tournament_id,round_id' })
  if (error) return { error: error.message }
  return { error: null }
}

export async function upsertTournamentScore(
  supabase: SupabaseClient,
  score: Omit<TournamentScore, 'status'> & { status?: string },
  golferScore: GolferScore
): Promise<{ error: string | null }> {
  // Write each round from the rounds array to the archive
  if (golferScore.rounds && golferScore.rounds.length > 0) {
    const roundRecords = golferScore.rounds.map((r): Omit<TournamentScoreRound, 'id'> => ({
      golfer_id: golferScore.golfer_id,
      tournament_id: score.tournament_id,
      round_id: r.round_id,
      strokes: r.strokes ?? null,
      score_to_par: r.score_to_par ?? null,
      course_id: r.course_id ?? null,
      course_name: r.course_name ?? null,
      position: golferScore.position ?? null,
      total_score: golferScore.total_score ?? null,
      total_strokes_from_completed_rounds: golferScore.total_strokes_from_completed_rounds ?? null,
      current_hole: golferScore.current_hole ?? null,
      thru: golferScore.thru ?? null,
      starting_hole: golferScore.starting_hole ?? null,
      current_round: golferScore.current_round ?? null,
      current_round_score: golferScore.current_round_score ?? null,
      tee_time: golferScore.tee_time ?? null,
      tee_time_timestamp: golferScore.tee_time_timestamp ?? null,
      is_amateur: golferScore.is_amateur ?? null,
      status: golferScore.status ?? 'active',
      total_birdies: score.total_birdies ?? 0,
      updated_at: golferScore.updated_at ?? new Date().toISOString(),
    }))

    for (const roundRecord of roundRecords) {
      const { error: archiveError } = await supabase
        .from('tournament_score_rounds')
        .upsert(roundRecord, { onConflict: 'golfer_id,tournament_id,round_id' })
      if (archiveError) return { error: `archive: ${archiveError.message}` }
    }
  }

  // Write current state to tournament_scores
  const { error: currentError } = await supabase
    .from('tournament_scores')
    .upsert({
      golfer_id: score.golfer_id,
      tournament_id: score.tournament_id,
      round_id: golferScore.current_round ?? golferScore.rounds?.[golferScore.rounds.length - 1]?.round_id ?? null,
      total_score: score.total_score ?? null,
      position: score.position ?? null,
      total_birdies: score.total_birdies ?? 0,
      status: score.status ?? 'active',
      updated_at: golferScore.updated_at ?? new Date().toISOString(),
    }, { onConflict: 'golfer_id,tournament_id' })
  if (currentError) return { error: `current: ${currentError.message}` }

  return { error: null }
}

export async function getScoresForTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<TournamentScore[]> {
  const { data } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', tournamentId)
  return (data as TournamentScore[]) || []
}

export async function updateGolferStatus(
  supabase: SupabaseClient,
  golferId: string,
  tournamentId: string,
  status: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_scores')
    .update({ status })
    .eq('golfer_id', golferId)
    .eq('tournament_id', tournamentId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getTournamentScoreRounds(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<TournamentScoreRound[]> {
  const { data } = await supabase
    .from('tournament_score_rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_id', { ascending: true })
  return (data as TournamentScoreRound[]) || []
}
