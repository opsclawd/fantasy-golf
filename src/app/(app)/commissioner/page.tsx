'use client'

import { useState, useEffect } from 'react'
import { createPool } from './actions'

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

export default function CommissionerPage() {
  const currentYear = new Date().getFullYear().toString()
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [year] = useState(currentYear)
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [availableTournaments, setAvailableTournaments] = useState<TournamentOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cached = getCachedTournaments(currentYear)
    if (cached) {
      setTournaments(cached)
      setAvailableTournaments(filterUpcoming(cached))
    } else {
      fetchTournaments()
    }
  }, [])

  const filterUpcoming = (tourns: TournamentOption[]) => {
    const now = new Date()
    return tourns.filter(t => new Date(t.startDate) > now)
  }

  const fetchTournaments = async () => {
    setLoading(true)
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
      setLoading(false)
    }
  }

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    setTournamentId(selectedId)
    const selected = tournaments.find(t => t.id === selectedId)
    setTournamentName(selected?.name || '')
    setDeadline(selected?.startDate || '')
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      await createPool(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissioner Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Create New Pool</h2>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pool Name</label>
            <input
              name="poolName"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Masters Pool 2026"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tournament</label>
            <select
              name="tournamentId"
              value={tournamentId}
              onChange={handleTournamentChange}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select a tournament</option>
              {availableTournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input type="hidden" name="tournamentName" value={tournamentName} />
            <input type="hidden" name="year" value={year} />
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
          <button
            type="submit"
            disabled={loading}
            className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Pool...' : 'Create Pool'}
          </button>
        </form>
      </div>
    </div>
  )
}
