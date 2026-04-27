# OPS-57: Fix build failure in score-trace page — Design Spec

## Problem

The Next.js production build fails with a type error in `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx:175`:

```
Type error: Type 'number | null' is not assignable to type 'number'.
  Type 'null' is not assignable to type 'number'.
```

## Root Cause

- `rankEntries()` (in `src/lib/scoring/domain.ts:123`) returns `Entry & { totalScore: number | null; ... }`
- `ScoreDisplay` component (in `src/components/score-display.tsx`) accepts prop type `{ score: number }` — does not accept `null`
- Line 175 passes `entry.totalScore` directly to `<ScoreDisplay>` without guarding against `null`

```typescript
// rankEntries return type (domain.ts:127)
(Entry & { totalScore: number | null; totalBirdies: number; completedHoles: number; rank: number; isTied: boolean })[]

// ScoreDisplay prop type (score-display.tsx:1)
export function ScoreDisplay({ score }: { score: number }) { ... }
```

## Fix Approach

**Chosen approach: Null guard in score-trace page**

In `score-trace/page.tsx`, guard `entry.totalScore` at the two call sites of `ScoreDisplay`:

- Line 175: `<ScoreDisplay score={entry.totalScore} />` → `<ScoreDisplay score={entry.totalScore ?? 0} />`
- Line 178: `<ScoreDisplay score={row.roundScore ?? 0} />` (same pattern for consistency)

`row.roundScore` comes from `golferScore.total_score ?? null` and is already passed through `ScoreDisplay` on line 212, so the same null guard is needed there too.

## Why not modify ScoreDisplay?

`ScoreDisplay` is a shared UI primitive used across leaderboards and scorecards. Changing it to accept `number | null` would:
1. Require updating all 18+ call sites to handle the null semantics appropriately
2. Obscure the distinction between "score is 0" and "no score available" in user-facing displays

The score-trace page is an audit/development tool — treating null as 0 here is acceptable because the surrounding UI already communicates the "no scores yet" state differently.

## No Changes to Entry type or rankEntries signature

The `Entry` interface in `types.ts` does not include `totalScore` — that is an additional field injected by `rankEntries`. The return type of `rankEntries` correctly reflects that totalScore can be null when no golfer scores are available.

## Files to Modify

1. `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`
   - Line 175: Add `?? 0` null coalescing on `entry.totalScore`
   - Lines 209-212: Add `?? 0` null coalescing on `row.roundScore`

## Verification

1. `npm run build` completes without type errors
2. `npm run typecheck` passes (if available)
3. Page renders in dev mode without runtime errors