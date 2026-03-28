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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissioner Dashboard</h1>

      {pools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Pools</h2>
          <div className="grid gap-4">
            {pools.map(pool => (
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
