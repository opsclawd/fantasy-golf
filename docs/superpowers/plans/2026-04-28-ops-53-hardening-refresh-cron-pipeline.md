# OPS-53: Harden Refresh and Cron Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory `isUpdating` mutex with DB-backed distributed locking via a new `refresh_locks` table, add telemetry columns to `pools`, and add tests for concurrent refresh safety.

**Architecture:** `refresh_locks` table with `tournament_id` as primary key, insert-first locking with 5-minute TTL for automatic release on crash. `locked_by` stores the generated lock ID. Lock functions in `pool-queries.ts` called by both `/api/scoring` and `/api/scoring/refresh`. Telemetry columns on `pools`: `last_refresh_success_at`, `refresh_attempt_count`, `last_refresh_attempt_at`.

**Tech Stack:** TypeScript, Vitest, Supabase (Postgres), Next.js API routes

---

## Implementation Status: COMPLETE

Implementation is on branch `feature/ops-53-hardening-refresh-cron-pipeline` (PR #37). All tasks below are already implemented. This plan documents what was done.

---

## File Structure

```
supabase/migrations/
  20260427092000_add_refresh_locks_and_telemetry.sql  # new table + telemetry columns
src/lib/
  pool-queries.ts          # acquireRefreshLock, releaseRefreshLock, updatePoolRefreshTelemetry
  supabase/
    types.ts              # Pool telemetry fields + LockAcquireResult interface
src/lib/__tests__/
  scoring-lock.test.ts     # lock acquisition/release unit tests
  refresh-telemetry.test.ts # telemetry recording unit tests
  pool-state-transitions.test.ts # open→live→complete state transition tests
src/app/api/scoring/
  route.ts                # replace in-memory mutex with DB lock
  refresh/
    route.ts              # replace in-memory mutex with DB lock
```

---

## Task 1: Add `refresh_locks` table and telemetry columns migration

**Files:**
- Create: `supabase/migrations/20260427092000_add_refresh_locks_and_telemetry.sql`

- [x] **Migration SQL:**

```sql
create table if not exists public.refresh_locks (
  tournament_id text primary key,
  locked_by text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.refresh_locks enable row level security;

create policy "refresh_locks_service_role_all"
  on public.refresh_locks for all to service_role
  using (true) with check (true);

grant select, insert, update, delete on public.refresh_locks to service_role;

alter table public.pools
  add column if not exists last_refresh_success_at timestamptz;

alter table public.pools
  add column if not exists refresh_attempt_count integer default 0;

alter table public.pools
  add column if not exists last_refresh_attempt_at timestamptz;
```

**Verification:**
```bash
# Apply migration against Supabase database
# Check tables exist:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
# Should list: refresh_locks, pools (with new columns)
```

---

## Task 2: Add new Pool telemetry fields and `LockAcquireResult` to types.ts

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [x] **Add telemetry fields to Pool interface and `LockAcquireResult`:**

```typescript
// src/lib/supabase/types.ts — Pool interface additions
export interface Pool {
  // ... existing fields ...
  last_refresh_success_at?: string | null
  refresh_attempt_count?: number
  last_refresh_attempt_at?: string | null
}

export interface LockAcquireResult {
  acquired: boolean
  lockId?: string
  heldBy?: string
  expiresAt?: string
}
```

**Verification:** `npx tsc --noEmit src/lib/supabase/types.ts` — no errors

---

## Task 3: Add `acquireRefreshLock` and `releaseRefreshLock` to pool-queries.ts

**Files:**
- Modify: `src/lib/pool-queries.ts`

- [x] **Add `acquireRefreshLock` with `LOCK_TTL_MS` constant:**

```typescript
const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function acquireRefreshLock(
  supabase: SupabaseClient,
  tournamentId: string,
  lockId: string
): Promise<LockAcquireResult> {
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString()

  // Fast path: try insert first
  const { error: insertError } = await supabase
    .from('refresh_locks')
    .insert({
      tournament_id: tournamentId,
      locked_by: lockId,
      locked_at: new Date().toISOString(),
      expires_at: expiresAt,
    })

  if (!insertError) {
    return { acquired: true, lockId }
  }

  // Conflict — check if existing lock is expired
  const { data: existing } = await supabase
    .from('refresh_locks')
    .select('*')
    .eq('tournament_id', tournamentId)
    .single()

  if (!existing) {
    return { acquired: false }
  }

  const expired = new Date(existing.expires_at) < new Date()
  if (expired) {
    // Claim stale lock
    await supabase
      .from('refresh_locks')
      .update({
        locked_by: lockId,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('tournament_id', tournamentId)
    return { acquired: true, lockId }
  }

  return {
    acquired: false,
    heldBy: existing.locked_by,
    expiresAt: existing.expires_at,
  }
}
```

- [x] **Add `releaseRefreshLock`:**

```typescript
export async function releaseRefreshLock(
  supabase: SupabaseClient,
  tournamentId: string,
  lockId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('refresh_locks')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('locked_by', lockId)

  return { error: error?.message ?? null }
}
```

**Verification:** `npm test -- --run src/lib/__tests__/scoring-lock.test.ts` — PASS

---

## Task 4: Add `updatePoolRefreshTelemetry` to pool-queries.ts

**Files:**
- Modify: `src/lib/pool-queries.ts`

- [x] **Add `updatePoolRefreshTelemetry`:**

```typescript
export async function updatePoolRefreshTelemetry(
  supabase: SupabaseClient,
  poolId: string,
  telemetry: {
    refresh_attempt_count?: number
    last_refresh_attempt_at?: string
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pools')
    .update(telemetry)
    .eq('id', poolId)

  return { error: error?.message ?? null }
}
```

**Verification:** `npm test -- --run src/lib/__tests__/refresh-telemetry.test.ts` — PASS

---

## Task 5: Replace in-memory mutex in `/api/scoring/route.ts`

**Files:**
- Modify: `src/app/api/scoring/route.ts`

- [x] **Removed:** `let isUpdating = false`

- [x] **Added:** `generateLockId()` using `crypto.randomUUID()`, `acquireRefreshLock`/`releaseRefreshLock` in try/finally

- [x] **Lock acquisition flow:**
  1. Get active pool
  2. Generate lock ID with `crypto.randomUUID()`
  3. Call `acquireRefreshLock(supabase, pool.tournament_id, lockId)`
  4. If `!lockResult.acquired` → return `409 REFRESH_LOCKED`
  5. Try/finally wraps `refreshScoresForPool`, releases lock in finally

**Verification:**
- `npm test -- --run src/app/api/scoring/route.test.ts` — PASS
- `npx tsc --noEmit src/app/api/scoring/route.ts` — no errors

---

## Task 6: Replace in-memory mutex in `/api/scoring/refresh/route.ts`

**Files:**
- Modify: `src/app/api/scoring/refresh/route.ts`

- [x] **Removed:** `let isUpdating = false`

- [x] **Same locking pattern** as Task 5 — `generateLockId()` + `acquireRefreshLock`/`releaseRefreshLock` in try/finally

**Verification:**
- `npm test -- --run src/app/api/scoring/refresh/route.test.ts` — PASS
- `npx tsc --noEmit src/app/api/scoring/refresh/route.ts` — no errors

---

## Task 7: Add unit tests for lock acquisition/release

**Files:**
- Create: `src/lib/__tests__/scoring-lock.test.ts`

**Tests cover:**
1. Happy path: acquires lock when no existing lock
2. Conflict: returns `heldBy` when lock exists and not expired
3. Expiry: claims expired lock when no other holder

**Verification:** `npm test -- --run src/lib/__tests__/scoring-lock.test.ts` — PASS

---

## Task 8: Add unit tests for refresh telemetry

**Files:**
- Create: `src/lib/__tests__/refresh-telemetry.test.ts`

**Tests cover:**
1. `updatePoolRefreshTelemetry` calls `pools` update with correct fields

**Verification:** `npm test -- --run src/lib/__tests__/refresh-telemetry.test.ts` — PASS

---

## Task 9: Add unit tests for pool state transitions

**Files:**
- Create: `src/lib/__tests__/pool-state-transitions.test.ts`

**Tests cover:**
1. `open → live`: transitions when deadline passes
2. `live → complete`: transitions when tournament ends
3. `complete → archived`: commissioner archives pool
4. `open → archived`: commissioner archives without ever going live
5. Invalid transitions are rejected

**Verification:** `npm test -- --run src/lib/__tests__/pool-state-transitions.test.ts` — PASS

---

## Spec Coverage Check

| Spec Requirement | Implementation |
|-----------------|----------------|
| `refresh_locks` table | Migration: `20260427092000_add_refresh_locks_and_telemetry.sql` |
| Telemetry columns (`last_refresh_success_at`, `refresh_attempt_count`, `last_refresh_attempt_at`) | Added to `pools` table via migration; typed in `types.ts` |
| `acquireRefreshLock` / `releaseRefreshLock` | `pool-queries.ts` — insert-first, 5-min TTL, expired lock claim |
| `updatePoolRefreshTelemetry` | `pool-queries.ts` |
| Pool types update | `types.ts` — Pool interface + `LockAcquireResult` |
| Replace in-memory mutex in `/api/scoring` | `route.ts` — `generateLockId()` + `acquireRefreshLock`/`releaseRefreshLock` in try/finally |
| Replace in-memory mutex in `/api/scoring/refresh` | `refresh/route.ts` — same pattern |
| Lock acquisition/release unit tests | `scoring-lock.test.ts` |
| Refresh telemetry unit tests | `refresh-telemetry.test.ts` |
| Pool state transition unit tests | `pool-state-transitions.test.ts` |

---

## Out of Scope (Already Satisfied / Handled Elsewhere)

- **Idempotent refresh**: Already satisfied by existing `upsertTournamentScore` behavior using `ON CONFLICT DO UPDATE`
- **Pool state transition rules**: Documented in design spec; `updatePoolStatus` already implements the required transitions
- **Cron pipeline hardening**: The `/api/cron/scoring` route proxies to `/api/scoring` — locking there protects the entire pipeline

---

## PR Information

**Branch:** `feature/ops-53-hardening-refresh-cron-pipeline`  
**PR:** #37  
**Verification:** `npm test -- --run` — all tests PASS
