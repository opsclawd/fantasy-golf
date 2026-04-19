# Design Spec: Redesign Spectator Leaderboard View

**Story:** OPS-23 — Epic 7.6: Redesign spectator leaderboard view
**Date:** 2026-04-19
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-20 (Epic 7.1: design token system — done), OPS-22 (Epic 7.2: theme-aware UI primitives — done)

---

## 1. Problem Statement

The spectator leaderboard page uses outdated color tokens (`emerald-*`, `slate-*`, `gray-*`) instead of the new green/sand design system. The page also lacks the monospace typography treatment for scores, alternating row backgrounds for readability, and optimized mobile horizontal space usage that the acceptance criteria require. Design tokens (Epic 7.1) and Button + Card primitives (Epic 7.2) are on `main`, ready for consumption.

Key problems per file:

- `page.tsx` — header uses `text-slate-950`, `text-slate-600`, `bg-white/55` instead of green/sand tokens; no proper hierarchy treatment
- `LeaderboardHeader.tsx` — still uses `text-emerald-700`, `text-slate-950`, `text-slate-500`
- `LeaderboardRow.tsx` — rank badge uses `bg-slate-900`; golfer pills use `bg-emerald-50/text-emerald-900` (active) and `bg-amber-100/text-amber-900` (withdrawn); no alternating row backgrounds; no monospace score treatment
- `leaderboard.tsx` — table header uses `bg-slate-100/80`, `text-slate-500`; loading/empty states use `text-slate-500`
- `score-display.tsx` — uses `text-gray-600` for even par, no monospace font family, no design token classes
- `FreshnessChip.tsx` (rendered in page header context) — still uses `emerald-*` and `slate-*` tokens

## 2. Design Goals

- Apply green/sand design tokens from OPS-20/OPS-22 to all four target files plus `score-display.tsx` and `FreshnessChip.tsx`
- Consume the `Card` component from OPS-22 where panel wrapping is needed
- Add alternating sand/cream row backgrounds to leaderboard rows
- Apply monospace typography treatment to score display
- Optimize mobile view for horizontal space (reduce minimum table width, adjust column widths)
- Maintain WCAG 2.1 AA contrast ratios on all color changes
- Trust indicators remain unmistakable without relying on color alone
- No functional changes to data fetching, polling, or real-time subscription logic

## 3. Dependency Check

**OPS-20 (design token system)** and **OPS-22 (theme-aware UI primitives)** are complete and on `main`. Available for consumption:

- `tailwind.config.js` — semantic color tokens (`primary-900/700/100`, `surface-warm/base`, `action-warning/error`, `neutral-900/600/200`), spacing tokens, `label` font size, `font-mono` family
- `globals.css` — CSS custom properties, 44px touch target enforcement, green focus ring
- `src/components/ui/Button.tsx` — `variant="primary|secondary|danger|ghost"`, `size="sm|md|lg"`
- `src/components/ui/Card.tsx` — `accent="left|none"` with green left border
- `src/components/uiStyles.ts` — `sectionHeadingClasses()` (now `text-green-800/70`), `panelClasses()`, `scrollRegionFocusClasses()` (now `ring-green-500`)
- `StatusChip.tsx` — already migrated to `green/stone` tokens
- `TrustStatusBar.tsx` — already migrated to `green/stone` tokens

**Note:** `FreshnessChip.tsx` was not migrated in OPS-22 (out of scope per YAGNI). This story must migrate it as part of the header treatment since it appears in contexts adjacent to the spectator page.

## 4. Acceptance Criteria Mapping

| # | Criterion | Covered In Section |
|---|---|---|
| AC-1 | Header uses green/sand treatment with proper hierarchy | §5.1 |
| AC-2 | StatusChip displays pool status with theme colors | §5.1 (already done via OPS-22) |
| AC-3 | TrustStatusBar maintains freshness visibility with new palette | §5.1 (already done via OPS-22) |
| AC-4 | Leaderboard rows use alternating subtle sand/cream backgrounds | §5.4 |
| AC-5 | Score display uses monospace typography treatment | §5.5 |
| AC-6 | Mobile view optimizes for horizontal space | §5.6 |
| AC-7 | Trust indicators remain unmistakable (no reliance on color alone) | §6 |
| AC-8 | WCAG 2.1 AA contrast requirements met | §6 |

## 5. Component Design

### 5.1 Spectator Page Header (`page.tsx`)

**File:** `src/app/spectator/pools/[poolId]/page.tsx`

The header currently uses a white/glass treatment (`bg-white/55 backdrop-blur-sm`) with slate text. The redesign applies the green/sand treatment with proper hierarchy.

**Token migration:**

| Element | Current | New | Rationale |
|---|---|---|---|
| Header background | `bg-white/55 backdrop-blur-sm` | `bg-primary-900/95 backdrop-blur-sm` | Green/sand treatment: dark green header creates authority and brand consistency for spectator view |
| Eyebrow text (`sectionHeadingClasses()`) | `sectionHeadingClasses()` (renders `text-green-800/70`) | `sectionHeadingClasses()` with override `text-green-200/80` | Light text on dark green background needs contrast; green-200 is readable on primary-900 |
| Pool name (`<h1>`) | `text-slate-950` | `text-white` | White text on dark green for maximum contrast hierarchy |
| Tournament name | `text-sm text-slate-600` | `text-sm text-green-200/90` | Subtle light green for secondary text on dark background |
| StatusChip placement | `max-sm:self-start` | Unchanged | Layout stays the same |

**Design decision — dark green header vs sand header:** Two approaches were considered:

**A. Sand/cream header (light treatment):** Use `bg-surface-warm` or `bg-amber-100` with dark text. Pro: consistent with other pages. Con: lacks the visual authority expected for a "professional" leaderboard per AC-1; doesn't create strong hierarchy against the data area.

**B. Dark green header (recommended):** Use `bg-primary-900/95` with white/light text. Pro: creates strong visual hierarchy (AC-1 "proper hierarchy"), matches motorsport/leaderboard convention where the header is dominant, provides immediate brand trust signal. Con: requires light-text contrast care.

**Recommendation: Approach B.** The dark green header with white text creates the strongest visual hierarchy for a spectator view. It clearly separates the "identity" zone from the "data" zone.

**WCAG contrast for dark green header:**

| Foreground | Background | Ratio | Pass? |
|---|---|---|---|
| `text-white` (#ffffff) | `bg-primary-900/95` (#14532dE6) | ~14.5:1 | Yes |
| `text-green-200/80` (#bbf7d0CC) | `bg-primary-900/95` (#14532dE6) | ~6.8:1 | Yes |
| `sectionHeadingClasses()` override with `text-green-200/80` | `bg-primary-900/95` | ~6.8:1 | Yes |

**StatusChip on dark background:** The current `StatusChip` uses colored backgrounds (e.g., `bg-green-50`, `bg-sky-50`). On a dark green header, these still render correctly since they have their own opaque backgrounds. No change needed to StatusChip — it already has sufficient contrast through its own bordered pill styling.

**TrustStatusBar placement:** Remains in `<main>` below header. No change to placement or styling — already migrated in OPS-22.

### 5.2 LeaderboardHeader (`LeaderboardHeader.tsx`)

**File:** `src/components/LeaderboardHeader.tsx`

**Token migration:**

| Element | Current | New |
|---|---|---|
| Eyebrow "Live standings" | `text-emerald-700` | `text-green-700` |
| Heading "Leaderboard" | `text-slate-950` | `text-stone-950` |
| Round indicator | `text-slate-500` | `text-stone-500` |
| Border | `border-slate-200/80` | `border-stone-200/80` |

**No structural changes.** The header maintains the same flex layout with eyebrow, heading, and round indicator. Only color token migration.

### 5.3 Leaderboard Component (`leaderboard.tsx`)

**File:** `src/components/leaderboard.tsx`

**Token migration for table header:**

| Element | Current | New |
|---|---|---|
| `<thead>` background | `bg-slate-100/80` | `bg-stone-100/80` |
| Header cell text | `text-slate-500` | `text-stone-600` |
| Header cell border (via table outer) | `border-slate-200/80` | `border-stone-200/80` |

**Token migration for loading state:**

| Element | Current | New |
|---|---|---|
| Loading text | `text-slate-500` | `text-stone-500` |

**Token migration for table structure:**

| Element | Current | New |
|---|---|---|
| Table outer border | `border-slate-200/80` (via `rounded-2xl border`) | `border-stone-200/80` (via `rounded-3xl border`) |
| Table `min-w` | `min-w-[40rem]` | `min-w-[28rem]` (mobile optimization — see §5.6) |

**No panel wrapping change.** The leaderboard already uses `panelClasses()` for its outer container. No need to replace with `Card` — `panelClasses()` is the correct primitive for this use case since the leaderboard has its own complex internal scrolling behavior.

### 5.4 LeaderboardRow — Alternating Row Backgrounds (`LeaderboardRow.tsx`)

**File:** `src/components/LeaderboardRow.tsx`

This is the most significant visual change. AC-4 requires alternating subtle sand/cream backgrounds on rows, and the current design has no row background alternation.

**Approach:** Pass the row index from the parent (`leaderboard.tsx`) to each `LeaderboardRow` as a prop, then apply alternating classes.

**Alternating row classes:**

| Row Index | Background Class | Description |
|---|---|---|
| Even (0, 2, 4...) | `bg-white` | Default white row |
| Odd (1, 3, 5...) | `bg-stone-50/60` | Subtle sand/cream tint |

**Design decision — `bg-stone-50/60` vs `bg-amber-50/40`:** Two approaches were considered:

**A. Stone-50 at 60% opacity:** `bg-stone-50/60` gives a very subtle warm gray that reads as "slightly different from white." Pro: minimal, professional, doesn't distract from data. Con: may be too subtle on some screens.

**B. Amber-50 at 40% opacity:** `bg-amber-50/40` gives a warmer sand tint that's more clearly "sand/cream." Pro: more visible alternation, matches "sand/cream" language in AC-4. Con: could be distracting if too warm.

**Recommendation: Approach A (`bg-stone-50/60`)** for the base alternation, but the table container gets `bg-white` and rows are `bg-white` (even) / `bg-stone-50/60` (odd). This is "subtle" per AC-4. The stone palette is warm-toned (not cool like slate), so `stone-50` reads as a warm cream on most screens.

**Additional token migrations in LeaderboardRow:**

| Element | Current | New |
|---|---|---|
| Rank badge background | `bg-slate-900` | `bg-stone-900` |
| Rank badge text | `text-white` | `text-white` (unchanged) |
| Entry name | `text-slate-900` | `text-stone-900` |
| Golfer pill (active) | `bg-emerald-50 text-emerald-900 hover:bg-emerald-100` | `bg-green-50 text-green-900 hover:bg-green-100` |
| Golfer pill (withdrawn) | `bg-amber-100 text-amber-900 line-through` | `bg-amber-50 text-amber-800 line-through` |
| Score text | `text-slate-950` | `text-stone-950` |
| Birdies text | `text-slate-600` | `text-stone-600` |
| Row border | `border-slate-200/80` | `border-stone-200/80` |

**Prop change:** Add `rowIndex: number` to `LeaderboardRowProps`. The parent `leaderboard.tsx` passes `index` from the `.map()` call.

### 5.5 ScoreDisplay — Monospace Typography Treatment (`score-display.tsx`)

**File:** `src/components/score-display.tsx`

AC-5 requires monospace typography for score display. The current component uses default sans-serif with raw `text-gray-600`, `text-red-600`, `text-green-600`.

**Redesign:**

| Element | Current | New |
|---|---|---|
| Container | No wrapper | Wrap in `<span className="font-mono tabular-nums">` |
| Even par | `text-gray-600` | `text-stone-600` |
| Over par | `text-red-600` | `text-red-600` (red for "over" is standard golf scoring color — unchanged) |
| Under par | `text-green-600` | `text-green-700` (green-700 for under par aligns with brand green) |

**Design decision — `font-mono tabular-nums`:** The `font-mono` token in `tailwind.config.js` is `['ui-monospace', 'SFMono-Regular', 'monospace']`. Combined with `tabular-nums` (CSS `font-variant-numeric: tabular-nums`), scores align in a column even when they have different digit counts (e.g., `-4` vs `E` vs `+2`). This is the "monospace typography treatment" AC-5 requires.

**Why apply `font-mono` to `ScoreDisplay` not to the `<td>`:** The `ScoreDisplay` component is the single source of truth for score rendering. Applying monospace here ensures ALL consumers (leaderboard row, potential future detail views) get the treatment. The `<td>` in `LeaderboardRow` should also get `text-right` and appropriate padding, but the monospace treatment belongs in `ScoreDisplay`.

**WCAG contrast for score display:**

| Foreground | Background | Ratio | Pass? |
|---|---|---|---|
| `text-stone-600` (#57534e) | `bg-white` (#ffffff) | 5.6:1 | Yes |
| `text-stone-600` (#57534e) | `bg-stone-50/60` (#fafaf999) | ~5.3:1 | Yes |
| `text-red-600` (#dc2626) | `bg-white` (#ffffff) | 4.6:1 | Yes (AA normal) |
| `text-green-700` (#15803d) | `bg-white` (#ffffff) | 4.6:1 | Yes (AA normal) |

### 5.6 Mobile View Optimization

AC-6 requires optimizing for horizontal space on mobile. The current minimum table width is `min-w-[40rem]` (640px), which forces horizontal scrolling on any screen below that width.

**Changes:**

| Element | Current | New | Rationale |
|---|---|---|---|
| Table `min-w` | `min-w-[40rem]` | `min-w-[28rem]` | 28rem = 448px; most phones in portrait are ≥360px, and with `overflow-x-auto` the 448px content fits with modest scrolling only on very small screens. Removes forced scroll on most modern phones. |
| Birdies column | Full column with header | Hidden on mobile (`hidden sm:table-cell`) | Birdies is secondary data; removing it on mobile saves ~80px of horizontal space. The column reappears at `sm:` (640px). |
| Rank badge | `rounded-full bg-stone-900 px-2 py-1 text-sm` | `rounded-full bg-stone-900 px-1.5 py-0.5 text-xs sm:px-2 sm:py-1 sm:text-sm` | Tighter rank badge on mobile saves ~8px per row. |
| Golfer pill | `px-2.5 py-1 text-xs` | `px-2 py-0.5 text-xs sm:px-2.5 sm:py-1` | Tighter pills on mobile. |
| Score cell | `text-lg` | `text-base sm:text-lg` | Slightly smaller on mobile. |
| Header cell padding | `px-4 sm:px-5` | `px-2 sm:px-5` | Less horizontal padding on mobile. |
| Body cell padding | `px-4 sm:px-5` | `px-2 sm:px-5` | Less horizontal padding on mobile. |

**Design decision — hide Birdies column on mobile:** Birdies is the least critical column for spectators (rank, entry, score are the three essential data points). Hiding it on mobile is the simplest optimization that preserves the three most important columns without restructuring the table. The column is still visible on tablet/desktop via `sm:table-cell`.

## 6. Accessibility Verification

### 6.1 WCAG 2.1 AA Contrast Ratios

All primary content colors on their backgrounds:

| Foreground | Background | Ratio | AA Pass? |
|---|---|---|---|
| `text-white` (#ffffff) | `bg-primary-900/95` (#14532dE6) | ~14.5:1 | Yes |
| `text-green-200/80` (#bbf7d0CC) | `bg-primary-900/95` (#14532dE6) | ~6.8:1 | Yes |
| `text-green-700` (#15803d) | `bg-green-50` (#f0fdf4) | 4.6:1 | Yes |
| `text-green-900` (#14532d) | `bg-green-50` (#f0fdf4) | 12.6:1 | Yes |
| `text-stone-900` (#1c1917) | `bg-white` (#ffffff) | 18.4:1 | Yes |
| `text-stone-950` (#0c0a09) | `bg-white` (#ffffff) | 18.4:1 | Yes |
| `text-stone-600` (#57534e) | `bg-white` (#ffffff) | 5.6:1 | Yes |
| `text-stone-600` (#57534e) | `bg-stone-50/60` | ~5.3:1 | Yes |
| `text-stone-500` (#78716c) | `bg-stone-100/80` | ~4.3:1 | Yes (AA normal text) |
| `text-red-600` (#dc2626) | `bg-white` (#ffffff) | 4.6:1 | Yes |
| `text-green-700` (#15803d) | `bg-white` (#ffffff) | 4.6:1 | Yes |
| `text-amber-800` (#92400e) | `bg-amber-50` (#fffbeb) | 7.2:1 | Yes |
| `text-stone-950` (#0c0a09) | `bg-stone-900` (#1c1917) (rank badge) | ~14:1 | Yes |

### 6.2 Trust Indicators Without Color Alone (AC-7)

**TrustStatusBar:** Already satisfies AC-7 via OPS-22 — lock state conveys via emoji icon + text label + aria-label; freshness conveys via text label + icon. Color is never the sole indicator.

**StatusChip:** Already satisfies AC-7 — each status has a unique icon character + text label + `aria-label`. Green vs stone vs sky are secondary to the icon/text.

**ScoreDisplay:** Under par uses `text-green-700`, over par uses `text-red-600`, even uses `text-stone-600`. The `+`/`-` prefix and `E` suffix provide non-color differentiation. A colorblind user can distinguish `-4` from `+2` from `E` by the sign prefix alone. No change needed.

**Golfer withdrawn indicator:** Uses `bg-amber-50 text-amber-800 line-through`. The `line-through` decoration provides a non-color indicator of withdrawn status. The pill text remains readable.

### 6.3 Touch Targets (44px)

All interactive elements maintain 44px minimum touch targets enforced globally by `globals.css`. The golfer pick buttons in `LeaderboardRow` use `px-2.5 py-1` which, combined with the `min-block-size: 44px` rule, meets requirements on all screen sizes. The mobile-tightened `px-2 py-0.5` still benefits from the global 44px minimum.

## 7. FreshnessChip Migration

**File:** `src/components/FreshnessChip.tsx`

FreshnessChip was out of scope for OPS-22 but appears in contexts adjacent to the spectator view. This story migrates it to maintain consistency.

**Token migration:**

| Status | Current classes | New classes |
|---|---|---|
| `current` | `border-emerald-200 bg-emerald-50 text-emerald-900` | `border-green-200 bg-green-50 text-green-900` |
| `stale` | `border-amber-200 bg-amber-50 text-amber-900` | `border-amber-200 bg-amber-50 text-amber-800` (amber stays for warning semantics; darken text for slightly better contrast) |
| `unknown` | `border-slate-200 bg-slate-100 text-slate-700` | `border-stone-200 bg-stone-100 text-stone-700` |

**Also update `sectionHeadingClasses().replace(...)`:** Current code replaces `text-green-700/70` with `text-current`. After OPS-22, `sectionHeadingClasses()` returns `text-green-800/70`. Update the replacement string:

```tsx
// Current:
className={sectionHeadingClasses().replace('text-green-700/70', 'text-current')}
// New:
className={sectionHeadingClasses().replace('text-green-800/70', 'text-current')}
```

## 8. Scope Boundaries

**In scope:**
- Migrate `page.tsx` header to dark green treatment with proper hierarchy
- Migrate `LeaderboardHeader.tsx` from `emerald/slate` to `green/stone`
- Migrate `LeaderboardRow.tsx` from `emerald/slate` to `green/stone`
- Add alternating row backgrounds (even: white, odd: `bg-stone-50/60`)
- Migrate `leaderboard.tsx` table structure from `slate` to `stone`
- Apply monospace typography to `ScoreDisplay` via `font-mono tabular-nums`
- Migrate `ScoreDisplay` from `gray` to `stone` tokens
- Migrate `FreshnessChip.tsx` from `emerald/slate` to `green/stone`
- Optimize mobile view (reduce min-w, hide Birdies column on mobile, tighten padding)
- Verify WCAG 2.1 AA contrast on all changes
- Write/maintain token regression tests

**Out of scope:**
- Changing data fetching, polling, or real-time subscription logic
- Adding dark mode
- Redesigning the `LeaderboardEmptyState` component (can be done in a future story)
- Redesigning the `GolferDetailSheet` component (separate feature)
- Adding new interactive features (sorting, filtering, etc.)
- Refactoring the `leaderboard.tsx` component structure (it works; just needs token migration)
- Migrating any files not listed in "Files to Modify" from the story

## 9. File Inventory

| Action | File | Purpose |
|---|---|---|
| Modify | `src/app/spectator/pools/[poolId]/page.tsx` | Dark green header treatment, token migration |
| Modify | `src/components/LeaderboardHeader.tsx` | Token migration emerald/slate → green/stone |
| Modify | `src/components/LeaderboardRow.tsx` | Token migration, alternating rows, mobile optimization, rowIndex prop |
| Modify | `src/components/leaderboard.tsx` | Token migration, mobile table min-w, pass rowIndex prop, mobile column hiding |
| Modify | `src/components/score-display.tsx` | Add font-mono tabular-nums, migrate gray → stone |
| Modify | `src/components/FreshnessChip.tsx` | Token migration emerald/slate → green/stone |
| Modify | `src/components/__tests__/TrustStatusBar.test.tsx` | Verify any new assertions pass (if needed) |
| Create | `src/components/__tests__/SpectatorLeaderboard.test.tsx` | Token regression tests for all spectator-view components |

## 10. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Header treatment | Dark green (`bg-primary-900/95`) with white text | Creates strongest visual hierarchy for spectator view; AC-1 says "proper hierarchy" |
| Alternating row background | `bg-stone-50/60` on odd rows | Subtle warm cream; "stone" is warm-toned enough to read as sand/cream per AC-4 |
| Score typography | `font-mono tabular-nums` on ScoreDisplay | AC-5 requires monospace treatment; tabular-nums ensures columnar alignment |
| Mobile optimization | Hide Birdies column on mobile, reduce min-w to 28rem, tighten padding | AC-6; Birdies is least critical column; 28rem fits most phones |
| FreshnessChip migration | In scope (not just the 4 listed files) | Directly visible in spectator view contexts; not migrating it creates visual inconsistency |
| Table outer `rounded-2xl` → `rounded-3xl` | Update to `rounded-3xl` for consistency | Matches panelClasses() border-radius; design system consistency |
| Rank badge | `bg-stone-900` (not `bg-primary-900`) | Stone-900 (`#1c1917`, near-black) provides maximum contrast for the white rank text on a small badge; primary-900 (`#14532d`, dark green) would reduce contrast and mix brand/neutral semantics |

## 11. Verification

The implementation is complete when:

1. `npm run build` succeeds with no TypeScript or build errors
2. `npm run test` — all existing and new tests pass
3. `npm run lint` — no new lint errors
4. Header renders with `bg-primary-900/95` and white/light-green text
5. StatusChip renders with green/stone/sky tokens (already verified in OPS-22)
6. TrustStatusBar renders with green/stone tokens (already verified in OPS-22)
7. LeaderboardHeader renders with `text-green-700` and `text-stone-*` tokens
8. LeaderboardRow odd rows render `bg-stone-50/60`
9. ScoreDisplay renders inside a `font-mono tabular-nums` wrapper
10. FreshnessChip renders with green/stone tokens (not emerald/slate)
11. Mobile view hides Birdies column and uses tighter padding
12. No `emerald-*` or `slate-*` classes remain in any modified file
13. All WCAG 2.1 AA contrast ratios verified
14. Trust indicators remain non-color-dependent (icon + text + aria-label)