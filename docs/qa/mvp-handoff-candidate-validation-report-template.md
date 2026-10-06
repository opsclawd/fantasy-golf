# MVP Handoff Candidate Validation Report Template

**Candidate SHA:** `<pinned-candidate-sha>`  
**Evaluator (Human Operator):** `<operator-name>`  
**Date Executed:** `<YYYY-MM-DD>`  
**Target Environment:** `[ ] Staging | [ ] Production`

---

## 1. Environment & Configuration Check

- [ ] All 6 environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SLASH_GOLF_API_KEY`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Supabase Vault secrets verified (`app_url`, `cron_secret`)

## 2. Migration & Database Verification

- [ ] Migrations applied cleanly from baseline: `npx supabase db push`
- [ ] Table `tournament_holes` present with public read RLS policy
- [ ] Table `refresh_locks` present with service role access
- [ ] Extensions `pg_cron` and `pg_net` active
- [ ] Cron schedule `four-hour-scoring-dispatch` active

## 3. End-to-End Operational Smoke Test

- [ ] Step 1: Create Pool as Commissioner
- [ ] Step 2: Configure Tournament Roster
- [ ] Step 3: Participant Join via Invite Link
- [ ] Step 4: Participant Entry Submission (4 unique golfers)
- [ ] Step 5: Scoring Refresh Execution & Mutex Verification
- [ ] Step 6: PostgreSQL Scorecard Hole Persistence Verification:
  - 18 holes per round per golfer verified via SQL query
- [ ] Step 7: True Hole-by-Hole Best-Ball Ranking Verified
- [ ] Step 8: Unauthenticated Spectator Leaderboard Viewing
- [ ] Step 9: Freshness Indicator States Verified
- [ ] Step 10: Missing Hole Data Degraded State & Stale Fallback Verified

## 4. Disposition & Sign-off

- [ ] **GO** — Candidate approved for release
- [ ] **NO-GO** — Candidate rejected (see notes)

**Operator Signature:** ___________________________  
**Timestamp:** ___________________________  
**Notes:** `<operator-notes>`
