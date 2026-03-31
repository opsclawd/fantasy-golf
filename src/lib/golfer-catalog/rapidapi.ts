import 'server-only'

import type { PlayerSearchParams, RapidApiPlayer } from './types'

const BASE_URL = 'https://live-golf-data.p.rapidapi.com'

function buildHeaders(): HeadersInit {
  const apiKey = process.env.SLASH_GOLF_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('SLASH_GOLF_API_KEY is required')
  }

  return {
    'X-RapidAPI-Key': apiKey,
  }
}

function assertSearchParams(params: PlayerSearchParams): void {
  if (!params.firstName?.trim() && !params.lastName?.trim() && !params.playerId?.trim()) {
    throw new Error('Provide firstName, lastName, or playerId')
  }
}

function normalizeSearchParams(params: PlayerSearchParams): PlayerSearchParams {
  return {
    firstName: params.firstName?.trim() || undefined,
    lastName: params.lastName?.trim() || undefined,
    playerId: params.playerId?.trim() || undefined,
  }
}

function isRapidApiPlayer(value: unknown): value is RapidApiPlayer {
  if (!value || typeof value !== 'object') return false

  const player = value as Record<string, unknown>

  return (
    typeof player.playerId === 'string'
    && (player.firstName === undefined || typeof player.firstName === 'string')
    && (player.lastName === undefined || typeof player.lastName === 'string')
    && (player.country === undefined || typeof player.country === 'string')
    && (player.worldRank === undefined || player.worldRank === null || typeof player.worldRank === 'number')
  )
}

async function parsePlayersResponse(response: Response): Promise<RapidApiPlayer[]> {
  const payload: unknown = await response.json()

  if (!Array.isArray(payload) || !payload.every(isRapidApiPlayer)) {
    throw new Error('RapidAPI players response was invalid')
  }

  return payload
}

export async function searchPlayers(params: PlayerSearchParams): Promise<RapidApiPlayer[]> {
  assertSearchParams(params)
  const normalizedParams = normalizeSearchParams(params)

  const search = new URLSearchParams()

  if (normalizedParams.firstName) search.set('firstName', normalizedParams.firstName)
  if (normalizedParams.lastName) search.set('lastName', normalizedParams.lastName)
  if (normalizedParams.playerId) search.set('playerId', normalizedParams.playerId)

  const response = await fetch(`${BASE_URL}/players?${search.toString()}`, {
    headers: buildHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`RapidAPI players lookup failed with ${response.status}`)
  }

  return parsePlayersResponse(response)
}
