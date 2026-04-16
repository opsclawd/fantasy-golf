# Fantasy Golf — Brownfield Brief

**Date:** 2026-04-16
**Type:** Current-State Baseline Brief
**Author:** Product Planner
**Source:** Code inspection, schema review, implementation artifact review

---

## 1. Current Product Summary

**What the product does (as built):**

Fantasy Golf Pool is a commissioner-first web app for running private golf pools with live hole-by-hole scoring. It serves the office golf pool organizer ("commissioner") who currently lives in spreadsheets and wants a reliable, low-friction alternative.

**Core loop:**
1. Commissioner creates a pool, selects a tournament (Masters, PGA, etc.), configures picks deadline
2. Commissioner shares an invite link with players
3. Players join, submit 4-golfer best-ball entries (mobile-friendly)
4. Picks lock at the configured deadline
5. Scores refresh hourly via Supabase cron → Slash Golf API
6. Live leaderboard shows current standings with explicit freshness indicators

**Tech stack (as deployed):**
- Frontend: Next.js 14 (React 18, TypeScript 5 strict)
- Backend: Next.js API Routes + Supabase
- Database: Supabase (PostgreSQL) — single source of truth
- Auth: Supabase Auth with SSR cookies
- Real-time: Supabase Subscriptions (polling-based leaderboard refresh is the trust anchor, not realtime alone)
- Scoring API: Slash Golf
- Testing: Vitest + React Testing Library
- Styling: Tailwind CSS

**Code source of truth:**

The `src/` directory is authoritative. README and planning docs in `_bmad-output/` and `docs/superpowers/` are historical artifacts — they describe intent and plans, not always current implementation state.

---

## 2. User Roles and Flows (As Implemented)

### Role: Commissioner
**Primary flow:** Create pool → Configure tournament → Share invite link → Monitor entries → Start pool → Watch leaderboard

**Entry points:**
- `/commissioner` — Commissioner dashboard (pool list + create form)
- `/commissioner/pools/[poolId]` — Pool detail with participation table, config editing, lock control, invite link, audit trail

**Key capabilities built:**
- Create pool with tournament selection (from Slash Golf schedule API), format (best-ball only), picks-per-entry (1-10, default 4), deadline
- Pool list showing all pools created by commissioner
- Edit pool config while pool is `open`
- Start pool (`open` → `live`) to begin scoring
- Close pool (`live` → `complete`) after tournament ends
- Archive pool, Reopen pool (for re-running)
- Invite link copy button
- Participation view: who has joined, entry count, entry status
- Lock state visualization (picks locked at deadline)
- Admin tools: audit log viewer, score trace explorer
- Delete pool

**Commissioner admin capabilities (audited):**
- Pool create/config/lock/archive actions are recorded in `audit_events` table

### Role: Player (Participant)
**Primary flow:** Open invite link → Sign in → Submit picks → See confirmation → Check leaderboard

**Entry points:**
- `/join/[inviteCode]` — Invite link landing; validates invite code, creates `pool_members` entry, redirects to picks
- `/participant/pools` — View pools the player has joined
- `/participant/picks/[poolId]` — Pick submission form (golfer picker with autocomplete, picks remaining counter, lock banner, submission confirmation)

**Key capabilities built:**
- Join pool from invite link (creates `pool_members` record)
- Submit 4-golfer best-ball entry (autocomplete golfer search)
- See picks remaining counter while building entry
- Edit picks before lock deadline
- Submission confirmation with clear visual state
- View locked vs. editable state of entry
- View current picks summary

### Role: Spectator (Public)
**Primary flow:** Open leaderboard URL → See standings without signing in

**Entry point:**
- `/spectator` — Public leaderboard (no auth required; pools listed for anyone)

---

## 3. Current Feature Inventory

### Fully Implemented (verified by code and verification reports)

| Feature | Location | Status |
|---|---|---|
| Pool creation with validation | `src/app/(app)/commissioner/actions.ts`, `CreatePoolForm.tsx` | ✅ Built |
| Tournament selection from Slash Golf API | `src/app/api/tournaments/route.ts` | ✅ Built |
| Pool format config (best-ball, picks 1-10) | `src/app/(app)/commissioner/pools/[poolId]/PoolConfigForm.tsx` | ✅ Built |
| Invite link generation + copy button | `src/app/(app)/commissioner/pools/[poolId]/InviteLinkSection.tsx` | ✅ Built |
| Pool ownership enforcement (commissioner_id) | `src/lib/pool-queries.ts`, server actions | ✅ Built |
| Pool_members tracking | `schema.sql`, `pool-queries.ts` | ✅ Built |
| Entry submission with golfer picker | `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx` | ✅ Built |
| Picks remaining counter | `src/components/PickProgress.tsx` | ✅ Built |
| Picks lock at deadline | `src/lib/pool.ts` (status transitions), server actions | ✅ Built |
| Edit picks before lock | `src/app/(app)/participant/picks/[poolId]/actions.ts` | ✅ Built |
| Submission confirmation | `src/components/SubmissionConfirmation.tsx` | ✅ Built |
| Pool list on commissioner dashboard | `src/app/(app)/commissioner/page.tsx` | ✅ Built |
| Participation view | `src/app/(app)/commissioner/pools/[poolId]/page.tsx` | ✅ Built |
| Pool status management (open→live→complete) | `src/app/(app)/commissioner/pools/[poolId]/actions.ts` | ✅ Built |
| Audit logging | `src/lib/audit.ts`, `audit_events` table | ✅ Built |
| Score trace / admin diagnostic view | `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx` | ✅ Built |
| Scoring refresh cron dispatcher | `src/app/api/cron/scoring/route.ts` | ✅ Built |
| Slash Golf API client | `src/lib/slash-golf/client.ts` | ✅ Built |
| Best-ball scoring engine | `src/lib/scoring.ts` | ✅ Built |
| Tie-breaking (birdies) | `src/lib/scoring.ts` | ✅ Built |
| Golfer withdrawal handling | `src/lib/scoring.ts` | ✅ Built |
| Leaderboard display | `src/components/leaderboard.tsx` | ✅ Built |
| Freshness chip / trust status | `src/components/FreshnessChip.tsx`, `TrustStatusBar.tsx` | ✅ Built |
| Lock banner | `src/components/LockBanner.tsx` | ✅ Built |
| Golfer detail sheet | `src/components/GolferDetailSheet.tsx` | ✅ Built |
| Golfer contribution view | `src/components/GolferContribution.tsx` | ✅ Built |
| Golfer catalog panel (commissioner) | `src/components/GolferCatalogPanel.tsx` | ✅ Built |
| Pool archive/reopen | `src/app/(app)/commissioner/pools/[poolId]/ArchivePoolButton.tsx`, `ReopenPoolButton.tsx` | ✅ Built |
| Spectator public leaderboard | `src/app/spectator/page.tsx` | ✅ Built |
| Auth flows (sign-in, sign-up) | `src/app/(auth)/sign-in/`, `sign-up/` | ✅ Built |
| Supabase RLS hardening | Implementation plan exists | ✅ Built |
| On-demand scoring refresh | `src/app/api/scoring/refresh/route.ts` | ✅ Built |
| Hole-by-hole best-ball indicator | Design spec exists | ⚠️ Design only |
| Golfer catalog sync | `src/lib/tournament-roster/` + tests | ✅ Built |

### Known Gaps (identified in implementation plans, not yet verified in code)

| Gap | Source |
|---|---|
| Pool reuse for future tournaments (Story 1.6) | Epic 1 plan mentions but not confirmed built |
| Golfer round-by-round detail view | Design spec exists; implementation plan exists |
| Pool deadline locking respects pool timezone | Solution doc exists |
| Tournament scores overwriting per-round data | Solution doc exists |
| On-demand scoring refresh remediation | Plan and solution doc exist |

---

## 4. Known Out-of-Date Docs

### README.md
- **Status:** Partially outdated
- Claims: Schema has `pools(id, name, tournament_id, ...)` with no `commissioner_id`, `invite_code`, `format`, `picks_per_entry`, or `year` columns — **THESE COLUMNS NOW EXIST in schema.sql**
- Claims: "Entries table (golfer picks per entry)" — correct
- Cron section says: "Supabase runs an hourly UTC dispatcher. The dispatcher checks each pool's timezone and triggers scoring when the tournament is at local midnight Thursday–Sunday" — **this behavior is in the implementation but the README doesn't reflect the full pool management UI**
- Project structure section is accurate

### _bmad-output/planning-artifacts/ux-design-specification.md
- **Status:** Historical — describes intended UX, not the actual built UI
- Referenced as input for Epic 6 (UI overhaul), but the built UI components have evolved from the spec

### _bmad-output/planning-artifacts/architecture.md
- **Status:** Likely outdated in specific implementation details
- Was written early as part of BMAD discovery; implementation diverged in some details (e.g., Supabase helper file structure)

### docs/superpowers/plans/2026-03-28-epic-1-launch-and-manage-private-pool.md
- **Status:** Historical plan document — describes intended implementation steps
- Some implementation details differ from actual code (e.g., `PoolConfigForm` is a single combined form rather than separate config components per the plan's implied structure)
- The plan describes schema changes that were implemented but README was not updated to match

### docs/superpowers/specs/2026-04-11-hole-by-hole-best-ball-design.md
- **Status:** Design only — hole-by-hole best-ball feature not confirmed implemented

### docs/superpowers/specs/2026-04-11-golfer-detail-round-by-round-design.md
- **Status:** Design only — round-by-round detail not confirmed implemented

### docs/solutions/ directory
- **Status:** Historical problem/solution tracking — records issues found during development
- These document what was broken and how it was fixed; they are accurate snapshots but should not be treated as current state

---

## 5. Top 10 Backlog Candidates

Based on review of the epic/story backlog, verification reports, and outstanding design specs:

1. **Hole-by-hole best-ball score display** — Design spec exists; user value is seeing contribution per hole, not just total
2. **Round-by-round golfer detail** — Design spec exists; gives players better insight into golfer performance trajectory
3. **Pool reuse for future tournaments (Story 1.6)** — Epic 1 story listed but implementation not confirmed; high commissioner value
4. **Tournament scores per-round overwrite bug fix** — Solution doc exists; critical scoring correctness issue
5. **Pool deadline locking timezone fix** — Solution doc exists; edge case that breaks trust
6. **On-demand scoring refresh remediation** — Plan exists; gives commissioners manual control over scoring
7. **Better pick summaries (Phase 2 Growth)** — Post-MVP; would improve player experience
8. **Migration/import tools (Phase 2 Growth)** — Post-MVP; reduces commissioner setup friction
9. **PWA offline support (Phase 2 Growth)** — Post-MVP; noted in PRD
10. **Social/gamification features (Phase 2 Growth)** — Post-MVP; low priority for MVP trust-first approach

---

## 6. Code Truth vs. Historical Plan — Explicit Separation

### Code is Truth

The following are the authoritative, up-to-date sources:

| Artifact | Location | Authority |
|---|---|---|
| Database schema | `src/lib/db/schema.sql` | ✅ Current DB shape |
| Domain logic | `src/lib/scoring.ts`, `src/lib/pool.ts`, `src/lib/pool-queries.ts`, `src/lib/picks.ts`, `src/lib/audit.ts` | ✅ What the code actually does |
| API routes | `src/app/api/` | ✅ Live endpoints |
| Server actions | `src/app/(app)/commissioner/actions.ts`, `src/app/(app)/commissioner/pools/[poolId]/actions.ts`, `src/app/(app)/participant/picks/[poolId]/actions.ts` | ✅ Actual mutation logic |
| UI components | `src/components/` | ✅ What's rendered |
| App routes | `src/app/(app)/`, `src/app/(auth)/`, `src/app/join/`, `src/app/spectator/` | ✅ Actual pages |
| Test suites | `src/lib/__tests__/`, `src/components/__tests__/` | ✅ Verified behavior |
| Implementation readiness report | `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-28.md` | ✅ Endorsed baseline assessment |

### Historical Plan (Do Not Trust as Current)

| Artifact | Why It's Historical |
|---|---|
| `README.md` | Schema columns described do not match actual `schema.sql` |
| `_bmad-output/planning-artifacts/prd.md` | PRD was the starting point; implementation has deviated in some details |
| `_bmad-output/planning-artifacts/epics.md` | Story breakdown is the decomposition target; some stories may not match actual implementation state |
| `docs/superpowers/plans/*.md` | These are implementation plans — they guided work but actual code may differ |
| `docs/superpowers/specs/2026-04-11-hole-by-hole-best-ball-design.md` | Design only; feature not confirmed implemented |
| `docs/superpowers/specs/2026-04-11-golfer-detail-round-by-round-design.md` | Design only; feature not confirmed implemented |
| `_bmad-output/planning-artifacts/ux-design-specification.md` | Described intended UX; Epic 6 UI overhaul was built but may have diverged from spec |
| `docs/solutions/` | Historical snapshots of problems and fixes; useful context but not current state |

### Verification Status

| Epic | Verification Report | Result |
|---|---|---|
| Epic 1 (Launch and manage private pool) | 2026-03-28 implementation plan | Plan written; implementation confirmed via schema, actions, and UI components |
| Epic 5 (Trust the system) | 2026-03-29 verification | ✅ PASS: 14 test files, 115 tests |
| Epic 6 (Cohesive UI) | 2026-03-30 verification | ✅ PASS: 7 test files, 26 tests |
| Epics 2, 3, 4 | Not individually verified in reports | Implementation confirmed via code review |

---

*Brief produced by Product Planner. Next step: OPS-5 (Brownfield onboarding goal) will use this brief as the current-state baseline for feature work planning.*
