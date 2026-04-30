# Design Spec: OPS-55 — Owner-safe UI, Status, and Admin Hardening

**Date:** 2026-04-29
**Story:** OPS-55
**Status:** DESIGN_REVIEW

---

## 1. Problem Statement

The fantasy golf UI has gaps that create confusion and safety issues for pool owners and participants:

1. **Pool status visibility** — Participants can't quickly determine if a pool is open, live, complete, or archived.
2. **Picks open/locked clarity** — The lock boundary (deadline + timezone) isn't surfaced prominently enough for participants.
3. **Stale refresh indicators** — When score data is stale, there's no prominent indicator or auto-refresh prompt.
4. **Best-ball/tiebreaker explanation** — No UI explains that ties are broken by total birdies, nor does it show this contextually when a tie is relevant.
5. **Safer admin actions** — Destructive admin actions (archive, delete, reopen) lack sufficient confirmation friction.
6. **Error states for stale data** — Stale data scenarios lack clear error/warning states with recovery actions.

---

## 2. Design Decisions

### 2.1 Pool Status Visibility — StatusChip Improvements

**Current state:** `StatusChip` component exists and shows Open/Live/Complete/Archived badges.

**Change:** No new component needed. Expand `StatusChip` to accept an optional `deadline` prop. When `deadline` is provided and status is `open`, render the deadline (formatted in pool timezone) directly on the chip or immediately adjacent.

**File:** `src/components/StatusChip.tsx`

**Rationale:** Keeps status information co-located. Deadline is the most critical piece of information for open pools from a participant's perspective.

---

### 2.2 Picks Open/Locked Clarity — LockBanner Enhancement

**Current state:** `LockBanner` shows picks open/locked status with deadline.

**Change:** When `pool.status === 'open'` and deadline is within 24 hours, upgrade the banner tone from `info` to `warning`. Show a secondary line: "Picks lock at {deadline} ({timezone})".

**File:** `src/components/LockBanner.tsx`

**Rationale:** Time-sensitive urgency is already a pattern in this codebase (TrustStatusBar tones). Adding timezone explicitly resolves ambiguity for participants in different timezones.

---

### 2.3 Stale Refresh Indicators — TrustStatusBar Extension

**Current state:** `TrustStatusBar` shows Current/Stale/No data/Refresh failed states. `FreshnessChip` is a separate component.

**Change:** When `pool.status === 'live'` and `classifyFreshness(refreshed_at) === 'stale'`, render a pulsing amber indicator on the `TrustStatusBar` in addition to the existing label. Add a "Refresh now" button that calls a new `refreshPoolScoresAction` server action.

**Files:**
- `src/components/TrustStatusBar.tsx`
- `src/app/(app)/commissioner/pools/[poolId]/actions.ts` (add `refreshPoolScoresAction`)

**New action:** `refreshPoolScoresAction(poolId: string)` — wraps `refreshScoresForPool()`, requires commissioner ownership. Returns `{ success: boolean, error?: string }`.

**Rationale:** Stale data during a live tournament is a degraded state. A pulsing indicator and explicit refresh action give the commissioner a clear recovery path.

---

### 2.4 Best-Ball/Tiebreaker Explanation — Contextual TieExplanationBadge

**Current state:** No tiebreaker explanation UI exists.

**Decision (Product Planner):** Interpretation B — show contextual inline explanation only when a tie is actually relevant.

**Approach:** Create a `TieExplanationBadge` component that renders only when:
- The entry's `isTied === true` in the ranked results, OR
- The entry is within 1 stroke of the rank above (tie-adjacent)

The badge displays: "Tied with {name}. Ranked by total birdies ({birdieCount})."

**Files:**
- `src/components/TieExplanationBadge.tsx` (new)
- `src/lib/scoring/domain.ts` — ensure `isTied` and `totalBirdies` are exposed on the ranked entry shape

**Entry point:** Add `TieExplanationBadge` to the leaderboard entry row in `src/app/(app)/participant/pools/[poolId]/leaderboard/` (check existing page structure).

**Rationale:** Minimal UI noise — only shown when genuinely relevant. Co-locates explanation with the tied/adjacent entry.

---

### 2.5 Safer Admin Actions — Confirmation Modal for Destructive Actions

**Current state:** `ArchivePoolButton`, `DeletePoolButton`, and `ReopenPoolButton` use `useFormState` but lack a pre-action confirmation step.

**Change:** Wrap each destructive action in a confirmation modal pattern. The modal must:
1. State the action explicitly ("Delete pool '{poolName}'?")
2. Require the user to type the pool name to confirm (for delete only)
3. Have a 3-second delay before the confirm button becomes active (for archive and reopen)
4. Cancel and Confirm buttons with clear visual distinction

**Files:**
- `src/components/ConfirmModal.tsx` (new — generic reusable modal)
- `src/components/ArchivePoolButton.tsx` — refactor to use `ConfirmModal`
- `src/components/DeletePoolButton.tsx` — refactor to use `ConfirmModal`
- `src/components/ReopenPoolButton.tsx` — refactor to use `ConfirmModal`

**ConfirmModal props:**
```typescript
interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireTextMatch?: { text: string; label: string }; // for delete
  confirmDelaySeconds?: number; // for reopen/archive
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Rationale:** Archive, delete, and reopen are irreversible or highly disruptive. The current server-action-without-confirm pattern is too easy to trigger accidentally.

---

### 2.6 Error States for Stale Data — ErrorStateBanner

**Current state:** Stale scenarios show `TrustStatusBar` with warning tone, but there's no dedicated error state with recovery action for `last_refresh_error !== null`.

**Change:** When `pool.last_refresh_error !== null`, render an `ErrorStateBanner` above the pool content (not inside `TrustStatusBar`). The banner:
- Tone: `error` (red)
- Message: "Score refresh failed: {error message}"
- Action: "Retry" button calling `refreshPoolScoresAction`
- Dismiss: No dismiss — this is a persistent failure state

**File:** `src/components/ErrorStateBanner.tsx` (new — simple banner with title, message, optional action)

**Rationale:** A failed refresh is a distinct degraded state from simply stale data. It requires explicit recovery action and should not be dismissible.

---

## 3. Component Inventory

| Component | Type | File | Notes |
|-----------|------|------|-------|
| `StatusChip` | existing | `src/components/StatusChip.tsx` | Extend with deadline display |
| `LockBanner` | existing | `src/components/LockBanner.tsx` | Upgrade to warning tone near deadline |
| `TrustStatusBar` | existing | `src/components/TrustStatusBar.tsx` | Add pulsing stale indicator + refresh button |
| `TieExplanationBadge` | new | `src/components/TieExplanationBadge.tsx` | Contextual tie explanation |
| `ConfirmModal` | new | `src/components/ConfirmModal.tsx` | Generic confirmation dialog |
| `ErrorStateBanner` | new | `src/components/ErrorStateBanner.tsx` | Persistent error with recovery |
| `ArchivePoolButton` | existing | `src/components/ArchivePoolButton.tsx` | Wrap in ConfirmModal |
| `DeletePoolButton` | existing | `src/components/DeletePoolButton.tsx` | Wrap in ConfirmModal |
| `ReopenPoolButton` | existing | `src/components/ReopenPoolButton.tsx` | Wrap in ConfirmModal |
| `refreshPoolScoresAction` | new | `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | Commissioner-only refresh |

---

## 4. Testing Approach

Each new component has unit tests:

- `TieExplanationBadge` — renders when `isTied=true`, does not render when `isTied=false`, displays correct birdie count
- `ConfirmModal` — renders title/body, confirm button activates after delay (where applicable), text match validation works for delete
- `ErrorStateBanner` — renders message, action button calls correct handler

Each modified component has existing test coverage extended:

- `StatusChip` — deadline prop renders formatted datetime
- `LockBanner` — warning tone within 24h of deadline
- `TrustStatusBar` — pulsing indicator + refresh button appear when stale

Server action: `refreshPoolScoresAction` — tested for commissioner-only access, success path, and error propagation.

---

## 5. Out of Scope

- Changes to scoring logic (best-ball, tiebreaker by birdies is already implemented)
- Changes to pool creation/configuration flows
- Changes to participant pick submission UX (only visibility/status)
- Changes to email or notification systems
- Any database schema changes (types are already in place)
