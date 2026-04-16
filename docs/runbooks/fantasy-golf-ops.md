# Fantasy Golf Ops Runbook

**Date:** 2026-04-16
**Type:** Operations Runbook
**Author:** Release / Ops
**Scope:** Deployment, secrets management, scoring refresh, and recovery procedures for the Fantasy Golf Pool production environment.

---

## 1. Required Environment Variables

| Variable | Description | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase dashboard → Settings → API |
| `SLASH_GOLF_API_KEY` | Slash Golf scoring API key | Slash Golf / RapidAPI dashboard |
| `CRON_SECRET` | Bearer token for scoring cron endpoints | Generated secret; stored in Supabase Vault as `cron_secret` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app | Vercel or hosting dashboard; stored in Supabase Vault as `app_url` |

**Vault secrets** (Supabase → Database → Vault):
- `app_url` — the public app URL (e.g., `https://fantasy-golf.vercel.app`)
- `cron_secret` — the same value as `CRON_SECRET` env var

All five env vars must be present in the deployment target before the application starts.

---

## 2. Supabase Dependencies

### Database Schema

The app depends on these Supabase tables (defined in `src/lib/db/schema.sql` and migrations under `supabase/migrations/`):

- `pools` — commissioner's tournament pools; stores `status` (`open`, `live`, `complete`, `archived`), `deadline`, `timezone`, `commissioner_id`, `invite_code`, `year`, `format`, `picks_per_entry`
- `entries` — participant picks (4 golfers per entry)
- `golfers` — available golfer catalog
- `tournament_scores` — current scoring state (upserted on every refresh)
- `tournament_score_rounds` — per-round archive (append-only)
- `audit_events` — audit trail for all pool mutations
- `pool_members` — tracks which users have joined which pools

### Row Level Security (RLS)

All public-facing tables have RLS policies. Service role is required for cron-triggered scoring operations. The service role key must be configured in the Supabase admin client (`src/lib/supabase/admin.ts`).

### Realtime

Supabase Realtime channels are used to broadcast score updates to connected clients. The channel `pool_updates` carries `scores` broadcast events with `poolId`, `ranked` leaderboard data, `completedRounds`, and `updatedAt`.

---

## 3. Cron Secret Behavior

### Scoring Dispatcher

Supabase `pg_cron` runs a job every 4 hours (`0 */4 * * *`):

```sql
select cron.schedule(
  'four-hour-scoring-dispatch',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/scoring',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $$
);
```

This hits `GET /api/cron/scoring`, which relays to `POST /api/scoring` with the `CRON_SECRET` bearer token.

### How Scoring Refresh Is Triggered

1. `pg_cron` fires every 4 hours in UTC.
2. It calls `GET /api/cron/scoring` (the relay route).
3. The relay route POSTs to `POST /api/scoring` with `Authorization: Bearer CRON_SECRET`.
4. `POST /api/scoring` performs two steps:
   - **Auto-lock**: Scans for `open` pools past their deadline → transitions them to `live`.
   - **Refresh**: Calls `refreshScoresForPool()` for the most recently created `live` pool.
5. `refreshScoresForPool()` fans out to **all** live pools on the same tournament:
   - Fetches scores from Slash Golf API
   - Upserts into `tournament_scores` and `tournament_score_rounds`
   - Updates `refreshed_at` on all affected pools
   - Broadcasts ranked leaderboards via Supabase Realtime
   - Writes `scoreRefreshCompleted` audit events

### On-Demand Refresh

Commissioners can trigger a manual refresh via:
```
POST /api/scoring/refresh
Authorization: Bearer CRON_SECRET
Body: { "poolId": "uuid" }
```
This bypasses the auto-lock step and refreshes the specific pool only.

---

## 4. What Happens When Refresh Fails

### Failure Modes

| Failure Point | Response Code | Error Code | Behavior |
|---|---|---|---|
| Missing `CRON_SECRET` | 401 | — | Route returns 401; no score update |
| Missing `NEXT_PUBLIC_APP_URL` | 500 | — | Cron relay returns 500; pg_cron logs error |
| Slash Golf API unreachable | 502 | `FETCH_FAILED` | `last_refresh_error` set on pool; audit event `scoreRefreshFailed` written; cron reports failure via response |
| Database upsert failure | 500 | `UPSERT_FAILED` | `last_refresh_error` set; audit event `scoreRefreshFailed` written |
| Concurrent refresh in progress | 409 | `UPDATE_IN_PROGRESS` | Route returns 409; no action taken; safe to retry next cycle |
| Pool not found (on-demand) | 404 | `NOT_FOUND` | Returns 404; no state changed |
| Invalid JSON body | 400 | `BAD_REQUEST` | Returns 400; no state changed |

### Error State in Pool Record

When a refresh fails, `pools.last_refresh_error` is set to the failure message. The pool's `refreshed_at` is not updated. The UI shows a "stale" or "error" freshness indicator.

### Retry Behavior

- **Cron cycle**: Next 4-hour interval auto-retry. No manual intervention required.
- **On-demand**: Commissioner can retry immediately or wait for the next cron cycle.
- **Concurrent requests**: The `isUpdating` mutex prevents duplicate concurrent runs. Requests get a 409 and can be retried after the in-progress run completes.

---

## 5. Recovery Steps

### Scenario A: Cron Not Firing

1. Check Supabase dashboard → Database → Extensions → `pg_cron` is enabled.
2. Check Supabase dashboard → Database -> pg_cron jobs: `four-hour-scoring-dispatch` exists and is enabled.
3. If job is missing, re-run migration `supabase/migrations/20260401130000_update_scoring_dispatcher.sql`.
4. Verify Vault secrets `app_url` and `cron_secret` are present: `select * from vault.decrypted_secrets`.
5. Verify the cron target URL is reachable from Supabase: test with `select net.http_post(...)` manually.
6. Check application logs for 500 errors on `/api/cron/scoring` or `/api/scoring`.

### Scenario B: Scores Not Updating (Stale Data)

1. Check pool record: `select id, status, deadline, refreshed_at, last_refresh_error from pools where id = '...';`
2. If `last_refresh_error` is set, note the error message.
3. If `refreshed_at` is null or old, trigger on-demand refresh: `curl -X POST https://app-url/api/scoring/refresh -d '{"poolId":"..."}' -H 'Authorization: Bearer CRON_SECRET'`.
4. If that fails with 409 (UPDATE_IN_PROGRESS), wait 60 seconds and retry.
5. Check Slash Golf API status at [status.slashgolf.com](https://status.slashgolf.com) if all internal checks pass.

### Scenario C: Deployment Failure

1. **Do not debug in production.** Roll back immediately via `git revert` of the merge commit.
2. Notify Board: "Deploy of {story-title} failed. Rolled back. Awaiting instructions."
3. Do not re-deploy until Board approves remediation plan.

### Scenario D: Database Migration Failure

1. `npx supabase db push` will attempt to apply pending migrations.
2. If a migration fails, the migration itself must be fixed before re-pushing.
3. Check `supabase/migrations/` for the failing migration file and the error message.
4. Never modify the database schema directly; always use a migration.

### Scenario E: Secret Rotation

If `CRON_SECRET` is rotated:
1. Update the secret value in Supabase Vault (`cron_secret`).
2. Update the `CRON_SECRET` environment variable in Vercel (or hosting platform).
3. The next cron job will pick up the new secret automatically.

---

## 6. What "Healthy" Means After Deploy

A deployment is considered healthy when all of the following are true:

### Smoke Test Checklist

- [ ] App is responsive at `NEXT_PUBLIC_APP_URL`
- [ ] `GET /` renders the homepage without error
- [ ] Auth flow works (sign-in / sign-up pages load)
- [ ] Supabase connection is established (no "Unable to connect" errors in UI)
- [ ] Leaderboard page loads without errors

### Scoring Health Indicators

- [ ] Pool's `refreshed_at` is recent (within expected cron interval)
- [ ] Pool's `last_refresh_error` is `null`
- [ ] `tournament_scores` table has current-round data for active golfers
- [ ] `audit_events` table shows `scoreRefreshCompleted` events after deploy

### Log Scan

- [ ] No new `ERROR` or `WARN` entries in application logs related to the deploy
- [ ] No spike in 5xx response codes
- [ ] No new `FETCH_FAILED` or `UPSERT_FAILED` errors in scoring routes

### Post-Deploy Comment Template

```md
## Deployment Complete
- Merged: PR #{number} → main (SHA: {sha})
- Deployed: {timestamp}
- Smoke: PASS
- AC Verification: ALL PASS
- Log Scan: CLEAN
Story complete.
```

---

## 7. Deployment Mechanism

This project deploys to **Vercel** (recommended) or can be deployed to any Node.js-compatible platform.

### Vercel Deploy Steps

1. Merge PR to `main` via squash-merge.
2. Vercel automatically detects the Next.js app and triggers a production deploy.
3. Monitor deploy progress at: https://vercel.com/dashboard
4. Wait for `npm run build` to complete with exit code 0.

### Manual Deploy

```bash
npm run build
npm run start
```

### Environment Variables on Vercel

Set all five required env vars in the Vercel dashboard → Environment Variables. Mark `CRON_SECRET` as sensitive.

---

## 8. Rollback Procedure

### Step 1: Identify the Problem

Post-deploy smoke checks or user reports indicate something is wrong.

### Step 2: Roll Back Immediately

```bash
# Get the SHA of the previous main commit
git log --oneline -2

# Revert the bad merge
git revert -m 1 <merge-commit-sha>

# Push the revert
git push origin main
```

Vercel will auto-deploy the revert.

### Step 3: Notify Board

Post in the issue thread:
```
Post-deploy verification failed: {details}. Rolled back.

Board action required: investigate root cause before next deploy.
```

### Step 4: Do Not Retry Without Board Approval

---

## 9. Related Documentation

| Document | Location |
|---|---|
| Scoring refresh flow | `src/lib/scoring-refresh.ts` |
| Scoring cron migration | `supabase/migrations/20260401130000_update_scoring_dispatcher.sql` |
| Cron scoring dispatch workflow | `docs/solutions/workflow-issues/cron-scoring-dispatch-open-live-auto-lock-2026-04-08.md` |
| On-demand refresh pattern | `docs/solutions/workflow-issues/on-demand-scoring-refresh-2026-04-08.md` |
| Pool deadline timezone fix | `docs/solutions/logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md` |
| Scoring schema (per-round archive) | `docs/solutions/database-issues/tournament-scores-overwriting-per-round-data.md` |
| Brownfield brief (current state) | `docs/briefs/fantasy-golf-brownfield-brief.md` |