import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, getPoolMembers, getEntriesForPool } from '@/lib/pool-queries'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { StatusChip } from '@/components/StatusChip'
import { FreshnessChip } from '@/components/FreshnessChip'
import { CommissionerGolferPanel } from '@/components/CommissionerGolferPanel'
import { classifyFreshness } from '@/lib/freshness'
import { StartPoolButton, ClosePoolButton } from './PoolActions'
import { ReusePoolButton } from './ReusePoolButton'
import InviteLinkSection from './InviteLinkSection'
import { PoolConfigForm } from './PoolConfigForm'
import { PoolStatusSection } from './PoolStatusSection'
import Link from 'next/link'
import type { TournamentScore, Golfer, Entry } from '@/lib/supabase/types'

type PoolEntry = {
  id: string
  user_id: string
  golfer_ids: string[]
  created_at: string
}

export default async function CommissionerPoolDetail({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')

  // Commissioner ownership check
  if (pool.commissioner_id !== user.id) {
    redirect('/commissioner')
  }

  const members = await getPoolMembers(supabase, poolId)
  const entries = await getEntriesForPool(supabase, poolId)
  const normalizedEntries: PoolEntry[] = entries.flatMap(entry => {
    if (typeof entry !== 'object' || entry === null) return []

    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.user_id !== 'string' ||
      typeof candidate.created_at !== 'string'
    ) {
      return []
    }

    return [
      {
        id: candidate.id,
        user_id: candidate.user_id,
        created_at: candidate.created_at,
        golfer_ids: Array.isArray(candidate.golfer_ids)
          ? candidate.golfer_ids.filter((id): id is string => typeof id === 'string')
          : [],
      },
    ]
  })

  const { data: allGolfers } = await supabase.from('golfers').select('*')
  const golferMap = new Map(allGolfers?.map(g => [g.id, g.name]) || [])

  const showGolferPanel = pool.status === 'live' || pool.status === 'complete'

  let golferScoresRecord: Record<string, TournamentScore> = {}
  let allGolfersList: Golfer[] = []
  let typedEntries: Entry[] = []

  if (showGolferPanel) {
    const scores = await getScoresForTournament(supabase, pool.tournament_id)
    golferScoresRecord = Object.fromEntries(scores.map(s => [s.golfer_id, s]))
    allGolfersList = (allGolfers as Golfer[]) || []
    typedEntries = normalizedEntries.map(e => ({
      id: e.id,
      pool_id: poolId,
      user_id: e.user_id,
      golfer_ids: e.golfer_ids,
      total_birdies: 0,
      created_at: e.created_at,
      updated_at: e.created_at,
    }))
  }

  const playersWithEntries = new Set(normalizedEntries.map(e => e.user_id))
  const playerMembers = members.filter(m => m.role === 'player')
  const membersWithoutEntries = playerMembers.filter(m => !playersWithEntries.has(m.user_id))

  const parsedDeadline = typeof pool.deadline === 'string' ? new Date(pool.deadline) : null
  const isInvalidDeadline = !parsedDeadline || Number.isNaN(parsedDeadline.getTime())
  const isDeadlineLocked = isInvalidDeadline || parsedDeadline <= new Date()
  const isLocked = pool.status !== 'open' || isDeadlineLocked

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip status={pool.status} />
          {pool.status === 'open' && <StartPoolButton poolId={pool.id} />}
          {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
          {pool.status === 'complete' && <ReusePoolButton poolId={pool.id} />}
        </div>
      </div>

      {/* Pool Status Summary */}
      <PoolStatusSection
        pool={pool}
        memberCount={playerMembers.length}
        entryCount={normalizedEntries.length}
        isLocked={isLocked}
        pendingCount={membersWithoutEntries.length}
      />

      {/* Scoring Refresh Status (only for live/complete pools) */}
      {pool.status !== 'open' && (
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-700">Scoring Status</h3>
            <FreshnessChip
              status={classifyFreshness(pool.refreshed_at)}
              refreshedAt={pool.refreshed_at}
            />
          </div>
          {pool.last_refresh_error && (
            <div
              className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 rounded-lg p-3"
              role="alert"
            >
              <span aria-hidden="true">{'\u26A0'}</span>
              <span>Last refresh error: {pool.last_refresh_error}</span>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <Link
              href={`/commissioner/pools/${poolId}/audit`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View Audit Log
            </Link>
          </div>
        </div>
      )}

      {/* Invite Link */}
      <InviteLinkSection inviteCode={pool.invite_code} />

      {/* Tournament & Format Config (editable only while open) */}
      <PoolConfigForm pool={pool} />

      {/* Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Entries ({normalizedEntries.length})</h2>
            <Link href={`/spectator/pools/${poolId}`} className="text-blue-600 hover:text-blue-800 text-sm">
              View Leaderboard
            </Link>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm">Participant</th>
              <th className="px-4 py-2 text-left text-sm">Golfers</th>
              <th className="px-4 py-2 text-right text-sm">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {normalizedEntries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No entries yet. Share the invite link to get started.
                </td>
              </tr>
            ) : (
              normalizedEntries.map(entry => (
                <tr key={entry.id} className="border-t">
                  <td className="px-4 py-2 text-sm">{entry.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {entry.golfer_ids.map((id: string) => (
                        <span key={id} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {golferMap.get(id) || id}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 text-sm">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Golfer Overview (live/complete pools only) */}
      {showGolferPanel && (
        <CommissionerGolferPanel
          golfers={allGolfersList}
          golferScoresRecord={golferScoresRecord}
          entries={typedEntries}
        />
      )}

      {/* Pending Members */}
      {membersWithoutEntries.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Waiting for Entries ({membersWithoutEntries.length})</h3>
          <p className="text-sm text-gray-500">These players have joined but haven&apos;t submitted picks yet.</p>
          <ul className="mt-2 space-y-1">
            {membersWithoutEntries.map(m => (
              <li key={m.id} className="text-sm text-gray-600">
                {m.user_id.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
