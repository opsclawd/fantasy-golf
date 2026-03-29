import type { FreshnessStatus } from './supabase/types'

/** Default stale threshold: 10 minutes */
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Classifies data freshness based on when it was last refreshed.
 *
 * - `current`: refreshedAt is within the threshold
 * - `stale`: refreshedAt is beyond the threshold
 * - `unknown`: refreshedAt is null or invalid
 */
export function classifyFreshness(
  refreshedAt: string | null,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
  now: Date = new Date()
): FreshnessStatus {
  if (refreshedAt === null) return 'unknown'

  const refreshedTime = Date.parse(refreshedAt)
  if (Number.isNaN(refreshedTime)) return 'unknown'

  const elapsed = now.getTime() - refreshedTime
  if (elapsed >= thresholdMs) return 'stale'

  return 'current'
}
