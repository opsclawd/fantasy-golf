# Fantasy Golf Pool

A commissioner-first web app for running private golf pools with live round-by-round scoring.

## Features

- **Commissioner Dashboard** — Create pools, select tournaments, manage pool lifecycle
- **Participant Picks** — Submit 4-golfer best-ball entries with autocomplete search
- **Live Leaderboard** — Real-time updates via Supabase, scoring from Slash Golf API
- **Spectator View** — Public leaderboard visible without sign-in

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Scoring API**: Slash Golf (RapidAPI)
- **Hosting**: Vercel (recommended)

## Prerequisites

- Node.js 18+
- pnpm 8+ (preferred) or npm
- Supabase account
- Slash Golf API key (RapidAPI)

## Quick Start

```bash
git clone <repo-url>
cd fantasy-golf
pnpm install
cp .env.local.example .env.local
# Fill in environment variables
pnpm dev
```

For detailed setup instructions, see [docs/setup.md](./docs/setup.md).

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SLASH_GOLF_API_KEY` | Slash Golf API key |
| `CRON_SECRET` | Bearer token for scoring cron endpoint |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g., http://localhost:3000) |

## Database Setup

Migrations are in `supabase/migrations/` with timestamp prefixes. To apply:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

See [docs/setup.md](./docs/setup.md) for full Supabase setup steps.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard (mark `CRON_SECRET` as sensitive)
3. Push to `main` — Vercel auto-deploys

### Manual Deploy

```bash
pnpm build
pnpm start
```

## Scoring

### Scoring Model

- **Round-based** best-ball (lowest score among 4 golfers per completed round)
- Lower total score is better
- Tiebreaker: total birdies across all 4 golfers (higher is better)
- Cut and withdrawn golfers excluded after they occur

### Scoring Cron

Supabase `pg_cron` runs every 4 hours UTC:

```
pg_cron → GET /api/cron/scoring → POST /api/scoring (with CRON_SECRET)
  → Auto-lock open pools past deadline
  → refreshScoresForPool() fans out to all live pools on same tournament
  → Fetches from Slash Golf, upserts tournament_scores + tournament_score_rounds
  → Broadcasts ranked leaderboards via Supabase Realtime
  → Writes audit_events
```

On-demand refresh: `POST /api/scoring/refresh` with pool ID.

## Project Structure

```
src/
  app/
    (auth)/           # Sign in / Sign up
    (app)/            # Authenticated routes
      commissioner/   # Commissioner dashboard
      participant/    # Participant picks
    spectator/        # Public leaderboard
    api/              # API routes (scoring, leaderboard, cron)
  components/         # React components
  lib/
    supabase/         # client, server, admin, types
    slash-golf/       # Slash Golf API client & types
    scoring.ts        # Best-ball scoring logic (pure)
    scoring-queries.ts
    pool-queries.ts
    audit.ts
    golfer-detail.ts
    golfer-catalog/
    tournament-roster/
supabase/migrations/  # Timestamp-prefixed SQL migrations
docs/
  setup.md           # New developer onboarding
  operations.md      # Day-to-day ops
  incidents.md       # Incident response
  handoff.md         # Role transfer guide
  runbooks/          # Detailed runbooks
  architecture/      # Technical architecture docs
  solutions/         # Compound engineering solutions
```

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Run tests (Vitest)
```

## Key Documentation

| Document | Purpose |
|---|---|
| [docs/setup.md](./docs/setup.md) | New developer setup |
| [docs/operations.md](./docs/operations.md) | Deployment and maintenance |
| [docs/incidents.md](./docs/incidents.md) | Incident response |
| [docs/handoff.md](./docs/handoff.md) | Role transfer and onboarding |
| [docs/rules-spec.md](./docs/rules-spec.md) | Scoring rules reference |
| [docs/runbooks/fantasy-golf-ops.md](./docs/runbooks/fantasy-golf-ops.md) | Detailed ops runbook |