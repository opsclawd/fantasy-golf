#!/usr/bin/env bash
# =============================================================================
# brainstorm-issue.sh — Fetch a GitHub issue, brainstorm it, write design.md
#
# Usage: ./scripts/brainstorm-issue.sh <issue-number>
#
# Output: ai/issues/{issue}/design.md
# =============================================================================
set -euo pipefail

ISSUE_NUM="${1:-}"
export ISSUE_NUM

if [[ -z "$ISSUE_NUM" ]]; then
  echo "Usage: $0 <issue-number>" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

ISSUES_DIR="${REPO_ROOT}/ai/issues/${ISSUE_NUM}"
mkdir -p "${ISSUES_DIR}"

echo "Fetching issue #${ISSUE_NUM}..."

# Fetch issue body and comments
gh issue view "$ISSUE_NUM" --json body --jq '.body' \
  > "${ISSUES_DIR}/issue.md"

gh issue view "$ISSUE_NUM" --json comments --jq '.comments[].body' \
  > "${ISSUES_DIR}/issue-comments.md"

ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq '.title')
echo "Issue #${ISSUE_NUM}: ${ISSUE_TITLE}"

# Run the brainstorming agent
echo "Running brainstorming agent..."

WORKTREE_DIR="${REPO_ROOT}/.ai-worktrees/brainstorm-${ISSUE_NUM}"
mkdir -p "$WORKTREE_DIR"

# Copy issue files into worktree for agent access
cp "${ISSUES_DIR}/issue.md" "${WORKTREE_DIR}/"
cp "${ISSUES_DIR}/issue-comments.md" "${WORKTREE_DIR}/"

cd "$WORKTREE_DIR"

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
- Write everything to design.md.
- Stop after writing design.md. Do not implement anything.

Write design.md now."

# Write prompt to temp file to avoid shell interpolation issues
PROMPT_FILE=$(mktemp)
echo "$BRAINSTORM_PROMPT" > "$PROMPT_FILE"

opencode --model minimax-coding-plan/MiniMax-M2.7 run < "$PROMPT_FILE"
rm -f "$PROMPT_FILE"

# Copy design.md back to issues dir
if [[ -f "${WORKTREE_DIR}/design.md" ]]; then
  cp "${WORKTREE_DIR}/design.md" "${ISSUES_DIR}/design.md"
  echo "Design document written to: ${ISSUES_DIR}/design.md"
else
  echo "ERROR: design.md not found after brainstorming" >&2
  exit 1
fi
