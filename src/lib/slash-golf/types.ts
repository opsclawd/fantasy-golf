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
  status?: 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'
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

export type SlashGolferStatus = 'active' | 'withdrawn' | 'cut' | 'dq' | 'complete'

export interface SlashTournamentMeta {
  tournId: string
  name: string
  year: string
  status: string
  currentRound: number | null
  courses: Array<{ courseId: string; courseName: string }>
  format: string | null
  date: string | null
}

export interface SlashLeaderboard {
  tournId: string
  year: string
  status: string
  roundId: number
  roundStatus: string
  timestamp: string
  leaderboardRows: SlashGolferRow[]
}

export interface SlashGolferRow {
  playerId: string
  lastName: string
  firstName: string
  isAmateur: boolean
  status: SlashGolferStatus
  currentRound: number
  total: string | { $numberInt: string }
  currentRoundScore: string | { $numberInt: string }
  position: string | null
  totalStrokesFromCompletedRounds: string | null
  rounds: SlashRound[]
  thru: string | null
  startingHole: number | null
  currentHole: number | null
  courseId: string | null
  teeTime: string | null
  teeTimeTimestamp: string | null
}

export interface SlashRound {
  roundId: number
  courseId: string
  courseName: string
  strokes: number | { $numberInt: string }
  scoreToPar: number | { $numberInt: string }
}

export interface SlashHole {
  holeId: number
  par: number
  strokes: number
  scoreToPar: number
}

export interface SlashScorecard {
  tournId: string
  playerId: string
  roundId: number
  year: string
  status: SlashGolferStatus
  currentRound: number
  holes: SlashHole[]
}

export interface SlashStats {
  tournId: string
  playerId: string
  worldRank: number | null
  projectedOWGR: number | null
}
