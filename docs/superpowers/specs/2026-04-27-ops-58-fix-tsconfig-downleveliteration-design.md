# Design Spec: OPS-58 Fix tsconfig downlevelIteration for Map iteration in scoring.ts

## Problem Statement

TypeScript compilation fails or produces incorrect output when iterating over `Map` instances using `for...of` loops. The current `tsconfig.json` does not enable `downlevelIteration`, which is required for proper transpilation of `for...of` loops that iterate over `Map` entries (e.g., `for (const [key, value] of mapInstance)`).

## Affected Code

- `src/lib/scoring.ts` lines 63-72: `buildGolferRoundScoresMap` iterates over a `Map` using `for...of`
- `src/lib/scoring/domain.ts` lines 55-67: `computeEntryScore` iterates over `golferRoundScores` (a `GolferRoundScoresMap` which is `Map<string, PlayerHoleScore[]>`) using `for...of`

## Proposed Fix

Add `"downlevelIteration": true` to `compilerOptions` in `tsconfig.json`.

## Design Decisions

### Option A: Add `downlevelIteration: true` (Recommended)
- **Pros**: Minimal change, directly addresses the issue, aligns with TypeScript best practices for ESNext target when using `for...of` on Maps
- **Cons**: None significant

### Option B: Rewrite Map iteration to use `.entries()`
- **Pros**: No tsconfig change needed
- **Cons**: More code change, less idiomatic, potential performance overhead from intermediate arrays

### Option C: Change `module` target to `es5`
- **Pros**: Forces broader transpilation
- **Cons**: Incorrect solution — the issue is about iteration, not module format

## Selected Approach

**Option A**: Add `"downlevelIteration": true` to `compilerOptions` in `tsconfig.json`. This is the minimal, targeted fix that addresses the root cause.

## Verification

1. `npm run build` passes without errors
2. `npm run lint` passes without warnings
3. Existing tests pass: `npm run test`

## Files to Modify

- `tsconfig.json`: Add `"downlevelIteration": true` to `compilerOptions`

## Risk

Low. This is a single-line tsconfig addition with no behavioral changes to application code.
