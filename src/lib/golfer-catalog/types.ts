export type CatalogRunType = 'monthly_baseline' | 'pre_tournament' | 'manual_add'

export type CatalogSource = 'monthly_sync' | 'tournament_sync' | 'manual_add'

export type RapidApiPlayer = {
  playerId: string
  firstName?: string
  lastName?: string
  country?: string
  worldRank?: number | null
}

export type PlayerSearchParams = {
  firstName?: string
  lastName?: string
  playerId?: string
}

export type CatalogQuotaPolicy = {
  monthlyLimit: number
  warningAt: number
  blockBulkAt: number
}

export type CatalogUsageSummary = {
  usedCalls: number
  remainingCalls: number
  status: 'ok' | 'warning' | 'blocked'
}
