# Review Fix Log — issue #51 loop 6

## Finding: `rankEntriesLegacy` still present in scoring.ts (Minor)

**Review finding:** Deprecated function with fake `holeId: 1` round-level aggregation logic remains exported at `src/lib/scoring.ts:88–121`. Only imported in test file.

**Status: NOT FIXED — by design**

Risk is low. The function is correctly guarded with `@deprecated` comment. The review itself acknowledges it is "low risk" and "only test coverage remains." No production code imports it. Removing it would be a scope expansion beyond what the review asks for.

**Decision:** Skip. Non-blocking minor issue.

---

## Finding: `pnpm typecheck` failures in test files (Minor)

**Review finding:** 64 TypeScript errors all in `src/lib/__tests__/design-tokens.test.ts` — pre-existing tailwind config typing issues.

**Status: NOT FIXED — pre-existing / out of scope**

This is unrelated to this PR (design-tokens.test.ts is a test file for design tokens, not part of the leaderboard scoring fix). The review explicitly states this is "not a merge blocker" and recommends addressing as a separate cleanup task.

**Decision:** Skip. Non-blocking minor issue.

---

## Commit

All review findings are either already fixed or explicitly marked as non-blocking minor issues. Build, lint, and all 468 tests pass.