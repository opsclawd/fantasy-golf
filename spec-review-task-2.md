# spec-review-task-2.md

## Review: issue #51 task 2 — leaderboard route test updates

## Verdict: ✅ Spec compliant

## Step-by-step verification

| Requirement | Status | Evidence |
|---|---|---|
| Replace `@/lib/scoring-queries` mock with `getTournamentHolesForGolfers` | ✅ | line 23-25 |
| Add `rankEntriesWithHoles` to `@/lib/scoring` mock | ✅ | line 18-21 |
| Update imports to use new paths | ✅ | lines 6-7 |
| New test for hole-by-hole ranking | ✅ | lines 322-389 |
| New test calls `getTournamentHolesForGolfers` with correct args | ✅ | line 386 |
| New test calls `rankEntriesWithHoles` with `(entries, holesByGolfer, expect.any(Map), 2)` | ✅ | line 387 |
| Four existing tests updated to new mock path | ✅ | lines 112-113, 181-182, 258-259, 309-310 |
| `getTournamentScoreRounds` mock removed from existing tests | ✅ | not present anywhere |
| Tests pass (5/5) | ✅ | vitest output |

## Notes
- No extra work detected.
- All 4 existing tests now use `getTournamentHolesForGolfers.mockResolvedValue(new Map())` and `rankEntriesWithHoles.mockReturnValue(...)` pattern.
- New test verifies correct function call signatures and response shape.