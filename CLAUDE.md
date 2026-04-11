# Fantasy Golf Pool

A commissioner-first web app for running private golf pools with live hole-by-hole scoring.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript (strict)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Real-time**: Supabase Subscriptions
- **Scoring API**: Slash Golf (Rapid API)

## Project Structure

```
src/
  app/
    (auth)/           # Sign in / Sign up
    (app)/            # Authenticated routes
      commissioner/    # Commissioner dashboard
      participant/     # Participant picks
    spectator/        # Public leaderboard
    api/              # API routes (scoring, webhooks)
  components/         # React components
  lib/
    supabase/         # Client, server, admin, types
    slash-golf/       # Slash Golf API client & types
    scoring.ts        # Best-ball scoring logic
    scoring-queries.ts # DB queries for scores
    pool-queries.ts   # Pool CRUD queries
    audit.ts          # Audit trail utilities
    golfer-detail.ts # Golfer scorecard formatting
    db/               # schema.sql, seed.sql
    __tests__/         # Unit tests (scoring, audit, golfer-detail)
supabase/
  migrations/          # Database migrations
  config.toml          # Supabase CLI config
docs/
  solutions/           # Documented solutions to past problems
  superpowers/        # BMAD workflow artifacts (specs, plans, reports)
```

## Key Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint
npx supabase db push  # Push migrations to remote DB
```

## Database Conventions

- Use `supabase/migrations/` for all schema changes
- Migrations are timestamped: `YYYYMMDDHHMMSS_description.sql`
- Run `npx supabase db push` to apply migrations
- `tournament_scores` = current state (one row per golfer per tournament)
- `tournament_score_rounds` = per-round archive (append-only)

## Scoring Rules

- **Format**: Best-ball (lowest score among 4 golfers per round)
- **Tiebreaker**: Total birdies across all 4 golfers
- **Tournament round**: Round ID 1-4 maps to Thu/Fri/Sat/Sun

## Critical Rules

- **Do not** couple scoring logic to Next.js handlers, React components, or Supabase SDK calls
- **Do not** make client UI the source of truth for auth, deadlines, or scoring state
- **Leaderboard freshness model**: the server owns staleness via a configurable threshold (currently 15m). The API triggers an upstream refresh on fetch when data is older than the threshold. The client re-fetches on: mount, realtime `scores` broadcasts, realtime channel reconnect (`SUBSCRIBED` after drop), and tab visibility change to `visible`. No fixed-interval polling. Always surface freshness/refreshing state in the UI so users can see when data is in-flight or stale.
- Keep business rules in `src/lib/scoring.ts` and pure utilities; not in page components
- Use server-side validation for all pool, pick, and scoring mutations
- Preserve visible freshness and lock-state messaging in UI

## Compound Engineering

This repo uses the compound engineering loop to prevent repeat mistakes. Documented learnings live in `docs/solutions/`, organized by category (`database-issues/`, `logic-errors/`, `integration-issues/`, `workflow-issues/`, `ui-bugs/`), each as a markdown file with YAML frontmatter (`module`, `tags`, `problem_type`, `git_refs`).

**Three-phase loop — apply on every non-trivial task:**

1. **Search first.** Before implementing a feature, fixing a bug, or designing a plan, grep `docs/solutions/` for anything that touches the same module or problem type. Use frontmatter tags and the `module` field to filter. If a prior solution exists, read it — then verify it's still accurate against current code before relying on it.
2. **Avoid known pitfalls during implementation.** Relevant findings from Step 1 should shape the plan, not just be read and forgotten.
3. **Document after completing.** If the task surfaced a non-obvious learning — a wrong premise, a subtle constraint, a bug that took more than one iteration to find, a rule that was almost violated — invoke the `compound-engineering:ce-compound` skill to write a new solution doc. If nothing was non-obvious, do not create a doc.

See `AGENTS.md` → "Compound Engineering Loop" for the full workflow, criteria for when to document (and when not to), and the solution-file template.

## Testing

- Scoring tests: `src/lib/__tests__/scoring.test.ts`
- Audit tests: `src/lib/__tests__/audit.test.ts`
- Golfer detail tests: `src/lib/__tests__/golfer-detail.test.ts`
- API route tests: `src/app/api/leaderboard/[poolId]/route.test.ts`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SLASH_GOLF_API_KEY
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

See `.env.local.example` for all required variables.
