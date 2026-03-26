import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankEntries } from '@/lib/scoring'

export async function GET(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)

  if (!entries) {
    return NextResponse.json({ entries: [], completedHoles: 0, updatedAt: new Date().toISOString() })
  }

  const { data: allScores } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', pool.tournament_id)

  const golferScoresMap = new Map()
  for (const score of allScores || []) {
    golferScoresMap.set(score.golfer_id, score)
  }

  const completedScores = allScores || []
  const completedHoles = completedScores.length > 0
    ? Math.min(...completedScores.map(s => s.thru ?? 0))
    : 0
  const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

  return NextResponse.json({
    entries: ranked,
    completedHoles,
    updatedAt: new Date().toISOString()
  })
}
