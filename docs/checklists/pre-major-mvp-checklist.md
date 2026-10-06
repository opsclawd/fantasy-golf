# Pre-Major Tournament MVP Checklist

**Purpose:** Operational checklist for maintainers and commissioners prior to launching a fantasy golf pool for a major championship (The Masters, PGA Championship, U.S. Open, The Open Championship).  
**Target Audience:** Non-core maintainers, release operators, commissioners.  
**Estimated Completion Time:** 15–20 minutes.

---

## 1. Pre-Flight Configuration Verification

- [ ] **1.1 Verify Slash Golf Event & Tournament ID**
  - Check the Slash Golf schedule endpoint or query `/api/tournaments` to obtain the official `tournament_id` for the major.
  - Example: `401704253` for The Masters.
  - Verify tournament start date and round 1 scheduled date.

- [ ] **1.2 Verify Field / Golfer Roster Import**
  - Ensure the field for the upcoming major is seeded in `tournament_golfers`.
  - In PostgreSQL or Supabase SQL Editor:
    ```sql
    SELECT count(*), min(name), max(name)
    FROM tournament_golfers
    WHERE tournament_id = '<tournament-id>' AND is_active = true;
    ```
  - Verify field size is expected for the major (~85-100 golfers for Masters, ~156 for other majors).

- [ ] **1.3 Verify Production Environment Variables**
  - Confirm all 6 required environment variables are set in the hosting provider (Vercel) dashboard:
    - [ ] `NEXT_PUBLIC_SUPABASE_URL`
    - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - [ ] `SLASH_GOLF_API_KEY` (Sensitive)
    - [ ] `CRON_SECRET` (Sensitive)
    - [ ] `NEXT_PUBLIC_APP_URL`
    - [ ] `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)

- [ ] **1.4 Verify Supabase Vault Secrets & Cron Dispatcher**
  - Ensure Vault contains the production URL and cron secret matching `CRON_SECRET`:
    ```sql
    select * from vault.secrets;
    ```
  - Verify the 4-hour cron job exists and is active:
    ```sql
    select jobid, jobname, schedule, active from cron.job where jobname = 'four-hour-scoring-dispatch';
    ```

---

## 2. Pool Setup & Lock Boundary Verification

- [ ] **2.1 Create Pool as Commissioner**
  - Sign in to the app and create a new pool for the tournament.
  - Select format: `best_ball` (default).
  - Verify picks per entry: `4`.
  - Set deadline: Round 1 tee-off morning date.
  - Set timezone: Course local timezone (e.g. `America/New_York` for Augusta National).

- [ ] **2.2 Verify Pick Lock Calculation**
  - Verify lock time calculates to midnight local time (00:00) on the deadline date in the selected timezone.
  - Check `pools` record in Supabase:
    ```sql
    select id, name, status, deadline, timezone, invite_code from pools where id = '<pool-id>';
    ```

---

## 3. Entry Submission & Participant Experience

- [ ] **3.1 Test Participant Join Flow**
  - Open an incognito browser window and visit:
    `https://<app-domain>/join/<invite-code>`
  - Sign up or sign in as a test participant.
  - Confirm the participant is added to `pool_members` with role `player`.

- [ ] **3.2 Test 4-Golfer Entry Submission**
  - Select exactly 4 distinct golfers from the roster.
  - Confirm autocomplete and search filter operate smoothly.
  - Submit picks and confirm successful redirection to picks confirmation page.
  - Verify entry in database:
    ```sql
    select id, pool_id, user_id, array_length(golfer_ids, 1) as pick_count
    from entries
    where pool_id = '<pool-id>';
    ```
    Confirm `pick_count` = 4.

---

## 4. Scoring Pipeline & Leaderboard Verification

- [ ] **4.1 Test On-Demand Scoring Refresh**
  - Trigger a scoring refresh via curl:
    ```bash
    curl -X POST https://<app-domain>/api/scoring/refresh \
      -H "Authorization: Bearer <CRON_SECRET>" \
      -H "Content-Type: application/json" \
      -d '{"poolId": "<pool-id>"}'
    ```
  - Confirm response returns HTTP 200 with `{ "data": { "completedRounds": ..., "refreshedAt": "..." } }`.
  - Confirm `pools.last_refresh_error` is `null` and `pools.last_refresh_success_at` is set.

- [ ] **4.2 Verify Hole Scorecard Persistence (AC-5)**
  - Execute database verification query:
    ```sql
    SELECT golfer_id, round_id, count(*) as hole_count
    FROM tournament_holes
    WHERE tournament_id = '<tournament-id>'
    GROUP BY golfer_id, round_id
    ORDER BY golfer_id, round_id;
    ```
  - Verify completed rounds have 18 hole rows per golfer.

- [ ] **4.3 Test Public Spectator Leaderboard Route**
  - In an incognito browser window (without signing in), visit:
    `https://<app-domain>/spectator/pools/<pool-id>`
  - Confirm page renders without 401 or 404 error.
  - Confirm leaderboard displays:
    - [ ] Entry name and ranked position
    - [ ] Hole-by-hole best-ball score
    - [ ] Total birdies tiebreaker
    - [ ] Trust Status Bar showing "Scores current"
    - [ ] Honest freshness badge and timestamp

---

## 5. Major Tournament Sign-Off

When all steps above are verified:
- Pool is ready for commissioner distribution.
- Share invite link `https://<app-domain>/join/<invite-code>` with pool participants.
- Share spectator link `https://<app-domain>/spectator/pools/<pool-id>` with spectators and leaderboards.
