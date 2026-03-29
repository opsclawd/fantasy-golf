# Epic 1: Launch and Manage a Private Pool - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commissioners can create a pool, choose a tournament, configure format, share an invite link, review participation status, perform admin actions, and reuse pools for future tournaments.

**Architecture:** Next.js 14 App Router with Supabase Postgres as single source of truth. Server actions handle mutations; pure TypeScript domain logic in `src/lib/` owns validation and pool rules. Supabase Auth with SSR cookies controls access. Commissioner UI lives under `src/app/(app)/commissioner/`, with shared components in `src/components/`.

**Tech Stack:** Next.js 14.2.0, React 18, TypeScript 5 (strict), Supabase (@supabase/supabase-js ^2.39.0, @supabase/ssr ^0.9.0), Tailwind CSS 3.4, Vitest for testing.

---

## Existing Codebase Context

The project is brownfield. Key existing files relevant to Epic 1:

| File | What it does today |
|---|---|
| `src/lib/db/schema.sql` | Defines `pools`, `entries`, `golfers`, `tournament_scores` tables. `pools` has `id`, `name`, `tournament_id`, `tournament_name`, `deadline`, `status`, `created_at`. No `commissioner_id`, `invite_code`, `format`, `picks_per_entry`, or `year` column in SQL (though `year` is used in TS types). |
| `src/lib/supabase/types.ts` | TypeScript interfaces for `Pool` (includes `year: number`), `Entry`, `Golfer`, `TournamentScore`. |
| `src/app/(app)/commissioner/page.tsx` | Client component: create pool form with tournament dropdown fetched from API. Calls `createPool` server action. |
| `src/app/(app)/commissioner/actions.ts` | Server action `createPool`: inserts into `pools` table. No validation beyond auth check. No `commissioner_id`. |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Server component: shows pool detail, entries table, status badge, Start/Close buttons. |
| `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | Server actions `startPool` (open->live) and `closePool` (live->complete). No commissioner ownership check. |
| `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` | Client components for Start/Close pool buttons using `useFormState`. |
| `src/lib/scoring.ts` | Pure scoring functions: `getHoleScore`, `getEntryHoleScore`, `calculateEntryTotalScore`, `calculateEntryBirdies`, `rankEntries`. |
| `src/lib/__tests__/scoring.test.ts` | Tests for scoring functions. Uses test helpers. |

**Critical gaps the plan must fill:**
1. No `commissioner_id` on pools - anyone can manage any pool
2. No `invite_code` for sharing join links
3. No pool format configuration (picks per entry, scoring type)
4. No validation domain logic - validation lives inline in actions
5. No test runner configured (no jest/vitest in package.json)
6. Pool list on commissioner page is missing - only shows create form
7. No pool membership table - players join by creating entries directly
8. No reuse/clone pool mechanism
9. No audit logging infrastructure

## File Structure

### Files to Create

| File | Responsibility |
|---|---|
| `src/lib/pool.ts` | Pure domain logic: pool validation, invite code generation, format defaults, pool status rules, clone logic |
| `src/lib/__tests__/pool.test.ts` | Tests for all pool domain logic |
| `src/lib/pool-queries.ts` | Supabase query helpers for pools: create, update, get, list by commissioner, get by invite code |
| `src/components/StatusChip.tsx` | Reusable status badge with text + icon (no color-only signaling) |
| `src/components/CopyLinkButton.tsx` | Copy-to-clipboard button with confirmation feedback |
| `src/components/PoolCard.tsx` | Pool summary card used in commissioner pool list |
| `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx` | Client component showing invite URL with copy button |
| `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx` | Client component showing pool config, participation, lock state |
| `src/app/(app)/commissioner/pools/[poolId]/ReusePoo1Button.tsx` | Client component for "Reuse for Next Tournament" action |
| `vitest.config.ts` | Vitest configuration |
| `src/app/join/[inviteCode]/page.tsx` | Join-link landing page: validates invite code, shows pool info, directs to auth/entry |
| `src/app/join/[inviteCode]/actions.ts` | Server action: join pool from invite code |

### Files to Modify

| File | Changes |
|---|---|
| `package.json` | Add vitest, @testing-library deps |
| `src/lib/db/schema.sql` | Add `commissioner_id`, `invite_code`, `format`, `picks_per_entry` to `pools`; add `pool_members` table; add `audit_events` table |
| `src/lib/supabase/types.ts` | Update `Pool` interface; add `PoolMember`, `AuditEvent` types |
| `src/app/(app)/commissioner/page.tsx` | Add pool list, format config, validation feedback, redirect to pool detail on create |
| `src/app/(app)/commissioner/actions.ts` | Use domain validation, set `commissioner_id`, generate `invite_code`, record audit event |
| `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Add commissioner ownership check, participation section, invite link, lock state display, reuse button |
| `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | Add commissioner ownership checks to start/close; add audit logging; add reuse action |
| `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` | Improve status feedback, add confirmation states |

---

## Task 1: Set Up Test Runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest and testing dependencies**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```
Expected: packages install successfully.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify existing scoring tests pass**

Run: `npm test -- src/lib/__tests__/scoring.test.ts`
Expected: All existing scoring tests pass (3 test suites).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner and verify existing tests pass"
```

---

## Task 2: Extend Database Schema for Pool Management

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Update schema.sql with new columns and tables**

Replace the contents of `src/lib/db/schema.sql` with:

```sql
-- Pools table
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commissioner_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  format TEXT DEFAULT 'best_ball' CHECK (format IN ('best_ball')),
  picks_per_entry INTEGER DEFAULT 4 CHECK (picks_per_entry >= 1 AND picks_per_entry <= 10),
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'complete')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pool members table (tracks who has joined a pool)
CREATE TABLE pool_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'player' CHECK (role IN ('commissioner', 'player')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_ids TEXT[] NOT NULL DEFAULT '{}',
  total_birdies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Golfers table
CREATE TABLE golfers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

-- Tournament scores table
CREATE TABLE tournament_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT REFERENCES golfers(id),
  tournament_id TEXT NOT NULL,
  hole_1 INTEGER,
  hole_2 INTEGER,
  hole_3 INTEGER,
  hole_4 INTEGER,
  hole_5 INTEGER,
  hole_6 INTEGER,
  hole_7 INTEGER,
  hole_8 INTEGER,
  hole_9 INTEGER,
  hole_10 INTEGER,
  hole_11 INTEGER,
  hole_12 INTEGER,
  hole_13 INTEGER,
  hole_14 INTEGER,
  hole_15 INTEGER,
  hole_16 INTEGER,
  hole_17 INTEGER,
  hole_18 INTEGER,
  total_birdies INTEGER DEFAULT 0,
  UNIQUE(golfer_id, tournament_id)
);

-- Audit events table
CREATE TABLE audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pools_commissioner_id ON pools(commissioner_id);
CREATE INDEX idx_pools_invite_code ON pools(invite_code);
CREATE INDEX idx_pool_members_pool_id ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user_id ON pool_members(user_id);
CREATE INDEX idx_entries_pool_id ON entries(pool_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_tournament_scores_tournament ON tournament_scores(tournament_id);
CREATE INDEX idx_audit_events_pool_id ON audit_events(pool_id);
```

- [ ] **Step 2: Update TypeScript types**

Replace the contents of `src/lib/supabase/types.ts` with:

```typescript
export type PoolStatus = 'open' | 'live' | 'complete'

export type PoolFormat = 'best_ball'

export type MemberRole = 'commissioner' | 'player'

export interface Pool {
  id: string
  commissioner_id: string
  name: string
  tournament_id: string
  tournament_name: string
  year: number
  deadline: string
  format: PoolFormat
  picks_per_entry: number
  invite_code: string
  status: PoolStatus
  created_at: string
}

export interface PoolMember {
  id: string
  pool_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

export interface Entry {
  id: string
  pool_id: string
  user_id: string
  golfer_ids: string[]
  total_birdies: number
  created_at: string
  updated_at: string
}

export interface Golfer {
  id: string
  name: string
  country: string
}

export interface TournamentScore {
  golfer_id: string
  tournament_id: string
  hole_1: number | null
  hole_2: number | null
  hole_3: number | null
  hole_4: number | null
  hole_5: number | null
  hole_6: number | null
  hole_7: number | null
  hole_8: number | null
  hole_9: number | null
  hole_10: number | null
  hole_11: number | null
  hole_12: number | null
  hole_13: number | null
  hole_14: number | null
  hole_15: number | null
  hole_16: number | null
  hole_17: number | null
  hole_18: number | null
  total_birdies: number
}

export interface AuditEvent {
  id: string
  pool_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}
```

- [ ] **Step 3: Verify the project still compiles**

Run: `npx tsc --noEmit`
Expected: Type errors may appear in files that reference the old `Pool` shape. Note them — they will be fixed in subsequent tasks. The types file itself should be valid.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.sql src/lib/supabase/types.ts
git commit -m "feat: extend schema with commissioner_id, invite_code, format, pool_members, and audit_events"
```

---

## Task 3: Pool Domain Logic

**Files:**
- Create: `src/lib/pool.ts`
- Create: `src/lib/__tests__/pool.test.ts`

- [ ] **Step 1: Write failing tests for pool validation and invite code generation**

Create `src/lib/__tests__/pool.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateInviteCode,
  validateCreatePoolInput,
  validatePoolFormat,
  canTransitionStatus,
  buildClonePoolInput,
} from '../pool'
import type { Pool } from '../supabase/types'

describe('generateInviteCode', () => {
  it('returns a string of 8 alphanumeric characters', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[a-z0-9]{8}$/)
  })

  it('generates unique codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()))
    expect(codes.size).toBe(100)
  })
})

describe('validateCreatePoolInput', () => {
  it('returns ok for valid input', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool 2026',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects empty pool name', () => {
    const result = validateCreatePoolInput({
      name: '',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
    })
    expect(result).toEqual({ ok: false, error: 'Pool name is required.' })
  })

  it('rejects pool name over 100 characters', () => {
    const result = validateCreatePoolInput({
      name: 'x'.repeat(101),
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
    })
    expect(result).toEqual({ ok: false, error: 'Pool name must be 100 characters or fewer.' })
  })

  it('rejects missing tournament', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: '',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2026-04-10T08:00:00Z',
    })
    expect(result).toEqual({ ok: false, error: 'Tournament selection is required.' })
  })

  it('rejects missing deadline', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '',
    })
    expect(result).toEqual({ ok: false, error: 'Picks deadline is required.' })
  })

  it('rejects deadline in the past', () => {
    const result = validateCreatePoolInput({
      name: 'Masters Pool',
      tournamentId: 't1',
      tournamentName: 'The Masters',
      year: 2026,
      deadline: '2020-01-01T00:00:00Z',
    })
    expect(result).toEqual({ ok: false, error: 'Picks deadline must be in the future.' })
  })
})

describe('validatePoolFormat', () => {
  it('accepts best_ball format', () => {
    const result = validatePoolFormat('best_ball', 4)
    expect(result).toEqual({ ok: true })
  })

  it('rejects unknown format', () => {
    const result = validatePoolFormat('unknown' as any, 4)
    expect(result).toEqual({ ok: false, error: 'Invalid pool format.' })
  })

  it('rejects picks_per_entry below 1', () => {
    const result = validatePoolFormat('best_ball', 0)
    expect(result).toEqual({ ok: false, error: 'Picks per entry must be between 1 and 10.' })
  })

  it('rejects picks_per_entry above 10', () => {
    const result = validatePoolFormat('best_ball', 11)
    expect(result).toEqual({ ok: false, error: 'Picks per entry must be between 1 and 10.' })
  })
})

describe('canTransitionStatus', () => {
  it('allows open -> live', () => {
    expect(canTransitionStatus('open', 'live')).toBe(true)
  })

  it('allows live -> complete', () => {
    expect(canTransitionStatus('live', 'complete')).toBe(true)
  })

  it('blocks open -> complete', () => {
    expect(canTransitionStatus('open', 'complete')).toBe(false)
  })

  it('blocks live -> open', () => {
    expect(canTransitionStatus('live', 'open')).toBe(false)
  })

  it('blocks complete -> anything', () => {
    expect(canTransitionStatus('complete', 'open')).toBe(false)
    expect(canTransitionStatus('complete', 'live')).toBe(false)
  })
})

describe('buildClonePoolInput', () => {
  it('copies name, format, and picks_per_entry from source pool', () => {
    const source: Pool = {
      id: 'old-id',
      commissioner_id: 'user-1',
      name: 'Masters Pool 2025',
      tournament_id: 'old-tournament',
      tournament_name: 'Old Tournament',
      year: 2025,
      deadline: '2025-04-10T08:00:00Z',
      format: 'best_ball',
      picks_per_entry: 4,
      invite_code: 'oldcode1',
      status: 'complete',
      created_at: '2025-01-01T00:00:00Z',
    }

    const result = buildClonePoolInput(source)

    expect(result.name).toBe('Masters Pool 2025')
    expect(result.format).toBe('best_ball')
    expect(result.picks_per_entry).toBe(4)
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('tournament_id')
    expect(result).not.toHaveProperty('invite_code')
    expect(result).not.toHaveProperty('status')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: FAIL — module `../pool` not found.

- [ ] **Step 3: Implement pool domain logic**

Create `src/lib/pool.ts`:

```typescript
import type { PoolStatus, PoolFormat, Pool } from './supabase/types'

export interface CreatePoolInput {
  name: string
  tournamentId: string
  tournamentName: string
  year: number
  deadline: string
}

export interface ClonePoolInput {
  name: string
  format: PoolFormat
  picks_per_entry: number
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string }

const VALID_FORMATS: PoolFormat[] = ['best_ball']

const STATUS_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  open: ['live'],
  live: ['complete'],
  complete: [],
}

export function generateInviteCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  for (const byte of array) {
    code += chars[byte % chars.length]
  }
  return code
}

export function validateCreatePoolInput(input: CreatePoolInput): ValidationResult {
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    return { ok: false, error: 'Pool name is required.' }
  }
  if (trimmedName.length > 100) {
    return { ok: false, error: 'Pool name must be 100 characters or fewer.' }
  }
  if (!input.tournamentId.trim()) {
    return { ok: false, error: 'Tournament selection is required.' }
  }
  if (!input.deadline.trim()) {
    return { ok: false, error: 'Picks deadline is required.' }
  }
  if (new Date(input.deadline) <= new Date()) {
    return { ok: false, error: 'Picks deadline must be in the future.' }
  }
  return { ok: true }
}

export function validatePoolFormat(
  format: PoolFormat,
  picksPerEntry: number
): ValidationResult {
  if (!VALID_FORMATS.includes(format)) {
    return { ok: false, error: 'Invalid pool format.' }
  }
  if (picksPerEntry < 1 || picksPerEntry > 10) {
    return { ok: false, error: 'Picks per entry must be between 1 and 10.' }
  }
  return { ok: true }
}

export function canTransitionStatus(
  current: PoolStatus,
  target: PoolStatus
): boolean {
  return STATUS_TRANSITIONS[current].includes(target)
}

export function buildClonePoolInput(source: Pool): ClonePoolInput {
  return {
    name: source.name,
    format: source.format,
    picks_per_entry: source.picks_per_entry,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pool.ts src/lib/__tests__/pool.test.ts
git commit -m "feat: add pool domain logic with validation, invite codes, status transitions, and clone support"
```

---

## Task 4: Pool Query Helpers (Supabase Data Layer)

**Files:**
- Create: `src/lib/pool-queries.ts`

- [ ] **Step 1: Create pool query helpers**

Create `src/lib/pool-queries.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pool, PoolMember, AuditEvent } from './supabase/types'

export async function insertPool(
  supabase: SupabaseClient,
  pool: Omit<Pool, 'id' | 'created_at'>
): Promise<{ data: Pool | null; error: string | null }> {
  const { data, error } = await supabase
    .from('pools')
    .insert(pool)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Pool, error: null }
}

export async function insertPoolMember(
  supabase: SupabaseClient,
  member: Omit<PoolMember, 'id' | 'joined_at'>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pool_members').insert(member)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getPoolById(
  supabase: SupabaseClient,
  poolId: string
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()
  return data as Pool | null
}

export async function getPoolByInviteCode(
  supabase: SupabaseClient,
  inviteCode: string
): Promise<Pool | null> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  return data as Pool | null
}

export async function getPoolsByCommissioner(
  supabase: SupabaseClient,
  commissionerId: string
): Promise<Pool[]> {
  const { data } = await supabase
    .from('pools')
    .select('*')
    .eq('commissioner_id', commissionerId)
    .order('created_at', { ascending: false })
  return (data as Pool[]) || []
}

export async function getPoolMembers(
  supabase: SupabaseClient,
  poolId: string
): Promise<PoolMember[]> {
  const { data } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', poolId)
    .order('joined_at', { ascending: true })
  return (data as PoolMember[]) || []
}

export async function isPoolMember(
  supabase: SupabaseClient,
  poolId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .single()
  return data !== null
}

export async function updatePoolStatus(
  supabase: SupabaseClient,
  poolId: string,
  status: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update({ status })
    .eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function updatePoolConfig(
  supabase: SupabaseClient,
  poolId: string,
  updates: {
    tournament_id?: string
    tournament_name?: string
    year?: number
    deadline?: string
    format?: string
    picks_per_entry?: number
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function insertAuditEvent(
  supabase: SupabaseClient,
  event: Omit<AuditEvent, 'id' | 'created_at'>
): Promise<void> {
  await supabase.from('audit_events').insert(event)
}

export async function getEntriesForPool(
  supabase: SupabaseClient,
  poolId: string
) {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)
  return data || []
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -- src/lib/pool-queries.ts` (or run full build check)
Expected: No type errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pool-queries.ts
git commit -m "feat: add pool query helpers for Supabase data access"
```

---

## Task 5: Shared UI Components (StatusChip, CopyLinkButton, PoolCard)

**Files:**
- Create: `src/components/StatusChip.tsx`
- Create: `src/components/CopyLinkButton.tsx`
- Create: `src/components/PoolCard.tsx`

- [ ] **Step 1: Create StatusChip component**

Create `src/components/StatusChip.tsx`:

```tsx
import type { PoolStatus } from '@/lib/supabase/types'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB', // circle outline
    classes: 'bg-green-100 text-green-800',
  },
  live: {
    label: 'Live',
    icon: '\u25CF', // filled circle
    classes: 'bg-blue-100 text-blue-800',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713', // checkmark
    classes: 'bg-gray-100 text-gray-800',
  },
}

export function StatusChip({ status }: { status: PoolStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
      role="status"
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: Create CopyLinkButton component**

Create `src/components/CopyLinkButton.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface CopyLinkButtonProps {
  url: string
  label?: string
}

export function CopyLinkButton({ url, label = 'Copy Link' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text for manual copy
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
      aria-live="polite"
    >
      {copied ? (
        <>
          <span aria-hidden="true">{'\u2713'}</span>
          Copied!
        </>
      ) : (
        <>
          <span aria-hidden="true">{'\u2398'}</span>
          {label}
        </>
      )}
    </button>
  )
}
```

- [ ] **Step 3: Create PoolCard component**

Create `src/components/PoolCard.tsx`:

```tsx
import Link from 'next/link'
import { StatusChip } from './StatusChip'
import type { Pool } from '@/lib/supabase/types'

interface PoolCardProps {
  pool: Pool
  href: string
  entryCount?: number
}

export function PoolCard({ pool, href, entryCount }: PoolCardProps) {
  return (
    <Link href={href}>
      <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{pool.name}</h3>
          <StatusChip status={pool.status} />
        </div>
        <p className="text-gray-500 text-sm">{pool.tournament_name}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>Deadline: {new Date(pool.deadline).toLocaleDateString()}</span>
          {entryCount !== undefined && <span>{entryCount} entries</span>}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Verify the components compile**

Run: `npx tsc --noEmit`
Expected: No errors in the new component files.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusChip.tsx src/components/CopyLinkButton.tsx src/components/PoolCard.tsx
git commit -m "feat: add StatusChip, CopyLinkButton, and PoolCard shared UI components"
```

---

## Task 6: Story 1.1 - Create a Private Pool (Server Action + UI)

**Files:**
- Modify: `src/app/(app)/commissioner/actions.ts`
- Modify: `src/app/(app)/commissioner/page.tsx`

- [ ] **Step 1: Write failing test for createPool server action validation integration**

This story's logic is already covered by the pool.test.ts domain tests. The server action test is an integration concern. We verify the domain layer is wired correctly by running the existing pool tests.

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: All tests pass.

- [ ] **Step 2: Rewrite the createPool server action with validation and ownership**

Replace `src/app/(app)/commissioner/actions.ts` with:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  validateCreatePoolInput,
  validatePoolFormat,
  generateInviteCode,
} from '@/lib/pool'
import { insertPool, insertPoolMember, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat } from '@/lib/supabase/types'

export type CreatePoolState = {
  error?: string
  success?: boolean
} | null

export async function createPool(
  _prevState: CreatePoolState,
  formData: FormData
): Promise<CreatePoolState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const name = (formData.get('poolName') as string) ?? ''
  const tournamentId = (formData.get('tournamentId') as string) ?? ''
  const tournamentName = (formData.get('tournamentName') as string) ?? ''
  const yearStr = (formData.get('year') as string) ?? ''
  const deadline = (formData.get('deadline') as string) ?? ''
  const format = ((formData.get('format') as string) ?? 'best_ball') as PoolFormat
  const picksPerEntryStr = (formData.get('picksPerEntry') as string) ?? '4'
  const year = parseInt(yearStr, 10)
  const picksPerEntry = parseInt(picksPerEntryStr, 10)

  const inputValidation = validateCreatePoolInput({
    name,
    tournamentId,
    tournamentName,
    year,
    deadline,
  })
  if (!inputValidation.ok) {
    return { error: inputValidation.error }
  }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) {
    return { error: formatValidation.error }
  }

  const inviteCode = generateInviteCode()

  const { data: pool, error } = await insertPool(supabase, {
    commissioner_id: user.id,
    name: name.trim(),
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    format,
    picks_per_entry: picksPerEntry,
    invite_code: inviteCode,
    status: 'open',
  })

  if (error || !pool) {
    return { error: error ?? 'Failed to create pool.' }
  }

  // Add the commissioner as a pool member with commissioner role
  await insertPoolMember(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    role: 'commissioner',
  })

  // Audit log
  await insertAuditEvent(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    action: 'poolCreated',
    details: { name: pool.name, tournament_id: pool.tournament_id, format: pool.format },
  })

  redirect(`/commissioner/pools/${pool.id}`)
}
```

- [ ] **Step 3: Rewrite the commissioner page with pool list and validation feedback**

Replace `src/app/(app)/commissioner/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolsByCommissioner } from '@/lib/pool-queries'
import { PoolCard } from '@/components/PoolCard'
import { CreatePoolForm } from './CreatePoolForm'

export default async function CommissionerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pools = await getPoolsByCommissioner(supabase, user.id)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissioner Dashboard</h1>

      {pools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Pools</h2>
          <div className="grid gap-4">
            {pools.map(pool => (
              <PoolCard
                key={pool.id}
                pool={pool}
                href={`/commissioner/pools/${pool.id}`}
              />
            ))}
          </div>
        </div>
      )}

      <CreatePoolForm />
    </div>
  )
}
```

- [ ] **Step 4: Create the CreatePoolForm client component**

Create `src/app/(app)/commissioner/CreatePoolForm.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useFormState } from 'react-dom'
import { createPool, type CreatePoolState } from './actions'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

const CACHE_KEY = 'tournament_schedule_cache'

function getCachedTournaments(year: string): TournamentOption[] | null {
  if (typeof window === 'undefined') return null
  const cached = localStorage.getItem(`${CACHE_KEY}_${year}`)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      return null
    }
  }
  return null
}

function setCachedTournaments(year: string, tournaments: TournamentOption[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${CACHE_KEY}_${year}`, JSON.stringify(tournaments))
}

export function CreatePoolForm() {
  const currentYear = new Date().getFullYear().toString()
  const [state, formAction] = useFormState<CreatePoolState, FormData>(createPool, null)
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [picksPerEntry, setPicksPerEntry] = useState('4')
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [availableTournaments, setAvailableTournaments] = useState<TournamentOption[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)

  useEffect(() => {
    const cached = getCachedTournaments(currentYear)
    if (cached) {
      setTournaments(cached)
      setAvailableTournaments(filterUpcoming(cached))
    } else {
      fetchTournaments()
    }
  }, [currentYear])

  const filterUpcoming = (tourns: TournamentOption[]) => {
    const now = new Date()
    return tourns.filter(t => new Date(t.startDate) > now)
  }

  const fetchTournaments = async () => {
    setLoadingTournaments(true)
    try {
      const res = await fetch(`/api/tournaments?year=${currentYear}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const mapped = data.map((t: any) => ({
          id: t.tournId,
          name: t.name,
          startDate: t.date?.start?.$date?.$numberLong
            ? new Date(parseInt(t.date.start.$date.$numberLong)).toISOString().slice(0, 16)
            : ''
        }))
        setTournaments(mapped)
        setCachedTournaments(currentYear, mapped)
        setAvailableTournaments(filterUpcoming(mapped))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTournaments(false)
    }
  }

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    setTournamentId(selectedId)
    const selected = tournaments.find(t => t.id === selectedId)
    setTournamentName(selected?.name || '')
    setDeadline(selected?.startDate || '')
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Create New Pool</h2>

      {state?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="poolName" className="block text-sm font-medium mb-1">Pool Name</label>
          <input
            id="poolName"
            name="poolName"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Masters Pool 2026"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="tournamentId" className="block text-sm font-medium mb-1">Tournament</label>
          <select
            id="tournamentId"
            name="tournamentId"
            value={tournamentId}
            onChange={handleTournamentChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
            disabled={loadingTournaments}
          >
            <option value="">
              {loadingTournaments ? 'Loading tournaments...' : 'Select a tournament'}
            </option>
            {availableTournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input type="hidden" name="tournamentName" value={tournamentName} />
          <input type="hidden" name="year" value={currentYear} />
        </div>

        {deadline && (
          <div>
            <label className="block text-sm font-medium mb-1">Picks Deadline</label>
            <div className="p-2 border rounded bg-gray-50 text-gray-700">
              {new Date(deadline).toLocaleString()}
            </div>
            <input type="hidden" name="deadline" value={deadline} />
          </div>
        )}

        <div>
          <label htmlFor="picksPerEntry" className="block text-sm font-medium mb-1">
            Picks Per Entry
          </label>
          <select
            id="picksPerEntry"
            name="picksPerEntry"
            value={picksPerEntry}
            onChange={(e) => setPicksPerEntry(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n} golfer{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <input type="hidden" name="format" value="best_ball" />

        <button
          type="submit"
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          Create Pool
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors in modified files. If there are errors in other files referencing the old `Pool` shape (missing `commissioner_id` etc.), those files will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/commissioner/actions.ts src/app/(app)/commissioner/page.tsx src/app/(app)/commissioner/CreatePoolForm.tsx
git commit -m "feat(1.1): create pool with validation, commissioner ownership, invite code, format config, and pool list"
```

---

## Task 7: Story 1.2 - Select Tournament and Configure Format

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Create: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`

The create flow already captures tournament and format (Task 6). Story 1.2 adds the ability to **change** tournament and format settings from the pool detail page while the pool is still open.

- [ ] **Step 1: Add updatePoolConfig server action**

Add to the end of `src/app/(app)/commissioner/pools/[poolId]/actions.ts`:

```typescript
import {
  validateCreatePoolInput,
  validatePoolFormat,
} from '@/lib/pool'
import { getPoolById, updatePoolConfig as updatePoolConfigQuery, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat } from '@/lib/supabase/types'

export type UpdatePoolConfigState = {
  error?: string
  success?: boolean
} | null

export async function updatePoolConfigAction(
  _prevState: UpdatePoolConfigState,
  formData: FormData
): Promise<UpdatePoolConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can update this pool.' }
  if (pool.status !== 'open') return { error: 'Pool configuration can only be changed while the pool is open.' }

  const tournamentId = (formData.get('tournamentId') as string) ?? pool.tournament_id
  const tournamentName = (formData.get('tournamentName') as string) ?? pool.tournament_name
  const deadline = (formData.get('deadline') as string) ?? pool.deadline
  const yearStr = (formData.get('year') as string) ?? String(pool.year)
  const format = ((formData.get('format') as string) ?? pool.format) as PoolFormat
  const picksPerEntryStr = (formData.get('picksPerEntry') as string) ?? String(pool.picks_per_entry)
  const year = parseInt(yearStr, 10)
  const picksPerEntry = parseInt(picksPerEntryStr, 10)

  const inputValidation = validateCreatePoolInput({
    name: pool.name,
    tournamentId,
    tournamentName,
    year,
    deadline,
  })
  if (!inputValidation.ok) return { error: inputValidation.error }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) return { error: formatValidation.error }

  const { error } = await updatePoolConfigQuery(supabase, poolId, {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    format,
    picks_per_entry: picksPerEntry,
  })

  if (error) return { error }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolConfigUpdated',
    details: { tournament_id: tournamentId, format, picks_per_entry: picksPerEntry },
  })

  redirect(`/commissioner/pools/${poolId}`)
}
```

Note: You also need to add the existing imports at the top of the file. The final file should have these imports:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canTransitionStatus, validateCreatePoolInput, validatePoolFormat } from '@/lib/pool'
import { getPoolById, updatePoolStatus, updatePoolConfig as updatePoolConfigQuery, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat } from '@/lib/supabase/types'
```

- [ ] **Step 2: Create PoolConfigForm client component**

Create `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useFormState } from 'react-dom'
import { updatePoolConfigAction, type UpdatePoolConfigState } from './actions'
import type { Pool } from '@/lib/supabase/types'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

const CACHE_KEY = 'tournament_schedule_cache'

function getCachedTournaments(year: string): TournamentOption[] | null {
  if (typeof window === 'undefined') return null
  const cached = localStorage.getItem(`${CACHE_KEY}_${year}`)
  if (cached) {
    try { return JSON.parse(cached) } catch { return null }
  }
  return null
}

interface PoolConfigFormProps {
  pool: Pool
}

export function PoolConfigForm({ pool }: PoolConfigFormProps) {
  const [state, formAction] = useFormState<UpdatePoolConfigState, FormData>(updatePoolConfigAction, null)
  const [tournamentId, setTournamentId] = useState(pool.tournament_id)
  const [tournamentName, setTournamentName] = useState(pool.tournament_name)
  const [deadline, setDeadline] = useState(pool.deadline)
  const [picksPerEntry, setPicksPerEntry] = useState(String(pool.picks_per_entry))
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [isEditing, setIsEditing] = useState(false)

  const currentYear = String(pool.year)

  useEffect(() => {
    if (isEditing) {
      const cached = getCachedTournaments(currentYear)
      if (cached) {
        setTournaments(cached)
      } else {
        fetch(`/api/tournaments?year=${currentYear}`)
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data)) {
              const mapped = data.map((t: any) => ({
                id: t.tournId,
                name: t.name,
                startDate: t.date?.start?.$date?.$numberLong
                  ? new Date(parseInt(t.date.start.$date.$numberLong)).toISOString().slice(0, 16)
                  : ''
              }))
              setTournaments(mapped)
            }
          })
          .catch(console.error)
      }
    }
  }, [isEditing, currentYear])

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    setTournamentId(selectedId)
    const selected = tournaments.find(t => t.id === selectedId)
    setTournamentName(selected?.name || '')
    setDeadline(selected?.startDate || '')
  }

  if (pool.status !== 'open') return null

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-sm text-blue-600 hover:text-blue-800 underline"
      >
        Edit Tournament & Format
      </button>
    )
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow mt-4">
      <h3 className="font-semibold mb-3">Update Pool Configuration</h3>

      {state?.error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="poolId" value={pool.id} />
        <input type="hidden" name="year" value={currentYear} />

        <div>
          <label htmlFor="tournamentId" className="block text-sm font-medium mb-1">Tournament</label>
          <select
            id="tournamentId"
            name="tournamentId"
            value={tournamentId}
            onChange={handleTournamentChange}
            className="w-full p-2 border rounded text-sm"
          >
            <option value={pool.tournament_id}>{pool.tournament_name}</option>
            {tournaments.filter(t => t.id !== pool.tournament_id).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input type="hidden" name="tournamentName" value={tournamentName} />
          <input type="hidden" name="deadline" value={deadline} />
        </div>

        <div>
          <label htmlFor="picksPerEntry" className="block text-sm font-medium mb-1">Picks Per Entry</label>
          <select
            id="picksPerEntry"
            name="picksPerEntry"
            value={picksPerEntry}
            onChange={(e) => setPicksPerEntry(e.target.value)}
            className="w-full p-2 border rounded text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n} golfer{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <input type="hidden" name="format" value="best_ball" />

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 border text-sm rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx
git commit -m "feat(1.2): add tournament and format configuration editing for open pools"
```

---

## Task 8: Story 1.3 - Share a Join Link

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx`
- Create: `src/app/join/[inviteCode]/page.tsx`
- Create: `src/app/join/[inviteCode]/actions.ts`

- [ ] **Step 1: Write failing test for invite code lookup**

Add to `src/lib/__tests__/pool.test.ts`:

```typescript
describe('generateInviteCode', () => {
  // ... existing tests ...

  it('produces only lowercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode()
      expect(code).toMatch(/^[a-z0-9]+$/)
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass**

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: All tests pass (existing + new).

- [ ] **Step 3: Create InviteLinkSection component**

Create `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx`:

```tsx
'use client'

import { CopyLinkButton } from '@/components/CopyLinkButton'

interface InviteLinkSectionProps {
  inviteCode: string
}

export function InviteLinkSection({ inviteCode }: InviteLinkSectionProps) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${baseUrl}/join/${inviteCode}`

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-2">Invite Players</h3>
      <p className="text-sm text-gray-500 mb-3">
        Share this link with players so they can join the pool.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 p-2 bg-gray-50 border rounded text-sm truncate">
          {joinUrl}
        </code>
        <CopyLinkButton url={joinUrl} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the join link landing page**

Create `src/app/join/[inviteCode]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getPoolByInviteCode } from '@/lib/pool-queries'
import { redirect } from 'next/navigation'
import { JoinPoolForm } from './JoinPoolForm'

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params
  const supabase = await createClient()

  const pool = await getPoolByInviteCode(supabase, inviteCode)

  if (!pool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Invalid Invite Link</h1>
          <p className="text-gray-500">
            This pool link is not valid. Please check with your commissioner for the correct link.
          </p>
        </div>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Store the invite code in a cookie or redirect param so sign-in can redirect back
    redirect(`/sign-in?redirect=/join/${inviteCode}`)
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    // Already a member, send them to their picks page
    redirect(`/participant/picks/${pool.id}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow max-w-md">
        <h1 className="text-xl font-bold mb-2">Join {pool.name}</h1>
        <p className="text-gray-500 mb-1">{pool.tournament_name}</p>
        <p className="text-sm text-gray-400 mb-6">
          Deadline: {new Date(pool.deadline).toLocaleString()}
        </p>
        <JoinPoolForm poolId={pool.id} inviteCode={inviteCode} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the JoinPoolForm client component**

Create `src/app/join/[inviteCode]/JoinPoolForm.tsx`:

```tsx
'use client'

import { useFormState } from 'react-dom'
import { joinPool, type JoinPoolState } from './actions'

interface JoinPoolFormProps {
  poolId: string
  inviteCode: string
}

export function JoinPoolForm({ poolId, inviteCode }: JoinPoolFormProps) {
  const [state, formAction] = useFormState<JoinPoolState, FormData>(joinPool, null)

  return (
    <>
      {state?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <input type="hidden" name="inviteCode" value={inviteCode} />
        <button
          type="submit"
          className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          Join This Pool
        </button>
      </form>
    </>
  )
}
```

- [ ] **Step 6: Create the joinPool server action**

Create `src/app/join/[inviteCode]/actions.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPoolByInviteCode, insertPoolMember, insertAuditEvent } from '@/lib/pool-queries'

export type JoinPoolState = {
  error?: string
} | null

export async function joinPool(
  _prevState: JoinPoolState,
  formData: FormData
): Promise<JoinPoolState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const inviteCode = formData.get('inviteCode') as string

  // Verify invite code matches pool for security
  const pool = await getPoolByInviteCode(supabase, inviteCode)
  if (!pool || pool.id !== poolId) {
    return { error: 'Invalid invite link.' }
  }

  const { error } = await insertPoolMember(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    role: 'player',
  })

  if (error) {
    // Unique constraint means already a member
    if (error.includes('duplicate') || error.includes('unique')) {
      redirect(`/participant/picks/${pool.id}`)
    }
    return { error: 'Failed to join pool.' }
  }

  await insertAuditEvent(supabase, {
    pool_id: pool.id,
    user_id: user.id,
    action: 'playerJoined',
    details: {},
  })

  redirect(`/participant/picks/${pool.id}`)
}
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No type errors in join route files.

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx src/app/join/ src/components/CopyLinkButton.tsx
git commit -m "feat(1.3): add invite link generation, share UI, and join-pool flow"
```

---

## Task 9: Story 1.4 - Review Pool Status and Participation

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Create: `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`

- [ ] **Step 1: Rewrite the commissioner pool detail page**

Replace `src/app/(app)/commissioner/pools/[poolId]/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPoolById, getPoolMembers, getEntriesForPool } from '@/lib/pool-queries'
import { StatusChip } from '@/components/StatusChip'
import { StartPoolButton, ClosePoolButton } from './PoolActions'
import { InviteLinkSection } from './InviteLinkSection'
import { PoolConfigForm } from './PoolConfigForm'
import { PoolStatusSection } from './PoolStatusSection'
import Link from 'next/link'

export default async function CommissionerPoolDetail({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')

  // Commissioner ownership check
  if (pool.commissioner_id !== user.id) {
    redirect('/commissioner')
  }

  const members = await getPoolMembers(supabase, poolId)
  const entries = await getEntriesForPool(supabase, poolId)

  const { data: allGolfers } = await supabase.from('golfers').select('*')
  const golferMap = new Map(allGolfers?.map(g => [g.id, g.name]) || [])

  const playersWithEntries = new Set(entries.map(e => e.user_id))
  const playerMembers = members.filter(m => m.role === 'player')
  const membersWithoutEntries = playerMembers.filter(m => !playersWithEntries.has(m.user_id))

  const isLocked = pool.status !== 'open' || new Date(pool.deadline) <= new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip status={pool.status} />
          {pool.status === 'open' && <StartPoolButton poolId={pool.id} />}
          {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
        </div>
      </div>

      {/* Pool Status Summary */}
      <PoolStatusSection
        pool={pool}
        memberCount={playerMembers.length}
        entryCount={entries.length}
        isLocked={isLocked}
        pendingCount={membersWithoutEntries.length}
      />

      {/* Invite Link */}
      <InviteLinkSection inviteCode={pool.invite_code} />

      {/* Tournament & Format Config (editable only while open) */}
      <PoolConfigForm pool={pool} />

      {/* Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Entries ({entries.length})</h2>
            <Link
              href={`/spectator/pools/${poolId}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm">Participant</th>
              <th className="px-4 py-2 text-left text-sm">Golfers</th>
              <th className="px-4 py-2 text-right text-sm">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No entries yet. Share the invite link to get started.
                </td>
              </tr>
            ) : entries.map(entry => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-2 text-sm">{entry.user_id.slice(0, 8)}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {entry.golfer_ids.map((id: string) => (
                      <span key={id} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {golferMap.get(id) || id}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-500 text-sm">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Members */}
      {membersWithoutEntries.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-2">
            Waiting for Entries ({membersWithoutEntries.length})
          </h3>
          <p className="text-sm text-gray-500">
            These players have joined but haven&apos;t submitted picks yet.
          </p>
          <ul className="mt-2 space-y-1">
            {membersWithoutEntries.map(m => (
              <li key={m.id} className="text-sm text-gray-600">{m.user_id.slice(0, 8)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PoolStatusSection component**

Create `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`:

```tsx
import type { Pool } from '@/lib/supabase/types'

interface PoolStatusSectionProps {
  pool: Pool
  memberCount: number
  entryCount: number
  isLocked: boolean
  pendingCount: number
}

export function PoolStatusSection({
  pool,
  memberCount,
  entryCount,
  isLocked,
  pendingCount,
}: PoolStatusSectionProps) {
  const deadlinePassed = new Date(pool.deadline) <= new Date()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{memberCount}</div>
        <div className="text-sm text-gray-500">Players Joined</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{entryCount}</div>
        <div className="text-sm text-gray-500">Entries Submitted</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-2xl font-bold">{pendingCount}</div>
        <div className="text-sm text-gray-500">Awaiting Picks</div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium">
          {pool.deadline ? new Date(pool.deadline).toLocaleDateString() : '-'}
        </div>
        <div className="text-sm text-gray-500">Picks Deadline</div>
        <div className="mt-1">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
              <span aria-hidden="true">{'\uD83D\uDD12'}</span> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <span aria-hidden="true">{'\uD83D\uDD13'}</span> Open
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/page.tsx src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx
git commit -m "feat(1.4): add pool status dashboard with participation summary, lock state, and pending member list"
```

---

## Task 10: Story 1.5 - Perform Commissioner-Only Actions

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx`

The existing `startPool` and `closePool` actions lack commissioner ownership verification and audit logging. This task adds those.

- [ ] **Step 1: Write failing test for status transitions**

The `canTransitionStatus` tests from Task 3 already cover the domain logic. Verify they still pass:

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: All tests pass.

- [ ] **Step 2: Rewrite startPool and closePool with ownership checks and audit logging**

Replace the `startPool` and `closePool` functions in `src/app/(app)/commissioner/pools/[poolId]/actions.ts`. The complete file should now be:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canTransitionStatus, validateCreatePoolInput, validatePoolFormat } from '@/lib/pool'
import { getPoolById, updatePoolStatus, updatePoolConfig as updatePoolConfigQuery, insertAuditEvent } from '@/lib/pool-queries'
import type { PoolFormat, PoolStatus } from '@/lib/supabase/types'

// --- Status transition actions ---

export type PoolActionState = {
  error?: string
} | null

export async function startPool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can start this pool.' }

  if (!canTransitionStatus(pool.status as PoolStatus, 'live')) {
    return { error: 'Pool cannot be started from its current state.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'live')
  if (error) return { error: 'Failed to start pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolStarted',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function closePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can close this pool.' }

  if (!canTransitionStatus(pool.status as PoolStatus, 'complete')) {
    return { error: 'Pool cannot be closed from its current state.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'complete')
  if (error) return { error: 'Failed to close pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolClosed',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

// --- Config update action ---

export type UpdatePoolConfigState = {
  error?: string
  success?: boolean
} | null

export async function updatePoolConfigAction(
  _prevState: UpdatePoolConfigState,
  formData: FormData
): Promise<UpdatePoolConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const pool = await getPoolById(supabase, poolId)

  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can update this pool.' }
  if (pool.status !== 'open') return { error: 'Pool configuration can only be changed while the pool is open.' }

  const tournamentId = (formData.get('tournamentId') as string) ?? pool.tournament_id
  const tournamentName = (formData.get('tournamentName') as string) ?? pool.tournament_name
  const deadline = (formData.get('deadline') as string) ?? pool.deadline
  const yearStr = (formData.get('year') as string) ?? String(pool.year)
  const format = ((formData.get('format') as string) ?? pool.format) as PoolFormat
  const picksPerEntryStr = (formData.get('picksPerEntry') as string) ?? String(pool.picks_per_entry)
  const year = parseInt(yearStr, 10)
  const picksPerEntry = parseInt(picksPerEntryStr, 10)

  const inputValidation = validateCreatePoolInput({
    name: pool.name,
    tournamentId,
    tournamentName,
    year,
    deadline,
  })
  if (!inputValidation.ok) return { error: inputValidation.error }

  const formatValidation = validatePoolFormat(format, picksPerEntry)
  if (!formatValidation.ok) return { error: formatValidation.error }

  const { error } = await updatePoolConfigQuery(supabase, poolId, {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    year,
    deadline,
    format,
    picks_per_entry: picksPerEntry,
  })

  if (error) return { error }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolConfigUpdated',
    details: { tournament_id: tournamentId, format, picks_per_entry: picksPerEntry },
  })

  redirect(`/commissioner/pools/${poolId}`)
}
```

- [ ] **Step 3: Update PoolActions.tsx with better feedback**

Replace `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx` with:

```tsx
'use client'

import { useFormState } from 'react-dom'
import { startPool, closePool, type PoolActionState } from './actions'

function StartPoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(startPool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          Start Pool (Go Live)
        </button>
      </form>
    </div>
  )
}

function ClosePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(closePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          End Pool
        </button>
      </form>
    </div>
  )
}

export { StartPoolButton, ClosePoolButton }
```

- [ ] **Step 4: Verify player access is blocked**

The commissioner ownership check in the pool detail page (Task 9) ensures non-commissioners are redirected. The server actions also verify `pool.commissioner_id !== user.id`. No separate player page changes are needed for this story — the controls are already invisible to non-commissioners by route structure (`/commissioner/pools/[poolId]` is a commissioner route).

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx
git commit -m "feat(1.5): add commissioner ownership checks, audit logging, and status transition guards to all pool actions"
```

---

## Task 11: Story 1.6 - Reuse Pool for Future Tournament

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

- [ ] **Step 1: Verify buildClonePoolInput tests pass**

Run: `npm test -- src/lib/__tests__/pool.test.ts`
Expected: The `buildClonePoolInput` test from Task 3 passes.

- [ ] **Step 2: Add reusePool server action**

Add to the bottom of `src/app/(app)/commissioner/pools/[poolId]/actions.ts`:

```typescript
import { buildClonePoolInput, generateInviteCode } from '@/lib/pool'
import { insertPool, insertPoolMember } from '@/lib/pool-queries'

export type ReusePoolState = {
  error?: string
} | null

export async function reusePool(
  _prevState: ReusePoolState,
  formData: FormData
): Promise<ReusePoolState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const sourcePool = await getPoolById(supabase, poolId)

  if (!sourcePool) return { error: 'Pool not found.' }
  if (sourcePool.commissioner_id !== user.id) return { error: 'Only the commissioner can reuse this pool.' }

  const cloneInput = buildClonePoolInput(sourcePool)
  const inviteCode = generateInviteCode()

  const { data: newPool, error } = await insertPool(supabase, {
    commissioner_id: user.id,
    name: cloneInput.name,
    tournament_id: '',
    tournament_name: '',
    year: new Date().getFullYear(),
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // default 1 week out
    format: cloneInput.format,
    picks_per_entry: cloneInput.picks_per_entry,
    invite_code: inviteCode,
    status: 'open',
  })

  if (error || !newPool) return { error: error ?? 'Failed to create new pool.' }

  await insertPoolMember(supabase, {
    pool_id: newPool.id,
    user_id: user.id,
    role: 'commissioner',
  })

  await insertAuditEvent(supabase, {
    pool_id: newPool.id,
    user_id: user.id,
    action: 'poolCloned',
    details: { source_pool_id: sourcePool.id },
  })

  redirect(`/commissioner/pools/${newPool.id}`)
}
```

Note: Add `buildClonePoolInput` and `generateInviteCode` to the import from `@/lib/pool` at the top of the file, and `insertPool, insertPoolMember` to the import from `@/lib/pool-queries`. The final imports at the top should be:

```typescript
import { canTransitionStatus, validateCreatePoolInput, validatePoolFormat, buildClonePoolInput, generateInviteCode } from '@/lib/pool'
import { getPoolById, updatePoolStatus, updatePoolConfig as updatePoolConfigQuery, insertAuditEvent, insertPool, insertPoolMember } from '@/lib/pool-queries'
```

- [ ] **Step 3: Create ReusePoolButton component**

Create `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx`:

```tsx
'use client'

import { useFormState } from 'react-dom'
import { reusePool, type ReusePoolState } from './actions'

interface ReusePoolButtonProps {
  poolId: string
}

export function ReusePoolButton({ poolId }: ReusePoolButtonProps) {
  const [state, formAction] = useFormState<ReusePoolState, FormData>(reusePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <button
          type="submit"
          className="px-4 py-2 border border-blue-600 text-blue-600 text-sm rounded hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          Reuse for Next Tournament
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Add ReusePoolButton to the pool detail page**

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, add the import at the top:

```tsx
import { ReusePoolButton } from './ReusePoolButton'
```

Then add the button in the header area after the status transition buttons. Find this block:

```tsx
          {pool.status === 'live' && <ClosePoolButton poolId={pool.id} />}
```

And add after it:

```tsx
          {pool.status === 'complete' && <ReusePoolButton poolId={pool.id} />}
```

- [ ] **Step 5: Verify all domain tests pass**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx src/app/(app)/commissioner/pools/[poolId]/page.tsx
git commit -m "feat(1.6): add pool reuse with format preservation, fresh invite code, and audit trail"
```

---

## Task 12: Fix Remaining Type Errors Across Existing Files

The schema changes (adding `commissioner_id`, `invite_code`, etc.) may break existing files that reference the old `Pool` shape. This task fixes all remaining compile errors.

**Files:**
- Potentially modify: `src/app/(app)/participant/pools/page.tsx`, `src/app/(app)/participant/picks/[poolId]/page.tsx`, `src/app/(app)/participant/picks/[poolId]/actions.ts`, `src/app/spectator/pools/[poolId]/page.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Run full type check and identify all errors**

Run: `npx tsc --noEmit`
Expected: Note all errors. Common ones: `Property 'year' does not exist` in schema, client-side Supabase usage in server context.

- [ ] **Step 2: Fix src/app/page.tsx**

Replace the inline mock client with the real Supabase client:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/participant/pools')
  }
  redirect('/sign-in')
}
```

- [ ] **Step 3: Fix src/app/spectator/pools/[poolId]/page.tsx**

This file incorrectly uses the browser client in a server component. Fix it:

```tsx
import { createClient } from '@/lib/supabase/server'
import { Leaderboard } from '@/components/leaderboard'

export default async function SpectatorPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    return <div className="p-8 text-center text-gray-500">Pool not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Leaderboard poolId={poolId} />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run full type check again**

Run: `npx tsc --noEmit`
Expected: Zero errors (or only errors from dynamic Supabase query return types that are expected).

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: resolve type errors from schema changes across existing files"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings).

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint and build issues from epic 1 implementation"
```

---

## FR Coverage Verification

| FR | Story | Task(s) | How it's covered |
|---|---|---|---|
| FR1: Create a private pool | 1.1 | 3, 4, 6 | Domain validation in `pool.ts`, server action with `commissioner_id` and `invite_code`, create form with error feedback |
| FR2: Select a tournament | 1.2 | 7 | Tournament dropdown in create form + config edit form |
| FR3: Configure pool format | 1.2 | 6, 7 | `picks_per_entry` selector in create form + config edit |
| FR4: Generate and share invite link | 1.3 | 3, 8 | `generateInviteCode()` in domain logic, `InviteLinkSection` + `CopyLinkButton`, join route |
| FR5: View pool status | 1.4 | 9 | `PoolStatusSection` with member count, entry count, pending count, lock state |
| FR6: Commissioner-only actions | 1.5 | 10 | Ownership check on all actions, status transitions guarded by `canTransitionStatus`, audit logging |
| FR7: View participation and entry status | 1.4 | 9 | Entries table, pending members list, entry count stats |
| FR8: Reuse pool for future tournament | 1.6 | 11 | `buildClonePoolInput` in domain, `reusePool` action, `ReusePoolButton` |

## NFR Coverage Notes

| NFR | How it's addressed |
|---|---|
| NFR5: Private pool access | `pool_members` table + `invite_code` join flow |
| NFR6: Commissioner-only actions restricted | `commissioner_id` ownership check on all mutations |
| NFR8: Auditable actions | `audit_events` table + logging in every mutation |
| NFR13-15: Accessibility | `StatusChip` uses text+icon (not color alone), `role="alert"` on errors, `role="status"` on chips, focus rings on interactive elements |
