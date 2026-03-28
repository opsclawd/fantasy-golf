'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updatePoolConfigAction, type UpdatePoolConfigState } from './actions'
import type { Pool } from '@/lib/supabase/types'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

const CACHE_KEY = 'tournament_schedule_cache'

function getCachedTournaments(year: string): TournamentOption[] | null {
  if (typeof window === 'undefined') return null

  const cached = localStorage.getItem(`${CACHE_KEY}_${year}`)
  if (!cached) return null

  try {
    const parsed = JSON.parse(cached)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setCachedTournaments(year: string, tournaments: TournamentOption[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${CACHE_KEY}_${year}`, JSON.stringify(tournaments))
}

function getTournamentById(tournaments: TournamentOption[], tournamentId: string): TournamentOption | null {
  return tournaments.find(t => t.id === tournamentId) ?? null
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Configuration'}
    </button>
  )
}

export function PoolConfigForm({ pool }: { pool: Pool }) {
  const [state, formAction] = useFormState<UpdatePoolConfigState, FormData>(updatePoolConfigAction, null)
  const [isEditing, setIsEditing] = useState(false)
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false)
  const [tournamentError, setTournamentError] = useState('')
  const [selectedTournamentId, setSelectedTournamentId] = useState(pool.tournament_id)
  const [selectedTournamentName, setSelectedTournamentName] = useState(pool.tournament_name)
  const [selectedDeadline, setSelectedDeadline] = useState(pool.deadline)
  const [picksPerEntry, setPicksPerEntry] = useState(String(pool.picks_per_entry))

  const isEditable = pool.status === 'open'
  const year = String(pool.year)

  const loadTournaments = async () => {
    const cached = getCachedTournaments(year)
    if (cached) {
      setTournaments(cached)
      setTournamentError('')
      return
    }

    setIsLoadingTournaments(true)
    try {
      const response = await fetch(`/api/tournaments?year=${year}`)
      if (!response.ok) {
        setTournamentError('Unable to load tournaments right now. Please try again.')
        return
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        setTournamentError('Received invalid tournament data. Please refresh and try again.')
        return
      }

      const mapped: TournamentOption[] = data
        .map((t: any) => ({
          id: typeof t.tournId === 'string' ? t.tournId : '',
          name: typeof t.name === 'string' ? t.name : '',
          startDate: t.date?.start?.$date?.$numberLong
            ? new Date(Number.parseInt(t.date.start.$date.$numberLong, 10)).toISOString().slice(0, 16)
            : '',
        }))
        .filter((t: TournamentOption) => Boolean(t.id && t.name && t.startDate))

      setTournaments(mapped)
      setCachedTournaments(year, mapped)
      setTournamentError('')
    } catch (error) {
      console.error(error)
      setTournamentError('Unable to load tournaments right now. Please try again.')
    } finally {
      setIsLoadingTournaments(false)
    }
  }

  useEffect(() => {
    if (isEditing && isEditable) {
      void loadTournaments()
    }
  }, [isEditing, isEditable])

  const canSubmit = useMemo(() => {
    if (!isEditable || !isEditing) return false
    if (!selectedTournamentId) return false
    return true
  }, [isEditable, isEditing, selectedTournamentId])

  const handleTournamentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTournamentId = event.target.value
    setSelectedTournamentId(nextTournamentId)

    const selectedTournament = getTournamentById(tournaments, nextTournamentId)
    setSelectedTournamentName(selectedTournament?.name ?? '')
    setSelectedDeadline(selectedTournament?.startDate ?? '')
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Pool Configuration</h2>
        <button
          type="button"
          onClick={() => setIsEditing(prev => !prev)}
          disabled={!isEditable}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!isEditable && (
        <p className="text-sm text-gray-600 mb-3">
          Configuration is locked because this pool is not open.
        </p>
      )}

      {state?.error && (
        <p className="mb-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {isEditing ? (
        <form action={formAction} className="space-y-3">
          <div>
            <label htmlFor="tournamentId" className="block text-sm font-medium mb-1">
              Tournament
            </label>
            <select
              id="tournamentId"
              name="tournamentId"
              value={selectedTournamentId}
              onChange={handleTournamentChange}
              className="w-full p-2 border rounded"
              disabled={isLoadingTournaments}
              required
            >
              <option value="">
                {isLoadingTournaments ? 'Loading tournaments...' : 'Select a tournament'}
              </option>
              {tournaments.map(tournament => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
            {tournamentError && <p className="mt-1 text-sm text-red-700">{tournamentError}</p>}
          </div>

          <div>
            <label htmlFor="picksPerEntry" className="block text-sm font-medium mb-1">
              Picks Per Entry
            </label>
            <select
              id="picksPerEntry"
              name="picksPerEntry"
              value={picksPerEntry}
              onChange={(event) => setPicksPerEntry(event.target.value)}
              className="w-full p-2 border rounded"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
                <option key={value} value={value}>
                  {value} golfer{value === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>

          <input type="hidden" name="poolId" value={pool.id} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="tournamentName" value={selectedTournamentName} />
          <input type="hidden" name="deadline" value={selectedDeadline} />
          <input type="hidden" name="format" value={pool.format} />

          <SaveButton disabled={!canSubmit} />
        </form>
      ) : (
        <dl className="text-sm space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Tournament</dt>
            <dd>{pool.tournament_name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Picks Per Entry</dt>
            <dd>{pool.picks_per_entry}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
