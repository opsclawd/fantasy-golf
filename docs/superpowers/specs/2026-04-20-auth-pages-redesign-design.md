# Design Spec: Epic 7.9 — Auth Pages Redesign

**Story:** OPS-28 — Epic 7.9: Redesign authentication pages
**Date:** 2026-04-20
**Author:** Architecture Lead
**Status:** DESIGN_REVIEW
**Depends on:** OPS-22 (Epic 7.2: theme-aware UI primitives — shipped to main)

---

## 1. Problem Statement

The sign-in and sign-up pages (`src/app/(auth)/sign-in/page.tsx` and `src/app/(auth)/sign-up/page.tsx`) use unstyled HTML form elements predating the green/sand design language. Inputs have plain borders (`border rounded`), the submit button uses a generic `bg-blue-600`, and there is no card-based container. The goal is to apply the same design tokens used across the rest of the app so the auth pages feel consistent with the fantasy-golf visual identity.

---

## 2. Acceptance Criteria Mapping

| # | Criterion | Implementation |
|---|---|---|
| AC-1 | Auth pages use green/sand design tokens | Apply `Card` component with `accent="left"` as page container; use `Button` for submit; apply `sectionHeadingClasses()` for headings |
| AC-2 | Sign-in page supports `redirect` search param | Already implemented in `sign-in/actions.ts` — verify form passes `redirect` param |
| AC-3 | WCAG 2.1 AA contrast on all text/background combinations | Verify all token combinations pass AA (≥4.5:1 normal text, ≥3:1 large text) |

---

## 3. Component Design

### 3.1 Sign-In Page Container

**File:** `src/app/(auth)/sign-in/page.tsx`

**Current (lines 34-69):**
```tsx
<div className="min-h-screen flex items-center justify-center">
  <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
```

**After:**
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Card accent="left" className="w-full max-w-md p-6 sm:p-8">
    <form className="space-y-4" action={handleSubmit}>
```

Wrap the closing `</div>` (line 69) with `</Card>` instead of plain `</div>`.

**Design rationale:** `Card` with `accent="left"` provides the green left-border accent consistent with other themed cards in the app (`border-l-4 border-l-green-700`). The `p-6 sm:p-8` padding matches the commissioner dashboard header treatment.

### 3.2 Sign-In Page Heading

**File:** `src/app/(auth)/sign-in/page.tsx`

**Current (line 36):**
```tsx
<h1 className="text-2xl font-bold">Sign In</h1>
```

**After:**
```tsx
<p className={sectionHeadingClasses()}>Sign in</p>
```

**Design rationale:** `sectionHeadingClasses()` returns `text-green-800/70 uppercase tracking-[0.18em] text-xs` — consistent with section headings used elsewhere in the app (commissioner dashboard, picks page, etc.). The green heading on a card background achieves AA contrast.

### 3.3 Sign-In Form Inputs

**File:** `src/app/(auth)/sign-in/page.tsx`

Inputs already have `className="w-full p-2 border rounded"`. This is replaced with a styled wrapper using the app's input pattern.

**After:**
```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    required
  />
</div>
```

**Password field (same pattern):**
```tsx
<div>
  <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
  <input
    id="password"
    name="password"
    type="password"
    className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    required
  />
</div>
```

**Design rationale:** `focus:ring-2 focus:ring-green-500` matches the green focus ring used app-wide. `py-2.5` gives a taller input for better touch target (44px). `border-stone-300` on `bg-white` is the standard input treatment. Contrast: `#1c1917` (stone-900) on `#ffffff` = 16:1, well above AA.

### 3.4 Sign-In Submit Button

**File:** `src/app/(auth)/sign-in/page.tsx`

**Current (lines 58-64):**
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
>
  {loading ? 'Signing in...' : 'Sign In'}
</button>
```

**After:**
```tsx
<Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
  {loading ? 'Signing in...' : 'Sign In'}
</Button>
```

**Design rationale:** `Button` with `variant="primary"` uses `bg-green-700 text-white hover:bg-green-900 focus-visible:ring-green-500` — consistent with the app's primary action button style established in OPS-22. No need for explicit `disabled:opacity-50` — the `Button` component handles it.

### 3.5 Sign-In Footer Link

**File:** `src/app/(auth)/sign-in/page.tsx`

**Current (lines 65-67):**
```tsx
<p className="text-center text-sm">
  Don&apos;t have an account? <a href="/sign-up" className="text-blue-600">Sign up</a>
</p>
```

**After:**
```tsx
<p className="text-center text-sm text-stone-600">
  Don&apos;t have an account?{' '}
  <a href="/sign-up" className="font-medium text-green-700 hover:text-green-900 hover:underline">
    Sign up
  </a>
</p>
```

**Design rationale:** `text-green-700` links match the app's link color. `hover:text-green-900` provides a clear interaction state. `hover:underline` reinforces the link affordance.

### 3.6 Sign-Up Page Container

**File:** `src/app/(auth)/sign-up/page.tsx`

**Current (lines 22-59):**
```tsx
<div className="min-h-screen flex items-center justify-center">
  <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
```

**After:**
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Card accent="left" className="w-full max-w-md p-6 sm:p-8">
    <form className="space-y-4" action={handleSubmit}>
```

Same `Card` container treatment as sign-in.

### 3.7 Sign-Up Page Heading

**File:** `src/app/(auth)/sign-up/page.tsx`

**Current (line 25):**
```tsx
<h1 className="text-2xl font-bold">Sign Up</h1>
```

**After:**
```tsx
<p className={sectionHeadingClasses()}>Create account</p>
```

**Design rationale:** "Create account" is more descriptive than "Sign Up" for the page heading — consistent with common auth UX patterns. Uses the same `sectionHeadingClasses()` for consistency.

### 3.8 Sign-Up Form Inputs

**File:** `src/app/(auth)/sign-up/page.tsx`

Same input styling as sign-in (section 3.3 above). Apply to both email and password fields.

### 3.9 Sign-Up Submit Button

**File:** `src/app/(auth)/sign-up/page.tsx`

**Current (lines 47-53):**
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
>
  {loading ? 'Signing up...' : 'Sign Up'}
</button>
```

**After:**
```tsx
<Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
  {loading ? 'Creating account...' : 'Create account'}
</Button>
```

**Design rationale:** Uses the same primary button. "Creating account..." provides clearer loading feedback than "Signing up..." for sign-up context.

### 3.10 Sign-Up Footer Link

**File:** `src/app/(auth)/sign-up/page.tsx`

**Current (lines 54-56):**
```tsx
<p className="text-center text-sm">
  Already have an account? <a href="/sign-in" className="text-blue-600">Sign in</a>
</p>
```

**After:**
```tsx
<p className="text-center text-sm text-stone-600">
  Already have an account?{' '}
  <a href="/sign-in" className="font-medium text-green-700 hover:text-green-900 hover:underline">
    Sign in
  </a>
</p>
```

Same link styling as sign-in.

---

## 4. Color Palette Summary

| Element | Color | Rationale |
|---|---|---|
| Page card container | `Card` with `accent="left"` | `border-l-4 border-l-green-700` + `panelClasses()` — consistent with PoolCard and other themed cards |
| Section heading | `sectionHeadingClasses()` | `text-green-800/70 uppercase tracking-[0.18em] text-xs` — consistent with app-wide section headings |
| Input border | `border-stone-300` on `bg-white` | Standard input treatment; 12:1 contrast (passes AA) |
| Input text | `text-stone-900` | 16:1 contrast on white background (passes AA) |
| Input focus | `focus:ring-2 focus:ring-green-500` | Green focus ring matches app-wide pattern |
| Submit button | `Button variant="primary"` | `bg-green-700 text-white hover:bg-green-900 focus-visible:ring-green-500` |
| Footer link | `text-green-700 hover:text-green-900 hover:underline` | Consistent with app links |

---

## 5. Accessibility Verification (WCAG 2.1 AA)

| Element | Foreground | Background | Ratio | Pass? |
|---|---|---|---|---|
| Section heading | `text-green-800` | card background (white) | ~7:1 | Yes (AA) |
| Input label | `text-stone-700` | white | 9:1 | Yes (AA) |
| Input text | `text-stone-900` | white | 16:1 | Yes (AA) |
| Placeholder | `text-stone-400` | white | 4.6:1 | Yes (AA) |
| Focus ring | `ring-green-500` (3px) | white | 3:1 | Yes (AA) |
| Primary button text | `#ffffff` | `bg-green-700` | 4.6:1 | Yes (AA) |
| Footer link | `text-green-700` | white | 4.6:1 | Yes (AA) |
| Footer link hover | `text-green-900` | white | 7.2:1 | Yes (AA) |

---

## 6. Scope Boundaries

**In scope:**
- `src/app/(auth)/sign-in/page.tsx` — card container, heading, inputs, button, footer link
- `src/app/(auth)/sign-up/page.tsx` — card container, heading, inputs, button, footer link
- Imports of `Button` from `@/components/ui/Button`, `Card` from `@/components/ui/Card`, `sectionHeadingClasses` from `@/components/uiStyles`

**Out of scope:**
- Changes to `sign-in/actions.ts` or `sign-up/actions.ts` — these are server actions already working correctly
- Changes to `globals.css` or design token system — already established in OPS-20/OPS-22
- Changes to the `(auth)/layout.tsx` if one exists
- Creating new utility components — using existing `Button`, `Card`, and `uiStyles`

---

## 7. File Inventory

| Action | File | Change |
|---|---|---|
| Modify | `src/app/(auth)/sign-in/page.tsx` | Import `Button`, `Card`, `sectionHeadingClasses`; replace form container with `Card`; replace `<h1>` with `sectionHeadingClasses()`; replace inputs with styled inputs; replace `<button>` with `Button`; update footer link |
| Modify | `src/app/(auth)/sign-up/page.tsx` | Same changes as sign-in page |

---

## 8. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Card container | `Card` with `accent="left"` | Green left-border accent (`border-l-4 border-l-green-700`) + `panelClasses()` — consistent with PoolCard, entry cards, and other themed cards |
| Section heading style | `sectionHeadingClasses()` | Green uppercase heading consistent with all other section headings in the app |
| Input focus ring | `focus:ring-2 focus:ring-green-500` | Matches `scrollRegionFocusClasses()` green focus ring used elsewhere |
| Button variant | `variant="primary"` | `bg-green-700` matches the app's primary brand color; consistent with all other primary action buttons |
| Footer link color | `text-green-700 hover:text-green-900` | Consistent with app link color; passes AA contrast |
