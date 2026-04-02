# Epic 5: Trust the System and Use It Everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the system transparent and trustworthy by recording audit trails for scoring changes, providing commissioner investigation tools, showing clear fallback/failure states, unifying lock-state and freshness messaging across the product, and delivering a responsive accessible PWA experience.

**Architecture:** This epic operates primarily on existing infrastructure. The `audit_events` table and `insertAuditEvent` query already exist. Story 5.1 enriches the scoring refresh to record before/after score deltas. Story 5.2 adds a new commissioner audit log page backed by a new query function. Story 5.3 introduces a shared `DataAlert` component and enhances the leaderboard with explicit failure states. Story 5.4 extracts a shared `TrustStatusBar` component that unifies lock-state + freshness + error messaging and replaces ad-hoc status rendering across all views. Story 5.5 adds a PWA web manifest, global responsive/accessibility improvements, and keyboard focus states. All domain logic stays pure TypeScript; all DB access stays in `*-queries.ts` files; all UI stays in `src/components/`.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase SSR, Tailwind CSS, Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/audit.ts` | Pure domain logic: build audit detail payloads, compute score diffs |
| `src/lib/__tests__/audit.test.ts` | Tests for audit domain logic |
| `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx` | Commissioner score trace page — shows how current leaderboard derives from stored scores |
| `src/components/DataAlert.tsx` | Shared component: warning/error/info banner for data status (failure, stale, unavailable) |
| `src/components/TrustStatusBar.tsx` | Unified lock-state + freshness + error bar used across commissioner, player, and spectator views |
| `src/components/__tests__/TrustStatusBar.test.tsx` | Tests for TrustStatusBar rendering logic |
| `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx` | Commissioner audit log page — shows scoring events, refresh history, admin actions |
| `public/manifest.json` | PWA web app manifest |
| `public/icon-192.png` | PWA icon 192x192 (placeholder) |
| `public/icon-512.png` | PWA icon 512x512 (placeholder) |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/scoring/route.ts` | Record score diffs in audit details on each refresh |
| `src/lib/pool-queries.ts` | Add `getAuditEventsForPool` query |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Replace inline scoring status with `TrustStatusBar`; add link to audit log page |
| `src/components/leaderboard.tsx` | Replace inline freshness/error rendering with `TrustStatusBar` and `DataAlert` |
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | Add `TrustStatusBar` below lock banner for live/complete pools |
| `src/app/spectator/pools/[poolId]/page.tsx` | Replace raw Supabase query with typed `getPoolById`; add `TrustStatusBar` to spectator header |
| `src/components/FreshnessChip.tsx` | Add `aria-live="polite"`, ensure text-only readability |
| `src/components/LockBanner.tsx` | Add `aria-live="polite"`, ensure no color-only signaling |
| `src/components/StatusChip.tsx` | Add `aria-label` with descriptive text |
| `src/components/LeaderboardEmptyState.tsx` | Add `DataAlert` usage for refresh failure state |
| `src/app/layout.tsx` | Add PWA manifest link, theme-color meta, viewport meta for mobile |
| `src/app/globals.css` | Add focus-visible ring utility, min touch target sizes |
| `src/app/(app)/layout.tsx` | Add responsive nav (hamburger on mobile), skip-to-content link, focus management |
| `src/components/SubmissionConfirmation.tsx` | Add responsive padding, text sizing, and break-words for small-screen legibility |

---

## Task 1: Audit Domain Logic — Score Diff Computation

**Files:**
- Create: `src/lib/audit.ts`
- Test: `src/lib/__tests__/audit.test.ts`

- [ ] **Step 1: Write failing tests for `computeScoreDiff`**

This function compares old and new tournament scores and returns a structured diff for audit storage.

Create `src/lib/__tests__/audit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { TournamentScore, GolferStatus } from '../supabase/types'
import { computeScoreDiff, buildRefreshAuditDetails } from '../audit'

function createScore(
  golferId: string,
  holes: (number | null)[],
  status: GolferStatus = 'active',
  birdies: number = 0
): TournamentScore {
  const score: Record<string, unknown> = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: birdies,
    status,
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : null
  }
  return score as TournamentScore
}

describe('audit', () => {
  describe('computeScoreDiff', () => {
    it('returns empty diff when scores are identical', () => {
      const oldScore = createScore('g1', [-1, 0, 1])
      const newScore = createScore('g1', [-1, 0, 1])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(false)
      expect(diff.holes).toEqual({})
    })

    it('detects hole score changes', () => {
      const oldScore = createScore('g1', [-1, 0, 1])
      const newScore = createScore('g1', [-1, -1, 1])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.holes).toEqual({ hole_2: { old: 0, new: -1 } })
    })

    it('detects new hole scores where old was null', () => {
      const oldScore = createScore('g1', [-1])
      const newScore = createScore('g1', [-1, 0])
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.holes).toEqual({ hole_2: { old: null, new: 0 } })
    })

    it('detects status changes', () => {
      const oldScore = createScore('g1', [-1, 0], 'active')
      const newScore = createScore('g1', [-1, 0], 'withdrawn')
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.statusChange).toEqual({ old: 'active', new: 'withdrawn' })
    })

    it('detects birdie count changes', () => {
      const oldScore = createScore('g1', [-1, 0], 'active', 1)
      const newScore = createScore('g1', [-1, 0], 'active', 2)
      const diff = computeScoreDiff(oldScore, newScore)
      expect(diff.changed).toBe(true)
      expect(diff.birdiesChange).toEqual({ old: 1, new: 2 })
    })
  })

  describe('buildRefreshAuditDetails', () => {
    it('summarizes diffs across multiple golfers', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
        ['g2', createScore('g2', [0, 0])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, -1]),
        createScore('g2', [0, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 2)
      expect(details.completedHoles).toBe(2)
      expect(details.golferCount).toBe(2)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.diffs.g1.holes).toEqual({ hole_2: { old: 0, new: -1 } })
    })

    it('returns empty diffs when nothing changed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual([])
      expect(details.diffs).toEqual({})
    })

    it('handles new golfers not in old scores', () => {
      const oldScores = new Map<string, TournamentScore>()
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.changedGolfers).toEqual(['g1'])
      expect(details.newGolfers).toEqual(['g1'])
    })

    it('detects golfers dropped from external feed', () => {
      const oldScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0])],
        ['g2', createScore('g2', [0, 1])],
      ])
      const newScores: TournamentScore[] = [
        createScore('g1', [-1, 0]),
      ]
      const details = buildRefreshAuditDetails(oldScores, newScores, 2, 1)
      expect(details.droppedGolfers).toEqual(['g2'])
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/__tests__/audit.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `computeScoreDiff` and `buildRefreshAuditDetails`**

Create `src/lib/audit.ts`:

```typescript
import type { TournamentScore } from './supabase/types'
import { getHoleScore } from './scoring'

export interface ScoreDiff {
  changed: boolean
  holes: Record<string, { old: number | null; new: number | null }>
  statusChange?: { old: string; new: string }
  birdiesChange?: { old: number; new: number }
}

export interface RefreshAuditDetails {
  completedHoles: number
  golferCount: number
  changedGolfers: string[]
  newGolfers: string[]
  droppedGolfers: string[]
  diffs: Record<string, ScoreDiff>
}

export function computeScoreDiff(
  oldScore: TournamentScore,
  newScore: TournamentScore
): ScoreDiff {
  const holes: Record<string, { old: number | null; new: number | null }> = {}
  let changed = false

  for (let i = 1; i <= 18; i++) {
    const oldHole = getHoleScore(oldScore, i)
    const newHole = getHoleScore(newScore, i)
    if (oldHole !== newHole) {
      holes[`hole_${i}`] = { old: oldHole, new: newHole }
      changed = true
    }
  }

  const diff: ScoreDiff = { changed, holes }

  if (oldScore.status !== newScore.status) {
    diff.statusChange = { old: oldScore.status, new: newScore.status }
    changed = true
  }

  if (oldScore.total_birdies !== newScore.total_birdies) {
    diff.birdiesChange = { old: oldScore.total_birdies, new: newScore.total_birdies }
    changed = true
  }

  diff.changed = changed
  return diff
}

export function buildRefreshAuditDetails(
  oldScores: Map<string, TournamentScore>,
  newScores: TournamentScore[],
  completedHoles: number,
  golferCount: number
): RefreshAuditDetails {
  const changedGolfers: string[] = []
  const newGolfers: string[] = []
  const droppedGolfers: string[] = []
  const diffs: Record<string, ScoreDiff> = {}

  const seenGolferIds = new Set<string>()

  for (const newScore of newScores) {
    seenGolferIds.add(newScore.golfer_id)
    const oldScore = oldScores.get(newScore.golfer_id)
    if (!oldScore) {
      newGolfers.push(newScore.golfer_id)
      changedGolfers.push(newScore.golfer_id)
      continue
    }
    const diff = computeScoreDiff(oldScore, newScore)
    if (diff.changed) {
      changedGolfers.push(newScore.golfer_id)
      diffs[newScore.golfer_id] = diff
    }
  }

  // Detect golfers in old scores but missing from new scores (dropped from feed)
  for (const oldGolferId of oldScores.keys()) {
    if (!seenGolferIds.has(oldGolferId)) {
      droppedGolfers.push(oldGolferId)
    }
  }

  return { completedHoles, golferCount, changedGolfers, newGolfers, droppedGolfers, diffs }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/__tests__/audit.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts src/lib/__tests__/audit.test.ts
git commit -m "feat(5.1): add audit domain logic for score diff computation"
```

---

## Task 2: Enrich Scoring Refresh with Audit Diffs

**Files:**
- Modify: `src/app/api/scoring/route.ts` (imports at top; new code after line 53; replace audit event at lines 127-132)

- [ ] **Step 1: Write failing test for enriched audit details**

Add to `src/app/api/cron/scoring/route.test.ts` (or verify manually — the scoring route test uses mocked fetch, so this is best verified by examining the audit event details in a later integration context). For now, the change is structural — the audit event `scoreRefreshCompleted` will include richer `details`.

Skip test step for this task — the scoring route is integration-heavy (mocked fetch, Supabase). The audit logic itself is tested in Task 1. We verify the wiring manually.

- [ ] **Step 2: Import audit helpers and capture old scores before upsert**

In `src/app/api/scoring/route.ts`, add import and capture existing scores before upserting new ones:

Change the imports at the top:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'
import { buildRefreshAuditDetails } from '@/lib/audit'
import {
  getActivePool,
  getOpenPoolsPastDeadline,
  updatePoolStatus,
  updatePoolRefreshMetadata,
  insertAuditEvent,
} from '@/lib/pool-queries'
import {
  upsertTournamentScore,
  getScoresForTournament,
} from '@/lib/scoring-queries'
import type { TournamentScore } from '@/lib/supabase/types'
```

Then, after Step 2 (finding the active pool) and before Step 3 (fetching external scores), capture the existing scores:

```typescript
    // Step 2.5: Capture existing scores for audit diff
    const existingScores = await getScoresForTournament(supabase, pool.tournament_id)
    const oldScoresMap = new Map<string, TournamentScore>()
    for (const score of existingScores) {
      oldScoresMap.set(score.golfer_id, score)
    }
```

- [ ] **Step 3: Replace the audit event at the end with enriched details**

Replace the `scoreRefreshCompleted` audit event (around line 127-132) to use `buildRefreshAuditDetails`:

```typescript
    const auditDetails = buildRefreshAuditDetails(
      oldScoresMap,
      allScores,
      completedHoles,
      (entries || []).length
    )

    await insertAuditEvent(supabase, {
      pool_id: pool.id,
      user_id: null,
      action: 'scoreRefreshCompleted',
      details: auditDetails,
    })
```

- [ ] **Step 4: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scoring/route.ts
git commit -m "feat(5.1): enrich scoring refresh audit with before/after diffs"
```

---

## Task 3: Audit Event Query Function

**Files:**
- Modify: `src/lib/pool-queries.ts`

- [ ] **Step 1: Add `getAuditEventsForPool` to pool-queries**

Add this function to the end of `src/lib/pool-queries.ts`:

```typescript
export async function getAuditEventsForPool(
  supabase: SupabaseClient,
  poolId: string,
  options?: { limit?: number; actionFilter?: string[] }
): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_events')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })

  if (options?.actionFilter && options.actionFilter.length > 0) {
    query = query.in('action', options.actionFilter)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query
  return (data as AuditEvent[]) || []
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pool-queries.ts
git commit -m "feat(5.2): add getAuditEventsForPool query function"
```

---

## Task 4: Commissioner Audit Log Page

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

- [ ] **Step 1: Create the audit log page**

Create `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, getAuditEventsForPool } from '@/lib/pool-queries'
import Link from 'next/link'
import type { AuditEvent } from '@/lib/supabase/types'

const ACTION_LABELS: Record<string, string> = {
  scoreRefreshCompleted: 'Score Refresh Completed',
  scoreRefreshFailed: 'Score Refresh Failed',
  entryLocked: 'Entries Auto-Locked',
  poolStarted: 'Pool Started',
  poolClosed: 'Pool Closed',
  poolCreated: 'Pool Created',
  poolConfigUpdated: 'Pool Config Updated',
  poolCloned: 'Pool Cloned',
}

const ACTION_ICONS: Record<string, string> = {
  scoreRefreshCompleted: '\u2713',
  scoreRefreshFailed: '\u26A0',
  entryLocked: '\uD83D\uDD12',
  poolStarted: '\u25B6',
  poolClosed: '\u2B1B',
  poolCreated: '\u2795',
  poolConfigUpdated: '\u2699',
  poolCloned: '\uD83D\uDCCB',
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const label = ACTION_LABELS[event.action] ?? event.action
  const icon = ACTION_ICONS[event.action] ?? '\u2022'
  const isError = event.action.includes('Failed')
  const details = event.details as Record<string, unknown>

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-sm" aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isError ? 'text-amber-700' : 'text-gray-900'}`}>
            {label}
          </span>
          <span className="text-xs text-gray-400">{formatTimestamp(event.created_at)}</span>
        </div>
        {details && Object.keys(details).length > 0 && (
          <details className="mt-1">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              View details
            </summary>
            <pre className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto max-h-40">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export default async function AuditPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')
  if (pool.commissioner_id !== user.id) redirect('/commissioner')

  const events = await getAuditEventsForPool(supabase, poolId, { limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/commissioner/pools/${poolId}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to pool
          </Link>
          <h1 className="text-2xl font-bold mt-1">Audit Log</h1>
          <p className="text-gray-500">{pool.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-gray-700">
            Recent Events ({events.length})
          </h2>
        </div>
        <div className="p-4">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No audit events recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.map(event => (
                <AuditEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add audit log link to commissioner pool detail page**

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, add a link to the audit log page. After the "Scoring Status" section (around line 144), add:

```typescript
      {/* Audit Log Link */}
      <div className="flex justify-end">
        <Link
          href={`/commissioner/pools/${poolId}/audit`}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          View audit log
        </Link>
      </div>
```

- [ ] **Step 3: Verify the build compiles and page renders**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/audit/page.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx
git commit -m "feat(5.2): add commissioner audit log page with event history"
```

---

## Task 4A: Commissioner Score Trace Page — Leaderboard Derivation View

**Stories:** 5.2 (AC: "trace the current leaderboard back to stored inputs")

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx` (add link)

This task satisfies the "trace" part of Story 5.2's AC. The commissioner can see, for each ranked entry, which golfer scores were used, what each golfer's hole-by-hole scores are, and how the best-ball total was derived. This connects the stored `tournament_scores` to the final leaderboard output.

- [ ] **Step 1: Create the score trace page**

Create `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, getEntriesForPool } from '@/lib/pool-queries'
import { getScoresForTournament } from '@/lib/scoring-queries'
import { rankEntries, getHoleScore, getEntryHoleScore } from '@/lib/scoring'
import Link from 'next/link'
import type { TournamentScore, Entry } from '@/lib/supabase/types'

function formatScore(score: number | null): string {
  if (score === null) return '-'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}

function HoleScoreGrid({
  golferScores,
  golferIds,
  golferNames,
  completedHoles,
}: {
  golferScores: Map<string, TournamentScore>
  golferIds: string[]
  golferNames: Record<string, string>
  completedHoles: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-1 text-left">Golfer</th>
            <th className="px-2 py-1 text-left">Status</th>
            {Array.from({ length: Math.min(completedHoles, 18) }, (_, i) => (
              <th key={i} className="px-1 py-1 text-center w-8">{i + 1}</th>
            ))}
            <th className="px-2 py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {golferIds.map(golferId => {
            const score = golferScores.get(golferId)
            const name = golferNames[golferId] ?? golferId.slice(0, 8)
            const status = score?.status ?? 'no data'
            const isInactive = status === 'withdrawn' || status === 'cut'

            let golferTotal = 0
            const holeValues: (number | null)[] = []
            for (let h = 1; h <= Math.min(completedHoles, 18); h++) {
              const val = score ? getHoleScore(score, h) : null
              holeValues.push(val)
              if (val !== null) golferTotal += val
            }

            return (
              <tr key={golferId} className={`border-t ${isInactive ? 'opacity-50' : ''}`}>
                <td className="px-2 py-1 font-medium whitespace-nowrap">{name}</td>
                <td className="px-2 py-1">
                  <span className={`text-xs ${isInactive ? 'text-amber-600' : 'text-green-600'}`}>
                    {status}
                  </span>
                </td>
                {holeValues.map((val, i) => {
                  const bestBall = getEntryHoleScore(golferScores, golferIds, i + 1)
                  const isUsed = val !== null && val === bestBall
                  return (
                    <td
                      key={i}
                      className={`px-1 py-1 text-center font-mono ${isUsed ? 'bg-green-50 font-bold' : ''}`}
                      title={isUsed ? 'Used in best-ball' : ''}
                    >
                      {formatScore(val)}
                    </td>
                  )
                })}
                <td className="px-2 py-1 text-right font-mono">
                  {score ? formatScore(golferTotal) : '-'}
                </td>
              </tr>
            )
          })}
          {/* Best-ball row */}
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
            <td className="px-2 py-1" colSpan={2}>Best Ball</td>
            {Array.from({ length: Math.min(completedHoles, 18) }, (_, i) => {
              const bestBall = getEntryHoleScore(golferScores, golferIds, i + 1)
              return (
                <td key={i} className="px-1 py-1 text-center font-mono">
                  {formatScore(bestBall)}
                </td>
              )
            })}
            <td className="px-2 py-1 text-right font-mono">
              {formatScore(
                Array.from({ length: Math.min(completedHoles, 18) }, (_, i) =>
                  getEntryHoleScore(golferScores, golferIds, i + 1)
                ).reduce((sum, v) => sum + (v ?? 0), 0)
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default async function ScoreTracePage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')
  if (pool.commissioner_id !== user.id) redirect('/commissioner')

  if (pool.status === 'open') {
    redirect(`/commissioner/pools/${poolId}`)
  }

  const scores = await getScoresForTournament(supabase, pool.tournament_id)
  const golferScoresMap = new Map<string, TournamentScore>()
  for (const s of scores) {
    golferScoresMap.set(s.golfer_id, s)
  }

  const rawEntries = await getEntriesForPool(supabase, poolId)
  const entries: Entry[] = rawEntries
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .filter(e => typeof e.id === 'string' && typeof e.user_id === 'string')
    .map(e => ({
      id: e.id as string,
      pool_id: poolId,
      user_id: e.user_id as string,
      golfer_ids: Array.isArray(e.golfer_ids) ? e.golfer_ids : [],
      total_birdies: (e.total_birdies as number) ?? 0,
      created_at: (e.created_at as string) ?? '',
      updated_at: (e.updated_at as string) ?? '',
    }))

  // Use the same ranking logic the leaderboard uses
  const completedHoles = scores.length > 0
    ? Math.max(...scores.map(s => {
        let count = 0
        for (let h = 1; h <= 18; h++) {
          if (getHoleScore(s, h) !== null) count = h
          else break
        }
        return count
      }))
    : 0

  const ranked = rankEntries(entries, golferScoresMap, completedHoles)

  const { data: allGolfers } = await supabase.from('golfers').select('*')
  const golferNames: Record<string, string> = {}
  for (const g of allGolfers ?? []) {
    golferNames[g.id] = g.name
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/commissioner/pools/${poolId}/audit`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to audit log
        </Link>
        <h1 className="text-2xl font-bold mt-1">Score Trace</h1>
        <p className="text-gray-500">{pool.name} &mdash; {completedHoles} holes completed</p>
        <p className="text-xs text-gray-400 mt-1">
          This view shows how the current leaderboard is derived from stored tournament scores.
          Highlighted cells indicate the score used in best-ball selection for each hole.
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No ranked entries to trace. Scores may not have been received yet.
        </p>
      ) : (
        ranked.map((entry, index) => (
          <div key={entry.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">#{entry.rank}</span>
                <span className="text-sm">{entry.user_id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Score: <strong className="font-mono">{formatScore(entry.totalScore)}</strong></span>
                <span>Birdies: <strong>{entry.totalBirdies}</strong></span>
              </div>
            </div>
            <div className="p-3">
              <HoleScoreGrid
                golferScores={golferScoresMap}
                golferIds={entry.golfer_ids}
                golferNames={golferNames}
                completedHoles={completedHoles}
              />
            </div>
          </div>
        ))
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>Data source: <code>tournament_scores</code> table, tournament <code>{pool.tournament_id}</code></p>
        <p>Last refreshed: {pool.refreshed_at ? new Date(pool.refreshed_at).toLocaleString() : 'Never'}</p>
        <p>Ranking algorithm: best-ball lowest score, tiebreaker by total birdies</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add link to score trace from audit log page**

In `src/app/(app)/commissioner/pools/[poolId]/audit/page.tsx`, add a link to the score trace page. After the "Recent Events" heading div, add:

```typescript
        <div className="px-4 pt-2">
          <Link
            href={`/commissioner/pools/${poolId}/audit/score-trace`}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Trace current leaderboard to stored scores &rarr;
          </Link>
        </div>
```

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/audit/page.tsx
git commit -m "feat(5.2): add score trace page to trace leaderboard back to stored inputs"
```

---

## Task 5: DataAlert Component for Failure/Fallback States

**Files:**
- Create: `src/components/DataAlert.tsx`

- [ ] **Step 1: Create the DataAlert component**

This component renders a styled alert banner for data unavailability, staleness, or errors. It never relies on color alone — always includes an icon and text label.

Create `src/components/DataAlert.tsx`:

```typescript
type AlertVariant = 'error' | 'warning' | 'info'

interface DataAlertProps {
  variant: AlertVariant
  title: string
  message?: string
}

const VARIANT_CONFIG: Record<AlertVariant, { icon: string; classes: string; srPrefix: string }> = {
  error: {
    icon: '\u2716', // heavy X
    classes: 'bg-red-50 border-red-200 text-red-800',
    srPrefix: 'Error:',
  },
  warning: {
    icon: '\u26A0', // warning triangle
    classes: 'bg-amber-50 border-amber-200 text-amber-800',
    srPrefix: 'Warning:',
  },
  info: {
    icon: '\u2139', // info circle
    classes: 'bg-blue-50 border-blue-200 text-blue-800',
    srPrefix: 'Info:',
  },
}

export function DataAlert({ variant, title, message }: DataAlertProps) {
  const config = VARIANT_CONFIG[variant]

  return (
    <div
      className={`flex items-start gap-2 p-3 border rounded-lg text-sm ${config.classes}`}
      role="alert"
      aria-live="polite"
    >
      <span aria-hidden="true" className="flex-shrink-0 mt-0.5">{config.icon}</span>
      <div>
        <span className="sr-only">{config.srPrefix} </span>
        <p className="font-medium">{title}</p>
        {message && <p className="mt-0.5 opacity-80">{message}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/DataAlert.tsx
git commit -m "feat(5.3): add DataAlert component for failure and fallback states"
```

---

## Task 6: Enhance Leaderboard with Explicit Failure States

**Files:**
- Modify: `src/components/leaderboard.tsx:112-127`
- Modify: `src/components/LeaderboardEmptyState.tsx`

- [ ] **Step 1: Update LeaderboardEmptyState to use DataAlert for refresh errors**

Replace the inline error rendering in `src/components/LeaderboardEmptyState.tsx` with the `DataAlert` component:

```typescript
import type { PoolStatus } from '@/lib/supabase/types'
import { DataAlert } from './DataAlert'

interface LeaderboardEmptyStateProps {
  poolStatus: PoolStatus
  hasEntries: boolean
  hasScores: boolean
  lastRefreshError: string | null
}

export function LeaderboardEmptyState({
  poolStatus,
  hasEntries,
  hasScores,
  lastRefreshError,
}: LeaderboardEmptyStateProps) {
  let title: string
  let description: string

  if (poolStatus === 'open') {
    title = 'Waiting for tournament to start'
    description = hasEntries
      ? 'Entries have been submitted. Standings will appear once the tournament goes live and scoring begins.'
      : 'No entries submitted yet. Share the invite link so players can join and make their picks.'
  } else if (!hasEntries) {
    title = 'No entries in this pool'
    description = 'This pool has no entries. Standings cannot be calculated without participants.'
  } else if (!hasScores) {
    title = 'Waiting for scores'
    description = 'The tournament is live but no scoring data has been received yet. Standings will appear once the first scores come in.'
  } else {
    title = 'Standings unavailable'
    description = 'We were unable to compute standings. This is likely a temporary issue.'
  }

  return (
    <div className="p-8 text-center space-y-4" role="status">
      <p className="text-lg font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>
      {lastRefreshError && poolStatus === 'live' && (
        <div className="max-w-md mx-auto text-left">
          <DataAlert
            variant="warning"
            title="Score refresh failed"
            message={lastRefreshError}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update leaderboard fetch error state to use DataAlert**

In `src/components/leaderboard.tsx`, replace the fetch error block (lines 120-127):

Replace:
```typescript
  if (fetchError) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center" role="alert">
        <p className="text-red-600 font-medium">Unable to load leaderboard</p>
        <p className="text-sm text-gray-500 mt-1">{fetchError}</p>
      </div>
    )
  }
```

With:
```typescript
  if (fetchError) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <DataAlert
          variant="error"
          title="Unable to load leaderboard"
          message={fetchError}
        />
      </div>
    )
  }
```

Add the import at the top of `leaderboard.tsx`:
```typescript
import { DataAlert } from './DataAlert'
```

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/LeaderboardEmptyState.tsx src/components/leaderboard.tsx
git commit -m "feat(5.3): use DataAlert for leaderboard failure and fallback states"
```

---

## Task 7: TrustStatusBar Component — Unified Lock + Freshness + Error

**Files:**
- Create: `src/components/TrustStatusBar.tsx`
- Create: `src/components/__tests__/TrustStatusBar.test.tsx`

- [ ] **Step 1: Write failing tests for TrustStatusBar**

Create `src/components/__tests__/TrustStatusBar.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { getTrustStatusBarState } from '../TrustStatusBar'
import type { PoolStatus, FreshnessStatus } from '@/lib/supabase/types'

describe('getTrustStatusBarState', () => {
  it('returns locked message for live pool', () => {
    const state = getTrustStatusBarState({
      poolStatus: 'live',
      isLocked: true,
      freshness: 'current',
      lastRefreshError: null,
    })
    expect(state.lockLabel).toBe('Locked')
    expect(state.lockIcon).toBeTruthy()
  })

  it('returns open message for open pool', () => {
    const state = getTrustStatusBarState({
      poolStatus: 'open',
      isLocked: false,
      freshness: 'unknown',
      lastRefreshError: null,
    })
    expect(state.lockLabel).toBe('Open')
  })

  it('includes stale warning when freshness is stale', () => {
    const state = getTrustStatusBarState({
      poolStatus: 'live',
      isLocked: true,
      freshness: 'stale',
      lastRefreshError: null,
    })
    expect(state.freshnessLabel).toBe('Stale')
    expect(state.showFreshnessWarning).toBe(true)
  })

  it('includes error info when last refresh failed', () => {
    const state = getTrustStatusBarState({
      poolStatus: 'live',
      isLocked: true,
      freshness: 'stale',
      lastRefreshError: 'API timeout',
    })
    expect(state.errorMessage).toBe('API timeout')
  })

  it('hides freshness for open pools', () => {
    const state = getTrustStatusBarState({
      poolStatus: 'open',
      isLocked: false,
      freshness: 'unknown',
      lastRefreshError: null,
    })
    expect(state.showFreshness).toBe(false)
  })

  it('shows freshness for live and complete pools', () => {
    const stLive = getTrustStatusBarState({
      poolStatus: 'live',
      isLocked: true,
      freshness: 'current',
      lastRefreshError: null,
    })
    expect(stLive.showFreshness).toBe(true)

    const stComplete = getTrustStatusBarState({
      poolStatus: 'complete',
      isLocked: true,
      freshness: 'current',
      lastRefreshError: null,
    })
    expect(stComplete.showFreshness).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/components/__tests__/TrustStatusBar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TrustStatusBar**

Create `src/components/TrustStatusBar.tsx`:

```typescript
import { FreshnessChip } from './FreshnessChip'
import { DataAlert } from './DataAlert'
import type { PoolStatus, FreshnessStatus } from '@/lib/supabase/types'

interface TrustStatusBarInput {
  poolStatus: PoolStatus
  isLocked: boolean
  freshness: FreshnessStatus
  lastRefreshError: string | null
  refreshedAt?: string | null
}

export interface TrustStatusBarState {
  lockLabel: string
  lockIcon: string
  lockClasses: string
  showFreshness: boolean
  freshnessLabel: string
  showFreshnessWarning: boolean
  errorMessage: string | null
}

export function getTrustStatusBarState(input: TrustStatusBarInput): TrustStatusBarState {
  const lockLabel = input.isLocked ? 'Locked' : 'Open'
  const lockIcon = input.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'
  const lockClasses = input.isLocked
    ? 'bg-gray-100 text-gray-700 border-gray-300'
    : 'bg-green-50 text-green-800 border-green-200'

  const showFreshness = input.poolStatus !== 'open'

  const freshnessLabelMap: Record<FreshnessStatus, string> = {
    current: 'Current',
    stale: 'Stale',
    unknown: 'No data yet',
  }
  const freshnessLabel = freshnessLabelMap[input.freshness]
  const showFreshnessWarning = input.freshness === 'stale'

  const errorMessage = input.lastRefreshError ?? null

  return {
    lockLabel,
    lockIcon,
    lockClasses,
    showFreshness,
    freshnessLabel,
    showFreshnessWarning,
    errorMessage,
  }
}

interface TrustStatusBarProps {
  poolStatus: PoolStatus
  isLocked: boolean
  freshness: FreshnessStatus
  lastRefreshError: string | null
  refreshedAt?: string | null
}

export function TrustStatusBar({
  poolStatus,
  isLocked,
  freshness,
  lastRefreshError,
  refreshedAt,
}: TrustStatusBarProps) {
  const state = getTrustStatusBarState({
    poolStatus,
    isLocked,
    freshness,
    lastRefreshError,
    refreshedAt,
  })

  return (
    <div className="space-y-2" role="region" aria-label="Pool trust status">
      {/* Lock + Freshness row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Lock indicator */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${state.lockClasses}`}
          role="status"
          aria-label={`Picks are ${state.lockLabel.toLowerCase()}`}
        >
          <span aria-hidden="true">{state.lockIcon}</span>
          <span>Picks {state.lockLabel}</span>
        </span>

        {/* Freshness chip */}
        {state.showFreshness && (
          <FreshnessChip status={freshness} refreshedAt={refreshedAt} />
        )}
      </div>

      {/* Error alert */}
      {state.errorMessage && poolStatus === 'live' && (
        <DataAlert
          variant="warning"
          title="Score refresh issue"
          message={state.errorMessage}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/components/__tests__/TrustStatusBar.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.test.tsx
git commit -m "feat(5.4): add TrustStatusBar with unified lock, freshness, and error messaging"
```

---

## Task 8: Replace Ad-Hoc Status Rendering with TrustStatusBar

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/components/leaderboard.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`

- [ ] **Step 1: Replace commissioner pool detail inline scoring status**

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`:

1. Add import for `TrustStatusBar`:

```typescript
import { TrustStatusBar } from '@/components/TrustStatusBar'
```

2. Replace the "Scoring Refresh Status" section (lines 124-144) with:

```typescript
      {/* Trust Status */}
      <TrustStatusBar
        poolStatus={pool.status}
        isLocked={isLocked}
        freshness={classifyFreshness(pool.refreshed_at)}
        lastRefreshError={pool.last_refresh_error}
        refreshedAt={pool.refreshed_at}
      />
```

- [ ] **Step 2: Replace leaderboard inline freshness/error with TrustStatusBar**

In `src/components/leaderboard.tsx`:

1. Add imports:

```typescript
import { TrustStatusBar } from './TrustStatusBar'
```

2. Replace the header section (lines 157-179) where freshness chip and error are rendered inline. Replace the content inside the `p-4 border-b` div with:

```typescript
      <div className="p-4 border-b space-y-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          {completedHoles > 0 && (
            <span className="text-sm text-gray-500">
              Thru {completedHoles} holes
            </span>
          )}
        </div>
        <TrustStatusBar
          poolStatus={poolStatus}
          isLocked={true}
          freshness={freshness}
          lastRefreshError={lastRefreshError}
          refreshedAt={refreshedAt}
        />
      </div>
```

Remove the standalone `FreshnessChip` import if it is no longer used directly (it will still be used via `TrustStatusBar`). Keep the `DataAlert` import for the fetch-error state.

- [ ] **Step 3: Add TrustStatusBar to participant picks page**

In `src/app/(app)/participant/picks/[poolId]/page.tsx`:

1. Add imports:

```typescript
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { classifyFreshness } from '@/lib/freshness'
```

2. After the `<LockBanner>` and before the conditional entry rendering, add:

```typescript
      {(pool.status === 'live' || pool.status === 'complete') && (
        <div className="mb-4">
          <TrustStatusBar
            poolStatus={pool.status}
            isLocked={isLocked}
            freshness={classifyFreshness(pool.refreshed_at)}
            lastRefreshError={pool.last_refresh_error}
            refreshedAt={pool.refreshed_at}
          />
        </div>
      )}
```

- [ ] **Step 4: Add TrustStatusBar to spectator page**

In `src/app/spectator/pools/[poolId]/page.tsx`:

1. Replace the raw Supabase query with the typed `getPoolById` function for type safety. Change imports:

```typescript
import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'
import { StatusChip } from '@/components/StatusChip'
import { TrustStatusBar } from '@/components/TrustStatusBar'
import { getPoolById } from '@/lib/pool-queries'
import { classifyFreshness } from '@/lib/freshness'
import { notFound } from 'next/navigation'
```

2. Replace the raw query:

```typescript
  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()
```

With:

```typescript
  const pool = await getPoolById(supabase, poolId)
```

3. After the header div and before the `<main>` tag, add the trust bar inside the header:

```typescript
          <div className="mt-4">
            <TrustStatusBar
              poolStatus={pool.status}
              isLocked={pool.status !== 'open'}
              freshness={classifyFreshness(pool.refreshed_at)}
              lastRefreshError={pool.last_refresh_error}
              refreshedAt={pool.refreshed_at}
            />
          </div>
```

- [ ] **Step 5: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx src/components/leaderboard.tsx src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/app/spectator/pools/\[poolId\]/page.tsx
git commit -m "feat(5.4): replace ad-hoc status rendering with unified TrustStatusBar across all views"
```

---

## Task 9: Accessibility Improvements to Existing Components

**Files:**
- Modify: `src/components/FreshnessChip.tsx`
- Modify: `src/components/LockBanner.tsx`
- Modify: `src/components/StatusChip.tsx`

- [ ] **Step 1: Add `aria-live` to FreshnessChip**

In `src/components/FreshnessChip.tsx`, add `aria-live="polite"` to the outer `<span>`:

Change line 42:
```typescript
      aria-label={config.srText}
```
to:
```typescript
      aria-label={config.srText}
      aria-live="polite"
```

- [ ] **Step 2: Add `aria-live` to LockBanner**

In `src/components/LockBanner.tsx`, the `role="status"` on both the locked and unlocked divs already implies `aria-live="polite"`. Verify this is correct — `role="status"` has an implicit `aria-live="polite"`. No change needed if already using `role="status"`.

Add explicit text labels so color is not the only signal. The component already uses emoji icons + text labels, so this requirement is met. No changes needed.

- [ ] **Step 3: Add descriptive `aria-label` to StatusChip**

In `src/components/StatusChip.tsx`, add an `aria-label` to the outer `<span>`:

Replace line 25:
```typescript
      role="status"
```
with:
```typescript
      role="status"
      aria-label={`Pool status: ${config.label}`}
```

- [ ] **Step 4: Run tests to make sure nothing is broken**

Run: `pnpm test`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FreshnessChip.tsx src/components/StatusChip.tsx
git commit -m "feat(5.5): improve accessibility attributes on status components"
```

---

## Task 10: PWA Manifest and Root Layout Meta Tags

**Files:**
- Create: `public/manifest.json`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create PWA manifest**

Create `public/manifest.json`:

```json
{
  "name": "Fantasy Golf Pool",
  "short_name": "Fantasy Golf",
  "description": "Private golf pools with live scoring",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f9fafb",
  "theme_color": "#16a34a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create placeholder PWA icons**

These are minimal placeholder PNGs. Use a simple solid-color square for now — they can be replaced with a real icon later.

Run:

```bash
# Create a minimal 192x192 green PNG (1x1 pixel scaled — placeholder)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xa8\x18\x05\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82' > public/icon-192.png
cp public/icon-192.png public/icon-512.png
```

(These are tiny 1x1 placeholder images. Replace with proper icons before launch.)

- [ ] **Step 3: Update root layout with PWA meta and manifest link**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fantasy Golf Pool',
  description: 'Private golf pools with live scoring',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fantasy Golf',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16a34a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png src/app/layout.tsx
git commit -m "feat(5.5): add PWA manifest, viewport meta, and placeholder icons"
```

---

## Task 11: Global Responsive and Accessibility CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add focus-visible styles and minimum touch target sizes**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Focus-visible ring for keyboard navigation */
  *:focus-visible {
    @apply outline-none ring-2 ring-blue-500 ring-offset-2;
  }

  /* Minimum touch target for interactive elements on mobile */
  button,
  a,
  [role="button"],
  input,
  select,
  textarea {
    min-height: 44px;
    min-width: 44px;
  }

  /* Exception: inline links and chips don't need 44px min-width */
  a:not([class*="px-"]):not([class*="py-"]) {
    min-height: auto;
    min-width: auto;
  }

  /* Chips and small badges */
  [role="status"] {
    min-height: auto;
    min-width: auto;
  }
}
```

- [ ] **Step 2: Verify the build compiles and styles render**

Run: `pnpm build`
Expected: No type errors, no PostCSS errors

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(5.5): add global focus-visible ring and touch target base styles"
```

---

## Task 12: Responsive Nav and Skip-to-Content Link

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Add skip-to-content link and improve nav responsiveness**

Replace `src/app/(app)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to content link — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:rounded focus:shadow-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <nav className="bg-white shadow-sm" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/participant/pools" className="text-xl font-bold">
            Fantasy Golf
          </Link>
          <div className="flex gap-2 sm:gap-4">
            <Link
              href="/participant/pools"
              className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
            >
              My Pools
            </Link>
            <Link
              href="/commissioner"
              className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
            >
              Commissioner
            </Link>
          </div>
        </div>
      </nav>
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat(5.5): add skip-to-content link, responsive nav, and landmark roles"
```

---

## Task 12A: Small-Screen Legibility for Status Chips, Confirmations, and Alerts

**Stories:** 5.5 AC#2 ("status chips, confirmation states, and errors remain legible on small screens")

**Files:**
- Modify: `src/components/SubmissionConfirmation.tsx`
- Modify: `src/components/FreshnessChip.tsx`
- Modify: `src/components/StatusChip.tsx`
- Modify: `src/components/DataAlert.tsx`
- Modify: `src/components/TrustStatusBar.tsx`

This task explicitly ensures that all status/confirmation/error components render legibly at small viewport widths (320px+). The AC specifically calls out "status chips, confirmation states, and errors remain legible on small screens."

- [ ] **Step 1: Audit and improve SubmissionConfirmation for small screens**

In `src/components/SubmissionConfirmation.tsx`, the component currently uses fixed-size text and padding. Add responsive classes to ensure it renders well on narrow screens:

Replace:
```typescript
      <div
        className="p-4 bg-green-50 border border-green-200 rounded-lg"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 mb-2">
          <span aria-hidden="true" className="text-green-700 text-lg">
            &#x2713;
          </span>
          <p className="font-semibold text-green-800">
            Entry submitted for {poolName}
          </p>
        </div>
        <p className="text-sm text-green-700">
```

With:
```typescript
      <div
        className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start sm:items-center gap-2 mb-2">
          <span aria-hidden="true" className="text-green-700 text-lg flex-shrink-0">
            &#x2713;
          </span>
          <p className="font-semibold text-green-800 text-sm sm:text-base break-words">
            Entry submitted for {poolName}
          </p>
        </div>
        <p className="text-xs sm:text-sm text-green-700">
```

- [ ] **Step 2: Ensure FreshnessChip text doesn't truncate on narrow screens**

In `src/components/FreshnessChip.tsx`, verify the chip uses `whitespace-nowrap` and `text-xs` — these should keep the chip compact enough for small screens. No changes needed if it already uses `text-xs`. If the chip uses a larger text size, reduce to `text-xs`.

Check the outer span: it should include `max-w-full` or `flex-shrink-0` so it doesn't get clipped by flex containers on narrow viewports:

Add `flex-shrink-0` to the FreshnessChip outer span if not already present.

- [ ] **Step 3: Ensure StatusChip renders at consistent small size**

In `src/components/StatusChip.tsx`, verify it uses `text-xs` and compact padding. No changes needed if already compact. The chip is a badge — it should always be small.

- [ ] **Step 4: Ensure DataAlert wraps text on narrow screens**

In `src/components/DataAlert.tsx`, the component already uses `text-sm` and flex layout. Add `break-words` to the text container and `min-w-0` to the flex child to prevent overflow:

Replace:
```typescript
      <div>
        <span className="sr-only">{config.srPrefix} </span>
        <p className="font-medium">{title}</p>
        {message && <p className="mt-0.5 opacity-80">{message}</p>}
      </div>
```

With:
```typescript
      <div className="min-w-0">
        <span className="sr-only">{config.srPrefix} </span>
        <p className="font-medium break-words">{title}</p>
        {message && <p className="mt-0.5 opacity-80 break-words">{message}</p>}
      </div>
```

- [ ] **Step 5: Ensure TrustStatusBar wraps cleanly on narrow screens**

In `src/components/TrustStatusBar.tsx`, the bar already uses `flex-wrap`. Verify that at 320px width, the lock indicator and freshness chip stack vertically rather than overflowing. The `flex flex-wrap items-center gap-3` should handle this. Add `w-full` to the error alert section if not already present:

No changes needed — the existing `flex-wrap` and `space-y-2` layout handles narrow viewports.

- [ ] **Step 6: Verify the build compiles**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/components/SubmissionConfirmation.tsx src/components/DataAlert.tsx
git commit -m "feat(5.5): improve small-screen legibility for status chips, confirmations, and alerts"
```

---

## Task 13: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS (audit.test.ts, TrustStatusBar.test.ts, and all existing tests)

- [ ] **Step 2: Run the build**

Run: `pnpm build`
Expected: Clean build, no type errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 4: Commit any fixes**

If steps 1-3 revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix(5): address lint and type issues from epic 5 implementation"
```

---

## Story Coverage Matrix

| Story | AC | Tasks |
|-------|-----|-------|
| **5.1** Record scoring changes and audit trails | Scores record what changed and when; available for review; detect dropped golfers | Task 1 (audit diff logic incl. dropped golfer detection), Task 2 (enrich refresh), Task 3 (query function), Task 4 (audit page) |
| **5.2** Investigate scoring issues with admin tools | Commissioner can review refresh history, scoring events, trace leaderboard back to stored inputs | Task 3 (query), Task 4 (audit log page with event details), **Task 4A (score trace page — leaderboard derivation view)** |
| **5.3** Show fallback or failure states clearly | Clear fallback/failure state; no stale data as current | Task 5 (DataAlert), Task 6 (leaderboard failure states), Task 7 (TrustStatusBar warning) |
| **5.4** Keep lock-state and freshness messaging consistent | Consistent across screens; no color-only; shared treatment | Task 7 (TrustStatusBar), Task 8 (replace across all views; spectator page uses typed getPoolById), Task 9 (a11y improvements) |
| **5.5** Responsive accessible PWA experience | Layout adapts; online-only PWA; touch targets; focus states; keyboard nav; small screen legibility | Task 10 (PWA manifest), Task 11 (CSS), Task 12 (responsive nav), Task 9 (a11y), **Task 12A (small-screen legibility for chips, confirmations, alerts)** |
