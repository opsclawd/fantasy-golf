#!/usr/bin/env bash
# ai-pr-review-poll.sh — Polls a PR for review comments, fixes them, and replies.
# Designed to run as a background process spawned by ai-run-issue-v2.sh.
# Uses explicit error handling instead of set -e to avoid dying on transient API failures.
set -uo pipefail

# ── Config ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PR_NUMBER="${1:-}"
ISSUE_NUM="${2:-}"
MAX_POLLS="${3:-3}"
POLL_INTERVAL="${4:-300}"
AGENT_MODEL="${AGENT_MODEL:-minimax-coding-plan/MiniMax-M2.7}"
OWNER_REPO="opsclawd/fantasy-golf"

if [[ -z "$PR_NUMBER" ]]; then
  echo "Usage: $0 <PR_NUMBER> [issue_num] [max_polls=3] [interval_sec=300]" >&2
  exit 1
fi

ISSUES_DIR="${REPO_ROOT}/ai/poll-pr-${PR_NUMBER}"
mkdir -p "$ISSUES_DIR"
PROCESSED_IDS_FILE="${ISSUES_DIR}/processed-comment-ids.txt"
touch "$PROCESSED_IDS_FILE"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "${ISSUES_DIR}/poll.log"; }
warn() { printf '[%s] WARN: %s\n' "$(date '+%H:%M:%S')" "$*" >&2 | tee -a "${ISSUES_DIR}/poll.log" >&2; }

log "=== PR review poll starting (PR #${PR_NUMBER}, max_polls=${MAX_POLLS}, interval=${POLL_INTERVAL}s) ==="
log "PID: $$"
log "ISSUES_DIR: ${ISSUES_DIR}"

# ── PR info (with retry — PR may not be visible immediately after creation) ──
log "Fetching PR info for #${PR_NUMBER}..."
for attempt in 1 2 3; do
  PR_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName' 2>/dev/null) && break
  warn "Attempt $attempt: failed to fetch PR info. Retrying in 5s..."
  sleep 5
done

if [[ -z "$PR_BRANCH" ]]; then
  warn "Could not fetch PR info after 3 attempts. Exiting."
  exit 1
fi

PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || echo "unknown")
log "PR #${PR_NUMBER}: ${PR_URL} (branch: ${PR_BRANCH})"

# ── Checkout branch in isolated worktree ────────────────────────────────────
POLL_WORKTREE="${REPO_ROOT}/.ai-worktrees/poll-pr-${PR_NUMBER}"
cd "$REPO_ROOT"
git fetch origin "$PR_BRANCH" 2>/dev/null || true

if [[ -d "$POLL_WORKTREE" ]]; then
  log "Reusing existing worktree at ${POLL_WORKTREE}"
  cd "$POLL_WORKTREE"
  git checkout "$PR_BRANCH" 2>/dev/null || true
  git pull --ff-only origin "$PR_BRANCH" 2>/dev/null || git merge "origin/$PR_BRANCH" 2>/dev/null || true
else
  log "Creating worktree at ${POLL_WORKTREE}"
  if git rev-parse --verify "$PR_BRANCH" 2>/dev/null; then
    git worktree add "$POLL_WORKTREE" "$PR_BRANCH"
  else
    git worktree add "$POLL_WORKTREE" -b "$PR_BRANCH" "origin/$PR_BRANCH"
  fi
  cd "$POLL_WORKTREE"
fi
log "Working directory: $(pwd)"

# ── Agent runner ───────────────────────────────────────────────────────────
run_agent() {
  local phase="$1"
  local timeout_sec="$2"
  local output_log="${ISSUES_DIR}/${phase}.log"
  local agent_cmd
  local prompt_file
  prompt_file=$(mktemp)
  cat > "$prompt_file"

  case "${AGENT_CLI:-opencode}" in
    claude|claude-minimax)
      agent_cmd="~/bin/claude-minimax --settings ~/.claude/profiles/minimax.json --print --model $AGENT_MODEL"
      ;;
    opencode)
      agent_cmd="opencode --model $AGENT_MODEL run"
      ;;
    *)
      log "FAIL: Unsupported AGENT_CLI: ${AGENT_CLI:-opencode}"
      rm -f "$prompt_file"
      return 1
      ;;
  esac

  log "Running agent for '$phase' (timeout=${timeout_sec}s)..."

  # Capture agent exit code via temp file to avoid PIPESTATUS loss through pipeline.
  local ec_file
  ec_file=$(mktemp)
  local ec=0

  { timeout "$timeout_sec" bash -c "$agent_cmd" < "$prompt_file" 2>&1; echo $? > "$ec_file"; } \
    | tee -a "$output_log" \
    | grep -v "^\[0m$" | grep -v "^$" || true
  ec=$(cat "$ec_file")

  rm -f "$prompt_file" "$ec_file"

  if [[ $ec -eq 124 ]]; then
    log "FAIL: '$phase' timed out after ${timeout_sec}s"
    return 1
  fi
  if [[ $ec -ne 0 ]]; then
    log "WARN: '$phase' exited with code $ec"
  fi
  return $ec
}

# ── Process reviews ────────────────────────────────────────────────────────
process_reviews() {
  local pr_state
  pr_state=$(gh pr view "$PR_NUMBER" --json state,merged --jq '{state,merged}' 2>/dev/null) || {
    warn "Failed to fetch PR state. Skipping this poll."
    return 1
  }
  if echo "$pr_state" | jq -e '.merged == true or .state == "MERGED"' > /dev/null 2>&1; then
    log "PR #${PR_NUMBER} is already merged. Exiting."
    exit 0
  fi

  log "Fetching PR review comments..."

  local reviews all_comments comments
  reviews=$(gh api "repos/${OWNER_REPO}/pulls/${PR_NUMBER}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENT")]' 2>/dev/null) || {
    warn "Failed to fetch reviews. Skipping this poll."
    return 1
  }
  all_comments=$(gh api "repos/${OWNER_REPO}/pulls/${PR_NUMBER}/comments" --jq '[.[] | {id, path, body, line, pull_request_review_id, user: .user.login}]' 2>/dev/null) || {
    warn "Failed to fetch comments. Skipping this poll."
    return 1
  }

  # Filter out already-processed comment IDs to avoid duplicate replies
  local processed_ids
  processed_ids=$(cat "$PROCESSED_IDS_FILE" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  if [[ -n "$processed_ids" ]]; then
    comments=$(echo "$all_comments" | jq --arg ids "$processed_ids" '
      [ .[] | .id as $cid | select(($ids | split(",") | map(tonumber? // 0) | index($cid) | not) ) ]
    ' 2>/dev/null || echo "$all_comments")
  else
    comments="$all_comments"
  fi

  local comment_count
  comment_count=$(echo "$comments" | jq 'length')

  if [[ $comment_count -eq 0 ]]; then
    log "No new review comments found."
    return 1
  fi

  log "Found $comment_count new comment(s) (skipping already-processed). Processing..."

  # Record these comment IDs as processed so we don't reply to them again
  echo "$comments" | jq -r '.[].id' >> "$PROCESSED_IDS_FILE"

  echo "$reviews" > "${ISSUES_DIR}/reviews.json"
  echo "$comments" > "${ISSUES_DIR}/comments.json"
  gh pr diff "$PR_NUMBER" > "${ISSUES_DIR}/pr-diff.diff" 2>/dev/null || warn "Failed to fetch PR diff"

  local comment_text
  comment_text=$(echo "$comments" | jq -r '.[] | "- \(.path):\(.line) — \(.body)"')

  (
    echo 'Load the receiving-code-review skill first.'
    echo ''
    echo '## CONTEXT'
    echo "PR Number: #${PR_NUMBER}"
    echo "Branch: ${PR_BRANCH}"
    echo "Repository: ${OWNER_REPO}"
    echo "Your working directory: ${POLL_WORKTREE}"
    echo "Issue Archive: ${REPO_ROOT}/ai/issues/${ISSUE_NUM}/ (issue.md, design.md, plan.md)"
    echo ''
    echo '## PR DIFF'
    echo '```'
    cat "${ISSUES_DIR}/pr-diff.diff"
    echo '```'
    echo ''
    echo '## REVIEW COMMENTS'
    echo "${comment_text}"
    echo ''
    echo '## TASK'
    echo ''
    echo '### Step 1: Understand the design context'
    echo "The issue archive (issue.md, design.md, plan.md) is available on the local filesystem. Read it via:"
    echo '```'
    echo "cat ${REPO_ROOT}/ai/issues/${ISSUE_NUM}/issue.md"
    echo "cat ${REPO_ROOT}/ai/issues/${ISSUE_NUM}/design.md"
    echo "cat ${REPO_ROOT}/ai/issues/${ISSUE_NUM}/plan.md"
    echo '```'
    echo ''
    echo '### Step 2: Assess each comment'
    echo 'For each review comment, make a judgement call: is it technically valid against the design? Note your reasoning.'
    echo ''
    echo '### Step 3: Fix the code'
    echo 'Fix the code for any comments you assessed as valid. Then run:'
    echo '```'
    echo 'git add -A'
    echo "git commit -m 'fix: address PR review feedback'"
    echo "git push origin ${PR_BRANCH}"
    echo '```'
    echo ''
    echo '### Step 4: Reply to all threads'
    echo "Using comment IDs from ${ISSUES_DIR}/comments.json, reply to EVERY thread (both valid and invalid comments):"
    echo '```'
    echo "jq -r '.[] | \"gh api repos/${OWNER_REPO}/pulls/${PR_NUMBER}/comments/\(.id)/replies --method POST --raw-field body=Chosen approach: <what was done>. Options considered: <other approaches and why not chosen>. Reasoning: <why this decision aligns with the design>\"' ${ISSUES_DIR}/comments.json | bash"
    echo '```'
    echo 'Use the actual comment IDs from the JSON file. Replace the <...> placeholders with real content describing your reasoning.'
    echo ''
    echo '### Step 5: Verify'
    echo 'Confirm your replies were posted:'
    echo '```'
    echo "gh pr view ${PR_NUMBER} --json comments --jq 'length'"
    echo '```'
    echo ''
    echo '## RULES'
    echo '- Follow the receiving-code-review skill strictly.'
    echo '- No performative agreement (no "thanks", "great point", etc.).'
    echo '- Reply factually: state the chosen approach, options considered, and reasoning.'
    echo '- If truly ambiguous, note the ambiguity, pick the safest default that preserves existing behavior, and explain your reasoning.'
    echo '- Do NOT expand scope beyond comments.'
    echo '- Do NOT create a new PR.'
    echo '- Do NOT merge the PR (no gh pr merge). Only commit, push, and reply.'
  ) | run_agent "process-review-p${POLL_COUNT}" 600
}

# ── Main loop ──────────────────────────────────────────────────────────────
POLL_COUNT=0

while [[ $POLL_COUNT -lt $MAX_POLLS ]]; do
  POLL_COUNT=$((POLL_COUNT + 1))
  log "=== Poll $POLL_COUNT/$MAX_POLLS ==="

  if process_reviews; then
    log "Reviews processed successfully."
  else
    log "No reviews to process (poll $POLL_COUNT/$MAX_POLLS)."
  fi

  if [[ $POLL_COUNT -ge $MAX_POLLS ]]; then
    break
  fi

  log "Sleeping ${POLL_INTERVAL}s until next poll..."
  sleep "$POLL_INTERVAL"
done

log "=== PR review poll complete (${POLL_COUNT}/${MAX_POLLS} polls) ==="