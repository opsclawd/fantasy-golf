# Fantasy Golf Pool

A commissioner-first web app for running private golf pools with live hole-by-hole scoring.

## Features

- **Commissioner Dashboard** — Create pools, select tournaments, manage pool lifecycle
- **Participant Picks** — Submit 4-golfer best-ball entries with autocomplete search
- **Live Leaderboard** — Real-time updates via Supabase, scoring from Slash Golf API
- **Spectator View** — Public leaderboard visible without sign-in

## Tech Stack

- **Frontend**: Next.js 14 (React)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Real-time**: Supabase Subscriptions
- **Scoring API**: Slash Golf

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Slash Golf API key

## Environment Setup

1. Clone the repository
2. Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

3. Fill in the values:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SLASH_GOLF_API_KEY` | Your Slash Golf API key |
| `CRON_SECRET` | Secret for securing the scoring cron endpoint |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., http://localhost:3000) |

## Database Setup

1. Create a new Supabase project
2. Run the schema SQL in `src/lib/db/schema.sql`
3. (Optional) Seed sample golfers with `src/lib/db/seed.sql`

### Schema Overview

- **pools** — Tournament pools created by commissioners
- **entries** — Participant entries (4 golfer picks per entry)
- **golfers** — Available golfers for selection
- **tournament_scores** — Live scoring data from Slash Golf

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Add the environment variables in Vercel dashboard
3. Deploy

### Supabase

1. Set up Supabase auth and database
2. Configure real-time subscriptions in Supabase dashboard
3. Deploy Next.js app

## Scoring Cron Job

The scoring API polls Slash Golf every 15 minutes during tournament hours. Configure a cron job to call:

```
GET /api/cron/scoring
Authorization: Bearer <CRON_SECRET>
```

On Vercel, use Vercel Cron with `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/scoring",
    "schedule": "*/15 * * * *"
  }]
}
```

## Project Structure

```
src/
  app/
    (auth)/           # Sign in / Sign up
    (app)/            # Authenticated routes
      commissioner/   # Commissioner dashboard
      participant/    # Participant picks
    spectator/        # Public leaderboard
    api/             # API routes
  components/        # React components
  lib/
    db/              # SQL schema
    scoring.ts       # Scoring logic
    slash-golf/      # Slash Golf API client
    supabase/        # Supabase client
```

## Development

```bash
npm run build    # Production build
npm run lint     # ESLint
```

## Pool Format

- Best-ball: lowest score among 4 golfers per hole
- Lower is better (standard golf scoring)
- Tiebreaker: total birdies across all 4 golfers
