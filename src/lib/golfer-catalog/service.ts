import { buildSearchName } from './normalize'
import type { CatalogQuotaPolicy, CatalogSource, CatalogUsageSummary, RapidApiPlayer } from './types'
import type { Golfer } from '@/lib/supabase/types'

export const DEFAULT_CATALOG_RUN_DECISION_INPUTS = {
  usedCalls: 0,
  monthlyLimit: 250,
  warningAt: 200,
  blockBulkAt: 235,
} as const

export function decideCatalogRun({
  runType,
  usedCalls,
  monthlyLimit,
  warningAt,
  blockBulkAt,
}: {
  runType: 'monthly_baseline' | 'pre_tournament' | 'manual_add'
  usedCalls: number
  monthlyLimit: number
  warningAt: number
  blockBulkAt: number
}): { allowed: true } | { allowed: false; reason: string } {
  if (usedCalls >= monthlyLimit) {
    return { allowed: false, reason: 'Monthly API budget is exhausted.' }
  }

  if (runType !== 'manual_add' && usedCalls >= blockBulkAt) {
    return { allowed: false, reason: 'Monthly API budget is reserved for manual golfer adds.' }
  }

  if (runType !== 'manual_add' && usedCalls >= warningAt) {
    return { allowed: true }
  }

  return { allowed: true }
}

export function createQuotaPolicy(input?: Partial<CatalogQuotaPolicy>): CatalogQuotaPolicy {
  const policy = {
    monthlyLimit: input?.monthlyLimit ?? DEFAULT_CATALOG_RUN_DECISION_INPUTS.monthlyLimit,
    warningAt: input?.warningAt ?? DEFAULT_CATALOG_RUN_DECISION_INPUTS.warningAt,
    blockBulkAt: input?.blockBulkAt ?? DEFAULT_CATALOG_RUN_DECISION_INPUTS.blockBulkAt,
  }

  if (
    policy.monthlyLimit <= 0
    || policy.warningAt < 0
    || policy.blockBulkAt < policy.warningAt
    || policy.blockBulkAt > policy.monthlyLimit
  ) {
    throw new Error('Quota policy thresholds are invalid')
  }

  return policy
}

export function buildCatalogUsageSummary({
  usedCalls,
  policy,
}: {
  usedCalls: number
  policy: CatalogQuotaPolicy
}): CatalogUsageSummary {
  if (usedCalls >= policy.blockBulkAt) {
    return {
      usedCalls,
      remainingCalls: Math.max(policy.monthlyLimit - usedCalls, 0),
      status: 'blocked',
    }
  }

  if (usedCalls >= policy.warningAt) {
    return {
      usedCalls,
      remainingCalls: Math.max(policy.monthlyLimit - usedCalls, 0),
      status: 'warning',
    }
  }

  return {
    usedCalls,
    remainingCalls: Math.max(policy.monthlyLimit - usedCalls, 0),
    status: 'ok',
  }
}

export function buildGolferUpsertPayload(player: RapidApiPlayer & { source: CatalogSource }) {
  const playerId = player.playerId?.trim()
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim()
  const searchName = buildSearchName(name)

  if (!playerId) {
    throw new Error('RapidAPI player must include a playerId')
  }

  if (!searchName) {
    throw new Error('RapidAPI player must include a usable name')
  }

  return {
    id: playerId,
    external_player_id: playerId,
    name,
    search_name: searchName,
    country: player.country ?? 'Unknown',
    world_rank: player.worldRank ?? null,
    is_active: true,
    source: player.source,
  }
}

export function buildFallbackGolfer(id: string, overrides?: Partial<Pick<Golfer, 'name' | 'country'>>): Golfer {
  const name = overrides?.name ?? id

  return {
    id,
    name,
    country: overrides?.country ?? '',
    search_name: buildSearchName(name),
    world_rank: null,
    is_active: false,
    source: 'legacy',
    external_player_id: null,
    last_synced_at: null,
  }
}
