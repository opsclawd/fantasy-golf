# Design Spec: Fix React Test Environment Failures

**Story:** OPS-30
**Date:** 2026-04-17
**Priority:** Critical
**Complexity:** S

## Problem

14 test failures across 5 test files, all with the same error:

```
Error: act(...) is not supported in production builds of React.
```

Additionally, 4 test files in `.worktrees/` fail with a `server-only` import error, and ~28 extra test files from worktree branches are being discovered and run, inflating the test suite and causing duplicate failures.

## Root Cause Analysis

### Cause 1: NODE_ENV=production in runtime environment

React's `index.js` conditionally loads:
- `react.development.js` when `NODE_ENV !== 'production'` (includes `act()`)
- `react.production.min.js` when `NODE_ENV === 'production'` (no `act()`)

The Paperclip runtime sets `NODE_ENV=production` globally. When `@testing-library/react` calls `act()`, it hits the production build, which throws.

The 5 failing test files already have `// @vitest-environment jsdom` pragmas, confirming the test authors intended to run in a DOM environment. The issue is not the Vitest environment setting — it's that React resolves its production build based on `NODE_ENV` before the jsdom environment can influence module resolution.

### Cause 2: Vitest discovers `.worktrees/` test files

Git worktrees from feature branches (OPS-16, OPS-17) exist under `.worktrees/`. Vitest's default file discovery picks these up, resulting in:
- Duplicate test execution (same tests from branches)
- Additional failures from pnpm-installed production React builds in worktree `node_modules`
- `server-only` import errors from worktree test files that import server components

## Approach Options

| Approach | Description | Trade-offs |
|---|---|---|
| A | Set `env: { NODE_ENV: 'test' }` in vitest.config.ts | Fixes React resolution. Doesn't fix worktree pollution. |
| B | Set env + exclude `.worktrees/**` | Fixes both root causes. Two config changes. No production code changes. |
| C | Change default environment to `jsdom` | Overkill — most lib tests don't need jsdom. Slows all tests unnecessarily. |

**Selected: Approach B** — minimal, targeted, fixes both problems without over-engineering.

## Design

### Change 1: vitest.config.ts — Add `env` and `exclude`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/cypress/**',
      '**/.{idea,git,output,temp}/**',
    ],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Key changes:
- `env: { NODE_ENV: 'test' }` — Forces React to resolve its development build in all test contexts, making `act()` available to `@testing-library/react`.
- `exclude: [..., '**/.worktrees/**']` — Prevents Vitest from discovering and running tests inside git worktree directories.

### Change 2: No production code changes

The fix is entirely in test infrastructure config. No component, hook, or server code is modified.

## Verification

1. `npm test` exits 0
2. No `act(...)` errors in any test output
3. `.worktrees/` test files are not discovered (no worktree paths in vitest output)
4. Git diff shows changes only in `vitest.config.ts`

## Edge Cases

- **Lib unit tests still work with NODE_ENV=test**: The `src/lib/__tests__/` tests don't use React, so `NODE_ENV=test` doesn't affect them. They already pass.
- **CI environment**: If CI sets `NODE_ENV=production`, the vitest `env` config will override it for the test process. This is correct — tests should never run against production React builds.
- **Worktree development**: Excluding `.worktrees/` from test discovery doesn't prevent developers from running tests _inside_ a worktree. It only prevents the main checkout from discovering worktree tests.

## Impact

- 5 previously failing test files now pass (14 tests restored)
- 4 worktree-only `server-only` errors eliminated
- ~28 duplicate worktree test files excluded from discovery
- Total test suite drops from ~88 files (with worktree pollution) to ~38 files (main only)
- No production code behavior changes