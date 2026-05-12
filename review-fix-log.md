# Review Fix Log — Issue #51 (Loop 1)

## Critical Fixes Applied

### `route.ts:159` — `golferStatuses` Map serialization bug

**Finding:** `golferStatuses` was passed as a `Map` directly to `NextResponse.json()`, which serializes Maps as `{}`. All golfer status data was silently dropped.

**Fix:** Changed `golferStatuses,` to `golferStatuses: Object.fromEntries(golferStatuses),`

**File:** `src/app/api/leaderboard/[poolId]/route.ts`

**Status:** Fixed.

---

## High/Medium/Low Findings

| Finding | Severity | Status |
|---------|----------|--------|
| `golferStatuses` Map serialization | critical | Fixed |
| `getTournamentRosterGolfers` result not validated in new test | medium | Not fixed — out of scope for critical/high |
| `deriveCompletedRounds` mock hardcoded value | low | Not fixed — acceptable test design per reviewer |

## Legitimate Fixes Only

Per task instructions, only critical and high severity findings were addressed.
The medium finding (test assertion gap) is valid but out of scope for this pass.
The low finding was already noted as acceptable by the reviewer.
