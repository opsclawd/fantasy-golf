# Spec Review: Task 5 - Fix API Route Test Mocks

**Reviewer:** spec-review-task-5
**Date:** 2026-05-12

## Verification Summary

✅ **Spec compliant** — Implementation matches requirements.

## Step-by-Step Verification

### Step 1: Grep for mock import
- Pattern `getTournamentHolesForGolfers` found in `route.test.ts` at lines **8, 24, 108**
- File: `/home/gary/.openclaw/workspace/fantasy-golf/src/app/api/leaderboard/[poolId]/route.test.ts`

### Step 2: Verify mock is correctly imported (lines 8, 23-25)
- **Line 8:** `import { getTournamentHolesForGolfers } from '@/lib/scoring-queries'` ✅
- **Lines 23-25:**
  ```typescript
  vi.mock('@/lib/scoring-queries', () => ({
    getTournamentHolesForGolfers: vi.fn(),
  }))
  ```
  ✅ Mock configured correctly

### Step 3: Mock setup in tests
- **Line 108 (first test):** `vi.mocked(getTournamentHolesForGolesForGolfers).mockResolvedValue(new Map())` ✅
- **Tests 2-4 (stale, error, archived):** No `getTournamentHolesForGolfers` mock set — correct, because these tests return empty `tournament_scores` data, so `allScores` is empty and the code path that calls `getTournamentHolesForGolfers` is never reached.

### Step 4: Test execution
```
npm test src/app/api/leaderboard/[poolId]/route.test.ts
Test Files  3 passed (3)
Tests  12 passed (12)
```
✅ **PASS**

### Step 5: Git state
- File is committed on `main` branch (commit `70a14bd`)
- Working tree clean — no uncommitted changes

## Notes

The implementer's worktree (`.ai-worktrees/issue-55/`) did not contain the test file because the file already existed in the `main` branch from prior work. The implementer attempted to read from the worktree path which doesn't exist, but the actual implementation in the repository is correct and was already in place. This task appears to have been unnecessary — the mocks were already correctly configured.