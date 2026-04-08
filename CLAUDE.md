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
- **Do not** depend on realtime updates alone for leaderboard trust — keep polling + freshness indicators
- Keep business rules in `src/lib/scoring.ts` and pure utilities; not in page components
- Use server-side validation for all pool, pick, and scoring mutations
- Preserve visible freshness and lock-state messaging in UI

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
