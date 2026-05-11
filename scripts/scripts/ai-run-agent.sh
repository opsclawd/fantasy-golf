#!/usr/bin/env bash
set -euo pipefail

AI_CLI="${AI_CLI:-claude}"
AI_MODEL="${AI_MODEL:-minimax/m2.7}"

PROMPT_FILE="$1"

if [[ -z "$PROMPT_FILE" ]]; then
  echo "Usage: $0 <prompt-file>" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

PROMPT_CONTENT="$(cat "$PROMPT_FILE")"

case "$AI_CLI" in
  claude|claude-minimax)
    ~/bin/claude-minimax --settings ~/.claude/profiles/minimax.json --print --model "$AI_MODEL" "$PROMPT_CONTENT"
    ;;
  opencode)
    opencode --model "$AI_MODEL" run "$PROMPT_CONTENT"
    ;;
  *)
    echo "Error: unsupported AI_CLI '$AI_CLI'. Supported: claude, claude-minimax, opencode" >&2
    exit 1
    ;;
esac
