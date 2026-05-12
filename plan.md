# Align Leaderboard GET with Hole-by-Hole Best-Ball Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `GET /api/leaderboard/[poolId]` from round-based pseudo-hole scoring (`tournament_score_rounds` + `rankEntries`) to true hole-by-hole best-ball scoring (`tournament_holes` + `rankEntriesWithHoles`), and update docs that misdescribe the scoring model.

**Architecture:** Replace the deprecated `getTournamentScoreRounds` + `rankEntries` path in the leaderboard GET handler with `getTournamentHolesForGolfers` + `rankEntriesWithHoles`. Build `golferStatuses` as a `Map<string, GolferStatus>` (not a plain object). Keep the response contract identical. Update README and `docs/rules-spec.md` to correctly describe hole-by-hole best-ball.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest, Supabase.

---

## File Structure

| File | Change |
|------|--------|
| `src/app/api/leaderboard/[poolId]/route.ts` | Modify — replace scoring path |
| `src/app/api/leaderboard/[poolId]/route.test.ts` | Modify — update mocks and add coverage |
| `README.md` | Modify — fix round-based description |
| `docs/rules-spec.md` | Modify — fix pseudo-code block |

---

## Task 1: Migrate leaderboard GET to `rankEntriesWithHoles`

**Files:**
- Modify: `src/app/api/leaderboard/[poolId]/route.ts:1-194`

- [ ] **Step 1: Update imports**

Remove:
```typescript
import { rankEntries } from '@/lib/scoring/domain'
import { getTournamentScoreRounds } from '@/lib/scoring-queries'
```

Add:
```typescript
import { rankEntriesWithHoles } from '@/lib/scoring'
import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'
```

Note: Keep `deriveCompletedRounds` from `@/lib/scoring` and `createClient` from `@/lib/supabase/server`.

- [ ] **Step 2: Remove `getTournamentScoreRounds` call and fake hole building (lines 148–161)**

Remove entirely:
```typescript
const scoreRounds = await getTournamentScoreRounds(supabase, pool.tournament_id)
const golferRoundScoresMap: GolferRoundScoresMap = new Map()
for (const round of scoreRounds) {
  if (!golferRoundScoresMap.has(round.golfer_id)) {
    golferRoundScoresMap.set(round.golfer_id, [])
  }
  golferRoundScoresMap.get(round.golfer_id)!.push({
    roundId: round.round_id,
    holeId: 1,
    scoreToPar: round.score_to_par ?? null,
    status: round.status as TournamentScore['status'],
    isComplete: true,
  })
}
```

Also remove the `GolferRoundScoresMap` type import on line 7 since it's no longer needed.

- [ ] **Step 3: Add `getTournamentHolesForGolfers` call after `allGolferIds` collection**

After line 135 (after `allGolferIds` is populated), add:
```typescript
const holesByGolfer = await getTournamentHolesForGolfers(supabase, pool.tournament_id, Array.from(allGolferIds))
```

- [ ] **Step 4: Build `golferStatuses` as `Map<string, GolferStatus>` instead of `Record<string, string>`**

Replace lines 120–127:
```typescript
const golferScoresMap = new Map<string, TournamentScore>()
const golferStatuses: Record<string, string> = {}
for (const score of allScores) {
  const ts = score as TournamentScore
  golferScoresMap.set(ts.golfer_id, ts)
  if (ts.status !== 'active') {
    golferStatuses[ts.golfer_id] = ts.status
  }
}
```

With:
```typescript
const golferScoresMap = new Map<string, TournamentScore>()
const golferStatuses: Map<string, 'active' | 'cut' | 'withdrawn'> = new Map()
for (const score of allScores) {
  const ts = score as TournamentScore
  golferScoresMap.set(ts.golfer_id, ts)
  if (ts.status !== 'active') {
    golferStatuses.set(ts.golfer_id, ts.status as 'active' | 'cut' | 'withdrawn')
  }
}
```

Note: Active golfers are absent from the map — `rankEntriesWithHoles` defaults them to `'active'` via `golferStatuses.get(golferId) ?? 'active'`.

- [ ] **Step 5: Replace `rankEntries` call with `rankEntriesWithHoles`**

Replace line 163:
```typescript
const ranked = rankEntries(entries as never[], golferRoundScoresMap, completedRounds)
```

With:
```typescript
const ranked = rankEntriesWithHoles(entries as never[], holesByGolfer, golferStatuses, completedRounds)
```

- [ ] **Step 6: Handle the empty `tournament_scores` early-return path**

The early return at lines 98–116 also calls `rankEntries`. Update it to use `rankEntriesWithHoles` with empty data:

Replace lines 98–116:
```typescript
if (!allScores || allScores.length === 0) {
  const rankedWithoutScores = rankEntries(entries as never[], new Map() as GolferRoundScoresMap, 0)
```

With:
```typescript
if (!allScores || allScores.length === 0) {
  const rankedWithoutScores = rankEntriesWithHoles(entries as never[], new Map(), new Map(), 0)
```

Remove `GolferRoundScoresMap` type import since it's no longer used anywhere.

- [ ] **Step 7: Run lint and typecheck**

Run: `npm run lint`
Run: `npm run build`

Expected: No errors.

---

## Task 2: Add regression test for hole-level scoring path

**Files:**
- Modify: `src/app/api/leaderboard/[poolId]/route.test.ts`

- [ ] **Step 1: Update existing mocks**

Replace the mock for `@/lib/scoring-queries`:
```typescript
vi.mock('@/lib/scoring-queries', () => ({
  getTournamentScoreRounds: vi.fn(),
}))
```

With:
```typescript
vi.mock('@/lib/scoring-queries', () => ({
  getTournamentHolesForGolfers: vi.fn(),
}))
```

Also update the import at the top of the test file from:
```typescript
import { rankEntries } from '@/lib/scoring/domain'
import { getTournamentScoreRounds } from '@/lib/scoring-queries'
```

To:
```typescript
import { rankEntriesWithHoles } from '@/lib/scoring'
import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'
```

- [ ] **Step 2: Add a new test for hole-by-hole ranking**

Add this test after the existing tests (before the closing `}` of the describe block):

```typescript
it('ranks entries from tournament_holes via rankEntriesWithHoles, not tournament_score_rounds', async () => {
  const pool = {
    id: 'pool-1',
    status: 'live',
    refreshed_at: '2026-03-29T00:00:00.000Z',
    last_refresh_error: null,
    tournament_id: 't-1',
  }
  const entries = [
    { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1' },
    { id: 'entry-2', golfer_ids: ['g3', 'g4'], user_id: 'u2' },
  ]

  const holesByGolfer = new Map<string, import('@/lib/supabase/types').TournamentHole[]>()
  holesByGolfer.set('g1', [
    { golfer_id: 'g1', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g1', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 3, par: 4, score_to_par: -1, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g1', tournament_id: 't-1', round_id: 2, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
  ])
  holesByGolfer.set('g2', [
    { golfer_id: 'g2', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g2', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g2', tournament_id: 't-1', round_id: 2, hole_id: 1, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
  ])
  holesByGolfer.set('g3', [
    { golfer_id: 'g3', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g3', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 5, par: 4, score_to_par: 1, updated_at: '2026-03-29T00:00:00.000Z' },
  ])
  holesByGolfer.set('g4', [
    { golfer_id: 'g4', tournament_id: 't-1', round_id: 1, hole_id: 1, strokes: 3, par: 4, score_to_par: -1, updated_at: '2026-03-29T00:00:00.000Z' },
    { golfer_id: 'g4', tournament_id: 't-1', round_id: 1, hole_id: 2, strokes: 4, par: 4, score_to_par: 0, updated_at: '2026-03-29T00:00:00.000Z' },
  ])

  const rankedEntries = [
    { id: 'entry-1', golfer_ids: ['g1', 'g2'], user_id: 'u1', rank: 1, totalScore: -1, totalBirdies: 1, isTied: false },
    { id: 'entry-2', golfer_ids: ['g3', 'g4'], user_id: 'u2', rank: 2, totalScore: 0, totalBirdies: 1, isTied: false },
  ]

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pools') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: pool, error: null }) }) }) }
      }
      if (table === 'entries') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: entries }) }) }
      }
      if (table === 'tournament_scores') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  } as never)

  vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(holesByGolfer)
  vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)

  const response = await GET(new Request('http://localhost/api/leaderboard/pool-1'), {
    params: Promise.resolve({ poolId: 'pool-1' }),
  })
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(getTournamentHolesForGolfers).toHaveBeenCalledWith(expect.any(Object), 't-1', expect.arrayContaining(['g1', 'g2', 'g3', 'g4']))
  expect(rankEntriesWithHoles).toHaveBeenCalledWith(entries, holesByGolfer, expect.any(Map), 2)
  expect(body.data.entries).toEqual(rankedEntries)
})
```

Note: Add `rankEntriesWithHoles` to the mock for `@/lib/scoring`:
```typescript
vi.mock('@/lib/scoring', () => ({
  deriveCompletedRounds: vi.fn(),
  rankEntriesWithHoles: vi.fn(),
}))
```

- [ ] **Step 3: Update existing tests that use the old mock path**

The four existing tests (`preserves ranked entries when no tournament scores are available`, `returns isRefreshing true...`, `surfaces refresh failures...`, `does not trigger background refresh for archived pools`) all mock `getTournamentScoreRounds` and `rankEntries`. These need to be updated to mock `getTournamentHolesForGolfers` and `rankEntriesWithHoles` instead.

For each existing test, after the mock `createClient` setup, add:
```typescript
vi.mocked(getTournamentHolesForGolfers).mockResolvedValue(new Map())
vi.mocked(rankEntriesWithHoles).mockReturnValue(rankedEntries as never)
```

And remove `vi.mocked(getTournamentScoreRounds).mockResolvedValue([])` from those tests.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts`
Expected: All tests pass.

---

## Task 3: Update README.md scoring description

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find and fix the round-based best-ball line**

Search README for the line mentioning "Round-based best-ball". Replace:
```
Round-based best-ball (lowest score among 4 golfers per completed round)
```

With:
```
Hole-by-hole best-ball (lowest score-to-par per hole among active golfers)
```

- [ ] **Step 2: Verify no other round-based references remain**

Run: `rg "Round-based" README.md`
Expected: No matches.

---

## Task 4: Fix docs/rules-spec.md pseudo-code block

**Files:**
- Modify: `docs/rules-spec.md`

- [ ] **Step 1: Read the file to see the full pseudo-code context**

Run: `cat docs/rules-spec.md | head -70`

- [ ] **Step 2: Fix the pseudo-code block at lines 29–32**

The header says "Best Ball, Hole-by-Hole" but the pseudo-code computes round-level min. Replace the pseudo-code block with:
```
For each regulation hole in each counted round:
  1. Look at the selected golfers in the entry who are active.
  2. Use the lowest score-to-par among golfers with a valid score for that hole.
  3. Add that best hole score to the entry total.
  4. Count birdies/eagles as scoreToPar < 0 for the best-ball hole result.
```

The conceptual description in the paragraph above the code (lines 27–28) is already correct — no changes needed there.

---

## Validation Commands

| Command | Expected |
|---------|----------|
| `npm run lint` | No errors |
| `npm run build` | No TypeScript errors |
| `npm test -- src/app/api/leaderboard/[poolId]/route.test.ts` | All tests pass |
| `rg "Round-based best-ball" README.md` | No matches |
| `rg "getTournamentScoreRounds" src/app/api/leaderboard` | No matches (should only appear in scoring-queries.ts and its tests) |

---

## Risk Areas

1. **Test breakage on existing tests**: All four existing tests mock `getTournamentScoreRounds` and `rankEntries`. They must be updated to mock `getTournamentHolesForGolfers` and `rankEntriesWithHoles`. The mock update is mechanical and low-risk.

2. **`rankEntriesWithHoles` response shape mismatch**: The function returns `Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean }` which matches the existing `entries` field contract — verified in design doc.

3. **Empty `tournament_holes` on a fresh DB**: If `tournament_holes` is empty (no refresh has run yet), `rankEntriesWithHoles` will be called with an empty `holesByGolfer` map, returning entries with `totalScore: null`. This is acceptable fallback behavior per the design doc assumption #1.

4. **`completedRounds` derivation**: The route currently derives `completedRounds` from `allScores` via `deriveCompletedRounds(allScores)`. This remains correct since `allScores` still comes from `tournament_scores`. The new path also passes this to `rankEntriesWithHoles`.

---

## Stop Conditions

- **TypeScript errors after route.ts changes**: Do not proceed; fix type errors before continuing.
- **`rankEntriesWithHoles` is not a function**: Indicates `scoring.ts` exports have changed; re-check exports.
- **Tests fail after mock updates**: Do not proceed; ensure mocks are correctly updated before continuing.
- **Response contract broken** (missing fields in API output): Revert and re-examine the changes to `rankEntriesWithHoles` call.

---

## Related Files (Read-Only Reference)

| File | Purpose |
|------|---------|
| `src/lib/scoring.ts:151–158` | `rankEntriesWithHoles` implementation |
| `src/lib/scoring.ts:32–50` | `buildGolferRoundScoresMap` — builds `GolferRoundScoresMap` from holes |
| `src/lib/scoring/domain.ts:108–148` | `domainRankEntries` — pure ranking function |
| `src/lib/scoring-queries.ts:133–154` | `getTournamentHolesForGolfers` |
| `supabase/migrations/20260425190000_create_tournament_holes.sql` | `tournament_holes` table schema |
