'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScoreDisplay } from './score-display'

interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

interface LeaderboardProps {
  poolId: string
}

type ScoreBroadcastPayload = {
  payload: {
    ranked?: RankedEntry[]
    completedHoles?: number
    updatedAt?: string
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function Leaderboard({ poolId }: LeaderboardProps) {
  const [entries, setEntries] = useState<RankedEntry[]>([])
  const [completedHoles, setCompletedHoles] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboard()

    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload: unknown) => {
        if (!isObject(payload) || !isObject(payload.payload)) {
          return
        }

        const typedPayload = payload as ScoreBroadcastPayload
        if (!Array.isArray(typedPayload.payload.ranked)) {
          return
        }

        setEntries(typedPayload.payload.ranked)
        setCompletedHoles(typedPayload.payload.completedHoles ?? 0)
        setUpdatedAt(typedPayload.payload.updatedAt ?? null)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [poolId])

  const fetchLeaderboard = async () => {
    const res = await fetch(`/api/leaderboard/${poolId}`)
    const data = await res.json()
    if (data.entries) {
      setEntries(data.entries)
      setCompletedHoles(data.completedHoles)
      setUpdatedAt(data.updatedAt)
    }
    setLoading(false)
  }

  if (loading) return <div>Loading leaderboard...</div>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <div className="text-sm text-gray-500">
          {updatedAt && `Updated ${new Date(updatedAt).toLocaleTimeString()}`}
          {completedHoles > 0 && ` • Thru ${completedHoles} holes`}
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Rank</th>
            <th className="px-4 py-2 text-left">Entry</th>
            <th className="px-4 py-2 text-right">Score</th>
            <th className="px-4 py-2 text-right">Birdies</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t">
              <td className="px-4 py-2">
                <span className={`inline-block w-6 h-6 text-center rounded ${
                  entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                  entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                  entry.rank === 3 ? 'bg-orange-100 text-orange-800' : ''
                }`}>
                  {entry.rank}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="text-sm text-gray-500">{entry.user_id.slice(0, 8)}</div>
              </td>
              <td className="px-4 py-2 text-right font-mono">
                <ScoreDisplay score={entry.totalScore} />
              </td>
              <td className="px-4 py-2 text-right">{entry.totalBirdies}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No entries yet
        </div>
      )}
    </div>
  )
}
