import type { Tournament, GolferScore } from './types'

const BASE_URL = 'https://live-golf-data.p.rapidapi.com'

export async function getTournaments(year?: number): Promise<Tournament[]> {
  const params = new URLSearchParams({ orgId: '1', ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/schedule?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch tournaments')
  return res.json()
}

export async function getTournamentScores(tournamentId: string, year?: number): Promise<GolferScore[]> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/tournament?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to fetch scores')
  return res.json()
}

export async function getGolfers(tournamentId: string, year?: number): Promise<{ id: string; name: string; country: string }[]> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/tournament?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch golfers')
  return res.json()
}
