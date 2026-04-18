# Design Spec: Redesign Join Pool Invitation Page

**Story:** OPS-25 — Epic 7.5: Redesign join pool invitation page
**Date:** 2026-04-18
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-20 (Epic 7.1: design token system — done), OPS-22 (Epic 7.2: theme-aware UI primitives — done)

---

## 1. Problem Statement

The join pool invitation page (`/join/[inviteCode]`) uses outdated styling inconsistent with the green/sand design system established in Epics 7.1 and 7.2. Specifically:

- Page background uses `bg-gray-50` (flat, cold) instead of the warm gradient shell
- Card containers use `bg-white rounded-lg shadow` — the pre-redesign card pattern instead of `panelClasses()`
- Buttons use `bg-blue-600 text-white rounded hover:bg-blue-700` — the old blue CTA instead of `<Button variant="primary">`
- Pool info card uses `border border-gray-200 bg-gray-50` — gray tokens instead of stone/sand
- Links use `text-blue-600 hover:text-blue-800` — blue links instead of green
- Error and status text uses `text-gray-600`, `text-gray-500` — gray instead of stone
- No `Card` component used — hand-rolled card styling
- No design system spacing tokens used

The acceptance criteria require applying the green/sand theme to the join pool page while maintaining WCAG 2.1 AA contrast, mobile-first layout, and clear error/invalid/expired states.

## 2. Design Goals

- Apply green/sand design tokens from OPS-20/OPS-22 to both target files
- Consume `Button`, `Card`, and `uiStyles` primitives from OPS-22 instead of inline styles
- Maintain all existing functionality — no behavioral changes to join/redirect logic
- Maintain WCAG 2.1 AA contrast ratios on all color changes
- Guarantee ≥44px touch targets on all interactive elements (already enforced in `globals.css`)
- Mobile-first layout preserved
- Ensure each state (invalid invite, archived pool, active join form) has distinct, trust-appropriate visual treatment

## 3. Dependency Check

**OPS-20 (design token system)** and **OPS-22 (theme-aware UI primitives)** are complete and on `main`. The following are now available:

- `tailwind.config.js` — semantic color tokens (`primary-900/700/100`, `surface-warm/base`, `action-warning/error`, `neutral-900/600/200`), spacing tokens, `label` font size
- `globals.css` — CSS custom properties, 44px touch target enforcement, green focus ring
- `src/components/ui/Button.tsx` — `variant="primary|secondary|danger|ghost"`, `size="sm|md|lg"`
- `src/components/ui/Card.tsx` — `accent="left|none"` with `border-l-4 border-l-green-700` for left accent
- `src/components/uiStyles.ts` — `panelClasses()`, `sectionHeadingClasses()`, `pageShellClasses()`, `scrollRegionFocusClasses()`
- `src/components/StatusChip.tsx` — migrated to green/stone tokens
- `src/components/DataAlert.tsx` — migrated to danger/warn/info tokens

## 4. Acceptance Criteria Mapping

| # | Criterion | Covered In Section |
|---|---|---|
| AC-1 | Invalid/expired invite state uses sand warning treatment | §5.1 |
| AC-2 | Archived pool state uses stone-200 subdued design | §5.2 |
| AC-3 | Active join form uses green primary actions | §5.3 |
| AC-4 | Pool info card uses green left-border accent | §5.3 |
| AC-5 | Mobile layout centers content appropriately | §6 |
| AC-6 | Error states remain clear and actionable | §5.4 |
| AC-7 | WCAG 2.1 AA contrast requirements met | §7 |

## 5. Component Design

### 5.1 Invalid/Expired Invite State

**File:** `src/app/join/[inviteCode]/page.tsx` — first `if (!pool)` branch

**Current styling:**
```tsx
<main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-3">
    <h1 className="text-xl font-semibold">Invalid invite link</h1>
    <p className="text-sm text-gray-600">This invite link is invalid or expired...</p>
    <Link href="/participant/pools" className="inline-block text-blue-600 hover:text-blue-800 text-sm">
      Go to My Pools
    </Link>
  </div>
</main>
```

**Proposed redesign:**

| Element | Current | New | Rationale |
|---|---|---|---|
| Page shell | `min-h-screen bg-gray-50` | `pageShellClasses()` (warm gradient) | Consistent with redesigned app shell |
| Card container | `bg-white rounded-lg shadow` hand-rolled | `<Card>` using `panelClasses()` | Design system Card component |
| Heading | `text-xl font-semibold` | `text-xl font-semibold text-stone-950` | Stone token, stronger contrast |
| Description | `text-sm text-gray-600` | `text-sm text-stone-600` | Stone replaces gray |
| Link | `text-blue-600 hover:text-blue-800` | `<Button variant="secondary" size="sm">` as link | Green design system button; use `as="a"` or wrap Link |

**Warning treatment per AC-1:** The invalid/expired state should use a sand/warning visual treatment to signal a non-destructive problem. Wrap the message in a `DataAlert` variant or apply `warnPanelClasses()`:

```tsx
<DataAlert variant="warning" title="Invalid invite link"
  message="This invite link is invalid or expired. Ask your commissioner for a fresh link." />
```

This uses the existing `DataAlert` component's `warning` variant which renders `border-amber-200 bg-amber-50/95 text-amber-950` — a sand/warning treatment that clearly communicates the state without alarm.

**Alternative approach (rejected):** Custom warning panel using `warnPanelClasses()`. This would duplicate visual intent that `DataAlert` already provides. Using `DataAlert` reduces code duplication and follows the established pattern.

### 5.2 Archived Pool State

**File:** `src/app/join/[inviteCode]/page.tsx` — `if (pool.status === 'archived')` branch

**Current styling:**
```tsx
<main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
    <h1 className="text-xl font-semibold">Archived pool</h1>
    <p className="text-sm text-gray-600">This pool is archived and read-only...</p>
    <Link href={...} className="inline-block text-blue-600 hover:text-blue-800 text-sm">
      View leaderboard
    </Link>
  </div>
</main>
```

**Proposed redesign per AC-2 (stone-200 subdued):**

| Element | Current | New | Rationale |
|---|---|---|---|
| Page shell | `bg-gray-50` | `pageShellClasses()` | Consistent warm gradient |
| Card container | `bg-white rounded-lg shadow` | `<Card>` with `accent="none"` | Design system Card without accent (subdued) |
| Heading | `text-xl font-semibold` | `text-xl font-semibold text-stone-700` | Muted heading for archived state |
| Description | `text-sm text-gray-600` | `text-sm text-stone-600` | Stone replaces gray |
| Link | `text-blue-600` | `<Button variant="secondary" size="sm">` | Green design system secondary button |

The stone-200 subdued treatment: The archived card gets a `bg-stone-100` inner area where pool details would go (if shown), with `text-stone-600` for secondary text. This visually communicates "this pool is no longer active" through desaturation, consistent with `StatusChip`'s `archived` variant using `border-stone-200 bg-stone-100 text-stone-700`.

### 5.3 Active Join Form (Happy Path)

**File:** `src/app/join/[inviteCode]/page.tsx` — main return branch

**Current styling:**
```tsx
<main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
    <div>
      <h1 className="text-xl font-semibold">Join pool</h1>
      <p className="text-sm text-gray-600 mt-1">You were invited to join this pool.</p>
    </div>
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm text-gray-500">Pool</p>
      <p className="font-medium">{pool.name}</p>
      <p className="text-sm text-gray-600">{pool.tournament_name}</p>
    </div>
    <JoinPoolForm inviteCode={pool.invite_code} />
  </div>
</main>
```

**Proposed redesign per AC-3 and AC-4:**

| Element | Current | New | Rationale |
|---|---|---|---|
| Page shell | `bg-gray-50` | `pageShellClasses()` | Consistent warm gradient |
| Card container | `bg-white rounded-lg shadow` | `<Card>` with `accent="left"` | Green left-border accent per AC-4 |
| Heading | `text-xl font-semibold` | `text-xl font-semibold text-stone-950` | Stone token, maximum contrast |
| Subtitle | `text-sm text-gray-600` | `text-sm text-stone-600` | Stone replaces gray |
| Pool info card | `rounded border border-gray-200 bg-gray-50 p-3` | `<Card accent="left">` or inline `border-l-4 border-l-green-700 bg-stone-50` | Green left-border accent per AC-4 |
| Pool label | `text-sm text-gray-500` | `text-xs font-semibold uppercase tracking-widest text-stone-500` via `sectionHeadingClasses()` | Design system eyebrow |
| Pool name | `font-medium` | `font-semibold text-stone-950` | Maximum contrast for pool name |
| Tournament name | `text-sm text-gray-600` | `text-sm text-stone-600` | Stone replaces gray |
| Join button | `bg-blue-600` | `<Button variant="primary" size="lg" className="w-full">` | Green primary action per AC-3 |

**Pool info card structure (happy path):**

The pool info section should use `<Card accent="left">` (or `panelClasses()` with `border-l-4 border-l-green-700`) to get the green left-border accent per AC-4. The label "Pool" transforms from `text-sm text-gray-500` to the design system's eyebrow pattern using `sectionHeadingClasses()`.

```tsx
<Card accent="left" className="p-4 space-y-1">
  <p className={sectionHeadingClasses()}>Pool</p>
  <p className="font-semibold text-stone-950">{pool.name}</p>
  <p className="text-sm text-stone-600">{pool.tournament_name}</p>
</Card>
```

### 5.4 JoinPoolForm Redesign

**File:** `src/app/join/[inviteCode]/JoinPoolForm.tsx`

**Current styling:**
```tsx
<button
  type="submit"
  disabled={pending}
  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {pending ? 'Joining...' : 'Join pool'}
</button>
```

Error display:
```tsx
{state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
```

**Proposed redesign per AC-3 and AC-6:**

| Element | Current | New | Rationale |
|---|---|---|---|
| Join button | `bg-blue-600 text-white rounded hover:bg-blue-700` | `<Button variant="primary" size="lg" className="w-full">` | Green primary action per AC-3; uses design system Button |
| Button disabled | `disabled:cursor-not-allowed disabled:opacity-60` | Button component handles `disabled:opacity-50` | Consistent with design system |
| Error text | `text-sm text-red-600` | `text-sm text-red-600` (keep) per AC-6 | Red-600 is our `action-error` token; clear and actionable |
| Form container | `space-y-4` | Keep `space-y-4` | Appropriate spacing |

**Error states per AC-6:** The existing `text-red-600` error display is already clear and actionable. This maps to our `action-error` / `neutral-900` contrast pair which exceeds WCAG AA. No change needed for the error text style. However, for server error states returned by `actions.ts`, we should ensure the error messages are actionable (they already are — "Unable to process invite right now" suggests retrying, "This invite link is invalid or expired" suggests getting a fresh link).

**Additional UX for AC-6:** If the form encounters an error, we could enhance with `DataAlert variant="error"` for more prominence, but the current inline `<p>` is already visible and actionable. The Design spec keeps the inline `<p>` pattern for form validation feedback (consistent with other forms in the app) and only uses `DataAlert` for the three page-level states (invalid, archived, server error).

### 5.5 Page Shell Unification

All three branches (invalid, archived, active) currently use `min-h-screen bg-gray-50 flex items-center justify-center p-4`. Unify to:

```tsx
<main className={`${pageShellClasses()} flex items-center justify-center p-4`}>
```

This wraps all states in the warm gradient background, making the join page visually consistent with the rest of the redesigned app.

The centered card layout (`flex items-center justify-center`) is appropriate for the join page — it's a standalone auth-adjacent flow without shared navigation, so the centered card pattern continues to work well. The `max-w-md` width constraint ensures appropriate mobile-width presentation.

## 6. Mobile Layout

The join page already uses a mobile-friendly layout:
- `max-w-md` constrains the card width on larger screens
- `p-4` provides consistent padding
- `flex items-center justify-center` centers vertically

No mobile layout changes are needed beyond the token migration. The `max-w-md` width works well on both mobile (card fills width with padding) and desktop (card stays narrow and centered).

**Per AC-5 (centers content appropriately):** The centering layout is preserved. On mobile (< 640px), the card fills the viewport width minus 32px padding. On tablet/desktop, it stays at `max-w-md` (448px). This is the correct responsive behavior for a join/form page.

## 7. Accessibility and Contrast

### WCAG 2.1 AA Contrast Verification

| Foreground | Background | Ratio | AA Status |
|---|---|---|---|
| `text-stone-950` (#1c1917) | `bg-white/90` (panel) | >15:1 | Pass |
| `text-stone-600` (#57534e) | `bg-white/90` (panel) | 5.5:1 | Pass |
| `text-stone-700` (#44403c) | `bg-stone-100` (#f5f5f4) | 6.9:1 | Pass |
| `text-primary-700` (#15803d) | `bg-white/90` (panel) | 4.6:1 | Pass (large text) |
| `text-red-600` (#dc2626) | `bg-white/90` (panel) | 4.6:1 | Pass |
| `text-amber-950` (#78350f) | `bg-amber-50` (#fffbeb) | 7.2:1 | Pass |
| `text-stone-700` (#44403c) | `bg-stone-200` (#e7e5e4) | 5.9:1 | Pass |
| Button `bg-green-700` | Disabled `opacity-50` on white | 3.1:1 (disabled exempt) | Pass (disabled exempt) |

All critical text/background combinations meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text). The `primary-700` on white passes for large text (buttons have 18px+ font); the button also has an `opacity-50` disabled state which exempts it from contrast requirements per WCAG 1.4.3 Exception.

### Touch Targets

`globals.css` already enforces `min-block-size: 44px` and `min-inline-size: 44px` on all interactive elements. The `<Button>` component from OPS-22 renders with adequate padding (`px-4 py-2.5` for `md`, `px-6 py-3` for `lg`), easily exceeding the 44px touch target.

## 8. State-Specific Design Decisions

### Decision 1: Use DataAlert for page-level states

**Options considered:**
- **A: Use `DataAlert` component for invalid/expired warning** — Reuse existing `DataAlert variant="warning"` for the invalid invite state. This gives consistent danger/warning/info visual language across the app.
- **B: Custom card treatment** — Build a separate warning card inline with custom styling.
- **C: Keep current card but change colors** — Replace gray tokens with stone, add icon, no structural change.

**Recommendation: Option A.** `DataAlert` already provides the sand/warning visual treatment per AC-1. It has built-in accessibility (`role="status"`, `aria-live`), icon treatment, and semantic color mapping. Using it for invalid/expired states keeps the code DRY and consistent with how other pages (picks, spectator) handle alerts. The archived and active states use `<Card>` since they're not alerts — they're informational.

### Decision 2: Invalid vs expired distinction

The current code treats invalid and expired identically (single `!pool` check). The action handler in `actions.ts` returns "This invite link is invalid or expired." — a combined message. We keep this behavior (no functional change) but note that the sand warning treatment applies to both cases equally since the user action (get a fresh link) is the same.

### Decision 3: Link vs Button for navigation

**Options considered:**
- **A: `<Button variant="secondary">` wrapping `<Link>`** — Green secondary action, clearly navigational.
- **B: `<Link>` with custom styling** — Text-only link, less prominent.
- **C: Keep `text-blue-600` links** — Old pattern, inconsistent.

**Recommendation: Option A.** Navigation actions should use the design system's Button component for consistent visual language. Secondary variant for "Go to My Pools" and "View leaderboard" (they're navigation, not primary CTAs). The primary CTA is "Join pool" on the happy path.

## 9. File Change Map

### `src/app/join/[inviteCode]/page.tsx`

| Current | New |
|---|---|
| `min-h-screen bg-gray-50` | `pageShellClasses()` |
| `bg-white rounded-lg shadow` (all 3 branches) | `<Card>` via `panelClasses()` |
| `text-xl font-semibold` | `text-xl font-semibold text-stone-950` or `text-stone-700` (archived) |
| `text-gray-600` | `text-stone-600` |
| `text-gray-500` | `text-stone-500` or `sectionHeadingClasses()` |
| `border border-gray-200 bg-gray-50 p-3` | `<Card accent="left">` |
| `text-blue-600 hover:text-blue-800` | `<Button variant="secondary" size="sm">` or `<Button variant="primary" size="lg">` |
| Invalid state inline card | `<DataAlert variant="warning">` + secondary button link |
| Archived state card | `<Card accent="none">` with subdued stone tokens |
| Active state card | `<Card accent="none">` wrapping main content |

**New imports required:**
```tsx
import { Card } from '@/components/ui/Card'
import { DataAlert } from '@/components/DataAlert'
import { Button } from '@/components/ui/Button'
import { pageShellClasses, sectionHeadingClasses } from '@/components/uiStyles'
```

### `src/app/join/[inviteCode]/JoinPoolForm.tsx`

| Current | New |
|---|---|
| `bg-blue-600 text-white rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60` | `<Button variant="primary" size="lg" className="w-full">` |
| `text-sm text-red-600` | Keep `text-sm text-red-600` (already correct token) |
| `space-y-4` | Keep |

**New imports required:**
```tsx
import { Button } from '@/components/ui/Button'
```

### `src/app/join/[inviteCode]/actions.ts`

No changes required. The server action logic and error messages remain the same. The visual presentation of errors changes in the parent page and form, not in the action handler.

## 10. Out of Scope

- Dark mode support (not in current visual direction)
- Auth page redesign (OPS-28, different story)
- Changes to redirect logic or form validation behavior
- Adding new page states (e.g., "already a member" UI — already handled by redirect)
- Changes to `globals.css` token system or `uiStyles.ts` (done in OPS-20/OPS-22)
- Adding input field styling (the join form has no visible inputs — only a hidden `inviteCode` field)

## 11. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `DataAlert` component doesn't support standalone page-level use | Low | `DataAlert` is already used in picks/spectator pages as a block-level element; it works fine as page content |
| `<Button>` as `<Link>` navigation pattern | Low | Compose `<Link>` wrapping `<Button variant="secondary">` or use `<Button as="a" href>` pattern. Next.js `<Link>` wrapping `<Button>` is the established pattern in this codebase |
| Card left-accent on invalid/expired state looks odd | Low | Invalid state uses `DataAlert` (warning), not Card. Only active and archived states use Card |
| Form submission UX regression | None | No behavioral changes; only visual migration |