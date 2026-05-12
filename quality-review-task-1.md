# Quality Review: Migrate leaderboard GET to `rankEntriesWithHoles`

## Summary
Implementation of all 6 migration steps verified against `src/app/api/leaderboard/[poolId]/route.ts`.

## Strengths
- All task steps implemented correctly and completely
- Import changes follow the specified pattern
- `golferStatuses` correctly modeled as `Map` with active golfers absent (defaults to `'active'`)
- Empty scores early-return path properly handled with `rankEntriesWithHoles`
- `GolferRoundScoresMap` type removed as specified
- Lint: **PASS** (no warnings or errors)
- Build: **PASS** (TypeScript compiles cleanly)

## Issues

### Critical

**Line 159: `golferStatuses` Map won't serialize correctly in JSON response**

`golferStatuses` is a `Map<string, 'active' | 'cut' | 'withdrawn'>`. When passed to `NextResponse.json()`, `JSON.stringify` on a Map returns `{}` — the data is **completely lost** in the response.

Evidence:
- Line 82 (early-return case) uses `golferStatuses: {}` — the expected shape is a plain object
- Line 162 correctly converts `golferScoresMap` Map to object via `Object.fromEntries()`

**Fix:** Change line 159 from:
```typescript
golferStatuses,
```
to:
```typescript
golferStatuses: Object.fromEntries(golferStatuses),
```

### Important

**Line 135–142: `golferNames` and `golferCountries` are built from all roster golfers, not just entry golfers**

The query `getTournamentRosterGolfers` fetches ALL roster golfers for the tournament, then filters in the loop. The `filter` + `has` check is correct but inefficient — consider whether the query itself could filter by `allGolferIds` to reduce data transfer.

## Assessment

**NEEDS_WORK** — The critical serialization bug must be fixed before this is production-ready.

## Verification Commands
```bash
npm run lint   # PASS
npm run build # PASS
```
