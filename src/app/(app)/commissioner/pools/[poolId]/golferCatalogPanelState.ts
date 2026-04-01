import { createClient } from '@/lib/supabase/server'
import { getLatestGolferSyncRun, getMonthlyApiUsage } from '@/lib/golfer-catalog/queries'
import { buildUsageSnapshot } from '@/lib/golfer-catalog/service'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

export async function loadGolferCatalogPanelState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournamentId?: string,
) {
  try {
    const [latestRun, usedCalls, rosterGolfers] = await Promise.all([
      getLatestGolferSyncRun(supabase),
      getMonthlyApiUsage(supabase, new Date()),
      tournamentId ? getTournamentRosterGolfers(supabase, tournamentId) : Promise.resolve([]),
    ])

    return {
      latestRun,
      usage: buildUsageSnapshot(usedCalls),
      ...(tournamentId ? { rosterCount: rosterGolfers.length } : {}),
    }
  } catch {
    return {
      latestRun: null,
      usage: buildUsageSnapshot(0),
      ...(tournamentId ? { rosterCount: 0 } : {}),
    }
  }
}
