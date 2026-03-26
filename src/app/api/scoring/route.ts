import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json({ message: 'Update in progress' }, { status: 409 })
  }
  isUpdating = true

  try {
    const supabase = await createClient()
    
    // Get active (live) pool
    const { data: pool } = await supabase
      .from('pools')
      .select('*')
      .eq('status', 'live')
      .single()

    if (!pool) {
      return NextResponse.json({ message: 'No live pool' })
    }

    // Poll Slash Golf for current scores
    const slashScores = await getTournamentScores(pool.tournament_id)

    // Transform to our format and store
    for (const score of slashScores) {
      const holeScores: Record<string, number | null> = {}
      for (let i = 1; i <= 18; i++) {
        holeScores[`hole_${i}`] = score.hole_scores[i - 1] ?? null
      }

      await supabase.from('tournament_scores').upsert({
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        ...holeScores,
        total_birdies: countBirdies(score.hole_scores)
      }, {
        onConflict: 'golfer_id,tournament_id'
      })
    }

    // Get updated scores
    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    // Get entries
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', pool.id)

    // Build golfer scores map
    const golferScoresMap = new Map()
    for (const score of allScores || []) {
      golferScoresMap.set(score.golfer_id, score)
    }

    // Determine completed holes (min thru across all active golfers)
    const completedHoles = Math.min(...(slashScores.map(s => s.thru) || [0]))

    // Rank entries
    const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

    // Broadcast via Supabase real-time
    await supabase.channel('pool_updates').send({
      type: 'broadcast',
      event: 'scores',
      payload: { ranked, completedHoles, updatedAt: new Date().toISOString() }
    })

    return NextResponse.json({ success: true, completedHoles })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  } finally {
    isUpdating = false
  }
}

function countBirdies(holeScores: (number | null)[]): number {
  return holeScores.filter(s => s !== null && s < 0).length
}