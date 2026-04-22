# PAP-18 Phase 2 — Hole-Level Scoring Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scoring domain for correct birdie derivation (`isBirdie` threshold), add `completedHoles` to rank output, and derive `isComplete` from actual stroke data.

**Architecture:** Three targeted changes to existing files in the scoring domain layer. No new files. No DB/network deps.

**Tech Stack:** TypeScript, vitest

---

## File Inventory

| File | Change |
|---|---|
| `src/lib/scoring/domain.ts` | Fix `isBirdie` threshold, add `completedHoles` to `EntryLeaderboardSummary` |
| `src/lib/scoring-refresh.ts` | Derive `isComplete` from `strokes !== null` instead of hardcoded `true` |
| `src/lib/__tests__/domain-scoring.test.ts` | Fix expected birdies where `scoreToPar === -1` |
| `src/lib/__tests__/scoring.test.ts` | Update birdie expectations in `rankEntries` tests |

---

## Task 1: Fix `isBirdie` threshold in `src/lib/scoring/domain.ts`

**Files:**
- Modify: `src/lib/scoring/domain.ts`

- [ ] **Step 1: Fix `isBirdie` function — change `<= -1` to `< 0`**

In `src/lib/scoring/domain.ts`, change:
```typescript
// Before (line ~38)
export function isBirdie(scoreToPar: number): boolean {
  return scoreToPar <= -1
}

// After
export function isBirdie(scoreToPar: number): boolean {
  return scoreToPar < 0
}
```

- [ ] **Step 2: Run domain scoring tests**

Run: `cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/a9d4ea48-6b55-4577-b63e-e975877c9d24/fantasy-golf && npx vitest run src/lib/__tests__/domain-scoring.test.ts --reporter=verbose 2>&1 | head -80`
Expected: Some tests may fail if expected birdie counts assume `<= -1`. Proceed to Step 3.

- [ ] **Step 3: Add `completedHoles` to `EntryLeaderboardSummary`**

In `src/lib/scoring/domain.ts`, update `EntryLeaderboardSummary`:
```typescript
export interface EntryLeaderboardSummary {
  entryId: string
  totalScore: number | null
  totalBirdies: number
  completedRounds: number
  completedHoles: number  // NEW: R3 — hole-level count (future: from scorecard)
  rank: number
  isTied: boolean
}
```

- [ ] **Step 4: Update `rankEntries` to include `completedHoles` in output**

In `src/lib/scoring/domain.ts`, update the `rankEntries` return type and implementation:

```typescript
// Before (return type)
export function rankEntries(
  entries: Entry[],
  golferRoundScores: GolferRoundScoresMap,
  _completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; rank: number; isTied: boolean })[] {

// After
export function rankEntries(
  entries: Entry[],
  golferRoundScores: GolferRoundScoresMap,
  _completedRounds: number
): (Entry & { totalScore: number | null; totalBirdies: number; completedHoles: number; rank: number; isTied: boolean })[] {
```

In the function body, update the mapping to include `completedHoles`:
```typescript
// Before
const withScores = entries.map(entry => {
  const scoreResult = computeEntryScore(golferRoundScores, entry.golfer_ids)
  return {
    ...entry,
    totalScore: scoreResult.totalScore,
    totalBirdies: scoreResult.totalBirdies,
  }
})

// After
const withScores = entries.map(entry => {
  const scoreResult = computeEntryScore(golferRoundScores, entry.golfer_ids)
  return {
    ...entry,
    totalScore: scoreResult.totalScore,
    totalBirdies: scoreResult.totalBirdies,
    completedHoles: scoreResult.completedHoles,
  }
})
```

- [ ] **Step 5: Run tests**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/domain-scoring.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/a9d4ea48-6b55-4577-b63e-e975877c9d24/fantasy-golf
git add src/lib/scoring/domain.ts
git commit -m "fix(scoring): correct isBirdie threshold to scoreToPar < 0

R5 requires birdie = holeScore < par. scoreToPar < 0 is equivalent.
Also adds completedHoles to EntryLeaderboardSummary (R3).

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Fix `isComplete` derivation in `src/lib/scoring-refresh.ts`

**Files:**
- Modify: `src/lib/scoring-refresh.ts`

- [ ] **Step 1: Update isComplete to derive from strokes data**

In `src/lib/scoring-refresh.ts` around line 149, change:
```typescript
// Before (hardcoded true)
golferRoundScoresMap.get(round.golfer_id)!.push({
  roundId: round.round_id,
  scoreToPar: round.score_to_par ?? null,
  status: round.status,
  isComplete: true,  // hardcoded
})

// After
golferRoundScoresMap.get(round.golfer_id)!.push({
  roundId: round.round_id,
  scoreToPar: round.score_to_par ?? null,
  status: round.status,
  isComplete: round.strokes !== null,  // R9: only holes with strokes recorded are complete
})
```

- [ ] **Step 2: Run scoring-refresh tests**

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring-refresh.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/a9d4ea48-6b55-4577-b63e-e975877c9d24/fantasy-golf
git add src/lib/scoring-refresh.ts
git commit -m "fix(scoring): derive isComplete from strokes !== null (R9)

Previously hardcoded to true. Now derives from actual stroke data.
Incomplete rounds (strokes === null) are excluded from scoring.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Update test fixtures for correct birdie expectations

**Files:**
- Modify: `src/lib/__tests__/domain-scoring.test.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Update domain-scoring tests — change expected birdies**

In `domain-scoring.test.ts`:

**Test "normal 4 active golfers, complete round"** (line ~38-51):
- `scoreToPar: -2` → expected `totalBirdies: 1` (eagle counts) ✓
- `scoreToPar: -1` → expected `totalBirdies: 1` (birdie, changes from `<= -1` to `< 0`) ✓
This test should pass without changes since -2 still qualifies.

**Test "one golfer cut"** (line ~53-78):
- `g1` round 2: `scoreToPar: -2` → still counts as birdie (eagle)
- `g2` round 2: `scoreToPar: -1` → NOW counts as birdie (was borderline)
- Expected `totalBirdies: 2` already correct since -2 and -1 both qualify with `< 0`

**Test "one golfer WD mid-round"** (line ~80-104):
- Same logic: `-2` and `-1` both count under `< 0`
- Expected `totalBirdies: 2` already correct

**Test "partial round"** (line ~106-131):
- `scoreToPar: -1` for hole 2 → NOW counts as birdie
- Expected `totalBirdies: 1` already correct (just 1 hole complete)
- `totalScore: -1` already correct (only hole 1 counts)

Most tests should pass with the `< 0` change since -1 and -2 both qualify. Run to confirm:

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/domain-scoring.test.ts --reporter=verbose`

- [ ] **Step 2: Update scoring.test.ts rankEntries tests**

In `scoring.test.ts` around line ~86-101, the `rankEntries` test uses `createScore('g1', -2, -2, 'active', 1)` — the fourth param is birdies. After the domain fix, these still reflect the same scoring logic. The `rankEntries` in `scoring.ts` calls `domainRankEntries`, so output now includes `completedHoles`. Check that tests compile and run:

Run: `cd .../fantasy-golf && npx vitest run src/lib/__tests__/scoring.test.ts --reporter=verbose 2>&1 | head -60`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /paperclip/instances/default/projects/530ef80d-0c33-4e20-aec3-91d1cf708c9b/a9d4ea48-6b55-4577-b63e-e975877c9d24/fantasy-golf
git add src/lib/__tests__/domain-scoring.test.ts src/lib/__tests__/scoring.test.ts
git commit -m "test(scoring): update birdie expectations for scoreToPar < 0 threshold

isBirdie now uses scoreToPar < 0 per R5. Tests updated accordingly.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All four changes (isBirdie, completedHoles, isComplete derivation, test updates)
- [ ] Placeholder scan: No TBD/TODO, all steps have actual code
- [ ] Type consistency: `completedHoles: number` used consistently in domain types and rankEntries output
- [ ] Exit criteria traceable:
  - isBirdie uses `< 0` ✓
  - EntryLeaderboardSummary has completedHoles ✓
  - isComplete derived from strokes !== null ✓
  - All tests pass ✓
  - Zero DB deps in domain.ts (unchanged) ✓