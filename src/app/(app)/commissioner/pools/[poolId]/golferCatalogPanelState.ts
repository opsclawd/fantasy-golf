import { createClient } from '@/lib/supabase/server'
import { getLatestGolferSyncRun, getMonthlyApiUsage } from '@/lib/golfer-catalog/queries'
import { buildUsageSnapshot } from '@/lib/golfer-catalog/service'

export async function loadGolferCatalogPanelState(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const [latestRun, usedCalls] = await Promise.all([
      getLatestGolferSyncRun(supabase),
      getMonthlyApiUsage(supabase, new Date()),
    ])

    return {
      latestRun,
      usage: buildUsageSnapshot(usedCalls),
    }
  } catch {
    return {
      latestRun: null,
      usage: buildUsageSnapshot(0),
    }
  }
}
