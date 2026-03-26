import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CommissionerPoolDetail({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) redirect('/commissioner')

  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
        <span className={`px-3 py-1 rounded ${
          pool.status === 'open' ? 'bg-green-100 text-green-800' :
          pool.status === 'live' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {pool.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{entries?.length || 0}</div>
          <div className="text-gray-500">Entries</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">
            {pool.deadline ? new Date(pool.deadline).toLocaleDateString() : '-'}
          </div>
          <div className="text-gray-500">Deadline</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">-</div>
          <div className="text-gray-500">Sync Status</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Entries</h2>
            <Link 
              href={`/spectator/pools/${poolId}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Spectator Page →
            </Link>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Participant</th>
              <th className="px-4 py-2 text-left">Golfers</th>
              <th className="px-4 py-2 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map(entry => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-2">{entry.user_id.slice(0, 8)}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {entry.golfer_ids.map((id: string) => (
                      <span key={id} className="px-2 py-1 bg-gray-100 rounded text-sm">{id}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
