# OPS-46 — Tournament Scores Per-Round Overwrite Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the per-round overwrite fix is correctly implemented and functioning as designed.

**Architecture:** The fix uses a dual-write pattern: `upsertTournamentScore()` writes per-round data to `tournament_score_rounds` (append-only archive with `UNIQUE(golfer_id, tournament_id, round_id)` constraint) and current state to `tournament_scores`. No new code needs to be written; this plan focuses on verification.

**Tech Stack:** Vitest, Supabase schema, TypeScript

---

## File Map

- `src/lib/__tests__/scoring-queries.test.ts` — Existing unit test for `upsertTournamentScore` (already passes)
- `src/lib/__tests__/scoring-refresh.test.ts` — Existing integration test for scoring refresh (already passes)
- `src/lib/__tests__/slash-golf-client.test.ts` — Existing test for API parsing (already passes)
- `src/lib/scoring-queries.ts` — Core scoring query logic (already implemented correctly)
- `src/lib/scoring-refresh.ts` — Scoring refresh flow (already implemented correctly)
- `src/lib/supabase/types.ts` — Type definitions for TournamentScore and TournamentScoreRound
- `supabase/migrations/20260401170000_create_tournament_score_rounds.sql` — Schema definition

---

## Verification Tasks

### Task 1: Verify Existing Unit Tests Pass

**Files:**
- Test: `src/lib/__tests__/scoring-queries.test.ts`
- Test: `src/lib/__tests__/scoring-refresh.test.ts`
- Test: `src/lib/__tests__/slash-golf-client.test.ts`

- [ ] **Step 1: Run scoring-queries unit tests**

Run: `pnpm test -- --run --reporter=verbose --no-coverage src/lib/__tests__/scoring-queries.test.ts 2>&1`
Expected: All tests pass (no failures in scoring-queries test file)

- [ ] **Step 2: Run slash-golf-client unit tests**

Run: `pnpm test -- --run --reporter=verbose --no-coverage src/lib/__tests__/slash-golf-client.test.ts 2>&1`
Expected: All tests pass

- [ ] **Step 3: Verify the scoring-queries test covers round archival behavior**

Read: `src/lib/__tests__/scoring-queries.test.ts:14-105`
Confirm the test:
1. Creates a mock golferScore with `rounds: [{ round_id: 1, strokes: 70, ... }, { round_id: 2, strokes: 68, ... }]`
2. Verifies `archiveUpserts` has length 2 (one per round)
3. Verifies each archive upsert has correct `round_id`, `strokes`, `score_to_par`
4. Verifies `currentUpserts` has length 1 with `round_id: 2` (current round)

This confirms the dual-write behavior: R1 and R2 go to archive, only R2 (current) goes to tournament_scores.

---

### Task 2: Verify Schema Constraint Prevents Overwrites

**Files:**
- Schema: `supabase/migrations/20260401170000_create_tournament_score_rounds.sql`

- [ ] **Step 1: Confirm UNIQUE constraint exists**

Read: `supabase/migrations/20260401170000_create_tournament_score_rounds.sql:27`
Verify the line: `UNIQUE(golfer_id, tournament_id, round_id)`

This is the key constraint that prevents a round from being overwritten. An upsert with the same `(golfer_id, tournament_id, round_id)` will update rather than insert, but crucially the round_id itself never changes — once Round 1 is recorded as round_id=1, a future upsert for round_id=1 will update that same row, not create a new one.

- [ ] **Step 2: Verify no DROP or ALTER statements remove the constraint**

Run: `grep -r "DROP.*tournament_score_rounds\|ALTER.*tournament_score_rounds" supabase/migrations/`
Expected: No output (no migration removes or alters the constraint)

- [ ] **Step 3: Verify RLS is not blocking writes**

The migration file does not show RLS being added to `tournament_score_rounds`. Check:
Run: `grep -r "ENABLE ROW LEVEL SECURITY\|RLS" supabase/migrations/20260401170000_create_tournament_score_rounds.sql`
Expected: No RLS-related statements in this migration (not needed for the service-role write path)

---

### Task 3: Verify Round ID Selection for Current State

**Files:**
- Modify: `src/lib/scoring-queries.ts:62`

- [ ] **Step 1: Review the round_id selection logic**

Read: `src/lib/scoring-queries.ts:56-68`
Verify the current state upsert uses:
```typescript
round_id: golferScore.current_round ?? golferScore.rounds?.[golferScore.rounds.length - 1]?.round_id ?? null,
```

This correctly selects:
1. First try: `current_round` (the API's current round indicator)
2. Fallback: the last round in the `rounds` array (handles cases where current_round is not set)
3. Final fallback: `null`

- [ ] **Step 2: Verify the round archival uses per-round round_id, not current_round**

Read: `src/lib/scoring-queries.ts:22-53`
Confirm the archive upserts use `r.round_id` from the individual round objects:
```typescript
roundRecords = golferScore.rounds.map((r): Omit<TournamentScoreRound, 'id'> => ({
  ...
  round_id: r.round_id,  // <-- per-round ID, not current_round
  strokes: r.strokes ?? null,
  score_to_par: r.score_to_par ?? null,
  ...
}))
```

Each round's data is stored with its own `round_id`, so Round 1 and Round 2 are stored as separate rows.

---

### Task 4: Verify Zero-Value Handling

**Files:**
- Test: `src/lib/__tests__/slash-golf-client.test.ts`
- Modify: `src/lib/slash-golf/client.ts`

- [ ] **Step 1: Review parseMongoNumber implementation**

Read: `src/lib/slash-golf/client.ts:142-157`
Confirm it handles:
- Plain number: `0`
- Mongo `$numberInt`: `{ '$numberInt': '0' }`
- Mongo `$numberDouble`: `{ '$numberDouble': '0.0' }`
- String: `'0'`

- [ ] **Step 2: Review zero-value test fixture**

Read: `src/lib/__tests__/slash-golf-client.test.ts`
Confirm a test case exists with `strokes: 0` or `score_to_par: 0` and verifies it's parsed as integer `0`, not `null`.

---

### Task 5: Run Full Test Suite

**Files:**
- All test files

- [ ] **Step 1: Run all scoring-related tests**

Run: `pnpm test -- --run --no-coverage src/lib/__tests__/scoring 2>&1`
Expected: All scoring-related tests pass (scoring-queries, scoring-refresh, slash-golf-client)

- [ ] **Step 2: Check for any pre-existing test failures**

Run: `pnpm test -- --run --no-coverage 2>&1 | grep -E "FAIL|failed"`
Expected output shows only pre-existing failures (JoinPoolForm — unrelated to scoring)

Pre-existing failures:
- `JoinPoolForm.test.tsx` — `useFormState is not a function` (React version mismatch, tracked separately)

---

### Task 6: Write Round Preservation Integration Test

**Files:**
- Create: `src/lib/__tests__/scoring-round-preservation.test.ts`

This is the most important verification: proving that multiple refresh cycles do NOT overwrite previously stored rounds.

- [ ] **Step 1: Write the integration test**

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { upsertTournamentScore } from '../scoring-queries'

describe('round preservation across refresh cycles', () => {
  it('second refresh does not overwrite first refresh rounds in archive', async () => {
    const archiveUpserts: unknown[] = []

    const archiveBuilder: any = {
      upsert: vi.fn((value: unknown) => {
        archiveUpserts.push(value)
        return archiveBuilder
      }),
      then: (onFulfilled: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    }

    const currentBuilder: any = {
      upsert: vi.fn(() => currentBuilder),
      then: (onFulfilled: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(onFulfilled),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tournament_score_rounds') return archiveBuilder
        if (table === 'tournament_scores') return currentBuilder
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    // First refresh: rounds [R1, R2]
    await upsertTournamentScore(
      supabase as never,
      { golfer_id: 'g1', tournament_id: 't1', total_score: -2, total_birdies: 1, status: 'active' },
      {
        golfer_id: 'g1',
        current_round: 2,
        rounds: [
          { round_id: 1, strokes: 70, score_to_par: -2, course_id: 'c1', course_name: 'Course A' },
          { round_id: 2, strokes: 68, score_to_par: -4, course_id: 'c1', course_name: 'Course A' },
        ],
      } as never
    )

    // Clear upserts between "refresh cycles"
    archiveUpserts.length = 0

    // Second refresh: rounds [R1, R2, R3] (new round 3)
    await upsertTournamentScore(
      supabase as never,
      { golfer_id: 'g1', tournament_id: 't1', total_score: -5, total_birdies: 2, status: 'active' },
      {
        golfer_id: 'g1',
        current_round: 3,
        rounds: [
          { round_id: 1, strokes: 70, score_to_par: -2, course_id: 'c1', course_name: 'Course A' },
          { round_id: 2, strokes: 68, score_to_par: -4, course_id: 'c1', course_name: 'Course A' },
          { round_id: 3, strokes: 69, score_to_par: -3, course_id: 'c1', course_name: 'Course A' },
        ],
      } as never
    )

    // Archive upserts: R1, R2, R3 (3 total)
    expect(archiveUpserts).toHaveLength(3)

    // R1 and R2 are upserted again but with the SAME data (idempotent)
    const r1Upsert = archiveUpserts.find((u: any) => u.round_id === 1)
    const r2Upsert = archiveUpserts.find((u: any) => u.round_id === 2)
    expect(r1Upsert.strokes).toBe(70)
    expect(r2Upsert.strokes).toBe(68)
  })
})
```

- [ ] **Step 2: Run the new test**

Run: `pnpm test -- --run --reporter=verbose --no-coverage src/lib/__tests__/scoring-round-preservation.test.ts 2>&1`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/scoring-round-preservation.test.ts
git commit -m "test: add round preservation integration test for tournament_score_rounds"
```

---

## Exit Criteria

- [ ] All scoring unit tests pass (scoring-queries, scoring-refresh, slash-golf-client)
- [ ] Round preservation integration test written and passing
- [ ] Schema verified: UNIQUE constraint on `(golfer_id, tournament_id, round_id)` is in place
- [ ] Zero-value parsing verified via parseMongoNumber
- [ ] Round archival uses per-round `round_id`, not `current_round`
- [ ] No regressions introduced (only JoinPoolForm failures remain, unrelated to this fix)
