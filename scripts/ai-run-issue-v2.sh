#!/usr/bin/env bash
# =============================================================================
# ai-run-issue-v2.sh — Non-interactive GitHub issue-to-PR orchestrator
#
# Usage: pnpm ai:run-issue <issue-number>
#
# State labels: ai:blocked | ai:failed | ai:needs-human-review | ai:pr-ready
# Idempotent: rerunning resumes or safely fails (no duplicate branches/PRs)
# =============================================================================
set -euo pipefail

ISSUE_NUM="${1:-}"
export ISSUE_NUM

if [[ -z "$ISSUE_NUM" ]]; then
  echo "Usage: pnpm ai:run-issue <issue-number>" >&2
  exit 1
fi

# ── env / defaults ────────────────────────────────────────────────────────────
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

BASE_BRANCH="${BASE_BRANCH:-main}"
ISSUES_DIR="ai/issues/${ISSUE_NUM}"
BRANCH="ai/issue-${ISSUE_NUM}"
PROMPTS_DIR="automation/prompts"
AGENT_MODEL="${AGENT_MODEL:-minimax-coding-plan/MiniMax-M2.7}"
AGENT_CLI="${AGENT_CLI:-opencode}"

# Phase timeouts (seconds)
TIMEOUT_PLAN=600
TIMEOUT_IMPLEMENT=1800
TIMEOUT_VALIDATE=300
TIMEOUT_REVIEW=600
TIMEOUT_FIX=900

# Max fix loops
MAX_FIX_LOOPS=2

# ── helpers (functions) ───────────────────────────────────────────────────────
log()  { echo "[$(date +%H:%M:%S)] $*" | tee -a "${ISSUES_DIR}/orchestrator.log"; }
info() { log "INFO: $*"; }
warn() { log "WARN: $*" >&2; }

orchestrator_fail() {
  reason="$1"
  log "FAIL: $reason"
  if [[ "$reason" == *"blocked"* || "$reason" == *"Blocking"* || "$reason" == *"waiting"* ]]; then
    printf '{"phase":"%s","reason":"%s","time":"%s"}\n' \
      "${LAST_PHASE:-unknown}" "$reason" "$(date -Iseconds)" \
      > "${ISSUES_DIR}/blocked.json"
  fi
  gh issue edit "$ISSUE_NUM" --remove-label "ai:in-progress" 2>/dev/null || true
  gh issue edit "$ISSUE_NUM" --add-label "ai:failed" 2>/dev/null || true
  gh issue comment "$ISSUE_NUM" --body "Automation failed: $reason" 2>/dev/null || true
  exit 1
}

run_agent_raw() {
  # Run agent with prompt from stdin, capture output to log file
  local phase="$1"
  local timeout_sec="$2"
  local output_log="${ISSUES_DIR}/${phase}.log"
  local agent_cmd

  case "$AGENT_CLI" in
    claude|claude-minimax)
      agent_cmd="~/bin/claude-minimax --settings ~/.claude/profiles/minimax.json --print --model $AGENT_MODEL"
      ;;
    opencode)
      agent_cmd="opencode --model $AGENT_MODEL run"
      ;;
    *)
      orchestrator_fail "Unsupported AGENT_CLI: $AGENT_CLI"
      ;;
  esac

  log "Running agent for phase '$phase' (timeout=${timeout_sec}s)..."

  # Read prompt from stdin, run with timeout
  local ec=0
  timeout "$timeout_sec" bash -c "$agent_cmd" \
    > >(tee "$output_log") 2>&1 || ec=$?

  if [[ $ec -eq 124 ]]; then
    orchestrator_fail "Phase '$phase' timed out after ${timeout_sec}s"
  fi

  if [[ $ec -ne 0 ]]; then
    warn "Phase '$phase' exited with code $ec"
    if grep -qi "waiting\|blocked\|asking.*question\|need.*input" "$output_log" 2>/dev/null; then
      orchestrator_fail "Phase '$phase' is blocked (agent waiting for input)"
    fi
  fi
}

# ── setup ─────────────────────────────────────────────────────────────────────
mkdir -p "${ISSUES_DIR}"
echo "" > "${ISSUES_DIR}/orchestrator.log"

log "=== Starting orchestrator for issue #${ISSUE_NUM} ==="

# ── idempotency: check for existing branch/PR ────────────────────────────────
PHASE="${ORCHESTRATOR_PHASE:-start}"
LAST_PHASE="start"

if git revparse --verify "${BRANCH}" 2>/dev/null; then
  EXISTING_PR_NUM=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [[ -n "$EXISTING_PR_NUM" && "$EXISTING_PR_NUM" != "null" ]]; then
    info "Branch '$BRANCH}' already exists with PR #$EXISTING_PR_NUM. Resuming..."
    if [[ -f "${ISSUES_DIR}/pr-number.txt" ]]; then
      log "Orchestrator already completed. See PR #$EXISTING_PR_NUM."
      exit 0
    fi
    PHASE="create-pr"
  else
    info "Branch '$BRANCH}' exists, no PR yet. Resuming from PR creation."
    PHASE="create-pr"
  fi
else
  PHASE="read_issue"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: read_issue
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "read_issue" ]]; then
  log "=== Phase: read_issue ==="
  LAST_PHASE="read_issue"

  # Fetch issue
  gh issue view "$ISSUE_NUM" \
    --json number,title,body,url,labels,comments,state \
    > "${ISSUES_DIR}/issue.json" \
    || orchestrator_fail "Failed to fetch issue #${ISSUE_NUM}"

  # Save issue body and comments
  gh issue view "$ISSUE_NUM" --json body --jq '.body' \
    > "${ISSUES_DIR}/issue.md"

  gh issue view "$ISSUE_NUM" --json comments --jq '.comments[].body' \
    > "${ISSUES_DIR}/issue-comments.md"

  ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq '.title')
  log "Issue #${ISSUE_NUM}: ${ISSUE_TITLE}"

  # Validate required sections
  BODY=$(cat "${ISSUES_DIR}/issue.md")
  for section in "# Goal" "# Acceptance Criteria"; do
    if ! echo "$BODY" | grep -q "$section"; then
      orchestrator_fail "Issue body missing required section: $section"
    fi
  done

  # Validate no unresolved open questions
  OPEN_Q=$(echo "$BODY" | sed -n '/^# Open Questions$/,/^#/p' | grep -v "^# Open Questions$" | grep -v "^#" | grep -v "^$" | head -5 || true)
  if [[ -n "$OPEN_Q" && "$OPEN_Q" != "None." && "$OPEN_Q" != "None" && "$OPEN_Q" != "N/A" && "$OPEN_Q" != "N/A." ]]; then
    orchestrator_fail "Issue has unresolved open questions. Resolve before running."
  fi

  # Check for blocked label
  if gh issue view "$ISSUE_NUM" --json labels --jq '.labels[].name' | grep -qx "ai:blocked"; then
    orchestrator_fail "Issue has ai:blocked label"
  fi

  # Create worktree/branch
  info "Creating branch: ${BRANCH}"
  git fetch origin "$BASE_BRANCH" 2>/dev/null || true

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"
  if ! git revparse --verify "${BRANCH}" 2>/dev/null; then
    if [[ ! -d "$WORKTREE_DIR" ]]; then
      git worktree add "$WORKTREE_DIR" -b "$BRANCH" "origin/${BASE_BRANCH}" 2>/dev/null \
        || git branch "$BRANCH" "origin/${BASE_BRANCH}"
    fi
  fi

  # Copy prompts into worktree
  mkdir -p "${WORKTREE_DIR}/automation/prompts"
  cp -r "${REPO_ROOT}/${PROMPTS_DIR}"/*.md "${WORKTREE_DIR}/automation/prompts/" 2>/dev/null || true
  mkdir -p "${WORKTREE_DIR}/scripts"
  cp -r "${REPO_ROOT}/scripts/"*.sh "${WORKTREE_DIR}/scripts/" 2>/dev/null || true

  # Copy run artifacts into worktree
  mkdir -p "${WORKTREE_DIR}/.ai-runs/issue-${ISSUE_NUM}"
  cp -r "${ISSUES_DIR}/." "${WORKTREE_DIR}/.ai-runs/issue-${ISSUE_NUM}/" 2>/dev/null || true

  PHASE="plan"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: plan
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "plan" ]]; then
  log "=== Phase: plan ==="
  LAST_PHASE="plan"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  PLAN_PROMPT="You are writing an implementation plan.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue file: issue.md (contains the GitHub issue description)
Comments file: issue-comments.md (contains issue comments)
You are on branch: ${BRANCH}

## TASK
Read issue.md and issue-comments.md.
Write a complete implementation plan to ./plan.md.

The plan MUST include:
- goal
- non-goals
- affected files (full paths from repo root)
- ordered implementation tasks (numbered, clear description per task)
- tests to add or update
- validation commands (exact commands to verify correctness)
- risk areas
- stop conditions (what would cause you to abort instead of continue)

## CRITICAL RULES
- Do NOT ask questions. If anything is unclear, make a reasonable assumption and document it.
- Do NOT rely on agent memory. Write everything to plan.md.
- Write the plan file directly. Do NOT run any code yet.
- Stop after writing plan.md.

Write plan.md now."

  echo "$PLAN_PROMPT" | run_agent_raw "plan" "$TIMEOUT_PLAN"

  # Copy plan from worktree back to issues dir
  if [[ -f "${WORKTREE_DIR}/plan.md" ]]; then
    cp "${WORKTREE_DIR}/plan.md" "${ISSUES_DIR}/plan.md"
    info "Plan saved to ${ISSUES_DIR}/plan.md"
  elif [[ -f "${ISSUES_DIR}/plan.log" ]] && grep -l "plan.md" "${ISSUES_DIR}/plan.log" 2>/dev/null; then
    # Agent may have written it elsewhere
    PLAN_FILE=$(find "${WORKTREE_DIR}" -name "plan.md" 2>/dev/null | head -1)
    if [[ -n "$PLAN_FILE" && -f "$PLAN_FILE" ]]; then
      cp "$PLAN_FILE" "${ISSUES_DIR}/plan.md"
    fi
  fi

  if [[ ! -f "${ISSUES_DIR}/plan.md" ]]; then
    orchestrator_fail "Plan file not found after plan phase"
  fi

  PHASE="implement"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: implement
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "implement" ]]; then
  log "=== Phase: implement ==="
  LAST_PHASE="implement"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  if [[ -f "${ISSUES_DIR}/blocked.json" ]]; then
    orchestrator_fail "Orchestrator is blocked from previous phase"
  fi

  IMPLEMENT_PROMPT="You are implementing code changes.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue: issue.md
Plan: plan.md
You are on branch: ${BRANCH}

## TASK
Read issue.md and plan.md.
Make the code changes described in the plan.

## CRITICAL RULES
- Do NOT ask questions. Make reasonable assumptions and document deviations.
- Do NOT rely on agent memory. Write implementation log to ./implementation-log.md.
- Do NOT modify files outside the scope of the plan.
- If you are blocked (waiting for something), write ./blocked.json with the reason and stop.
- After implementing, run: git add -A && git commit -m 'feat: implement issue #${ISSUE_NUM}'
- Stop after implementing and committing.

Start now."

  echo "$IMPLEMENT_PROMPT" | run_agent_raw "implement" "$TIMEOUT_IMPLEMENT"

  # No blocked.json check here — agent already wrote implementation-log.md and committed.
  # If the agent was blocked, it would have exited before writing the commit.

  PHASE="validate"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: validate
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "validate" ]]; then
  log "=== Phase: validate ==="
  LAST_PHASE="validate"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  log "Running pnpm build && pnpm lint && pnpm typecheck && pnpm test..."
  cd "${WORKTREE_DIR}"

  mkdir -p "${ISSUES_DIR}"

  {
    echo "=== pnpm install ==="
    timeout 120 pnpm install --frozen-lockfile 2>&1 | tail -5 || echo "[install completed with warnings]"
    echo ""
    echo "=== pnpm build ==="
    timeout 120 pnpm build 2>&1 || echo "[build failed]"
    echo ""
    echo "=== pnpm lint ==="
    timeout 120 pnpm lint 2>&1 || echo "[lint failed]"
    echo ""
    echo "=== pnpm typecheck ==="
    timeout 120 pnpm typecheck 2>&1 || echo "[typecheck failed]"
    echo ""
    echo "=== pnpm test ==="
    timeout 120 pnpm test 2>&1 || echo "[test failed]"
  } > >(tee "${ISSUES_DIR}/validate.log") 2>&1

  VALIDATE_EXIT=0
  grep -qE "\[build failed\]|\[lint failed\]|\[typecheck failed\]|\[test failed\]" "${ISSUES_DIR}/validate.log" && VALIDATE_EXIT=1

  cp "${ISSUES_DIR}/validate.log" "${ISSUES_DIR}/validation.md"

  if [[ $VALIDATE_EXIT -ne 0 ]]; then
    warn "Validation had failures (check validation.md for details)"
  else
    info "Validation passed"
  fi

  PHASE="review"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: review
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "review" ]]; then
  log "=== Phase: review ==="
  LAST_PHASE="review"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  REVIEW_PROMPT="You are reviewing code changes.

## CONTEXT
You are reviewing branch: ${BRANCH} against base: ${BASE_BRANCH}
Your working directory: ${WORKTREE_DIR}
Issue: issue.md
Plan: plan.md

## TASK
Run: git diff origin/${BASE_BRANCH}...HEAD
Read the diff carefully.

Write a code review to ./code-review.md.

For each finding you MUST include:
- severity: critical | high | medium | low
- file path and line reference (if applicable)
- evidence: what you observed in the diff
- failure mode: why this is a problem
- required fix: specific action to resolve the issue

Categorize findings:
- critical: security, data loss, production-breaking
- high: correct behavior violation, significant bugs
- medium: suboptimal patterns, missing tests
- low: style, formatting, minor improvements

## CRITICAL RULES
- Do NOT ask questions. If something is ambiguous, note it in the review.
- Do NOT approve or request changes - just document findings.
- Do NOT rely on agent memory.
- Stop after writing code-review.md.

Write code-review.md now."

  echo "$REVIEW_PROMPT" | run_agent_raw "review" "$TIMEOUT_REVIEW"

  # Copy review from worktree
  if [[ -f "${WORKTREE_DIR}/code-review.md" ]]; then
    cp "${WORKTREE_DIR}/code-review.md" "${ISSUES_DIR}/review.md"
    info "Review saved to ${ISSUES_DIR}/review.md"
  else
    REVIEW_FILE=$(find "${WORKTREE_DIR}" -name "code-review.md" 2>/dev/null | head -1)
    if [[ -n "$REVIEW_FILE" && -f "$REVIEW_FILE" ]]; then
      cp "$REVIEW_FILE" "${ISSUES_DIR}/review.md"
    fi
  fi

  PHASE="fix-review"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: fix-review (with loop)
# ═══════════════════════════════════════════════════════════════════════════
FIX_LOOP_COUNT=0

while [[ "$PHASE" == "fix-review" && $FIX_LOOP_COUNT -lt $MAX_FIX_LOOPS ]]; do
  FIX_LOOP_COUNT=$((FIX_LOOP_COUNT + 1))
  log "=== Phase: fix-review (loop $FIX_LOOP_COUNT/$MAX_FIX_LOOPS) ==="
  LAST_PHASE="fix-review"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  # Check if review has critical or high findings
  CRITICAL_HIGH_COUNT=0
  if [[ -f "${ISSUES_DIR}/review.md" ]]; then
    CRITICAL_HIGH_COUNT=$(grep -cE "^## Severity: (critical|high)" "${ISSUES_DIR}/review.md" 2>/dev/null || echo 0)
  fi

  if [[ "$CRITICAL_HIGH_COUNT" -eq 0 ]]; then
    info "No critical/high findings in review. Skipping fix loop."
    break
  fi

  info "Found $CRITICAL_HIGH_COUNT critical/high finding(s). Running fix..."

  FIX_PROMPT="You are fixing code review findings.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue: issue.md
Plan: plan.md
Review findings: ${ISSUES_DIR}/review.md

## TASK
Read the code review findings.
Fix ONLY legitimate review findings with severity: critical | high.

Rules:
- Fix only what the review asks for. Do not expand scope.
- Do not rewrite working code for style preference.
- If a finding is invalid, note it in ./review-fix-log.md and skip it.
- If a finding is fixed, document the fix in ./review-fix-log.md.

## CRITICAL RULES
- Do NOT ask questions.
- Do NOT rely on agent memory.
- Do NOT create a PR.
- Do NOT compound.
- After fixing, run: git add -A && git commit -m 'fix: review findings for issue #${ISSUE_NUM} (loop ${FIX_LOOP_COUNT})'
- Stop after fixing and committing.

Start now."

  echo "$FIX_PROMPT" | run_agent_raw "fix-review-${FIX_LOOP_COUNT}" "$TIMEOUT_FIX"

  # Check blocked
  if find "${WORKTREE_DIR}" -not -path "*/.ai-runs/*" -name "blocked.json" 2>/dev/null | head -1 | xargs -I{} cp {} "${ISSUES_DIR}/blocked.json" 2>/dev/null; then
    orchestrator_fail "Fix-review phase blocked"
  fi

  # ── re-validate ────────────────────────────────────────────────────────────
  log "=== Re-validating after fix (loop $FIX_LOOP_COUNT) ==="
  cd "${WORKTREE_DIR}"

  {
    echo "=== pnpm build ==="
    timeout 120 pnpm build 2>&1 || echo "[build failed]"
    echo ""
    echo "=== pnpm lint ==="
    timeout 120 pnpm lint 2>&1 || echo "[lint failed]"
    echo ""
    echo "=== pnpm typecheck ==="
    timeout 120 pnpm typecheck 2>&1 || echo "[typecheck failed]"
    echo ""
    echo "=== pnpm test ==="
    timeout 120 pnpm test 2>&1 || echo "[test failed]"
  } > >(tee "${ISSUES_DIR}/revalidate-${FIX_LOOP_COUNT}.log") 2>&1

  cp "${ISSUES_DIR}/revalidate-${FIX_LOOP_COUNT}.log" "${ISSUES_DIR}/validation-${FIX_LOOP_COUNT}.md"

  # ── re-review ──────────────────────────────────────────────────────────────
  log "=== Re-reviewing after fix (loop $FIX_LOOP_COUNT) ==="

  RE_REVIEW_PROMPT="You are re-reviewing code after fixes were applied.

## CONTEXT
You are reviewing branch: ${BRANCH} against base: ${BASE_BRANCH}
Your working directory: ${WORKTREE_DIR}
Original review: ${ISSUES_DIR}/review.md

## TASK
Run: git diff origin/${BASE_BRANCH}...HEAD
Check if the critical/high findings from the original review have been fixed.

Write an updated review to ./code-review.md.
For each original finding, note whether it is: fixed | partially fixed | not fixed | invalid

## CRITICAL RULES
- Do NOT ask questions.
- Do NOT expand scope.
- Do NOT request new changes beyond what was in the original review.
- Stop after writing updated code-review.md.

Write code-review.md now."

  echo "$RE_REVIEW_PROMPT" | run_agent_raw "re-review-${FIX_LOOP_COUNT}" "$TIMEOUT_REVIEW"

  # Copy updated review
  if [[ -f "${WORKTREE_DIR}/code-review.md" ]]; then
    cp "${WORKTREE_DIR}/code-review.md" "${ISSUES_DIR}/review.md"
  fi

  # Loop will re-evaluate critical_high_count and either break or continue
done

PHASE="create-pr"

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: create-pr
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "create-pr" ]]; then
  log "=== Phase: create-pr ==="
  LAST_PHASE="create-pr"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  # Push branch
  log "Pushing branch..."
  cd "${WORKTREE_DIR}"
  git push -u origin "$BRANCH" 2>&1 | tee -a "${ISSUES_DIR}/orchestrator.log" || \
    warn "Branch push had issues (may already be pushed)"

  # Build pr-summary.md
  ISSUE_URL=$(gh issue view "$ISSUE_NUM" --json url --jq '.url')

  cat > "${ISSUES_DIR}/pr-summary.md" << EOF
# PR Summary — Issue #${ISSUE_NUM}

## Issue
[#${ISSUE_NUM}](${ISSUE_URL}): ${ISSUE_TITLE}

## State
**PR_READY** — All phases completed successfully.

## Phases Completed
$(ls -1 "${ISSUES_DIR}"/*.md 2>/dev/null | while read f; do echo "- $(basename $f)"; done)

## Validation Results
$(grep -E "build|lint|typecheck|test|ERROR|fail" "${ISSUES_DIR}/validate.log" 2>/dev/null | grep -v "^==" | head -20 || echo "See validation.md")

## Review Findings
$(if [[ -f "${ISSUES_DIR}/review.md" ]]; then
  echo "Critical/high: $(grep -cE "^## Severity: (critical|high)" "${ISSUES_DIR}/review.md" 2>/dev/null || echo 0)"
  echo "Medium/low: $(grep -cE "^## Severity: (medium|low)" "${ISSUES_DIR}/review.md" 2>/dev/null || echo 0)"
else
  echo "No review.md found"
fi)

## Fix Loops
$FIX_LOOP_COUNT / $MAX_FIX_LOOPS

## Branch
\`${BRANCH}\`

## Run Artifacts
All logs and artifacts saved to \`ai/issues/${ISSUE_NUM}/\`
EOF

  # Create PR
  PR_BODY=$(cat "${ISSUES_DIR}/pr-summary.md")
  PR_URL=$(gh pr create \
    --base "$BASE_BRANCH" \
    --head "$BRANCH" \
    --title "Issue #${ISSUE_NUM}: automated implementation" \
    --body "$PR_BODY" \
    --json url --jq '.url' 2>&1) || {
    # PR may already exist
    PR_URL=$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url' 2>/dev/null || echo "")
    if [[ -z "$PR_URL" || "$PR_URL" == "null" ]]; then
      orchestrator_fail "Failed to create PR"
    fi
  }

  PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$' || echo "unknown")
  echo "$PR_URL" > "${ISSUES_DIR}/pr-url.txt"
  echo "$PR_NUM" > "${ISSUES_DIR}/pr-number.txt"

  log "PR created: ${PR_URL}"

  # Update issue labels
  gh issue edit "$ISSUE_NUM" --remove-label "ai:in-progress" 2>/dev/null || true
  gh issue edit "$ISSUE_NUM" --add-label "ai:pr-ready" 2>/dev/null || true

  # Comment on issue
  gh issue comment "$ISSUE_NUM" --body "PR created: ${PR_URL}" 2>/dev/null || true

  PHASE="done"
fi

# ═══════════════════════════════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "done" ]]; then
  log "=== Orchestrator complete ==="
  log "PR: $(cat "${ISSUES_DIR}/pr-url.txt")"
  log "Artifacts: ai/issues/${ISSUE_NUM}/"
  echo ""
  echo "✅ Issue #${ISSUE_NUM} → PR ready"
  echo "   PR: $(cat "${ISSUES_DIR}/pr-url.txt")"
  echo "   Branch: ${BRANCH}"
fi