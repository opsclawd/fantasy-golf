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
  const res = await fetch(`${BASE_URL}/leaderboard?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[slash-golf] tournament score fetch failed', {
      status: res.status,
      statusText: res.statusText,
      body,
    })
    throw new Error('Failed to fetch scores')
  }

  const raw = await res.json()
  const scores = normalizeTournamentScores(raw)

  if (!scores) {
    console.error('[slash-golf] tournament score response was invalid', { raw })
    throw new Error('Tournament scores response was invalid')
  }

  return scores
}

function normalizeTournamentScores(raw: unknown): GolferScore[] | null {
  const records = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { leaderboardRows?: unknown }).leaderboardRows)
      ? (raw as { leaderboardRows: unknown[] }).leaderboardRows
      : Array.isArray((raw as { data?: unknown }).data)
        ? (raw as { data: unknown[] }).data
        : Array.isArray((raw as { scores?: unknown }).scores)
          ? (raw as { scores: unknown[] }).scores
          : Array.isArray((raw as { players?: unknown }).players)
            ? (raw as { players: unknown[] }).players
            : null

  if (!records) {
    return null
  }

  return records.flatMap((record: unknown): GolferScore[] => {
    if (!record || typeof record !== 'object') return []

    const scoreRecord = record as Record<string, unknown>
    const golferId =
      (typeof scoreRecord.playerId === 'string' && scoreRecord.playerId.trim()) ||
      (typeof scoreRecord.id === 'string' && scoreRecord.id.trim()) ||
      (typeof scoreRecord.golfer_id === 'string' && scoreRecord.golfer_id.trim()) ||
      null

    if (!golferId) return []

    // Round-based leaderboard shape.
    if ('leaderboardRows' in (raw as Record<string, unknown>) || 'rounds' in scoreRecord || 'currentRoundScore' in scoreRecord) {
      const roundScore = parseScoreValue(scoreRecord.currentRoundScore)
      const totalScore = parseScoreValue(scoreRecord.total)

      if (roundScore === null && totalScore === null) return []

      return [{
        golfer_id: golferId,
        tournament_id: typeof scoreRecord.tournId === 'string' ? scoreRecord.tournId : '',
        round_id: typeof scoreRecord.currentRound === 'number' ? scoreRecord.currentRound : null,
        round_score: roundScore,
        total_score: totalScore,
        position: typeof scoreRecord.position === 'string' ? scoreRecord.position : null,
        round_status: typeof scoreRecord.roundStatus === 'string' ? scoreRecord.roundStatus : null,
        current_hole: parseHoleValue(scoreRecord.currentHole),
        tee_time: typeof scoreRecord.teeTime === 'string' ? scoreRecord.teeTime : null,
        updated_at: typeof scoreRecord.timestamp === 'string' ? scoreRecord.timestamp : null,
        total_birdies: 0,
        status: normalizeGolferStatus(scoreRecord.status),
      }]
    }

    // Legacy hole-based fallback.
    const holeScores = Array.isArray(scoreRecord.hole_scores)
      ? scoreRecord.hole_scores
      : Array.isArray(scoreRecord.scorecard)
        ? scoreRecord.scorecard
        : null

    if (!holeScores) return []

    return [{
      golfer_id: golferId,
      tournament_id: typeof scoreRecord.tournament_id === 'string' ? scoreRecord.tournament_id : '',
      hole_scores: holeScores.map((score) => (typeof score === 'number' ? score : null)),
      thru: parseThruValue(scoreRecord.thru),
      total: parseScoreValue(scoreRecord.total) ?? 0,
      total_birdies: typeof scoreRecord.total_birdies === 'number' ? scoreRecord.total_birdies : 0,
      status: normalizeGolferStatus(scoreRecord.status),
    }]
  })
}

function parseScoreValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  if (!normalized || normalized === '-') return null

  const parsed = Number(normalized.replace(/\*$/, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseHoleValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const parsed = Number(value.replace(/\*$/, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeGolferStatus(value: unknown): 'active' | 'withdrawn' | 'cut' {
  if (value === 'withdrawn' || value === 'cut') return value
  return 'active'
}

function parseThruValue(value: unknown): number {
  if (typeof value !== 'string') return 0

  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized === '-') return 0
  if (normalized.startsWith('F')) return 18

  const parsed = Number(normalized.replace(/\*$/, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getGolfers(tournamentId: string, year?: number): Promise<Array<{ id: string; name: string; country: string }>> {
  const params = new URLSearchParams({ orgId: '1', tournId: tournamentId, ...(year && { year: year.toString() }) })
  const res = await fetch(`${BASE_URL}/tournament?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store'
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
