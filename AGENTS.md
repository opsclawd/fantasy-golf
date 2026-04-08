# Fantasy Golf Pool — Agent Handbook

> Project-specific rules and patterns for AI agents implementing code in this repository. Read before starting any implementation.

---

## Project Overview

A commissioner-first web app for running private golf pools with live hole-by-hole scoring. Commissioners create pools, participants submit 4-golfer best-ball entries, and spectators view live leaderboards.

**Stack:** Next.js 14 (App Router) + Supabase (PostgreSQL + Auth + Real-time) + Slash Golf API

**Active development branch:** `main` (6 commits ahead of origin)

---

## Technology Stack

- Next.js `14.2.0` with App Router
- React `18` / React DOM `18`
- TypeScript `^5` with `strict: true`
- Supabase: `@supabase/supabase-js ^2.39.0`, `@supabase/ssr ^0.9.0`
- Tailwind CSS `^3.4.0`, PostCSS `^8`
- ESLint `^8`

---

## Folder Structure

```
src/
  app/
    (auth)/              # Sign in / Sign up flows
    (app)/               # Authenticated routes
      commissioner/       # Commissioner dashboard & pool management
      participant/        # Participant picks submission
    spectator/           # Public leaderboard (no auth required)
    api/                 # Route handlers
      scoring/           # Cron endpoint for Slash Golf polling
      leaderboard/       # Leaderboard API
      cron/              # Scheduled jobs
  components/            # Shared React components
  lib/
    supabase/           # client.ts, server.ts, admin.ts, types.ts
    slash-golf/         # API client and types for Slash Golf
    scoring.ts          # Best-ball scoring logic (pure functions)
    scoring-queries.ts   # DB queries for tournament_scores
    pool-queries.ts     # Pool CRUD queries
    audit.ts            # Audit trail computation
    golfer-detail.ts   # Golfer scorecard formatting
    db/                 # schema.sql, seed.sql (legacy)
    __tests__/          # Unit tests
    golfer-catalog/    # Golfer data management
    tournament-roster/   # Tournament roster queries
supabase/
  migrations/            # Timestamp-prefixed SQL migrations
docs/
  solutions/           # Documented solutions (see Knowledge Base below)
  superpowers/         # BMAD workflow artifacts (specs, plans, reports)
```

---

## Critical Implementation Rules

### Must Follow

1. **Keep scoring logic pure** — `src/lib/scoring.ts` contains domain logic (best-ball, ties, birdies, withdrawals). No framework imports, no DB calls.
2. **Server-side mutations only** — Pool, pick, and scoring mutations go in route handlers or server actions. Never push sensitive writes from client components.
3. **RLS on all public tables** — Supabase Row Level Security is enforced. Use `createAdminClient()` for server-side operations that bypass RLS.
4. **Preserve audit trail** — Every scoring mutation, pool status change, and entry lock should create an `audit_events` entry.
5. **Freshness indicators** — Always show `refreshed_at` timestamp and lock state. Never silently display stale data as current.
6. **Schema changes via migrations** — All DB changes go in `supabase/migrations/` with timestamp prefix. Never modify schema directly in Supabase dashboard.
7. **Poll-based scoring** — Slash Golf API is polled periodically (not real-time). Realtime is a nice-to-have; polling + snapshots are the source of truth.

### Must NOT Do

1. **Do not** make client UI the source of truth for auth, deadlines, or scoring state
2. **Do not** couple scoring logic to Next.js route handlers or Supabase SDK calls
3. **Do not** depend on realtime updates alone for leaderboard trust
4. **Do not** add paid-play or payout complexity
5. **Do not** hide scoring failures — surface stale data, lock state, and fallback behavior explicitly

---

## Scoring Architecture

### Data Model

```
tournament_scores          # Current state (one row per golfer)
├── golfer_id, tournament_id (unique)
├── round_id               # Latest completed round
├── total_score, position, total_birdies, status
└── updated_at

tournament_score_rounds    # Immutable archive (one row per round)
├── golfer_id, tournament_id, round_id (unique)
├── strokes, score_to_par, course_id, course_name
├── round_status, position, total_score
└── ... full round snapshot from API
```

### Scoring Flow

1. Cron calls `/api/scoring` → fetches from Slash Golf API
2. API returns `rounds[]` array with per-round stroke data
3. Each round written to `tournament_score_rounds` (append-only)
4. Latest round data written to `tournament_scores` (upsert)
5. Leaderboard ranked by `total_score` (lower = better)
6. Tiebreaker: `total_birdies` (higher = better)

### Key Functions (`src/lib/scoring.ts`)

- `calculateEntryTotalScore()` — best-ball total across golfers
- `calculateEntryBirdies()` — sum of birdies for tiebreaker
- `deriveCompletedRounds()` — max round_id from scores
- `rankEntries()` — full ranking with tie handling

---

## Testing Conventions

| Test File | What It Tests |
|-----------|---------------|
| `src/lib/__tests__/scoring.test.ts` | Best-ball logic, tiebreaker, withdrawals |
| `src/lib/__tests__/audit.test.ts` | Score diff computation, audit details |
| `src/lib/__tests__/golfer-detail.test.ts` | Scorecard formatting, contribution calc |
| `src/app/api/leaderboard/[poolId]/route.test.ts` | API response shape |

Run tests: `npm test` (via Vitest)

---

## Database Migrations

```bash
# Create new migration
# Edit: supabase/migrations/YYYYMMDDHHMMSS_description.sql

# Apply to remote
npx supabase db push

# Check migration status
npx supabase migration list
```

**Important:** `tournament_scores` and `tournament_score_rounds` use `UNIQUE` constraints for upsert operations. Always use `onConflict` in Supabase upserts.

---

## Supabase CLI

```bash
npx supabase db push        # Push migrations
npx supabase migration list # Check status
npx supabase link           # Link to project (first time)
```

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL       # e.g., https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Public anon key
SLASH_GOLF_API_KEY            # Rapid API key for Slash Golf
CRON_SECRET                   # Bearer token for /api/cron/scoring
NEXT_PUBLIC_APP_URL           # e.g., http://localhost:3000
```

---

## Knowledge Base: `docs/solutions/`

Documented solutions to past problems are stored in `docs/solutions/[category]/` with YAML frontmatter.

**Categories:**
- `database-issues/` — schema, migrations, query problems
- `logic-errors/` — scoring bugs, incorrect calculations
- `integration-issues/` — external API problems
- `ui-bugs/` — component-level bugs

**Before implementing features or debugging issues in documented areas:**
1. Search `docs/solutions/` for relevant past solutions
2. Check frontmatter fields: `module`, `tags`, `problem_type`, `git_refs`
3. Cross-reference with `git_refs` to verify fix is still current

**To document a new solution:** Use `/ce:compound` after solving a non-trivial problem.

---

## Current Project State

- **Branch:** `main` (6 commits ahead of `origin/main`)
- **Recent work:** Migrated from hole-by-hole to round-based scoring model
- **Pending:** `git push` to sync local commits

---

## Quick Reference

| Task | Command/Action |
|------|---------------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Run tests | `npm test` |
| Push migrations | `npx supabase db push` |
| Commit changes | `git commit -m "message"` |
| Push to remote | `git push` |

---

_Last updated: 2026-04-08_
