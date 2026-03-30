import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'
import { StatusChip } from '@/components/StatusChip'
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { pageShellClasses, sectionHeadingClasses } from '@/components/uiStyles'
import { classifyFreshness } from '@/lib/freshness'
import { getPoolById } from '@/lib/pool-queries'
import { notFound } from 'next/navigation'

export default async function SpectatorPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()

  const pool = await getPoolById(supabase, poolId)

  if (!pool) {
    notFound()
  }

  return (
    <div className={pageShellClasses()}>
      <header className="border-b border-white/50 bg-white/55 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={sectionHeadingClasses()}>Spectator view</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {pool.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">{pool.tournament_name}</p>
            </div>
            <StatusChip status={pool.status} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {(pool.status === 'live' || pool.status === 'complete') && (
          <TrustStatusBar
            className="border"
            isLocked={true}
            poolStatus={pool.status}
            freshness={classifyFreshness(pool.refreshed_at)}
            refreshedAt={pool.refreshed_at}
            lastRefreshError={pool.last_refresh_error}
          />
        )}
        <Leaderboard poolId={poolId} hideTrustStatusHeader={true} />
      </main>
    </div>
  )
}
