# Fantasy Golf Smoke Matrix

**Project:** fantasy-golf  
**Artifact:** `docs/qa/fantasy-golf-smoke-matrix.md`  
**Date:** 2026-04-16  
**Status:** Draft

## Overview

This document maps each product flow to its implementation surface and defines smoke-level verification criteria. Each flow has a human-readable test case that can be executed manually or encoded as an automated Playwright test.

---

## Flow 1: Auth

### Description
Users sign up and sign in via Supabase Auth. Protected routes redirect unauthenticated users to sign-in.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/app/(auth)/sign-in/actions.ts` | Server action for `signIn()` |
| `src/app/(auth)/sign-up/actions.ts` | Server action for `signUp()` |
| `src/lib/supabase/server.ts` | Supabase server client |
| `src/app/(app)/layout.tsx` | Auth guard for protected routes |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| AUTH-1 | Sign in with valid credentials | User is redirected to `/participant/pools` | `signIn()` in `actions.ts` calls `redirect()` on success |
| AUTH-2 | Sign in with invalid credentials | Returns `{ error: error.message }` | `signIn()` returns error without redirect |
| AUTH-3 | Sign in with safe redirect path | Redirects to `redirectTo` if it starts with `/` | `getSafeRedirectPath()` validates prefix |
| AUTH-4 | Access authenticated route without session | Redirects to `/sign-in` | `createClient()` in server layout checks auth |
| AUTH-5 | Sign up creates user | Supabase creates user record | `signUp()` in `actions.ts` |

### Notes
- Auth errors are surfaced inline via `useFormState`
- Redirect after sign-in goes to `/participant/pools` or specified `redirectTo`

---

## Flow 2: Commissioner Pool Creation

### Description
A commissioner creates a pool by filling a form with tournament details, deadline, timezone, and format. The system generates an invite code and logs an audit event.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/app/(app)/commissioner/actions.ts` | `createPool()` server action |
| `src/lib/pool.ts` | `validateCreatePoolInput()`, `generateInviteCode()` |
| `src/lib/pool-queries.ts` | `insertPool()`, `insertPoolMember()`, `insertAuditEvent()` |
| `src/lib/supabase/types.ts` | Pool types and enums |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| POOL-CREATE-1 | Create pool with all required fields | Pool created, status `open`, redirected to commissioner pool page | `insertPool()` called with correct payload |
| POOL-CREATE-2 | Empty pool name rejected | Returns error: "Pool name is required." | `validateCreatePoolInput()` trims and checks |
| POOL-CREATE-3 | Missing tournament ID rejected | Returns error: "Tournament selection is required." | `validateCreatePoolInput()` checks `tournamentId` |
| POOL-CREATE-4 | Missing deadline rejected | Returns error: "Picks deadline is required." | `validateCreatePoolInput()` checks `deadline` |
| POOL-CREATE-5 | Missing timezone rejected | Returns error: "Timezone is required." | `validateCreatePoolInput()` validates IANA timezone |
| POOL-CREATE-6 | Past deadline rejected | Returns error: "Picks deadline must be in the future." | `getTournamentLockInstant()` compared to `new Date()` |
| POOL-CREATE-7 | Invalid timezone rejected | Returns error: "Timezone must be a valid IANA timezone." | `Intl.DateTimeFormat` validation in `validateCreatePoolInput()` |
| POOL-CREATE-8 | Invite code generated | 8-character alphanumeric code exists on pool | `generateInviteCode()` uses `crypto.getRandomValues()` |
| POOL-CREATE-9 | Commissioner added as member | `pool_members` row created with role `commissioner` | `insertPoolMember()` called |
| POOL-CREATE-10 | Audit event logged | `audit_events` row created with action `poolCreated` | `insertAuditEvent()` called |

### Notes
- Pool name max 100 characters
- Deadline is stored as ISO string; lock instant computed from deadline + timezone
- Only `best_ball` format currently supported

---

## Flow 3: Participant Pool Join / Pick Workflow

### Description
A participant joins a pool using an invite code and submits golfer picks.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/app/join/[inviteCode]/actions.ts` | `joinPool()` server action |
| `src/app/(app)/participant/picks/[poolId]/actions.ts` | `submitPicks()` server action |
| `src/lib/picks.ts` | `validatePickSubmission()`, `isPoolLocked()` |
| `src/lib/pool-queries.ts` | `insertPoolMember()`, `insertAuditEvent()` |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| JOIN-1 | Join with valid invite code | User added to `pool_members` with role `player` | `insertPoolMember()` called |
| JOIN-2 | Join archived pool rejected | Returns error: "This pool is archived and can no longer accept new members." | `joinPool()` checks `pool.status === 'archived'` |
| JOIN-3 | Join non-existent pool rejected | Returns error: "This invite link is invalid or expired." | Pool lookup returns no results |
| JOIN-4 | Already member redirected | Existing member redirected to picks page | `redirect()` called for existing membership |
| PICK-1 | Submit valid picks (4 golfers) | Entry created with 4 golfer IDs | `submitPicks()` validates count |
| PICK-2 | Submit duplicate golfers rejected | Returns error: "Duplicate golfer selections are not allowed." | `validatePickSubmission()` checks `Set` uniqueness |
| PICK-3 | Submit wrong count rejected | Returns error: "Please select exactly N golfers." | `validatePickSubmission()` compares length to `picksPerEntry` |
| PICK-4 | Submit after lock rejected | Returns error: "This pool is locked. Picks can no longer be changed." | `validatePickSubmission()` checks `isLocked` |
| PICK-5 | Submit empty golfer ID rejected | Returns error: "Invalid golferIds: all IDs must be non-empty strings." | `validatePickSubmission()` checks trim |

### Notes
- Picks locked when: `status !== 'open'` OR `lockAt <= now`
- Lock instant computed via `getTournamentLockInstant(deadline, timezone)`

---

## Flow 4: Lock Behavior Around Deadline/Timezone

### Description
Pool picks lock automatically when the tournament deadline passes in the configured timezone.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/lib/picks.ts` | `getTournamentLockInstant()`, `isPoolLocked()`, `isCommissionerPoolLocked()`, `shouldAutoLock()` |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| LOCK-1 | Pool locked after deadline | `isPoolLocked()` returns `true` when deadline passed | `lockAt.getTime() <= now.getTime()` |
| LOCK-2 | Pool open before deadline | `isPoolLocked()` returns `false` when deadline in future | `status === 'open' && lockAt > now` |
| LOCK-3 | Lock computed correctly for timezone | Lock instant = UTC midnight - timezone offset | `getTimezoneOffsetMillis()` computes offset |
| LOCK-4 | Lock at local midnight on deadline date | e.g., deadline `2026-04-17` in `America/New_York` locks at `2026-04-17 04:00 UTC` | Iterative offset refinement in `getTournamentLockInstant()` |
| LOCK-5 | Commissioner locked out after deadline | `isCommissionerPoolLocked()` returns `true` after lock | `status !== 'open' \|\| lockAt <= now` |
| LOCK-6 | Pool auto-lock when deadline passes | `shouldAutoLock()` returns `true` for open pool past deadline | `shouldAutoLock()` checks `now >= lockAt` |

### Notes
- Lock is boundary: once `lockAt.getTime() <= now.getTime()`, pool is locked
- Commissioner can still transition pool to `live` status via `startPool()` but not edit picks

---

## Flow 5: Scoring Refresh Path

### Description
Scores are refreshed via cron job (hourly) or on-demand. The system fetches from Slash Golf API, upserts to Supabase, broadcasts ranked leaderboard, and logs audit events.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/app/api/cron/scoring/route.ts` | Cron endpoint `/api/cron/scoring` |
| `src/lib/scoring-refresh.ts` | `refreshScoresForPool()` core logic |
| `src/lib/slash-golf/client.ts` | `getTournamentScores()` API client |
| `src/lib/scoring-queries.ts` | `upsertTournamentScore()`, `getScoresForTournament()` |
| `src/lib/audit.ts` | `buildRefreshAuditDetails()` |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| SCORE-1 | Cron endpoint exists | `GET/POST /api/cron/scoring` returns 200 | Route handler defined |
| SCORE-2 | Scoring fetches from Slash Golf | `getTournamentScores()` called with `tournament_id` and `year` | `refreshScoresForPool()` calls external API |
| SCORE-3 | Scores upserted to DB | `upsertTournamentScore()` writes to `tournament_scores` | Batch upsert in loop |
| SCORE-4 | Per-round data preserved | `tournament_score_rounds` updated via `golferScore.rounds` | `upsertTournamentScore()` writes rounds array |
| SCORE-5 | Pool `refreshed_at` updated | `updatePoolRefreshMetadata()` called with `refreshedAt` | Success path updates metadata |
| SCORE-6 | Leaderboard broadcast sent | `supabase.channel('pool_updates').send()` broadcasts ranked | Realtime broadcast in refresh loop |
| SCORE-7 | Audit event logged on success | `insertAuditEvent()` with action `scoreRefreshCompleted` | Audit logged per live pool |
| SCORE-8 | API failure handled gracefully | `last_refresh_error` updated, audit event with `scoreRefreshFailed` | Error path in `refreshScoresForPool()` |
| SCORE-9 | Partial upsert failure handled | Continues with partial failures logged | `upsertFailures` array accumulated |

### Notes
- Cron runs hourly UTC; dispatcher fan-out by tournament
- Each scoring refresh broadcasts to all live pools for that tournament
- `completedRounds` computed as `Math.max(...slashScores.map(s => s.current_round ?? s.rounds?.length ?? 0))`

---

## Flow 6: Spectator Leaderboard Behavior

### Description
Public leaderboard view accessible without authentication. Shows scores and trust status.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/app/spectator/pools/[poolId]/page.tsx` | Spectator page component |
| `src/components/leaderboard.tsx` | `Leaderboard` component |
| `src/components/TrustStatusBar.tsx` | Trust and freshness indicator |
| `src/lib/freshness.ts` | `classifyFreshness()` |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| SPECT-1 | Spectator page accessible without auth | Page renders for unauthenticated user | No auth check in spectator page |
| SPECT-2 | 404 for non-existent pool | `notFound()` called when pool missing | `getPoolById()` returns null |
| SPECT-3 | Trust status bar shown for live pool | `TrustStatusBar` rendered for `status === 'live'` | Conditional in spectator page |
| SPECT-4 | Trust status bar shown for completed pool | `TrustStatusBar` rendered for `status === 'complete'` | Conditional in spectator page |
| SPECT-5 | Trust status bar shown for archived pool | `TrustStatusBar` rendered for `status === 'archived'` | Conditional in spectator page |
| SPECT-6 | No trust bar for open pool | `TrustStatusBar` hidden when `status === 'open'` | Conditional excludes `open` |
| SPECT-7 | Freshness displayed | `classifyFreshness()` categorizes `refreshed_at` | Used in `TrustStatusBar` |

### Notes
- Spectator URL: `/spectator/pools/{poolId}`
- Status chip shown regardless of status

---

## Flow 7: Archived / Reopen / Delete Rules

### Description
Pool lifecycle: `open` → `live` → `complete` → `archived`. Commissioner can reopen from `live`/`complete` if deadline hasn't passed. Delete allowed from `open` or `archived`.

### Implementation Surface

| File | Purpose |
|------|---------|
| `src/lib/pool.ts` | `canTransitionStatus()`, `canReopenPool()` |
| `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | `archivePool()`, `reopenPool()`, `deletePool()` |
| `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` | Archive UI |
| `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` | Reopen UI |
| `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` | Delete UI |
| `src/lib/pool-queries.ts` | `updatePoolStatus()`, `recordPoolDeletion()`, `deletePoolById()` |

### Smoke Tests

| ID | Test Case | Acceptance Criterion | Verified By |
|----|-----------|---------------------|-------------|
| LIFECYCLE-1 | Open → Live transition | `startPool()` succeeds, status changes | `updatePoolStatus()` called with `live` |
| LIFECYCLE-2 | Live → Complete transition | `closePool()` succeeds | `canTransitionStatus('live', 'complete')` |
| LIFECYCLE-3 | Complete → Archived transition | `archivePool()` succeeds for `complete` pools | `canTransitionStatus('complete', 'archived')` |
| LIFECYCLE-4 | Archive only from complete | Archive button only shown for `complete` | UI conditionally rendered |
| LIFECYCLE-5 | Reopen from live if deadline future | `reopenPool()` succeeds | `canReopenPool()` checks deadline |
| LIFECYCLE-6 | Reopen from complete if deadline future | `reopenPool()` succeeds | `canReopenPool()` allows `complete` |
| LIFECYCLE-7 | Cannot reopen if deadline passed | Returns error: "deadline has passed" | `canReopenPool()` returns false |
| LIFECYCLE-8 | Delete only open or archived | `deletePool()` succeeds for `open` or `archived` | Status check in `deletePool()` |
| LIFECYCLE-9 | Cannot delete live pool | `deletePool()` blocked for `live` status | Status check in `deletePool()` |
| LIFECYCLE-10 | Deletion creates tombstone | `recordPoolDeletion()` called before hard delete | Tombstone preserved for recovery |
| LIFECYCLE-11 | Only commissioner can archive/reopen/delete | Auth check on user vs `pool.commissioner_id` | Action functions check ownership |

### Notes
- Status transitions: `open → live → complete → archived`
- `complete` can also transition back to `open` (via reopen)
- Archived pools are read-only and reject new join attempts (see JOIN-2)

---

## Test Execution Summary

| Flow | Test Count | Manual | Automated |
|------|-----------|--------|-----------|
| Auth | 5 | ✓ | Vitest unit tests |
| Commissioner Pool Creation | 10 | ✓ | Unit tests in `src/lib/__tests__/pool.test.ts` |
| Participant Join / Pick | 9 | ✓ | Unit tests in `src/lib/__tests__/picks.test.ts` |
| Lock Behavior | 6 | ✓ | Unit tests in `src/lib/__tests__/picks.test.ts` |
| Scoring Refresh | 9 | Partial | Unit tests in `src/lib/__tests__/scoring-refresh.test.ts` |
| Spectator Leaderboard | 7 | ✓ | Component rendering tests |
| Lifecycle (Archive/Reopen/Delete) | 11 | ✓ | Unit tests in `src/app/(app)/commissioner/pools/[poolId]/__tests__/` |

---

## Gaps and Recommendations

1. **No Playwright E2E tests**: Current test suite is unit/integration only. Playwright tests should be added for:
   - Full auth flow (sign-up → sign-in → sign-out)
   - Commissioner creates pool → shares invite → participant joins → submits picks
   - Deadline lock simulation
   - Spectator views leaderboard without auth

2. **Cron scoring not end-to-end tested**: The cron path (`/api/cron/scoring`) lacks integration tests with mocked Supabase and Slash Golf.

3. **Timezone lock edge cases**: Lock behavior at DST boundaries should be explicitly tested.

4. **Real-time subscription tests**: Leaderboard broadcast via Supabase Realtime is not covered by unit tests.

---

## Verification Status

| Flow | Status | Notes |
|------|--------|-------|
| Auth | ✅ Implemented | Unit tests exist |
| Commissioner Pool Creation | ✅ Implemented | Unit tests exist |
| Participant Join / Pick | ✅ Implemented | Unit tests exist |
| Lock Behavior | ✅ Implemented | Unit tests exist |
| Scoring Refresh | ✅ Implemented | Unit tests exist |
| Spectator Leaderboard | ✅ Implemented | Component tests exist |
| Lifecycle | ✅ Implemented | Unit tests exist |
