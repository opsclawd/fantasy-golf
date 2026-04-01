export type TournamentRosterSource = 'refresh' | 'manual_add' | 'seeded'

export type TournamentRosterGolferInput = {
  id: string
  playerId?: string
  firstName?: string
  lastName?: string
  name?: string
  country?: string
  worldRank?: number | null
}
