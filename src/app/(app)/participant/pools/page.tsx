import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ParticipantPools() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: entries } = await supabase
    .from('entries')
    .select('pool_id, pools(*)')
    .eq('user_id', user!.id)

  const pools = entries?.map(e => e.pools).filter(Boolean) || []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Pools</h1>
      {pools.length === 0 ? (
        <p className="text-gray-500">You haven&apos;t joined any pools yet. Ask your commissioner for a link.</p>
      ) : (
        <div className="grid gap-4">
          {pools.map((pool: any) => (
            <Link key={pool.id} href={`/participant/picks/${pool.id}`}>
              <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
                <h3 className="font-semibold">{pool.name}</h3>
                <p className="text-gray-500">{pool.tournament_name}</p>
                <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                  pool.status === 'open' ? 'bg-green-100 text-green-800' :
                  pool.status === 'live' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {pool.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
