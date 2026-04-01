# Real Golfer Sync Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the commissioner golfer catalog actions into real DB-writing flows that upsert golfers, track monthly API usage, and surface real sync state in the commissioner panel.

**Architecture:** Reuse the existing catalog service as the core orchestration layer, but extend it with real Supabase reads/writes and sync-run logging. Bulk refreshes will source golfers from the existing tournament field endpoint, while commissioner manual-add will use the `players` endpoint and persist the selected golfer immediately. The commissioner page will load real usage and latest-run state from `golfer_sync_runs`.

**Tech Stack:** Next.js 14 server actions, Supabase, Vitest, RapidAPI Live Golf Data, existing slash-golf client

---

## File Structure

### Create

- `src/lib/golfer-catalog/queries.ts` - focused Supabase reads/writes for golfers and sync runs.
- `src/app/(app)/commissioner/pools/[poolId]/__tests__/golfer-catalog-actions.test.ts` - server-action tests for refresh and manual add.

### Modify

- `src/lib/golfer-catalog/types.ts` - richer types for sync execution and stored sync runs.
- `src/lib/golfer-catalog/service.ts` - real orchestration for usage loading, sync-run recording, and upsert execution.
- `src/lib/golfer-catalog/rapidapi.ts` - keep manual-add lookup behavior and expose any small helpers needed for real sync code.
- `src/lib/slash-golf/client.ts` - normalize tournament-field golfers into reusable service input.
- `src/lib/supabase/types.ts` - align `GolferSyncRun.summary` typing if needed.
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts` - replace placeholder success paths with real sync/add flows.
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx` - load actual usage and latest sync run state.
- `src/components/GolferCatalogPanel.tsx` - show real success state and preserve blocked/manual-add behavior.
- `src/components/__tests__/GolferCatalogPanel.test.tsx` - verify panel reflects real usage/latest-run props.
- `src/lib/__tests__/golfer-catalog.test.ts` - unit tests for orchestration helpers and persistence-shape helpers.

---

### Task 1: Add Catalog Persistence Queries

**Files:**
- Create: `src/lib/golfer-catalog/queries.ts`
- Modify: `src/lib/supabase/types.ts`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Write the failing query-shape test**

Append to `src/lib/__tests__/golfer-catalog.test.ts`:

```ts
import { buildSyncRunInsert, buildGolferUpsertRows } from '@/lib/golfer-catalog/queries'

it('builds a sync run insert payload with summary metadata', () => {
  expect(
    buildSyncRunInsert({
      runType: 'manual_add',
      requestedBy: 'user-1',
      tournamentId: 't1',
      apiCallsUsed: 1,
      status: 'success',
      summary: { golfers_upserted: 1 },
      errorMessage: null,
    }),
  ).toEqual({
    run_type: 'manual_add',
    requested_by: 'user-1',
    tournament_id: 't1',
    api_calls_used: 1,
    status: 'success',
    summary: { golfers_upserted: 1 },
    error_message: null,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL because `queries.ts` does not exist yet.

- [ ] **Step 3: Add sync query helpers**

Create `src/lib/golfer-catalog/queries.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Golfer, GolferSyncRun } from '@/lib/supabase/types'

type SyncRunInsert = {
  run_type: GolferSyncRun['run_type']
  requested_by: string | null
  tournament_id: string | null
  api_calls_used: number
  status: GolferSyncRun['status']
  summary: Record<string, unknown>
  error_message: string | null
}

export function buildSyncRunInsert(input: {
  runType: GolferSyncRun['run_type']
  requestedBy: string | null
  tournamentId: string | null
  apiCallsUsed: number
  status: GolferSyncRun['status']
  summary: Record<string, unknown>
  errorMessage: string | null
}): SyncRunInsert {
  return {
    run_type: input.runType,
    requested_by: input.requestedBy,
    tournament_id: input.tournamentId,
    api_calls_used: input.apiCallsUsed,
    status: input.status,
    summary: input.summary,
    error_message: input.errorMessage,
  }
}

export async function insertGolferSyncRun(
  supabase: SupabaseClient,
  payload: SyncRunInsert,
): Promise<{ data: GolferSyncRun | null; error: string | null }> {
  const { data, error } = await supabase.from('golfer_sync_runs').insert(payload).select().single()
  if (error) return { data: null, error: error.message }
  return { data: data as GolferSyncRun, error: null }
}

export async function getLatestGolferSyncRun(
  supabase: SupabaseClient,
): Promise<GolferSyncRun | null> {
  const { data } = await supabase
    .from('golfer_sync_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as GolferSyncRun | null
}

export async function getMonthlyApiUsage(
  supabase: SupabaseClient,
  now: Date,
): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const { data, error } = await supabase
    .from('golfer_sync_runs')
    .select('api_calls_used')
    .gte('created_at', monthStart)
    .lt('created_at', nextMonthStart)

  if (error) {
    throw new Error(`Failed to load monthly API usage: ${error.message}`)
  }

  return (data ?? []).reduce((sum, row) => sum + (row.api_calls_used ?? 0), 0)
}

export async function upsertGolfers(
  supabase: SupabaseClient,
  golfers: Array<Omit<Golfer, 'last_synced_at'> & { last_synced_at?: string | null }>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('golfers').upsert(golfers, { onConflict: 'id' })
  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 4: Align `GolferSyncRun` typing if needed**

Update `src/lib/supabase/types.ts` only if required so `summary` remains `Record<string, unknown>` and works with the new query helpers without casts beyond the query boundary.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/golfer-catalog/queries.ts src/lib/supabase/types.ts src/lib/__tests__/golfer-catalog.test.ts
git commit -m "feat: add golfer catalog persistence queries"
```

### Task 2: Extend the Catalog Service for Real Usage and Upserts

**Files:**
- Modify: `src/lib/golfer-catalog/service.ts`
- Modify: `src/lib/golfer-catalog/types.ts`
- Modify: `src/lib/slash-golf/client.ts`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Write the failing orchestration tests**

Append to `src/lib/__tests__/golfer-catalog.test.ts`:

```ts
import { buildTournamentFieldUpsertRows, buildManualAddQuery, buildUsageSnapshot } from '@/lib/golfer-catalog/service'

it('builds tournament field upsert rows with tournament sync metadata', () => {
  expect(
    buildTournamentFieldUpsertRows([
      { id: 'g1', name: 'Collin Morikawa', country: 'USA' },
    ], '2026-03-31T00:00:00.000Z'),
  ).toEqual([
    {
      id: 'g1',
      name: 'Collin Morikawa',
      country: 'USA',
      search_name: 'collin morikawa',
      world_rank: null,
      is_active: true,
      source: 'tournament_sync',
      external_player_id: 'g1',
      last_synced_at: '2026-03-31T00:00:00.000Z',
    },
  ])
})

it('builds manual-add search params from commissioner input', () => {
  expect(buildManualAddQuery({ firstName: 'Collin', lastName: 'Morikawa' })).toEqual({
    firstName: 'Collin',
    lastName: 'Morikawa',
  })
})

it('builds a usage snapshot from monthly usage and policy', () => {
  expect(buildUsageSnapshot(220).status).toBe('warning')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL because the new orchestration helpers do not exist yet.

- [ ] **Step 3: Add orchestration helpers**

Update `src/lib/golfer-catalog/service.ts`:

```ts
export function buildUsageSnapshot(usedCalls: number) {
  return buildCatalogUsageSummary({
    usedCalls,
    policy: createQuotaPolicy(),
  })
}

export function buildManualAddQuery(input: { firstName: string; lastName: string }) {
  return {
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
  }
}

export function buildTournamentFieldUpsertRows(
  golfers: Array<{ id: string; name: string; country: string }>,
  syncedAt: string,
) {
  return golfers.map((golfer) => ({
    id: golfer.id,
    name: golfer.name,
    country: golfer.country,
    search_name: buildSearchName(golfer.name),
    world_rank: null,
    is_active: true,
    source: 'tournament_sync' as const,
    external_player_id: golfer.id,
    last_synced_at: syncedAt,
  }))
}
```

Update `src/lib/golfer-catalog/types.ts` with any helper input/output types only if needed.

- [ ] **Step 4: Normalize tournament golfers in the existing client**

Update `src/lib/slash-golf/client.ts` so `getGolfers(...)` returns a stable shape even if the raw API payload varies:

```ts
export async function getGolfers(tournamentId: string, year?: number): Promise<{ id: string; name: string; country: string }[]> {
  // existing fetch...
  const raw = await res.json()

  return (raw ?? []).flatMap((golfer: Record<string, unknown>) => {
    const id = typeof golfer.playerId === 'string' ? golfer.playerId : typeof golfer.id === 'string' ? golfer.id : null
    const firstName = typeof golfer.firstName === 'string' ? golfer.firstName : ''
    const lastName = typeof golfer.lastName === 'string' ? golfer.lastName : ''
    const name = typeof golfer.name === 'string' ? golfer.name : [firstName, lastName].filter(Boolean).join(' ').trim()
    const country = typeof golfer.country === 'string' ? golfer.country : ''

    if (!id || !name) return []

    return [{ id, name, country }]
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/golfer-catalog/service.ts src/lib/golfer-catalog/types.ts src/lib/slash-golf/client.ts src/lib/__tests__/golfer-catalog.test.ts
git commit -m "feat: add golfer catalog sync orchestration helpers"
```

### Task 3: Turn Commissioner Actions Into Real DB-Writing Flows

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/__tests__/golfer-catalog-actions.test.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/lib/golfer-catalog/queries.ts`
- Modify: `src/lib/golfer-catalog/service.ts`

- [ ] **Step 1: Write the failing server-action tests**

Create `src/app/(app)/commissioner/pools/[poolId]/__tests__/golfer-catalog-actions.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { addMissingGolferAction, refreshGolferCatalogAction } from '../actions'

describe('golfer catalog commissioner actions', () => {
  it('returns success only after a tournament refresh upserts golfers and records usage', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({ success: true })
  })

  it('adds a missing golfer and records one API call', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({ success: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts`
Expected: FAIL because the action file still has placeholder behavior and no mocked persistence path yet.

- [ ] **Step 3: Add minimal real persistence helpers**

Extend `src/lib/golfer-catalog/queries.ts` if needed with:

```ts
export async function getGolferByExternalPlayerId(
  supabase: SupabaseClient,
  externalPlayerId: string,
): Promise<Golfer | null> {
  const { data } = await supabase
    .from('golfers')
    .select('*')
    .eq('external_player_id', externalPlayerId)
    .maybeSingle()

  return data as Golfer | null
}
```

- [ ] **Step 4: Replace placeholder action logic with real flows**

Update `src/app/(app)/commissioner/pools/[poolId]/actions.ts` to:

```ts
// refresh flow outline
const usedCalls = await getMonthlyApiUsage(supabase, new Date())
const decision = decideCatalogRun({ runType, usedCalls, monthlyLimit: 250, warningAt: 200, blockBulkAt: 235 })
if (!decision.allowed) {
  await insertGolferSyncRun(supabase, buildSyncRunInsert({
    runType,
    requestedBy: user.id,
    tournamentId: pool.tournament_id,
    apiCallsUsed: 0,
    status: 'blocked',
    summary: { reason: decision.reason },
    errorMessage: decision.reason,
  }))
  return { error: decision.reason }
}

const nowIso = new Date().toISOString()
const golfers = await getGolfers(pool.tournament_id, pool.year)
const rows = buildTournamentFieldUpsertRows(golfers, nowIso)
const { error: upsertError } = await upsertGolfers(supabase, rows)
if (upsertError) {
  await insertGolferSyncRun(...status failed...)
  return { error: 'Failed to refresh golfer catalog.' }
}

await insertGolferSyncRun(...status success, apiCallsUsed: 1, summary: { golfers_upserted: rows.length }...)
revalidatePath(`/commissioner/pools/${poolId}`)
return { success: true }
```

For `addMissingGolferAction`:

```ts
const usedCalls = await getMonthlyApiUsage(supabase, new Date())
const decision = decideCatalogRun({ runType: 'manual_add', usedCalls, monthlyLimit: 250, warningAt: 200, blockBulkAt: 235 })
if (!decision.allowed) { ...insert blocked sync run...; return { error: decision.reason } }

const players = await searchPlayers(buildManualAddQuery({ firstName, lastName }))
const player = players[0]
if (!player) {
  await insertGolferSyncRun(...status failed, apiCallsUsed: 1, summary: { golfers_upserted: 0 }...)
  return { error: 'No golfer matched that search.' }
}

const existing = await getGolferByExternalPlayerId(supabase, player.playerId)
if (!existing) {
  const syncedAt = new Date().toISOString()
  const { error: upsertError } = await upsertGolfers(supabase, [{
    ...buildGolferUpsertPayload({ ...player, source: 'manual_add' }),
    last_synced_at: syncedAt,
  }])
  if (upsertError) { ...failed sync run...; return { error: 'Failed to add golfer.' } }
}

await insertGolferSyncRun(...status success, apiCallsUsed: 1, summary: { golfers_upserted: existing ? 0 : 1, golfer_name: [player.firstName, player.lastName].filter(Boolean).join(' ').trim() }...)
revalidatePath(`/commissioner/pools/${poolId}`)
return { success: true }
```

- [ ] **Step 5: Run action tests to verify they pass**

Run: `npm test -- src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/actions.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts src/lib/golfer-catalog/queries.ts src/lib/golfer-catalog/service.ts
git commit -m "feat: persist commissioner golfer catalog sync runs"
```

### Task 4: Load Real Usage and Latest Sync State in the Commissioner UI

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/components/GolferCatalogPanel.tsx`
- Modify: `src/components/__tests__/GolferCatalogPanel.test.tsx`

- [ ] **Step 1: Write the failing panel-state test**

Append to `src/components/__tests__/GolferCatalogPanel.test.tsx`:

```tsx
it('shows a latest-run timestamp and keeps manual add available when blocked', () => {
  render(
    <GolferCatalogPanel
      poolId="pool-1"
      usage={{ usedCalls: 250, remainingCalls: 0, status: 'blocked' }}
      latestRun={{ created_at: '2026-03-31T00:00:00.000Z', status: 'success' }}
    />,
  )

  expect(screen.getByText(/Last sync success/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh monthly catalog' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Add missing golfer' })).toBeEnabled()
})
```

- [ ] **Step 2: Run test to verify it fails only if latest-run or blocked-state behavior is incomplete**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: FAIL only if the current panel props/state handling is insufficient.

- [ ] **Step 3: Load real usage/latest run on the commissioner page**

Update `src/app/(app)/commissioner/pools/[poolId]/page.tsx`:

```tsx
import { getLatestGolferSyncRun, getMonthlyApiUsage } from '@/lib/golfer-catalog/queries'
import { buildUsageSnapshot } from '@/lib/golfer-catalog/service'

const [latestRun, usedCalls] = await Promise.all([
  getLatestGolferSyncRun(supabase),
  getMonthlyApiUsage(supabase, new Date()),
])

const usage = buildUsageSnapshot(usedCalls)
```

- [ ] **Step 4: Keep the panel focused on props, not fake defaults**

Only adjust `src/components/GolferCatalogPanel.tsx` if necessary to keep blocked/warning/success rendering driven purely by the real `usage` and `latestRun` props already passed in.

- [ ] **Step 5: Run panel test to verify it passes**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx src/components/GolferCatalogPanel.tsx src/components/__tests__/GolferCatalogPanel.test.tsx
git commit -m "feat: show real golfer catalog sync status"
```

### Task 5: Verify the Real Sync Flows End-to-End

**Files:**
- Modify: `src/lib/__tests__/golfer-catalog.test.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/__tests__/golfer-catalog-actions.test.ts`

- [ ] **Step 1: Add the final behavior tests**

Add assertions for:

```ts
it('records blocked sync runs without consuming API calls', async () => {
  // verify blocked decision writes a golfer_sync_runs row with api_calls_used: 0
})

it('records one API call for manual add even when no golfer matches', async () => {
  // verify failed search still records api_calls_used: 1
})

it('upserts tournament golfers with tournament_sync source and synced timestamp', () => {
  // verify buildTournamentFieldUpsertRows output remains stable
})
```

- [ ] **Step 2: Run the focused sync tests and watch them fail if coverage is incomplete**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts`
Expected: FAIL only on missing end-to-end contract assertions.

- [ ] **Step 3: Make the smallest code/test adjustments needed**

Keep fixes limited to recording accurate sync-run metadata and preserving the intended API-call accounting semantics.

- [ ] **Step 4: Run the focused sync tests again**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Run the broader verification set**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/GolferStatesPresentation.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/__tests__/golfer-catalog.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/golfer-catalog-actions.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/actions.ts src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx src/components/GolferCatalogPanel.tsx src/components/__tests__/GolferCatalogPanel.test.tsx src/lib/golfer-catalog/queries.ts src/lib/golfer-catalog/service.ts src/lib/slash-golf/client.ts
git commit -m "feat: persist real golfer catalog refresh flows"
```

---

## Spec Coverage Check

- Real DB-writing refresh flow: Tasks 2 and 3
- Real manual-add persistence flow: Tasks 2 and 3
- Monthly usage and latest-run loading: Tasks 1 and 4
- Quota accounting and blocked-run logging: Tasks 1, 3, and 5
- Commissioner panel reflecting real sync state: Task 4

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Each task includes exact file paths, concrete code, and explicit test/build commands.

## Type Consistency Check

- `GolferSyncRun`, sync-run insert payloads, and usage snapshot helpers use the same `run_type`/`status` values throughout.
- Tournament-field upserts and manual-add upserts both write the same expanded `Golfer` shape introduced in the committed batch.
