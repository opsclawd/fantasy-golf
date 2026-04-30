# Handoff Guide

**Date:** 2026-04-29
**Purpose:** Transfer of knowledge when responsibilities change between team members.

---

## 1. Key Personnel and Roles

| Role | Agent / Person | Responsibility |
|---|---|---|
| **Architecture Lead** | `architecture-lead` agent | Approves plans, designs, major changes |
| **Implementation Engineer** | `implementation-engineer` agent | Executes implementation plans, opens PRs |
| **Release/Ops** | Human or agent | Merges PRs, deploys, handles rollbacks |
| **CEO** | Human | Final escalation, board communication |

---

## 2. Repository Overview

**Repository:** Fantasy Golf Pool
**Location:** GitHub (connected to Vercel for deployment)
**Default Branch:** `main`
**Active Branch:** `main` (work happens in feature worktrees)

### Repo Structure

```
/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/           # Auth pages (sign-in, sign-up)
│   │   ├── (app)/            # Authenticated routes
│   │   │   ├── commissioner/ # Commissioner dashboard
│   │   │   └── participant/  # Participant picks
│   │   ├── spectator/        # Public leaderboard
│   │   └── api/              # API route handlers
│   ├── components/           # React components
│   └── lib/                  # Core logic
│       ├── supabase/         # Supabase clients (client, server, admin, types)
│       ├── slash-golf/       # Slash Golf API client
│       ├── scoring.ts        # Best-ball scoring logic
│       ├── scoring-queries.ts
│       ├── pool-queries.ts
│       ├── audit.ts
│       └── golfer-detail.ts
├── supabase/migrations/      # Timestamp-prefixed SQL migrations
├── docs/                     # Documentation
└── .worktrees/              # Feature worktrees (gitignored)
```

---

## 3. Tech Stack Summary

| Component | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript strict |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Scoring API | Slash Golf via RapidAPI |
| Hosting | Vercel (recommended) |
| Package Manager | pnpm |

---

## 4. Core Data Model

### Primary Tables

| Table | Purpose |
|---|---|
| `pools` | Tournament pools created by commissioners |
| `pool_members` | Links users to pools with roles (commissioner/player) |
| `entries` | Participant picks (array of golfer IDs) |
| `golfers` | Golfer catalog with sync metadata |
| `tournament_scores` | Current scoring state (one row per golfer) |
| `tournament_score_rounds` | Per-round archive (append-only) |
| `audit_events` | Audit trail for all pool mutations |

### Scoring Model

- **Round-based** (not hole-by-hole)
- Best-ball = lowest `scoreToPar` among 4 golfers per completed round
- Tiebreaker = total birdies (higher is better)
- Cut and withdrawn golfers excluded after they occur

---

## 5. Key API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/scoring` | POST | CRON_SECRET | Main scoring refresh (cron-triggered) |
| `/api/scoring/refresh` | POST | CRON_SECRET | On-demand refresh per pool |
| `/api/cron/scoring` | GET | None | Cron dispatcher relay |
| `/api/leaderboard/[poolId]` | GET | None | Public leaderboard |
| `/api/tournaments` | GET | None | Tournament list from Slash Golf |

---

## 6. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key | Yes |
| `SLASH_GOLF_API_KEY` | Slash Golf RapidAPI key | Yes |
| `CRON_SECRET` | Bearer token for cron endpoints | Yes |
| `NEXT_PUBLIC_APP_URL` | Public app URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for admin client | Yes (server-side only) |

---

## 7. Critical Workflows

### Scoring Refresh Flow

```
pg_cron (every 4 hours UTC)
  → GET /api/cron/scoring
  → POST /api/scoring (with CRON_SECRET)
  → Auto-lock open pools past deadline
  → refreshScoresForPool() fans out to all live pools on tournament
  → Fetches from Slash Golf, upserts to tournament_scores + tournament_score_rounds
  → Broadcasts via Supabase Realtime
  → Writes audit_events
```

### Pool Lifecycle

```
open → (deadline passes) → live → (commissioner closes) → complete → (archive) → archived
```

---

## 8. Common Tasks Reference

| Task | Command / Action |
|---|---|
| Push migrations | `npx supabase db push` |
| Run dev server | `pnpm dev` |
| Run tests | `pnpm test` |
| Production build | `pnpm build` |
| Lint | `pnpm lint` |
| Trigger score refresh | `curl -X POST /api/scoring/refresh -H 'Authorization: Bearer CRON_SECRET' -d '{"poolId":"..."}'` |

---

## 9. Where Documentation Lives

| Document | Location | Purpose |
|---|---|---|
| Setup Guide | `docs/setup.md` | New developer onboarding |
| Operations Guide | `docs/operations.md` | Day-to-day ops, deployment |
| Incident Response | `docs/incidents.md` | Incident procedures |
| Ops Runbook | `docs/runbooks/fantasy-golf-ops.md` | Detailed recovery procedures |
| Technical Architecture | `docs/architecture/fantasy-golf-technical-architecture-analysis.md` | System design reference |
| Rules Spec | `docs/rules-spec.md` | Scoring rules |
| Compound Engineering | `docs/solutions/` | Past problem solutions |

---

## 10. Onboarding a New Agent

When a new Implementation Engineer joins:

1. **Read these documents** (in order):
   - `docs/setup.md` — environment setup
   - `docs/operations.md` — day-to-day operations
   - `docs/runbooks/fantasy-golf-ops.md` — detailed runbook
   - `docs/architecture/fantasy-golf-technical-architecture-analysis.md` — system understanding
   - `docs/rules-spec.md` — scoring rules

2. **Understand the workflow:**
   - Architecture Lead creates and approves implementation plans
   - Implementation Engineer executes plans in isolated git worktrees
   - PRs opened against `main`, squash-merged by Release/Ops
   - All changes require an approved plan (no unplanned work)

3. **Key constraints:**
   - Never merge PRs (that's Release/Ops)
   - Never deploy anything
   - Never modify design specs or implementation plans
   - If a plan is wrong, stop and comment on the issue
   - TDD is not optional: write failing test first, then code

4. **Essential files to understand:**
   - `AGENTS.md` — agent rules and procedures
   - `CLAUDE.md` — project conventions and scoring rules
   - `src/lib/scoring.ts` — pure scoring domain logic
   - `src/lib/supabase/types.ts` — TypeScript types

---

## 11. Offboarding Notes

When transferring responsibilities:

1. Review any in-progress issues and reassign
2. Ensure all PRs are either merged or have a clear path
3. Transfer any pending deployments to Release/Ops
4. Document any unresolved incidents in the incident log

---

## 12. Emergency Contacts

| Escalation Level | Who | When |
|---|---|---|
| L1 | Implementation Engineer | Initial response, initial mitigation |
| L2 | Architecture Lead | Persists >30 min or needs code change |
| L3 | CEO / Board | Production down >1 hour, data loss, security |