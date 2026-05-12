# Review Fix Log — issue #51 (loop 5)

## Status: All Legitimate Findings Fixed

All findings verified FIXED in review.md loop 5:
- All 6 acceptance criteria ✓
- route.ts implementation ✓
- route.test.ts coverage ✓
- README.md / docs/rules-spec.md / scoring-queries.ts ✓
- Build passes ✓
- Lint passes ✓
- Tests pass (468 passed, 1 skipped) ✓

## Minor Pre-Existing Issues (Not Fixed This Pass)

### 1. rankEntriesLegacy still in scoring.ts
- **File:** `src/lib/scoring.ts:88–121`
- **Status:** NOT FIXED — intentionally preserved for audit tooling at `score-trace/page.tsx`
- **Valid:** N/A (pre-existing, not a regression)
- **Evidence:** `grep rankEntriesLegacy` shows active imports in `score-trace/page.tsx:5,108` and `scoring.test.ts:6`
- **Risk:** Low — marked @deprecated, not used in any production scoring path

### 2. typecheck failures in design-tokens.test.ts
- **File:** `src/lib/__tests__/design-tokens.test.ts`
- **Status:** NOT FIXED — pre-existing tailwind config typing issues (64 errors, all in this file)
- **Valid:** N/A (pre-existing, not a regression)
- **Evidence:** review.md confirms all 64 errors are pre-existing in design-tokens.test.ts
- **Risk:** None — test file only, no production impact, not a merge blocker

---

# Review Fix Log — issue #51 (loop 4)

## Status: All Legitimate Findings Fixed

All acceptance criteria verified FIXED in review.md:
- GET /api/leaderboard/[poolId] ranks from tournament_holes ✓
- No fake holeId: 1 records ✓
- Both paths use same scoring model ✓
- README updated ✓
- docs/rules-spec.md updated ✓
- Tests cover corrected path ✓

## Minor Pre-Existing Issues (Not Fixed This Pass)

### 1. rankEntriesLegacy still in scoring.ts
- **File:** `src/lib/scoring.ts:88–121`
- **Status:** NOT FIXED — intentionally preserved for audit tooling at `score-trace/page.tsx`
- **Valid:** N/A (pre-existing, not a regression)
- **Evidence:** `grep rankEntriesLegacy` shows active imports in `score-trace/page.tsx:5,108` and `scoring.test.ts:6`
- **Risk:** Low — marked @deprecated, not used in any production scoring path

### 2. typecheck failures in design-tokens.test.ts
- **File:** `src/lib/__tests__/design-tokens.test.ts`
- **Status:** NOT FIXED — pre-existing tailwind config typing issues
- **Valid:** N/A (pre-existing, not a regression)
- **Evidence:** 64 TypeScript errors, all confined to this test file
- **Risk:** None — test file only, no production impact

---

# Review Fix Log — issue #51 (loop 3)

## Finding: route.test.ts missing TournamentHole import
- **File:** `src/app/api/leaderboard/[poolId]/route.test.ts:5`
- **Fix:** Added `import type { TournamentHole } from '@/lib/supabase/types'`
- **Valid:** Yes — TournamentHole is used on line 484 but not imported

## Finding: route.test.ts rankEntriesWithHoles.mock type error
- **File:** `src/app/api/leaderboard/[poolId]/route.test.ts:482`
- **Fix:** Changed `rankEntriesWithHoles.mock.calls` to `vi.mocked(rankEntriesWithHoles).mock.calls`
- **Valid:** Yes — vi.mocked() is the correct way to type a mocked function in vitest

## Finding: LeaderboardRow.test.tsx Set<unknown> not assignable to Set<string>
- **File:** `src/components/__tests__/LeaderboardRow.test.tsx:23,37,51`
- **Fix:** Changed `new Set()` to `new Set<string>()` (3 occurrences, replaceAll)
- **Valid:** Yes — withdrawnGolferIds prop expects Set<string>

## Finding: LeaderboardPresentation.test.tsx missing rowIndex prop
- **File:** `src/components/__tests__/LeaderboardPresentation.test.tsx:24`
- **Fix:** Added `rowIndex={0}` to LeaderboardRow props
- **Valid:** Yes — rowIndex is required by LeaderboardRowProps interface

## Finding: GolferStatesPresentation.test.tsx round_score not on TournamentScore
- **File:** `src/components/__tests__/GolferStatesPresentation.test.tsx:21`
- **Fix:** Removed `round_id`, `round_score`, `round_status`, `current_hole`, `tee_time` from createScore (not in TournamentScore interface)
- **Valid:** Yes — TournamentScore interface does not include those fields

## Finding: scoring-queries.test.ts TournamentHole import wrong path
- **File:** `src/lib/__tests__/scoring-queries.test.ts:2`
- **Fix:** Changed `import type { TournamentHole } from '../scoring-queries'` to `import type { TournamentHole } from '../supabase/types'`
- **Valid:** Yes — scoring-queries.ts does not export TournamentHole; it's in supabase/types.ts

## Finding: scoring-edge-cases.test.ts PlayerHoleScore missing holeId
- **File:** `src/lib/__tests__/scoring-edge-cases.test.ts:12`
- **Fix:** Added `holeId: 1` to makePlayerHoleScore return object
- **Valid:** Yes — PlayerHoleScore interface requires holeId field

## Finding: scoring-refresh-edge-cases.test.ts rankEntriesWithHoles wrong import
- **File:** `src/lib/__tests__/scoring-refresh-edge-cases.test.ts:5`
- **Fix:** Moved `rankEntriesWithHoles` to separate import from `@/lib/scoring` (was imported from `@/lib/scoring/domain` which doesn't export it)
- **Valid:** Yes — rankEntriesWithHoles is exported from scoring.ts, not scoring/domain.ts

## Finding: scoring.test.ts createScore has round_score field
- **File:** `src/lib/__tests__/scoring.test.ts:242`
- **Fix:** Removed `round_score: roundScore` from createScore return object
- **Valid:** Yes — TournamentScore interface does not include round_score

## Finding: scoring-queries.test.ts object is of type 'unknown' at line 268
- **File:** `src/lib/__tests__/scoring-queries.test.ts:268`
- **Fix:** Cast `upserts[0]` to `TournamentHole[]` before accessing properties
- **Valid:** Yes — upserts array is typed as unknown[], index access returns unknown

## Skipped (pre-existing, not regression)

### design-tokens.test.ts — tailwind config typing
- All errors are in `src/lib/__tests__/design-tokens.test.ts`
- Pre-existing typing issues with tailwindConfig.theme type inference
- Not related to issue #51 changes
- Excluded from typecheck count as noted in review: "pre-existing typing issues in test files"