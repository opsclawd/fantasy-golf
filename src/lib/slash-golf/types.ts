export interface Tournament {
  tournId: string
  name: string
  startDate: string
  endDate: string
}

export interface GolferScore {
  golfer_id: string
  hole_scores: (number | null)[]
  thru: number
  total: number
}
