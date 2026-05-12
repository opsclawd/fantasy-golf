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
BRANCH="ai/issue-${ISSUE_NUM}"
PROMPTS_DIR="automation/prompts"
AGENT_MODEL="${AGENT_MODEL:-minimax-coding-plan/MiniMax-M2.7}"
AGENT_CLI="${AGENT_CLI:-opencode}"

# Phase timeouts (seconds)
TIMEOUT_BRAINSTORM=600
TIMEOUT_PLAN_WRITE=600
TIMEOUT_IMPLEMENT=1800
TIMEOUT_VALIDATE=300
TIMEOUT_REVIEW=600
TIMEOUT_FIX=900
TIMEOUT_COMPOUND=600

# All artifacts live in the worktree (no cross-directory permission needed for sub-agents)
WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"
ISSUES_DIR="${WORKTREE_DIR}"

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

  # Write prompt to temp file to avoid pipeline issues with SIGPIPE/tee
  local prompt_file
  prompt_file=$(mktemp)
  cat > "$prompt_file"

  # Run agent: stdin from prompt file, stdout+stderr to log file AND console
  local ec=0
  timeout "$timeout_sec" bash -c "$agent_cmd" < "$prompt_file" 2>&1 \
    | tee -a "$output_log" \
    | grep -v "^\[0m$" | grep -v "^$" || true
  ec=${PIPESTATUS[0]}

  rm -f "$prompt_file"

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

# ── auto-resume: task-level checkpoint detection ─────────────────────────────
LAST_PHASE="start"

get_task_completion_status() {
  local task_n="$1"
  local spec_log="${ISSUES_DIR}/spec-review-task-${task_n}.log"
  local quality_log="${ISSUES_DIR}/quality-review-task-${task_n}.log"

  if [[ ! -f "$spec_log" || ! -f "$quality_log" ]]; then
    if [[ -f "${ISSUES_DIR}/implement-task-${task_n}.log" ]]; then
      echo "implementing"
    else
      echo "pending"
    fi
    return
  fi

  local spec_failed=false quality_failed=false
  if grep -q "❌ Issues found" "$spec_log" 2>/dev/null; then
    spec_failed=true
  fi
  if grep -qi "Assessment:.*NEEDS_WORK" "$quality_log" 2>/dev/null; then
    quality_failed=true
  fi

  if $spec_failed; then
    echo "spec-failed"
  elif $quality_failed; then
    echo "quality-failed"
  else
    echo "complete"
  fi
}

find_first_incomplete_task() {
  local plan_file="plan.md"
  if [[ ! -f "$plan_file" ]]; then
    echo "0"
    return
  fi

  local task_count
  task_count=$(awk '/^#{2,3} Task [0-9]+:/ {n++} END{print n+0}' "$plan_file")

  if [[ "$task_count" -eq 0 ]]; then
    echo "0"
    return
  fi

  local n=1
  while [[ $n -le "$task_count" ]]; do
    local status
    status=$(get_task_completion_status "$n")
    if [[ "$status" != "complete" ]]; then
      echo "$n"
      return
    fi
    n=$((n + 1))
  done

  echo "$((task_count + 1))"
}

detect_resume_point() {
  local first_incomplete
  first_incomplete=$(find_first_incomplete_task)

  if [[ "$first_incomplete" -eq 0 ]]; then
    echo "read_issue"
    return
  fi

  local status
  status=$(get_task_completion_status "$first_incomplete")

  case "$status" in
    complete)
      local task_count
      task_count=$(awk '/^#{2,3} Task [0-9]+:/ {n++} END{print n+0}' "plan.md")
      if [[ $first_incomplete -gt $task_count ]]; then
        echo "validate"
      else
        echo "implement"
      fi
      ;;
    implementing)  echo "implement" ;;
    pending)        echo "implement" ;;
    spec-failed)    echo "spec-review" ;;
    quality-failed) echo "quality-review" ;;
    *)              echo "implement" ;;
  esac
}

detect_phase() {
  if [[ -n "${ORCHESTRATOR_PHASE:-}" ]]; then
    echo "$ORCHESTRATOR_PHASE"
    return
  fi

  if [[ -f "${ISSUES_DIR}/pr-url.txt" ]]; then
    echo "done"
  elif [[ -f "${ISSUES_DIR}/compound.md" ]]; then
    echo "create-pr"
  elif [[ -f "${ISSUES_DIR}/review.md" ]]; then
    echo "fix-review"
  elif [[ -f "${ISSUES_DIR}/validate.log" ]]; then
    echo "review"
  elif [[ -f "${ISSUES_DIR}/plan.md" ]]; then
    detect_resume_point
  elif [[ -f "${ISSUES_DIR}/design.md" ]]; then
    echo "plan-write"
  elif [[ -f "${ISSUES_DIR}/issue.json" ]]; then
    echo "plan-design"
  else
    echo "read_issue"
  fi
}

PHASE="$(detect_phase)"

log "Auto-resume: detected phase='${PHASE}'"

if [[ "$PHASE" == "done" ]]; then
  log "Orchestrator already completed. See $(cat "${ISSUES_DIR}/pr-url.txt" 2>/dev/null || echo 'PR')."
  exit 0
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

  # Delete remote branch if it exists (fresh start)
  if git fetch origin "${BRANCH}" 2>/dev/null; then
    warn "Remote branch ${BRANCH} exists — deleting for fresh start"
    git push origin --delete "${BRANCH}" 2>/dev/null || true
  fi

  # Prune stale worktree admin refs, then create fresh worktree
  git worktree prune 2>/dev/null || true
  if ! git rev-parse --verify "${BRANCH}" 2>/dev/null; then
    rm -rf "$WORKTREE_DIR"
    git worktree add "$WORKTREE_DIR" -b "$BRANCH" "origin/${BASE_BRANCH}"
    if [[ ! -f "${WORKTREE_DIR}/.git" ]]; then
      orchestrator_fail "Worktree creation failed — ${WORKTREE_DIR} is not a git worktree"
    fi
  fi

  # Copy prompts into worktree
  mkdir -p "${WORKTREE_DIR}/automation/prompts"
  cp -r "${REPO_ROOT}/${PROMPTS_DIR}"/*.md "${WORKTREE_DIR}/automation/prompts/" 2>/dev/null || true
  mkdir -p "${WORKTREE_DIR}/scripts"
  cp -r "${REPO_ROOT}/scripts/"*.sh "${WORKTREE_DIR}/scripts/" 2>/dev/null || true

  # Run artifacts (issue.json, issue.md, issue-comments.md) are written directly to worktree

  # Write .gitignore to keep artifact files out of git commits
  cat > "${WORKTREE_DIR}/.gitignore" << 'EOF'
*.log
code-review.md
review.md
design.md
plan.md
compound.md
implementation-log.md
review-fix-log.md
validation*.md
issue*.json
issue*.md
pr-summary.md
pr-*.txt
MEMORY.md
AGENTS.md
CLAUDE.md
tsconfig.tsbuildinfo
spec-review-task-*.md
quality-review-task-*.md
next-env.d.ts
node_modules/
.next/
EOF

  # Archive pre-seeding: skip phases that already have outputs from a prior run
  ARCHIVE_DIR="${REPO_ROOT}/ai/issues/${ISSUE_NUM}"
  if [[ -f "${ARCHIVE_DIR}/plan.md" ]]; then
    info "Archive has plan.md — pre-seeding to skip plan-design and plan-write"
    cp "${ARCHIVE_DIR}/plan.md" "${WORKTREE_DIR}/plan.md"
    cp "${ARCHIVE_DIR}/design.md" "${WORKTREE_DIR}/design.md" 2>/dev/null || true
    PHASE="implement"
  elif [[ -f "${ARCHIVE_DIR}/design.md" ]]; then
    info "Archive has design.md — pre-seeding to skip plan-design"
    cp "${ARCHIVE_DIR}/design.md" "${WORKTREE_DIR}/design.md"
    PHASE="plan-write"
  else
    PHASE="plan-design"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: plan-design — brainstorm using the brainstorming skill
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "plan-design" ]]; then
  log "=== Phase: plan-design (brainstorm) ==="
  LAST_PHASE="plan-design"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  BRAINSTORM_PROMPT="You are analyzing a GitHub issue to produce a design document.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue file: issue.md (contains the GitHub issue description)
Comments file: issue-comments.md (contains issue comments)

## TASK
1. Load the brainstorming skill: say exactly '/skill brainstorming' to activate it.
2. Read issue.md and issue-comments.md thoroughly.
3. Analyze the codebase to understand the existing patterns, types, and architecture relevant to this issue.
4. Using the brainstorming skill guidance, produce a design document at ./design.md covering:
   - The problem being solved and why it matters
   - Key design decisions and trade-offs considered
   - Proposed approach with rationale
   - Assumptions made (do not ask questions — state assumptions explicitly)
   - What is in scope and what is explicitly out of scope
   - Any risks or concerns identified from code analysis

## CRITICAL RULES
- Do NOT ask questions. Make reasonable assumptions and document them explicitly.
- Do NOT rely on agent memory. Write everything to design.md.
- Stop after writing design.md. Do not implement anything.

Write design.md now."

  echo "$BRAINSTORM_PROMPT" | run_agent_raw "plan-design" "$TIMEOUT_BRAINSTORM"

  if [[ ! -f "${WORKTREE_DIR}/design.md" ]]; then
    orchestrator_fail "Design doc not found after plan-design phase"
  fi
  info "Design doc saved to ${WORKTREE_DIR}/design.md"

  PHASE="plan-write"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: plan-write — write implementation plan using writing-plans skill
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "plan-write" ]]; then
  log "=== Phase: plan-write (implementation plan) ==="
  LAST_PHASE="plan-write"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  # design.md lives in the worktree (written by plan-design agent) — no action needed

  PLAN_WRITE_PROMPT="You are writing an implementation plan.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Design doc: design.md (produced in the previous brainstorming step)
Issue file: issue.md
Comments file: issue-comments.md

## TASK
1. Load the writing-plans skill: say exactly '/skill writing-plans' to activate it.
2. Read design.md, issue.md, and issue-comments.md.
3. Using the writing-plans skill guidance, produce a complete implementation plan at ./plan.md.

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
- Do NOT ask questions. Make reasonable assumptions and document them.
- Do NOT rely on agent memory. Write everything to plan.md.
- Stop after writing plan.md. Do not implement anything.

Write plan.md now."

  echo "$PLAN_WRITE_PROMPT" | run_agent_raw "plan-write" "$TIMEOUT_PLAN_WRITE"

  if [[ ! -f "${WORKTREE_DIR}/plan.md" ]]; then
    orchestrator_fail "Plan file not found after plan-write phase"
  fi
  info "Plan saved to ${WORKTREE_DIR}/plan.md"

  PHASE="implement"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: implement — subagent-driven development per task
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "implement" ]]; then
  log "=== Phase: implement ==="
  LAST_PHASE="implement"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  if [[ -f "${ISSUES_DIR}/blocked.json" ]]; then
    orchestrator_fail "Orchestrator is blocked from previous phase"
  fi

  TASK_MANIFEST="${ISSUES_DIR}/task-manifest.json"

  # ── helpers ────────────────────────────────────────────────────────────────

  # Parse numbered tasks from plan.md, output one per line: "N. Title"
  parse_tasks() {
    local plan_file="$1"
    grep -E "^#{2,3} Task [0-9]+:" "$plan_file" 2>/dev/null | sed -E "s/^#{2,3} Task [0-9]+: //" || true
  }

  # Extract full task text (from ## Task N: title line to the next ## section header)
  # Uses a temp file for the task_title to avoid all bash interpolation issues
  # with special chars (backticks, asterisks, $(), etc.) in task titles.
  # Terminates on: any ^##  line (section header like ## Risk Areas, ## Stop Conditions, etc.)
  extract_task_text() {
    local plan_file="$1"
    local task_title="$2"

    local title_file
    title_file=$(mktemp)
    printf '%s' "$task_title" > "$title_file"

    local line_num
    line_num=$(grep -F -n -f "$title_file" "$plan_file" 2>/dev/null | head -1 | cut -d: -f1 || true)
    rm -f "$title_file"

    if [[ -z "$line_num" ]]; then return 1; fi

    printf '%s' "$task_title" > "$title_file"
    tail -n +"$line_num" "$plan_file" | awk -v title_file="$title_file" '
      BEGIN {
        while ((getline line < title_file) > 0) { title = line }
        close(title_file)
        buf_idx = 0
      }
      NF == 0 { next }
      index($0, title) > 0 { in_task=1; next }
      /^## / {
        if (in_task) {
          for (i = 1; i <= buf_idx; i++) print buf[i]
          exit
        }
      }
      in_task { buf[++buf_idx] = $0 }
    '
    rm -f "$title_file"
  }

  # Get task number from title prefix
  task_num() { echo "$1" | cut -d. -f1; }

  # Run implementer for a single task, returns status in IMPLEMENTER_STATUS
  run_implementer() {
    local task_n="$1"
    local task_title="$2"
    local task_text="$3"
    local output_log="${ISSUES_DIR}/implement-task-${task_n}.log"
    local impl_status="unknown"

    log "  Task ${task_n}: implementing..."

    IMPLEMENTER_PROMPT="You are implementing Task ${task_n}: ${task_title}

## Task Description
${task_text}

## Context
You are working in: ${WORKTREE_DIR}
Issue: issue.md
Design: design.md
Plan: plan.md
Branch: ${BRANCH}

You are using Subagent-Driven Development. Follow the process below exactly.

## Your Job

1. Read issue.md, design.md, and plan.md to understand the full scope.
2. Implement exactly what the task specifies.
3. Write tests following TDD where applicable.
4. Verify implementation works.
5. Run: git add -A && git commit -m 'feat: implement issue #${ISSUE_NUM} task ${task_n}'
6. Self-review before reporting back.

## Questions?
If you have clarifications or concerns BEFORE implementing, note them in your report
and proceed with a reasonable assumption. Do not ask questions — make decisions
and document them.

## Self-Review Checklist (before reporting back)
- Completeness: Did I implement everything specified?
- Quality: Is the code clean and maintainable?
- Discipline: Did I avoid overbuilding?
- Testing: Do tests verify actual behavior?

## Report Format
Report back with:
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- What you tested and results
- Files changed
- Self-review findings
- Any questions or concerns

Stop after reporting."

    echo "$IMPLEMENTER_PROMPT" | run_agent_raw "implement-task-${task_n}" "$TIMEOUT_IMPLEMENT"

    # Detect status from log
    if grep -qi "Status:.*BLOCKED" "$output_log" 2>/dev/null; then
      impl_status="BLOCKED"
    elif grep -qi "Status:.*NEEDS_CONTEXT" "$output_log" 2>/dev/null; then
      impl_status="NEEDS_CONTEXT"
    elif grep -qi "Status:.*DONE_WITH_CONCERNS" "$output_log" 2>/dev/null; then
      impl_status="DONE_WITH_CONCERNS"
    elif grep -qi "Status:.*DONE" "$output_log" 2>/dev/null; then
      impl_status="DONE"
    else
      impl_status="DONE"  # assume done if no status found
    fi

    echo "$impl_status"
  }

  # Run spec reviewer for a single task
  run_spec_reviewer() {
    local task_n="$1"
    local task_title="$2"
    local task_text="$3"
    local impl_report="$4"
    local output_log="${ISSUES_DIR}/spec-review-task-${task_n}.log"

    log "  Task ${task_n}: spec review..."

    SPEC_REVIEWER_PROMPT="You are reviewing whether an implementation matches its specification.

## Task Requirements
${task_text}

## What Implementer Claims They Built
$(echo "$impl_report" | head -50)

## CRITICAL: Do Not Trust the Report
You MUST read the actual code and verify line by line. Do not take the
implementer's word for what was built.

## Your Job
1. Read the code that was actually committed.
2. Compare actual implementation to requirements.
3. Check for missing pieces.
4. Check for extra work not requested.
5. Check for misunderstandings.

## Report Format
- ✅ Spec compliant (if everything matches)
- ❌ Issues found: [list specifically with file:line references]

Stop after writing your review to ./spec-review-task-${task_n}.md."

    echo "$SPEC_REVIEWER_PROMPT" | run_agent_raw "spec-review-task-${task_n}" "$TIMEOUT_REVIEW"

    # Return pass/fail
    if grep -q "✅ Spec compliant" "$output_log" 2>/dev/null; then
      echo "SPEC_PASS"
    else
      echo "SPEC_FAIL"
    fi
  }

  # Run quality reviewer for a single task
  run_quality_reviewer() {
    local task_n="$1"
    local task_title="$2"
    local task_text="$3"
    local base_sha="$4"
    local head_sha="$5"
    local output_log="${ISSUES_DIR}/quality-review-task-${task_n}.log"

    log "  Task ${task_n}: quality review..."

    QUALITY_REVIEWER_PROMPT="You are reviewing the code quality of an implementation.

## Task Summary
${task_title}

## Task Requirements
${task_text}

## What Was Implemented
Files changed (see git diff ${base_sha}..${head_sha})

## Your Job
Run: git diff ${base_sha}..${head_sha}
Review the diff for:
- Code cleanliness and maintainability
- Proper testing
- Following existing patterns
- Single responsibility per file

## Report Format
- Strengths: [what was done well]
- Issues: [Critical | Important | Minor]
- Assessment: APPROVED | NEEDS_WORK

Stop after writing your review to ./quality-review-task-${task_n}.md."

    echo "$QUALITY_REVIEWER_PROMPT" | run_agent_raw "quality-review-task-${task_n}" "$TIMEOUT_REVIEW"

    if grep -qi "Assessment:.*APPROVED" "$output_log" 2>/dev/null; then
      echo "QUALITY_PASS"
    else
      echo "QUALITY_FAIL"
    fi
  }

  # ── main task loop ─────────────────────────────────────────────────────────
  cd "${WORKTREE_DIR}"

  log "Installing dependencies in worktree..."
  {
    echo "=== pnpm install ==="
    timeout 120 pnpm install --frozen-lockfile 2>&1 | tail -10 || echo "[install completed with warnings]"
  } > >(tee -a "${ISSUES_DIR}/install-worktree.log") 2>&1 || true

  if [[ ! -f "plan.md" ]]; then
    orchestrator_fail "plan.md not found in worktree"
  fi

  TASKS=$(parse_tasks "plan.md")
  TASK_COUNT=$(echo "$TASKS" | grep -c "." || echo 0)

  if [[ $TASK_COUNT -eq 0 ]]; then
    orchestrator_fail "No tasks found in plan.md"
  fi

  log "Found ${TASK_COUNT} task(s) to implement"

  TASK_NUM=0
  IMPLEMENTATION_LOG="${ISSUES_DIR}/implementation-log.md"
  echo "# Implementation Log — Issue #${ISSUE_NUM}" > "$IMPLEMENTATION_LOG"

  RESUME_TASK_NUM=0
  RESUME_STAGE=""
  if [[ "$PHASE" == "implement" ]]; then
    RESUME_TASK_NUM=$(find_first_incomplete_task)
    RESUME_STAGE="implement"
    log "Auto-resume: task ${RESUME_TASK_NUM}, stage '${RESUME_STAGE}'"
  elif [[ "$PHASE" == "spec-review" ]]; then
    RESUME_TASK_NUM=$(find_first_incomplete_task)
    RESUME_STAGE="spec-review"
    log "Auto-resume: task ${RESUME_TASK_NUM}, stage '${RESUME_STAGE}'"
  elif [[ "$PHASE" == "quality-review" ]]; then
    RESUME_TASK_NUM=$(find_first_incomplete_task)
    RESUME_STAGE="quality-review"
    log "Auto-resume: task ${RESUME_TASK_NUM}, stage '${RESUME_STAGE}'"
  fi

  while IFS= read -r task_title; do
    TASK_NUM=$((TASK_NUM + 1))

    if [[ $TASK_NUM -lt $RESUME_TASK_NUM ]]; then
      log "  Skipping completed task ${TASK_NUM}"
      continue
    fi

    log "=== Task ${TASK_NUM}/${TASK_COUNT}: ${task_title} ==="

    TASK_TEXT=$(extract_task_text "plan.md" "$task_title")
    if [[ -z "$TASK_TEXT" ]]; then
      warn "Could not extract task text for '${task_title}', using title as description"
      TASK_TEXT="$task_title"
    fi

    BASE_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

    if [[ "$TASK_NUM" -eq "$RESUME_TASK_NUM" && "$RESUME_STAGE" == "spec-review" ]]; then
      log "  Resuming at spec-review for task ${TASK_NUM}"
    elif [[ "$TASK_NUM" -eq "$RESUME_TASK_NUM" && "$RESUME_STAGE" == "quality-review" ]]; then
      log "  Resuming at quality-review for task ${TASK_NUM}"
    fi

    IMPL_STATUS="DONE"
    HEAD_SHA=""
    SPEC_RESULT="SPEC_PASS"
    QUALITY_RESULT="QUALITY_PASS"

    if [[ $TASK_NUM -gt $RESUME_TASK_NUM || "$RESUME_STAGE" == "implement" || -z "$RESUME_STAGE" ]]; then
      IMPL_STATUS=$(run_implementer "$TASK_NUM" "$task_title" "$TASK_TEXT")
      log "  Implementer status: ${IMPL_STATUS}"

      if [[ "$IMPL_STATUS" == "BLOCKED" || "$IMPL_STATUS" == "NEEDS_CONTEXT" ]]; then
        orchestrator_fail "Task ${TASK_NUM} is ${IMPL_STATUS}. Fix the blocker and re-run."
      fi

      HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
    fi

    if [[ "$TASK_NUM" -eq "$RESUME_TASK_NUM" && "$RESUME_STAGE" == "quality-review" ]]; then
      log "  Skipping spec review for resumed task ${TASK_NUM} (already complete)"
    else
      IMPL_REPORT=$(cat "${ISSUES_DIR}/implement-task-${TASK_NUM}.log" 2>/dev/null || echo "")
      SPEC_RESULT=$(run_spec_reviewer "$TASK_NUM" "$task_title" "$TASK_TEXT" "$IMPL_REPORT")
      log "  Spec review: ${SPEC_RESULT}"

      SPEC_LOOP=0
      while [[ "$SPEC_RESULT" == "SPEC_FAIL" && $SPEC_LOOP -lt 3 ]]; do
        SPEC_LOOP=$((SPEC_LOOP + 1))
        warn "  Spec review failures detected, re-running implementer (loop ${SPEC_LOOP})..."

        SPEC_FINDINGS=$(cat "./spec-review-task-${TASK_NUM}.md" 2>/dev/null || echo "See spec review log for details")
        FIX_PROMPT="You are fixing spec compliance issues for Task ${TASK_NUM}.

## Task: ${task_title}
## Original task text:
${TASK_TEXT}

## Spec Review Findings:
${SPEC_FINDINGS}

Fix ONLY the issues identified above. Do not expand scope.

Run: git add -A && git commit -m 'fix: task ${TASK_NUM} spec compliance'
Report status: DONE | BLOCKED"

        echo "$FIX_PROMPT" | run_agent_raw "implement-task-${TASK_NUM}-fix" "$TIMEOUT_FIX"
        HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

        IMPL_REPORT=$(cat "${ISSUES_DIR}/implement-task-${TASK_NUM}-fix.log" 2>/dev/null || echo "")
        SPEC_RESULT=$(run_spec_reviewer "$TASK_NUM" "$task_title" "$TASK_TEXT" "$IMPL_REPORT")
        log "  Spec review after fix: ${SPEC_RESULT}"
      done

      if [[ "$SPEC_RESULT" == "SPEC_FAIL" ]]; then
        warn "Spec review failed after ${SPEC_LOOP} loops. Proceeding with caution."
      fi
    fi

    if [[ $TASK_NUM -gt $RESUME_TASK_NUM || "$RESUME_STAGE" != "quality-review" ]]; then
      QUALITY_RESULT=$(run_quality_reviewer "$TASK_NUM" "$task_title" "$TASK_TEXT" "$BASE_SHA" "$HEAD_SHA")
      log "  Quality review: ${QUALITY_RESULT}"

      QUALITY_LOOP=0
      while [[ "$QUALITY_RESULT" == "QUALITY_FAIL" && $QUALITY_LOOP -lt 3 ]]; do
        QUALITY_LOOP=$((QUALITY_LOOP + 1))
        warn "  Quality issues detected, re-running implementer (loop ${QUALITY_LOOP})..."

        QUALITY_FINDINGS=$(cat "./quality-review-task-${TASK_NUM}.md" 2>/dev/null || echo "See quality review log for details")
        FIX_PROMPT="You are fixing code quality issues for Task ${TASK_NUM}.

## Task: ${task_title}

## Quality Review Findings:
${QUALITY_FINDINGS}

Address the quality issues raised above. Do not expand scope.

Run: git add -A && git commit -m 'fix: task ${TASK_NUM} quality'
Report status: DONE | BLOCKED"

        echo "$FIX_PROMPT" | run_agent_raw "implement-task-${TASK_NUM}-quality-fix" "$TIMEOUT_FIX"
        HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

        QUALITY_RESULT=$(run_quality_reviewer "$TASK_NUM" "$task_title" "$TASK_TEXT" "$BASE_SHA" "$HEAD_SHA")
        log "  Quality review after fix: ${QUALITY_RESULT}"
      done
    fi

    {
      echo ""
      echo "## Task ${TASK_NUM}: ${task_title}"
      echo "- Status: ${IMPL_STATUS}"
      echo "- Spec: ${SPEC_RESULT}"
      echo "- Quality: ${QUALITY_RESULT}"
      echo "- Commit: ${HEAD_SHA}"
    } >> "$IMPLEMENTATION_LOG"

    log "  Task ${TASK_NUM} complete (impl=${IMPL_STATUS}, spec=${SPEC_RESULT}, quality=${QUALITY_RESULT})"

  done <<< "$TASKS"

  # Final commit aggregating all tasks
  log "Committing full implementation..."
  git add -A
  git commit -m "feat: implement issue #${ISSUE_NUM} — all ${TASK_COUNT} tasks complete" 2>/dev/null || true

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

while [[ "$PHASE" == "fix-review" ]]; do
  FIX_LOOP_COUNT=$((FIX_LOOP_COUNT + 1))
  if [[ $FIX_LOOP_COUNT -gt 10 ]]; then
    info "Fix loop limit (10) reached. Moving on."
    break
  fi
  log "=== Phase: fix-review (loop $FIX_LOOP_COUNT) ==="
  LAST_PHASE="fix-review"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  if [[ ! -f "${ISSUES_DIR}/review.md" ]]; then
    info "No review.md found. Skipping fix loop."
    break
  fi

  FIX_PROMPT="You are fixing code review findings.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue: issue.md
Plan: plan.md
Review findings: ./review.md

## TASK
Read the code review findings.
Fix ALL legitimate review findings across all severities.

Rules:
- Fix only what the review asks for. Do not expand scope.
- Do not rewrite working code for style preference.
- If a finding is invalid, note it in ./review-fix-log.md and skip it.
- If a finding is fixed, document the fix in ./review-fix-log.md.

## CRITICAL RULES
- Do NOT ask questions.
- Do NOT rely on agent memory.
- Do NOT create a PR.
- Load the requesting-code-review skill first.
- After fixing, run: git add -A && git commit -m 'fix: review findings for issue #${ISSUE_NUM} (loop ${FIX_LOOP_COUNT})'
- Stop after fixing and committing.

Start now."

  echo "$FIX_PROMPT" | run_agent_raw "fix-review-${FIX_LOOP_COUNT}" "$TIMEOUT_FIX"

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
Original review: ./review.md
Revalidation log: ./revalidate-${FIX_LOOP_COUNT}.log

## TASK
Load the requesting-code-review skill first.
Read the actual source files that had findings. Verify each finding by reading the file on disk.
Check the revalidation log for build/lint/test results.
For each original finding, note whether it is: **fixed** | **partially fixed** | **not fixed** | **invalid**
If a finding was pre-existing (not introduced by this branch), note it as **CARRIED FORWARD** (pre-existing).
Write an updated review to ./code-review.md.
Verify your assertions by reading actual file contents.

## CRITICAL RULES
- Do NOT ask questions.
- Do NOT expand scope.
- Do not flag new issues beyond the original review.
- Stop after writing updated code-review.md.

Write code-review.md now."

  echo "$RE_REVIEW_PROMPT" | run_agent_raw "re-review-${FIX_LOOP_COUNT}" "$TIMEOUT_REVIEW"

  # Copy updated review
  if [[ -f "${WORKTREE_DIR}/code-review.md" ]]; then
    cp "${WORKTREE_DIR}/code-review.md" "${ISSUES_DIR}/review.md"
  fi

  # Check if all findings are resolved (exit loop)
  UNRESOLVED_COUNT=$(grep -iE "\*\*(not fixed|partially fixed)\*\*" "${ISSUES_DIR}/review.md" 2>/dev/null | grep -vi "pre-existing" | wc -l || true)
  if [[ $UNRESOLVED_COUNT -eq 0 ]]; then
    info "All findings resolved. Exiting fix loop."
    break
  fi
  info "$UNRESOLVED_COUNT finding(s) still unresolved. Continuing fix loop."
done

PHASE="compound"

# ═══════════════════════════════════════════════════════════════════════════
# PHASE: compound
# ═══════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "compound" ]]; then
  log "=== Phase: compound ==="
  LAST_PHASE="compound"

  WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/issue-${ISSUE_NUM}"

  if [[ ! -f "${WORKTREE_DIR}/implementation-log.md" ]]; then
    info "No implementation-log.md found. Skipping compound."
    PHASE="create-pr"
  else
    COMPOUND_PROMPT="You are writing a compound engineering document.

## CONTEXT
You are working in: ${WORKTREE_DIR}
Issue: issue.md
Plan: plan.md
Design: design.md
Implementation: implementation-log.md

## TASK
Read implementation-log.md and write a solution document to:
  docs/solutions/issue-${ISSUE_NUM}.md

This document should capture:
- The problem and context
- What was decided and why (with trade-offs considered)
- Key implementation decisions and their reasoning
- Gotchas, pitfalls, and lessons learned
- What someone should know if they need to modify this code

Format: markdown with clear sections. Be specific. Include actual code paths, not generic descriptions.

Rules:
- Do NOT ask questions.
- Write the document yourself. Do not delegate.
- Do not create a PR or commit anything.

Start now."

    echo "$COMPOUND_PROMPT" | run_agent_raw "compound" "$TIMEOUT_COMPOUND"

    # Copy the generated doc back to issues dir
    if [[ -f "${WORKTREE_DIR}/docs/solutions/issue-${ISSUE_NUM}.md" ]]; then
      cp "${WORKTREE_DIR}/docs/solutions/issue-${ISSUE_NUM}.md" "${ISSUES_DIR}/compound.md"
      info "Compound doc saved to ${ISSUES_DIR}/compound.md"
    fi
  fi

  PHASE="create-pr"
fi

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
  git push --force-with-lease -u origin "$BRANCH" 2>&1 | tee -a "${ISSUES_DIR}/orchestrator.log" || \
    warn "Branch push had issues (may already be pushed)"

  # Build pr-summary.md
  ISSUE_META=$(gh issue view "$ISSUE_NUM" --json title,url)
  ISSUE_TITLE=$(echo "$ISSUE_META" | jq -r '.title')
  ISSUE_URL=$(echo "$ISSUE_META" | jq -r '.url')

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
  echo "Critical/high: $(grep -ciE "severity.*(critical|high)" "${ISSUES_DIR}/review.md" 2>/dev/null || echo 0)"
  echo "Medium/low: $(grep -ciE "severity.*(medium|low)" "${ISSUES_DIR}/review.md" 2>/dev/null || echo 0)"
else
  echo "No review.md found"
fi)

## Fix Loops
$FIX_LOOP_COUNT

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
    --body "$PR_BODY" 2>/dev/null) || {
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

  ARCHIVE_DIR="${REPO_ROOT}/ai/issues/${ISSUE_NUM}"
  mkdir -p "$ARCHIVE_DIR"
  cp -r "${WORKTREE_DIR}"/* "$ARCHIVE_DIR"/ 2>/dev/null || true
  cp "${WORKTREE_DIR}/.git" "$ARCHIVE_DIR/.git-worktree" 2>/dev/null || true
  log "Worktree archived to ${ARCHIVE_DIR}/"

  echo ""
  echo "✅ Issue #${ISSUE_NUM} → PR ready"
  echo "   PR: $(cat "${ISSUES_DIR}/pr-url.txt")"
  echo "   Branch: ${BRANCH}"
fi
