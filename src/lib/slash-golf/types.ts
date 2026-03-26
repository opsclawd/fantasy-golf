export interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
}

export interface GolferScore {
  golfer_id: string
  hole_scores: (number | null)[]
  thru: number
  total: number
}
