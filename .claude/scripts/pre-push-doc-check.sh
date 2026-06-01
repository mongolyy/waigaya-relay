#!/bin/bash
# PreToolUse hook: checks and updates README.md / CLAUDE.md before git push.
# Triggered automatically by Claude Code on every Bash tool call.

# Read tool input JSON from stdin
INPUT=$(cat)

# Skip if required tools are not available
if ! command -v jq &>/dev/null || ! command -v claude &>/dev/null; then
  exit 0
fi

COMMAND=$(jq -r '.tool_input.command // empty' <<< "$INPUT" 2>/dev/null)

# Only act on git push commands
if [[ "$COMMAND" != *"git push"* ]]; then
  exit 0
fi

BASE_BRANCH="main"

# Skip if origin/main is not reachable (first push of a brand-new repo)
if ! git rev-parse "origin/$BASE_BRANCH" &>/dev/null 2>&1; then
  exit 0
fi

# Re-entrancy guard: skip if the last commit was already a doc update by this hook
LAST_COMMIT=$(git log -1 --pretty=%s 2>/dev/null)
if [[ "$LAST_COMMIT" == "docs: update README/CLAUDE.md"* ]]; then
  exit 0
fi

# Diff of code changes, excluding the doc files themselves and lock files
DIFF=$(git diff "origin/$BASE_BRANCH...HEAD" -- \
  ':(exclude)README.md' \
  ':(exclude)README.ja.md' \
  ':(exclude)CLAUDE.md' \
  ':(exclude)*.lock' \
  ':(exclude)package-lock.json' \
  2>/dev/null)

if [ -z "$DIFF" ]; then
  exit 0
fi

echo "[doc-check] Reviewing documentation against code changes..." >&2

# Cap diff size to avoid overwhelming the model
TRIMMED_DIFF=$(head -n 600 <<< "$DIFF")

# Prevent re-entrant hook execution in any nested Claude session
export SKIP_DOC_CHECK=1

claude -y --allowedTools "Edit,Write" -p "
You are reviewing code changes about to be pushed to this repository.

Inspect README.md and CLAUDE.md and update them ONLY if the diff below directly affects:
- Architecture or request flow
- New or removed features, API endpoints, or components
- New or changed environment variables
- New or changed npm scripts / CLI commands
- File/module structure or responsibilities
- Key design decisions documented in CLAUDE.md

Code diff:
\`\`\`diff
$TRIMMED_DIFF
\`\`\`

Rules:
- Only update content that is factually affected by the diff. Do not add speculative content.
- Keep the existing tone and structure of each file.
- If no update is needed, output exactly: NO_UPDATES_NEEDED
" < /dev/null

# If docs were modified, block the push and instruct Claude to commit them first
if ! git diff --quiet README.md CLAUDE.md 2>/dev/null; then
  echo "Documentation updated automatically. Please commit README.md / CLAUDE.md and push again."
  exit 2
fi

exit 0
