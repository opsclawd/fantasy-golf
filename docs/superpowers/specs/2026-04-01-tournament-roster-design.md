# Tournament Roster Design

**Date:** 2026-04-01  
**Status:** Draft  
**Scope:** Tournament-scoped golfer roster for all pools on a tournament

---

## Problem

The current golfer search flow behaves like a shared catalog, but the app needs tournament-specific availability. A pool should not infer its golfers from a global master list; it should read from the tournament roster attached to that pool. Multiple pools can point at the same tournament, and all of them must see the same tournament golfers.

---

## Goals

- Store golfers at the tournament level, not as a global reusable catalog.
- Let many pools reference the same tournament roster.
- Seed a tournament roster when a commissioner sets up a pool for that tournament.
- Allow commissioner refreshes to repopulate the shared tournament roster.
- Allow commissioner manual adds to write into the same tournament roster so every pool on that tournament can use the golfer.

---

## Non-Goals

- Shared golfer catalog across unrelated tournaments.
- Pool-only golfer storage that cannot be reused by sibling pools on the same tournament.
- Participant-facing RapidAPI calls.
- Automatic cron-driven roster seeding in this phase.

---

## Architecture

### Source of truth

The tournament roster is the source of truth for golfer availability. A tournament roster can exist before any pool references it, but once a pool exists for that tournament, the pool reads directly from the tournament roster.

### Pool relationship

Each pool stores its `tournament_id` and uses that to query the tournament roster. If multiple pools reference the same tournament, they all see the same golfers.

### Commissioner actions

- `Refresh tournament field` fetches the tournament’s golfers from RapidAPI and upserts them into the tournament roster.
- `Add missing golfer` searches RapidAPI for a specific golfer and adds that golfer to the same tournament roster.
- `Refresh monthly catalog` is not part of the roster model in this phase and should not drive picker availability.

### Seeder flow

When a commissioner sets up a pool for a tournament, the roster may be seeded manually or through the refresh action. The roster itself is allowed to exist before any pool references it.

---

## Data Model

### `tournaments`

Keep tournament metadata as the anchor for roster identity.

Suggested fields:

- `id`
- `name`
- `year`
- `start_date`
- `end_date`

### `tournament_golfers`

Store golfers at the tournament level.

Suggested fields:

- `id` - local row id or external golfer id if the app already uses it
- `tournament_id` - foreign key to the tournament
- `external_player_id` - stable RapidAPI player id
- `name`
- `search_name`
- `country`
- `world_rank`
- `is_active`
- `source` - `refresh`, `manual_add`, or `seeded`
- `last_synced_at`

### `pools`

Keep the pool’s tournament reference as the bridge to the roster.

Suggested fields:

- `tournament_id`
- existing pool configuration fields remain unchanged

---

## User Flows

### Pool setup

1. Commissioner creates/configures a pool for a tournament.
2. The pool is tied to a `tournament_id`.
3. The tournament roster can be seeded immediately or later via refresh/manual add.
4. All pools attached to that tournament read the same roster.

### Refresh tournament field

1. Commissioner opens a pool.
2. They click `Refresh tournament field`.
3. The app fetches the tournament field from RapidAPI.
4. The app upserts golfers into `tournament_golfers` for that tournament.
5. All pools on that tournament see the updated roster.

### Add missing golfer

1. Commissioner searches RapidAPI for a golfer missing from the roster.
2. The golfer is inserted/upserted into `tournament_golfers` for the pool’s tournament.
3. All pools on that tournament immediately gain access to the golfer.

### Participant picker

1. Participant opens a pool.
2. The picker queries golfers for the pool’s tournament only.
3. It never uses a global golfer catalog to determine active availability.

---

## Error Handling

- If tournament roster loading fails, the commissioner page should still render and show a safe fallback state for roster controls.
- If a refresh/add action cannot record its run, it should fail closed and not claim success.
- If RapidAPI returns an unexpected payload, the sync should fail with a clear message instead of silently seeding bad roster data.
- If a tournament has no roster yet, the UI should treat that as an empty roster state rather than an error state.

---

## Testing

- Verify the roster queries load by `tournament_id`, not by global golfer state.
- Verify multiple pools using the same `tournament_id` read the same roster.
- Verify refresh upserts golfers into the tournament roster.
- Verify manual add writes into the same tournament roster.
- Verify the participant picker only reads from the tournament roster.
- Verify the UI still renders when roster loading fails and shows a safe fallback.

---

## Scope Check

This is a single feature slice with one shared source of truth and one clear read path. If future work needs cross-tournament reuse or a global golfer catalog, that should be a separate design and implementation phase.
