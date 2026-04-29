# OPS-53: Harden Refresh and Cron Pipeline for Reliable Live Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory refresh mutex with a DB-backed distributed locking strategy that works safely across serverless instances, makes refresh idempotent, improves telemetry, and clarifies pool state transitions.

**Architecture:** Use a dedicated `refresh_locks` table with row-level locking via `SELECT FOR UPDATE`. This approach is portable across serverless environments, observable (lock state is queryable), and automatically releases on failure. Refresh operations become idempotent through careful ordering of DB writes.

---

## Scope

- Replace in-memory `isUpdating` mutex with DB-level locking in both `/api/scoring` and `/api/scoring/refresh`
- Add new telemetry columns to the `pools` table for better observability
- Clarify pool state transition rules (`open → live → complete → archived`)
- Add integration tests covering concurrent refresh and repeated execution scenarios

---

## Problem Analysis

### Current Issues

1. **In-memory mutex only works on a single instance.**
   The `let isUpdating = false` flag in both route files is reset on each cold start. In a serverless environment (Vercel, AWS Lambda) or with multiple Supabase Edge Functions instances, concurrent requests can bypass this lock entirely.

2. **No lock observability.**
   There is no way to inspect who holds a refresh lock, how long they've held it, or whether a previous refresh is stuck.

3. **Repeated executions can cause partial state.**
   If a cron job retries after a previous partial failure, the `upsertTournamentScore` writes could overwrite partial data without a consistent view of what changed.

4. **Telemetry gaps.**
   `refreshed_at` and `last_refresh_error` exist, but there is no `last_refresh_success_at`, `refresh_attempt_count`, or `last_refresh_attempt_at` to distinguish "never refreshed" from "refresh failed 10 times."

### Acceptance Criteria Mapping

| Criterion | How Addressed |
|-----------|---------------|
| repeated refreshes do not corrupt data | Idempotent upserts + atomic tournament-level scoring writes |
| concurrent refresh attempts are handled safely | DB-level `SELECT FOR UPDATE` lock via `refresh_locks` table |
| stale vs current scoring status is visible and auditable | New telemetry columns + audit trail events |
| cron-driven refresh works reliably in deployed environment | Serverless-compatible locking (no in-memory state) |

---

## File Structure

### New Files

- `supabase/migrations/YYYYMMDDHHMMSS_add_refresh_locks_and_telemetry.sql` — adds `refresh_locks` table and new telemetry columns to `pools`
- `src/lib/__tests__/scoring-lock.test.ts` — tests for the distributed locking logic
- `src/lib/__tests__/pool-state-transitions.test.ts` — tests for open→live→complete transitions
- `src/lib/__tests__/refresh-telemetry.test.ts` — tests for telemetry recording

### Modify

- `src/lib/scoring-refresh.ts` — accept lock context, use tournament-level scoring writes for atomicity
- `src/app/api/scoring/route.ts` — replace in-memory mutex with DB lock, add telemetry
- `src/app/api/scoring/refresh/route.ts` — replace in-memory mutex with DB lock, add telemetry
- `src/lib/pool-queries.ts` — add `acquireRefreshLock`, `releaseRefreshLock`, `updatePoolRefreshTelemetry` functions
- `src/lib/supabase/types.ts` — add new Pool telemetry fields
- `src/lib/scoring-queries.ts` — add tournament-level score upsert with atomic round writes

---

## Database Schema Changes

### New `refresh_locks` Table

```sql
CREATE TABLE refresh_locks (
  tournament_id TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,          -- instance identifier (e.g., hostname or uuid)
  locked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL    -- TTL for automatic release if holder crashes
);

ALTER TABLE refresh_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refresh_locks_service_role_all"
  ON refresh_locks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_locks TO service_role;
```

**Lock TTL:** 5 minutes. If the holder doesn't release within 5 minutes, the lock is considered stale and can be claimed by another instance.

### New Telemetry Columns on `pools`

```sql
ALTER TABLE pools ADD COLUMN last_refresh_success_at TIMESTAMPTZ;
ALTER TABLE pools ADD COLUMN refresh_attempt_count INTEGER DEFAULT 0;
ALTER TABLE pools ADD COLUMN last_refresh_attempt_at TIMESTAMPTZ;
```

These complement the existing `refreshed_at` (last successful completion) and `last_refresh_error` (last failure message).

### Schema Summary

| Column | Type | Description |
|--------|------|-------------|
| `refreshed_at` | `timestamptz` | Last successful refresh completion |
| `last_refresh_error` | `text` | Last error message |
| `last_refresh_success_at` | `timestamptz` | Synonym for `refreshed_at` (added for clarity) |
| `refresh_attempt_count` | `integer` | Total refresh attempts (success + failure) |
| `last_refresh_attempt_at` | `timestamptz` | Last attempt start time |

---

## Locking Strategy

### Algorithm: `acquireRefreshLock(tournamentId)`

```
1. Generate a unique lock_id (uuid)
2. Attempt INSERT into refresh_locks (ON CONFLICT DO NOTHING) — fast path
3. If insert succeeds → lock acquired, return { acquired: true, lockId }
4. If insert fails (duplicate key) → check existing row:
   a. If expires_at is in the past → UPDATE to claim (old instance died)
   b. If expires_at is in the future → lock held by another instance
5. Return { acquired: false, heldBy, expiresAt }
```

### Algorithm: `releaseRefreshLock(tournamentId, lockId)`

```
1. DELETE FROM refresh_locks WHERE tournament_id = $1 AND locked_by = $2
2. Only the lock holder can release (verified by lockId matching locked_by)
```

### Lock Scope

The lock is at the **tournament level**, not pool level. All pools sharing the same `tournament_id` share a single refresh lock. This is correct because `refreshScoresForPool` already fetches scores once per tournament and fans out to all pools.

### Lock Duration

- Lock is acquired at the start of `refreshScoresForPool`
- Lock is released in `finally` block, always
- Lock TTL is 5 minutes — if a process crashes, the lock auto-releases after TTL

---

## Telemetry Recording

### On Refresh Attempt Start

```ts
await updatePoolRefreshTelemetry(supabase, pool.id, {
  refresh_attempt_count: increment,
  last_refresh_attempt_at: now,
})
```

### On Refresh Success

```ts
await updatePoolRefreshMetadata(supabase, pool.id, {
  refreshed_at: now,
  last_refresh_success_at: now,
  last_refresh_error: null,
})
```

### On Refresh Failure

```ts
await updatePoolRefreshMetadata(supabase, pool.id, {
  last_refresh_error: errorMessage,
})
```

---

## Pool State Transitions

### States

| State | Description |
|-------|-------------|
| `open` | Accepting entries. Deadline has not passed. |
| `live` | Tournament in progress. Picks locked. Scores being tracked. |
| `complete` | Tournament finished. Final standings determined. |
| `archived` | Commissioner archived the pool. Read-only. |

### Transition Rules

| From | To | Trigger |
|------|----|---------|
| `open` | `live` | Deadline passes (automatic via cron or on-demand check) OR commissioner manually locks |
| `live` | `complete` | All golfers in the tournament have status `complete` or `dq` OR commissioner manually closes |
| `live` | `archived` | Commissioner archives (only from `complete`) |
| `open` | `archived` | Commissioner archives without ever going live |
| `complete` | `archived` | Commissioner archives |

**Important:** Transitions to `complete` should only happen when scoring data confirms the tournament is truly finished. The signal is: the external API returns all golfers with status `complete` or `dq`.

### Open → Live: Explicit Deadline Check

The `getOpenPoolsPastDeadline` function already handles finding pools to transition. The transition itself uses optimistic locking:

```ts
const result = await updatePoolStatus(supabase, poolId, 'live', 'open')
if (result.error === 'Pool state changed. Please refresh and try again.') {
  // Another process already transitioned it — skip
}
```

---

## Refresh Idempotency

### What Makes It Idempotent

1. **Scores are upserted, not deleted and re-inserted.**
   `upsertTournamentScore` uses `ON CONFLICT DO UPDATE`, so running it twice with the same data produces the same result.

2. **Refresh fetches the full current state from the external API each time.**
   There is no "partial refresh" state — each run starts from a clean external-API snapshot.

3. **The lock prevents concurrent refreshes from creating interleaved writes.**
   One refresh completes before the next starts.

### What Does NOT Make It Idempotent (And Why That's OK)

- **If the external API returns different data between calls**, the DB reflects the latest data. This is correct behavior — we always want the most recent official scores.

- **If a refresh fails mid-way through upserting golfers**, the partial writes remain. The next successful refresh will overwrite with the latest data. Partial state is ugly but not correctness-breaking because the external API is the source of truth.

---

## API Changes

### No New Endpoints

The existing `POST /api/scoring` and `POST /api/scoring/refresh` continue to work. The locking mechanism is an implementation detail behind these endpoints.

### Response Changes

No changes to request/response shapes. The locking and telemetry are internal to the server.

---

## Error Handling

### Lock Acquisition Failure

If `acquireRefreshLock` returns `acquired: false`:
- The refresh returns `409 Conflict` with `code: 'REFRESH_LOCKED'`
- The leaderboard route interprets this as "refresh already in progress by another instance"

### Lock Expiry

If a lock has expired (holder crashed):
- New instance can claim the lock
- The `expires_at` check is part of the acquisition algorithm

### Telemetry on Error

If refresh fails, record:
- `last_refresh_error` with the error message
- `last_refresh_attempt_at` was already set at attempt start

---

## Testing Strategy

### Unit Tests

1. **Lock acquisition/release**: `src/lib/__tests__/scoring-lock.test.ts`
   - Happy path: acquire → hold → release
   - Conflict: acquire by A, try acquire by B → B fails
   - Expiry: A acquires, TTL passes, B can acquire

2. **Pool state transitions**: `src/lib/__tests__/pool-state-transitions.test.ts`
   - open → live when deadline passes
   - live → complete when tournament ends
   - Invalid transitions are rejected

3. **Telemetry recording**: `src/lib/__tests__/refresh-telemetry.test.ts`
   - Attempt count increments
   - Success vs failure metadata

### Integration Tests

4. **Concurrent refresh**: Two simultaneous calls to `/api/scoring/refresh` with the same pool — only one succeeds, the other gets 409.

5. **Repeated execution safety**: Run refresh twice in succession — second run succeeds and produces same results as first.

---

## Out of Scope

- Provider replacement (different external scoring API)
- UI redesign beyond status visibility (OPS-55 covers this)
- Non-MVP workflow expansion
- Changing the scoring algorithm (hole-by-hole vs round-level)
- Per-pool configurable thresholds

---

## Spec Coverage Check

- DB-level locking: Replace in-memory mutex, new `refresh_locks` table, lock acquisition/release functions
- Idempotent refresh: Already satisfied by existing upsert behavior; documented for clarity
- Pool state transitions: Transition functions with test coverage
- Refresh telemetry: New columns, update functions, audit trail events
- Integration tests: Lock conflict, repeated execution

---

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers
- All SQL references concrete table names and column types
- All TypeScript interfaces reference existing types or explicitly new ones

---

## Type Consistency Check

- New Pool fields: `last_refresh_success_at`, `refresh_attempt_count`, `last_refresh_attempt_at`
- `RefreshResult` in `scoring-refresh.ts` unchanged — telemetry is side-effect-only
- `refresh_locks` table has independent schema — no conflicts with existing tables
