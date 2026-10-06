---
title: Grant public RLS read on tournament holes and ensure baseline migration bootstrap
date: 2026-10-05
last_updated: 2026-10-05
category: docs/solutions/database-issues/
module: leaderboard
problem_type: database_issue
component: migration
severity: high
tags: [rls, tournament-holes, spectator, baseline-migration, fresh-db, migrations]
git_refs: []
---

# Grant public RLS read on tournament holes and ensure baseline migration bootstrap

## Context

During the MVP handoff verification (Issue #61), two database constraints prevented clean end-to-end operation on fresh deployments:
1. Unauthenticated spectator visits to the live leaderboard (`/spectator/pools/[poolId]`) loaded 0 hole rows and degraded to 0 completed rounds despite active scoring data existing in the database.
2. Running `npx supabase db push` against an empty Supabase database failed on the initial migration (`20260331100000_add_golfer_catalog_metadata.sql`) with `relation "golfers" does not exist`.

## Root cause / wrong premise

1. **Missing Public Read Policy on `tournament_holes`:** When `tournament_holes` was created (`20260425190000_create_tournament_holes.sql`), RLS was enabled with permissions granted exclusively to `service_role`. Spectator reads execute through `createClient()` using the public anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Under RLS without an anonymous SELECT policy, PostgreSQL returned an empty set (`[]`). In turn, `validateHoleDataCompleteness()` interpreted the 0 returned hole rows as incomplete data, triggering fallback to round 0 and flagging the leaderboard as degraded.
2. **Missing Initial Baseline Migration:** Initial project schema definitions (`pools`, `entries`, `golfers`, `tournament_scores`, `audit_events`) existed only in `src/lib/db/schema.sql` rather than in a timestamped migration file. Migrations began with `20260331100000_add_golfer_catalog_metadata.sql`, which ran `ALTER TABLE golfers`. Without manual SQL execution in the web dashboard, CLI pushes against a fresh environment failed.

## Guidance

- **Public Read Access on Ingested Score Data:** All tournament scoring tables that back public leaderboards (`tournament_scores`, `tournament_score_rounds`, `tournament_holes`) must grant `SELECT` to `anon` and `authenticated` roles with a permissive RLS policy (`USING (true)`).
- **Service Role Write Exclusivity:** Preserve write exclusivity (`INSERT`, `UPDATE`, `DELETE`) strictly for `service_role` on scoring tables.
- **Zero-Tribal-Knowledge Migrations:** Always provide an initial baseline migration (`20260330000000_baseline_schema.sql` preceding all other timestamped migrations) so that `npx supabase db push` can provision an entire clean database without dashboard copy-pasting.

## Verification

- `supabase/migrations/20260330000000_baseline_schema.sql` establishes base tables before incremental alters.
- `supabase/migrations/20260501000000_grant_public_tournament_holes_read.sql` grants public SELECT on `tournament_holes`.
- Vitest unit tests in `src/lib/__tests__/e2e-mvp-smoke.test.ts` verify Step 8 (unauthenticated spectator read) succeeds with 200 and completed rounds.

## Related

- `AGENTS.md` (RLS on all public tables rule)
- `docs/runbooks/fantasy-golf-ops.md` (Section 3 and Playbook E)
- `supabase/migrations/20260425190000_create_tournament_holes.sql`
