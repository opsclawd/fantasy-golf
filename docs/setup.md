# Setup Guide

**Date:** 2026-04-29
**Purpose:** Complete setup instructions for new developers joining the Fantasy Golf Pool project.

---

## Prerequisites

Before cloning, ensure you have:

- **Node.js 18+** — Check: `node --version`
- **npm 9+** or **pnpm 8+** — pnpm is preferred in this project
- **Git** — Check: `git --version`
- **Supabase account** — Sign up at [supabase.com](https://supabase.com)
- **Slash Golf API key** — Available via [RapidAPI](https://rapidapi.com slashgolf)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd fantasy-golf
pnpm install
```

---

## 2. Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in all required values:

| Variable | Where to Find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SLASH_GOLF_API_KEY` | RapidAPI dashboard → Slash Golf subscription |
| `CRON_SECRET` | Generate a strong random string: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

---

## 3. Supabase Project Setup

### 3.1 Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note the project URL and anon key (from Step 2)
3. Wait for the database to be provisioned

### 3.2 Link Your Local CLI

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

You can find your project ref in Supabase Dashboard → Settings → General.

### 3.3 Push Migrations

```bash
pnpm supabase db push
```

This applies all timestamped SQL migrations in `supabase/migrations/` to your linked project.

### 3.4 Configure Vault Secrets

The app uses Supabase Vault for production secrets. In development, these are also in `.env.local`, but the Vault entries are required for production:

```sql
-- In Supabase SQL Editor:
select vault.create_secret('app_url', 'https://your-app-url.com');
select vault.create_secret('cron_secret', 'your-cron-secret-value');
```

### 3.5 Enable pg_cron Extension

In Supabase Dashboard → Database → Extensions, enable `pg_cron`.

---

## 4. Running Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 5. Verifying Your Setup

### Check the App Loads

- [ ] Homepage renders without error
- [ ] Sign-in page loads
- [ ] Supabase connection indicator shows connected

### Check the Schema

```bash
npx supabase db diff
```

No pending migrations = schema matches migrations.

### Run the Test Suite

```bash
pnpm test
```

All tests should pass. See [docs/operations.md](./operations.md) if tests fail.

---

## 6. Common Setup Issues

### pg_cron Not Enabled

If the cron job migration fails, enable the extension manually:
```sql
create extension if not exists pg_cron;
```

### Migration Push Fails

If `pnpm supabase db push` fails, check the migration file and the Supabase dashboard for the current schema state.

### TypeScript Errors on First Build

Run `pnpm build` from a clean state. If errors appear about missing types, run `pnpm install` again.

---

## 7. Project Conventions

- **All schema changes** go in `supabase/migrations/` with timestamp prefix
- **Branches** follow `ops-NNN-short-description` pattern
- **Commits** are conventional: `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`
- **Tests** use Vitest; run `pnpm test` before committing

---

## 8. Where to Go Next

- **Operations:** See [docs/operations.md](./operations.md) for deployment and maintenance
- **Architecture:** See [docs/architecture/fantasy-golf-technical-architecture-analysis.md](./architecture/fantasy-golf-technical-architecture-analysis.md)
- **Rules:** See [docs/rules-spec.md](./rules-spec.md) for scoring rules
- **Existing runbooks:** See [docs/runbooks/fantasy-golf-ops.md](./runbooks/fantasy-golf-ops.md)