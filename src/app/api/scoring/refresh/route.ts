import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById } from '@/lib/pool-queries'
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
  let poolId: string | undefined
  try {
    const body = await request.json()
    poolId = body.poolId
  } catch {
    isUpdating = false
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  if (!poolId) {
    isUpdating = false
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'poolId required' } },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()

    const pool = await getPoolById(supabase, poolId)
    if (!pool) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      )
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
    console.error('Refresh failed:', error)
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