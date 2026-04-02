# Epic 2: Join and Submit Picks on Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can join a pool from an invite link, sign in on mobile, submit golfer picks, track remaining picks, edit before lock, and see clear confirmation — all with server-enforced validation, lock-state awareness, and mobile-first design.

**Architecture:** Next.js App Router with server actions for mutations, Supabase Postgres as the source of truth, and pure TypeScript domain logic for pick validation and lock rules. The existing Epic 1 infrastructure (pools, pool_members, entries, auth, query helpers) is already in place. This epic fixes deficiencies in the existing `submitPicks` action, `GolferPicker` component, `My Pools` page, and sign-in redirect flow, then adds proper lock-state UI, remaining-picks tracking, submission confirmation, and edit-before-lock capability.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript strict, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tailwind CSS 3.4, Vitest 4.1

---

## Existing Code Deficiencies (What This Plan Fixes)

These are bugs/gaps in the Epic 1 scaffold that Epic 2 must address:

1. **`submitPicks` action** (`src/app/(app)/participant/picks/[poolId]/actions.ts`): Hardcodes `golferIds.length !== 4` instead of reading `pool.picks_per_entry`. Does not verify pool membership. Does not check lock state server-side. Throws raw errors instead of returning form state. No audit logging.
2. **Sign-in redirect** (`src/app/(auth)/sign-in/actions.ts`): Always redirects to `/participant/pools` after sign-in. Does not honor `?redirect=` query param, so the invite-link flow is broken.
3. **My Pools page** (`src/app/(app)/participant/pools/page.tsx`): Queries `entries` table only, so pools where the user joined but hasn't picked yet don't appear.
4. **GolferPicker** (`src/components/golfer-picker.tsx`): No remaining-picks progress indicator. Uses `onClick` div instead of accessible button/checkbox. No completion-state visual. Hidden list by default (confusing UX).
5. **Picks page** (`src/app/(app)/participant/picks/[poolId]/page.tsx`): No pool membership check. No submission confirmation. Lock messaging is minimal. Form uses hidden input + DOM manipulation instead of React state.

## File Structure

### Files to Create

| File | Responsibility |
|---|---|
| `src/lib/picks.ts` | Pure domain logic: pick validation, lock-state check, remaining-picks calculation |
| `src/lib/__tests__/picks.test.ts` | Tests for pick domain logic |
| `src/lib/entry-queries.ts` | Supabase query helpers for entries (get, upsert, membership check) |
| `src/components/PickProgress.tsx` | Remaining-picks counter with accessible completion state |
| `src/components/LockBanner.tsx` | Reusable lock-state banner (locked / editable with deadline) |
| `src/components/SubmissionConfirmation.tsx` | Post-submit confirmation card showing saved picks and lock state |

### Files to Modify

| File | What Changes |
|---|---|
| `src/app/(auth)/sign-in/actions.ts` | Honor `?redirect=` query param |
| `src/app/(auth)/sign-in/page.tsx` | Pass redirect param to signIn action |
| `src/app/(app)/participant/pools/page.tsx` | Query `pool_members` instead of `entries` to show all joined pools |
| `src/app/(app)/participant/picks/[poolId]/actions.ts` | Full rewrite: proper validation, lock check, membership check, audit, form state |
| `src/app/(app)/participant/picks/[poolId]/page.tsx` | Full rewrite: membership gate, lock banner, pick progress, confirmation, accessible form |
| `src/components/golfer-picker.tsx` | Accessibility: button roles, keyboard support, show list by default, accept maxSelections from pool |

---

## Task 1: Pick Domain Logic

**Files:**
- Create: `src/lib/picks.ts`
- Create: `src/lib/__tests__/picks.test.ts`

### Step 1: Write failing tests for pick validation

- [ ] **Step 1a: Create the test file with pick validation tests**

```typescript
// src/lib/__tests__/picks.test.ts
import { describe, it, expect } from 'vitest'
import {
  validatePickSubmission,
  isPoolLocked,
  calculateRemainingPicks,
} from '../picks'

describe('validatePickSubmission', () => {
  it('returns ok when golfer count equals picks_per_entry', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4'],
      picksPerEntry: 4,
      isLocked: false,
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects when too few golfers selected', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2'],
      picksPerEntry: 4,
      isLocked: false,
    })
    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 2.',
    })
  })

  it('rejects when too many golfers selected', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4', 'g5'],
      picksPerEntry: 4,
      isLocked: false,
    })
    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 5.',
    })
  })

  it('rejects when pool is locked', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2', 'g3', 'g4'],
      picksPerEntry: 4,
      isLocked: true,
    })
    expect(result).toEqual({
      ok: false,
      error: 'This pool is locked. Picks can no longer be changed.',
    })
  })

  it('rejects empty golfer list', () => {
    const result = validatePickSubmission({
      golferIds: [],
      picksPerEntry: 4,
      isLocked: false,
    })
    expect(result).toEqual({
      ok: false,
      error: 'Please select exactly 4 golfers. You have selected 0.',
    })
  })

  it('rejects duplicate golfer IDs', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g1', 'g3', 'g4'],
      picksPerEntry: 4,
      isLocked: false,
    })
    expect(result).toEqual({
      ok: false,
      error: 'Duplicate golfer selections are not allowed.',
    })
  })

  it('works with non-default picks_per_entry', () => {
    const result = validatePickSubmission({
      golferIds: ['g1', 'g2'],
      picksPerEntry: 2,
      isLocked: false,
    })
    expect(result).toEqual({ ok: true })
  })
})

describe('isPoolLocked', () => {
  it('returns false when status is open and deadline is in the future', () => {
    const futureDeadline = new Date(Date.now() + 86400000).toISOString()
    expect(isPoolLocked('open', futureDeadline)).toBe(false)
  })

  it('returns true when status is live', () => {
    const futureDeadline = new Date(Date.now() + 86400000).toISOString()
    expect(isPoolLocked('live', futureDeadline)).toBe(true)
  })

  it('returns true when status is complete', () => {
    const futureDeadline = new Date(Date.now() + 86400000).toISOString()
    expect(isPoolLocked('complete', futureDeadline)).toBe(true)
  })

  it('returns true when status is open but deadline has passed', () => {
    const pastDeadline = new Date(Date.now() - 86400000).toISOString()
    expect(isPoolLocked('open', pastDeadline)).toBe(true)
  })

  it('accepts an explicit now parameter for deterministic testing', () => {
    const deadline = '2026-04-10T08:00:00Z'
    const beforeDeadline = new Date('2026-04-09T08:00:00Z')
    const afterDeadline = new Date('2026-04-11T08:00:00Z')
    expect(isPoolLocked('open', deadline, beforeDeadline)).toBe(false)
    expect(isPoolLocked('open', deadline, afterDeadline)).toBe(true)
  })
})

describe('calculateRemainingPicks', () => {
  it('returns remaining when partially filled', () => {
    expect(calculateRemainingPicks(2, 4)).toBe(2)
  })

  it('returns 0 when fully filled', () => {
    expect(calculateRemainingPicks(4, 4)).toBe(0)
  })

  it('returns full count when empty', () => {
    expect(calculateRemainingPicks(0, 4)).toBe(4)
  })

  it('returns 0 when overfilled (defensive)', () => {
    expect(calculateRemainingPicks(5, 4)).toBe(0)
  })
})
```

- [ ] **Step 1b: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/picks.test.ts`
Expected: FAIL — module `../picks` does not exist

### Step 2: Implement pick domain logic

- [ ] **Step 2a: Create the picks module**

```typescript
// src/lib/picks.ts
import type { PoolStatus } from './supabase/types'

export interface PickSubmissionInput {
  golferIds: string[]
  picksPerEntry: number
  isLocked: boolean
}

export type PickValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export function validatePickSubmission(input: PickSubmissionInput): PickValidationResult {
  if (input.isLocked) {
    return { ok: false, error: 'This pool is locked. Picks can no longer be changed.' }
  }

  const uniqueIds = new Set(input.golferIds)
  if (uniqueIds.size !== input.golferIds.length) {
    return { ok: false, error: 'Duplicate golfer selections are not allowed.' }
  }

  if (input.golferIds.length !== input.picksPerEntry) {
    return {
      ok: false,
      error: `Please select exactly ${input.picksPerEntry} golfers. You have selected ${input.golferIds.length}.`,
    }
  }

  return { ok: true }
}

export function isPoolLocked(
  status: PoolStatus,
  deadline: string,
  now: Date = new Date()
): boolean {
  if (status !== 'open') return true
  return new Date(deadline) <= now
}

export function calculateRemainingPicks(
  currentCount: number,
  picksPerEntry: number
): number {
  return Math.max(0, picksPerEntry - currentCount)
}
```

- [ ] **Step 2b: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/picks.test.ts`
Expected: All tests PASS

- [ ] **Step 2c: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests still PASS

- [ ] **Step 2d: Commit**

```bash
git add src/lib/picks.ts src/lib/__tests__/picks.test.ts
git commit -m "feat: add pure domain logic for pick validation and lock state"
```

---

## Task 2: Entry Query Helpers

**Files:**
- Create: `src/lib/entry-queries.ts`

### Step 1: Create entry query helpers

- [ ] **Step 1a: Create the entry queries module**

This module isolates all Supabase entry queries so server actions stay thin. Follows the same pattern as `pool-queries.ts`.

```typescript
// src/lib/entry-queries.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Entry } from './supabase/types'

export async function getEntryByPoolAndUser(
  supabase: SupabaseClient,
  poolId: string,
  userId: string
): Promise<Entry | null> {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .single()
  return data as Entry | null
}

export async function upsertEntry(
  supabase: SupabaseClient,
  entry: {
    pool_id: string
    user_id: string
    golfer_ids: string[]
  }
): Promise<{ data: Entry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('entries')
    .upsert(
      {
        pool_id: entry.pool_id,
        user_id: entry.user_id,
        golfer_ids: entry.golfer_ids,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pool_id,user_id' }
    )
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Entry, error: null }
}

export async function getPoolsForMember(
  supabase: SupabaseClient,
  userId: string
): Promise<
  {
    pool_id: string
    role: string
    pool: {
      id: string
      name: string
      tournament_name: string
      status: string
      deadline: string
      picks_per_entry: number
    }
    entry: { golfer_ids: string[] } | null
  }[]
> {
  const { data: memberships } = await supabase
    .from('pool_members')
    .select('pool_id, role, pools(id, name, tournament_name, status, deadline, picks_per_entry)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (!memberships || memberships.length === 0) return []

  const poolIds = memberships.map((m: any) => m.pool_id)

  const { data: entries } = await supabase
    .from('entries')
    .select('pool_id, golfer_ids')
    .eq('user_id', userId)
    .in('pool_id', poolIds)

  const entryMap = new Map<string, { golfer_ids: string[] }>()
  if (entries) {
    for (const e of entries) {
      entryMap.set(e.pool_id, { golfer_ids: e.golfer_ids })
    }
  }

  return memberships.map((m: any) => ({
    pool_id: m.pool_id,
    role: m.role,
    pool: m.pools,
    entry: entryMap.get(m.pool_id) ?? null,
  }))
}
```

- [ ] **Step 1b: Commit**

```bash
git add src/lib/entry-queries.ts
git commit -m "feat: add Supabase query helpers for entries and member pools"
```

---

## Task 3: Fix Sign-In Redirect for Invite Flow

**Files:**
- Modify: `src/app/(auth)/sign-in/actions.ts`
- Modify: `src/app/(auth)/sign-in/page.tsx`

This fixes the broken invite-link flow. Currently, after sign-in the user always goes to `/participant/pools`, losing their invite context.

### Step 1: Update sign-in action to accept redirect param

- [ ] **Step 1a: Rewrite the sign-in action**

Replace the entire contents of `src/app/(auth)/sign-in/actions.ts`:

```typescript
// src/app/(auth)/sign-in/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(
  email: string,
  password: string,
  redirectTo?: string
) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const safeRedirect = isAllowedRedirect(redirectTo)
    ? redirectTo!
    : '/participant/pools'

  redirect(safeRedirect)
}

function isAllowedRedirect(path: string | undefined): boolean {
  if (!path) return false
  // Only allow internal paths starting with /
  // Reject protocol-relative URLs and external URLs
  return path.startsWith('/') && !path.startsWith('//')
}
```

### Step 2: Update sign-in page to read and pass the redirect param

- [ ] **Step 2a: Rewrite the sign-in page**

Replace the entire contents of `src/app/(auth)/sign-in/page.tsx`:

```tsx
// src/app/(auth)/sign-in/page.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from './actions'

export default function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? undefined

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const result = await signIn(email, password, redirectTo)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
        <h1 className="text-2xl font-bold">Sign In</h1>
        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <a href="/sign-up" className="text-blue-600">
            Sign up
          </a>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2b: Commit**

```bash
git add src/app/(auth)/sign-in/actions.ts src/app/(auth)/sign-in/page.tsx
git commit -m "fix: honor redirect query param after sign-in for invite flow"
```

---

## Task 4: Fix My Pools Page to Show All Joined Pools

**Files:**
- Modify: `src/app/(app)/participant/pools/page.tsx`

Currently this page queries the `entries` table, so pools where the user has joined but not yet submitted picks don't appear. It should query `pool_members` instead.

### Step 1: Rewrite My Pools page

- [ ] **Step 1a: Replace the My Pools page**

Replace the entire contents of `src/app/(app)/participant/pools/page.tsx`:

```tsx
// src/app/(app)/participant/pools/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StatusChip } from '@/components/StatusChip'
import { getPoolsForMember } from '@/lib/entry-queries'
import { isPoolLocked, calculateRemainingPicks } from '@/lib/picks'
import type { PoolStatus } from '@/lib/supabase/types'

export default async function ParticipantPools() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const memberPools = await getPoolsForMember(supabase, user!.id)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Pools</h1>
      {memberPools.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">
            You haven&apos;t joined any pools yet.
          </p>
          <p className="text-gray-400 text-sm">
            Ask your commissioner for an invite link.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {memberPools.map(({ pool, entry }) => {
            const locked = isPoolLocked(
              pool.status as PoolStatus,
              pool.deadline
            )
            const picksCount = entry?.golfer_ids?.length ?? 0
            const remaining = calculateRemainingPicks(
              picksCount,
              pool.picks_per_entry
            )
            const hasEntry = picksCount > 0

            return (
              <Link key={pool.id} href={`/participant/picks/${pool.id}`}>
                <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold">{pool.name}</h3>
                    <StatusChip status={pool.status as PoolStatus} />
                  </div>
                  <p className="text-gray-500 text-sm">
                    {pool.tournament_name}
                  </p>
                  <div className="mt-2 text-xs">
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span aria-hidden="true">&#x1F512;</span>
                        Locked
                      </span>
                    ) : hasEntry ? (
                      remaining === 0 ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <span aria-hidden="true">&#x2713;</span>
                          Entry submitted
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          {remaining} pick{remaining !== 1 ? 's' : ''} remaining
                        </span>
                      )
                    ) : (
                      <span className="text-amber-700">
                        Picks needed ({pool.picks_per_entry} golfers)
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 1b: Commit**

```bash
git add src/app/(app)/participant/pools/page.tsx
git commit -m "fix: show all joined pools in My Pools, not just those with entries"
```

---

## Task 5: Shared UI Components (PickProgress, LockBanner, SubmissionConfirmation)

**Files:**
- Create: `src/components/PickProgress.tsx`
- Create: `src/components/LockBanner.tsx`
- Create: `src/components/SubmissionConfirmation.tsx`

### Step 1: Create PickProgress component

- [ ] **Step 1a: Create the PickProgress component**

```tsx
// src/components/PickProgress.tsx
interface PickProgressProps {
  current: number
  required: number
}

export function PickProgress({ current, required }: PickProgressProps) {
  const remaining = Math.max(0, required - current)
  const isComplete = remaining === 0
  const percentage = required > 0 ? Math.min(100, (current / required) * 100) : 0

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isComplete ? (
            <span className="text-green-700">
              <span aria-hidden="true">&#x2713; </span>
              All {required} golfers selected — ready to submit
            </span>
          ) : (
            <span>
              {current} of {required} golfers selected
            </span>
          )}
        </span>
        {!isComplete && (
          <span className="text-amber-700 font-medium">
            {remaining} remaining
          </span>
        )}
      </div>
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-label={`${current} of ${required} golfers selected`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

### Step 2: Create LockBanner component

- [ ] **Step 2a: Create the LockBanner component**

```tsx
// src/components/LockBanner.tsx
interface LockBannerProps {
  isLocked: boolean
  deadline: string
  poolStatus: string
}

export function LockBanner({ isLocked, deadline, poolStatus }: LockBannerProps) {
  if (isLocked) {
    return (
      <div
        className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2"
        role="status"
      >
        <span aria-hidden="true" className="text-lg">&#x1F512;</span>
        <div>
          <p className="font-medium text-gray-800">Picks are locked</p>
          <p className="text-sm text-gray-600">
            {poolStatus === 'live'
              ? 'The tournament is live. No changes allowed.'
              : poolStatus === 'complete'
                ? 'This tournament is complete.'
                : 'The picks deadline has passed.'}
          </p>
        </div>
      </div>
    )
  }

  const deadlineDate = new Date(deadline)
  const formattedDeadline = deadlineDate.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  return (
    <div
      className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
      role="status"
    >
      <span aria-hidden="true" className="text-lg">&#x1F513;</span>
      <div>
        <p className="font-medium text-green-800">Picks are open</p>
        <p className="text-sm text-green-700">
          Deadline: {formattedDeadline}
        </p>
      </div>
    </div>
  )
}
```

### Step 3: Create SubmissionConfirmation component

- [ ] **Step 3a: Create the SubmissionConfirmation component**

```tsx
// src/components/SubmissionConfirmation.tsx
interface SubmissionConfirmationProps {
  golferNames: Record<string, string>
  golferIds: string[]
  isLocked: boolean
  poolName: string
}

export function SubmissionConfirmation({
  golferNames,
  golferIds,
  isLocked,
  poolName,
}: SubmissionConfirmationProps) {
  return (
    <div className="space-y-4">
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
          {isLocked
            ? 'Your picks are locked and cannot be changed.'
            : 'You can edit your picks until the deadline.'}
        </p>
      </div>

      <div>
        <h3 className="font-medium mb-2">Your picks</h3>
        <ul className="space-y-1" aria-label="Selected golfers">
          {golferIds.map((id, index) => (
            <li
              key={id}
              className="p-2 bg-gray-50 rounded flex items-center gap-2"
            >
              <span className="text-xs text-gray-400 w-5 text-right">
                {index + 1}.
              </span>
              <span>{golferNames[id] || id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 3b: Commit**

```bash
git add src/components/PickProgress.tsx src/components/LockBanner.tsx src/components/SubmissionConfirmation.tsx
git commit -m "feat: add PickProgress, LockBanner, and SubmissionConfirmation components"
```

---

## Task 6: Improve GolferPicker Accessibility and UX

**Files:**
- Modify: `src/components/golfer-picker.tsx`

The current GolferPicker uses `div` with `onClick` which is not keyboard-accessible. The list is hidden by default. There is no visual completion state. This task fixes all of that.

### Step 1: Rewrite GolferPicker

- [ ] **Step 1a: Replace the golfer picker component**

Replace the entire contents of `src/components/golfer-picker.tsx`:

```tsx
// src/components/golfer-picker.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PickProgress } from './PickProgress'

interface Golfer {
  id: string
  name: string
  country: string
}

interface GolferPickerProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  maxSelections: number
}

export function GolferPicker({
  selectedIds,
  onSelectionChange,
  maxSelections,
}: GolferPickerProps) {
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('golfers')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setGolfers(data)
        setLoading(false)
      })
  }, [])

  const filteredGolfers = golfers.filter((g) => {
    const matchesSearch = g.name
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesCountry =
      countryFilter === '' || g.country === countryFilter
    return matchesSearch && matchesCountry
  })

  const countries = Array.from(new Set(golfers.map((g) => g.country))).sort()

  const toggleGolfer = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((i) => i !== id))
      } else if (selectedIds.length < maxSelections) {
        onSelectionChange([...selectedIds, id])
      }
    },
    [selectedIds, maxSelections, onSelectionChange]
  )

  const selectedGolferNames = golfers.filter((g) =>
    selectedIds.includes(g.id)
  )

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading golfers...</p>
  }

  return (
    <div className="space-y-4">
      <PickProgress current={selectedIds.length} required={maxSelections} />

      {selectedGolferNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGolferNames.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => toggleGolfer(g.id)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Remove ${g.name}`}
            >
              {g.name}
              <span aria-hidden="true">&times;</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2 border rounded text-sm"
          aria-label="Search golfers by name"
        />
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="p-2 border rounded text-sm"
          aria-label="Filter by country"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div
        className="max-h-72 overflow-y-auto border rounded divide-y"
        role="listbox"
        aria-label="Available golfers"
        aria-multiselectable="true"
      >
        {filteredGolfers.length === 0 ? (
          <p className="p-3 text-gray-500 text-sm text-center">
            No golfers match your search.
          </p>
        ) : (
          filteredGolfers.map((golfer) => {
            const isSelected = selectedIds.includes(golfer.id)
            const isDisabled =
              !isSelected && selectedIds.length >= maxSelections

            return (
              <button
                key={golfer.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => toggleGolfer(golfer.id)}
                className={`w-full text-left p-3 flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  isSelected
                    ? 'bg-blue-50 font-medium'
                    : isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div>
                  <span className="text-sm">{golfer.name}</span>
                  <span className="text-gray-400 text-xs ml-2">
                    {golfer.country}
                  </span>
                </div>
                {isSelected && (
                  <span
                    className="text-blue-600 text-sm font-bold"
                    aria-hidden="true"
                  >
                    &#x2713;
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 1b: Commit**

```bash
git add src/components/golfer-picker.tsx
git commit -m "feat: improve GolferPicker with accessibility, pick progress, and visible list"
```

---

## Task 7: Rewrite submitPicks Server Action

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/actions.ts`

The current action hardcodes `4` picks, doesn't check membership or lock state, and throws errors instead of returning state. This rewrite adds all required validations.

### Step 1: Write failing tests for the action's domain logic

The server action itself can't be unit-tested (it depends on Supabase), but its domain validation is tested via `picks.test.ts` (Task 1). The action must wire those pure functions correctly.

### Step 2: Rewrite the server action

- [ ] **Step 2a: Replace the action file**

Replace the entire contents of `src/app/(app)/participant/picks/[poolId]/actions.ts`:

```typescript
// src/app/(app)/participant/picks/[poolId]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPoolById, isPoolMember, insertAuditEvent } from '@/lib/pool-queries'
import { upsertEntry, getEntryByPoolAndUser } from '@/lib/entry-queries'
import { validatePickSubmission, isPoolLocked } from '@/lib/picks'

export type SubmitPicksState = {
  error?: string
  success?: boolean
} | null

export async function submitPicks(
  _prevState: SubmitPicksState,
  formData: FormData
): Promise<SubmitPicksState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const poolId = formData.get('poolId') as string
  if (!poolId) {
    return { error: 'Pool ID is required.' }
  }

  const rawGolferIds = formData.get('golferIds') as string
  let golferIds: string[]
  try {
    golferIds = JSON.parse(rawGolferIds)
    if (!Array.isArray(golferIds)) throw new Error()
  } catch {
    return { error: 'Invalid golfer selection data.' }
  }

  // Fetch pool
  const pool = await getPoolById(supabase, poolId)
  if (!pool) {
    return { error: 'Pool not found.' }
  }

  // Check membership
  const isMember = await isPoolMember(supabase, poolId, user.id)
  if (!isMember) {
    return { error: 'You are not a member of this pool.' }
  }

  // Check lock state
  const locked = isPoolLocked(pool.status, pool.deadline)

  // Validate picks using domain logic
  const validation = validatePickSubmission({
    golferIds,
    picksPerEntry: pool.picks_per_entry,
    isLocked: locked,
  })

  if (!validation.ok) {
    return { error: validation.error }
  }

  // Check if this is a new entry or an update
  const existingEntry = await getEntryByPoolAndUser(supabase, poolId, user.id)
  const isUpdate = existingEntry !== null

  // Upsert entry
  const { error: upsertError } = await upsertEntry(supabase, {
    pool_id: poolId,
    user_id: user.id,
    golfer_ids: golferIds,
  })

  if (upsertError) {
    return { error: 'Failed to save picks. Please try again.' }
  }

  // Audit log
  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: isUpdate ? 'picksUpdated' : 'picksSubmitted',
    details: {
      golfer_ids: golferIds,
      picks_per_entry: pool.picks_per_entry,
    },
  })

  return { success: true }
}
```

- [ ] **Step 2b: Commit**

```bash
git add src/app/(app)/participant/picks/[poolId]/actions.ts
git commit -m "feat: rewrite submitPicks with validation, lock check, membership gate, and audit"
```

---

## Task 8: Rewrite Picks Page (Full Player Entry Flow)

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`

This is the core page that ties everything together: membership gate, lock banner, golfer picker with progress, submission confirmation, and edit-before-lock.

### Step 1: Rewrite the picks page

- [ ] **Step 1a: Replace the picks page**

Replace the entire contents of `src/app/(app)/participant/picks/[poolId]/page.tsx`:

```tsx
// src/app/(app)/participant/picks/[poolId]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, isPoolMember } from '@/lib/pool-queries'
import { getEntryByPoolAndUser } from '@/lib/entry-queries'
import { isPoolLocked } from '@/lib/picks'
import { LockBanner } from '@/components/LockBanner'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { PicksForm } from './PicksForm'

export default async function PicksPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/participant/pools')

  // Membership gate
  const isMember = await isPoolMember(supabase, poolId, user.id)
  if (!isMember) redirect('/participant/pools')

  const locked = isPoolLocked(pool.status, pool.deadline)
  const entry = await getEntryByPoolAndUser(supabase, poolId, user.id)
  const hasEntry = entry !== null && entry.golfer_ids.length > 0

  // Fetch golfer names for existing picks display
  let golferNames: Record<string, string> = {}
  if (hasEntry) {
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, name')
      .in('id', entry.golfer_ids)

    if (golfers) {
      golferNames = Object.fromEntries(golfers.map((g) => [g.id, g.name]))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{pool.name}</h1>
      <p className="text-gray-500 mb-4">{pool.tournament_name}</p>

      <LockBanner
        isLocked={locked}
        deadline={pool.deadline}
        poolStatus={pool.status}
      />

      {locked && hasEntry ? (
        <SubmissionConfirmation
          golferNames={golferNames}
          golferIds={entry.golfer_ids}
          isLocked={true}
          poolName={pool.name}
        />
      ) : locked && !hasEntry ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg" role="status">
          <p className="text-gray-600">
            You did not submit picks before the deadline.
          </p>
        </div>
      ) : (
        <PicksForm
          poolId={pool.id}
          poolName={pool.name}
          picksPerEntry={pool.picks_per_entry}
          existingGolferIds={entry?.golfer_ids ?? []}
          existingGolferNames={golferNames}
          isLocked={locked}
        />
      )}
    </div>
  )
}
```

### Step 2: Create the PicksForm client component

- [ ] **Step 2a: Create the PicksForm component**

Create the file `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`:

```tsx
// src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { submitPicks, type SubmitPicksState } from './actions'
import { GolferPicker } from '@/components/golfer-picker'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'

interface PicksFormProps {
  poolId: string
  poolName: string
  picksPerEntry: number
  existingGolferIds: string[]
  existingGolferNames: Record<string, string>
  isLocked: boolean
}

export function PicksForm({
  poolId,
  poolName,
  picksPerEntry,
  existingGolferIds,
  existingGolferNames,
  isLocked,
}: PicksFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(existingGolferIds)
  const [state, formAction] = useFormState<SubmitPicksState, FormData>(
    submitPicks,
    null
  )

  // After successful submission, show confirmation
  if (state?.success) {
    return (
      <div className="space-y-4">
        <SubmissionConfirmation
          golferNames={existingGolferNames}
          golferIds={selectedIds}
          isLocked={isLocked}
          poolName={poolName}
        />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Edit picks
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="poolId" value={poolId} />
      <input
        type="hidden"
        name="golferIds"
        value={JSON.stringify(selectedIds)}
      />

      {state?.error && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">
          {existingGolferIds.length > 0
            ? 'Edit Your Picks'
            : 'Select Your Golfers'}
        </h2>

        <GolferPicker
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxSelections={picksPerEntry}
        />

        <div className="mt-6">
          <SubmitButton
            disabled={selectedIds.length !== picksPerEntry}
            isUpdate={existingGolferIds.length > 0}
          />
        </div>
      </div>
    </form>
  )
}

function SubmitButton({
  disabled,
  isUpdate,
}: {
  disabled: boolean
  isUpdate: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending
        ? 'Saving...'
        : isUpdate
          ? 'Update Picks'
          : 'Submit Picks'}
    </button>
  )
}
```

- [ ] **Step 2b: Commit**

```bash
git add src/app/(app)/participant/picks/[poolId]/page.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
git commit -m "feat: rewrite picks page with membership gate, lock banner, pick form, and confirmation"
```

---

## Task 9: Run Full Verification

### Step 1: Run all tests

- [ ] **Step 1a: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS (existing pool, scoring, cron tests + new picks tests)

### Step 2: Run TypeScript type check

- [ ] **Step 2a: Run tsc**

Run: `npx tsc --noEmit`
Expected: No type errors

### Step 3: Run the build

- [ ] **Step 3a: Run next build**

Run: `npm run build`
Expected: Build succeeds with no errors

### Step 4: Fix any issues found

- [ ] **Step 4a: If any test, type, or build errors were found, fix them and re-run**

### Step 5: Final commit if fixes were needed

- [ ] **Step 5a: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build/type/test issues from Epic 2 implementation"
```

---

## FR Coverage Verification

| FR | Story | Task(s) | Implementation |
|---|---|---|---|
| FR9: Join pool from invite link | 2.1 | Existing (Task 3 fixes sign-in redirect) | `src/app/join/[inviteCode]/` already works. Task 3 fixes the post-sign-in redirect so the flow completes. |
| FR10: Access pool on mobile web | 2.2 | Task 3, Task 6, Task 8 | Sign-in redirect preserved. GolferPicker is touch-friendly. Picks page is max-w-2xl responsive. |
| FR11: Submit required golfer picks | 2.3 | Task 1, Task 2, Task 7, Task 8 | Domain validation uses `pool.picks_per_entry`. Server action validates count, membership, lock. Form disables submit until count matches. |
| FR12: Track remaining picks | 2.4 | Task 1, Task 5, Task 6 | `calculateRemainingPicks` in domain logic. `PickProgress` component shows progress bar, count, and completion state with `aria-live="polite"`. |
| FR13: Edit picks before lock | 2.5 | Task 1, Task 7, Task 8 | `isPoolLocked` check in domain logic and server action. Page shows `PicksForm` when unlocked with existing picks pre-loaded. Submit button says "Update Picks". |
| FR14: Submission confirmation | 2.6 | Task 5, Task 8 | `SubmissionConfirmation` component with checkmark, pick list, and lock-state message. Shown after successful submit and on return visits. |
| FR15: View current picks | 2.6 | Task 4, Task 8 | My Pools page shows pick status. Picks page shows `SubmissionConfirmation` with golfer names when entry exists. |
| FR16: See locked vs editable state | 2.5, 2.6 | Task 1, Task 5, Task 8 | `LockBanner` component shows lock/unlock with icon+text (not color alone). `SubmissionConfirmation` states whether locked or editable. My Pools page shows lock icon. |

## UX-DR Coverage

| UX-DR | How Addressed |
|---|---|
| UX-DR3: Remaining-pick progress | `PickProgress` with progress bar, count, `aria-live`, completion state with checkmark |
| UX-DR4: Unmistakable confirmation | `SubmissionConfirmation` with green border, checkmark icon, pick list, lock-state text |
| UX-DR5: Invite-link landing | Join page already works; Task 3 fixes redirect so sign-in doesn't lose context |
| UX-DR8: Not color alone | `LockBanner` uses lock/unlock icon + text. `PickProgress` uses checkmark + text. `StatusChip` already uses icons. |
| UX-DR9: Touch targets, focus states | GolferPicker uses `button` elements with `focus:ring-2`. Submit button is full-width on mobile. Min 44px touch targets via `p-3` on golfer rows. |
| UX-DR10: Small-screen readability | Max-w-2xl layout. `sm:` breakpoints on padding. Stacked layout on mobile. |
