import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusChip } from '@/components/StatusChip'
import { getEntriesForPool, getPoolById, getPoolMembers } from '@/lib/pool-queries'
import { createClient } from '@/lib/supabase/server'
import type { Entry, PoolMember } from '@/lib/supabase/types'
import InviteLinkSection from './InviteLinkSection'
import { ClosePoolButton, StartPoolButton } from './PoolActions'
import { PoolConfigForm } from './PoolConfigForm'
import PoolStatusSection from './PoolStatusSection'

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Entry>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.pool_id === 'string' &&
    typeof candidate.user_id === 'string' &&
    Array.isArray(candidate.golfer_ids) &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  )
}

function formatSubmittedAt(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

function formatMemberLabel(member: PoolMember): string {
  return member.role === 'commissioner' ? `${member.user_id} (commissioner)` : member.user_id
}

export default async function CommissionerPoolDetail({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const pool = await getPoolById(supabase, poolId)

  if (!pool) {
    redirect('/commissioner')
  }

  if (pool.commissioner_id !== user.id) {
    redirect('/commissioner')
  }

  const [members, rawEntries, allGolfers, latestScoreSync] = await Promise.all([
    getPoolMembers(supabase, poolId),
    getEntriesForPool(supabase, poolId),
    supabase.from('golfers').select('id, name'),
    supabase
      .from('tournament_scores')
      .select('updated_at')
      .eq('tournament_id', pool.tournament_id)
      .order('updated_at', { ascending: false })
      .limit(1),
  ])

  const entries = rawEntries.filter(isEntry)
  const golferMap = new Map((allGolfers.data || []).map(golfer => [golfer.id, golfer.name]))

  const playerMembers = members.filter(member => member.role === 'player')
  const submittedUserIds = new Set(entries.map(entry => entry.user_id))
  const pendingMembers = playerMembers.filter(member => !submittedUserIds.has(member.user_id))
  const latestScoreSyncAt = latestScoreSync.data?.[0]?.updated_at ?? null

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{pool.name}</h1>
            <p className="text-gray-500">{pool.tournament_name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={pool.status} />
            {pool.status === 'open' && <StartPoolButton poolId={pool.id} />}
            {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
          </div>
        </div>
      </header>

      <PoolStatusSection
        pool={pool}
        members={members}
        entries={entries}
        latestScoreSyncAt={latestScoreSyncAt}
      />

      <InviteLinkSection inviteCode={pool.invite_code} />

      <PoolConfigForm pool={pool} />

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <h2 className="font-semibold">Entries</h2>
          <Link
            href={`/spectator/pools/${pool.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View spectator page
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Participant</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Picks</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                    No entries submitted yet.
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="border-t align-top">
                    <td className="px-4 py-3 text-sm font-medium">{entry.user_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.golfer_ids.map(golferId => (
                          <span
                            key={golferId}
                            className="inline-flex px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                          >
                            {golferMap.get(golferId) || golferId}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatSubmittedAt(entry.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="font-semibold">Pending Members</h2>
          <span className="text-sm text-gray-500">
            {pendingMembers.length} of {playerMembers.length} pending
          </span>
        </div>

        {pendingMembers.length === 0 ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            Everyone has submitted an entry.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingMembers.map(member => (
              <li key={member.id} className="text-sm text-gray-700 bg-gray-50 border rounded p-2">
                {formatMemberLabel(member)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
