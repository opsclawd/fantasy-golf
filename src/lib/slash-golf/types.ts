export interface Tournament {
  tournId: string
  name: string
  startDate: string
  endDate: string
}

export interface GolferScoreRound {
  round_id: number
  strokes: number | null
  score_to_par: number | null
  course_id: string | null
  course_name: string | null
}

export interface GolferScore {
  golfer_id: string
  tournament_id?: string
  round_id?: number | null
  strokes?: number | null
  score_to_par?: number | null
  course_id?: string | null
  course_name?: string | null
  total_score?: number | null
  total_strokes_from_completed_rounds?: number | null
  position?: string | null
  current_hole?: number | null
  thru?: number | null
  starting_hole?: number | null
  current_round?: number | null
  current_round_score?: number | null
  tee_time?: string | null
  tee_time_timestamp?: string | null
  is_amateur?: boolean | null
  updated_at?: string | null
  rounds?: GolferScoreRound[]
  total?: number | null
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
