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

## 8. Related Documentation

| Document | Purpose |
|---|---|
| [Setup Guide](./setup.md) | New developer onboarding |
| [Runbook](./runbooks/fantasy-golf-ops.md) | Detailed recovery procedures |
| [Technical Architecture](./architecture/fantasy-golf-technical-architecture-analysis.md) | System design reference |