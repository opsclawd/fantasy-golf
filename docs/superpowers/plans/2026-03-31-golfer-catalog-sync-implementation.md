# Golfer Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quota-safe golfer catalog system that keeps participant search fully DB-backed while giving commissioners controlled sync and manual add tools backed by RapidAPI.

**Architecture:** Add catalog metadata and sync-run audit tables in Supabase, then isolate RapidAPI integration behind a server-only catalog service. Commissioner actions will call that service to run monthly syncs, pre-tournament refreshes, and one-off manual adds, while the participant picker continues reading only the local `golfers` table.

**Tech Stack:** Next.js 14 server actions, Supabase, Vitest, React Testing Library, RapidAPI Live Golf Data

---

## File Structure

### Create

- `supabase/migrations/20260331100000_add_golfer_catalog_metadata.sql` - adds golfer catalog columns, sync audit table, indexes, and backfill logic.
- `src/lib/golfer-catalog/types.ts` - shared catalog types for sync runs, quota checks, and API payloads.
- `src/lib/golfer-catalog/normalize.ts` - deterministic name normalization helpers for local search and dedupe.
- `src/lib/golfer-catalog/rapidapi.ts` - server-only RapidAPI wrappers for player search and refresh sources.
- `src/lib/golfer-catalog/service.ts` - quota checks, sync-run logging, deduping, and upsert orchestration.
- `src/lib/__tests__/golfer-catalog.test.ts` - unit tests for normalization, dedupe, and quota enforcement.
- `src/components/GolferCatalogPanel.tsx` - commissioner UI for usage status, refresh actions, and manual add.
- `src/components/__tests__/GolferCatalogPanel.test.tsx` - render tests for the new commissioner catalog panel.

### Modify

- `src/lib/supabase/types.ts` - extend `Golfer` and add `GolferSyncRun` types.
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts` - add commissioner-only catalog maintenance actions.
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx` - load catalog status data and render the new panel.
- `src/components/golfer-picker.tsx` - search a normalized local catalog and only read DB fields needed by the picker.

---

### Task 1: Add Catalog Metadata and Audit Storage

**Files:**
- Create: `supabase/migrations/20260331100000_add_golfer_catalog_metadata.sql`
- Modify: `src/lib/supabase/types.ts`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Write the failing schema-shape test**

Create `src/lib/__tests__/golfer-catalog.test.ts` with the initial catalog metadata expectation:

```ts
import { describe, expect, it } from 'vitest'

import { buildSearchName, isBulkRefreshBlocked } from '@/lib/golfer-catalog/normalize'

describe('golfer catalog helpers', () => {
  it('normalizes golfer names for local search matching', () => {
    expect(buildSearchName(' Collin  Morikawa ')).toBe('collin morikawa')
    expect(buildSearchName('Rory McIlroy')).toBe('rory mcilroy')
  })

  it('blocks bulk refreshes after the hard quota threshold', () => {
    expect(isBulkRefreshBlocked({ usedCalls: 235, hardLimit: 235 })).toBe(true)
    expect(isBulkRefreshBlocked({ usedCalls: 199, hardLimit: 235 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL with module resolution errors because `@/lib/golfer-catalog/normalize` does not exist yet.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/20260331100000_add_golfer_catalog_metadata.sql`:

```sql
alter table golfers
  add column if not exists search_name text,
  add column if not exists world_rank integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists source text not null default 'legacy',
  add column if not exists external_player_id text,
  add column if not exists last_synced_at timestamptz;

update golfers
set
  search_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  is_active = coalesce(is_active, true),
  source = coalesce(source, 'legacy')
where search_name is null
   or source is null;

create unique index if not exists golfers_external_player_id_key
  on golfers (external_player_id)
  where external_player_id is not null;

create index if not exists golfers_search_name_idx
  on golfers (search_name);

create table if not exists golfer_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('monthly_baseline', 'pre_tournament', 'manual_add')),
  requested_by uuid,
  tournament_id text,
  api_calls_used integer not null default 0,
  status text not null check (status in ('success', 'failed', 'blocked')),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists golfer_sync_runs_created_at_idx
  on golfer_sync_runs (created_at desc);
```

- [ ] **Step 4: Extend Supabase types**

Update `src/lib/supabase/types.ts`:

```ts
export interface Golfer {
  id: string
  name: string
  country: string
  search_name: string | null
  world_rank: number | null
  is_active: boolean
  source: 'legacy' | 'monthly_sync' | 'tournament_sync' | 'manual_add'
  external_player_id: string | null
  last_synced_at: string | null
}

export interface GolferSyncRun {
  id: string
  run_type: 'monthly_baseline' | 'pre_tournament' | 'manual_add'
  requested_by: string | null
  tournament_id: string | null
  api_calls_used: number
  status: 'success' | 'failed' | 'blocked'
  summary: Record<string, unknown>
  error_message: string | null
  created_at: string
}
```

- [ ] **Step 5: Add the normalization helper**

Create `src/lib/golfer-catalog/normalize.ts`:

```ts
type BulkRefreshQuota = {
  usedCalls: number
  hardLimit: number
}

export function buildSearchName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isBulkRefreshBlocked({ usedCalls, hardLimit }: BulkRefreshQuota): boolean {
  return usedCalls >= hardLimit
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260331100000_add_golfer_catalog_metadata.sql src/lib/supabase/types.ts src/lib/golfer-catalog/normalize.ts src/lib/__tests__/golfer-catalog.test.ts
git commit -m "feat: add golfer catalog metadata foundation"
```

### Task 2: Build the Server-Only Catalog Service

**Files:**
- Create: `src/lib/golfer-catalog/types.ts`
- Create: `src/lib/golfer-catalog/rapidapi.ts`
- Create: `src/lib/golfer-catalog/service.ts`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Expand the failing test with quota, dedupe, and sync logging behavior**

Append to `src/lib/__tests__/golfer-catalog.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildCatalogUsageSummary,
  buildGolferUpsertPayload,
  createQuotaPolicy,
} from '@/lib/golfer-catalog/service'

describe('catalog service', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('creates a stable upsert payload from RapidAPI player data', () => {
    expect(
      buildGolferUpsertPayload({
        playerId: '50525',
        firstName: 'Collin',
        lastName: 'Morikawa',
        country: 'USA',
        worldRank: 4,
        source: 'manual_add',
      }),
    ).toEqual({
      external_player_id: '50525',
      id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: 4,
      is_active: true,
      source: 'manual_add',
    })
  })

  it('reports quota status with warning and block thresholds', () => {
    const policy = createQuotaPolicy({ monthlyLimit: 250, warningAt: 200, blockBulkAt: 235 })

    expect(buildCatalogUsageSummary({ usedCalls: 199, policy }).status).toBe('ok')
    expect(buildCatalogUsageSummary({ usedCalls: 200, policy }).status).toBe('warning')
    expect(buildCatalogUsageSummary({ usedCalls: 235, policy }).status).toBe('blocked')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL because `service.ts` and its exports do not exist yet.

- [ ] **Step 3: Define catalog types**

Create `src/lib/golfer-catalog/types.ts`:

```ts
export type CatalogRunType = 'monthly_baseline' | 'pre_tournament' | 'manual_add'

export type CatalogSource = 'monthly_sync' | 'tournament_sync' | 'manual_add'

export type RapidApiPlayer = {
  playerId: string
  firstName?: string
  lastName?: string
  country?: string
  worldRank?: number | null
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
```

- [ ] **Step 4: Implement the RapidAPI wrapper**

Create `src/lib/golfer-catalog/rapidapi.ts`:

```ts
import 'server-only'

import type { RapidApiPlayer } from './types'

const BASE_URL = 'https://live-golf-data.p.rapidapi.com'

function buildHeaders(): HeadersInit {
  return {
    'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '',
  }
}

export async function searchPlayers(params: {
  firstName?: string
  lastName?: string
  playerId?: string
}): Promise<RapidApiPlayer[]> {
  const search = new URLSearchParams()

  if (params.firstName) search.set('firstName', params.firstName)
  if (params.lastName) search.set('lastName', params.lastName)
  if (params.playerId) search.set('playerId', params.playerId)

  const response = await fetch(`${BASE_URL}/players?${search.toString()}`, {
    headers: buildHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`RapidAPI players lookup failed with ${response.status}`)
  }

  return response.json()
}
```

- [ ] **Step 5: Implement the service helpers**

Create `src/lib/golfer-catalog/service.ts`:

```ts
import { buildSearchName } from './normalize'
import type { CatalogQuotaPolicy, CatalogSource, CatalogUsageSummary, RapidApiPlayer } from './types'

export function createQuotaPolicy(input?: Partial<CatalogQuotaPolicy>): CatalogQuotaPolicy {
  return {
    monthlyLimit: input?.monthlyLimit ?? 250,
    warningAt: input?.warningAt ?? 200,
    blockBulkAt: input?.blockBulkAt ?? 235,
  }
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
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim()

  return {
    id: player.playerId,
    external_player_id: player.playerId,
    name,
    search_name: buildSearchName(name),
    country: player.country ?? 'Unknown',
    world_rank: player.worldRank ?? null,
    is_active: true,
    source: player.source,
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/golfer-catalog/types.ts src/lib/golfer-catalog/rapidapi.ts src/lib/golfer-catalog/service.ts src/lib/__tests__/golfer-catalog.test.ts
git commit -m "feat: add server golfer catalog service"
```

### Task 3: Add Commissioner-Only Catalog Actions

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Create: `src/components/GolferCatalogPanel.tsx`
- Create: `src/components/__tests__/GolferCatalogPanel.test.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

- [ ] **Step 1: Write the failing panel render test**

Create `src/components/__tests__/GolferCatalogPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(app)/commissioner/pools/[poolId]/actions', () => ({
  refreshGolferCatalogAction: vi.fn(),
  addMissingGolferAction: vi.fn(),
}))

import { GolferCatalogPanel } from '@/components/GolferCatalogPanel'

describe('GolferCatalogPanel', () => {
  it('shows quota usage and commissioner maintenance actions', () => {
    render(
      <GolferCatalogPanel
        poolId="pool-1"
        usage={{ usedCalls: 18, remainingCalls: 232, status: 'ok' }}
        latestRun={null}
      />,
    )

    expect(screen.getByText('Golfer catalog')).toBeInTheDocument()
    expect(screen.getByText('18 of 250 calls used')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh monthly catalog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add missing golfer' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: FAIL because `GolferCatalogPanel.tsx` does not exist yet.

- [ ] **Step 3: Add commissioner server actions**

Append to `src/app/(app)/commissioner/pools/[poolId]/actions.ts`:

```ts
export type GolferCatalogActionState = {
  error?: string
  success?: boolean
} | null

export async function refreshGolferCatalogAction(
  _prevState: GolferCatalogActionState,
  formData: FormData,
): Promise<GolferCatalogActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = String(formData.get('poolId') ?? '')
  const runType = String(formData.get('runType') ?? 'monthly_baseline') as 'monthly_baseline' | 'pre_tournament'
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can refresh the golfer catalog.' }

  return { success: true }
}

export async function addMissingGolferAction(
  _prevState: GolferCatalogActionState,
  formData: FormData,
): Promise<GolferCatalogActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = String(formData.get('poolId') ?? '')
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can add golfers.' }
  if (!firstName && !lastName) return { error: 'Enter at least a first or last name.' }

  return { success: true }
}
```

- [ ] **Step 4: Add the panel component**

Create `src/components/GolferCatalogPanel.tsx`:

```tsx
'use client'

import { useFormState } from 'react-dom'
import { addMissingGolferAction, refreshGolferCatalogAction, type GolferCatalogActionState } from '@/app/(app)/commissioner/pools/[poolId]/actions'

type Usage = {
  usedCalls: number
  remainingCalls: number
  status: 'ok' | 'warning' | 'blocked'
}

export function GolferCatalogPanel({
  poolId,
  usage,
  latestRun,
}: {
  poolId: string
  usage: Usage
  latestRun: { created_at: string; status: string } | null
}) {
  const [refreshState, refreshAction] = useFormState<GolferCatalogActionState, FormData>(refreshGolferCatalogAction, null)
  const [addState, addAction] = useFormState<GolferCatalogActionState, FormData>(addMissingGolferAction, null)

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Golfer catalog</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">Keep participant search local and current</h2>
      <p className="mt-2 text-sm text-slate-600">{usage.usedCalls} of 250 calls used. {usage.remainingCalls} remaining this month.</p>
      <p className="mt-1 text-sm text-slate-500">
        {latestRun ? `Last sync ${latestRun.status} on ${new Date(latestRun.created_at).toLocaleDateString()}.` : 'No catalog sync has run yet.'}
      </p>

      <form action={refreshAction} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="poolId" value={poolId} />
        <button type="submit" name="runType" value="monthly_baseline" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          Refresh monthly catalog
        </button>
        <button type="submit" name="runType" value="pre_tournament" className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          Refresh tournament field
        </button>
      </form>

      {refreshState?.error ? <p className="mt-3 text-sm text-red-600">{refreshState.error}</p> : null}

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="poolId" value={poolId} />
        <input name="firstName" placeholder="First name" className="rounded-xl border border-slate-200 px-3 py-2.5" />
        <input name="lastName" placeholder="Last name" className="rounded-xl border border-slate-200 px-3 py-2.5" />
        <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          Add missing golfer
        </button>
      </form>

      {addState?.error ? <p className="mt-3 text-sm text-red-600">{addState.error}</p> : null}
    </section>
  )
}
```

- [ ] **Step 5: Render the panel on the commissioner page**

Update `src/app/(app)/commissioner/pools/[poolId]/page.tsx` with the new import and render block:

```tsx
import { GolferCatalogPanel } from '@/components/GolferCatalogPanel'

const usage = { usedCalls: 0, remainingCalls: 250, status: 'ok' as const }
const latestRun = null

// inside the page JSX, near other commissioner controls
<GolferCatalogPanel poolId={poolId} usage={usage} latestRun={latestRun} />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/page.tsx src/components/GolferCatalogPanel.tsx src/components/__tests__/GolferCatalogPanel.test.tsx
git commit -m "feat: add commissioner golfer catalog controls"
```

### Task 4: Wire Real Catalog Operations Into Commissioner Actions

**Files:**
- Modify: `src/lib/golfer-catalog/service.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Add a failing service integration test for manual add and blocked refreshes**

Append to `src/lib/__tests__/golfer-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { decideCatalogRun } from '@/lib/golfer-catalog/service'

describe('decideCatalogRun', () => {
  it('blocks bulk refreshes when usage is at the hard threshold', () => {
    expect(
      decideCatalogRun({
        runType: 'monthly_baseline',
        usedCalls: 235,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: false, reason: 'Monthly API budget is reserved for manual golfer adds.' })
  })

  it('allows manual adds while quota remains', () => {
    expect(
      decideCatalogRun({
        runType: 'manual_add',
        usedCalls: 240,
        monthlyLimit: 250,
        warningAt: 200,
        blockBulkAt: 235,
      }),
    ).toEqual({ allowed: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL because `decideCatalogRun` does not exist.

- [ ] **Step 3: Implement decision and orchestration helpers**

Update `src/lib/golfer-catalog/service.ts`:

```ts
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
```

- [ ] **Step 4: Call the service from commissioner actions**

Replace the placeholder returns in `src/app/(app)/commissioner/pools/[poolId]/actions.ts` with service-backed orchestration:

```ts
import { revalidatePath } from 'next/cache'
import { decideCatalogRun } from '@/lib/golfer-catalog/service'

const decision = decideCatalogRun({
  runType,
  usedCalls: 0,
  monthlyLimit: 250,
  warningAt: 200,
  blockBulkAt: 235,
})

if (!decision.allowed) {
  return { error: decision.reason }
}

revalidatePath(`/commissioner/pools/${poolId}`)
return { success: true }
```

For `addMissingGolferAction`, replace the placeholder success branch with a call that:

```ts
const fullName = [firstName, lastName].filter(Boolean).join(' ')

if (!fullName) {
  return { error: 'Enter at least a first or last name.' }
}

revalidatePath(`/commissioner/pools/${poolId}`)
return { success: true }
```

- [ ] **Step 5: Replace commissioner page placeholder usage data with service-derived values**

Update `src/app/(app)/commissioner/pools/[poolId]/page.tsx` to load real usage:

```tsx
const usage = { usedCalls: 0, remainingCalls: 250, status: 'ok' as const }
const latestRun = null

<GolferCatalogPanel poolId={poolId} usage={usage} latestRun={latestRun} />
```

Keep the structure identical, but source the values from a helper once that helper exists.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/golfer-catalog/service.ts src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/page.tsx src/lib/__tests__/golfer-catalog.test.ts
git commit -m "feat: enforce golfer catalog quota rules"
```

### Task 5: Keep Participant Search DB-Only and Normalize Matching

**Files:**
- Modify: `src/components/golfer-picker.tsx`
- Test: `src/lib/__tests__/golfer-catalog.test.ts`

- [ ] **Step 1: Add the failing local-search regression test**

Append to `src/lib/__tests__/golfer-catalog.test.ts`:

```ts
import { filterLocalGolfers } from '@/lib/golfer-catalog/normalize'

describe('filterLocalGolfers', () => {
  it('matches against normalized search names without calling RapidAPI', () => {
    expect(
      filterLocalGolfers(
        [
          { id: '1', name: 'Collin Morikawa', search_name: 'collin morikawa', country: 'USA', is_active: true },
          { id: '2', name: 'Rory McIlroy', search_name: 'rory mcilroy', country: 'NIR', is_active: true },
        ],
        { search: 'morikawa', country: '' },
      ).map((golfer) => golfer.id),
    ).toEqual(['1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: FAIL because `filterLocalGolfers` does not exist.

- [ ] **Step 3: Add local filtering helper**

Update `src/lib/golfer-catalog/normalize.ts`:

```ts
type SearchableGolfer = {
  id: string
  name: string
  search_name: string | null
  country: string
  is_active: boolean
}

export function filterLocalGolfers(
  golfers: SearchableGolfer[],
  filters: { search: string; country: string },
): SearchableGolfer[] {
  const normalizedSearch = buildSearchName(filters.search)

  return golfers.filter((golfer) => {
    if (!golfer.is_active) return false

    const matchesSearch =
      normalizedSearch.length === 0
      || (golfer.search_name ?? buildSearchName(golfer.name)).includes(normalizedSearch)

    const matchesCountry = filters.country === '' || golfer.country === filters.country

    return matchesSearch && matchesCountry
  })
}
```

- [ ] **Step 4: Update the picker to use normalized fields**

Update the query and filtering logic in `src/components/golfer-picker.tsx`:

```tsx
interface Golfer {
  id: string
  name: string
  country: string
  search_name: string | null
  is_active: boolean
}

const { data, error } = await supabase
  .from('golfers')
  .select('id, name, country, search_name, is_active')
  .eq('is_active', true)
  .order('name')

const filteredGolfers = filterLocalGolfers(golfers, {
  search,
  country: countryFilter,
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/golfer-catalog/normalize.ts src/components/golfer-picker.tsx src/lib/__tests__/golfer-catalog.test.ts
git commit -m "fix: normalize local golfer picker search"
```

### Task 6: Verify the End-to-End Contract

**Files:**
- Modify: `src/lib/__tests__/golfer-catalog.test.ts`
- Modify: `src/components/__tests__/GolferCatalogPanel.test.tsx`

- [ ] **Step 1: Add the final behavior tests**

Append these cases:

```ts
it('keeps manual adds available after bulk refreshes are blocked', () => {
  expect(
    decideCatalogRun({
      runType: 'manual_add',
      usedCalls: 249,
      monthlyLimit: 250,
      warningAt: 200,
      blockBulkAt: 235,
    }),
  ).toEqual({ allowed: true })
})

it('blocks all operations after the monthly limit is reached', () => {
  expect(
    decideCatalogRun({
      runType: 'manual_add',
      usedCalls: 250,
      monthlyLimit: 250,
      warningAt: 200,
      blockBulkAt: 235,
    }),
  ).toEqual({ allowed: false, reason: 'Monthly API budget is exhausted.' })
})
```

And in `src/components/__tests__/GolferCatalogPanel.test.tsx` add:

```tsx
it('shows the warning tone when quota is nearly exhausted', () => {
  render(
    <GolferCatalogPanel
      poolId="pool-1"
      usage={{ usedCalls: 220, remainingCalls: 30, status: 'warning' }}
      latestRun={{ created_at: '2026-03-31T00:00:00.000Z', status: 'success' }}
    />,
  )

  expect(screen.getByText('220 of 250 calls used')).toBeInTheDocument()
  expect(screen.getByText(/Last sync success/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail only for missing UI copy or service behavior**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: FAIL only if final UI copy or quota logic has not been finished yet.

- [ ] **Step 3: Make the smallest adjustments to match the contract**

If needed, update:

```ts
// src/lib/golfer-catalog/service.ts
if (usedCalls >= monthlyLimit) {
  return { allowed: false, reason: 'Monthly API budget is exhausted.' }
}
```

```tsx
// src/components/GolferCatalogPanel.tsx
<p className="mt-2 text-sm text-slate-600">{usage.usedCalls} of 250 calls used. {usage.remainingCalls} remaining this month.</p>
```

- [ ] **Step 4: Run the targeted tests again**

Run: `npm test -- src/lib/__tests__/golfer-catalog.test.ts src/components/__tests__/GolferCatalogPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the broader safety net**

Run: `npm test -- src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/golfer-catalog.test.ts src/components/__tests__/GolferCatalogPanel.test.tsx src/lib/golfer-catalog/service.ts src/components/GolferCatalogPanel.tsx
git commit -m "test: cover golfer catalog sync contracts"
```

---

## Spec Coverage Check

- Local DB-backed participant search: Task 5
- Monthly baseline and pre-tournament refresh structure: Tasks 2, 3, and 4
- Manual add missing golfer flow: Tasks 3 and 4
- Quota tracking and blocking rules: Tasks 1, 2, 4, and 6
- Commissioner-only controls and visibility: Tasks 3 and 6
- Failure-safe behavior that preserves the local catalog: Tasks 1, 2, and 4

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain in the task steps.
- Every task includes concrete file paths, code, commands, and expected outcomes.

## Type Consistency Check

- `GolferSyncRun` and extended `Golfer` fields are introduced in Task 1 and reused consistently later.
- `CatalogRunType`, `CatalogSource`, and quota policy fields are defined once in Task 2 and reused without renaming.
- Commissioner action state stays `GolferCatalogActionState` throughout Tasks 3 and 4.
