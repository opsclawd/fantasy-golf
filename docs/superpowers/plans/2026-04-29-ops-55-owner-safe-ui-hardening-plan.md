# OPS-55: Owner-safe UI, Status, and Admin Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-safe UI hardening across 6 areas: StatusChip deadline display, LockBanner warning tone near deadline, TrustStatusBar pulsing stale indicator + refresh button, TieExplanationBadge for contextual tiebreaker explanation, ConfirmModal for destructive action friction, and ErrorStateBanner for persistent refresh failures.

**Architecture:** 3 new components (TieExplanationBadge, ConfirmModal, ErrorStateBanner), enhancements to 4 existing components (StatusChip, LockBanner, TrustStatusBar, admin buttons), and one new server action (refreshPoolScoresAction). All new components use React with existing UI style patterns (panelClasses, sectionHeadingClasses, tone system).

**Tech Stack:** TypeScript, React, Next.js, Vitest

---

## File Structure

```
src/components/
  TieExplanationBadge.tsx      # NEW — contextual tiebreaker explanation
  ConfirmModal.tsx              # NEW — generic confirmation dialog
  ErrorStateBanner.tsx          # NEW — persistent error with recovery action
src/components/
  StatusChip.tsx                # MODIFY — accept deadline prop, render when open+deadline
  LockBanner.tsx               # MODIFY — warning tone within 24h of deadline
  TrustStatusBar.tsx           # MODIFY — pulsing amber stale indicator + refresh button
src/app/(app)/commissioner/pools/[poolId]/
  ArchivePoolButton.tsx         # MODIFY — wrap in ConfirmModal
  DeletePoolButton.tsx         # MODIFY — wrap in ConfirmModal (with text match)
  ReopenPoolButton.tsx         # MODIFY — wrap in ConfirmModal (with delay)
  actions.ts                   # MODIFY — add refreshPoolScoresAction
src/components/__tests__/
  TieExplanationBadge.test.tsx  # NEW
  ConfirmModal.test.tsx         # NEW
  ErrorStateBanner.test.tsx      # NEW
src/lib/scoring/
  domain.ts                    # MODIFY — ensure isTied + totalBirdies on ranked entry
```

---

## Task 1: StatusChip — Accept deadline prop, render formatted datetime when open+deadline

**Files:**
- Modify: `src/components/StatusChip.tsx:28-42`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/StatusChip.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusChip } from '../StatusChip'

describe('StatusChip with deadline', () => {
  it('renders deadline when status is open and deadline is provided', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="open" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).toContain('Deadline')
  })

  it('does not render deadline when status is live', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="live" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).not.toContain('Deadline')
  })

  it('does not render deadline when status is complete', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="complete" deadline="2026-04-30T00:00:00Z" timezone="America/New_York" />
    )
    expect(html).not.toContain('Deadline')
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/StatusChip.test.tsx --reporter=verbose`
Expected: FAIL — "deadline" prop does not exist

### Step 3: Write minimal implementation

```tsx
// src/components/StatusChip.tsx — updated interface and implementation
import type { PoolStatus } from '@/lib/supabase/types'
import { getTournamentLockInstant } from '@/lib/picks'
import { sectionHeadingClasses } from './uiStyles'

const STATUS_CONFIG: Record<PoolStatus, { label: string; icon: string; classes: string }> = {
  open: {
    label: 'Open',
    icon: '\u25CB',
    classes: 'border-green-200 bg-green-50 text-green-900',
  },
  live: {
    label: 'Live',
    icon: '\u25CF',
    classes: 'border-green-200 bg-green-50 text-green-900',
  },
  complete: {
    label: 'Complete',
    icon: '\u2713',
    classes: 'border-stone-200 bg-stone-100 text-stone-900',
  },
  archived: {
    label: 'Archived',
    icon: '\u25A3',
    classes: 'border-stone-200 bg-stone-100 text-stone-700',
  },
}

function formatDeadline(deadline: string, timeZone: string): string {
  const deadlineInstant = getTournamentLockInstant(deadline, timeZone)
  if (!deadlineInstant) return ''
  return deadlineInstant.toLocaleString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

interface StatusChipProps {
  status: PoolStatus
  deadline?: string
  timezone?: string
}

export function StatusChip({ status, deadline, timezone }: StatusChipProps) {
  const config = STATUS_CONFIG[status]
  const showDeadline = status === 'open' && deadline && timezone
  const formattedDeadline = showDeadline ? formatDeadline(deadline, timezone) : null

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${config.classes}`}
      role="status"
      aria-label={`Pool status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className={sectionHeadingClasses().replace('text-green-700/70', 'text-current')}>
        {config.label}
      </span>
      {formattedDeadline && (
        <span className="text-xs normal-case tracking-normal text-stone-600">
          · Deadline {formattedDeadline}
        </span>
      )}
    </span>
  )
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/StatusChip.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/StatusChip.tsx src/components/__tests__/StatusChip.test.tsx
git commit -m "feat(OPS-55): StatusChip renders deadline when pool is open"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 2: LockBanner — Warning tone within 24 hours of deadline

**Files:**
- Modify: `src/components/LockBanner.tsx:42-90`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/LockBanner.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LockBanner } from '../LockBanner'

describe('LockBanner warning tone near deadline', () => {
  it('renders with warning tone when pool is open and deadline is within 24 hours', () => {
    // Deadline 12 hours from now
    const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={soon} poolStatus="open" timezone="America/New_York" />
    )
    // Should use amber/warning classes (border-amber, bg-amber)
    expect(html).toContain('border-amber')
    expect(html).toContain('bg-amber')
  })

  it('renders with info tone when pool is open and deadline is more than 24 hours away', () => {
    // Deadline 48 hours from now
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={later} poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('border-green')
    expect(html).toContain('bg-green')
  })

  it('shows secondary line with timezone when within 24 hours', () => {
    const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    const html = renderToStaticMarkup(
      <LockBanner isLocked={false} deadline={soon} poolStatus="open" timezone="America/New_York" />
    )
    expect(html).toContain('America/New_York')
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/LockBanner.test.tsx --reporter=verbose`
Expected: FAIL — warning tone not implemented

### Step 3: Write minimal implementation

```tsx
// src/components/LockBanner.tsx — updated to add warning tone near deadline
import { panelClasses, sectionHeadingClasses } from './uiStyles'
import { getTournamentLockInstant } from '@/lib/picks'

// ... existing getLockedMessage and formatDeadline functions unchanged ...

function isWithin24Hours(deadline: string, timezone: string): boolean {
  const instant = getTournamentLockInstant(deadline, timezone)
  if (!instant) return false
  const now = new Date()
  const diffMs = instant.getTime() - now.getTime()
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000
}

export function LockBanner({ isLocked, deadline, poolStatus, timezone }: LockBannerProps) {
  const lockedMessage = getLockedMessage(poolStatus)

  if (isLocked) {
    return (
      <div
        className={`${panelClasses()} mb-4 flex items-center gap-3 border border-stone-200 bg-stone-100/90 p-4`}
        role="status"
        aria-live="polite"
      >
        {/* existing locked UI */}
      </div>
    )
  }

  const formattedDeadline = formatDeadline(deadline, timezone)
  const nearDeadline = deadline && timezone ? isWithin24Hours(deadline, timezone) : false
  const isWarning = poolStatus === 'open' && nearDeadline

  return (
    <div
      className={`${panelClasses()} mb-4 flex items-center gap-3 border ${
        isWarning ? 'border-amber-200 bg-amber-100/90' : 'border-green-200 bg-green-100/90'
      } p-4`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/20 bg-white/75 text-lg">
        {isWarning ? '\u26A0' : '\uD83D\uDD13'}
      </span>
      <div>
        <p className={sectionHeadingClasses()}>Tournament lock</p>
        <p className={`text-base font-semibold ${isWarning ? 'text-amber-950' : 'text-green-950'}`}>
          {isWarning ? 'Picks close soon' : 'Picks are open'}
        </p>
        <p className={`text-sm ${isWarning ? 'text-amber-800' : 'text-green-800'}`}>
          Deadline: {formattedDeadline}
          {nearDeadline && timezone && ` (${timezone})`}
        </p>
      </div>
    </div>
  )
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/LockBanner.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/LockBanner.tsx src/components/__tests__/LockBanner.test.tsx
git commit -m "feat(OPS-55): LockBanner warning tone within 24h of deadline"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 3: TrustStatusBar — Pulsing amber stale indicator + refresh button

**Files:**
- Modify: `src/components/TrustStatusBar.tsx:167-217`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/actions.ts` — add `refreshPoolScoresAction`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/TrustStatusBar.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrustStatusBar } from '../TrustStatusBar'

describe('TrustStatusBar stale pulsing indicator', () => {
  it('shows pulsing amber indicator when pool status is live and freshness is stale', () => {
    const html = renderToStaticMarkup(
      <TrustStatusBar
        isLocked={true}
        poolStatus="live"
        freshness="stale"
        refreshedAt="2026-04-29T10:00:00Z"
        lastRefreshError={null}
      />
    )
    // Pulsing indicator via CSS animation class
    expect(html).toContain('animate-pulse') || expect(html).toContain('pulse')
  })

  it('does not show pulsing indicator when freshness is current', () => {
    const html = renderToStaticMarkup(
      <TrustStatusBar
        isLocked={true}
        poolStatus="live"
        freshness="current"
        refreshedAt="2026-04-29T10:00:00Z"
        lastRefreshError={null}
      />
    )
    expect(html).not.toContain('animate-pulse')
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/TrustStatusBar.test.tsx --reporter=verbose`
Expected: FAIL — pulsing class not in output

### Step 3: Write minimal implementation

```tsx
// src/components/TrustStatusBar.tsx — add pulsing stale indicator + refresh button
// Add to TrustStatusBarState interface:
// showRefreshButton: boolean
// isPulsingStale: boolean

function getTrustStatusBarState(input: GetTrustStatusBarStateInput): TrustStatusBarState {
  // ... existing logic ...
  const isPulsingStale = input.poolStatus === 'live' && input.freshness === 'stale'
  const showRefreshButton = isPulsingStale

  return {
    // ... existing fields ...
    showFreshness: input.poolStatus !== 'open',
    isPulsingStale,
    showRefreshButton,
    // ...
  }
}

// In TrustStatusBar render, add after freshness section:
{state.isPulsingStale && (
  <span className="inline-flex h-3 w-3 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
)}
{state.showRefreshButton && (
  <button
    type="button"
    onClick={onRefresh}
    className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
  >
    Refresh now
  </button>
)}
```

Note: `onRefresh` is a new prop added to `TrustStatusBarProps`.

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/TrustStatusBar.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Add refreshPoolScoresAction to actions.ts

```typescript
// src/app/(app)/commissioner/pools/[poolId]/actions.ts — add after existing actions

export type RefreshScoresState = {
  error?: string
  success?: boolean
} | null

export async function refreshPoolScoresAction(
  _prevState: RefreshScoresState,
  formData: FormData,
): Promise<RefreshScoresState> {
  const poolId = formData.get('poolId') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) return { error: 'Pool not found.' }
  if (pool.commissioner_id !== user.id) {
    return { error: 'Only the commissioner can refresh scores.' }
  }

  try {
    const { refreshScoresForPool } = await import('@/lib/scoring-refresh')
    await refreshScoresForPool(pool)
    revalidatePath(`/commissioner/pools/${poolId}`)
    revalidatePath(`/spectator/pools/${poolId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh scores.'
    return { error: message }
  }
}
```

### Step 6: Commit

```bash
git add src/components/TrustStatusBar.tsx src/components/__tests__/TrustStatusBar.test.tsx src/app/\(app\)/commissioner/pools/\[poolId\]/actions.ts
git commit -m "feat(OPS-55): TrustStatusBar pulsing stale indicator + refreshPoolScoresAction"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 4: TieExplanationBadge — New component

**Files:**
- Create: `src/components/TieExplanationBadge.tsx`
- Test: `src/components/__tests__/TieExplanationBadge.test.tsx`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/TieExplanationBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TieExplanationBadge } from '../TieExplanationBadge'

describe('TieExplanationBadge', () => {
  it('renders when isTied is true', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={true} entryName="My Entry" totalBirdies={7} />
    )
    expect(html).toContain('Tied')
    expect(html).toContain('7')
  })

  it('does not render when isTied is false', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={false} entryName="My Entry" totalBirdies={7} />
    )
    expect(html).toEqual('')
  })

  it('renders with correct birdie count', () => {
    const html = renderToStaticMarkup(
      <TieExplanationBadge isTied={true} entryName="My Entry" totalBirdies={12} />
    )
    expect(html).toContain('12')
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/TieExplanationBadge.test.tsx --reporter=verbose`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// src/components/TieExplanationBadge.tsx
interface TieExplanationBadgeProps {
  isTied: boolean
  entryName: string
  totalBirdies: number
}

export function TieExplanationBadge({ isTied, entryName, totalBirdies }: TieExplanationBadgeProps) {
  if (!isTied) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
      role="status"
    >
      <span aria-hidden="true">\uD83D\uDD0D</span>
      <span>
        Tied with {entryName}. Ranked by total birdies ({totalBirdies}).
      </span>
    </span>
  )
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/TieExplanationBadge.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Ensure scoring domain exposes isTied and totalBirdies

Check `src/lib/scoring/domain.ts` — the `RankedEntry` type should already have `isTied: boolean` and `totalBirdies: number` fields from the OPS-50 rebuild. If missing, add them to the return type.

### Step 6: Commit

```bash
git add src/components/TieExplanationBadge.tsx src/components/__tests__/TieExplanationBadge.test.tsx src/lib/scoring/domain.ts
git commit -m "feat(OPS-55): add TieExplanationBadge component"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 5: ConfirmModal — New generic confirmation dialog

**Files:**
- Create: `src/components/ConfirmModal.tsx`
- Test: `src/components/__tests__/ConfirmModal.test.tsx`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/ConfirmModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from '../ConfirmModal'

describe('ConfirmModal', () => {
  it('renders title and body', () => {
    render(
      <ConfirmModal
        title="Delete pool?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete pool?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmModal
        title="Archive pool?"
        body="Archived pools stay read-only."
        confirmLabel="Archive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal title="Sure?" body="Continue?" confirmLabel="Yes" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('requires text match for delete confirmation', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        title="Delete pool?"
        body="Type the pool name to confirm."
        confirmLabel="Delete"
        requireTextMatch={{ text: 'My Pool', label: 'My Pool' }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    // Confirm button should be disabled initially
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('confirm button activates after delay when confirmDelaySeconds is set', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal
        title="Archive pool?"
        body="Are you sure?"
        confirmLabel="Archive"
        confirmDelaySeconds={1}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    // Wait for delay + buffer
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled(), { timeout: 2000 })
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/ConfirmModal.test.tsx --reporter=verbose`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// src/components/ConfirmModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface ConfirmModalProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  isDestructive?: boolean
  requireTextMatch?: { text: string; label: string }
  confirmDelaySeconds?: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = false,
  requireTextMatch,
  confirmDelaySeconds,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isDelayActive, setIsDelayActive] = useState(!!confirmDelaySeconds)
  const [canConfirm, setCanConfirm] = useState(false)

  useEffect(() => {
    if (!confirmDelaySeconds) return
    const timer = setTimeout(() => setIsDelayActive(false), confirmDelaySeconds * 1000)
    return () => clearTimeout(timer)
  }, [confirmDelaySeconds])

  useEffect(() => {
    if (requireTextMatch) {
      setCanConfirm(inputValue === requireTextMatch.text)
    } else if (confirmDelaySeconds) {
      setCanConfirm(!isDelayActive)
    } else {
      setCanConfirm(true)
    }
  }, [inputValue, isDelayActive, requireTextMatch, confirmDelaySeconds])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className={`${panelClasses()} max-w-md border-2 ${isDestructive ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'} p-6`}>
        <h2 className={sectionHeadingClasses()}>{title}</h2>
        <p className="mt-2 text-sm text-stone-700">{body}</p>

        {requireTextMatch && (
          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Type &quot;{requireTextMatch.text}&quot; to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 p-2 text-sm"
              autoComplete="off"
            />
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`flex-1 rounded px-4 py-2 text-sm font-semibold text-white ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/ConfirmModal.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/ConfirmModal.tsx src/components/__tests__/ConfirmModal.test.tsx
git commit -m "feat(OPS-55): add ConfirmModal component"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 6: Admin buttons refactor — ArchivePoolButton, DeletePoolButton, ReopenPoolButton

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/DeletePoolButton.tsx`
- Modify: `src/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton.tsx`

### Step 1: Write failing tests (one test file per button)

```tsx
// src/components/__tests__/AdminButtonsModal.test.tsx
// Note: these test the button components in commissioner/pools/[poolId]/
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchivePoolButton } from '@/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton'
import { DeletePoolButton } from '@/app/(app)/commissioner/pools/[poolId]/DeletePoolButton'
import { ReopenPoolButton } from '@/app/(app)/commissioner/pools/[poolId]/ReopenPoolButton'

describe('ArchivePoolButton', () => {
  it('renders archive button', () => {
    render(<ArchivePoolButton poolId="test-pool" />)
    expect(screen.getByRole('button', { name: 'Archive Pool' })).toBeInTheDocument()
  })
})

describe('DeletePoolButton', () => {
  it('renders delete button', () => {
    render(<DeletePoolButton poolId="test-pool" poolName="My Pool" />)
    expect(screen.getByRole('button', { name: 'Delete Pool' })).toBeInTheDocument()
  })
})

describe('ReopenPoolButton', () => {
  it('renders reopen button', () => {
    render(<ReopenPoolButton poolId="test-pool" />)
    expect(screen.getByRole('button', { name: 'Reopen Pool' })).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run src/components/__tests__/AdminButtonsModal.test.tsx --reporter=verbose`
Expected: FAIL — delete button needs poolName prop

### Step 3: Write minimal implementation (ArchivePoolButton refactor)

```tsx
// src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx — refactored
'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { archivePool, type PoolActionState } from './actions'
import { ConfirmModal } from '@/components/ConfirmModal'

function ArchiveSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50">
      {pending ? 'Archiving...' : 'Archive Pool'}
    </button>
  )
}

export function ArchivePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(archivePool, null)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div>
      {state?.error && <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>}
      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
        >
          Archive Pool
        </button>
      ) : (
        <ConfirmModal
          title="Archive this pool?"
          body="Archived pools stay read-only and can be deleted later."
          confirmLabel="Archive"
          confirmDelaySeconds={3}
          isDestructive={true}
          onConfirm={() => {
            const form = document.createElement('form')
            form.method = 'POST'
            const input = document.createElement('input')
            input.name = 'poolId'
            input.value = poolId
            form.appendChild(input)
            formAction(form)
            setShowConfirm(false)
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
```

DeletePoolButton — same pattern with `requireTextMatch={{ text: poolName, label: poolName }}` and no delay.

ReopenPoolButton — same pattern with `confirmDelaySeconds={3}`, no text match.

### Step 4: Run tests to verify they pass

Run: `npx vitest run src/components/__tests__/AdminButtonsModal.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/ArchivePoolButton.tsx src/app/\(app)/commissioner/pools/\[poolId\]/DeletePoolButton.tsx src/app/\(app)/commissioner/pools/\[poolId\]/ReopenPoolButton.tsx
git commit -m "feat(OPS-55): admin buttons use ConfirmModal for destructive action friction"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 7: ErrorStateBanner — New component for persistent refresh failures

**Files:**
- Create: `src/components/ErrorStateBanner.tsx`
- Test: `src/components/__tests__/ErrorStateBanner.test.tsx`

### Step 1: Write the failing test

```tsx
// src/components/__tests__/ErrorStateBanner.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorStateBanner } from '../ErrorStateBanner'

describe('ErrorStateBanner', () => {
  it('renders error message', () => {
    render(<ErrorStateBanner message="Score refresh failed: network error" onRetry={vi.fn()} />)
    expect(screen.getByText('Score refresh failed: network error')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn()
    render(<ErrorStateBanner message="Failed" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('does not render when message is null', () => {
    const { container } = render(<ErrorStateBanner message={null} onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/components/__tests__/ErrorStateBanner.test.tsx --reporter=verbose`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// src/components/ErrorStateBanner.tsx
import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface ErrorStateBannerProps {
  message: string | null
  onRetry: () => void
}

export function ErrorStateBanner({ message, onRetry }: ErrorStateBannerProps) {
  if (!message) return null

  return (
    <div
      className={`${panelClasses()} mb-4 flex items-start gap-3 border border-red-200 bg-red-50/95 p-4`}
      role="alert"
    >
      <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-100 text-lg">
        \u26A0
      </span>
      <div className="flex-1">
        <p className={sectionHeadingClasses()}>Score refresh failed</p>
        <p className="mt-1 text-sm text-red-800">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
      >
        Retry
      </button>
    </div>
  )
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/components/__tests__/ErrorStateBanner.test.tsx --reporter=verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/components/ErrorStateBanner.tsx src/components/__tests__/ErrorStateBanner.test.tsx
git commit -m "feat(OPS-55): add ErrorStateBanner for persistent refresh failures"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

## Task 8: Full test suite — verify all tests pass

### Run full test suite

Run: `npm run test -- --run --reporter=verbose`

Expected: All tests pass including new OPS-55 tests.

If any tests fail, fix before opening PR.

### Commit final verification

```bash
git add -A
git commit -m "test(OPS-55): run full test suite - all tests passing"
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```
