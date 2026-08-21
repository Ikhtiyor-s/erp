#!/usr/bin/env bash
# Wrapup — Stop hook. Appends a session-end marker to LESSONS.md so tomorrow's
# team can read what happened today. The agent itself can append richer notes
# during the session; this hook just ensures the timestamp is recorded.

set -u

lessons_file="$CLAUDE_PROJECT_DIR/LESSONS.md"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo ""
  echo "## $ts — sessiya tugadi"
  echo ""
  echo "_Sessiya davomida nima ishladi / nima ishlamadi / keyingi safar nimani o'zgartirish — agent o'zi yozadi yoki keyingi sessiyada qo'lda to'ldiriladi._"
} >> "$lessons_file" 2>/dev/null || true

exit 0
