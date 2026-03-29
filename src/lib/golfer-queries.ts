import type { SupabaseClient } from '@supabase/supabase-js'
import type { Golfer, TournamentScore } from './supabase/types'

export async function getGolferById(
  supabase: SupabaseClient,
  golferId: string
): Promise<Golfer | null> {
  const { data } = await supabase
    .from('golfers')
    .select('*')
    .eq('id', golferId)
    .single()
  return data as Golfer | null
}

export async function getGolfersByIds(
  supabase: SupabaseClient,
  golferIds: string[]
): Promise<Golfer[]> {
  if (golferIds.length === 0) return []
  const { data } = await supabase
    .from('golfers')
    .select('*')
    .in('id', golferIds)
  return (data as Golfer[]) || []
}

export async function getGolferScoreForTournament(
  supabase: SupabaseClient,
  golferId: string,
  tournamentId: string
): Promise<TournamentScore | null> {
  const { data } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('golfer_id', golferId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  return data as TournamentScore | null
}

export async function getAllGolfersForPool(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<{ golfers: Golfer[]; scores: TournamentScore[] }> {
  const [golferResult, scoreResult] = await Promise.all([
    supabase.from('golfers').select('*'),
    supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', tournamentId),
  ])

  return {
    golfers: (golferResult.data as Golfer[]) || [],
    scores: (scoreResult.data as TournamentScore[]) || [],
  }
}
