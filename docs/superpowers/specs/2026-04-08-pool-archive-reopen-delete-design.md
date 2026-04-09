# Pool Archive, Reopen, and Delete Design

**Date:** 2026-04-08  
**Status:** Draft  
**Scope:** Commissioner pool lifecycle, read-only archived visibility, permanent deletion

## Overview

The current commissioner pool actions support starting a pool, ending a pool, and cloning a completed pool into a new one through `Reuse Pool`. The new requirement replaces that clone flow with three explicit lifecycle operations:

1. Reopen a locked pool back to `open`
2. Archive a completed pool so it disappears from normal lists but remains readable through direct links
3. Permanently delete an archived pool as a separate destructive action

The design keeps the existing deadline and scoring rules intact. Reopening does not move the deadline forward. It only restores a pool to `open` while the deadline is still in the future. Archived pools remain read-only and hidden from default dashboard lists, but direct URLs still resolve to a frozen view instead of a dead end.

## Goals

- Allow a commissioner to change a locked pool back to `open` without cloning a new pool.
- Replace `Reuse Pool` with `Archive Pool`.
- Hide archived pools from normal commissioner and participant pool lists.
- Keep archived pools accessible through direct links in read-only mode.
- Add a separate permanent delete action for archived pools.
- Preserve an auditable record of permanent deletions even though the deleted pool row itself will cascade away.

## Non-Goals

- No pool cloning or reuse flow.
- No deadline changes during reopen.
- No scoring logic changes.
- No changes to tournament polling or leaderboard ranking rules.
- No restore-from-delete capability.
- No unarchive action in v1. Archived is a terminal state before permanent delete.

## Current State

The pool status model is currently:

- `open`
- `live`
- `complete`

The current lifecycle is:

- `open -> live` via Start Pool
- `live -> complete` via End Pool
- `complete -> open` via `Reuse Pool` clone into a new pool

The main dashboard lists every commissioner pool in one section. Participant pool lists also surface every membership row. Join pages always render a join form if the invite code exists. Leaderboard and participant pages only understand the current three statuses.

## Proposed Lifecycle

### Statuses

Add a fourth status:

- `archived`

Meaning:

- `open` - editable and joinable before the deadline
- `live` - active tournament, picks locked
- `complete` - finished but still part of the active commissioner workflow
- `archived` - hidden from normal lists, read-only through direct links, eligible for permanent delete

### Allowed Transitions

| Current | Action | Next | Notes |
| --- | --- | --- | --- |
| `open` | Start | `live` | Same as today |
| `live` | Reopen | `open` | Allowed only while the deadline is still in the future |
| `complete` | Reopen | `open` | Allowed only while the deadline is still in the future |
| `live` | End | `complete` | Same as today |
| `complete` | Archive | `archived` | Replaces `Reuse Pool` |
| `archived` | Delete Permanently | deleted | Hard delete with tombstone record |

Reopen is a status reset, not a deadline reset. If the deadline has already passed, the action should fail with a clear error instead of creating an immediately locked pool.

## Data Model Changes

### `pools.status`

Update the `pools.status` check constraint and the TypeScript `PoolStatus` union to include `archived`.

### Deletion Tombstone

Permanent delete removes the pool row and its dependent rows. Because the existing `audit_events` table is pool-scoped, it would be deleted by cascade as well. To preserve a minimal record of the destructive action, add a small tombstone table such as `pool_deletions` with fields like:

- `id`
- `pool_id`
- `commissioner_id`
- `deleted_by`
- `status_at_delete`
- `snapshot` JSONB for the core pool metadata
- `deleted_at`

This table is not user-facing. It exists so permanent deletes leave behind an immutable administrative record even after the pool itself is gone.

### No Schema Changes to Scoring Tables

`tournament_scores`, `tournament_score_rounds`, and scoring snapshots do not need structural changes for this feature.

## Server-Side Behavior

### Reopen Pool

Add a server action that:

- Verifies the authenticated user is the commissioner
- Loads the pool row
- Allows reopening from `live` or `complete` back to `open`
- Rejects the action if the deadline has already passed
- Leaves the deadline unchanged
- Inserts an audit event such as `poolReopened`

### Archive Pool

Add a server action that:

- Verifies the authenticated user is the commissioner
- Requires the pool to be `complete`
- Updates status to `archived`
- Inserts an audit event such as `poolArchived`

### Permanent Delete

Add a server action that:

- Verifies the authenticated user is the commissioner
- Requires the pool to be `archived`
- Uses the admin client for the destructive write
- Inserts the tombstone row before deleting the pool
- Deletes the pool row, which cascades the member, entry, and pool-scoped audit rows
- Inserts or retains the tombstone record even if the delete fails after the snapshot write

Permanent delete should not be exposed for non-archived pools.

## UI and Routing Changes

### Commissioner Detail Page

Replace the current `Reuse Pool` button with:

- `Reopen Pool` for locked active pools that are still before their deadline
- `Archive Pool` for completed pools
- `Delete Permanently` for archived pools only

The commissioner detail page should still render the read-only data sections for archived pools, including entries and audit history links, but hide configuration editing and other mutation controls.

### Commissioner Dashboard

Split the dashboard into two sections:

- Active pools
- Archived pools

Archived pools should be visually muted and grouped separately so they are easy to find without polluting the default active list.

### Participant Pool List

Hide archived pools from the normal `My Pools` list.

### Join Flow

If a visitor opens a join link for an archived pool, do not show the join form. Instead, show an archived/read-only message and a path to the spectator leaderboard.

### Participant Picks Page

Archived pools should render read-only:

- No editable picks form
- Existing submitted picks remain visible if the user already has an entry
- Non-members should see an archived landing state or spectator handoff instead of a hard redirect away from the pool
- The page should still show freshness and lock state metadata

### Spectator Page and Leaderboard

Archived pools remain readable on public links. The leaderboard should continue to show:

- Pool status chip
- Refreshed-at timestamp
- Frozen trust/freshness state with archived-specific copy where the trust bar is shown

Background refresh should remain disabled for archived pools.

### Shared Status UI

Update shared status components so `archived` has its own label and muted styling. Any status switches that currently branch on `open`, `live`, and `complete` need an explicit archived case.

## Code Areas To Update

- `src/lib/supabase/types.ts`
- `src/lib/pool.ts`
- `src/lib/pool-queries.ts`
- `src/lib/entry-queries.ts`
- `src/components/StatusChip.tsx`
- `src/components/PoolCard.tsx`
- `src/components/TrustStatusBar.tsx`
- `src/components/LeaderboardEmptyState.tsx`
- `src/components/LockBanner.tsx`
- `src/components/leaderboard-trust-status.ts`
- `src/components/leaderboard.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/PoolActions.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` new
- `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` new
- `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` new
- `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx` removed
- `src/app/(app)/commissioner/page.tsx`
- `src/app/(app)/participant/pools/page.tsx`
- `src/app/(app)/participant/picks/[poolId]/page.tsx`
- `src/app/spectator/pools/[poolId]/page.tsx`
- `src/app/api/leaderboard/[poolId]/route.ts`
- `src/app/join/[inviteCode]/page.tsx`
- `src/app/join/[inviteCode]/actions.ts`
- new migration(s) under `supabase/migrations/`

## Error Handling

- Reopen after the deadline: return a clear message that the pool can no longer be reopened.
- Archive from any status other than `complete`: reject the action.
- Delete from any status other than `archived`: reject the action.
- If tombstone write fails, do not proceed with permanent deletion.
- If the delete fails after the tombstone is written, surface the delete failure and leave the tombstone record in place.

## Testing

Update or add tests for:

- Status transition helpers, including `archived`
- Commissioner reopen/archive/delete actions
- Removal of `Reuse Pool` clone behavior
- Dashboard grouping into active and archived sections
- Participant list filtering out archived pools
- Archived join flow and read-only participant/spectator rendering
- Leaderboard API behavior for archived pools, especially no background refresh
- Migration coverage for the new status constraint and deletion tombstone table

## Acceptance Criteria

- A commissioner can reopen a non-expired locked pool back to `open`.
- A completed pool can be archived and disappears from the normal pool lists.
- Archived pools remain readable through direct URLs but no longer accept joins or picks edits.
- A commissioner can permanently delete an archived pool through a separate action.
- The `Reuse Pool` clone flow is removed from the UI and server actions.
- The system keeps a small immutable record of permanent deletion even after the pool row is gone.
