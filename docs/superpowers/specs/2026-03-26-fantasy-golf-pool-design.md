# Fantasy Golf Pool — MVP Design Spec

**Date:** 2026-03-26  
**Status:** Approved  
**Stack:** Next.js (full-stack) + Supabase (DB, Auth, Real-time) + Slash Golf API

---

## Overview

A commissioner-first web app for running private golf pools. Commissioners create a pool by selecting a tournament, participants submit 4-golfer best-ball entries via a shareable link, and spectators view a live leaderboard with hole-by-hole updates.

---

## Pool Lifecycle

1. Commissioner creates pool → selects tournament, sets pool name
2. Commissioner shares pool URL with participants
3. Participants sign in, submit 4-golfer entry (editable until tee time)
4. Tournament starts → pool goes live
5. Scores update every 15 minutes via Slash Golf polling
6. Tournament ends → winner declared (or via tiebreaker)

---

## Pool Format

- **Best-ball:** each entry = 4 golfers
- **Score per hole:** lowest score among the 4 golfers
- **Total score:** sum of per-hole scores (lower is better — standard golf scoring)
- **Tiebreaker:** total birdies across all 4 golfers (higher wins)
- One active pool at a time
- One entry per participant

---

## User Roles

### Commissioner
- Creates and manages pool
- Selects tournament from list
- Sets pool name
- Monitors API sync status
- Views all entries

### Participant
- Signs in via Supabase Auth
- Submits 4-golfer entry
- Edits entry until tournament tee time
- Views leaderboard

### Spectator
-访问公共链接，无需登录
- Views live leaderboard
- Views all entry picks (no confidentiality requirement)

---

## Scoring

### Per-Hole Scoring
```
entry_score_hole_n = min(golfer_1_score, golfer_2_score, golfer_3_score, golfer_4_score)
```

### Total Score
```
total_score = sum(entry_score_hole_1 through entry_score_hole_18)
```

### Tiebreaker
If tied at end of tournament, winner = entry with highest total birdies across all 4 golfers.

---

## Live Scoring

### Polling
- **Interval:** Every 15 minutes during tournament hours
- **Source:** Slash Golf API (200 calls/month limit → ~32 calls per 4-day tournament)
- **Update flow:**
  1. Poll Slash Golf for current scores
  2. Compute per-hole scores for each entry
  3. Push updates via Supabase real-time subscriptions

### Error States
- **Failed API call:** Show last-known score with "Data delayed" indicator
- **Stale data (>30 min):** Alert in commissioner dashboard
- **Deadline passed:** Entry locked from editing

---

## Golfer Selection

Participants pick golfers via:
1. **Autocomplete search** — type name to find golfer
2. **Browsable/filterable list** — filter by country, sorting options

---

## Spectator View

Public URL (no sign-in required):
- Live leaderboard: entries ranked by total score
- All entry picks visible
- Last updated timestamp
- "Data delayed" indicator when applicable

---

## Data Model

### Pool
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | text | Pool name |
| tournament_id | text | External tournament ID |
| tournament_name | text | Display name (e.g., "2026 Masters") |
| deadline | timestamp | Picks lock at this time |
| status | enum | open / live / complete |
| created_at | timestamp | |

### Entry
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| pool_id | uuid | FK to Pool |
| user_id | uuid | FK to Supabase Auth |
| golfer_1_id | text | |
| golfer_2_id | text | |
| golfer_3_id | text | |
| golfer_4_id | text | |
| total_birdies | int | Computed, for tiebreaker |
| created_at | timestamp | |
| updated_at | timestamp | |

### Golfer
| Field | Type | Description |
|-------|------|-------------|
| id | text | External golfer ID |
| name | text | Full name |
| country | text | |

### Score (per hole, per golfer)
| Field | Type | Description |
|-------|------|-------------|
| golfer_id | text | FK to Golfer |
| tournament_id | text | |
| hole_1_score | int | |
| ... | | |
| hole_18_score | int | |
| total_birdies | int | |

---

## Out of Scope (v1)

- Multiple simultaneous pools
- Multiple entries per participant
- Entry confidentiality post-submission
- Webhook/event-driven updates (polling only)
- Private tournaments not supported by Slash Golf

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (React) |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Subscriptions |
| Scoring API | Slash Golf |

---

## File Structure

```
src/
  app/
    (auth)/
      sign-in/
      sign-up/
    (app)/
      commissioner/
        dashboard/
        pools/[poolId]/
      participant/
        pools/[poolId]/
        picks/[poolId]/
      spectator/
        pools/[poolId]/
    api/
      webhooks/
      scoring/
  components/
  lib/
    supabase.ts
    slash-golf.ts
    scoring.ts
    db/
```

---

## Next Steps

1. Set up Next.js + Supabase project
2. Design database schema in Supabase
3. Build commissioner pool creation flow
4. Build participant pick submission flow
5. Integrate Slash Golf polling
6. Build spectator leaderboard with real-time updates
7. Add error handling and status indicators
