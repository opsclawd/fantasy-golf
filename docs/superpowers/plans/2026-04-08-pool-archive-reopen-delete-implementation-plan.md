# Pool Archive, Reopen, and Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Reuse Pool` with a clearer lifecycle: commissioners can reopen a completed pool before the deadline, archive a completed pool, and permanently delete archived pools.

**Architecture:** Keep lifecycle rules in `src/lib/pool.ts`, persistence in `src/lib/pool-queries.ts` and `src/lib/entry-queries.ts`, and UI behavior in the existing React pages/components. Add one new pool status, `archived`, plus a tombstone table for permanent deletes. Archived pools should be hidden from normal lists but still readable through direct links.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/PostgreSQL, Vitest, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
| --- | --- | --- |
| Create | `supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql` | Add `archived` to the `pools.status` check constraint and create `pool_deletions` |
| Modify | `src/lib/supabase/types.ts` | Add `archived` to `PoolStatus` and define `PoolDeletion` |
| Modify | `src/lib/pool.ts` | Update status transitions and add `canReopenPool` |
| Modify | `src/lib/__tests__/pool.test.ts` | Test the new status transitions and reopen helper |
| Modify | `src/lib/__tests__/picks.test.ts` | Prove archived pools still count as locked |
| Modify | `src/lib/entry-queries.ts` | Hide archived pools from member pool lists |
| Create | `src/lib/__tests__/entry-queries.test.ts` | Verify archived pools are filtered out |
| Modify | `src/lib/pool-queries.ts` | Add tombstone and delete helpers |
| Modify | `src/lib/__tests__/pool-queries.test.ts` | Test tombstone helper behavior |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | Add reopen, archive, and delete server actions |
| Create | `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` | Button for reopening a completed pool |
| Create | `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx` | Button for archiving a completed pool |
| Create | `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` | Button for permanently deleting an archived pool |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts` | Add reopen/archive coverage |
| Create | `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts` | Cover the destructive delete path |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | Replace `Reuse Pool` with reopen/archive/delete buttons |
| Modify | `src/app/(app)/commissioner/page.tsx` | Split the dashboard into active and archived sections |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx` | Show `Archived` as its own status label |
| Modify | `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` | Show archived-specific config lock copy |
| Modify | `src/components/StatusChip.tsx` | Add archived status styling and label |
| Modify | `src/components/TrustStatusBar.tsx` | Add archived lock text |
| Modify | `src/components/LockBanner.tsx` | Add archived lock text |
| Modify | `src/components/__tests__/StatusComponentsA11y.test.tsx` | Verify archived status chip accessibility |
| Modify | `src/components/__tests__/CommissionerCommandCenter.test.tsx` | Verify archived status label in the command center |
| Modify | `src/components/__tests__/TrustStatusBar.test.tsx` | Verify archived lock copy |
| Modify | `src/components/__tests__/LockBanner.test.tsx` | Verify archived banner copy |
| Modify | `src/components/__tests__/leaderboard.test.ts` | Verify archived leaderboard trust header |
| Modify | `src/components/leaderboard-trust-status.ts` | Render the trust header for archived pools |
| Modify | `src/components/LeaderboardEmptyState.tsx` | Add archived empty-state copy |
| Modify | `src/components/__tests__/LeaderboardEmptyState.test.tsx` | Verify archived empty-state copy |
| Modify | `src/app/spectator/pools/[poolId]/page.tsx` | Show the trust bar for archived pools |
| Modify | `src/app/join/[inviteCode]/page.tsx` | Show archived read-only invite pages |
| Modify | `src/app/join/[inviteCode]/actions.ts` | Reject archived pools in the join action |
| Create | `src/app/join/[inviteCode]/actions.test.ts` | Verify archived join rejection |
| Modify | `src/app/(app)/participant/picks/[poolId]/page.tsx` | Keep archived pools read-only instead of redirecting away |
| Modify | `src/app/api/leaderboard/[poolId]/route.test.ts` | Verify archived pools do not trigger refresh |
| Remove | `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx` | Delete the old clone-based reuse UI |

---

## Task 1: Add archived status and reopen rules

**Files:**
- Create: `supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/pool.ts`
- Modify: `src/lib/__tests__/pool.test.ts`
- Modify: `src/lib/__tests__/picks.test.ts`

Do this first. Nothing else should depend on the old three-status model after this task is done.

- [ ] **Step 1: Add the failing tests first**

In `src/lib/__tests__/pool.test.ts`, delete the old `buildClonePoolInput` describe block and replace it with tests for the new lifecycle:

Update the import list at the top of the file to include `canReopenPool`.

```ts
describe('canTransitionStatus', () => {
  it('allows complete -> open', () => {
    expect(canTransitionStatus('complete', 'open')).toBe(true)
  })

  it('allows complete -> archived', () => {
    expect(canTransitionStatus('complete', 'archived')).toBe(true)
  })

  it('blocks archived -> anything', () => {
    expect(canTransitionStatus('archived', 'open')).toBe(false)
    expect(canTransitionStatus('archived', 'live')).toBe(false)
    expect(canTransitionStatus('archived', 'complete')).toBe(false)
  })
})

describe('canReopenPool', () => {
  it('allows a completed pool to reopen before the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'))

    expect(
      canReopenPool('complete', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(true)

    vi.useRealTimers()
  })

  it('blocks reopen after the deadline has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'))

    expect(
      canReopenPool('complete', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(false)

    vi.useRealTimers()
  })

  it('blocks reopen for any non-complete pool', () => {
    expect(
      canReopenPool('live', '2026-04-09T00:00:00+00:00', 'America/New_York')
    ).toBe(false)
  })
})

describe('pool archive migration', () => {
  it('adds archived status and the pool_deletions table', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql'
      ),
      'utf8'
    )

    expect(migration).toContain("check (status in ('open', 'live', 'complete', 'archived'))")
    expect(migration).toContain('create table if not exists public.pool_deletions')
  })
})
```

In `src/lib/__tests__/picks.test.ts`, add archived lock coverage:

Update the import list at the top of the file to include `isCommissionerPoolLocked`.

```ts
it('returns true for archived pools', () => {
  expect(
    isPoolLocked(
      'archived',
      '2099-04-10T08:00:00Z',
      'America/New_York',
      new Date('2099-04-09T08:00:00Z')
    )
  ).toBe(true)
})

it('treats archived pools as commissioner-locked too', () => {
  expect(
    isCommissionerPoolLocked(
      'archived',
      '2099-04-10T08:00:00Z',
      'America/New_York',
      new Date('2099-04-09T08:00:00Z')
    )
  ).toBe(true)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npx vitest run src/lib/__tests__/pool.test.ts src/lib/__tests__/picks.test.ts
```

Expected: failures for the new archived cases because the status, helper, and migration do not exist yet.

- [ ] **Step 3: Implement the migration and core helper changes**

Create `supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql` with this shape:

```sql
alter table public.pools drop constraint if exists pools_status_check;

alter table public.pools
  add constraint pools_status_check
  check (status in ('open', 'live', 'complete', 'archived'));

create table if not exists public.pool_deletions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null unique,
  commissioner_id uuid references auth.users(id) on delete set null,
  deleted_by uuid references auth.users(id) on delete set null,
  status_at_delete text not null
    check (status_at_delete in ('open', 'live', 'complete', 'archived')),
  snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_pool_deletions_deleted_at
  on public.pool_deletions (deleted_at);

alter table public.pool_deletions enable row level security;

grant select, insert, update, delete on table public.pool_deletions to service_role;
```

Update `src/lib/supabase/types.ts`:

```ts
export type PoolStatus = 'open' | 'live' | 'complete' | 'archived'

export interface PoolDeletion {
  id: string
  pool_id: string
  commissioner_id: string | null
  deleted_by: string | null
  status_at_delete: PoolStatus
  snapshot: Record<string, unknown>
  deleted_at: string
}
```

Update `src/lib/pool.ts`:

```ts
const STATUS_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  open: ['live'],
  live: ['complete'],
  complete: ['open', 'archived'],
  archived: [],
}

export function canReopenPool(
  status: PoolStatus,
  deadline: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  if (status !== 'complete') return false

  const lockAt = getTournamentLockInstant(deadline, timezone)
  return lockAt !== null && lockAt.getTime() > now.getTime()
}
```

Remove `ClonePoolInput` and `buildClonePoolInput` from `src/lib/pool.ts`. They are part of the old reuse flow and should disappear once the new buttons are in place.

- [ ] **Step 4: Re-run the tests**

Run:

```bash
npx vitest run src/lib/__tests__/pool.test.ts src/lib/__tests__/picks.test.ts
```

Expected: the new archived and reopen tests pass.

- [ ] **Step 5: Commit the foundation work**

```bash
git add supabase/migrations/20260408183000_add_archived_pools_and_pool_deletions.sql src/lib/supabase/types.ts src/lib/pool.ts src/lib/__tests__/pool.test.ts src/lib/__tests__/picks.test.ts
git commit -m "feat: add archived pool foundation"
```

---

## Task 2: Add reopen and archive commissioner actions

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Create: `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx`
- Create: `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts`

Do this after the foundation task. A completed pool should now be reopenable or archivable.

- [ ] **Step 1: Add the failing action tests**

In `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts`, add a `completedPool` fixture:

Add `reopenPool` and `archivePool` to the import list from `../actions` at the top of the file.

```ts
const completedPool = {
  ...lockedPool,
  status: 'complete',
}
```

Then add tests like these:

```ts
it('reopens a completed pool before the deadline', async () => {
  vi.setSystemTime(new Date('2026-04-08T05:00:00Z'))
  vi.mocked(getPoolById).mockResolvedValue(completedPool as never)

  const formData = new FormData()
  formData.set('poolId', 'pool-1')

  await expect(reopenPool(null, formData)).resolves.toEqual(null)

  expect(updatePoolStatus).toHaveBeenCalledWith(expect.anything(), 'pool-1', 'open', 'complete')
  expect(insertAuditEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      action: 'poolReopened',
      details: { previousStatus: 'complete' },
    })
  )
})

it('archives a completed pool', async () => {
  vi.mocked(getPoolById).mockResolvedValue(completedPool as never)

  const formData = new FormData()
  formData.set('poolId', 'pool-1')

  await expect(archivePool(null, formData)).resolves.toEqual(null)

  expect(updatePoolStatus).toHaveBeenCalledWith(expect.anything(), 'pool-1', 'archived', 'complete')
  expect(insertAuditEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      action: 'poolArchived',
      details: { previousStatus: 'complete' },
    })
  )
})

it('rejects reopening after the deadline has passed', async () => {
  vi.setSystemTime(new Date('2026-04-10T05:00:00Z'))
  vi.mocked(getPoolById).mockResolvedValue(completedPool as never)

  const formData = new FormData()
  formData.set('poolId', 'pool-1')

  await expect(reopenPool(null, formData)).resolves.toEqual({
    error: 'This pool can no longer be reopened because the deadline has passed.',
  })

  expect(updatePoolStatus).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npx vitest run 'src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts'
```

Expected: the new reopen and archive tests fail because the actions do not exist yet.

- [ ] **Step 3: Implement the server actions and button components**

In `src/app/(app)/commissioner/pools/[poolId]/actions.ts`, remove the old `reusePool` function and add `reopenPool` and `archivePool`.

Use these rules:

```ts
export async function reopenPool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can reopen this pool.' }
  if (pool.status !== 'complete') return { error: 'Only completed pools can be reopened.' }
  if (!canReopenPool(pool.status as PoolStatus, pool.deadline, pool.timezone)) {
    return { error: 'This pool can no longer be reopened because the deadline has passed.' }
  }

  const { error } = await updatePoolStatus(supabase, poolId, 'open', 'complete')
  if (error) return { error: 'Failed to reopen pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolReopened',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}

export async function archivePool(
  _prevState: PoolActionState,
  formData: FormData
): Promise<PoolActionState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) return { error: 'Only the commissioner can archive this pool.' }
  if (pool.status !== 'complete') return { error: 'Only completed pools can be archived.' }

  const { error } = await updatePoolStatus(supabase, poolId, 'archived', 'complete')
  if (error) return { error: 'Failed to archive pool.' }

  await insertAuditEvent(supabase, {
    pool_id: poolId,
    user_id: user.id,
    action: 'poolArchived',
    details: { previousStatus: pool.status },
  })

  redirect(`/commissioner/pools/${poolId}`)
}
```

Create `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx` and `ArchivePoolButton.tsx` by copying `ReusePoolButton.tsx`. Keep the same `useFormState` pattern and change only:
- the action import
- the button label
- the pending text
- the confirm message

Use these confirm strings:
- Reopen: `Reopen this pool? Picks will become editable again until the deadline.`
- Archive: `Archive this pool? Archived pools stay read-only and can be deleted later.`

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, import the new buttons and render them like this:
- `open` and not locked: show `StartPoolButton`
- `live`: show `ClosePoolButton`
- `complete` and `canReopenPool(...) === true`: show `ReopenPoolButton`
- `complete`: show `ArchivePoolButton`
- `archived`: show `DeletePoolButton`

Keep `ReusePoolButton` out of the page entirely.

- [ ] **Step 4: Re-run the tests**

Run:

```bash
npx vitest run 'src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts'
```

Expected: the reopen and archive tests pass.

- [ ] **Step 5: Commit the commissioner action work**

```bash
git add src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-lock-actions.test.ts
git commit -m "feat: add reopen and archive pool actions"
```

---

## Task 3: Add permanent delete with a tombstone record

**Files:**
- Modify: `src/lib/pool-queries.ts`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Create: `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx`
- Create: `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts`
- Modify: `src/lib/__tests__/pool-queries.test.ts`

Do this after archiving works. Delete is only allowed on already archived pools.

- [ ] **Step 1: Add the failing tests first**

In `src/lib/__tests__/pool-queries.test.ts`, add tests for the new tombstone helper:

```ts
function createSupabaseForDeletion(result: { error: { message: string } | null }) {
  const builder: any = {
    upsert: vi.fn(() => builder),
    then: (onFulfilled: (value: { error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  const supabase = {
    from: vi.fn(() => builder),
  }

  return { supabase }
}

describe('recordPoolDeletion', () => {
  it('writes a tombstone row', async () => {
    const { supabase } = createSupabaseForDeletion({ error: null })

    await expect(
      recordPoolDeletion(supabase as any, {
        pool_id: 'pool-1',
        commissioner_id: 'user-1',
        deleted_by: 'user-1',
        status_at_delete: 'archived',
        snapshot: { id: 'pool-1', name: 'Masters Pool' },
      })
    ).resolves.toEqual({ error: null })
  })
})
```

Create `src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts` with tests like these:

Import `deletePool`, `recordPoolDeletion`, and `deletePoolById` at the top of the new test file.
Also mock `@/lib/supabase/admin` and make `createAdminClient()` return a fake admin client, because the delete action must bypass RLS.

```ts
it('creates a tombstone and deletes an archived pool', async () => {
  vi.mocked(getPoolById).mockResolvedValue({
    ...completedPool,
    status: 'archived',
  } as never)

  const formData = new FormData()
  formData.set('poolId', 'pool-1')

  await expect(deletePool(null, formData)).resolves.toEqual(null)

  expect(recordPoolDeletion).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      pool_id: 'pool-1',
      status_at_delete: 'archived',
      snapshot: expect.objectContaining({
        id: 'pool-1',
        name: 'Masters Pool',
        status: 'archived',
      }),
    })
  )

  expect(deletePoolById).toHaveBeenCalledWith(expect.anything(), 'pool-1')
})

it('refuses to delete a pool that is not archived', async () => {
  vi.mocked(getPoolById).mockResolvedValue({
    ...completedPool,
    status: 'complete',
  } as never)

  const formData = new FormData()
  formData.set('poolId', 'pool-1')

  await expect(deletePool(null, formData)).resolves.toEqual({
    error: 'Only archived pools can be deleted.',
  })
})
```

- [ ] **Step 2: Run the delete tests and confirm they fail**

Run:

```bash
npx vitest run 'src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts' src/lib/__tests__/pool-queries.test.ts
```

Expected: failures because the tombstone helpers and delete action do not exist yet.

- [ ] **Step 3: Implement the tombstone helpers and delete action**

In `src/lib/pool-queries.ts`, add these helpers:

```ts
export async function recordPoolDeletion(
  supabase: SupabaseClient,
  record: Omit<PoolDeletion, 'id' | 'deleted_at'>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pool_deletions')
    .upsert(record, { onConflict: 'pool_id' })

  if (error) return { error: error.message }
  return { error: null }
}

export async function deletePoolById(
  supabase: SupabaseClient,
  poolId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pools').delete().eq('id', poolId)
  if (error) return { error: error.message }
  return { error: null }
}
```

In `src/app/(app)/commissioner/pools/[poolId]/actions.ts`, add `deletePool` and use the admin client:

```ts
import { createAdminClient } from '@/lib/supabase/admin'

const admin = createAdminClient()

const snapshot = {
  id: pool.id,
  commissioner_id: pool.commissioner_id,
  name: pool.name,
  tournament_id: pool.tournament_id,
  tournament_name: pool.tournament_name,
  year: pool.year,
  deadline: pool.deadline,
  timezone: pool.timezone,
  format: pool.format,
  picks_per_entry: pool.picks_per_entry,
  invite_code: pool.invite_code,
  status: pool.status,
  created_at: pool.created_at,
  refreshed_at: pool.refreshed_at,
  last_refresh_error: pool.last_refresh_error,
}

const tombstone = await recordPoolDeletion(admin, {
  pool_id: pool.id,
  commissioner_id: pool.commissioner_id,
  deleted_by: user.id,
  status_at_delete: pool.status as PoolStatus,
  snapshot,
})
if (tombstone.error) return { error: 'Failed to record pool deletion.' }

const deletion = await deletePoolById(admin, pool.id)
if (deletion.error) return { error: 'Failed to delete pool.' }

redirect('/commissioner')
```

The delete action should reject anything that is not already archived:

```ts
if (pool.status !== 'archived') {
  return { error: 'Only archived pools can be deleted.' }
}
```

Create `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx` by copying `ReusePoolButton.tsx` and changing the confirm text to:

```tsx
if (!confirm('Permanently delete this archived pool? This cannot be undone.')) {
  event.preventDefault()
}
```

- [ ] **Step 4: Re-run the delete tests**

Run:

```bash
npx vitest run 'src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts' src/lib/__tests__/pool-queries.test.ts
```

Expected: the tombstone and delete tests pass.

- [ ] **Step 5: Commit the delete work**

```bash
git add src/lib/pool-queries.ts src/app/(app)/commissioner/pools/[poolId]/actions.ts src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx src/app/(app)/commissioner/pools/[poolId]/__tests__/pool-delete-actions.test.ts src/lib/__tests__/pool-queries.test.ts
git commit -m "feat: add archived pool deletion"
```

---

## Task 4: Update commissioner UI and shared status copy

**Files:**
- Modify: `src/app/(app)/commissioner/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx`
- Modify: `src/components/StatusChip.tsx`
- Modify: `src/components/TrustStatusBar.tsx`
- Modify: `src/components/LockBanner.tsx`
- Modify: `src/components/__tests__/StatusComponentsA11y.test.tsx`
- Modify: `src/components/__tests__/CommissionerCommandCenter.test.tsx`
- Modify: `src/components/__tests__/TrustStatusBar.test.tsx`
- Modify: `src/components/__tests__/LockBanner.test.tsx`

This task is about the commissioner-facing experience. Make the archived state visible and obvious.

- [ ] **Step 1: Add the failing UI tests**

In `src/components/__tests__/StatusComponentsA11y.test.tsx`, add:

```ts
it('renders StatusChip with archived pool copy', () => {
  const markup = renderToStaticMarkup(
    createElement(StatusChip, { status: 'archived' }),
  )

  expect(markup).toContain('aria-label="Pool status: Archived"')
})
```

In `src/components/__tests__/CommissionerCommandCenter.test.tsx`, set the pool status to `archived` and assert the markup contains `Archived`.

In `src/components/__tests__/TrustStatusBar.test.tsx`, add an archived case:

```ts
it('returns archived lock messaging', () => {
  const result = getTrustStatusBarState({
    isLocked: true,
    poolStatus: 'archived',
    freshness: 'current',
    refreshedAt: '2026-03-29T12:00:00.000Z',
    lastRefreshError: null,
  })

  expect(result.lockLabel).toBe('Archived')
  expect(result.lockMessage).toBe('This pool is archived. No changes allowed.')
  expect(result.showFreshness).toBe(true)
})
```

In `src/components/__tests__/LockBanner.test.tsx`, add one archived render check and assert the archived message is visible.

- [ ] **Step 2: Run the UI tests and confirm they fail**

Run:

```bash
npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/LockBanner.test.tsx
```

Expected: the new archived assertions fail because the UI does not know about `archived` yet.

- [ ] **Step 3: Implement the commissioner UI changes**

In `src/components/StatusChip.tsx`, add an `archived` config:

```ts
archived: {
  label: 'Archived',
  icon: '\u25A3',
  classes: 'border-slate-200 bg-slate-100 text-slate-700',
},
```

In `src/app/(app)/commissioner/page.tsx`, split the pools into active and archived lists:

```ts
const activePools = pools.filter((pool) => pool.status !== 'archived')
const archivedPools = pools.filter((pool) => pool.status === 'archived')
```

Render two headings, `Active pools` and `Archived pools`, and keep the archived cards clickable but muted with a wrapper such as `className="opacity-75"`.

In `src/app/(app)/commissioner/pools/[poolId]/page.tsx`, import `canReopenPool` and the new buttons. Render:
- `StartPoolButton` for open and unlocked pools
- `ClosePoolButton` for live pools
- `ReopenPoolButton` for completed pools when `canReopenPool(...)` is true
- `ArchivePoolButton` for completed pools
- `DeletePoolButton` for archived pools

Remove `ReusePoolButton` from the page completely.

In `PoolStatusSection.tsx`, change the lock-state label to `Archived` when `pool.status === 'archived'`.

In `PoolConfigForm.tsx`, make the lock copy specific:

```ts
const configLockMessage =
  pool.status === 'archived'
    ? 'Configuration is locked because this pool is archived.'
    : pool.status === 'complete'
      ? 'Configuration is locked because this pool is closed.'
      : 'Configuration is locked because the deadline has passed.'
```

In `TrustStatusBar.tsx`, change the lock label type to include `Archived` and add an archived message in `getLockMessage`.

In `LockBanner.tsx`, add an archived branch in `getLockedMessage`:

```ts
case 'archived':
  return 'This pool is archived. Picks are read-only.'
```

- [ ] **Step 4: Re-run the commissioner UI tests**

Run:

```bash
npx vitest run src/components/__tests__/StatusComponentsA11y.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/LockBanner.test.tsx
```

Expected: the archived UI assertions pass.

- [ ] **Step 5: Manually check the commissioner UI**

Open the app in the browser and verify:
- `/commissioner` shows separate `Active pools` and `Archived pools` sections
- archived cards still link to the pool detail page
- a completed pool detail page shows reopen/archive buttons
- an archived pool detail page shows the delete button only

- [ ] **Step 6: Commit the commissioner UI work**

```bash
git add src/app/(app)/commissioner/page.tsx src/app/(app)/commissioner/pools/[poolId]/page.tsx src/app/(app)/commissioner/pools/[poolId]/PoolStatusSection.tsx src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx src/components/StatusChip.tsx src/components/TrustStatusBar.tsx src/components/LockBanner.tsx src/components/__tests__/StatusComponentsA11y.test.tsx src/components/__tests__/CommissionerCommandCenter.test.tsx src/components/__tests__/TrustStatusBar.test.tsx src/components/__tests__/LockBanner.test.tsx
git commit -m "feat: update commissioner ui for archived pools"
```

---

## Task 5: Make archived pools read-only outside commissioner views

**Files:**
- Modify: `src/lib/entry-queries.ts`
- Create: `src/lib/__tests__/entry-queries.test.ts`
- Modify: `src/components/leaderboard-trust-status.ts`
- Modify: `src/components/LeaderboardEmptyState.tsx`
- Modify: `src/components/__tests__/LeaderboardEmptyState.test.tsx`
- Modify: `src/components/__tests__/leaderboard.test.ts`
- Modify: `src/app/spectator/pools/[poolId]/page.tsx`
- Modify: `src/app/join/[inviteCode]/page.tsx`
- Modify: `src/app/join/[inviteCode]/actions.ts`
- Create: `src/app/join/[inviteCode]/actions.test.ts`
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/lib/__tests__/picks.test.ts`
- Modify: `src/app/api/leaderboard/[poolId]/route.test.ts`

This is the user-facing archived behavior. Archived pools should disappear from normal lists but still resolve read-only through direct links.

- [ ] **Step 1: Add the failing tests first**

Create `src/lib/__tests__/entry-queries.test.ts` with an archived-filter case:

Import `getPoolsForMember` from `../entry-queries` at the top of the new test file.

```ts
function createSupabaseForMemberPools(memberRows: unknown[], entryRows: unknown[] = []) {
  const memberBuilder: any = {
    select: vi.fn(() => memberBuilder),
    eq: vi.fn(() => memberBuilder),
    order: vi.fn(() => memberBuilder),
    then: (onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: memberRows, error: null }).then(onFulfilled, onRejected),
  }

  const entryBuilder: any = {
    select: vi.fn(() => entryBuilder),
    eq: vi.fn(() => entryBuilder),
    in: vi.fn(() => entryBuilder),
    then: (onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: entryRows, error: null }).then(onFulfilled, onRejected),
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'pool_members') return memberBuilder
      if (table === 'entries') return entryBuilder
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return { supabase }
}

it('filters archived pools out of member pools', async () => {
  const { supabase } = createSupabaseForMemberPools([
    {
      pool_id: 'p1',
      role: 'player',
      pools: [{ id: 'p1', name: 'Open Pool', tournament_name: 'T', status: 'open', deadline: '2026-04-09T00:00:00Z', timezone: 'America/New_York', picks_per_entry: 4 }],
    },
    {
      pool_id: 'p2',
      role: 'player',
      pools: [{ id: 'p2', name: 'Archived Pool', tournament_name: 'T', status: 'archived', deadline: '2026-04-09T00:00:00Z', timezone: 'America/New_York', picks_per_entry: 4 }],
    },
  ])

  const result = await getPoolsForMember(supabase as any, 'user-1')

  expect(result).toHaveLength(1)
  expect(result[0].pool_id).toBe('p1')
})
```

In `src/components/__tests__/LeaderboardEmptyState.test.tsx`, add archived cases for `hasEntries=true` and `hasEntries=false`.

In `src/components/__tests__/leaderboard.test.ts`, add:

```ts
it('renders trust status in leaderboard header for archived pools by default', () => {
  expect(shouldRenderLeaderboardTrustStatus('archived', false)).toBe(true)
})
```

In `src/app/join/[inviteCode]/actions.test.ts`, add a test that archived pools are rejected with `This pool is archived and can no longer accept new members.`
Use the same `createClient` and `redirect` mock pattern that the other action tests in this repo use.

In `src/lib/__tests__/picks.test.ts`, keep the archived lock assertions from Task 1 and add them here if you prefer to keep all lock tests together.

In `src/app/api/leaderboard/[poolId]/route.test.ts`, add an archived case and assert `fetch` is not called for a refresh.

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npx vitest run src/lib/__tests__/entry-queries.test.ts src/components/__tests__/LeaderboardEmptyState.test.tsx src/components/__tests__/leaderboard.test.ts src/app/api/leaderboard/[poolId]/route.test.ts src/app/join/[inviteCode]/actions.test.ts
```

Expected: the archived read-only assertions fail until the code changes are in place.

- [ ] **Step 3: Implement the read-only archived behavior**

In `src/lib/entry-queries.ts`, filter archived pools out of the returned member list:

```ts
return members.flatMap((member) => {
  const poolValue = Array.isArray(member.pools)
    ? member.pools[0] ?? null
    : member.pools

  if (!poolValue) return []
  if (poolValue.status === 'archived') return []

  return {
    pool_id: member.pool_id,
    role: member.role,
    pool: poolValue,
    entry: entryByPoolId.get(member.pool_id) ?? null,
  }
})
```

In `src/components/leaderboard-trust-status.ts`, include archived:

```ts
return poolStatus === 'live' || poolStatus === 'complete' || poolStatus === 'archived'
```

In `src/components/LeaderboardEmptyState.tsx`, add an archived branch before the current `open`/`live` handling:

```ts
if (poolStatus === 'archived') {
  title = 'Archived pool'
  description = hasEntries
    ? 'This pool is archived and read-only. The leaderboard is frozen.'
    : 'This pool is archived and read-only. There are no entries to show yet.'
  eyebrow = 'Archived'
  accentClasses = 'border-slate-200 bg-slate-100 text-slate-700'
}
```

In `src/app/spectator/pools/[poolId]/page.tsx`, render the `TrustStatusBar` for archived pools as well:

```tsx
{(pool.status === 'live' || pool.status === 'complete' || pool.status === 'archived') && (
  <TrustStatusBar ... />
)}
```

In `src/app/join/[inviteCode]/page.tsx`, fetch `status` and return the archived read-only page before sign-in or membership checks:

```ts
const { data: pool } = await supabase
  .from('pools')
  .select('id, name, tournament_name, invite_code, status')
  .eq('invite_code', normalizedInviteCode)
  .single()

if (!pool) {
  // existing invalid invite UI
}

if (pool.status === 'archived') {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Archived pool</h1>
        <p className="text-sm text-gray-600">
          This pool is archived and read-only. You can still view the leaderboard.
        </p>
        <Link href={`/spectator/pools/${pool.id}`} className="inline-block text-blue-600 hover:text-blue-800 text-sm">
          View leaderboard
        </Link>
      </div>
    </main>
  )
}
```

In `src/app/join/[inviteCode]/actions.ts`, reject archived pools before inserting membership rows:

```ts
if (pool.status === 'archived') {
  return { error: 'This pool is archived and can no longer accept new members.' }
}
```

In `src/app/(app)/participant/picks/[poolId]/page.tsx`, skip the membership redirect when the pool is archived and render a read-only archived notice instead of the picks form. If the signed-in user already has an entry, keep showing `SubmissionConfirmation` but do not render `PicksForm`.

No production change is needed in `src/app/(app)/participant/picks/[poolId]/actions.ts` because `isPoolLocked` already blocks archived pools. Keep the lock assertions in `src/lib/__tests__/picks.test.ts` to prove it.

- [ ] **Step 4: Re-run the tests**

Run:

```bash
npx vitest run src/lib/__tests__/entry-queries.test.ts src/components/__tests__/LeaderboardEmptyState.test.tsx src/components/__tests__/leaderboard.test.ts src/app/api/leaderboard/[poolId]/route.test.ts src/app/join/[inviteCode]/actions.test.ts src/lib/__tests__/picks.test.ts
```

Expected: the archived read-only behavior tests pass.

- [ ] **Step 5: Manually verify the read-only flows**

Open these paths in the browser after creating an archived pool:
- `/join/<invite-code>` should show the archived read-only page and no join form
- `/participant/picks/<pool-id>` should show read-only content and no picks form
- `/spectator/pools/<pool-id>` should still show the leaderboard and trust bar
- `/participant/pools` should not list the archived pool at all

- [ ] **Step 6: Commit the read-only behavior**

```bash
git add src/lib/entry-queries.ts src/lib/__tests__/entry-queries.test.ts src/components/leaderboard-trust-status.ts src/components/LeaderboardEmptyState.tsx src/components/__tests__/LeaderboardEmptyState.test.tsx src/components/__tests__/leaderboard.test.ts src/app/spectator/pools/[poolId]/page.tsx src/app/join/[inviteCode]/page.tsx src/app/join/[inviteCode]/actions.ts src/app/join/[inviteCode]/actions.test.ts src/app/(app)/participant/picks/[poolId]/page.tsx src/lib/__tests__/picks.test.ts src/app/api/leaderboard/[poolId]/route.test.ts
git commit -m "feat: make archived pools read only"
```

---

## Task 6: Remove reuse leftovers and finish with full verification

**Files:**
- Remove: `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`
- Modify: `src/lib/pool.ts`
- Modify: any test file that still imports clone helpers or reuse actions

Do this last. The new flow should already be working before you delete the old code.

- [ ] **Step 1: Search for leftovers**

Run:

```bash
rg -n "ReusePoolButton|reusePool|buildClonePoolInput|ClonePoolInput" src docs supabase -g '!node_modules'
```

Expected: only the plan docs or cleanup notes should mention the old reuse names. No production code should.

- [ ] **Step 2: Remove the dead code**

Delete `src/app/(app)/commissioner/pools/[poolId]/ReusePoolButton.tsx`.

In `src/app/(app)/commissioner/pools/[poolId]/actions.ts`, remove the old clone-based `reusePool` function and any imports that only supported it, such as `buildClonePoolInput`, `generateInviteCode`, `insertPool`, and `insertPoolMember` if they are no longer used.

In `src/lib/pool.ts`, remove `ClonePoolInput` and `buildClonePoolInput` entirely.

If any test still refers to reuse, delete that expectation and replace it with a reopen, archive, or delete expectation.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm test
```

Expected: the entire Vitest suite passes.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 5: Commit the cleanup**

```bash
git add -A
git commit -m "refactor: remove pool reuse flow"
```

---

## Final Check

Before handing this off, confirm all of the following are true:

- `Reuse Pool` is gone from the commissioner UI and no clone flow remains in the code.
- Commissioners can reopen a completed pool only while the deadline is still in the future.
- Completed pools can be archived.
- Archived pools are hidden from normal lists, but still readable through direct links.
- Archived pools can be permanently deleted and leave a tombstone record behind.
- `npm test` and `npm run lint` both pass.
