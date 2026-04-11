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
7. **Server-owned staleness for scoring** — The server owns leaderboard freshness via a configurable threshold (currently 15m) enforced at read time in `GET /api/leaderboard/[poolId]`. Cron still runs as a background safety net, but the leaderboard API itself triggers an on-demand refresh when data is older than the threshold. The client does not poll on a fixed interval — see rule #3 under "Must NOT Do" and the detailed leaderboard refresh model in `CLAUDE.md`.

### Must NOT Do

1. **Do not** make client UI the source of truth for auth, deadlines, or scoring state
2. **Do not** couple scoring logic to Next.js route handlers or Supabase SDK calls
3. **Do not** add fixed-interval polling to the leaderboard client. Use event-driven triggers: mount, realtime `scores` broadcasts, realtime channel reconnect (`SUBSCRIBED` after drop), `visibilitychange` → `visible`, and a slow safety heartbeat (currently 120s). Always surface `isRefreshing` / `isFetching` / freshness state in the UI.
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

## Compound Engineering Loop

This repo uses compound engineering: every non-trivial task should leave the codebase *and* the knowledge base better. Documented learnings live in `docs/solutions/` and are the durable memory that prevents the same mistake twice. The loop only works if **searching before** is as disciplined as **documenting after** — knowledge that isn't retrieved doesn't compound.

### Directory layout

```
docs/solutions/
├── database-issues/     # schema, migrations, RLS, upserts, constraints
├── logic-errors/        # scoring bugs, ranking bugs, timezone bugs
├── integration-issues/  # Slash Golf API, Supabase client, external services
├── workflow-issues/     # cron, refresh scheduling, state machines
└── ui-bugs/             # component-level bugs, a11y, hydration
```

Each solution is a single markdown file with YAML frontmatter. The filename should be `short-kebab-summary-YYYY-MM-DD.md`.

### The loop — apply on every non-trivial task

**Phase 1: Search (before touching code or writing a plan)**

1. Identify the module(s) you'll touch. Examples: `scoring`, `leaderboard`, `api`, `auth`, `picks`, `audit`.
2. `rg -l '<module>' docs/solutions/` to find candidate files, then read frontmatter `module`, `tags`, and `problem_type` to filter.
3. Also grep by topic keyword: `rg 'refresh|freshness|stale' docs/solutions/` — prior bugs tend to cluster around the same concepts.
4. If a match exists, read the full file. Check `git_refs` against current `git log` to confirm the fix is still in place and the file paths still exist.
5. If the prior solution is obsolete (code moved, fix reverted, constraint removed), **update** the existing file with a new dated section rather than creating a second doc.

If your search returns nothing, say so in the conversation — that's a signal this area has no accumulated knowledge yet, and what you learn on this task is high-value to document.

**Phase 2: Apply (during implementation)**

- Let relevant findings shape the plan, not just sit in your head. If a prior solution warned about a specific pitfall, bake the fix into the plan's Tasks section, not as a "remember to avoid X" comment.
- If a planning document is involved (`docs/superpowers/plans/...`), cite the relevant solution file at the top so reviewers see the provenance.

**Phase 3: Document (after completing — gated on criteria below)**

Invoke the `compound-engineering:ce-compound` skill to create a new solution doc, but **only if the task meets at least one of the "when to document" criteria**. Rubber-stamping every task inflates the knowledge base with noise and makes Phase 1 searches less useful.

### When to document a new solution

Create a `docs/solutions/` entry if **any** of these are true:

- A bug took **more than one iteration to diagnose** (first hypothesis was wrong).
- An **unstated premise turned out to be false** (e.g., "I assumed the API returned X, it actually returns Y under condition Z").
- A **non-obvious constraint** was discovered — a race condition, a migration-safety gotcha, an RLS edge case, a Supabase SDK quirk, a Slash Golf API behavior not in the public docs.
- A project rule in `CLAUDE.md` or `AGENTS.md` was **almost violated** — document the near-miss so the rule has a concrete war story attached.
- A pattern **generalizes beyond this one task** — a shape of solution future work will want to copy.
- A **regression** was caused by a plausible-looking change, and the root cause is subtle.

### When NOT to document

Skip the solution doc if:

- The task was routine CRUD or a straightforward feature with no surprises.
- The learning is already captured in `CLAUDE.md`, `AGENTS.md`, or an existing `docs/solutions/` entry (update the existing one instead).
- The finding is ephemeral — a temporary workaround, a conversation-scoped decision, a one-off environment quirk.
- It's just a summary of what the diff does. Solution docs are for **why** and **what broke the assumption**, not for **what the code now looks like**.

A useful filter: *if a future agent encountering a similar-looking task wouldn't benefit from reading this, don't write it.*

### Solution file template

```markdown
---
title: Short imperative summary
date: YYYY-MM-DD
last_updated: YYYY-MM-DD
category: docs/solutions/<category>/
module: <scoring|leaderboard|api|auth|picks|audit|...>
problem_type: <logic_error|workflow_issue|database_issue|integration_issue|ui_bug>
component: <api|component|lib|migration|cron>
severity: <low|medium|high|critical>
tags: [comma, separated, topic, keywords]
git_refs: [<commit-sha-short>, <commit-sha-short>]
---

# <Title>

## Context

One short paragraph: what was the task, what broke or what was surprising, why did it matter? No retelling of the diff.

## Root cause / wrong premise

What assumption was wrong, or what constraint was hidden? Be specific. If there was a failing hypothesis before the real cause, write it down — future agents benefit from knowing the *tempting wrong answer*, not just the right one.

## Guidance

Actionable rules a future agent should follow when touching this area. Bullet points. Short.

## Verification

How to confirm the fix is still in place: a test name, a grep command, a file:line reference, a manual check.

## Related

- `CLAUDE.md` sections this reinforces
- Sibling `docs/solutions/` entries
- Related plans or specs under `docs/superpowers/`
```

### How the loop shows up in conversation

When starting work on this repo, an agent should say something like:

> Searched `docs/solutions/` for `leaderboard` / `freshness` — found `workflow-issues/on-demand-scoring-refresh-2026-04-08.md`, reading it now.

…and when finishing:

> This task surfaced a non-obvious constraint (the Supabase channel's first `SUBSCRIBED` event fires on initial connect, not just reconnect). That's worth documenting — invoking `compound-engineering:ce-compound` to write a new entry under `workflow-issues/`.

If neither statement fits the task, the loop was probably skipped. Don't skip it silently.

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

_Last updated: 2026-04-11_
