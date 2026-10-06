# Fantasy Golf Operator Runbook

**Date:** 2026-10-05  
**Type:** Authoritative Operational Manual  
**Author:** Architecture / Ops  
**Scope:** Deployment, secrets management, database bootstrap, scoring refresh operations, incident recovery, and live smoke test verification for the Fantasy Golf Pool production environment.

---

## 1. System Architecture & Topology

The Fantasy Golf Pool platform operates on a three-tier architecture designed around commissioner-first administration, live hole-by-hole scoring, and unauthenticated public spectator access.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Next.js 14 App Router                          │
│                                                                        │
│  Public Routes                 Authenticated (App)     API Routes       │
│  - / (Home)                    - /commissioner/...    - /api/tournaments│
│  - /join/[inviteCode]          - /participant/...     - /api/leaderboard│
│  - /spectator/pools/[poolId]                          - /api/scoring    │
│  - /sign-in, /sign-up                                 - /api/scoring/   │
│                                                          refresh        │
│                                                       - /api/cron/      │
│                                                          scoring        │
└───────────────▲───────────────────────────▲────────────────────┬───────┘
                │                           │                    │
                │ Realtime / Anon Read      │ Auth / RLS         │ Service Role / Cron
                │ (pools, entries, holes)   │                    ▼
┌───────────────┴───────────────────────────┴────────────────────────────┐
│                    Supabase Backend (PostgreSQL 15+)                   │
│                                                                        │
│  Core Tables:                                                          │
│  - pools (telemetry: last_refresh_success_at, refresh_attempt_count)   │
│  - pool_members, entries, tournament_golfers                           │
│  - tournament_scores (current snapshot)                                │
│  - tournament_score_rounds (per-round archive)                         │
│  - tournament_holes (hole-by-hole scores: strokes, par, score_to_par)   │
│  - refresh_locks (tournament mutex: 5-minute TTL)                      │
│  - audit_events, pool_deletions, golfer_sync_runs                      │
│                                                                        │
│  Row-Level Security (RLS):                                             │
│  - anon/authenticated: SELECT on pools, entries (public), holes        │
│  - service_role: ALL on tournament_holes, refresh_locks, audit_events   │
│                                                                        │
│  Extensions & Background Services:                                     │
│  - pg_cron: schedules four-hour-scoring-dispatch                       │
│  - pg_net: dispatches HTTP POST via Supabase Vault secrets             │
│  - Supabase Vault: stores app_url, cron_secret                         │
└───────────────────────────────────────────▲────────────────────────────┘
                                            │
                                            │ API Key: SLASH_GOLF_API_KEY
                                            ▼
                       ┌───────────────────────────────┐
                       │   Slash Golf API (RapidAPI)   │
                       │   - /schedule                 │
                       │   - /leaderboard (scores)     │
                       │   - /scorecard (holes)        │
                       └───────────────────────────────┘
```

---

## 2. Environment Variables & Security Boundaries

Six environment variables are required for complete operation. They fall into two strict isolation tiers: client-exposed (public) and server-only secrets.

| Variable | Tier | Classification | Description & Usage |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Public | Supabase project URL (e.g. `https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Public | Supabase anonymous public API key. Subject to RLS policies. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | Public | Canonical web URL (e.g. `https://fantasy-golf.vercel.app` or `http://localhost:3000`). |
| `SLASH_GOLF_API_KEY` | Server Only | **Sensitive Secret** | RapidAPI key for Slash Golf API. Never expose to client bundles. |
| `CRON_SECRET` | Server Only | **Sensitive Secret** | Bearer token authenticating `/api/cron/scoring` and `/api/scoring/refresh`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | **Sensitive Secret** | Administrative service-role key that bypasses RLS for scoring refresh writes and lock management. **NEVER prefix with `NEXT_PUBLIC_`.** |

Local configuration is managed via `.env.local` (copied from `.env.local.example`). Secret-bearing files (`.env`, `.env.local`) are strictly git-ignored.

---

## 3. Supabase Setup, Migrations & Bootstrap

### 3.1 Fresh Database Migration Sequence

All schema definitions are managed via timestamped SQL migrations in `supabase/migrations/`. The migration chain is fully self-contained and begins with a baseline schema migration (`20260330000000_baseline_schema.sql`), ensuring a fresh Supabase database can be provisioned entirely through CLI commands without manual table creation in the Supabase web dashboard.

To apply migrations to a linked Supabase project:

```bash
# 1. Authenticate local Supabase CLI
npx supabase login

# 2. Link your project
npx supabase link --project-ref <your-project-ref>

# 3. Push all migrations sequentially
npx supabase db push
```

### 3.2 Required Extensions

Enable the required extensions in your Supabase project (via dashboard under **Database → Extensions** or SQL editor):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

### 3.3 Supabase Vault Secrets Configuration

The scoring cron dispatcher reads the application URL and bearer secret securely from Supabase Vault. Note the exact parameter order (`secret_value`, `secret_name`):

```sql
-- In Supabase SQL Editor:
select vault.create_secret('https://<your-vercel-domain>', 'app_url');
select vault.create_secret('<your-cron-secret-value>', 'cron_secret');
```

Verify vault secrets are active:

```sql
select id, name, created_at from vault.secrets;
```

### 3.4 Cron Job Verification

The cron dispatcher `four-hour-scoring-dispatch` is scheduled via migration `20260401130000_update_scoring_dispatcher.sql` to execute every 4 hours (`0 */4 * * *`).

Verify the job is scheduled in PostgreSQL:

```sql
select jobid, schedule, command, active, jobname
from cron.job
where jobname = 'four-hour-scoring-dispatch';
```

---

## 4. Scoring Refresh Mechanics

### 4.1 Automated vs On-Demand Execution

Scoring refresh occurs through two entry points:
1. **Automated Cron Relay (`GET /api/cron/scoring`):**
   - Scheduled by `pg_cron` every 4 hours.
   - Forwards request with `Authorization: Bearer <CRON_SECRET>` to `POST /api/scoring`.
   - Auto-locks open pools whose deadline has passed (transitions `open` → `live`).
   - Fans out scoring refresh across all active tournaments.
2. **On-Demand Commissioner Refresh (`POST /api/scoring/refresh`):**
   - Invoked directly by commissioners or client background triggers.
   - Accepts payload: `{"poolId": "<uuid>"}` with `Authorization: Bearer <CRON_SECRET>`.
   - Bypasses deadline auto-lock and immediately refreshes the specified pool's tournament.

### 4.2 Distributed Concurrency Mutex (`refresh_locks`)

To prevent concurrent API requests from corrupting standings or exceeding Slash Golf rate limits, the system acquires a database lock in `refresh_locks` before initiating external calls:
- **Lock Scope:** By `tournament_id`.
- **TTL:** 5 minutes (`expires_at = now() + interval '5 minutes'`).
- **Collision Handling:** Any concurrent request for the same tournament while a valid lock exists immediately returns HTTP 409 with `{ error: { code: 'REFRESH_LOCKED' } }`.
- **Release:** The lock is removed in a `finally` block upon pipeline completion or error.

### 4.3 Ingestion Pipeline & Completeness Gate

1. **Leaderboard Snapshot:** Fetches tournament standings from Slash Golf `/leaderboard`.
2. **Round Archive:** Writes current scores to `tournament_scores` and round history to `tournament_score_rounds`.
3. **Scorecard Ingestion:** Fetches per-golfer hole data from Slash Golf `/scorecard` and upserts 18 hole records per completed round into `tournament_holes` (`strokes`, `par`, `score_to_par`).
4. **Hole Completeness Integrity Gate (`validateHoleDataCompleteness`):**
   - Identifies all required scoring golfers from pool entries (excluding golfers with `cut`, `withdrawn`, or `dq` statuses).
   - Validates that every required golfer has 18 hole rows per completed round in `tournament_holes`.
   - **On Partial Data:** If any required golfer lacks hole records:
     - Halts refresh pipeline immediately.
     - Does **NOT** advance `refreshed_at` or `last_refresh_success_at`.
     - Updates `pools.last_refresh_error` with details.
     - Logs `scoreRefreshFailed` to `audit_events`.
     - Returns HTTP 502 with error code `INCOMPLETE_HOLE_DATA` and lists missing golfer IDs.
5. **Success Pipeline:**
   - Advances `pools.refreshed_at` and `pools.last_refresh_success_at`.
   - Clears `pools.last_refresh_error`.
   - Computes hole-by-hole best-ball rankings via `rankEntriesWithHoles`.
   - Broadcasts updated standings to connected clients over Supabase Realtime channel `pool_updates`.
   - Logs `scoreRefreshCompleted` audit event.

---

## 5. Telemetry & Failure Inspection

The database provides explicit telemetry columns on the `pools` table and granular audit records in `audit_events`.

### 5.1 Inspecting Pool Refresh Telemetry

```sql
SELECT
  id,
  name,
  status,
  refreshed_at,
  last_refresh_success_at,
  last_refresh_attempt_at,
  refresh_attempt_count,
  last_refresh_error
FROM pools
WHERE id = '<pool-id>';
```

### 5.2 Inspecting Audit Events

```sql
SELECT
  created_at,
  action,
  details
FROM audit_events
WHERE pool_id = '<pool-id>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 6. End-to-End Smoke Test & Database Visibility Verification

### 6.1 Automated 10-Step Smoke Test

The automated regression suite covers the full 10-step lifecycle:
```bash
pnpm test src/lib/__tests__/e2e-mvp-smoke.test.ts
```

### 6.2 Live Environment Smoke Test Protocol

When deploying to a staging or production environment, execute the following smoke verification sequence:

#### Step 1: Health & Tournament Roster Check
```bash
curl -s -f https://<app-domain>/api/tournaments | jq .
```
Confirm the upcoming tournament is listed.

#### Step 2: Pool Creation & Lock Verification
1. Sign in as commissioner at `https://<app-domain>/sign-in`.
2. Navigate to `/commissioner` and create a pool with 4 picks per entry, choosing tournament and deadline.
3. Confirm pool status is `open` and invite code is generated.

#### Step 3: Entry Submission
1. In an incognito window, visit `https://<app-domain>/join/<invite-code>`.
2. Sign in as a participant and select 4 golfers.
3. Submit picks and verify entry appears on the participant pool view.

#### Step 4: Trigger Scoring Refresh
Trigger on-demand scoring using the `CRON_SECRET`:
```bash
curl -X POST https://<app-domain>/api/scoring/refresh \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"poolId": "<pool-id>"}' | jq .
```
Verify response returns HTTP 200 with `{ "data": { "completedRounds": ..., "refreshedAt": "..." } }`.

#### Step 5: Direct PostgreSQL Scorecard Persistence Verification (AC-5)
Connect to the Supabase database using psql or the Supabase SQL Editor and execute these inspection queries:

**Query 1: Verify 18 completed hole rows per golfer per round:**
```sql
SELECT
  golfer_id,
  round_id,
  COUNT(*) AS hole_count,
  MIN(hole_id) AS min_hole,
  MAX(hole_id) AS max_hole
FROM tournament_holes
WHERE tournament_id = '<tournament-id>'
GROUP BY golfer_id, round_id
ORDER BY golfer_id, round_id;
```
*Expected Result:* Every golfer has exactly `hole_count = 18`, with `min_hole = 1` and `max_hole = 18`.

**Query 2: Verify hole data integrity (par, strokes, score_to_par):**
```sql
SELECT golfer_id, round_id, hole_id, par, strokes, score_to_par
FROM tournament_holes
WHERE tournament_id = '<tournament-id>'
  AND (score_to_par != strokes - par OR par < 3 OR par > 5 OR strokes < 1);
```
*Expected Result:* 0 rows returned.

**Query 3: Verify entry best-ball computation directly from persisted holes:**
```sql
WITH entry_golfers AS (
  SELECT unnest(golfer_ids) AS golfer_id
  FROM entries
  WHERE id = '<entry-id>'
),
hole_best_balls AS (
  SELECT
    th.round_id,
    th.hole_id,
    MIN(th.score_to_par) AS best_score_to_par
  FROM tournament_holes th
  JOIN entry_golfers eg ON th.golfer_id = eg.golfer_id
  WHERE th.tournament_id = '<tournament-id>'
  GROUP BY th.round_id, th.hole_id
)
SELECT round_id, SUM(best_score_to_par) AS round_best_ball_score
FROM hole_best_balls
GROUP BY round_id
ORDER BY round_id;
```
*Expected Result:* Round best-ball sums match the entry's round score displayed on the leaderboard.

#### Step 6: Spectator Leaderboard Read
Visit `https://<app-domain>/spectator/pools/<pool-id>` in an incognito window without signing in.
- Verify leaderboard loads with rank, total score, and birdie tiebreaker.
- Verify Trust Status Bar displays "Scores current" (or "Updated X min ago").

---

## 7. Incident Recovery Playbooks

### Playbook A: Upstream Slash Golf API Outage or Rate Limit
**Symptom:** Refresh returns HTTP 502 `FETCH_FAILED`; `pools.last_refresh_error` contains timeout or rate limit error.
1. Inspect Slash Golf status page or test endpoint with curl.
2. Confirm existing leaderboard continues to display previous round standings with honest `stale` freshness badge.
3. Do not alter database records manually. When API recovers, next cron cycle or manual refresh will catch up.

### Playbook B: Incomplete Scorecard Hole Data (HTTP 502 `INCOMPLETE_HOLE_DATA`)
**Symptom:** Scoring refresh returns HTTP 502 with error code `INCOMPLETE_HOLE_DATA` and lists `missingGolfers`.
1. Inspect the missing golfer IDs in the response or in `pools.last_refresh_error`.
2. Check `tournament_holes` for the missing golfer:
   ```sql
   SELECT * FROM tournament_holes WHERE tournament_id = '<tournament-id>' AND golfer_id = '<missing-id>';
   ```
3. Read path automatically falls back to `getLatestCompleteRound`, preserving integrity of prior round standings.
4. If upstream provider data is delayed during round transition, wait 10-15 minutes and trigger on-demand refresh.

### Playbook C: Cron Job Not Dispatching
**Symptom:** `pools.refreshed_at` is older than 4 hours; no recent audit events.
1. Confirm `pg_cron` extension is enabled:
   ```sql
   select * from pg_extension where extname = 'pg_cron';
   ```
2. Verify cron schedule and check `cron.job_run_details`:
   ```sql
   select * from cron.job_run_details order by start_time desc limit 5;
   ```
3. Verify Vault secrets `app_url` and `cron_secret` match current production URL and `CRON_SECRET` env var.
4. Manually trigger scoring refresh via curl to verify route handler health.

### Playbook D: Stuck Refresh Mutex Lock
**Symptom:** On-demand refresh returns HTTP 409 `REFRESH_LOCKED` continuously.
1. Check active locks:
   ```sql
   SELECT * FROM refresh_locks WHERE tournament_id = '<tournament-id>';
   ```
2. If `expires_at` is in the past, locks are automatically ignored. If a transient error caused an unreleased lock with future expiration, clear it manually:
   ```sql
   DELETE FROM refresh_locks WHERE tournament_id = '<tournament-id>';
   ```

### Playbook E: Spectator Leaderboard Read Blocked (RLS Error)
**Symptom:** Spectator route returns empty leaderboard or 500 error while commissioner view works.
1. Verify RLS policy on `tournament_holes`:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'tournament_holes';
   ```
2. Confirm policy `"Public tournament holes are readable"` exists. If missing, apply migration `20260501000000_grant_public_tournament_holes_read.sql`:
   ```sql
   GRANT SELECT ON TABLE public.tournament_holes TO anon, authenticated;
   CREATE POLICY "Public tournament holes are readable"
     ON public.tournament_holes FOR SELECT TO anon, authenticated
     USING (true);
   ```

### Playbook F: Production Deployment Rollback
**Symptom:** Deployment introduces a fatal regression or build failure in production.
1. **Option A (Instant Vercel Rollback):**
   - Navigate to Vercel Dashboard → **Deployments**.
   - Locate the last known good deployment.
   - Click the three dots menu `...` and select **Promote to Production**.
2. **Option B (Git Revert):**
   ```bash
   git revert <bad-commit-sha>
   git push origin main
   ```
   Vercel will build and deploy the revert commit automatically.

---

## 8. Known Limitations & MVP Operational Boundaries

1. **Format Constraint:** MVP supports `best_ball` format only. Other formats (`scramble`, `stroke`) are rejected at schema and validation boundaries.
2. **Entry Pick Size:** Exactly 4 unique golfers per entry (`picks_per_entry = 4`). No duplicate golfers permitted within an entry.
3. **Playoff Exemption:** Playoff holes are strictly excluded from MVP scoring. Only regulation rounds (1–4) and holes (1–18) are ingested and ranked.
4. **Single Active Tournament:** In MVP, pools link to a single PGA Tour tournament event ID from Slash Golf.
5. **No Mobile Native Apps:** Application is responsive web only (App Router Next.js 14).
6. **No Paid Pools or Payout Management:** Platform is commissioner-administered for private play; financial payouts and wager collection are strictly out of scope.