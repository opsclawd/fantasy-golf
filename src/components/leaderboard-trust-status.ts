import type { PoolStatus } from '@/lib/supabase/types'

export function shouldRenderLeaderboardTrustStatus(
  poolStatus: PoolStatus,
  hideTrustStatusHeader: boolean,
) {
  if (hideTrustStatusHeader) {
    return false
  }

  return poolStatus === 'live' || poolStatus === 'complete'
}
