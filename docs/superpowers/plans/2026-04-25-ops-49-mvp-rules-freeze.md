# OPS-49: Freeze MVP Rules and Edge Cases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the MVP rules freeze by updating CLAUDE.md with a checklist-style Critical Rules section that links to `docs/rules-spec.md`, and post the 3 open questions to the issue for Product Planner resolution.

**Architecture:** Documentation-only change. The rules spec at `docs/rules-spec.md` is the authoritative source; CLAUDE.md becomes a quick-reference checklist that links to it.

**Tech Stack:** Markdown, git

---

## Task 1: Update CLAUDE.md Critical Rules Section

**Files:**
- Modify: `CLAUDE.md:67-74`

- [ ] **Step 1: Read current Critical Rules section**

Confirm the current content at CLAUDE.md lines 67-74 matches:
```
## Critical Rules

- **Do not** couple scoring logic to Next.js handlers, React components, or Supabase SDK calls
- **Do not** make client UI the source of truth for auth, deadlines, or scoring state
- **Leaderboard freshness model**: the server owns staleness via a configurable threshold (currently 15m). The API triggers an upstream refresh on fetch when data is older than the threshold. The client re-fetches on: mount, realtime `scores` broadcasts, realtime channel reconnect (`SUBSCRIBED` after drop), and tab visibility change to `visible`. No fixed-interval polling. Always surface freshness/refreshing state in the UI so users can see when data is in-flight or stale.
- Keep business rules in `src/lib/scoring.ts` and pure utilities; not in page components
- Use server-side validation for all pool, pick, and scoring mutations
- Preserve visible freshness and lock-state messaging in UI
```

- [ ] **Step 2: Replace Critical Rules section with enhanced version**

Replace the existing section (lines 67-74) with this enhanced version:

```markdown
## Critical Rules

These are the non-negotiable rules for the MVP. The full authoritative specification is at [`docs/rules-spec.md`](./docs/rules-spec.md).

### Game Rules

- [ ] **Entry size**: Exactly `picks_per_entry` golfers (default: 4). No duplicates within an entry.
- [ ] **Best-ball scoring**: Lowest `scoreToPar` among active golfers per round, summed across completed rounds.
- [ ] **Tiebreaker**: Total score (lower is better) → total birdies (higher is better) → shared rank.
- [ ] **Active golfers only**: `cut` and `withdrawn` golfers are excluded from best-ball calculation after they occur.
- [ ] **Round completion gating**: A round only counts if ALL golfers in the entry have `isComplete: true`.
- [ ] **Playoff holes**: Do NOT count toward MVP scoring.

### Locking Rules

- [ ] **Pick locks at pool deadline**: Lock instant = midnight (00:00) in the pool's configured timezone on the deadline date.
- [ ] **Pool status lock**: Non-`open` pools are always locked regardless of deadline.
- [ ] **All users subject to lock**: Commissioner picks lock the same as player picks.

### Data Architecture

- [ ] **Scoring logic is pure**: Keep in `src/lib/scoring.ts` and `src/lib/scoring/domain.ts`. No coupling to handlers, components, or Supabase SDK.
- [ ] **Server owns freshness**: Staleness threshold = 15 minutes. Client re-fetches on: mount, realtime broadcast, reconnect, visibility change.
- [ ] **Server-side validation**: All pool, pick, and scoring mutations must be validated server-side.
- [ ] **Archive before write**: Round data archived to `tournament_score_rounds` before writing current score.
- [ ] **Archive records exclude `round_status`**: Board-authorized rule to prevent circular dependencies.

### Spectator Visibility

- [ ] **Always surface freshness state**: Show users when data is in-flight or stale.
- [ ] **Always surface lock state**: Show users when picks are locked.

For detailed specifications, edge cases, and open questions, see [`docs/rules-spec.md`](./docs/rules-spec.md).
```

- [ ] **Step 3: Verify markdown renders correctly**

Open `CLAUDE.md` and visually confirm:
- The checklist format renders with checkboxes
- The link to `docs/rules-spec.md` is correct
- No markdown syntax errors

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "OPS-49: Enhance CLAUDE.md Critical Rules with checklist and link to rules spec

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Post Open Questions to Issue for Product Planner Resolution

**Files:**
- None (API comment only)

- [ ] **Step 1: Verify the 3 open questions from rules-spec.md Section 11**

These are the 3 open questions that need Product Planner input:

1. **DQ status handling**: How should `dq` status be handled? Should it be treated like `withdrawn` or flagged differently?
2. **All-cut entry display**: If all 4 golfers in an entry are cut/WD before any round completes, should the entry show `null` score or be excluded from leaderboard?
3. **Archive `round_status` exclusion**: Is the rule "archive records must NOT include `round_status`" intentional and permanent, or a temporary workaround?

- [ ] **Step 2: Post comment to OPS-49 issue**

```bash
curl -s -X POST -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  "$PAPERCLIP_API_URL/api/issues/OPS-49/comments" \
  -d '{
    "body": "## 3 Open Questions Requiring Product Planner Resolution\n\nThese questions are documented in [`docs/rules-spec.md#open-questions`](./issues/OPS-49#document-rules-spec) Section 11. Please advise on each:\n\n### 1. DQ Status Handling\n**Question**: How should `dq` (disqualified) status be handled? Should it be treated the same as `withdrawn` (excluded from best-ball after occurrence) or flagged differently?\n\n**Impact**: Low (unlikely in MVP sample data)\n\n### 2. All-Cut Entry Display\n**Question**: If all 4 golfers in an entry are cut/WD before any round completes, should the entry show a `null` score (displayed as \"—\") or be excluded from the leaderboard entirely?\n\n**Impact**: Medium (affects UI display logic)\n\n### 3. Archive round_status Exclusion\n**Question**: The rule \"archive records (`tournament_score_rounds`) must NOT include `round_status`\" was a Board-authorized decision. Is this intentional and permanent, or a temporary workaround that should be revisited?\n\n**Impact**: High (affects data model design)\n\n---\n\nPlease resolve these so the implementation can proceed cleanly."
  }'
```

Expected: `201 Created` response with comment object.

- [ ] **Step 3: Verify comment was posted**

```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  "$PAPERCLIP_API_URL/api/issues/OPS-49/comments" | grep -c "Open Questions"
```

Expected: `1` (or more if other comments exist)

---

## Verification

After completing all tasks:

1. **CLAUDE.md**: Open the file and verify the Critical Rules section has:
   - Checklist format with `[ ]` checkboxes
   - All 6 game rules listed
   - All 6 locking/data architecture rules listed
   - Both spectator visibility rules listed
   - Link to `docs/rules-spec.md` at the bottom

2. **Issue comment**: Verify the open questions comment was posted by checking the issue comments API.

3. **Git log**: Verify the commit exists:
   ```bash
   git log --oneline -1
   ```
   Expected: `OPS-49: Enhance CLAUDE.md Critical Rules...`

---

## Dependencies

- Task 2 (posting open questions) can proceed independently but is logically after Task 1 since it references the rules spec document.
- The 3 open questions block the rules spec from being truly "frozen" — Product Planner input is required before the spec can be considered complete.

## Post-Completion

Once both tasks are complete and the open questions are resolved by Product Planner:
- Update `docs/rules-spec.md` Section 11 with the resolutions
- The issue can then be marked as done
