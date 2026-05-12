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