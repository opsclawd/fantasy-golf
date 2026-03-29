import type { SupabaseClient } from '@supabase/supabase-js'
import type { TournamentScore } from './supabase/types'

export async function upsertTournamentScore(
  supabase: SupabaseClient,
  score: Omit<TournamentScore, 'status'> & { status?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_scores')
    .upsert(score, { onConflict: 'golfer_id,tournament_id' })
  if (error) return { error: error.message }
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
