'use client'

import { useState } from 'react'
import { createPool } from './actions'

export default function CommissionerPage() {
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTournaments = async () => {
    if (tournaments.length > 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/tournaments')
      const data = await res.json()
      setTournaments(data)
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
              onFocus={fetchTournaments}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select a tournament</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input type="hidden" name="tournamentName" value={tournamentName} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Picks Deadline</label>
            <input
              name="deadline"
              type="datetime-local"
              className="w-full p-2 border rounded"
              required
            />
          </div>
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
