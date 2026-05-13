# Quality Review: Tasks 6 & 7

**Files changed:**
- `src/app/api/leaderboard/[poolId]/route.ts` (Task 6)
- `src/lib/scoring-refresh.ts` (Task 7)

---

## Strengths

- `scoringDataStatus` logic is correct: `'complete'` when all rostered golfers have hole data, `'incomplete'` otherwise
- The coverage ratio check in `scoring-refresh.ts` (50% threshold) is a reasonable safeguard before marking refresh as successful
- Tracking `scorecardFailures` array provides visibility into per-golfer fetch failures
- Both changes integrate cleanly with existing code patterns

---

## Issues

### Critical

1. **`route.ts:168`** — Indentation regression: `return NextResponse.json({` at column 1 (no leading whitespace). Original had proper indentation. This breaks the file's visual consistency and could confuse future diffs.

### Minor

2. **`scoring-refresh.ts:209`** — Condition `coverageRatio < 0.5 && scorecardFailures.length > 0` means `last_refresh_error` is only set when BOTH thresholds are met. If coverage drops below 50% due to an upstream issue (e.g., Slash Golf API returning empty for many golfers), but `scorecardFailures` is empty (because failures were caught silently), the error is not recorded. Consider logging failures even when coverage is low but `scorecardFailures` is empty (indicates structural data issue).

---

## Assessment: APPROVED

Indentation regression on line 168 was fixed. All lint and build checks pass.