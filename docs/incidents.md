# Incident Response Guide

**Date:** 2026-04-29
**Purpose:** Structured response procedures for incidents affecting Fantasy Golf Pool.

---

## 1. Incident Severity Levels

| Severity | Definition | Response Time |
|---|---|---|
| **P1 — Critical** | Production is down or scoring is completely broken | Immediate |
| **P2 — High** | Scoring stale, leaderboard errors, auth failures | Within 1 hour |
| **P3 — Medium** | UI bugs, partial degradation, non-critical features | Within 4 hours |
| **P4 — Low** | Cosmetic issues, documentation updates | Next business day |

---

## 2. Incident Response Procedure

### Step 1: Identify and Triage

1. **Confirm the issue** — Is it reproducible? Is it affecting all users or a subset?
2. **Assess severity** — Use the severity levels above
3. **Check current deploy status** — What was the most recent deployment?

### Step 2: Communicate

Post in the incident issue thread:

```
## Incident Alert
- Severity: P#
- Issue: {short description}
- Current status: Investigating
-ETA: {if known}
```

### Step 3: Investigate

Common root causes:

| Symptom | Check |
|---|---|
| App not loading | Vercel deploy status, environment variables |
| Scores stale | `pools.last_refresh_error`, Slash Golf API status |
| Auth failures | Supabase Auth status, anon key validity |
| Database errors | `supabase/migrations/` applied, RLS policies |

### Step 4: Mitigate

Apply the appropriate remediation from the runbook:
- Rollback if deploy-related (see [operations.md](./operations.md#rollback-procedure))
- Restart services if applicable
- Trigger manual refresh if scoring is stuck

### Step 5: Resolve

Once resolved, post a summary:

```
## Incident Resolved
- Duration: {X hours}
- Root cause: {brief explanation}
- Fix applied: {what was done}
- Prevention: {what changed to prevent recurrence}
```

---

## 3. Common Incident Playbooks

### Playbook A: Production App Down

**Symptoms:** Users cannot access the app at the production URL.

**Steps:**
1. Check Vercel dashboard for deploy failures
2. Check for runtime errors in Vercel logs
3. If deploy-related, rollback immediately
4. If not deploy-related, check Supabase connectivity
5. Notify board and set ETA

### Playbook B: Scoring Stops Updating

**Symptoms:** Pool `refreshed_at` is old, `last_refresh_error` is set.

**Steps:**
1. Check `last_refresh_error` value for the pool
2. Check Slash Golf API status at [status.slashgolf.com](https://status.slashgolf.com)
3. Check cron job in Supabase: `select * from cron.job where jobname = 'four-hour-scoring-dispatch';`
4. Verify Vault secrets: `select * from vault.decrypted_secrets;`
5. Trigger on-demand refresh: `curl -X POST https://app-url/api/scoring/refresh -H 'Authorization: Bearer CRON_SECRET' -d '{"poolId":"..."}'`
6. If 409 (UPDATE_IN_PROGRESS), wait 60s and retry

### Playbook C: Deployment Failure

**Symptoms:** Vercel build fails or returns 5xx errors after deploy.

**Steps:**
1. **Do not debug in production.** Roll back immediately.
2. Revert the merge commit: `git revert <sha> && git push`
3. Notify board: "Deploy failed and has been rolled back. Awaiting instructions."
4. Do not re-deploy until board approves remediation plan.

### Playbook D: Database Migration Failure

**Symptoms:** Schema drift, errors after migration push.

**Steps:**
1. Identify the failing migration from error output
2. Fix the migration file locally
3. Do NOT modify the database directly
4. Push fixed migration: `npx supabase db push`
5. Verify with `npx supabase db diff`

### Playbook E: Supabase Outage

**Symptoms:** All Supabase operations fail, "Unable to connect" in UI.

**Steps:**
1. Check [status.supabase.com](https://status.supabase.com) for ongoing incidents
2. Wait for Supabase to resolve (no local fix available)
3. Communicate ETA to users
4. Document impact after resolution

---

## 4. Escalation Path

| Level | Who | When to Escalate |
|---|---|---|
| **L1** | Implementation Engineer | Initial response, initial mitigation |
| **L2** | Architecture Lead | Issue persists >30 minutes or requires code change |
| **L3** | CEO/Board | Production down >1 hour, data loss, security incident |

Escalate by posting a comment in the incident thread with `@architecture-lead` or `@ceo` as appropriate.

---

## 5. Post-Incident Review

After any P1 or P2 incident, schedule a post-incident review:

1. **Timeline** — What happened and when?
2. **Root cause** — Why did it happen?
3. **Impact** — Who was affected and for how long?
4. **Remediation** — What was done to fix it?
5. **Prevention** — What will change to prevent recurrence?

Document findings in `docs/solutions/` under the appropriate category (e.g., `workflow-issues/` for cron-related, `integration-issues/` for external API issues).

---

## 6. Related Documentation

| Document | Purpose |
|---|---|
| [Operations Guide](./operations.md) | Day-to-day ops, deployment |
| [Runbook](./runbooks/fantasy-golf-ops.md) | Detailed recovery procedures |
| [Setup Guide](./setup.md) | Environment and dependencies |