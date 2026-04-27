import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPoolById, acquireRefreshLock, releaseRefreshLock } from '@/lib/pool-queries'
import { refreshScoresForPool } from '@/lib/scoring-refresh'

function generateLockId(): string {
  return crypto.randomUUID()
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let poolId: string | undefined
  try {
    const body = await request.json()
    poolId = body.poolId
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  if (!poolId) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'poolId required' } },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const pool = await getPoolById(supabase, poolId)
  if (!pool) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
      { status: 404 }
    )
  }

  const lockId = generateLockId()
  const lockResult = await acquireRefreshLock(supabase, pool.tournament_id, lockId)

  if (!lockResult.acquired) {
    return NextResponse.json(
      { data: null, error: { code: 'REFRESH_LOCKED', message: 'Refresh already running for this tournament' } },
      { status: 409 }
    )
  }

  try {
    const result = await refreshScoresForPool(supabase, pool)

    if (result.error) {
      const statusMap = {
        FETCH_FAILED: 502,
        UPSERT_FAILED: 500,
        INTERNAL_ERROR: 500,
      } as const
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
    await releaseRefreshLock(supabase, pool.tournament_id, lockId)
  }
}