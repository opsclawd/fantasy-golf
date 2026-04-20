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
      <div className="mb-8">
        <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-lg p-6 text-white shadow">
          <h1 className="text-2xl font-bold">Commissioner Dashboard</h1>
          <p className="text-green-100 mt-1 text-sm">Manage your pools and tournaments</p>
        </div>
      </div>

      {activePools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Active pools</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-stone-700">Archived pools</h2>
          <div className="bg-stone-200/50 rounded-lg p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {archivedPools.map(pool => (
              <PoolCard
                key={pool.id}
                pool={pool}
                href={`/commissioner/pools/${pool.id}`}
                className="!border-l-stone-400 !bg-stone-100/50 hover:!bg-stone-100/80 hover:!border-l-stone-500"
              />
            ))}
          </div>
        </div>
      )}

      <CreatePoolForm />
    </div>
  )
}
