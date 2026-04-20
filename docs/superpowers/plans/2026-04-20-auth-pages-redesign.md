# Auth Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply green/sand design tokens to sign-in and sign-up pages, replacing generic blue styling with themed components.

**Architecture:** Both auth pages consume the same design primitives (`Card`, `Button`, `sectionHeadingClasses`). Sign-in page passes a `redirect` search param to the server action. Forms remain client-side with server action submission.

**Tech Stack:** Next.js app router, React client components, Supabase auth server actions.

---

## Phase 0: Setup

- [ ] **Step 1: Verify baseline — all tests pass before changes**

Run: `npm test -- --testPathPattern="sign-(in|up)" --passWithNoTests`
Expected: PASS (no existing tests for auth pages)

Run: `npm run build`
Expected: SUCCESS

---

## Task 1: Sign-In Page Redesign

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Test: `src/app/(auth)/sign-in/__tests__/SignIn.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/sign-in/__tests__` directory and file `SignIn.test.tsx`:

```tsx
import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock useSearchParams
const mockUseSearchParams = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}))

describe('SignIn page', () => {
  it('renders Card container with green left-border accent', async () => {
    const { container } = render(<SignIn />)
    const card = container.querySelector('[class*="border-l-4 border-l-green-700"]')
    expect(card).not.toBeNull()
  })

  it('renders section heading with green/sand styling', async () => {
    render(<SignIn />)
    const heading = screen.getByText(/sign in/i)
    expect(heading.className).toMatch(/uppercase/i)
  })

  it('renders email and password inputs', async () => {
    render(<SignIn />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders primary Button for submit', async () => {
    render(<SignIn />)
    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button.className).toMatch(/bg-green-700/i)
  })

  it('renders footer link to sign-up', async () => {
    render(<SignIn />)
    const link = screen.getByRole('link', { name: /sign up/i })
    expect(link).toHaveAttribute('href', '/sign-up')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="SignIn.test" --no-coverage`
Expected: FAIL (components not yet updated)

- [ ] **Step 3: Update imports in sign-in page**

In `src/app/(auth)/sign-in/page.tsx`, add imports after line 5:

```tsx
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { sectionHeadingClasses } from '@/components/uiStyles'
```

- [ ] **Step 4: Replace page container with Card component**

Before (lines 34-35):
```tsx
<div className="min-h-screen flex items-center justify-center">
  <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
```

After:
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Card accent="left" className="w-full max-w-md p-6 sm:p-8">
    <form className="space-y-4" action={handleSubmit}>
```

Before closing tag (line 69):
```tsx
    </form>
  </div>
</div>
```

After:
```tsx
    </form>
  </Card>
</div>
```

- [ ] **Step 5: Replace heading with sectionHeadingClasses**

Before (line 36):
```tsx
<h1 className="text-2xl font-bold">Sign In</h1>
```

After:
```tsx
<p className={sectionHeadingClasses()}>Sign in</p>
```

- [ ] **Step 6: Replace email input with styled version**

Before (lines 38-46):
```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    className="w-full p-2 border rounded"
    required
  />
</div>
```

After:
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

- [ ] **Step 7: Replace password input with styled version**

Before (lines 48-56):
```tsx
<div>
  <label htmlFor="password" className="block text-sm font-medium">Password</label>
  <input
    id="password"
    name="password"
    type="password"
    className="w-full p-2 border rounded"
    required
  />
</div>
```

After:
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

- [ ] **Step 8: Replace submit button with Button component**

Before (lines 58-64):
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
>
  {loading ? 'Signing in...' : 'Sign In'}
</button>
```

After:
```tsx
<Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
  {loading ? 'Signing in...' : 'Sign In'}
</Button>
```

- [ ] **Step 9: Update footer link styling**

Before (lines 65-67):
```tsx
<p className="text-center text-sm">
  Don&apos;t have an account? <a href="/sign-up" className="text-blue-600">Sign up</a>
</p>
```

After:
```tsx
<p className="text-center text-sm text-stone-600">
  Don&apos;t have an account?{' '}
  <a href="/sign-up" className="font-medium text-green-700 hover:text-green-900 hover:underline">
    Sign up
  </a>
</p>
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="SignIn.test" --no-coverage`
Expected: PASS

- [ ] **Step 11: Verify build succeeds**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 12: Commit**

```bash
git add src/app/\(auth\)/sign-in/page.tsx src/app/\(auth\)/sign-in/__tests__/SignIn.test.tsx
git commit -m "OPS-28: redesign sign-in page with green/sand tokens"
```

---

## Task 2: Sign-Up Page Redesign

**Files:**
- Modify: `src/app/(auth)/sign-up/page.tsx`
- Test: `src/app/(auth)/sign-up/__tests__/SignUp.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/sign-up/__tests__` directory and file `SignUp.test.tsx`:

```tsx
import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'

describe('SignUp page', () => {
  it('renders Card container with green left-border accent', async () => {
    const { container } = render(<SignUp />)
    const card = container.querySelector('[class*="border-l-4 border-l-green-700"]')
    expect(card).not.toBeNull()
  })

  it('renders section heading with green/sand styling', async () => {
    render(<SignUp />)
    const heading = screen.getByText(/create account/i)
    expect(heading.className).toMatch(/uppercase/i)
  })

  it('renders email and password inputs', async () => {
    render(<SignUp />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders primary Button for submit', async () => {
    render(<SignUp />)
    const button = screen.getByRole('button', { name: /create account/i })
    expect(button.className).toMatch(/bg-green-700/i)
  })

  it('renders footer link to sign-in', async () => {
    render(<SignUp />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/sign-in')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="SignUp.test" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Update imports in sign-up page**

In `src/app/(auth)/sign-up/page.tsx`, add imports after line 4:

```tsx
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { sectionHeadingClasses } from '@/components/uiStyles'
```

- [ ] **Step 4: Replace page container with Card component**

Before (lines 22-24):
```tsx
<div className="min-h-screen flex items-center justify-center">
  <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
```

After:
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Card accent="left" className="w-full max-w-md p-6 sm:p-8">
    <form className="space-y-4" action={handleSubmit}>
```

Before closing tag (line 59):
```tsx
    </form>
  </div>
</div>
```

After:
```tsx
    </form>
  </Card>
</div>
```

- [ ] **Step 5: Replace heading with sectionHeadingClasses**

Before (line 25):
```tsx
<h1 className="text-2xl font-bold">Sign Up</h1>
```

After:
```tsx
<p className={sectionHeadingClasses()}>Create account</p>
```

- [ ] **Step 6: Replace email input with styled version**

Before (lines 27-35):
```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    className="w-full p-2 border rounded"
    required
  />
</div>
```

After:
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

- [ ] **Step 7: Replace password input with styled version**

Before (lines 37-45):
```tsx
<div>
  <label htmlFor="password" className="block text-sm font-medium">Password</label>
  <input
    id="password"
    name="password"
    type="password"
    className="w-full p-2 border rounded"
    required
  />
</div>
```

After:
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

- [ ] **Step 8: Replace submit button with Button component**

Before (lines 47-53):
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
>
  {loading ? 'Signing up...' : 'Sign Up'}
</button>
```

After:
```tsx
<Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
  {loading ? 'Creating account...' : 'Create account'}
</Button>
```

- [ ] **Step 9: Update footer link styling**

Before (lines 54-56):
```tsx
<p className="text-center text-sm">
  Already have an account? <a href="/sign-in" className="text-blue-600">Sign in</a>
</p>
```

After:
```tsx
<p className="text-center text-sm text-stone-600">
  Already have an account?{' '}
  <a href="/sign-in" className="font-medium text-green-700 hover:text-green-900 hover:underline">
    Sign in
  </a>
</p>
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="SignUp.test" --no-coverage`
Expected: PASS

- [ ] **Step 11: Verify build succeeds**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 12: Commit**

```bash
git add src/app/\(auth\)/sign-up/page.tsx src/app/\(auth\)/sign-up/__tests__/SignUp.test.tsx
git commit -m "OPS-28: redesign sign-up page with green/sand tokens"
```

---

## Task 3: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --no-coverage`
Expected: All tests PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: SUCCESS

---

## Acceptance Criteria Verification

| AC | Description | Verification |
|---|---|---|
| AC-1 | Auth pages use green/sand design tokens | Verify `Card` container with `accent="left"` (green left-border), `Button variant="primary"` (green-700), `sectionHeadingClasses()` (green heading) |
| AC-2 | Sign-in supports redirect search param | Already verified — server action reads `searchParams.get('redirect')` |
| AC-3 | WCAG 2.1 AA contrast | Verify via visual inspection: all text/background combinations documented in spec §5 pass AA |
