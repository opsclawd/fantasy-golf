---
title: Fix CI validation script key resolution and test timer determinism
date: 2026-10-05
last_updated: 2026-10-05
category: docs/solutions/workflow-issues/
module: api
problem_type: workflow_issue
component: lib
severity: high
tags: [ci, validation, package-json, fake-timers, lock-banner, typecheck, strict-mode]
git_refs: []
---

# Fix CI validation script key resolution and test timer determinism

## Context

Automated CI and PR review scripts (`scripts/ai-validate.sh`) reported passing checks despite the repository having 53 TypeScript compilation errors under `strict: true` across test suites and intermittent test failures in `LockBanner.test.tsx`. A trustworthy validation baseline was required for MVP handoff.

## Root cause / wrong premise

1. **Incorrect jq query in `scripts/ai-validate.sh`:** Line 28 queried `jq -r 'keys[]' "$PACKAGE_JSON"`, extracting top-level keys (`name`, `version`, `scripts`, `dependencies`, etc.) instead of script keys (`.scripts // {} | keys[]`). Consequently, commands `typecheck`, `lint`, `test`, and `build` were never matched, and the validation loop silently skipped all four checks with exit code 0.
2. **Missing `typecheck` script in `package.json`:** Vitest tests in `__tests__` are excluded from the `next build` type-checking pass. Without a dedicated `"typecheck": "tsc --noEmit"` script, test file type regressions went undetected.
3. **Host clock and time-of-day dependency in `LockBanner.test.tsx`:** Dynamic deadline calculations (`new Date() + 12h`) interacted with `getTournamentLockInstant` (which truncates deadlines to local midnight in the pool timezone). Depending on host execution time-of-day, the calculated deadline fell in the past, causing intermittent test failures. Furthermore, open token tests with hardcoded dates near system time triggered warning tones instead of open green tokens.

## Guidance

- In shell scripts reading npm/pnpm package scripts from `package.json`, always query `.scripts // {} | keys[]` rather than root keys.
- Always maintain `"typecheck": "tsc --noEmit"` in `package.json` to ensure test files under `__tests__` are validated against `tsconfig.json` (`strict: true`).
- In time-dependent tests (such as deadline or lock tone assertions), freeze the clock deterministically across the test suite using Vitest fake timers (`vi.useFakeTimers()`, `vi.setSystemTime(new Date('...'))`) in `beforeEach` and restore with `vi.useRealTimers()` in `afterEach`.
- For tests asserting the open (non-warning) state of deadline components, use a safe distant deadline (e.g. `2099-01-01T00:00:00+00:00`) to guarantee `isWithin24Hours` evaluates strictly to `false` regardless of simulated time.

## Verification

- `pnpm typecheck` runs `tsc --noEmit` and passes with 0 errors.
- `pnpm lint` runs `next lint` and passes with 0 warnings or errors.
- `pnpm vitest run src/components/__tests__/LockBanner.test.tsx` passes all 7 tests deterministically.
- `bash scripts/ai-validate.sh` matches and executes `typecheck`, `lint`, `test`, and `build`.

## Related

- `docs/solutions/logic-errors/pool-deadline-locking-respects-pool-timezone-2026-04-08.md`
- `AGENTS.md` (Compound Engineering Loop & Validation Rules)
