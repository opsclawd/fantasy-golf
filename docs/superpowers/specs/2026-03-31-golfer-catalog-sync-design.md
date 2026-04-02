# Golfer Catalog Sync Design

**Date:** 2026-03-31  
**Status:** Draft  
**Stack:** Next.js 14 + Supabase + RapidAPI Live Golf Data

---

## Overview

The current golfer picker searches only the local `golfers` table. That keeps the participant experience fast, but it fails whenever the local catalog is incomplete or stale. RapidAPI has a working player search endpoint, but the app cannot call it for every participant search because the account is limited to 250 API calls per month.

The new design treats RapidAPI as a commissioner-only catalog maintenance source, not a participant search backend. Participants always search the local database. Commissioners get controlled tools to refresh the catalog on a schedule, prepare it for upcoming tournaments, and manually add missing golfers when needed.

---

## Goals

- Keep participant golfer search fully DB-backed and quota-free.
- Maintain a local golfer catalog that is broad enough for likely upcoming tournament fields.
- Use RapidAPI only for scheduled catalog maintenance or explicit commissioner actions.
- Prevent duplicate golfer imports and accidental quota burn.
- Surface sync status, failures, and monthly call usage to commissioners.

---

## Non-Goals

- Real-time participant search against RapidAPI.
- Full import of every golfer in the external provider.
- Automatic daily background refreshes.
- Opening catalog-management actions to non-commissioners.

---

## User Experience

### Participant flow

- The golfer picker continues to search the local `golfers` table only.
- Search should feel immediate and should not depend on RapidAPI availability.
- If the catalog is healthy, participants never notice the external sync system.

### Commissioner flow

Commissioners get a small catalog-management surface in the commissioner area with four capabilities:

1. Refresh the monthly baseline catalog.
2. Run a pre-tournament refresh for the selected tournament.
3. Search RapidAPI for a missing golfer and add that golfer to the local catalog.
4. View last sync status, last error, and monthly API call usage.

If RapidAPI is unavailable, the commissioner still sees the current local catalog and the last successful sync state.

---

## Architecture

### Core rule

Participant search never calls RapidAPI. RapidAPI is used only by server-side catalog maintenance actions.

### Source of truth

The local Supabase `golfers` table remains the source of truth for picker search, entry rendering, commissioner views, and downstream golfer lookups.

### External API role

RapidAPI Live Golf Data is treated as a server-only enrichment source used to:

- seed the monthly baseline golfer catalog,
- refresh golfers likely to appear in an upcoming tournament field,
- add one-off missing golfers that commissioners explicitly request.

### Sync strategy

- `Monthly baseline sync`: runs once per month to upsert a broad set of likely-to-appear golfers.
- `Pre-tournament sync`: runs on demand when a commissioner wants the catalog aligned to an upcoming tournament.
- `Manual add missing golfer`: commissioner-only lookup that imports a specific missing player into the local catalog.

---

## Data Model Changes

### `golfers` table

Keep the current table, but expand it so the catalog can support sync state and better search behavior.

Suggested fields:

- `id` - local primary key or stable external player id if the app already relies on it.
- `name` - display name.
- `search_name` - normalized lowercase search string used for matching.
- `country` - golfer country.
- `world_rank` - nullable ranking field when available.
- `is_active` - whether the golfer should remain searchable in the active catalog.
- `source` - how the golfer entered the catalog, such as `monthly_sync`, `tournament_sync`, or `manual_add`.
- `external_player_id` - stable RapidAPI player id for dedupe and updates.
- `last_synced_at` - timestamp of the latest successful refresh.

### `golfer_sync_runs` table

Add an audit table for quota tracking and operational visibility.

Suggested fields:

- `id`
- `run_type` - `monthly_baseline`, `pre_tournament`, `manual_add`
- `requested_by`
- `tournament_id` - nullable
- `api_calls_used`
- `status` - `success`, `failed`, `blocked`
- `summary`
- `error_message`
- `created_at`

This table lets the app calculate monthly usage and enforce budget rules before new syncs start.

---

## Sync Rules

### Monthly baseline sync

- Runs once per month.
- Populates a broad local catalog of golfers likely to appear in upcoming fantasy-relevant tournaments.
- Uses a cheap broad source such as rankings data when available.
- Upserts existing golfers instead of deleting and recreating them.
- Does not clear the catalog if the external fetch fails.

### Pre-tournament sync

- Runs on demand from a commissioner-only action.
- Refreshes the catalog toward a selected tournament's expected field or the best available proxy for that field.
- Updates existing golfers and inserts missing ones.
- Reuses stored `external_player_id` values so the same golfers are not re-created.

### Manual missing-golfer add

- Commissioner-only.
- Uses RapidAPI search to find a single missing golfer.
- Prevents duplicate imports by checking `external_player_id` first.
- Makes the golfer immediately available to participant search after the import succeeds.

---

## Quota Policy

The system must make API consumption visible and predictable.

- Store every sync or manual lookup in `golfer_sync_runs`.
- Show a monthly usage meter in the commissioner interface.
- Warn commissioners when usage reaches a soft threshold.
- Block non-essential bulk refreshes near the monthly cap.
- Preserve a small call reserve for emergency manual missing-golfer adds.

Default thresholds:

- Soft warning at `200` calls.
- Block bulk refreshes at `235` calls.
- Allow limited manual adds until `250` calls if the action is still within quota.

These numbers can live in server-side config so they are easy to adjust later.

---

## Failure Handling

- Participant picker continues working from the local DB even when RapidAPI is down.
- Failed syncs never wipe the existing `golfers` table.
- Sync failures record the error in `golfer_sync_runs`.
- Commissioner UI shows the last successful sync time and the latest failure message.
- Duplicate manual imports are treated as successful no-op updates rather than errors.

---

## Security and Permissions

- All RapidAPI access stays server-side.
- Participant-facing components cannot access the RapidAPI key.
- Catalog maintenance actions must verify commissioner permissions before running.
- Non-commissioners should receive authorization failures for refresh and manual-add actions.

---

## Codebase Fit

### Existing surfaces

- `src/components/golfer-picker.tsx` remains DB-backed and should eventually query a normalized searchable catalog.
- `src/app/(app)/participant/picks/[poolId]/page.tsx` and related participant flows continue to read golfer names from Supabase.
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx` is the most natural place to expose catalog-management controls, unless a dedicated admin page is cleaner.

### New server-side boundary

Add a dedicated server-only catalog module under `src/lib/` for:

- RapidAPI client wrappers,
- catalog upsert logic,
- quota checks,
- sync run recording,
- admin actions.

This keeps the external API integration isolated from picker UI logic.

---

## Verification Strategy

- Test that participant picker behavior still works when RapidAPI maintenance actions fail.
- Test that manual add imports a golfer once and does not duplicate on repeat.
- Test that quota thresholds block bulk sync actions when the monthly budget is nearly exhausted.
- Test that only commissioners can run maintenance actions.
- Test that a newly added golfer becomes searchable in the local picker flow.

---

## Rollout Plan

1. Strengthen the local golfer catalog and search fields.
2. Add commissioner-only maintenance actions and quota tracking.
3. Wire the commissioner UI to sync status and manual add tools.
4. Keep participant search DB-only throughout the rollout.

This order fixes the broken search problem by making the local catalog trustworthy without exposing participants to the external API budget.
