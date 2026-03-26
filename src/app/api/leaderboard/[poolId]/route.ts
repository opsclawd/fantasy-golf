import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankEntries } from '@/lib/scoring'

export async function GET(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  try {
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', poolId)

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        entries: [],
        completedHoles: 0,
        updatedAt: new Date().toISOString()
      })
    }

    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    if (!allScores || allScores.length === 0) {
      return NextResponse.json({
        entries: [],
        completedHoles: 0,
        updatedAt: new Date().toISOString()
      })
    }

    const golferScoresMap = new Map<string, typeof allScores[0]>()
    for (const score of allScores) {
      golferScoresMap.set(score.golfer_id, score)
    }

    const completedScores = allScores.filter(s => s.hole_1 !== null)
    const completedHoles = completedScores.length > 0
      ? Math.min(...completedScores.map(s => {
          let thru = 0
          for (let i = 1; i <= 18; i++) {
            if ((s as any)[`hole_${i}`] !== null) thru = i
            else break
          }
          return thru
        }))
      : 0

    const ranked = rankEntries(entries, golferScoresMap, completedHoles)

    return NextResponse.json({
      entries: ranked,
      completedHoles,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Leaderboard fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
