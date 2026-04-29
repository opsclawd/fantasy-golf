import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  updatePoolStatus,
  insertAuditEvent,
} from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

let isUpdating = false

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isUpdating) {
    return NextResponse.json(
      { data: null, error: { code: 'UPDATE_IN_PROGRESS', message: 'Refresh already running' } },
      { status: 409 }
    )
  }
  isUpdating = true

  try {
    const supabase = createAdminClient()

    // Step 1: Auto-lock any open pools past their deadline
    const poolsToLock = await getOpenPoolsPastDeadline(supabase)
    for (const pool of poolsToLock) {
      const { error } = await updatePoolStatus(supabase, pool.id, 'live', 'open')
      if (!error) {
        await insertAuditEvent(supabase, {
          pool_id: pool.id,
          user_id: null,
          action: 'entryLocked',
          details: { reason: 'deadline_passed', deadline: pool.deadline },
        })
      }
    }

    // Step 2: Find the active (live) pool and refresh scores
    const pool = await getActivePool(supabase)
    if (!pool) {
      return NextResponse.json({ data: { message: 'No live pool' }, error: null })
    }

    const result = await refreshScoresForPool(supabase, pool)

    if (result.error) {
      const statusMap: Record<string, number> = {
        FETCH_FAILED: 502,
        UPSERT_FAILED: 500,
        INTERNAL_ERROR: 500,
        NO_SCORES: 200,
      }
      return NextResponse.json(
        { data: null, error: result.error },
        { status: statusMap[result.error.code] }
      )
    }

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Update failed',
        },
      },
      { status: 500 }
    )
  } finally {
    isUpdating = false
  }
}