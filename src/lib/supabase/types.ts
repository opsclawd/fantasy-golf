export type PoolStatus = 'open' | 'live' | 'complete' | 'archived'

export type PoolFormat = 'best_ball'

export type GolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
export type FreshnessStatus = 'current' | 'stale' | 'unknown'

export type MemberRole = 'commissioner' | 'player'

export interface Pool {
  id: string
  commissioner_id: string
  name: string
  tournament_id: string
  tournament_name: string
  year: number
  deadline: string
  timezone: string
  format: PoolFormat
  picks_per_entry: number
  invite_code: string
  status: PoolStatus
  created_at: string
  refreshed_at: string | null
  last_refresh_error: string | null
}

export interface PoolMember {
  id: string
  pool_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

export interface PoolDeletion {
  id: string
  pool_id: string
  commissioner_id: string | null
  deleted_by: string | null
  status_at_delete: PoolStatus
  snapshot: Record<string, unknown>
  deleted_at: string
}

export interface Entry {
  id: string
  pool_id: string
  user_id: string
  golfer_ids: string[]
  total_birdies: number
  created_at: string
  updated_at: string
}

export interface Golfer {
  id: string
  name: string
  country: string
  search_name: string | null
  world_rank: number | null
  is_active: boolean
  source: 'legacy' | 'monthly_sync' | 'tournament_sync' | 'manual_add'
  external_player_id: string | null
  last_synced_at: string | null
}

export interface GolferSyncRun {
  id: string
  run_type: 'monthly_baseline' | 'pre_tournament' | 'manual_add'
  requested_by: string | null
  tournament_id: string | null
  api_calls_used: number
  status: 'success' | 'failed' | 'blocked'
  summary: Record<string, unknown>
  error_message: string | null
  created_at: string
}

export interface TournamentScore {
  golfer_id: string
  tournament_id: string
  round_id?: number | null
  total_score?: number | null
  position?: string | null
  total_birdies: number
  status: GolferStatus
  updated_at?: string | null
}

export interface TournamentScoreRound {
  golfer_id: string
  tournament_id: string
  round_id: number
  strokes?: number | null
  score_to_par?: number | null
  course_id?: string | null
  course_name?: string | null
  round_status?: string | null
  position?: string | null
  total_score?: number | null
  total_strokes_from_completed_rounds?: number | null
  current_hole?: number | null
  thru?: number | null
  starting_hole?: number | null
  current_round?: number | null
  current_round_score?: number | null
  tee_time?: string | null
  tee_time_timestamp?: string | null
  is_amateur?: boolean | null
  status: GolferStatus
  total_birdies: number
  updated_at?: string | null
}

export interface TournamentHole {
  id?: string
  golfer_id: string
  tournament_id: string
  round_id: number
  hole_id: number
  strokes: number
  par: number
  score_to_par: number
  updated_at?: string
}

export interface AuditEvent {
  id: string
  pool_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}
