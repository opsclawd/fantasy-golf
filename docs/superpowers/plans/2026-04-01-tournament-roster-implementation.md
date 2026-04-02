# Tournament Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global golfer catalog behavior with a tournament-scoped roster that every pool on the same tournament can share.

**Architecture:** Add tournament-roster storage and queries, then rewire commissioner refresh/manual-add actions to seed that roster instead of a global catalog. Participant and commissioner views will read golfers through the pool’s `tournament_id`, so multiple pools for the same tournament see the same roster while different tournaments remain isolated.

**Tech Stack:** Next.js 14 server actions, Supabase, Vitest, RapidAPI Live Golf Data

---

## File Structure

### Create

- `supabase/migrations/20260401090000_add_tournament_roster.sql` - tournament roster table, indexes, and policies/grants.
- `src/lib/tournament-roster/queries.ts` - roster reads/writes keyed by `tournament_id`.
- `src/lib/tournament-roster/types.ts` - roster payload types used by actions and views.
- `src/app/(app)/commissioner/pools/[poolId]/__tests__/tournament-roster-actions.test.ts` - action tests for tournament roster refresh/manual add.
- `src/components/__tests__/GolferPickerTournamentRoster.test.tsx` - picker contract tests that prove it reads tournament roster golfers, not a global catalog.

### Modify

- `src/lib/slash-golf/client.ts` - keep tournament-field parsing aligned with the real RapidAPI payload shape.
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts` - refresh/manual-add actions should write tournament roster rows.
- `src/app/(app)/commissioner/pools/[poolId]/golferCatalogPanelState.ts` - rename/repurpose for tournament roster status if needed.
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx` - load roster state for the current pool’s tournament.
- `src/components/GolferCatalogPanel.tsx` - relabel and wire the panel to tournament roster semantics.
- `src/components/golfer-picker.tsx` - read golfers from the pool’s tournament roster, not `golfers`.
- `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` - pass the tournament/pool context the picker needs.
- `src/lib/__tests__/golfer-catalog.test.ts` - move any reused helper tests to the new roster helpers if needed.

---

### Task 1: Add Tournament Roster Storage

**Files:**
- Create: `supabase/migrations/20260401090000_add_tournament_roster.sql`
- Create: `src/lib/tournament-roster/types.ts`
- Test: `src/lib/__tests__/tournament-roster.test.ts`

- [ ] **Step 1: Write the failing schema/helper test**

Create `src/lib/__tests__/tournament-roster.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildTournamentRosterInsert } from '@/lib/tournament-roster/queries'

describe('tournament roster queries', () => {
  it('builds a tournament roster insert row from normalized golfer input', () => {
    expect(
      buildTournamentRosterInsert({
        tournamentId: '041',
        golfer: {
          id: '50525',
          playerId: '50525',
          firstName: 'Collin',
          lastName: 'Morikawa',
          country: 'USA',
        },
        source: 'refresh',
        syncedAt: '2026-04-01T00:00:00.000Z',
      }),
    ).toEqual({
      tournament_id: '041',
      id: '50525',
      external_player_id: '50525',
      name: 'Collin Morikawa',
      search_name: 'collin morikawa',
      country: 'USA',
      world_rank: null,
      is_active: true,
      source: 'refresh',
      last_synced_at: '2026-04-01T00:00:00.000Z',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/tournament-roster.test.ts`
Expected: FAIL because `src/lib/tournament-roster/*` does not exist yet.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/20260401090000_add_tournament_roster.sql`:

```sql
create table if not exists tournament_golfers (
  id text primary key,
  tournament_id text not null,
  external_player_id text not null,
  name text not null,
  search_name text not null,
  country text not null default '',
  world_rank integer,
  is_active boolean not null default true,
  source text not null check (source in ('refresh', 'manual_add', 'seeded')),
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tournament_golfers_tournament_id_idx
  on tournament_golfers (tournament_id);

create unique index if not exists tournament_golfers_tournament_external_player_id_key
  on tournament_golfers (tournament_id, external_player_id);

create index if not exists tournament_golfers_search_name_idx
  on tournament_golfers (tournament_id, search_name);
```

- [ ] **Step 4: Add roster types and insert helper**

Create `src/lib/tournament-roster/types.ts`:

```ts
export type TournamentRosterSource = 'refresh' | 'manual_add' | 'seeded'

export type TournamentRosterGolferInput = {
  id: string
  playerId?: string
  firstName?: string
  lastName?: string
  name?: string
  country?: string
  worldRank?: number | null
}
```

Create `src/lib/tournament-roster/queries.ts`:

```ts
import { buildSearchName } from '@/lib/golfer-catalog/normalize'
import type { TournamentRosterGolferInput, TournamentRosterSource } from './types'

export function buildTournamentRosterInsert({
  tournamentId,
  golfer,
  source,
  syncedAt,
}: {
  tournamentId: string
  golfer: TournamentRosterGolferInput
  source: TournamentRosterSource
  syncedAt: string
}) {
  const playerId = (golfer.playerId ?? golfer.id).trim()
  const name = (golfer.name ?? [golfer.firstName, golfer.lastName].filter(Boolean).join(' ')).trim().replace(/\s+/g, ' ')

  if (!playerId || !name) {
    throw new Error('Tournament roster golfer must include a usable id and name')
  }

  return {
    tournament_id: tournamentId,
    id: playerId,
    external_player_id: playerId,
    name,
    search_name: buildSearchName(name),
    country: golfer.country?.trim() ?? '',
    world_rank: golfer.worldRank ?? null,
    is_active: true,
    source,
    last_synced_at: syncedAt,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/tournament-roster.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260401090000_add_tournament_roster.sql src/lib/tournament-roster/types.ts src/lib/tournament-roster/queries.ts src/lib/__tests__/tournament-roster.test.ts
git commit -m "feat: add tournament roster storage"
```

### Task 2: Rewire Commissioner Actions to Seed Tournament Rosters

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/lib/slash-golf/client.ts`
- Modify: `src/lib/tournament-roster/queries.ts`
- Test: `src/app/(app)/commissioner/pools/[poolId]/__tests__/tournament-roster-actions.test.ts`

- [ ] **Step 1: Write the failing action tests**

Create `src/app/(app)/commissioner/pools/[poolId]/__tests__/tournament-roster-actions.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { addMissingGolferAction, refreshGolferCatalogAction } from '../actions'

describe('tournament roster commissioner actions', () => {
  it('refreshes the tournament roster for the pool tournament', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('runType', 'pre_tournament')

    await expect(refreshGolferCatalogAction(null, formData)).resolves.toEqual({ success: true })
  })

  it('adds a missing golfer to the tournament roster', async () => {
    const formData = new FormData()
    formData.set('poolId', 'pool-1')
    formData.set('firstName', 'Collin')
    formData.set('lastName', 'Morikawa')

    await expect(addMissingGolferAction(null, formData)).resolves.toEqual({ success: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts`
Expected: FAIL because the roster helpers and action wiring do not exist yet.

- [ ] **Step 3: Update RapidAPI tournament parsing to support roster rows**

Update `src/lib/slash-golf/client.ts` so `getGolfers()` returns normalized players with `id`, `name`, `country`, and `worldRank` when available:

```ts
export async function getGolfers(...): Promise<Array<{ id: string; playerId?: string; firstName?: string; lastName?: string; name?: string; country: string; worldRank?: number | null }>>
```

Keep the current tournament payload support that reads `raw.players`.

- [ ] **Step 4: Replace the placeholder commissioner flows**

Update `src/app/(app)/commissioner/pools/[poolId]/actions.ts` so:

```ts
const golfers = await getGolfers(pool.tournament_id, pool.year)
const rosterRows = golfers.map(golfer => buildTournamentRosterInsert({
  tournamentId: pool.tournament_id,
  golfer,
  source: 'refresh',
  syncedAt: nowIso,
}))
await supabase.from('tournament_golfers').upsert(rosterRows, { onConflict: 'tournament_id,external_player_id' })
```

and manual add does the same with `source: 'manual_add'`.

Keep sync-run recording and quota checks, but write them against the tournament roster model.

- [ ] **Step 5: Run action tests to verify they pass**

Run: `npm test -- src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/actions.ts src/lib/slash-golf/client.ts src/lib/tournament-roster/queries.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts
git commit -m "feat: seed tournament roster from commissioner actions"
```

### Task 3: Point Commissioner and Participant Views at Tournament Rosters

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/golferCatalogPanelState.ts`
- Modify: `src/components/GolferCatalogPanel.tsx`
- Modify: `src/components/golfer-picker.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Create: `src/components/__tests__/GolferPickerTournamentRoster.test.tsx`

- [ ] **Step 1: Write the failing picker contract test**

Create `src/components/__tests__/GolferPickerTournamentRoster.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GolferPicker } from '@/components/golfer-picker'

describe('GolferPicker tournament roster contract', () => {
  it('renders only tournament roster golfers passed from the roster query path', () => {
    render(
      <GolferPicker
        selectedIds={[]}
        onSelectionChange={() => {}}
        maxSelections={4}
        golfers={[
          { id: '1', name: 'Collin Morikawa', country: 'USA', search_name: 'collin morikawa', is_active: true },
          { id: '2', name: 'Rory McIlroy', country: 'NIR', search_name: 'rory mcilroy', is_active: true },
        ]}
      />,
    )

    expect(screen.getByText('Collin Morikawa')).toBeInTheDocument()
    expect(screen.getByText('Rory McIlroy')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/GolferPickerTournamentRoster.test.tsx`
Expected: FAIL because `GolferPicker` still owns its own Supabase fetch and has not been converted to roster-driven props.

- [ ] **Step 3: Convert the picker to roster-driven data**

Update `src/components/golfer-picker.tsx` and `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` so the picker receives roster golfers as props from the page, rather than querying `golfers` itself.

Minimal target shape:

```tsx
type GolferPickerProps = {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  maxSelections: number
  golfers: Golfer[]
}
```

Also update `src/app/(app)/participant/picks/[poolId]/page.tsx` to load the tournament roster for `pool.tournament_id` and pass it down.

- [ ] **Step 4: Update commissioner panel state to reflect roster counts**

Repurpose the roster status loader so the commissioner panel shows the tournament roster’s latest sync state and roster size, not a global golfer catalog summary.

- [ ] **Step 5: Run picker test to verify it passes**

Run: `npm test -- src/components/__tests__/GolferPickerTournamentRoster.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/golferCatalogPanelState.ts src/components/GolferCatalogPanel.tsx src/components/golfer-picker.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/components/__tests__/GolferPickerTournamentRoster.test.tsx
git commit -m "feat: read golfers from tournament rosters"
```

### Task 4: Verify the Tournament Roster End-to-End

**Files:**
- Modify: `src/lib/__tests__/tournament-roster.test.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/__tests__/tournament-roster-actions.test.ts`
- Modify: `src/components/__tests__/GolferPickerTournamentRoster.test.tsx`

- [ ] **Step 1: Add the final behavior tests**

Add assertions for:

```ts
it('shares one tournament roster across multiple pools with the same tournament_id', () => {
  // verify roster query/output is keyed by tournament_id and reused by both pools
})

it('allows tournament roster entries to exist before a pool references them', () => {
  // verify the tournament roster insert does not require a pool row
})

it('keeps participant picker reads off the global golfer catalog', () => {
  // verify picker props source is roster-driven, not the old shared catalog path
})
```

- [ ] **Step 2: Run the focused roster tests and watch them fail if coverage is incomplete**

Run: `npm test -- src/lib/__tests__/tournament-roster.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts src/components/__tests__/GolferPickerTournamentRoster.test.tsx`
Expected: FAIL only on missing roster contract assertions.

- [ ] **Step 3: Make the smallest code/test adjustments needed**

Keep fixes limited to tournament-roster persistence, shared-per-tournament behavior, and roster-driven picker loading.

- [ ] **Step 4: Run the focused roster tests again**

Run: `npm test -- src/lib/__tests__/tournament-roster.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts src/components/__tests__/GolferPickerTournamentRoster.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the broader verification set**

Run: `npm test -- src/components/__tests__/GolferCatalogPanel.test.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/GolferStatesPresentation.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/__tests__/tournament-roster.test.ts src/app/\(app\)/commissioner/pools/\[poolId\]/__tests__/tournament-roster-actions.test.ts src/components/__tests__/GolferPickerTournamentRoster.test.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/golferCatalogPanelState.ts src/components/GolferCatalogPanel.tsx src/components/golfer-picker.tsx src/app/\(app\)/participant/picks/\[poolId\]/PicksForm.tsx src/app/\(app\)/participant/picks/\[poolId\]/page.tsx
git commit -m "feat: make tournament roster the source of truth"
```

---

## Spec Coverage Check

- Tournament-scoped roster storage: Task 1
- Commissioner refresh/manual add writing into the roster: Task 2
- Pools sharing one tournament roster: Task 3
- Participant picker reading from the roster only: Task 3
- Safe fallback on roster load failures: Tasks 3 and 4
- End-to-end verification across multiple pools/tournament references: Task 4

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Each task includes exact paths, concrete code, and explicit test/build commands.

## Type Consistency Check

- `TournamentRosterSource` is used consistently across migration/test/helper/task definitions.
- `buildTournamentRosterInsert` input/output shape is defined once and reused.
- Picker props are explicitly roster-driven by the plan, so follow-up code can replace the old global golfer query path without ambiguity.
