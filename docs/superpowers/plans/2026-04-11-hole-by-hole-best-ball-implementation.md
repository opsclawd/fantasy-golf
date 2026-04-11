# Hole-by-Hole Best Ball — Implementation Plan

> For agentic workers: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox syntax.

**Goal:** Persist verified hole-by-hole scorecard data in `tournament_holes`, calculate best-ball contributions across all stored rounds, and show an honest `X of Y holes` metric on the picks page.

**Architectural choices locked in by this plan:**

1. One new table only: `tournament_holes`
2. No `tournament_completed_rounds` table
3. No durable claim table
4. One scorecard fetch per golfer, not per golfer-round
5. Missing rounds are detected by comparing `tournament_score_rounds` to `tournament_holes`
6. `Y` is entry-level shared across golfers in the same entry
7. Hole reads stay server-only via `createAdminClient()` after membership validation
8. Hole-sync failures are non-fatal to leaderboard refresh

---

## File Map

```text
supabase/migrations/
  <ts>_add_tournament_holes.sql

src/
  lib/
    slash-golf/
      types.ts
      client.ts
    supabase/
      types.ts
      admin.ts                          # existing helper used by picks page
    scoring-queries.ts
    scoring.ts
    scoring-refresh.ts
    golfer-detail.ts
    __tests__/
      scoring.test.ts
      golfer-detail.test.ts
  app/
    (app)/
      participant/
        picks/
          [poolId]/
            page.tsx
  components/
    EntryGolferBreakdown.tsx
    GolferContribution.tsx

package.json
package-lock.json
```

---

## Task 1: Create `tournament_holes` migration

**Files:**
- Create: `supabase/migrations/<ts>_add_tournament_holes.sql`

- [ ] **Step 1: Read an existing migration first**

Read a recent migration in `supabase/migrations/` so you match the repo's SQL style.

- [ ] **Step 2: Create the migration**

```sql
CREATE TABLE tournament_holes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  round_id INTEGER NOT NULL CHECK (round_id BETWEEN 1 AND 4),
  hole_id INTEGER NOT NULL CHECK (hole_id BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL,
  par INTEGER NOT NULL,
  score_to_par INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(golfer_id, tournament_id, round_id, hole_id)
);

CREATE INDEX idx_tournament_holes_lookup
  ON tournament_holes(tournament_id, golfer_id, round_id);

ALTER TABLE tournament_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_holes_service_role_all"
  ON tournament_holes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_holes TO service_role;
```

Notes:

- Do not add an `authenticated USING (true)` read policy.
- Picks-page reads will use `createAdminClient()` after membership validation.

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_add_tournament_holes.sql
git commit -m "feat: add tournament_holes table for verified hole scores"
```

---

## Task 2: Add scorecard types to `src/lib/slash-golf/types.ts`

**Files:**
- Modify: `src/lib/slash-golf/types.ts`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Add scorecard types at the end of the file**

```ts
export interface ScorecardHole {
  holeId: number
  holeScore: number
  par: number
}

export interface ScorecardRound {
  roundId: number
  roundComplete: boolean
  currentHole: number
  currentRoundScore: string
  holes: Record<string, ScorecardHole>
  totalShots: number
}

export type ScorecardResponse = ScorecardRound[]
```

Important:

- The confirmed API field is `holeScore`, not `strokes`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/slash-golf/types.ts
git commit -m "feat(slash-golf): add scorecard response types"
```

---

## Task 3: Add `getGolfersScorecard()` to `src/lib/slash-golf/client.ts`

**Files:**
- Modify: `src/lib/slash-golf/client.ts`

- [ ] **Step 1: Read the file, especially the existing parsing/error style**

- [ ] **Step 2: Extend the import**

Add `ScorecardResponse` to the existing type import.

- [ ] **Step 3: Add the function at the end of the file**

```ts
export async function getGolfersScorecard(
  tournamentId: string,
  golferId: string,
  year?: number
): Promise<ScorecardResponse> {
  const params = new URLSearchParams({
    orgId: '1',
    tournId: tournamentId,
    playerId: golferId,
    ...(year && { year: year.toString() }),
  })

  const res = await fetch(`${BASE_URL}/scorecard?${params}`, {
    headers: { 'X-RapidAPI-Key': process.env.SLASH_GOLF_API_KEY ?? '' },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[slash-golf] scorecard fetch failed', {
      golferId,
      tournamentId,
      status: res.status,
      statusText: res.statusText,
      body,
    })
    throw new Error('Failed to fetch scorecard')
  }

  return res.json()
}
```

Rules:

- pass `year` through from the refresh path
- do not add caching here
- keep this server-only

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/slash-golf/client.ts
git commit -m "feat(slash-golf): add getGolfersScorecard for hole sync"
```

---

## Task 4: Add `TournamentHole` and hole query helpers

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/scoring-queries.ts`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Add `TournamentHole` to `src/lib/supabase/types.ts`**

```ts
export interface TournamentHole {
  golfer_id: string
  tournament_id: string
  round_id: number
  hole_id: number
  strokes: number
  par: number
  score_to_par: number
  updated_at?: string
}
```

- [ ] **Step 3: Add helpers to `src/lib/scoring-queries.ts`**

Add `TournamentHole` to the existing import from `./supabase/types`.

Then add these functions near the end of the file:

```ts
export async function upsertTournamentHoles(
  supabase: SupabaseClient,
  holes: TournamentHole[]
): Promise<{ error: string | null }> {
  if (holes.length === 0) return { error: null }

  const { error } = await supabase
    .from('tournament_holes')
    .upsert(holes, { onConflict: 'golfer_id,tournament_id,round_id,hole_id' })

  if (error) return { error: error.message }
  return { error: null }
}

export async function getTournamentHolesForGolfers(
  supabase: SupabaseClient,
  tournamentId: string,
  golferIds: string[]
): Promise<Map<string, TournamentHole[]>> {
  const { data, error } = await supabase
    .from('tournament_holes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('golfer_id', golferIds)

  if (error) throw new Error(`Failed to fetch tournament holes: ${error.message}`)

  const result = new Map<string, TournamentHole[]>()
  for (const hole of data ?? []) {
    const existing = result.get(hole.golfer_id) ?? []
    existing.push(hole)
    result.set(hole.golfer_id, existing)
  }

  return result
}

export async function getArchivedRoundsForTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<Array<{ golfer_id: string; round_id: number }>> {
  const { data, error } = await supabase
    .from('tournament_score_rounds')
    .select('golfer_id, round_id')
    .eq('tournament_id', tournamentId)

  if (error) throw new Error(`Failed to fetch archived rounds: ${error.message}`)

  return (data ?? []) as Array<{ golfer_id: string; round_id: number }>
}

export async function getStoredHoleRoundKeysForTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('tournament_holes')
    .select('golfer_id, round_id')
    .eq('tournament_id', tournamentId)

  if (error) throw new Error(`Failed to fetch stored hole rounds: ${error.message}`)

  return new Set(
    (data ?? []).map((row: { golfer_id: string; round_id: number }) => `${row.golfer_id}-${row.round_id}`)
  )
}
```

Notes:

- `getStoredHoleRoundKeysForTournament()` intentionally deduplicates in memory.
- Do not add claim-table helpers. They are not part of the final design.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/scoring-queries.ts
git commit -m "feat(scoring): add tournament hole types and queries"
```

---

## Task 5: Add `calculateHoleContributions()` to `src/lib/scoring.ts`

**Files:**
- Modify: `src/lib/scoring.ts`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Extend the import from `./supabase/types`**

Add `TournamentHole`.

- [ ] **Step 3: Add a return type**

```ts
export interface HoleContributionSummary {
  contributingHoles: number
  totalCompletedHoles: number
  hasPartialData: boolean
}
```

- [ ] **Step 4: Add `calculateHoleContributions()` after the existing round-score helpers**

```ts
export function calculateHoleContributions(
  entryGolferIds: string[],
  holesByGolfer: Map<string, TournamentHole[]>
): Map<string, HoleContributionSummary> {
  const result = new Map<string, HoleContributionSummary>()
  const entrySet = new Set(entryGolferIds)

  for (const golferId of entryGolferIds) {
    result.set(golferId, {
      contributingHoles: 0,
      totalCompletedHoles: 0,
      hasPartialData: false,
    })
  }

  const holesIndex = new Map<string, Array<{ golferId: string; strokes: number }>>()

  for (const [golferId, holes] of holesByGolfer) {
    if (!entrySet.has(golferId)) continue

    for (const hole of holes) {
      const key = `${hole.round_id}-${hole.hole_id}`
      if (!holesIndex.has(key)) holesIndex.set(key, [])
      holesIndex.get(key)!.push({ golferId, strokes: hole.strokes })
    }
  }

  for (const entries of holesIndex.values()) {
    if (entries.length === 0) continue

    const golfersWithData = new Set(entries.map((entry) => entry.golferId))
    const isPartial = golfersWithData.size < entryGolferIds.length
    const bestBall = Math.min(...entries.map((entry) => entry.strokes))

    for (const golferId of entryGolferIds) {
      result.get(golferId)!.totalCompletedHoles += 1
      if (isPartial) {
        result.get(golferId)!.hasPartialData = true
      }
    }

    for (const entry of entries) {
      if (entry.strokes === bestBall) {
        result.get(entry.golferId)!.contributingHoles += 1
      }
    }
  }

  return result
}
```

Rules this function must enforce:

- shared denominator: every golfer in the entry gets the same `totalCompletedHoles`
- tie credit: every golfer tied for best ball gets credit
- partial flag: if any stored hole is missing one or more entry golfers, set `hasPartialData` for the whole entry

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts
git commit -m "feat(scoring): add hole contribution calculation"
```

---

## Task 6: Extend `src/lib/scoring-refresh.ts` to sync hole data

**Files:**
- Modify: `src/lib/scoring-refresh.ts`

- [ ] **Step 1: Read the full file carefully**

Important current behavior to preserve:

- leaderboard fetch/upsert failures are fatal
- pool freshness metadata is updated on successful core refresh
- broadcasts and audit events still happen

- [ ] **Step 2: Install `p-limit`**

```bash
npm install p-limit
```

- [ ] **Step 3: Update imports**

Add:

```ts
import { getTournamentScores, getGolfersScorecard } from '@/lib/slash-golf/client'
import {
  upsertTournamentScore,
  getScoresForTournament,
  upsertTournamentHoles,
  getArchivedRoundsForTournament,
  getStoredHoleRoundKeysForTournament,
} from '@/lib/scoring-queries'
import type { TournamentHole } from '@/lib/supabase/types'
import type { ScorecardRound } from '@/lib/slash-golf/types'
import pLimit from 'p-limit'
```

- [ ] **Step 4: Add helper to build `TournamentHole[]` from one verified round**

```ts
function buildTournamentHolesFromRound(
  golferId: string,
  tournamentId: string,
  round: ScorecardRound
): TournamentHole[] {
  if (!round.roundComplete) return []
  if (Object.keys(round.holes).length === 0) return []

  return Object.values(round.holes).map((hole) => ({
    golfer_id: golferId,
    tournament_id: tournamentId,
    round_id: round.roundId,
    hole_id: hole.holeId,
    strokes: hole.holeScore,
    par: hole.par,
    score_to_par: hole.holeScore - hole.par,
  }))
}
```

- [ ] **Step 5: Add helper to build missing rounds grouped by golfer**

Add a helper like this:

```ts
function buildMissingHoleRoundsByGolfer(
  slashScores: Array<{ golfer_id: string; thru?: number | null; current_round?: number | null }>,
  archivedRounds: Array<{ golfer_id: string; round_id: number }>,
  storedHoleRoundKeys: Set<string>
): Map<string, Set<number>> {
  const missingByGolfer = new Map<string, Set<number>>()

  function addMissing(golferId: string, roundId: number) {
    const key = `${golferId}-${roundId}`
    if (storedHoleRoundKeys.has(key)) return

    if (!missingByGolfer.has(golferId)) {
      missingByGolfer.set(golferId, new Set<number>())
    }

    missingByGolfer.get(golferId)!.add(roundId)
  }

  for (const golferScore of slashScores) {
    if (golferScore.thru === 18 && golferScore.current_round != null) {
      addMissing(golferScore.golfer_id, golferScore.current_round)
    }
  }

  for (const round of archivedRounds) {
    addMissing(round.golfer_id, round.round_id)
  }

  return missingByGolfer
}
```

- [ ] **Step 6: Add helper to fetch one golfer once and store all missing verified rounds**

```ts
async function fetchAndStoreMissingRoundsForGolfer(
  supabase: SupabaseClient,
  tournamentId: string,
  golferId: string,
  year: number,
  missingRoundIds: Set<number>
): Promise<{ storedRoundIds: number[]; error: string | null }> {
  let scorecard

  try {
    scorecard = await getGolfersScorecard(tournamentId, golferId, year)
  } catch (error) {
    return {
      storedRoundIds: [],
      error: error instanceof Error ? error.message : 'Scorecard fetch failed',
    }
  }

  const storedRoundIds: number[] = []

  for (const round of scorecard) {
    if (!missingRoundIds.has(round.roundId)) continue
    if (!round.roundComplete) continue
    if (Object.keys(round.holes).length === 0) continue

    const holes = buildTournamentHolesFromRound(golferId, tournamentId, round)
    const result = await upsertTournamentHoles(supabase, holes)
    if (result.error) {
      return { storedRoundIds, error: result.error }
    }

    storedRoundIds.push(round.roundId)
  }

  return { storedRoundIds, error: null }
}
```

- [ ] **Step 7: Insert hole-sync logic into `refreshScoresForPool()`**

Insert this after the core score upsert success check and before refresh metadata/broadcast work:

```ts
const storedHoleRoundKeys = await getStoredHoleRoundKeysForTournament(supabase, pool.tournament_id)
const archivedRounds = await getArchivedRoundsForTournament(supabase, pool.tournament_id)
const missingByGolfer = buildMissingHoleRoundsByGolfer(
  slashScores,
  archivedRounds,
  storedHoleRoundKeys,
)

const holeSyncFailures: Array<{ golferId: string; error: string }> = []
const limit = pLimit(3)

await Promise.all(
  Array.from(missingByGolfer.entries()).map(([golferId, roundIds]) =>
    limit(async () => {
      const result = await fetchAndStoreMissingRoundsForGolfer(
        supabase,
        pool.tournament_id,
        golferId,
        pool.year,
        roundIds,
      )

      if (result.error) {
        holeSyncFailures.push({ golferId, error: result.error })
      }
    })
  )
)
```

- [ ] **Step 8: Preserve the refresh contract**

Make these behavior decisions explicit in code comments and implementation:

1. Do not add new fatal return paths for hole-sync failures.
2. Do not set `last_refresh_error` because hole sync failed.
3. Do include hole-sync summary in the later audit event details.

Example addition to the audit details payload:

```ts
holeContributionSync: {
  attemptedGolfers: missingByGolfer.size,
  failedGolfers: holeSyncFailures.length,
}
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/scoring-refresh.ts package.json package-lock.json
git commit -m "feat(scoring-refresh): sync missing hole data during refresh"
```

---

## Task 7: Update `src/lib/golfer-detail.ts`

**Files:**
- Modify: `src/lib/golfer-detail.ts`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Update imports**

Add:

```ts
import { calculateHoleContributions } from './scoring'
import type { TournamentHole } from './supabase/types'
```

- [ ] **Step 3: Remove dead contribution types and function**

Delete:

- `RoundContribution`
- `GolferContribution`
- `getGolferContribution()`

These are the old misleading total-score-based contribution helpers.

- [ ] **Step 4: Update `GolferSummary`**

Use:

```ts
export interface GolferSummary {
  golferId: string
  name: string
  country: string
  status: GolferStatus
  totalScore: number
  totalBirdies: number
  completedRounds: number
  contributingHoles: number
  totalCompletedHoles: number
  hasPartialData: boolean
}
```

- [ ] **Step 5: Update `getEntryGolferSummaries()` signature**

```ts
export function getEntryGolferSummaries(
  entryGolferIds: string[],
  golferScores: Map<string, TournamentScore>,
  golfers: GolferLike[],
  holesByGolfer?: Map<string, TournamentHole[]>
): GolferSummary[]
```

- [ ] **Step 6: Compute contribution summaries once, outside the per-golfer map**

Use this pattern:

```ts
const contributions = holesByGolfer && holesByGolfer.size > 0
  ? calculateHoleContributions(entryGolferIds, holesByGolfer)
  : new Map()

return entryGolferIds.map((golferId) => {
  // existing golfer + score lookup
  const contribution = contributions.get(golferId)

  return {
    golferId,
    name: golfer?.name ?? golferId,
    country: golfer?.country ?? '',
    status: scorecard.status,
    totalScore: scorecard.totalScore,
    totalBirdies: score?.total_birdies ?? 0,
    completedRounds: scorecard.completedRounds,
    contributingHoles: contribution?.contributingHoles ?? 0,
    totalCompletedHoles: contribution?.totalCompletedHoles ?? 0,
    hasPartialData: contribution?.hasPartialData ?? false,
  }
})
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/golfer-detail.ts
git commit -m "refactor(golfer-detail): use hole-based contribution summaries"
```

---

## Task 8: Update `src/components/GolferContribution.tsx`

**Files:**
- Modify: `src/components/GolferContribution.tsx`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Replace the old rounds text**

Replace:

```tsx
{summary.contributingRounds > 0 && (
  <span className="ml-2">
    Counted in {summary.contributingRounds} round{summary.contributingRounds !== 1 ? 's' : ''}
  </span>
)}
```

With:

```tsx
{summary.totalCompletedHoles > 0 && (
  <span className="ml-2">
    {summary.contributingHoles} of {summary.totalCompletedHoles} holes
    {summary.hasPartialData && (
      <span className="text-amber-600"> (partial)</span>
    )}
  </span>
)}
```

Rules:

- never render `0 of 0 holes`
- `(partial)` is only shown when `hasPartialData` is true

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/GolferContribution.tsx
git commit -m "fix: show hole contribution metric on golfer rows"
```

---

## Task 9: Update picks page and `EntryGolferBreakdown`

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/components/EntryGolferBreakdown.tsx`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Keep auth and membership checks where they are**

Do not move or weaken existing auth checks.

- [ ] **Step 3: In `page.tsx`, fetch hole data with `createAdminClient()` only after membership passes**

Add imports:

```ts
import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TournamentHole } from '@/lib/supabase/types'
```

After the existing `showBreakdown` score fetch block, add logic like:

```ts
let holesByGolfer = new Map<string, TournamentHole[]>()

if (showBreakdown && existingGolferIds.length > 0) {
  const adminSupabase = createAdminClient()

  try {
    holesByGolfer = await getTournamentHolesForGolfers(
      adminSupabase,
      pool.tournament_id,
      existingGolferIds,
    )
  } catch (error) {
    console.error('Failed to fetch hole contribution data:', error)
    holesByGolfer = new Map()
  }
}
```

Why admin client here:

- the user is already authenticated and validated as a pool member
- `tournament_holes` stays private at the table level
- the page remains the authorization boundary

- [ ] **Step 4: Add an honest syncing state**

In `page.tsx`, compute:

```ts
const hasCompletedRounds = existingGolferIds.some((golferId) => {
  const score = golferScoresMap.get(golferId)
  return (score?.round_id ?? 0) > 0
})

const showHoleSyncNotice = showBreakdown && hasCompletedRounds && holesByGolfer.size === 0
```

Pass that prop into `EntryGolferBreakdown`.

- [ ] **Step 5: Update `EntryGolferBreakdown` props**

Use:

```ts
interface EntryGolferBreakdownProps {
  golferIds: string[]
  golfers: GolferLike[]
  golferScoresRecord: Record<string, TournamentScore>
  holesByGolfer?: Record<string, TournamentHole[]>
  showHoleSyncNotice?: boolean
}
```

- [ ] **Step 6: Convert hole props back to a map and pass through**

Keep this memoized:

```ts
const holesMap = useMemo(
  () => (holesByGolfer ? new Map(Object.entries(holesByGolfer)) : new Map()),
  [holesByGolfer],
)
```

- [ ] **Step 7: Add honest helper copy in `EntryGolferBreakdown`**

Under the `Your Golfers` heading, render:

1. a subtle explanatory line:

```tsx
<p className="text-xs text-gray-500">
  Ties count for each golfer who matched the low score on a hole.
</p>
```

2. a syncing notice when `showHoleSyncNotice` is true:

```tsx
<p className="text-xs text-amber-700">
  Hole contribution details syncing.
</p>
```

This prevents silent failure/absence from being mistaken for zero contribution.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/components/EntryGolferBreakdown.tsx
git commit -m "feat(picks): show stored hole contribution data on picks page"
```

---

## Task 10: Add tests for `calculateHoleContributions()` in `src/lib/__tests__/scoring.test.ts`

**Files:**
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Add imports**

```ts
import { calculateHoleContributions } from '../scoring'
import type { TournamentHole } from '../supabase/types'
```

- [ ] **Step 3: Add a hole helper**

```ts
function makeHole(
  golferId: string,
  roundId: number,
  holeId: number,
  strokes: number,
  par: number,
): TournamentHole {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundId,
    hole_id: holeId,
    strokes,
    par,
    score_to_par: strokes - par,
  }
}
```

- [ ] **Step 4: Add tests that lock in the shared denominator contract**

Add tests for:

1. best-ball winner gets hole credit
2. ties give both golfers credit
3. multi-round aggregation works
4. partial data still uses a shared denominator across the entry
5. no hole data returns zeros

Use this partial-data expectation exactly:

```ts
it('uses a shared denominator when one golfer is missing a hole', () => {
  const holesByGolfer = new Map<string, TournamentHole[]>([
    ['g1', [makeHole('g1', 1, 1, 4, 4)]],
  ])

  const result = calculateHoleContributions(['g1', 'g2'], holesByGolfer)

  expect(result.get('g1')!.totalCompletedHoles).toBe(1)
  expect(result.get('g2')!.totalCompletedHoles).toBe(1)
  expect(result.get('g1')!.hasPartialData).toBe(true)
  expect(result.get('g2')!.hasPartialData).toBe(true)
})
```

This is the most important semantics test in the whole feature.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/lib/__tests__/scoring.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/scoring.test.ts
git commit -m "test: add hole contribution scoring tests"
```

---

## Task 11: Update `src/lib/__tests__/golfer-detail.test.ts`

**Files:**
- Modify: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Remove old `getGolferContribution` tests**

Delete the full `describe('getGolferContribution', ...)` block.

- [ ] **Step 3: Update summary expectations**

Where tests previously asserted on `contributingRounds`, update them to assert on:

- `contributingHoles`
- `totalCompletedHoles`
- `hasPartialData`

For no-hole-data cases, the expected defaults should be:

```ts
contributingHoles: 0
totalCompletedHoles: 0
hasPartialData: false
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/__tests__/golfer-detail.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/golfer-detail.test.ts
git commit -m "test: remove old contribution tests from golfer detail"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

1. Start the app: `npm run dev`
2. Pick a live pool with at least one completed round
3. Trigger refresh: `POST /api/scoring/refresh` with `{ poolId }`
4. Verify hole rows exist:

```bash
npx supabase dbql "SELECT golfer_id, round_id, COUNT(*) FROM tournament_holes GROUP BY golfer_id, round_id ORDER BY golfer_id, round_id;"
```

5. Visit the picks page and verify:
   - the old `Counted in N rounds` copy is gone
   - each golfer row shows `X of Y holes` when hole data exists
   - `(partial)` appears when one golfer is missing hole data for a stored hole
   - the entry-level note explains tie semantics
   - if completed rounds exist but no hole data exists yet, the page shows `Hole contribution details syncing.` instead of a fake zero

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/migrations/<ts>_add_tournament_holes.sql` | NEW - internal hole storage with service-role-only access |
| `src/lib/slash-golf/types.ts` | NEW - scorecard response types |
| `src/lib/slash-golf/client.ts` | NEW - `getGolfersScorecard()` |
| `src/lib/supabase/types.ts` | NEW - `TournamentHole` |
| `src/lib/scoring-queries.ts` | NEW - hole upsert/read helpers and missing-round support queries |
| `src/lib/scoring.ts` | NEW - `calculateHoleContributions()` |
| `src/lib/scoring-refresh.ts` | MODIFY - fetch one scorecard per golfer and backfill missing hole rounds |
| `src/lib/golfer-detail.ts` | MODIFY - remove misleading contribution logic |
| `src/components/GolferContribution.tsx` | MODIFY - render `X of Y holes` metric |
| `src/components/EntryGolferBreakdown.tsx` | MODIFY - add tie explanation and syncing state |
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | MODIFY - read hole data server-side with admin client |
| `src/lib/__tests__/scoring.test.ts` | MODIFY - add hole-contribution tests |
| `src/lib/__tests__/golfer-detail.test.ts` | MODIFY - remove old contribution tests |
| `package.json` / lockfile | MODIFY - add `p-limit` |

## Explicit Non-Goals

- no `tournament_completed_rounds`
- no claim/lease table
- no standalone backfill script
- no leaderboard UI changes
- no real-time in-round hole syncing
