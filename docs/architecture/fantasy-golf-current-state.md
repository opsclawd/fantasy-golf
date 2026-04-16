# Fantasy Golf — Current Architecture State

**Date:** 2026-04-16
**Author:** Architecture Lead
**Status:** Complete

## Overview

Fantasy Golf Pool is a commissioner-first web app for running private golf pools with live round-by-round scoring. Commissions create pools, participants submit 4-golfer best-ball entries, and spectators view a public leaderboard.

**Stack:** Next.js 14 (App Router) + Supabase (PostgreSQL + Auth + Real-time) + Slash Golf API

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Backend | Next.js API Routes (Route Handlers) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime Subscriptions |
| External API | Slash Golf (Rapid API) — tournament scores and schedules |
| Styling | Tailwind CSS |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Sign in / Sign up flows
│   ├── (app)/               # Authenticated routes (requires auth)
│   │   ├── commissioner/     # Commissioner dashboard + pool management
│   │   └── participant/      # Participant picks submission
│   ├── spectator/           # Public leaderboard (no auth)
│   ├── join/                # Pool join flow (invite code)
│   └── api/                 # Route handlers
│       ├── scoring/         # POST /api/scoring (cron trigger)
│       │   └── refresh/     # POST /api/scoring/refresh (on-demand)
│       ├── leaderboard/     # GET /api/leaderboard/[poolId]
│       ├── cron/
│       │   └── scoring/     # GET /api/cron/scoring (external cron dispatcher)
│       └── tournaments/     # GET /api/tournaments
├── components/             # Shared React components
└── lib/
    ├── supabase/           # client.ts, server.ts, admin.ts, types.ts
    ├── slash-golf/         # API client + types for Slash Golf
    ├── scoring.ts          # Pure best-ball scoring logic
    ├── scoring-queries.ts  # DB queries for tournament_scores + tournament_score_rounds
    ├── scoring-refresh.ts  # Shared refresh orchestration
    ├── pool-queries.ts     # Pool CRUD + pool_members + audit_events
    ├── entry-queries.ts    # Entry CRUD + member pools query
    ├── picks.ts            # Pick validation + lock logic + deadline timezone handling
    ├── freshness.ts        # Freshness classification (current/stale/unknown)
    ├── audit.ts            # Audit trail computation
    ├── golfer-detail.ts   # Golfer scorecard formatting
    └── db/                 # schema.sql (legacy), seed.sql
supabase/
├── migrations/             # Timestamp-prefixed SQL migrations
└── config.toml             # Supabase CLI config
docs/
├── solutions/              # Compound engineering solution docs
└── superpowers/            # BMAD workflow artifacts
```

---

## Supabase Data Model

### Core Tables

#### `pools`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `commissioner_id` | UUID | FK → auth.users |
| `name` | TEXT | Pool display name |
| `tournament_id` | TEXT | External Slash Golf tournament ID |
| `tournament_name` | TEXT | |
| `year` | INTEGER | Tournament year |
| `deadline` | TIMESTAMPTZ | ISO string — date only (YYYY-MM-DD), interpreted in pool timezone |
| `timezone` | TEXT | IANA timezone string (e.g., "America/New_York") |
| `format` | TEXT | Always 'best_ball' |
| `picks_per_entry` | INTEGER | Default 4 |
| `invite_code` | TEXT | Unique, used for pool join |
| `status` | TEXT | 'open' \| 'live' \| 'complete' |
| `refreshed_at` | TIMESTAMPTZ | Last successful score refresh |
| `last_refresh_error` | TEXT | Error message from last failed refresh |
| `created_at` | TIMESTAMPTZ | |

#### `pool_members`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `pool_id` | UUID | FK → pools |
| `user_id` | UUID | FK → auth.users |
| `role` | TEXT | 'commissioner' \| 'player' |
| `joined_at` | TIMESTAMPTZ | |
| | | UNIQUE(pool_id, user_id) |

#### `entries`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `pool_id` | UUID | FK → pools |
| `user_id` | UUID | FK → auth.users |
| `golfer_ids` | TEXT[] | Array of golfer IDs (picks) |
| `total_birdies` | INTEGER | Tiebreaker metric |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| | | UNIQUE(pool_id, user_id) |

#### `golfers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT | PK — Slash Golf golfer ID |
| `name` | TEXT | |
| `country` | TEXT | |

#### `tournament_scores`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `golfer_id` | TEXT | FK → golfers |
| `tournament_id` | TEXT | |
| `round_id` | INTEGER | Latest completed round |
| `total_score` | INTEGER | Stroke total (lower = better) |
| `position` | TEXT | Current position (e.g., "1", "T2") |
| `total_birdies` | INTEGER | |
| `status` | TEXT | 'active' \| 'withdrawn' \| 'cut' |
| `updated_at` | TIMESTAMPTZ | |
| | | UNIQUE(golfer_id, tournament_id) |

#### `tournament_score_rounds`
| Column | Type | Notes |
|--------|------|-------|
| `golfer_id` | TEXT | PK composite |
| `tournament_id` | TEXT | PK composite |
| `round_id` | INTEGER | PK composite |
| `strokes` | INTEGER | |
| `score_to_par` | INTEGER | |
| `course_id` | TEXT | |
| `course_name` | TEXT | |
| `round_status` | TEXT | |
| `position` | TEXT | |
| `total_score` | INTEGER | |
| ... full round snapshot from API | | |
| | | UNIQUE(golfer_id, tournament_id, round_id) |

#### `audit_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `pool_id` | UUID | FK → pools |
| `user_id` | UUID | FK → auth.users (nullable) |
| `action` | TEXT | e.g., 'scoreRefreshCompleted', 'entryLocked', 'poolCreated' |
| `details` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

### Indexes
```sql
CREATE INDEX idx_pools_commissioner_id ON pools(commissioner_id);
CREATE INDEX idx_pools_invite_code ON pools(invite_code);
CREATE INDEX idx_pool_members_pool_id ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user_id ON pool_members(user_id);
CREATE INDEX idx_entries_pool_id ON entries(pool_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_tournament_scores_tournament ON tournament_scores(tournament_id);
CREATE INDEX idx_audit_events_pool_id ON audit_events(pool_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
```

---

## Key Flow: Commissioner Create Pool

1. **Commissioner** navigates to `/commissioner`
2. **CreatePoolForm.tsx** — commissioner selects tournament from Slash Golf API (`/api/tournaments`), sets deadline date/time in their timezone
3. **Server Action** (`src/app/(app)/commissioner/actions.ts`) calls:
   - `insertPool()` → creates pool in `pools` table
   - `insertPoolMember()` → adds commissioner as 'commissioner' role in `pool_members`
4. Pool gets a unique `invite_code` (generated client-side before insert)
5. **Audit event** written: `poolCreated`

### Commissioner's Pool Configuration (`PoolConfigForm.tsx`)
- Can modify: tournament_id, tournament_name, year, deadline, timezone, picks_per_entry
- Cannot modify: invite_code, commissioner_id, format
- Changing tournament_id does NOT automatically fetch new golfer roster

---

## Key Flow: Invite / Membership

### Joining a Pool
1. **Unauthenticated user** visits `/join?code=XXXX` or enters invite code
2. Pool is looked up by `invite_code` via `getPoolByInviteCode()` in `pool-queries.ts`
3. If pool exists and is 'open', user can sign up or sign in
4. After auth, `insertPoolMember()` adds user as 'player' role
5. **Audit event** written: `memberJoined`

### Invite Link Display
- Commissioner dashboard shows pool's invite code + URL
- User copies invite link and shares

### Membership Query
- `getPoolsForMember()` in `entry-queries.ts` returns all pools a user belongs to via `pool_members`
- Filters out 'archived' status pools

---

## Key Flow: Participant Entry (Picks)

1. **Participant** navigates to `/participant/picks/[poolId]`
2. Page loads pool config (`getPoolById`) and existing entry (`getEntryByPoolAndUser`)
3. **Lock check**: `isPoolLocked()` in `picks.ts` — compares pool.status ('open') and deadline + timezone against `Date.now()`
4. User selects 4 golfers (or `picks_per_entry`) from autocomplete search
5. **Submit action** (`src/app/(app)/participant/picks/[poolId]/actions.ts`):
   - `validatePickSubmission()` checks lock state, golfer count, duplicates
   - `upsertEntry()` writes to `entries` table (UNIQUE on pool_id + user_id)
   - If entry already exists, `updated_at` is refreshed
6. **Audit event** written: `entrySubmitted` (or `entryUpdated`)

### Lock Behavior
- **Auto-lock**: When deadline passes, `POST /api/scoring` calls `getOpenPoolsPastDeadline()` and transitions those pools to 'live' status
- **Lock check is client-side AND server-side**:
  - Client shows/hides form based on `isPoolLocked()`
  - Server action re-validates `isLocked` before accepting submission

---

## Key Flow: Scoring Refresh

### Trigger Points (two mechanisms)

#### 1. Cron Job (external)
- Supabase cron or external scheduler calls `GET /api/cron/scoring`
- `/api/cron/scoring/route.ts` fetches `POST /api/scoring` on the app
- **Purpose**: Reliable background refresh on a schedule

#### 2. On-Demand (server-triggered)
- Client or browser requests `GET /api/leaderboard/[poolId]`
- Leaderboard route checks `classifyFreshness(pool.refreshed_at)` — threshold is 15 minutes
- If stale AND pool.status === 'live', triggers fire-and-forget `POST /api/scoring/refresh`
- **Purpose**: Near-real-time freshness without polling

### Scoring Refresh Pipeline (`refreshScoresForPool` in `scoring-refresh.ts`)

1. Fetch scores from Slash Golf API (`getTournamentScores`)
2. For each golfer score:
   - Write round-by-round data to `tournament_score_rounds` (append-only, upsert by golfer_id+tournament_id+round_id)
   - Write latest state to `tournament_scores` (upsert by golfer_id+tournament_id)
3. Update `pool.refreshed_at` and clear `last_refresh_error`
4. Compute rankings via `rankEntries()`
5. Broadcast ranked leaderboard via Supabase Realtime channel `pool_updates`
6. Write `scoreRefreshCompleted` audit event

### Scoring Logic (`scoring.ts`)
- `calculateEntryTotalScore()` — best-ball (minimum stroke total among 4 golfers per completed round)
- `calculateEntryBirdies()` — sum of birdies for tiebreaker
- `deriveCompletedRounds()` — max round_id from scores
- `rankEntries()` — full ranking with tie handling

---

## Key Flow: Cron Trigger

### External Cron → `/api/cron/scoring`
```
External Cron → GET /api/cron/scoring → POST /api/scoring
```

`/api/cron/scoring/route.ts` is a thin proxy:
- Reads `NEXT_PUBLIC_APP_URL` env var
- Forwards to `/api/scoring` with `CRON_SECRET` bearer token

### Cron Job Logic (`POST /api/scoring`)
1. **Auto-lock**: `getOpenPoolsPastDeadline()` finds pools where deadline has passed
2. Transitions each from 'open' → 'live' and writes `entryLocked` audit event
3. Finds the single 'live' pool via `getActivePool()`
4. Calls `refreshScoresForPool()` for that pool

**Important**: Only ONE live pool is refreshed per cron run. All pools for the same tournament are refreshed together because `refreshScoresForPool` finds all live pools for the tournament and refreshes all their entries.

---

## Leaderboard API (`GET /api/leaderboard/[poolId]`)

### Freshness Model
- Reads `pool.refreshed_at`
- `classifyFreshness()` returns: 'current' (≤15m), 'stale' (>15m), 'unknown' (null)
- If stale and pool is live, triggers background refresh
- Returns `isRefreshing: true` only when a refresh was triggered AND no prior error exists

### Response Shape
```ts
{
  entries: Array<Entry & { totalScore, totalBirdies, rank }>,
  completedRounds: number,
  refreshedAt: string | null,
  freshness: 'current' | 'stale' | 'unknown',
  isRefreshing: boolean,
  poolStatus: PoolStatus,
  lastRefreshError: string | null,
  golferStatuses: Record<golferId, status>,
  golferNames: Record<golferId, name>,
  golferCountries: Record<golferId, country>,
  golferScores: Record<golferId, TournamentScore>
}
```

---

## Real-time Subscriptions

### Channel
- `supabase.channel('pool_updates')` — single global channel for all pool broadcasts
- Event: `scores` with payload `{ poolId, ranked, completedRounds, updatedAt }`

### Client Subscription Triggers
Per AGENTS.md rules (no fixed-interval polling):
1. **Mount** — initial fetch
2. **`SUBSCRIBED` after reconnect** — Supabase fires this on initial connect AND after reconnect
3. **`visibilitychange` → `visible`** — tab becomes visible
4. **Slow safety heartbeat** — 120 second interval (safety net only)

### Freshness UI
- `TrustStatusBar` component shows:
  - "Up to date" (current)
  - "Refreshing scores..." (isRefreshing === true)
  - "Stale data" with last refresh time + error if applicable

---

## Auth Architecture

- **Supabase Auth** handles sign-in/sign-up
- Session managed via `@supabase/ssr` — cookie-based for Next.js App Router
- `createClient()` in `lib/supabase/client.ts` — browser client (uses session cookie)
- `createAdminClient()` in `lib/supabase/admin.ts` — server-side with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

### Auth Routes
- `/auth/sign-in` — Supabase email/password sign in
- `/auth/sign-up` — Registration

### Protected Routes
- `(app)/` layout checks auth via `createClient()` and redirects to `/auth/sign-in` if unauthenticated

---

## API Route Summary

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/scoring` | POST | CRON_SECRET | Main scoring refresh (cron or internal) |
| `/api/scoring/refresh` | POST | CRON_SECRET | On-demand scoring refresh |
| `/api/cron/scoring` | GET | None (external cron) | Cron dispatcher proxy |
| `/api/leaderboard/[poolId]` | GET | None | Public leaderboard |
| `/api/tournaments` | GET | None | List tournaments from Slash Golf |

---

## RLS (Row Level Security)

Supabase RLS is enabled on all public tables. Key policies (from `supabase/migrations/20260401101000_enable_rls_on_public_tables.sql`):

- `pools`: Select by anyone (public read), insert/update by commissioner
- `pool_members`: Select by members, insert by anyone (join flow), delete by commissioner
- `entries`: Select by pool members, insert/update by entry owner
- `tournament_scores`: Public read
- `audit_events`: Select by pool members

Admin client (`createAdminClient()`) uses service role key and bypasses RLS for server-side operations.

---

## Known Ambiguities / Stale Documentation

### 1. README is Stale
- README still references `src/lib/db/schema.sql` as the schema source, but actual schema is in `supabase/migrations/` with timestamp prefixes
- README mentions "hourly UTC dispatcher" but actual cron is Supabase pg_cron or external scheduler calling `/api/cron/scoring`
- README describes "hole-by-hole scoring" but the system was migrated to round-based scoring

### 2. Hole-based vs Round-based Scoring
- `tournament_scores` table still has hole columns (hole_1 through hole_18) in legacy schema but these are no longer used (see `20260401160000_drop_hole_columns.sql`)
- Current scoring is entirely round-based via `tournament_score_rounds`
- `scoring.ts` uses `round_id` not hole numbers

### 3. Timezone/Deadline Ambiguity
- `deadline` is stored as `TIMESTAMPTZ` but the value is a date-only string (YYYY-MM-DD) interpreted in the pool's timezone
- `getTournamentLockInstant()` in `picks.ts` does iterative timezone offset computation to handle DST transitions
- The timezone field was added in migration `20260401100000_add_pool_timezone.sql`

### 4. `isUpdating` Mutex Limitation
- Module-level `isUpdating` boolean in `POST /api/scoring` and `POST /api/scoring/refresh` is not safe for serverless (Next.js on Vercel)
- Each serverless invocation may have its own JS event loop, making the mutex ineffective for concurrent requests
- Mitigation: upserts are idempotent; worst case is redundant work

### 5. Pool Deletion
- Soft delete via `pool_deletions` table (see `20260408183000_add_archived_pools_and_pool_deletions.sql`)
- `deletePoolById()` in `pool-queries.ts` hard-deletes the pool row
- RLS policy for pool deletions may not be fully tested

### 6. Golfer Catalog / Tournament Roster
- `golfers` table is populated from Slash Golf API (`GET /api/tournaments/[id]/golfers`)
- `tournament_golfers` table may have RLS issues (see `20260408110000_add_tournament_golfers_rls.sql`)
- Golfer names are denormalized into `entries` via `golfer_ids` TEXT[] — no FK constraint

---

## Query / Service Boundaries

| Function | File | Client | Notes |
|----------|------|--------|-------|
| `insertPool` | pool-queries.ts | Admin | Commissioner creates pool |
| `insertPoolMember` | pool-queries.ts | Admin | Join flow |
| `getPoolByInviteCode` | pool-queries.ts | User | Pool lookup by invite |
| `getPoolsForMember` | entry-queries.ts | User | User's pools + entries |
| `upsertEntry` | entry-queries.ts | User | Submit picks |
| `getEntryByPoolAndUser` | entry-queries.ts | User | Load existing picks |
| `refreshScoresForPool` | scoring-refresh.ts | Admin | Scoring refresh (cron/on-demand) |
| `upsertTournamentScore` | scoring-queries.ts | Admin | Persist golfer scores |
| `getScoresForTournament` | scoring-queries.ts | User | Fetch scores for leaderboard |
| `rankEntries` | scoring.ts | Both | Pure function, no DB |
| `getTournamentLockInstant` | picks.ts | Both | Pure function, no DB |
| `classifyFreshness` | freshness.ts | Both | Pure function, no DB |
| `getGolfers` | slash-golf/client.ts | User | External API call |

---

## Migration Files

Key migrations (in `supabase/migrations/`):

| File | Purpose |
|------|---------|
| `20260331100000_add_golfer_catalog_metadata.sql` | Golfer catalog |
| `20260401090000_add_tournament_roster.sql` | Tournament roster |
| `20260401100000_add_pool_timezone.sql` | Timezone support |
| `20260401101000_enable_rls_on_public_tables.sql` | RLS enablement |
| `20260401110000_add_hourly_scoring_dispatcher.sql` | Cron dispatcher |
| `20260401120000_drop_legacy_golfers_table.sql` | Cleanup |
| `20260401130000_update_scoring_dispatcher.sql` | Dispatcher update |
| `20260401140000_grant_service_role_access.sql` | Service role perms |
| `20260401150000_add_round_snapshot_columns.sql` | Round snapshots |
| `20260401160000_drop_hole_columns.sql` | Remove hole columns |
| `20260401170000_create_tournament_score_rounds.sql` | Per-round archive |
| `20260408100000_add_pool_write_access.sql` | Pool write access |
| `20260408110000_add_tournament_golfers_rls.sql` | Tournament golfers RLS |
| `20260408183000_add_archived_pools_and_pool_deletions.sql` | Archive/delete |
| `20260409210000_public_entries_read.sql` | Public entries read |
| `20260410103000_grant_service_role_tournament_score_rounds.sql` | Archive perms |

---

## Dependencies

### External
- **Slash Golf API** (Rapid API): `https://live-golf-data.p.rapidapi.com`
  - Endpoints: `/schedule`, `/leaderboard`, `/tournament`
  - Auth: `X-RapidAPI-Key` header

### Internal
- None beyond Next.js + Supabase

---

## Where README is Stale

1. **Schema location**: README says `src/lib/db/schema.sql` but migrations are in `supabase/migrations/`
2. **Cron description**: README says "Supabase runs an hourly UTC dispatcher" — actual is external cron → `/api/cron/scoring` → `/api/scoring`
3. **Scoring model**: README describes "hole-by-hole scoring"; system is now round-based
4. **Pool Format section**: Mentions hole-by-hole but should reference round-based best-ball

---

## Compound Engineering Notes

Prior solutions in `docs/solutions/`:

- `database-issues/tournament-scores-overwriting-per-round-data.md` — scoring schema issue
- `workflow-issues/on-demand-scoring-refresh-2026-04-08.md` — on-demand refresh pattern
- `workflow-issues/cron-scoring-dispatch-open-live-auto-lock-2026-04-08.md` — cron + auto-lock issue
- `logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md` — timezone DST handling
