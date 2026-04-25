# OPS-49: Freeze MVP Rules and Edge Cases — Design Spec

## Problem Statement

The Fantasy Golf Pool MVP has accumulated business rules across multiple files with no single authoritative source. Some rules are documented in code comments, some in test names, some only in the implementation. This makes it difficult to:
- Onboard new engineers
- Verify edge case behavior
- Identify gaps or inconsistencies
- Make changes without unintended side effects

The goal of OPS-49 is to **document what is implemented** (canonical behavior) as of this freeze, not to prescribe what should be built.

---

## Rule Domains to Freeze

| Domain | Key Files | Summary |
|--------|-----------|---------|
| **Scoring** | `src/lib/scoring.ts`, `src/lib/scoring/domain.ts` | Best-ball (lowest score per round), birdie tiebreaker, active-only golfers, round completion gating |
| **Pool Lifecycle** | `src/lib/pool.ts` | Status transitions: open→live→complete→archived (no other paths), canReopenPool guards against expired deadlines |
| **Locking/Deadlines** | `src/lib/picks.ts` | Timezone-aware lock instant calculation via iterative offset resolution, isPoolLocked, shouldAutoLock, isCommissionerPoolLocked |
| **Entry/Pick Validation** | `src/lib/picks.ts` | No duplicate golfers, exact picksPerEntry count required, locked pool rejects all mutations |
| **Data Freshness** | `src/app/api/leaderboard/[poolId]/route.ts`, `CLAUDE.md` | 15-minute staleness threshold, server-triggered upstream refresh, client re-fetches on mount/broadcast/reconnect/visibility |
| **Archive/No-Retroactivity** | `src/lib/scoring-queries.ts`, test at `scoring-queries.test.ts:109` | Archive rounds before writing current score; archive records must NOT include round_status (Board-authorized rule) |
| **Audit Trail** | `src/lib/audit.ts` | Score diff tracking (round_id, total_score, position, status, birdies), refresh audit events |
| **API/Cron** | `docs/runbooks/fantasy-golf-ops.md` | CRON_SECRET bearer auth, isUpdating mutex prevents concurrent refreshes, fan-out refreshes all same-tournament pools |

---

## Document Structure

### Option: Hybrid (Recommended)

Create a domain-organized freeze document with a CLAUDE.md summary.

**`docs/superpowers/specs/YYYY-MM-DD-ops-49-mvp-rules-freeze.md`** — Master freeze document organized by domain. Each rule states:
- What it does (one sentence)
- What file/function implements it
- What test or check covers it
- Any known edge cases or ambiguities

**CLAUDE.md "Critical Rules" section update** — Already exists. Will be enhanced to:
1. State the 5-10 non-negotiable rules as a checklist
2. Link to the full freeze doc for implementation details

### Domain Sub-Documents (if scope warrants)

If the master doc grows too large, split into:
- `docs/rules/scoring-rules.md`
- `docs/rules/pool-lifecycle.md`
- `docs/rules/locking-deadline.md`
- `docs/rules/entry-rules.md`
- `docs/rules/data-freshness.md`
- `docs/rules/archive-rules.md`

For now, keep it as a single document with domain sections. Split only if needed.

---

## Approach Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **A: CLAUDE.md only** | Single authoritative location | Mixes concerns; easily bloats |
| **B: New freeze doc only** | Clean slate, comprehensive | Discovery risk; may drift |
| **C: Hybrid (recommended)** | Detail + summary, clear ownership | Two docs to maintain |

**Recommendation: Approach C (Hybrid)**

---

## Clarifying Questions for Product Planner

Before proceeding, I need to clarify scope:

1. **Legacy code treatment**: `rankEntriesLegacy` in `scoring.ts:84` doesn't handle `isTied` correctly (returns untyped rank). Should this be documented as canonical (what's deployed) or flagged as known deviation from the modern `rankEntries`?

2. **Audience depth**: Is the freeze doc intended for:
   - **Commissioners** (what rules exist, high-level)
   - **Future engineers** (implementation details, edge cases)
   - **Both** (layered: summary + deep-dive)?

3. **What constitutes "frozen"**: Should the freeze doc be:
   - **A snapshot** of current behavior (observable from tests/code)
   - **A declaration** with explicit exclusions (flag places that are known wrong)
   - **A living document** that updates as rules change?

---

## Acceptance Criteria

- [ ] Master freeze doc exists at `docs/superpowers/specs/YYYY-MM-DD-ops-49-mvp-rules-freeze.md`
- [ ] All 8 rule domains covered with explicit file/function references
- [ ] Edge cases documented (no "TBD" or "unknown")
- [ ] `isTied` behavior for legacy ranking addressed explicitly
- [ ] CLAUDE.md "Critical Rules" section updated with checklist + link to full doc
- [ ] Self-review passed: no placeholders, no internal contradictions