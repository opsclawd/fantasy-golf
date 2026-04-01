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
  const raw = await res.json()
  const players = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { players?: unknown }).players)
      ? (raw as { players: unknown[] }).players
      : null

  if (!players) {
    throw new Error('Tournament golfers response was invalid')
  }

  return players.flatMap((golfer: unknown) => {
    if (!golfer || typeof golfer !== 'object') return []
    const golferRecord = golfer as Record<string, unknown>

    const idValue = typeof golferRecord.playerId === 'string'
      ? golferRecord.playerId
      : typeof golferRecord.id === 'string'
        ? golferRecord.id
        : null
    const id = idValue?.trim()
    const firstName = typeof golferRecord.firstName === 'string' ? golferRecord.firstName : ''
    const lastName = typeof golferRecord.lastName === 'string' ? golferRecord.lastName : ''
    const nameValue = typeof golferRecord.name === 'string'
      ? golferRecord.name
      : [firstName, lastName].filter(Boolean).join(' ').trim()
    const name = nameValue.trim().replace(/\s+/g, ' ')
    const country = typeof golferRecord.country === 'string' ? golferRecord.country.trim() : ''

    if (!id || !name) return []

    return [{ id, name, country }]
  })
}
