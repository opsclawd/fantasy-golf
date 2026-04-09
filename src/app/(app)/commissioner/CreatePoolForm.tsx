'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createPool, type CreatePoolState } from './actions'
import { getTournamentLockInstant } from '@/lib/picks'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

interface TimezoneOption {
  value: string
  label: string
}

const CACHE_KEY = 'tournament_schedule_cache'
const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
]

function formatDeadline(deadline: string, timeZone: string) {
  const deadlineInstant = getTournamentLockInstant(deadline, timeZone)
  if (!deadlineInstant) {
    return 'Deadline not available'
  }

  return deadlineInstant.toLocaleString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function getCachedTournaments(year: string): TournamentOption[] | null {
  if (typeof window === 'undefined') return null
  const cached = localStorage.getItem(`${CACHE_KEY}_${year}`)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      return null
    }
  }
  return null
}

function setCachedTournaments(year: string, tournaments: TournamentOption[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${CACHE_KEY}_${year}`, JSON.stringify(tournaments))
}

function filterUpcoming(tournaments: TournamentOption[]) {
  const now = new Date()
  return tournaments.filter(t => new Date(t.startDate) > now)
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {pending ? 'Creating Pool...' : 'Create Pool'}
    </button>
  )
}

export function CreatePoolForm() {
  const currentYear = new Date().getFullYear().toString()
  const [state, formAction] = useFormState<CreatePoolState, FormData>(createPool, null)
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [picksPerEntry, setPicksPerEntry] = useState('4')
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [availableTournaments, setAvailableTournaments] = useState<TournamentOption[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)
  const [tournamentError, setTournamentError] = useState('')

  const fetchTournaments = useCallback(async () => {
    setLoadingTournaments(true)
    try {
      const res = await fetch(`/api/tournaments?year=${currentYear}`)
      if (!res.ok) {
        setTournamentError('Unable to load tournaments right now. Please try again.')
        return
      }

      const data = await res.json()
      if (!Array.isArray(data)) {
        setTournamentError('Received invalid tournament data. Please refresh and try again.')
        return
      }

      const mapped = data.map((t: any) => ({
        id: typeof t.tournId === 'string' ? t.tournId : '',
        name: typeof t.name === 'string' ? t.name : '',
        startDate: t.date?.start?.$date?.$numberLong
          ? new Date(parseInt(t.date.start.$date.$numberLong, 10)).toISOString().slice(0, 16)
          : ''
      }))

      const hasInvalidTournament = mapped.some(t => !t.id || !t.name)
      if (hasInvalidTournament) {
        setTournamentError('Received invalid tournament data. Please refresh and try again.')
        return
      }

      setTournamentError('')
      setTournaments(mapped)
      setCachedTournaments(currentYear, mapped)
      setAvailableTournaments(filterUpcoming(mapped))
    } catch (err) {
      console.error(err)
      setTournamentError('Unable to load tournaments right now. Please try again.')
    } finally {
      setLoadingTournaments(false)
    }
  }, [currentYear])

  useEffect(() => {
    const cached = getCachedTournaments(currentYear)
    if (cached) {
      setTournaments(cached)
      setAvailableTournaments(filterUpcoming(cached))
      setTournamentError('')
      return
    }

    void fetchTournaments()
  }, [currentYear, fetchTournaments])

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    setTournamentId(selectedId)
    const selected = tournaments.find(t => t.id === selectedId)
    setTournamentName(selected?.name || '')
    setDeadline(selected?.startDate || '')
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Create New Pool</h2>

      {state?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="poolName" className="block text-sm font-medium mb-1">Pool Name</label>
          <input
            id="poolName"
            name="poolName"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Masters Pool 2026"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="tournamentId" className="block text-sm font-medium mb-1">Tournament</label>
          <select
            id="tournamentId"
            name="tournamentId"
            value={tournamentId}
            onChange={handleTournamentChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
            disabled={loadingTournaments}
          >
            <option value="">
              {loadingTournaments ? 'Loading tournaments...' : 'Select a tournament'}
            </option>
            {availableTournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {tournamentError && (
            <p className="mt-2 text-sm text-red-700" role="alert">{tournamentError}</p>
          )}
          <input type="hidden" name="tournamentName" value={tournamentName} />
          <input type="hidden" name="year" value={currentYear} />
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm font-medium mb-1">Timezone</label>
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          >
            {TIMEZONE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {deadline && (
          <div>
            <label className="block text-sm font-medium mb-1">Picks Deadline</label>
            <div className="p-2 border rounded bg-gray-50 text-gray-700">
              {formatDeadline(deadline, timezone)}
            </div>
            <input type="hidden" name="deadline" value={deadline} />
          </div>
        )}

        <div>
          <label htmlFor="picksPerEntry" className="block text-sm font-medium mb-1">
            Picks Per Entry
          </label>
          <select
            id="picksPerEntry"
            name="picksPerEntry"
            value={picksPerEntry}
            onChange={(e) => setPicksPerEntry(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n} golfer{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <input type="hidden" name="format" value="best_ball" />

        <SubmitButton />
      </form>
    </div>
  )
}
