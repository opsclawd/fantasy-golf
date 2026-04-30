# QA Report — OPS-55: Owner-safe UI, Status, and Admin Hardening

**Review Date:** 2026-04-29  
**Issue:** OPS-55  
**PR Branch:** feature/ops-55-owner-safe-ui  
**Status:** QA FAILED — Returned for Rework (Round 2)

---

## Summary

8 original MUST_FIX items were all addressed. However, 2 new test failures were introduced by the implementation.

---

## Stage 1: Spec Compliance Review

### Previously Identified MUST_FIX Items — Status

| # | Feature | Previous Finding | Status |
|---|---------|----------------|--------|
| 1 | StatusChip deadline prop | Missing | ✅ **RESOLVED** — Now accepts `deadline` and `timezone` props |
| 2 | TrustStatusBar pulsing indicator | Missing | ✅ **RESOLVED** — Pulsing amber indicator present at line 218 |
| 3 | TrustStatusBar refresh button | Missing | ✅ **RESOLVED** — "Refresh now" button present at lines 222-232 |
| 4 | ConfirmModal component | Missing | ✅ **RESOLVED** — Component exists with full props |
| 5 | Admin buttons ConfirmModal | Not refactored | ✅ **RESOLVED** — All three buttons use ConfirmModal |
| 6 | refreshPoolScoresAction | Missing | ✅ **RESOLVED** — Action exists in actions.ts |
| 7 | StatusChip.test.tsx | Missing | ✅ **RESOLVED** — Test file exists |
| 8 | ConfirmModal.test.tsx | Missing | ✅ **RESOLVED** — Test file exists |

### All Spec Requirements — Verification

| Feature | Spec Section | Status |
|---------|-------------|--------|
| StatusChip deadline prop | Section 2.1 | ✅ PASS |
| LockBanner warning tone | Section 2.2 | ✅ PASS |
| TrustStatusBar pulsing + refresh | Section 2.3 | ✅ PASS |
| TieExplanationBadge | Section 2.4 | ✅ PASS |
| ConfirmModal | Section 2.5 | ✅ PASS |
| Admin buttons refactor | Section 2.5 | ✅ PASS |
| ErrorStateBanner | Section 2.6 | ✅ PASS |
| refreshPoolScoresAction | Section 2.3 | ✅ PASS |

---

## Stage 2: Code Quality Review

### Test Files

All required test files exist:
- `StatusChip.test.tsx` ✅
- `ConfirmModal.test.tsx` ✅
- `TrustStatusBar.test.tsx` ✅
- `TieExplanationBadge.test.tsx` ✅
- `ErrorStateBanner.test.tsx` ✅
- `LockBanner.test.tsx` ⚠️ (2 failures)
- `AdminButtonsModal.test.tsx` ✅
- `LeaderboardRow.test.tsx` ✅

### Test Suite Results

**Command:** `npm run test -- --run`  
**Result:** 56 test files passed, 2 failed  

**OPS-55 Introduced Failures:**

| Test | Failure Reason |
|------|---------------|
| `LockBanner.test.tsx > warning tone > renders with warning tone when pool is open and deadline is within 24 hours` | Test assumes deadline time matters, but `getTournamentLockInstant` only uses the DATE portion |
| `LockBanner.test.tsx > shows secondary line with timezone when within 24 hours` | Same root cause |

**Pre-existing Failures (NOT blocking OPS-55):**

| Test | Reason |
|------|--------|
| `JoinPoolForm.test.tsx` (3 tests) | `useFormState` issue in JoinPoolForm — pre-existing, unrelated to OPS-55 |

---

## Findings Detail

### [MUST_FIX] LockBanner Tests: Incorrect Test Design

**Problem:** The new tests in `LockBanner.test.tsx` (lines 74-100) create deadlines using:
```javascript
const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
```

However, `getTournamentLockInstant()` in `src/lib/picks.ts:82-107` **ignores the time portion** of the deadline string and computes UTC midnight of the date. The test expects the 12-hour-from-now time to trigger the warning tone, but the implementation only checks if the deadline date is within 24 hours from today, not the computed lock instant.

**Location:** `src/components/__tests__/LockBanner.test.tsx:74-100`

**Impact:** 2 new tests fail, blocking OPS-55 approval.

---

## Decision

**QA FAILED — Round 2**

- **Original 8 MUST_FIX items:** All resolved ✅
- **New MUST_FIX items:** 1 (LockBanner test design flaw)
- **Suggestion count:** 0
- **Return status:** IN_PROGRESS

The LockBanner warning tone tests have a flawed assumption about how `getTournamentLockInstant` works. The tests need to be fixed to use deadlines that are actually within 24 hours when the date-only computation is applied.

---

## What's Working

All 6 core features from the spec are correctly implemented:
1. ✅ StatusChip shows deadline for open pools
2. ✅ LockBanner shows warning tone near deadline
3. ✅ TrustStatusBar shows pulsing amber + refresh button when stale
4. ✅ TieExplanationBadge renders for tied entries
5. ✅ ConfirmModal provides destructive action friction
6. ✅ ErrorStateBanner shows persistent refresh failures
7. ✅ All admin buttons use ConfirmModal
8. ✅ refreshPoolScoresAction works for commissioners