#!/usr/bin/env bash
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PR_NUMBER="${1:-}"
ISSUE_NUM="${2:-$(gh pr view "$PR_NUMBER" --json title --jq '.title' | grep -oE '[0-9]+' | head -1 || echo "$PR_NUMBER")}"
MAX_POLLS="${3:-3}"
POLL_INTERVAL="${4:-300}"
AGENT_MODEL="${AGENT_MODEL:-minimax-coding-plan/MiniMax-M2.7}"
OWNER_REPO="opsclawd/fantasy-golf"

if [[ -z "$PR_NUMBER" ]]; then
  echo "Usage: $0 <PR_NUMBER> [issue_num] [max_polls=3] [interval_sec=300]"
  exit 1
fi

ISSUES_DIR="${REPO_ROOT}/ai/poll-pr-${PR_NUMBER}"
mkdir -p "$ISSUES_DIR"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '[%s] WARN: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }

# ── PR info ────────────────────────────────────────────────────────────────
PR_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url')
log "PR #${PR_NUMBER}: ${PR_URL} (branch: ${PR_BRANCH})"

# ── Checkout branch locally ────────────────────────────────────────────────
cd "$REPO_ROOT"
git fetch origin "$PR_BRANCH" 2>/dev/null || true
if git rev-parse --verify "$PR_BRANCH" 2>/dev/null; then
  git checkout "$PR_BRANCH" 2>/dev/null || true
  git merge "origin/$PR_BRANCH" 2>/dev/null || true
else
  git checkout -b "$PR_BRANCH" "origin/$PR_BRANCH"
fi

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
  local ec=0
  timeout "$timeout_sec" bash -c "$agent_cmd" < "$prompt_file" 2>&1 \
    | tee -a "$output_log" \
    | grep -v "^\[0m$" | grep -v "^$" || true
  ec=${PIPESTATUS[0]}
  rm -f "$prompt_file"

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
  log "Fetching PR review comments..."

  REVIEWS=$(gh api "repos/${OWNER_REPO}/pulls/${PR_NUMBER}/reviews" --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENT")]')
  COMMENTS=$(gh api "repos/${OWNER_REPO}/pulls/${PR_NUMBER}/comments" --jq '[.[] | {id, path, body, line, pull_request_review_id, user: .user.login}]')

  COMMENT_COUNT=$(echo "$COMMENTS" | jq 'length')

  if [[ $COMMENT_COUNT -eq 0 ]]; then
    log "No review comments found."
    return 1
  fi

  log "Found $COMMENT_COUNT comment(s). Processing..."

  echo "$REVIEWS" > "${ISSUES_DIR}/reviews.json"
  echo "$COMMENTS" > "${ISSUES_DIR}/comments.json"
  gh pr diff "$PR_NUMBER" > "${ISSUES_DIR}/pr-diff.diff"

  COMMENT_TEXT=$(echo "$COMMENTS" | jq -r '.[] | "- \(.path):\(.line) — \(.body)"')

  PROMPT="Load the receiving-code-review skill first.

## CONTEXT
PR Number: #${PR_NUMBER}
Branch: ${PR_BRANCH}
Repository: ${OWNER_REPO}
Your working directory: ${REPO_ROOT}
Issue Archive: ${REPO_ROOT}/ai/issues/${ISSUE_NUM}/ (issue.md, design.md, plan.md)

## PR DIFF
\`\`\`
$(cat "${ISSUES_DIR}/pr-diff.diff")
\`\`\`

## REVIEW COMMENTS
${COMMENT_TEXT}

## TASK

### Step 1: Understand the design context
Read issue.md, design.md, and plan.md from the issue archive to understand the original requirements and design intent.

### Step 2: Assess each comment
For each review comment, make a judgement call: is it technically valid against the design? Note your reasoning.

### Step 3: Fix the code
Fix the code for any comments you assessed as valid. Then run:
```
git add -A
git commit -m 'fix: address PR review feedback'
git push origin ${PR_BRANCH}
```

### Step 4: Reply to all threads
Using the comment IDs from comments.json, reply to EVERY thread (both valid and invalid comments):
```
cat comments.json | jq -r '.[] | .id' | while read id; do
  gh api repos/${OWNER_REPO}/pulls/${PR_NUMBER}/comments/$id/replies --method POST --raw-field "body=Chosen approach: <what was done>. Options considered: <other approaches and why not chosen>. Reasoning: <why this decision aligns with the design>"
done
```
Use the actual comment IDs from the JSON file. Replace the `<...>` placeholders with real content describing your reasoning.

### Step 5: Verify
Confirm your replies were posted:
```
gh pr view ${PR_NUMBER} --json comments --jq 'length'
```

## RULES
- Follow the receiving-code-review skill strictly.
- No performative agreement (no 'thanks', 'great point', etc.).
- Reply factually: state the chosen approach, options considered, and reasoning.
- If truly ambiguous, note the ambiguity, pick the safest default that preserves existing behavior, and explain your reasoning.
- Do NOT expand scope beyond comments.
- Do NOT create a new PR."

  echo "$PROMPT" | run_agent "process-review-p${POLL_COUNT}" 600
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
