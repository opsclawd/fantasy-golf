# Fantasy Golf — Risk Register

**Date:** 2026-04-16
**Author:** Architecture Lead
**Status:** Complete

## Purpose

This risk register captures technical risks, architectural concerns, and known limitations discovered during the brownfield architecture mapping exercise (OPS-7). It is intended to inform the Implementation Engineer and Review/QA Gate about areas requiring careful attention.

---

## Risk Register

### R-01: `isUpdating` Mutex Is Not Serverless-Safe

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `src/app/api/scoring/route.ts`, `src/app/api/scoring/refresh/route.ts` |
| **Category** | Concurrency |
| **Status** | Known Limitation (Documented) |

#### Description

Both scoring endpoints use a module-level `isUpdating: boolean` flag to prevent concurrent refreshes. This pattern assumes a single Node.js event loop shared across all requests — which is true for Node.js servers but **not** for serverless functions (Vercel, AWS Lambda, etc.).

In serverless environments, each request may run in a different isolate with its own event loop and its own copy of the module-level variable. This means:
- Concurrent refresh requests for the **same pool** could both see `false` and both proceed
- Concurrent refresh requests for **different pools** could incorrectly block each other if they happen to share an isolate

#### Current Mitigation

- Upserts are idempotent; concurrent refreshes produce the same result
- Worst case: redundant API calls to Slash Golf, no data corruption
- Documented in `docs/solutions/workflow-issues/on-demand-scoring-refresh-2026-04-08.md`

#### Recommended Action

If high reliability is required in serverless deployments, replace with a distributed lock:
- Supabase advisory lock via `SELECT pg_advisory_lock()`
- Or a dedicated `refresh_locks` table with row-level locking

#### Verification

- Grep for `isUpdating` — both occurrences must be replaced or augmented with distributed locking
- Load test concurrent scoring refresh requests under serverless emulated environment

---

### R-02: Timezone/Deadline DST Edge Case

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `src/lib/picks.ts` |
| **Category** | Logic Error |
| **Status** | Fixed (Prior Bug) |

#### Description

`getTournamentLockInstant()` computes when a pool should lock based on a date-only deadline string (YYYY-MM-DD) interpreted in the pool's timezone. The iterative computation in `getTournamentLockInstant()` handles DST transitions by recomputing the offset up to 3 times until stable.

A prior bug (`pool-deadline-locking-respects-pool-timezone-2026-04-08.md`) was caused by assuming UTC midnight was the lock time regardless of timezone.

#### Current State

Fixed. The solution uses `Intl.DateTimeFormat` to get the timezone offset and iteratively converges on the correct instant. The `shouldAutoLock()` function uses the same logic.

#### Verification

- Unit tests in `src/lib/__tests__/` covering DST transitions
- Specifically: pool locks correctly in America/New_York ( EDT/EST transitions)

---

### R-03: Concurrent Entry Upserts — Race Condition Window

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `src/lib/entry-queries.ts` |
| **Category** | Race Condition |
| **Status** | Mitigated |

#### Description

`upsertEntry()` uses `onConflict: 'pool_id,user_id'` which is an upsert (insert or update). If a user rapidly double-clicks the submit button, two concurrent requests could:
1. Both read the same entry (or null)
2. Both attempt to upsert

The UNIQUE constraint on `(pool_id, user_id)` prevents duplicate rows. The upsert will succeed for one and fail or silently no-op for the other. The `updated_at` timestamp will be refreshed on success.

#### Mitigation

- `updated_at` is refreshed on every upsert, so the user's entry reflects their most recent submission
- The duplicate submission issue is a UX problem, not a data integrity problem

#### Recommended Action

Consider adding idempotency keys to pick submission, or debouncing the submit button on the client side.

---

### R-04: Soft Delete vs Hard Delete Inconsistency

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `src/lib/pool-queries.ts` |
| **Category** | Data Integrity |

#### Description

`pool_deletions` table was added for soft delete (see `20260408183000_add_archived_pools_and_pool_deletions.sql`), but `deletePoolById()` in `pool-queries.ts` performs a **hard delete** from the `pools` table. This is inconsistent:
- `archivePoolButton.tsx` likely calls a soft-delete path (unclear from current code)
- `deletePoolById()` bypasses `pool_deletions`

#### Recommended Action

- Verify which code path actually deletes pools
- Ensure soft-delete is used for commissioner-initiated deletions
- Ensure `pool_deletions` record is written before or instead of hard delete

---

### R-05: Tournament Roster RLS May Block Read Access

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `supabase/migrations/20260408110000_add_tournament_golfers_rls.sql` |
| **Category** | RLS / Permissions |

#### Description

Tournament golfers (the roster of who is playing in a given tournament) has its own RLS policy. If misconfigured, the leaderboard API (`getTournamentRosterGolfers` in `src/lib/tournament-roster/queries.ts`) could fail to fetch golfer names for display, causing entries to show golfer IDs instead of names.

#### Verification

- Run leaderboard API test for a pool with entries
- Verify golfer names are populated in response
- Check RLS policies in Supabase dashboard

---

### R-06: External API Failures Surface as Stale Data

| Field | Value |
|-------|
| **Severity** | Low |
| **Component** | `src/lib/scoring-refresh.ts` |
| **Category** | Reliability |

#### Description

If Slash Golf API is down or returns errors:
- `refreshScoresForPool` returns `{ error: { code: 'FETCH_FAILED', message } }`
- `pool.last_refresh_error` is updated with the error message
- `pool.refreshed_at` is NOT updated (remains at last successful time)
- Client sees `freshness: 'stale'` and `lastRefreshError: errorMessage`

This is the intended behavior (honest staleness), but users may not understand why scores haven't updated.

#### Current Mitigation

`TrustStatusBar` component surfaces `lastRefreshError` to users.

---

### R-07: Single Live Pool Assumption in Cron

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `src/app/api/scoring/route.ts` |
| **Category** | Architecture |

#### Description

`getActivePool()` returns only ONE live pool (`limit(1).maybeSingle()`). If multiple pools are simultaneously in 'live' status (different tournaments, same or different users), only one will be refreshed per cron run.

However, `refreshScoresForPool` does call `getPoolsByTournament()` to find ALL live pools for the same tournament and refreshes all of them together. The bottleneck is that `getActivePool()` picks only one tournament to process per run.

#### Recommended Action

- If multiple simultaneous live tournaments are a use case, cron should fan out by all live pools, not just the first one
- Alternatively, use on-demand refresh triggered by leaderboard requests (already implemented)

---

### R-08: No Rate Limiting on Scoring Endpoints

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `src/app/api/scoring/route.ts`, `src/app/api/scoring/refresh/route.ts` |
| **Category** | Security / DoS |

#### Description

Scoring endpoints (`POST /api/scoring`, `POST /api/scoring/refresh`) have no rate limiting. An attacker or misbehaving client could hammer these endpoints, causing:
- Excessive Slash Golf API calls (potential rate limiting from Rapid API)
- Excessive database writes
- Excessive Supabase Realtime broadcasts

#### Mitigation

- Endpoints require `CRON_SECRET` bearer token
- Token is not exposed to client (only server-to-server)
- However, if token is compromised, no additional protection exists

#### Recommended Action

Consider adding rate limiting via Vercel Edge Config, Upstash Rate Limit, or Supabase-level rate limiting.

---

### R-09: `golfer_ids` TEXT[] Has No FK Constraint

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | Schema, `entries` table |
| **Category** | Data Integrity |

#### Description

`entries.golfer_ids` is a `TEXT[]` array of golfer IDs. There is no foreign key constraint ensuring those IDs actually exist in the `golfers` table. A buggy or malicious client could submit arbitrary strings as golfer IDs.

#### Mitigation

- Picks are validated against the tournament roster before submission (via autocomplete, which fetches from `tournament_golfers`)
- `validatePickSubmission()` only checks count, uniqueness, and lock state — not ID validity

#### Recommended Action

Add a trigger or check constraint to validate that all golfer_ids in an entry exist in `golfers` or `tournament_golfers`.

---

### R-10: Audit Events Written Asynchronously Could Be Lost

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Component** | `src/lib/pool-queries.ts`, `src/lib/scoring-refresh.ts` |
| **Category** | Reliability |

#### Description

Audit events are written with fire-and-forget patterns in some places (e.g., in `refreshScoresForPool`, the broadcast + audit write are awaited but errors are not propagated to the caller). If an audit write fails, the error is silently ignored in some paths.

#### Current State

Most audit writes properly await and log errors. The scoring-refresh path is the most critical and does await audit writes.

---

### R-11: README vs Code Inconsistency

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Component** | `README.md`, `CLAUDE.md`, schema files |
| **Category** | Documentation |

#### Description

Multiple documentation inconsistencies found:
1. README references `src/lib/db/schema.sql` as schema source; actual schema is in `supabase/migrations/`
2. README describes "hole-by-hole scoring" but system is round-based
3. README describes "hourly UTC dispatcher" but cron is external → `/api/cron/scoring`
4. `CLAUDE.md` is more accurate than `README.md` in most respects

#### Recommended Action

This is the primary output of OPS-7 (this task). Update README to match actual architecture.

---

## Summary Table

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| R-01 | isUpdating mutex not serverless-safe | Medium | Known Limitation |
| R-02 | Timezone/Deadline DST edge case | Medium | Fixed (Prior Bug) |
| R-03 | Concurrent entry upserts race | Low | Mitigated |
| R-04 | Soft delete vs hard delete inconsistency | Medium | Needs Verification |
| R-05 | Tournament roster RLS may block reads | Medium | Needs Verification |
| R-06 | External API failures → stale data | Low | By Design |
| R-07 | Single live pool in cron assumption | Medium | Known Limitation |
| R-08 | No rate limiting on scoring endpoints | Low | Mitigated by auth |
| R-09 | golfer_ids has no FK constraint | Low | Mitigated by UX |
| R-10 | Audit events could be lost | Low | Mostly Mitigated |
| R-11 | README vs code inconsistency | Medium | This Task |

---

## Next Steps

1. **R-11**: Update README to match current architecture (OPS-8 owner)
2. **R-04**: Verify delete flow consistency
3. **R-05**: Test leaderboard golfer name display with RLS
4. **R-01**: Consider distributed lock if deploying to serverless
