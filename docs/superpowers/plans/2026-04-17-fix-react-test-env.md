# Fix React Test Environment Failures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 14 failing tests by correcting the React test environment configuration in vitest.config.ts.

**Architecture:** Two targeted config changes in vitest.config.ts: (1) set `NODE_ENV=test` so React loads its development build with `act()` support, and (2) exclude `.worktrees/**` from test discovery to prevent running duplicate tests from feature branches. No production code changes.

**Tech Stack:** Vitest 4.x, React 18, @testing-library/react 16.x, jsdom 26.x

---

### Task 1: Add NODE_ENV and exclude config to vitest.config.ts

**Files:**
- Modify: `vitest.config.ts:11-24`

- [ ] **Step 1: Write a failing test that proves NODE_ENV=test is not set**

Create a quick verification by running the existing failing test:

Run: `./node_modules/.bin/vitest run src/components/__tests__/LeaderboardEmptyState.test.tsx 2>&1 | tail -5`
Expected: FAIL with "act(...) is not supported in production builds of React"

- [ ] **Step 2: Modify vitest.config.ts**

Replace the `test` block in `vitest.config.ts` (lines 11-19) with:

```typescript
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
```

The full file after edit:

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

- [ ] **Step 3: Run previously failing test to verify fix**

Run: `./node_modules/.bin/vitest run src/components/__tests__/LeaderboardEmptyState.test.tsx 2>&1 | tail -5`
Expected: All 4 tests PASS (green)

- [ ] **Step 4: Run full test suite**

Run: `./node_modules/.bin/vitest run 2>&1 | tail -10`
Expected: All tests pass, no `.worktrees/` paths in output, exit code 0

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "fix: set NODE_ENV=test and exclude worktrees in vitest config

Fixes act() not supported in production builds of React by forcing
NODE_ENV=test in the Vitest environment. Excludes .worktrees/ from
test discovery to prevent duplicate test execution from feature
branches.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 2: Verify acceptance criteria

**Files:** None (verification only)

- [ ] **Step 1: Verify all existing tests pass on clean checkout**

Run: `./node_modules/.bin/vitest run 2>&1 | tail -5`
Expected: Exit code 0, all tests pass

- [ ] **Step 2: Verify no production code was changed**

Run: `git diff HEAD~1 --stat -- ':!vitest.config.ts' ':!docs/'`
Expected: Empty output (no production file changes)

- [ ] **Step 3: Verify .worktrees/ tests are excluded**

Run: `./node_modules/.bin/vitest run 2>&1 | grep -c '.worktrees/' || echo "0 worktree references found (correct)"`
Expected: 0 matches (no worktree paths in vitest output)