'use client'

import { useState, useEffect } from 'react'
import { useFormState } from 'react-dom'
import { createPool, type CreatePoolState } from './actions'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

const CACHE_KEY = 'tournament_schedule_cache'

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

export function CreatePoolForm() {
  const currentYear = new Date().getFullYear().toString()
  const [state, formAction] = useFormState<CreatePoolState, FormData>(createPool, null)
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [picksPerEntry, setPicksPerEntry] = useState('4')
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [availableTournaments, setAvailableTournaments] = useState<TournamentOption[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)

  useEffect(() => {
    const cached = getCachedTournaments(currentYear)
    if (cached) {
      setTournaments(cached)
      setAvailableTournaments(filterUpcoming(cached))
    } else {
      fetchTournaments()
    }
  }, [currentYear])

  const filterUpcoming = (tourns: TournamentOption[]) => {
    const now = new Date()
    return tourns.filter(t => new Date(t.startDate) > now)
  }

  const fetchTournaments = async () => {
    setLoadingTournaments(true)
    try {
      const res = await fetch(`/api/tournaments?year=${currentYear}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const mapped = data.map((t: any) => ({
          id: t.tournId,
          name: t.name,
          startDate: t.date?.start?.$date?.$numberLong
            ? new Date(parseInt(t.date.start.$date.$numberLong)).toISOString().slice(0, 16)
            : ''
        }))
        setTournaments(mapped)
        setCachedTournaments(currentYear, mapped)
        setAvailableTournaments(filterUpcoming(mapped))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTournaments(false)
    }
  }

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
          <input type="hidden" name="tournamentName" value={tournamentName} />
          <input type="hidden" name="year" value={currentYear} />
        </div>

        {deadline && (
          <div>
            <label className="block text-sm font-medium mb-1">Picks Deadline</label>
            <div className="p-2 border rounded bg-gray-50 text-gray-700">
              {new Date(deadline).toLocaleString()}
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

        <button
          type="submit"
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          Create Pool
        </button>
      </form>
    </div>
  )
}
