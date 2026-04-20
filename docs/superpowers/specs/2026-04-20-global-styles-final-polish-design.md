# Global Styles and Final Polish — Design Spec

## Context

Epic 7.10 is the final story in the backlog. OPS-22 (Epic 7.2) already shipped the design token system and theme-aware UI primitives. This story is a polish pass to ensure consistency, accessibility, and completeness before launch.

## Current State

**`src/app/globals.css`**
- Tailwind `@layer base` with CSS custom properties for all design tokens
- Accessibility targets (44px min touch targets, focus ring with brand green)
- Reduced motion support
- `color-scheme: light` set

**`src/components/uiStyles.ts`**
- Exported utility functions: `pageShellClasses`, `panelClasses`, `metricCardClasses`, `scrollRegionFocusClasses`, `sectionHeadingClasses`
- All backed by tests in `src/components/__tests__/uiStyles.test.ts`

**`src/components/DataAlert.tsx`**
- Three variants: `error`, `warning`, `info`
- Uses `panelClasses()` and `sectionHeadingClasses()` from uiStyles
- Uses `data-alert-a11y.ts` for ARIA live region logic
- Tested via visual snapshot (not unit tested)

**`src/components/FreshnessChip.tsx`**
- Three freshness statuses: `current`, `stale`, `unknown`
- Uses `sectionHeadingClasses()` from uiStyles
- Tested via visual snapshot (not unit tested)

## Scope of Polish

### 1. Design Token Consistency Audit

**Goal:** Ensure no hardcoded color values exist in the four target files that should be using design tokens.

Checklist for each file:
- [ ] No bare hex values (e.g., `#14532d`)
- [ ] No bare Tailwind arbitrary values that bypass the token system (e.g., `text-[#14532d]`)
- [ ] All status colors use the token system (`action-warning`, `action-error`, etc.)

Known potential issues to verify:
- `DataAlert.tsx` uses `red-*`, `amber-*`, `sky-*` palette colors — verify these map to the design token migration table or are intentionally kept as-is for semantic color meaning
- `FreshnessChip.tsx` uses `green-*`, `amber-*`, `stone-*` palette colors — same check
- `globals.css` uses bare RGB values for `--ring-brand` and `--fg-shell` — this is correct for CSS custom properties

### 2. CSS Variable Consistency

**Goal:** Verify all CSS custom properties in `globals.css` are consumed via the token system, not hardcoded elsewhere.

All four files should reference CSS variables or Tailwind token classes, not raw values.

### 3. Accessibility Verification

**DataAlert.tsx:**
- `error` variant uses `role="alert"` — correct
- `warning` and `info` use `role="status"` with `aria-live="polite"` — correct
- Screen reader text prefixes (`srPrefix`) are set — correct

**FreshnessChip.tsx:**
- `role="status"` and `aria-live="polite"` — correct
- `aria-label` is set — correct

**globals.css:**
- Focus ring uses brand green via `rgb(var(--ring-brand))` — correct
- Focus ring has outline-offset and box-shadow — correct
- Reduced motion support — present and correct

### 4. uiStyles Test Coverage

Current tests cover:
- `pageShellClasses` — gradient shell present
- `panelClasses` — rounded-3xl, border-white/60 present
- `metricCardClasses` — min-h-[8rem] present
- `sectionHeadingClasses` — tracking-[0.18em] present
- `scrollRegionFocusClasses` — ring-inset, ring-green-500 present, no ring-offset

**Gap:** `scrollRegionFocusClasses` test asserts `not.toBe('focus-visible:outline-none')` — this is a string identity check, not a contains check. The test passes but may not be testing the right thing. Verify this is intentional or if it should be removed.

### 5. globals.css Test Coverage

Current tests verify all CSS custom properties are defined and that `--ring-brand` and `--fg-shell` have correct values. This is solid.

## Approach

This is a polish/audit story — no new features. The implementation engineer will:

1. Audit each of the four files for hardcoded colors that should use the token system
2. Verify accessibility attributes are complete and correct
3. Clean up any inconsistencies found
4. Ensure uiStyles tests are meaningful
5. Run full test suite to confirm no regressions

## Files

| File | Role |
|------|------|
| `src/app/globals.css` | Global CSS custom properties, base styles, accessibility |
| `src/components/uiStyles.ts` | Reusable UI class utility functions |
| `src/components/DataAlert.tsx` | Error/warning/info alert component |
| `src/components/FreshnessChip.tsx` | Data freshness indicator chip |

## Success Criteria

1. Zero hardcoded color values in target files that should use design tokens
2. All accessibility attributes present and correct on DataAlert and FreshnessChip
3. All uiStyles tests are meaningful (no vacuous assertions)
4. Full test suite passes (including new/changed tests)
5. No console errors or warnings from the target components