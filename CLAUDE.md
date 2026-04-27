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

These are the non-negotiable rules for the MVP. The full authoritative specification is at [`docs/rules-spec.md`](./docs/rules-spec.md).

### Game Rules

- [ ] **Entry size**: Exactly `picks_per_entry` golfers (default: 4). No duplicates within an entry.
- [ ] **Best-ball scoring**: Lowest `scoreToPar` among active golfers per round, summed across completed rounds.
- [ ] **Tiebreaker**: Total score (lower is better) → total birdies (higher is better) → shared rank.
- [ ] **Active golfers only**: `cut` and `withdrawn` golfers are excluded from best-ball calculation after they occur.
- [ ] **Round completion gating**: A round only counts if ALL golfers in the entry have `isComplete: true`.
- [ ] **Playoff holes**: Do NOT count toward MVP scoring.

### Locking Rules

- [ ] **Pick locks at pool deadline**: Lock instant = midnight (00:00) in the pool's configured timezone on the deadline date.
- [ ] **Pool status lock**: Non-`open` pools are always locked regardless of deadline.
- [ ] **All users subject to lock**: Commissioner picks lock the same as player picks.

### Data Architecture

- [ ] **Scoring logic is pure**: Keep in `src/lib/scoring.ts` and `src/lib/scoring/domain.ts`. No coupling to handlers, components, or Supabase SDK.
- [ ] **Server owns freshness**: Staleness threshold = 15 minutes. Client re-fetches on: mount, realtime broadcast, reconnect, visibility change.
- [ ] **Server-side validation**: All pool, pick, and scoring mutations must be validated server-side.
- [ ] **Archive before write**: Round data archived to `tournament_score_rounds` before writing current score.
- [ ] **Archive records exclude `round_status`**: Board-authorized rule to prevent circular dependencies.

### Spectator Visibility

- [ ] **Always surface freshness state**: Show users when data is in-flight or stale.
- [ ] **Always surface lock state**: Show users when picks are locked.

For detailed specifications, edge cases, and open questions, see [`docs/rules-spec.md`](./docs/rules-spec.md).

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
