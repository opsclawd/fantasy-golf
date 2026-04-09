import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolsByCommissioner } from '@/lib/pool-queries'
import { PoolCard } from '@/components/PoolCard'
import { CreatePoolForm } from './CreatePoolForm'

export default async function CommissionerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pools = await getPoolsByCommissioner(supabase, user.id)

  const activePools = pools.filter((pool) => pool.status !== 'archived')
  const archivedPools = pools.filter((pool) => pool.status === 'archived')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissioner Dashboard</h1>

      {activePools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Active pools</h2>
          <div className="grid gap-4">
            {activePools.map(pool => (
              <PoolCard
                key={pool.id}
                pool={pool}
                href={`/commissioner/pools/${pool.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {archivedPools.length > 0 && (
        <div className="mb-8 opacity-75">
          <h2 className="text-lg font-semibold mb-4">Archived pools</h2>
          <div className="grid gap-4">
            {archivedPools.map(pool => (
              <PoolCard
                key={pool.id}
                pool={pool}
                href={`/commissioner/pools/${pool.id}`}
              />
            ))}
          </div>
        </div>
      )}

      <CreatePoolForm />
    </div>
  )
}
