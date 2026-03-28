export type PoolStatus = 'open' | 'live' | 'complete'

export type PoolFormat = 'best_ball'

export type MemberRole = 'commissioner' | 'player'

export interface Pool {
  id: string
  commissioner_id: string
  name: string
  tournament_id: string
  tournament_name: string
  year: number
  deadline: string
  format: PoolFormat
  picks_per_entry: number
  invite_code: string
  status: PoolStatus
  created_at: string
}

export interface PoolMember {
  id: string
  pool_id: string
  user_id: string
  role: MemberRole
  joined_at: string
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
}

export interface TournamentScore {
  golfer_id: string
  tournament_id: string
  hole_1: number | null
  hole_2: number | null
  hole_3: number | null
  hole_4: number | null
  hole_5: number | null
  hole_6: number | null
  hole_7: number | null
  hole_8: number | null
  hole_9: number | null
  hole_10: number | null
  hole_11: number | null
  hole_12: number | null
  hole_13: number | null
  hole_14: number | null
  hole_15: number | null
  hole_16: number | null
  hole_17: number | null
  hole_18: number | null
  total_birdies: number
}

export interface AuditEvent {
  id: string
  pool_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}
