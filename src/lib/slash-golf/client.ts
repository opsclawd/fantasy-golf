import type { Tournament, GolferScore } from './types'

const BASE_URL = 'https://api.slash-golf.com'

export async function getTournaments(): Promise<Tournament[]> {
  const res = await fetch(`${BASE_URL}/tournaments`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch tournaments')
  return res.json()
}

export async function getTournamentScores(tournamentId: string): Promise<GolferScore[]> {
  const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/scores`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to fetch scores')
  return res.json()
}

export async function getGolfers(tournamentId: string): Promise<{ id: string; name: string; country: string }[]> {
  const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/golfers`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch golfers')
  return res.json()
}
