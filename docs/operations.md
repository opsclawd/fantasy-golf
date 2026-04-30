# Operations Guide

**Date:** 2026-04-29
**Purpose:** Day-to-day operations, monitoring, and maintenance procedures for Fantasy Golf Pool.

---

## 1. Team Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **Release/Ops** | Merges PRs, monitors deploys, handles rollbacks |
| **Architecture Lead** | Approves major code changes, reviews plans |
| **Implementation Engineer** | Executes implementation plans, opens PRs |

---

## 2. Deployment Workflow

### 2.1 Standard Deploy (via Squash Merge)

1. Implementation Engineer opens a PR targeting `main`
2. Architecture Lead reviews and approves
3. Release/Ops performs squash-merge to `main`
4. Vercel auto-detects the push and begins production deploy
5. Release/Ops runs smoke tests and confirms health

### 2.2 Vercel Configuration

1. Connect the GitHub repo to Vercel
2. Set all environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SLASH_GOLF_API_KEY`
   - `CRON_SECRET` (mark as sensitive)
   - `NEXT_PUBLIC_APP_URL`
3. Use `npm run build` as the build command
4. Use `npm run start` as the start command

---

## 3. Monitoring

### 3.1 Application Logs

Monitor for:
- `ERROR` or `WARN` entries related to recent deploys
- Spike in 5xx response codes
- `FETCH_FAILED` or `UPSERT_FAILED` errors in scoring routes

Check Vercel dashboard → Runtime Logs for production.

### 3.2 Database Health

Check these indicators in Supabase dashboard:

```sql
-- Check pool freshness
select id, status, refreshed_at, last_refresh_error from pools where status = 'live';

-- Check for recent score refresh events
select * from audit_events where event_type like 'scoreRefresh%' order by created_at desc limit 10;
```

### 3.3 Scoring Health Indicators

A healthy deployment shows:
- `pools.refreshed_at` is recent (within 4 hours)
- `pools.last_refresh_error` is `null`
- `tournament_scores` has current-round data
- `audit_events` shows `scoreRefreshCompleted` events

---

## 4. Maintenance

### 4.1 Supabase Migrations

When adding a new migration:

```bash
# Create migration file
touch supabase/migrations/YYYYMMDDHHMMSS_description.sql

# Push to remote
npx supabase db push
```

Never edit the Supabase schema directly. Always use migrations.

### 4.2 Cron Job Maintenance

The scoring cron job is defined in `supabase/migrations/20260401130000_update_scoring_dispatcher.sql`.

To check if it's active:
```sql
select * from cron.job where jobname = 'four-hour-scoring-dispatch';
```

If missing, re-run the migration to restore it.

### 4.3 Vault Secret Rotation

If `CRON_SECRET` needs rotation:

1. Update in Supabase Vault: `update vault.secrets set value = 'new-secret' where name = 'cron_secret';`
2. Update in Vercel environment variables
3. Next cron job will use the new secret automatically

---

## 5. Environment Reference

| Environment | URL |
|---|---|
| Local dev | `http://localhost:3000` |
| Production | Configured in `NEXT_PUBLIC_APP_URL` |
| Supabase | Your project at `.supabase.co` |

### Required Environment Variables

| Variable | Description | Local | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key | Yes | Yes |
| `SLASH_GOLF_API_KEY` | Slash Golf API key | Yes | Yes |
| `CRON_SECRET` | Scoring endpoint bearer token | Yes | Yes |
| `NEXT_PUBLIC_APP_URL` | App public URL | `http://localhost:3000` | Production URL |

---

## 6. Backup and Recovery

### 6.1 Database Backups

Supabase provides automated daily backups. To restore:
1. Supabase Dashboard → Database → Backups
2. Select the backup point
3. Follow restore instructions

### 6.2 Rollback Procedure

If a deploy causes issues:

```bash
# Find the squash commit to revert
git log --oneline -1

# Revert
git revert <squash-commit-sha>
git push origin main
```

Vercel will auto-deploy the reverted code.

---

## 7. Common Operations Tasks

### Update Environment Variables

1. Vercel dashboard → Environment Variables
2. Update the value
3. Redeploy (or wait for next push)

### Force a Score Refresh

```bash
curl -X POST https://app-url/api/scoring/refresh \
  -H 'Authorization: Bearer CRON_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"poolId": "uuid-of-pool"}'
```

### Check Cron Job Status

In Supabase SQL Editor:
```sql
select * from cron.job where jobname = 'four-hour-scoring-dispatch';
select * from cron.job_run_details where jobname = 'four-hour-scoring-dispatch' order by runid desc limit 5;
```

---

## 9. Tournament Operations Runbook

A step-by-step guide for pool commissioners to run a tournament weekend. No technical background required.

### 9.1 Pre-Tournament (1–3 Days Before)

**Create the pool**
1. Sign in to Fantasy Golf Pool
2. Click **Create Pool**
3. Enter a pool name (e.g., "Masters 2026 Office Pool")
4. Select the tournament from the dropdown (e.g., "The Masters")
5. Choose scoring format — "Best Ball" is standard
6. Set the **entry deadline** to tee time of the first group
7. Set the **pool timezone** to the tournament's local time (e.g., ET for Augusta)
8. Click **Create Pool**

**Invite participants**
1. Open the pool detail page
2. Click **Invite** or **Share**
3. Copy the invite link and send it to participants via Slack, email, or text
4. Participants join by visiting the link and signing in

**Verify setup**
- [ ] Pool status shows "Open" or "Upcoming"
- [ ] Deadline is set to the correct tee time
- [ ] Timezone matches tournament local time
- [ ] At least 2 participants have joined
- [ ] All participants have submitted picks before the deadline

### 9.2 Tournament Weekend (Saturday–Sunday)

**Verify scoring is running**
1. Open the pool detail page
2. Check the **Last Refreshed** timestamp on the leaderboard
3. If **Last Refreshed** is more than 4 hours ago, scoring may be stalled
4. The leaderboard should update automatically every 4 hours via cron

**Monitor staleness**
- Green freshness indicator = scores updated within 4 hours
- Yellow/stale indicator = scores are outdated — action needed
- Red error banner = score refresh failed — escalate immediately

**Force a manual refresh (if scores look stale)**
1. Sign in as the pool commissioner
2. Open the pool detail page
3. Click the **Refresh Scores** button (may be labeled "Refresh Pool" or shown in a menu)
4. Wait 30 seconds and refresh the page
5. The **Last Refreshed** timestamp should update

**If the refresh button fails**
1. Note the error message
2. Go to the [Supabase Dashboard](https://supabase.com) → Database → SQL Editor
3. Run: `select id, status, refreshed_at, last_refresh_error from pools where status = 'live';`
4. If `last_refresh_error` is not null, copy the error text and escalate to the ops team

### 9.3 Post-Tournament (After Final Round)

**Close the pool**
1. Sign in as the pool commissioner
2. Open the pool detail page
3. Click **Close Pool** or **End Tournament**
4. Confirm the action — this locks all entries permanently

**Verify final leaderboard**
1. Confirm the leaderboard shows correct winning positions
2. Check that withdrawn golfers show as WD (Withdrawn) not active
3. If scoring errors are suspected, compare against [Slash Golf](https://rapidapi.com/slashgolf) leaderboard

**Archive the pool**
1. In the pool detail page, click **Archive Pool**
2. Archived pools are read-only and available for historical reference
3. The archive preserves all picks, scores, and audit history

### 9.4 Quick Reference Commands

| Action | Where | How |
|---|---|---|
| Create pool | App UI | New Pool → select tournament → save |
| Invite participants | Pool detail → Share | Copy link and send |
| Check last refresh | Pool leaderboard header | Read timestamp |
| Force score refresh | Pool detail → Commissioner menu | Click Refresh |
| Close pool | Pool detail → Commissioner menu | Click Close Pool |
| Archive pool | Pool detail → Commissioner menu | Click Archive |

---

## 10. Related Documentation

| Document | Purpose |
|---|---|
| [Setup Guide](./setup.md) | New developer onboarding |
| [Runbook](./runbooks/fantasy-golf-ops.md) | Detailed recovery procedures |
| [Technical Architecture](./architecture/fantasy-golf-technical-architecture-analysis.md) | System design reference |