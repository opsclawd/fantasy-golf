import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'
import { notFound } from 'next/navigation'

export default async function SpectatorPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Leaderboard poolId={poolId} />
      </main>
    </div>
  )
}
