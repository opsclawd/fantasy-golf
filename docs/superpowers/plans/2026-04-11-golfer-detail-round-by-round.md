# Golfer Detail Round-by-Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-round scoring display to the golfer detail popup, showing all 4 rounds in a tabbed interface.

**Architecture:** `GolferDetailSheet` fetches round data from a new authenticated API route on mount. The `getGolferScorecard` lib function grows a second optional param for round data and maps `TournamentScoreRound[]` into a reworked `RoundResult[]` shape. `GolferScorecard` component is reworked to render a 4-tab UI. `TournamentScore.tournament_id` is already available on the score prop, so no new prop is needed for tournament context.

**Breaking change to `RoundResult`:** the existing `score: number | null` field is replaced by explicit `strokes` and `scoreToPar` fields. Only `getGolferScorecard` produces `RoundResult` and only `GolferScorecard.tsx` consumes it, so the blast radius is limited to files in this plan.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase client, React hooks

---

## File Map

```
src/
  lib/
    golfer-detail.ts              # Extend types + getGolferScorecard
    __tests__/
      golfer-detail.test.ts       # Add tests for round data mapping
  components/
    GolferScorecard.tsx           # Rework for tabbed round display
    GolferDetailSheet.tsx         # Add round fetch + loading state
  app/
    api/
      golfers/
        [golferId]/
          rounds/
            route.ts              # NEW — fetch round data
```

---

## Task 1: New API Route — `GET /api/golfers/[golferId]/rounds`

**Files:**
- Create: `src/app/api/golfers/[golferId]/rounds/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/golfers/[golferId]/rounds/route.ts` with the following content:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TournamentScoreRound } from '@/lib/supabase/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ golferId: string }> }
) {
  const { golferId } = await params
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')

  if (!tournamentId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'tournamentId is required' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Require an authenticated session. Round data is scoped to logged-in pool
  // participants; we do not want a public read-by-golfer-id endpoint.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('tournament_score_rounds')
    .select('*')
    .eq('golfer_id', golferId)
    .eq('tournament_id', tournamentId)
    .order('round_id', { ascending: true })

  if (error) {
    console.error('Failed to fetch golfer rounds:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rounds' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data as TournamentScoreRound[], error: null })
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run from the repo root: `npx tsc --noEmit`
Expected: No TypeScript errors. (Per-file `tsc --noEmit <path>` does not work with this project's `tsconfig.json` — always run from the root.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/golfers/[golferId]/rounds/route.ts
git commit -m "feat: add GET /api/golfers/[golferId]/rounds endpoint

Returns all tournament_score_rounds rows for a golfer + tournament."
```

---

## Task 2: Rework `RoundResult` and extend `getGolferScorecard`

**Files:**
- Modify: `src/lib/golfer-detail.ts`

**Context for junior devs:** the existing `RoundResult.score` field is ambiguous — today it's never populated (the current `GolferScorecard.tsx` reads `round?.score ?? 0`), and the plan to stuff raw strokes into it would render as "+70" via `ScoreDisplay`. We are replacing the field with explicit `strokes` and `scoreToPar` so the display layer can never confuse the two.

- [ ] **Step 1: Replace the `RoundResult` interface**

Find the `RoundResult` interface at the top of `src/lib/golfer-detail.ts` (currently lines 3–10). Replace the entire interface with:

```typescript
export interface RoundResult {
  round: number
  strokes: number | null      // raw strokes for this round (e.g. 70)
  scoreToPar: number | null   // round score relative to par (e.g. -2)
  totalToPar: number | null   // cumulative score-to-par thru this round
  position: string | null
  roundStatus: string | null
  teeTime: string | null
  thru: number | null
  courseName: string | null
}
```

All fields are non-optional (use `null` for missing values) so consumers don't have to distinguish `undefined` from "no data yet".

- [ ] **Step 2: Extend the existing `TournamentScore` import**

The file's first line already reads:

```typescript
import type { TournamentScore, GolferStatus, Entry } from './supabase/types'
```

**Extend** this existing import — do **not** add a second import line. Change it to:

```typescript
import type { TournamentScore, TournamentScoreRound, GolferStatus, Entry } from './supabase/types'
```

- [ ] **Step 3: Replace `getGolferScorecard` with the new two-arg version**

Find `getGolferScorecard` (currently lines 21–29) and replace the entire function with:

```typescript
export function getGolferScorecard(
  score: TournamentScore,
  rounds?: TournamentScoreRound[] | null
): GolferScorecard {
  const base: GolferScorecard = {
    golferId: score.golfer_id,
    status: score.status,
    totalBirdies: score.total_birdies,
    completedRounds: score.round_id ?? 0,
    totalScore: score.total_score ?? 0,
  }

  if (!rounds || rounds.length === 0) {
    return base
  }

  return {
    ...base,
    rounds: rounds.map((r) => ({
      round: r.round_id,
      strokes: r.strokes ?? null,
      scoreToPar: r.score_to_par ?? null,
      totalToPar: r.total_score ?? null,
      position: r.position ?? null,
      roundStatus: r.round_status ?? null,
      teeTime: r.tee_time ?? null,
      thru: r.thru ?? null,
      courseName: r.course_name ?? null,
    })),
  }
}
```

Note: `GolferScorecard` itself does **not** grow a `courseName` field. Course name lives on each `RoundResult` row because pro-am tournaments (e.g. Pebble Beach) rotate courses across rounds.

- [ ] **Step 4: Leave `getEntryGolferSummaries` untouched**

`getEntryGolferSummaries` calls `getGolferScorecard(score)` without the second arg. The new function is backwards-compatible (no rounds = original single-row behavior), so no changes are needed there.

- [ ] **Step 5: Run existing tests to confirm no regressions**

Run from the repo root: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: All existing tests pass. (If any test references `RoundResult.score`, `RoundResult.total`, or `GolferScorecard.courseName`, those tests will need to be updated in Task 3.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/golfer-detail.ts
git commit -m "feat(golfer-detail): rework RoundResult and add rounds arg to getGolferScorecard

- RoundResult replaces ambiguous 'score' with explicit strokes + scoreToPar
- RoundResult adds totalToPar, thru, courseName (per-round, not per-scorecard)
- getGolferScorecard accepts optional TournamentScoreRound[] second arg
- Backwards compatible: no rounds = original single-row behavior"
```

---

## Task 3: Add tests for round-data mapping in `golfer-detail.test.ts`

**Files:**
- Modify: `src/lib/__tests__/golfer-detail.test.ts`

- [ ] **Step 1: Extend the existing type import**

The test file's second line currently reads:

```typescript
import type { TournamentScore, GolferStatus, Entry } from '../supabase/types'
```

Extend it — do not add a second import — to:

```typescript
import type { TournamentScore, TournamentScoreRound, GolferStatus, Entry } from '../supabase/types'
```

- [ ] **Step 2: Add the `createScoreRound` test helper**

After the existing `createScore` helper (around line 21), add:

```typescript
function createScoreRound(
  golferId: string,
  roundId: number,
  strokes: number | null,
  scoreToPar: number | null,
  options?: Partial<Pick<
    TournamentScoreRound,
    'course_name' | 'position' | 'round_status' | 'tee_time' | 'thru' | 'total_score'
  >>
): TournamentScoreRound {
  return {
    golfer_id: golferId,
    tournament_id: 't1',
    round_id: roundId,
    strokes,
    score_to_par: scoreToPar,
    course_name: options?.course_name ?? 'Pebble Beach',
    position: options?.position ?? null,
    round_status: options?.round_status ?? null,
    tee_time: options?.tee_time ?? null,
    thru: options?.thru ?? null,
    total_score: options?.total_score ?? null,
    // Required by TournamentScoreRound type — see src/lib/supabase/types.ts
    status: 'active',
    total_birdies: 0,
  }
}
```

Note: `status` and `total_birdies` are required fields on `TournamentScoreRound`. Omitting them will cause a TypeScript error.

- [ ] **Step 3: Add the new tests inside `describe('getGolferScorecard', ...)`**

Add these tests after the existing `getGolferScorecard` tests:

```typescript
it('maps round data when rounds are provided', () => {
  const score = createScore('g1', 2, -3, 'active', 5)
  const rounds: TournamentScoreRound[] = [
    createScoreRound('g1', 1, 70, -2, {
      course_name: 'Pebble Beach',
      position: 'T5',
      round_status: 'complete',
      tee_time: '9:42 AM',
      thru: 18,
      total_score: -2,
    }),
    createScoreRound('g1', 2, 68, -4, {
      course_name: 'Spyglass Hill',
      position: 'T3',
      round_status: 'active',
      tee_time: '9:48 AM',
      thru: 12,
      total_score: -6,
    }),
  ]

  const card = getGolferScorecard(score, rounds)

  expect(card.golferId).toBe('g1')
  expect(card.rounds).toHaveLength(2)

  expect(card.rounds![0]).toEqual({
    round: 1,
    strokes: 70,
    scoreToPar: -2,
    totalToPar: -2,
    position: 'T5',
    roundStatus: 'complete',
    teeTime: '9:42 AM',
    thru: 18,
    courseName: 'Pebble Beach',
  })

  // Different course per round — confirms courseName is per-round, not per-scorecard
  expect(card.rounds![1].courseName).toBe('Spyglass Hill')
  expect(card.rounds![1].strokes).toBe(68)
  expect(card.rounds![1].scoreToPar).toBe(-4)
  expect(card.rounds![1].totalToPar).toBe(-6)
})

it('falls back to no-rounds behavior when rounds is null', () => {
  const score = createScore('g1', 1, -2, 'active', 1)
  const card = getGolferScorecard(score, null)

  expect(card.rounds).toBeUndefined()
  expect(card.totalScore).toBe(-2)
})

it('falls back to no-rounds behavior when rounds is empty array', () => {
  const score = createScore('g1', 1, -2, 'active', 1)
  const card = getGolferScorecard(score, [])

  expect(card.rounds).toBeUndefined()
  expect(card.totalScore).toBe(-2)
})

it('preserves nulls on rounds with missing field data', () => {
  const score = createScore('g1', 1, null, 'active', 0)
  const rounds: TournamentScoreRound[] = [
    createScoreRound('g1', 1, null, null, {
      position: null,
      round_status: null,
      tee_time: null,
      thru: null,
      total_score: null,
    }),
  ]

  const card = getGolferScorecard(score, rounds)

  expect(card.rounds![0].strokes).toBeNull()
  expect(card.rounds![0].scoreToPar).toBeNull()
  expect(card.rounds![0].totalToPar).toBeNull()
  expect(card.rounds![0].thru).toBeNull()
})
```

- [ ] **Step 4: Run the tests**

Run from the repo root: `npx vitest run src/lib/__tests__/golfer-detail.test.ts`
Expected: All tests pass including the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/golfer-detail.test.ts
git commit -m "test: add round data mapping tests for getGolferScorecard"
```

---

## Task 4: Rework `GolferScorecard.tsx` for tabbed round display

**Files:**
- Modify: `src/components/GolferScorecard.tsx`

**Context for junior devs — critical pitfalls:**

1. `ScoreDisplay` expects a **non-null number** that represents score-to-par (it renders "E" for 0, "+N" for positive, "−N" for negative). Never pass raw strokes to it — `70` would render as "+70". Always null-guard before calling it.
2. The round tab bar must show **score-to-par**, not strokes. A round of 70 strokes displays as "−2" in the tab.
3. Keep `activeRound` in sync when `scorecard.completedRounds` changes. If the sheet opens before round data arrives, `completedRounds` will jump from `0` to (say) `2`, and the active tab must follow. Use a `useEffect` to sync when the user hasn't manually picked a tab yet.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/GolferScorecard.tsx` with:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ScoreDisplay } from './score-display'
import type { GolferScorecard as ScorecardType, RoundResult } from '@/lib/golfer-detail'

interface GolferScorecardProps {
  scorecard: ScorecardType
}

const ALL_ROUNDS: ReadonlyArray<number> = [1, 2, 3, 4]

function pickInitialActiveRound(completedRounds: number): number {
  if (completedRounds <= 0) return 1
  if (completedRounds >= 4) return 4
  return completedRounds
}

export function GolferScorecard({ scorecard }: GolferScorecardProps) {
  const [activeRound, setActiveRound] = useState<number>(() =>
    pickInitialActiveRound(scorecard.completedRounds)
  )
  // Tracks whether the user has manually picked a tab. Once they have, we
  // stop auto-advancing when new round data arrives.
  const [userPickedTab, setUserPickedTab] = useState(false)

  // Auto-advance the active tab as new rounds complete, but only until the
  // user has manually picked one. Without this, opening the sheet before the
  // fetch resolves would leave activeRound stuck at 1 forever.
  useEffect(() => {
    if (userPickedTab) return
    setActiveRound(pickInitialActiveRound(scorecard.completedRounds))
  }, [scorecard.completedRounds, userPickedTab])

  const handleTabClick = (roundNum: number) => {
    setUserPickedTab(true)
    setActiveRound(roundNum)
  }

  const rounds: RoundResult[] = scorecard.rounds ?? []
  const activeData = rounds.find((r) => r.round === activeRound) ?? null
  const hasAnyRoundData = rounds.length > 0

  return (
    <div className="space-y-3">
      {/* Round tab bar — always 4 tabs, shows score-to-par or "--" */}
      <div className="flex gap-2">
        {ALL_ROUNDS.map((roundNum) => {
          const roundData = rounds.find((r) => r.round === roundNum) ?? null
          const isCompleted = roundNum <= scorecard.completedRounds
          const isActive = roundNum === activeRound
          const tabScoreToPar = roundData?.scoreToPar ?? null

          return (
            <button
              key={roundNum}
              type="button"
              onClick={() => handleTabClick(roundNum)}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
                isActive && isCompleted
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : isActive
                    ? 'bg-slate-100 border border-slate-300 text-slate-800'
                    : isCompleted
                      ? 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100',
              ].join(' ')}
            >
              <div>R{roundNum}</div>
              <div className="mt-0.5 text-xs font-mono">
                {tabScoreToPar !== null ? (
                  <ScoreDisplay score={tabScoreToPar} />
                ) : (
                  '--'
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Active round detail card */}
      {activeData ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {activeData.courseName ? (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {activeData.courseName}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {activeData.strokes !== null && (
              <span>
                Strokes:{' '}
                <strong className="font-mono">{activeData.strokes}</strong>
              </span>
            )}
            {activeData.scoreToPar !== null && (
              <span>
                To par:{' '}
                <strong className="font-mono">
                  <ScoreDisplay score={activeData.scoreToPar} />
                </strong>
              </span>
            )}
            {activeData.thru !== null && (
              <span>
                Thru:{' '}
                <strong className="font-mono">{activeData.thru}</strong>
              </span>
            )}
            {activeData.position && (
              <span>
                Position: <strong>{activeData.position}</strong>
              </span>
            )}
            {activeData.roundStatus && (
              <span>
                Status: <strong>{activeData.roundStatus}</strong>
              </span>
            )}
            {activeData.teeTime && (
              <span>
                Tee time: <strong>{activeData.teeTime}</strong>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          {hasAnyRoundData
            ? `No data for Round ${activeRound} yet`
            : 'No round data yet — check back after the next leaderboard refresh.'}
        </div>
      )}

      {/* Summary row */}
      <div className="flex gap-3 text-xs">
        <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
          <div className="font-mono font-semibold text-emerald-700">
            <ScoreDisplay score={scorecard.totalScore} />
          </div>
          <div className="text-emerald-600">
            Total ({scorecard.completedRounds} rounds)
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center">
          <div className="font-mono font-semibold text-amber-700">
            {scorecard.totalBirdies}
          </div>
          <div className="text-amber-600">Birdies</div>
        </div>
        <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
          <div className="font-mono font-semibold text-blue-700">
            {scorecard.status === 'active' && scorecard.completedRounds > 0
              ? scorecard.completedRounds
              : '--'}
          </div>
          <div className="text-blue-600">Rounds</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the project type-checks**

Run from the repo root: `npx tsc --noEmit`
Expected: No TypeScript errors. (Do **not** run `tsc --noEmit` against a single file — this project's tsconfig won't resolve path aliases that way.)

- [ ] **Step 3: Commit**

```bash
git add src/components/GolferScorecard.tsx
git commit -m "feat: rework GolferScorecard with 4-round tabbed display

- Tab bar renders score-to-par (never raw strokes)
- activeRound auto-advances with completedRounds until user picks a tab
- Active round card shows courseName per round (pro-am courses rotate)
- Empty state message differs for 'no data yet' vs 'round not played'"
```

---

## Task 5: Add round data fetch to `GolferDetailSheet.tsx`

**Files:**
- Modify: `src/components/GolferDetailSheet.tsx`

**Context for junior devs:**
- The file already imports `useCallback` and `useRef` on line 3. You are **extending** that existing `from 'react'` import, not adding a second one.
- `TournamentScore.tournament_id` is already available on the `score` prop (see `src/lib/supabase/types.ts` line 82). Do **not** add a new `tournamentId` prop.
- The existing `const scorecard = score ? getGolferScorecard(score) : null` on line 52 becomes `getGolferScorecard(score, fetchedRounds)`.

- [ ] **Step 1: Extend the existing imports**

Change line 3 from:
```typescript
import { useCallback, useEffect, useRef } from 'react'
```
to:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
```

Change line 7 from:
```typescript
import type { TournamentScore } from '@/lib/supabase/types'
```
to:
```typescript
import type { TournamentScore, TournamentScoreRound } from '@/lib/supabase/types'
```

- [ ] **Step 2: Add round-fetch state and effect inside the component**

Inside `GolferDetailSheet`, immediately after the existing `const dialogRef = useRef<HTMLDialogElement>(null)` line, add these state hooks:

```typescript
const [fetchedRounds, setFetchedRounds] = useState<TournamentScoreRound[] | null>(null)
const [roundsLoading, setRoundsLoading] = useState(false)
const [roundsError, setRoundsError] = useState<string | null>(null)
```

Then add the fetch effect below the existing `useEffect` that opens the dialog (around line 32):

```typescript
useEffect(() => {
  const tournamentId = score?.tournament_id
  if (!tournamentId || !golfer.id) {
    setFetchedRounds(null)
    return
  }

  let cancelled = false
  setRoundsLoading(true)
  setRoundsError(null)
  setFetchedRounds(null)

  fetch(`/api/golfers/${golfer.id}/rounds?tournamentId=${tournamentId}`)
    .then((res) => res.json())
    .then((json) => {
      if (cancelled) return
      if (json.error) {
        setRoundsError(json.error.message ?? 'Failed to load round data')
      } else {
        setFetchedRounds(json.data ?? [])
      }
      setRoundsLoading(false)
    })
    .catch((err) => {
      if (cancelled) return
      console.error('Failed to load rounds:', err)
      setRoundsError('Failed to load round data')
      setRoundsLoading(false)
    })

  return () => {
    cancelled = true
  }
}, [score?.tournament_id, golfer.id])
```

The `cancelled` flag prevents a stale fetch response from overwriting state after the user has closed/reopened the sheet for a different golfer.

- [ ] **Step 3: Pass `fetchedRounds` to `getGolferScorecard`**

Change the existing line 52:

```typescript
const scorecard = score ? getGolferScorecard(score) : null
```

to:

```typescript
const scorecard = score ? getGolferScorecard(score, fetchedRounds) : null
```

- [ ] **Step 4: Render the skeleton / error / scorecard branches**

Replace the existing `<GolferScorecard scorecard={scorecard} />` line (inside the `scorecard ?` branch, around line 113) with:

```typescript
{roundsLoading ? (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    <div className="flex gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-14 flex-1 animate-pulse rounded-lg bg-slate-200"
        />
      ))}
    </div>
    <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
    <div className="flex gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 flex-1 animate-pulse rounded-lg bg-slate-200"
        />
      ))}
    </div>
  </div>
) : roundsError ? (
  <div className="space-y-3">
    <p className="text-sm text-red-600">
      Failed to load round data. Showing summary only.
    </p>
    <GolferScorecard scorecard={scorecard} />
  </div>
) : (
  <GolferScorecard scorecard={scorecard} />
)}
```

On error we still render the scorecard (using whatever aggregate data `score` has) so the user is not left with a blank section — the error message makes the degraded state explicit.

- [ ] **Step 5: Verify the project type-checks**

Run from the repo root: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/GolferDetailSheet.tsx
git commit -m "feat: fetch and display per-round data in GolferDetailSheet

- useEffect fetches /api/golfers/[id]/rounds when sheet opens
- Shows skeleton loading state while fetching
- Race-safe via cancelled flag for re-opened sheets
- Passes rounds to getGolferScorecard for full round data"
```

---

## Task 6: Verify end-to-end

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No ESLint errors

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

---

## Summary of All Changes

| File | Change |
|------|--------|
| `src/app/api/golfers/[golferId]/rounds/route.ts` | NEW — authenticated endpoint returning `TournamentScoreRound[]` for a golfer + tournament |
| `src/lib/golfer-detail.ts` | `RoundResult` reworked: `score`/`total` removed, explicit `strokes`, `scoreToPar`, `totalToPar`, `thru`, `courseName` added; `getGolferScorecard` gains optional rounds arg |
| `src/lib/__tests__/golfer-detail.test.ts` | Tests for round mapping, null/empty fallback, null field preservation |
| `src/components/GolferScorecard.tsx` | Full rewrite: R1–R4 tab bar (score-to-par display), per-round detail card with per-round course name, summary row, auto-advancing active tab |
| `src/components/GolferDetailSheet.tsx` | Fetches rounds when sheet opens, skeleton loading state, race-safe via cancelled flag, passes rounds to `getGolferScorecard` |

## Verification Checklist

- [ ] `GET /api/golfers/[golferId]/rounds?tournamentId=X` requires auth (401 without session) and returns rows ordered by `round_id`
- [ ] `getGolferScorecard(score)` still works without rounds (backwards compatible)
- [ ] `getGolferScorecard(score, rounds)` maps all `TournamentScoreRound` fields onto `RoundResult` with no loss
- [ ] `GolferScorecard` renders 4 tabs always (R1–R4), showing score-to-par or `--`
- [ ] Tab bar **never** displays raw strokes (would render as "+70" via `ScoreDisplay`)
- [ ] Active tab auto-advances as `completedRounds` grows, until the user manually picks a tab
- [ ] Per-round course name appears inside the active round card (not as a section header), so pro-am course rotation is visible
- [ ] Summary row shows total score, birdies, completed rounds
- [ ] Skeleton loading state shown while fetching
- [ ] Error state still renders the aggregate scorecard with an explicit error message
- [ ] Stale fetch responses can't overwrite state after sheet is re-opened for a different golfer
- [ ] All existing tests pass
