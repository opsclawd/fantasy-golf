## QA Review — OPS-55 Owner-safe UI, Status, and Admin Hardening

### Stage 1: Spec Compliance Review

**Implemented correctly:**
- LockBanner — warning tone within 24h of deadline
- TieExplanationBadge — new component with correct props
- TieExplanationBadge — integrated in LeaderboardRow
- ErrorStateBanner — component exists with retry functionality
- CommissionerErrorBanner — integrated on commissioner page

**MUST_FIX items:**

| # | Finding | Spec Section | Location |
|---|---------|--------------|----------|
| 1 | **[MUST_FIX]** StatusChip missing `deadline` prop — component only accepts `status: PoolStatus`. Does not render deadline for open pools. | Section 2.1 | `src/components/StatusChip.tsx:28` |
| 2 | **[MUST_FIX]** TrustStatusBar missing pulsing amber indicator — no `animate-pulse` class when `poolStatus === 'live' && freshness === 'stale'` | Section 2.3 | `src/components/TrustStatusBar.tsx` |
| 3 | **[MUST_FIX]** TrustStatusBar missing refresh button — no "Refresh now" button calling `refreshPoolScoresAction` | Section 2.3 | `src/components/TrustStatusBar.tsx` |
| 4 | **[MUST_FIX]** ConfirmModal component MISSING — file does not exist | Section 2.5 | `src/components/ConfirmModal.tsx` |
| 5 | **[MUST_FIX]** Admin buttons still use `window.confirm()` — ArchivePoolButton, DeletePoolButton, ReopenPoolButton do not use ConfirmModal | Section 2.5 | `src/app/(app)/commissioner/pools/[poolId]/` |
| 6 | **[MUST_FIX]** refreshPoolScoresAction MISSING from actions.ts | Section 2.3 | `src/app/(app)/commissioner/pools/[poolId]/actions.ts` |
| 7 | **[MUST_FIX]** StatusChip.test.tsx MISSING — no deadline prop test | Section 4 | `src/components/__tests__/` |
| 8 | **[MUST_FIX]** ConfirmModal.test.tsx MISSING | Section 4 | `src/components/__tests__/` |

### Stage 2: Code Quality Review

- **Pre-existing test failures**: 3 tests in `JoinPoolForm.test.tsx` fail due to `useFormState` issue (pre-existing, unrelated to OPS-55)
- **Test coverage gaps**: See MUST_FIX items 1, 4, 7, 8 above

### Decision

**QA FAILED. 8 must-fix items, 0 suggestions.**

Implementation is incomplete — 5 core features from the spec are missing or incorrect (StatusChip deadline, TrustStatusBar pulsing/refresh, ConfirmModal, admin button refactor, refreshPoolScoresAction), and 3 required test files are missing.

Please address all MUST_FIX items and re-submit for review.