import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'
import { StatusChip } from '@/components/StatusChip'
import { TrustStatusBar } from '@/components/TrustStatusBar'
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{pool.name}</h1>
              <p className="text-gray-500">{pool.tournament_name}</p>
            </div>
            <StatusChip status={pool.status} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {(pool.status === 'live' || pool.status === 'complete') && (
          <TrustStatusBar
            className="mb-6"
            isLocked={true}
            poolStatus={pool.status}
            freshness={classifyFreshness(pool.refreshed_at)}
            refreshedAt={pool.refreshed_at}
            lastRefreshError={pool.last_refresh_error}
          />
        )}
        <Leaderboard poolId={poolId} />
      </main>
    </div>
  )
}
