# QA Report: OPS-21 — Epic 7.3: Redesign participant picks page

**Reviewer:** ReviewQA
**Date:** 2026-04-18
**PR:** #11 (feature/OPS-21-redesign-participant-picks-page)
**Status:** FAIL — 2 MUST_FIX items, 3 SUGGESTION items

---

## Test Suite Results

| Suite | Result |
|-------|--------|
| `npm run test` (Vitest) | 294 tests, 43 files — ALL PASS |
| `npm run build` (Next.js) | SUCCESS — no TypeScript errors |
| `npm run lint` (ESLint) | No warnings or errors |

---

## Acceptance Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| AC-1 | Picks page uses new color tokens from design system | PASS | All 5 target files migrated: slate→stone, sky→green, emerald→green, blue→Button |
| AC-2 | LockBanner maintains clear visibility (red for locked, green-100 for open) | PASS | Already migrated in OPS-22; no changes needed. Verified `bg-green-100` for open state |
| AC-3 | TrustStatusBar uses green/sand treatment for freshness indicators | PASS | Already migrated in OPS-22; no changes needed. Verified `border-green-200` and `text-stone-*` tokens |
| AC-4 | GolferPicker receives card-based redesign with green left-border accents | PASS | `bg-green-50 border-l-4 border-l-green-700` on selected golfer rows. Focus ring migrated to `focus:ring-green-500` |
| AC-5 | SubmissionConfirmation uses sand/cream success state | PASS | `bg-amber-100/95` confirmed in implementation |
| AC-6 | SelectionSummaryCard uses updated card styling | **PARTIAL FAIL** | `border-green-200/80` and `bg-green-50/90` correct, BUT heading class replacement is broken (see MUST_FIX #1) |
| AC-7 | All interactive elements meet ≥44px touch target requirement | PASS | `globals.css` enforces `min-block-size: 44px`. GolferPicker buttons use `px-4 py-3`. Button component inherits 44px |
| AC-8 | Mobile layout is prioritized and tested | PASS | Responsive breakpoints preserved. Layout unchanged — only CSS class migrations |
| AC-9 | No functional changes to pick submission logic | PASS | `actions.ts` diff is empty. No logic changes in any component |
| AC-10 | WCAG 2.1 AA contrast requirements met | PASS | green-800 on green-50 (6.8:1), stone-950 on white (18.4:1), stone-600 on white (5.6:1), green-800 on amber-100 (6.5:1) — all AA pass |

---

## MUST_FIX Findings

### MUST_FIX #1: `.replace('text-emerald-800/70', ...)` is a no-op — broken heading colors

**Files:** `src/components/SelectionSummaryCard.tsx:32`, `src/components/StatusChip.tsx:37`

**Problem:** `sectionHeadingClasses()` was changed in `uiStyles.ts` from `text-green-800/70` to `text-green-700/70`. However, both `SelectionSummaryCard.tsx` and `StatusChip.tsx` still call `.replace('text-emerald-800/70', ...)`. Since the base string no longer contains `text-emerald-800/70`, the `.replace()` is a no-op — it silently fails.

**Impact:**
- `SelectionSummaryCard`: `.replace('text-emerald-800/70', 'text-green-700/80')` does nothing. The heading gets `text-green-700/70` instead of the spec-required `text-green-700/80`. Per §5.6, the heading should use `text-green-700/80` for optimal contrast.
- `StatusChip`: `.replace('text-emerald-800/70', 'text-current')` does nothing. StatusChip headings get `text-green-700/70` instead of `text-current`, which may cause color issues in different status contexts.

**Fix:** Change the search string from `text-emerald-800/70` to `text-green-700/70` to match the current output of `sectionHeadingClasses()`:
- `SelectionSummaryCard.tsx:32`: `.replace('text-green-700/70', 'text-green-700/80')`
- `StatusChip.tsx:37`: `.replace('text-green-700/70', 'text-current')`
- Also check `DataAlert.tsx:66` and `FreshnessChip.tsx:52` which have the same pattern.

**AC violation:** AC-6 (SelectionSummaryCard), and also affects StatusChip/DataAlert/FreshnessChip visual correctness.

### MUST_FIX #2: `scrollRegionFocusClasses()` regressed to `ring-emerald-500`

**File:** `src/components/uiStyles.ts:29`

**Problem:** The diff shows `scrollRegionFocusClasses()` was changed from `focus-visible:ring-green-500` to `focus-visible:ring-emerald-500`. This is a regression — the focus ring went from the new design system token (`green-500`) back to the old palette (`emerald-500`).

**Impact:** This reverses the green/sand design system migration for keyboard focus states. Every component using `scrollRegionFocusClasses()` will render an emerald focus ring instead of the spec-defined green-500.

**Fix:** Change `'focus-visible:ring-emerald-500'` back to `'focus-visible:ring-green-500'` in `src/components/uiStyles.ts:29`.

**AC violation:** AC-1 (design system color tokens).

---

## SUGGESTION Findings

### SUGGESTION #1: PickProgress uses `isComplete ? 'bg-green-600' : 'bg-green-600'` — redundant ternary

**File:** `src/components/PickProgress.tsx:48`

The ternary `isComplete ? 'bg-green-600' : 'bg-green-600'` always evaluates to `bg-green-600`. While functionally correct, this is dead code. Consider simplifying to just `'bg-green-600'` for readability. Not blocking — the visual output is correct per spec.

### SUGGESTION #2: Missing SelectionSummaryCard token regression tests

The plan (Task 4, Step 2) called for adding a `describe('SelectionSummaryCard token migration', ...)` block to `PicksFlowPresentation.test.tsx` testing for green tokens and absence of sky/slate. The current file only has the original functional test (`renders a compact review...`) with no token regression assertions. This means the `.replace()` bug (MUST_FIX #1) is not caught by automated tests.

**Recommendation:** Add the token regression tests as specified in the plan. This would have caught the `.replace()` bug.

### SUGGESTION #3: `pageShellClasses()` still uses `text-slate-900`

**File:** `src/components/uiStyles.ts:6`

`pageShellClasses()` contains `text-slate-900` which is a legacy token. This is likely out of scope for this story (it's a page-level shell, not a picks page component), but tracking for future cleanup.

---

## Token Audit Summary

| Target File | emerald | slate | sky | blue | stone | green | amber |
|------------|---------|-------|-----|------|-------|-------|-------|
| `page.tsx` | 0 | 0 | 0 | 0 | ✓ | ✓ | 0 |
| `PicksForm.tsx` | 0 | 0 | 0 | 0 | ✓ | ✓ | 0 |
| `golfer-picker.tsx` | 0 | 0 | 0 | 0 | ✓ | ✓ | 0 |
| `SubmissionConfirmation.tsx` | 0 | 0 | 0 | 0 | ✓ | ✓ | ✓ |
| `SelectionSummaryCard.tsx` | 1⚠️ | 0 | 0 | 0 | ✓ | ✓ | 0 |
| `PickProgress.tsx` | 0 | 0 | 0 | 0 | ✓ | ✓ | 0 |
| `uiStyles.ts` | 1⚠️ | 0 | 0 | 0 | 0 | ✓ | 0 |
| `StatusChip.tsx` | 1⚠️ | 0 | 0 | 0 | ✓ | ✓ | 0 |

⚠️ = `emerald` references are in `.replace()` search strings that are now stale (see MUST_FIX #1 and #2)

---

## Verdict

**FAIL** — 2 MUST_FIX items require rework before this PR can be approved.

1. Broken `.replace()` pattern in SelectionSummaryCard and StatusChip (plus DataAlert, FreshnessChip)
2. `scrollRegionFocusClasses` regression to `emerald-500`