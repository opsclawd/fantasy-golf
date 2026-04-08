export interface Tournament {
  tournId: string
  name: string
  startDate: string
  endDate: string
}

export interface GolferScore {
  golfer_id: string
  tournament_id?: string
  round_id?: number | null
  round_score?: number | null
  total_score?: number | null
  position?: string | null
  round_status?: string | null
  current_hole?: number | null
  tee_time?: string | null
  updated_at?: string | null
  hole_scores?: (number | null)[]
  thru?: number
  total?: number
  total_birdies?: number
  status?: 'active' | 'withdrawn' | 'cut'
}

export interface RapidApiPlayer {
  id: string
  playerId?: string
  firstName?: string
  lastName?: string
  name?: string
  country?: string
  worldRank?: number | null
}
