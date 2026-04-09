import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, getPoolMembers, getEntriesForPool } from '@/lib/pool-queries'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { StatusChip } from '@/components/StatusChip'
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { CommissionerGolferPanel } from '@/components/CommissionerGolferPanel'
import { GolferCatalogPanel } from '@/components/GolferCatalogPanel'
import { classifyFreshness } from '@/lib/freshness'
import { isCommissionerPoolLocked } from '@/lib/picks'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'
import { StartPoolButton, ClosePoolButton } from './PoolActions'
import { ReusePoolButton } from './ReusePoolButton'
import InviteLinkSection from './InviteLinkSection'
import { PoolConfigForm } from './PoolConfigForm'
import { PoolStatusSection } from './PoolStatusSection'
import { loadGolferCatalogPanelState } from './golferCatalogPanelState'
import Link from 'next/link'
import type { TournamentScore, Golfer, Entry } from '@/lib/supabase/types'
import { panelClasses, scrollRegionFocusClasses, sectionHeadingClasses } from '@/components/uiStyles'
import type { TournamentRosterGolfer } from '@/lib/tournament-roster/queries'

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

  let rosterGolfers: TournamentRosterGolfer[] = []
  try {
    rosterGolfers = await getTournamentRosterGolfers(supabase, pool.tournament_id)
  } catch {
    rosterGolfers = []
  }
  const golferMap = new Map(rosterGolfers.map(g => [g.id, g.name]))

  const showGolferPanel = pool.status === 'live' || pool.status === 'complete'

  let golferScoresRecord: Record<string, TournamentScore> = {}
  let typedEntries: Entry[] = []

  if (showGolferPanel) {
    const scores = await getScoresForTournament(supabase, pool.tournament_id)
    golferScoresRecord = Object.fromEntries(scores.map(s => [s.golfer_id, s]))
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

  const isLocked = isCommissionerPoolLocked(pool.status, pool.deadline, pool.timezone)
  const { latestRun, usage } = await loadGolferCatalogPanelState(supabase)
  const rosterCount = rosterGolfers.length

  return (
    <div className="space-y-6">
      <section className={`${panelClasses()} p-6`}>
        <p className={sectionHeadingClasses()}>Commissioner command center</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">{pool.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{pool.tournament_name}</p>
          </div>
          <div className="flex flex-wrap gap-3 max-sm:w-full">
            <StatusChip status={pool.status} />
            {pool.status === 'open' && <StartPoolButton poolId={pool.id} />}
            {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
            {pool.status === 'complete' && <ReusePoolButton poolId={pool.id} />}
          </div>
        </div>
      </section>

      <PoolStatusSection
        pool={pool}
        memberCount={playerMembers.length}
        entryCount={normalizedEntries.length}
        isLocked={isLocked}
        pendingCount={membersWithoutEntries.length}
      />

      {pool.status !== 'open' && (
        <section className={`${panelClasses()} p-4`}>
          <TrustStatusBar
            isLocked={true}
            poolStatus={pool.status}
            freshness={classifyFreshness(pool.refreshed_at)}
            refreshedAt={pool.refreshed_at}
            lastRefreshError={pool.last_refresh_error}
          />
        </section>
      )}

      <section className={`${panelClasses()} p-4`}>
        <Link
          href={`/commissioner/pools/${poolId}/audit`}
          className="inline-flex items-center text-sm font-medium text-emerald-700 transition hover:text-emerald-900"
        >
          View Audit Log
        </Link>
      </section>

      <InviteLinkSection inviteCode={pool.invite_code} />
      <PoolConfigForm pool={pool} />
      <GolferCatalogPanel poolId={poolId} usage={usage} latestRun={latestRun} rosterCount={rosterCount} />

      <section className={`${panelClasses()} overflow-hidden`}>
        <div className="border-b border-slate-200/80 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={sectionHeadingClasses()}>Entry progress</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Entries ({normalizedEntries.length})</h2>
            </div>
            <Link href={`/spectator/pools/${poolId}`} className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900">
              View Leaderboard
            </Link>
          </div>
        </div>
        <div
          className={`overflow-x-auto px-1 pb-1 ${scrollRegionFocusClasses()}`}
          tabIndex={0}
          aria-label="Participant entries"
        >
          <table className="min-w-[42rem] w-full">
            <caption className="sr-only">Submitted pool entries and their golfer selections</caption>
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Golfers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {normalizedEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-500">
                    No entries yet. Share the invite link to get started.
                  </td>
                </tr>
              ) : (
                normalizedEntries.map(entry => (
                  <tr key={entry.id} className="border-t border-slate-200/70 align-top">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{entry.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {entry.golfer_ids.map((id: string) => (
                          <span key={id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                            {golferMap.get(id) || id}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showGolferPanel && (
        <CommissionerGolferPanel
          golfers={rosterGolfers}
          golferScoresRecord={golferScoresRecord}
          entries={typedEntries}
        />
      )}

      {membersWithoutEntries.length > 0 && (
        <section className={`${panelClasses()} p-5`}>
          <p className={sectionHeadingClasses()}>Follow up</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            Waiting for entries ({membersWithoutEntries.length})
          </h3>
          <p className="mt-1 text-sm text-slate-500">These players have joined but haven&apos;t submitted picks yet.</p>
          <ul className="mt-4 space-y-2">
            {membersWithoutEntries.map(m => (
              <li key={m.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {m.user_id.slice(0, 8)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
