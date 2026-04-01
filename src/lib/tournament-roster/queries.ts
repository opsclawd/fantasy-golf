import type { SupabaseClient } from '@supabase/supabase-js'

import { buildSearchName } from '@/lib/golfer-catalog/normalize'

import type { TournamentRosterGolferInput, TournamentRosterSource } from './types'

export type TournamentRosterGolfer = {
  id: string
  name: string
  country: string
  search_name: string | null
  is_active: boolean
}

export function buildTournamentRosterInsert({
  tournamentId,
  golfer,
  source,
  syncedAt,
}: {
  tournamentId: string
  golfer: TournamentRosterGolferInput
  source: TournamentRosterSource
  syncedAt: string
}) {
  const playerId = (golfer.playerId?.trim() || golfer.id.trim())
  const name = (golfer.name ?? [golfer.firstName, golfer.lastName].filter(Boolean).join(' ')).trim().replace(/\s+/g, ' ')

  if (!playerId || !name) {
    throw new Error('Tournament roster golfer must include a usable id and name')
  }

  return {
    tournament_id: tournamentId,
    id: playerId,
    external_player_id: playerId,
    name,
    search_name: buildSearchName(name),
    country: golfer.country?.trim() ?? '',
    world_rank: golfer.worldRank ?? null,
    is_active: true,
    source,
    last_synced_at: syncedAt,
  }
}

export function buildTournamentRosterRows({
  tournamentId,
  golfers,
  source,
  syncedAt,
}: {
  tournamentId: string
  golfers: TournamentRosterGolferInput[]
  source: TournamentRosterSource
  syncedAt: string
}) {
  return golfers.map((golfer) => buildTournamentRosterInsert({ tournamentId, golfer, source, syncedAt }))
}

export async function getTournamentRosterGolfers(
  supabase: SupabaseClient,
  tournamentId: string,
) {
  const { data, error } = await supabase
    .from('tournament_golfers')
    .select('id, name, country, search_name, is_active')
    .eq('tournament_id', tournamentId)
    .order('name')

  if (error) {
    throw new Error(`Failed to load tournament roster golfers: ${error.message}`)
  }

  return (data ?? []) as TournamentRosterGolfer[]
}
