import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GolferPicker } from '@/components/golfer-picker'
import { submitPicks } from './actions'

export default async function PicksPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).single()
  if (!pool) redirect('/participant/pools')

  const { data: existingEntry } = await supabase
    .from('entries')
    .select('golfer_ids')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .single()

  const isEditable = pool.status === 'open' && new Date(pool.deadline) > new Date()

  let golferNames: Record<string, string> = {}
  if (!isEditable && existingEntry?.golfer_ids && existingEntry.golfer_ids.length > 0) {
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, name')
      .in('id', existingEntry.golfer_ids)
    
    if (golfers) {
      golferNames = Object.fromEntries(golfers.map(g => [g.id, g.name]))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{pool.name}</h1>
      <p className="text-gray-500 mb-6">{pool.tournament_name}</p>
      
      {pool.status === 'live' && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
          Pool is live. Picks are locked.
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Select Your Golfers</h2>
        
        {isEditable ? (
          <form action={submitPicks}>
            <input type="hidden" name="poolId" value={poolId} />
            <input type="hidden" name="golferIds" id="golferIds" />
            <GolferPicker
              selectedIds={existingEntry?.golfer_ids || []}
              onChange={(ids) => {
                const input = document.getElementById('golferIds') as HTMLInputElement
                input.value = JSON.stringify(ids)
              }}
            />
            <button
              type="submit"
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Submit Picks
            </button>
          </form>
        ) : (
          <div>
            <p className="text-gray-500 mb-4">Your picks:</p>
            <ul className="space-y-2">
              {(existingEntry?.golfer_ids || []).map((id: string) => (
                <li key={id} className="p-2 bg-gray-50 rounded">{golferNames[id] || id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
