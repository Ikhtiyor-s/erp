#!/usr/bin/env bash
# Quality check — PostToolUse hook for Edit/MultiEdit/Write.
# Detects file type, runs a FAST sanity check. Best-effort — never blocks.
# exit 0 always. Surfaces problems via stderr (Claude sees).
#
# Goal: catch syntax/parse errors at the moment of write, not when tests fail later.
# Heavy checks (test suite, lint, typecheck) belong in CI or explicit dev commands.

set -u
payload="$(cat 2>/dev/null || true)"

# Extract file_path from tool input JSON (rough — works for Edit/Write/MultiEdit)
file_path="$(printf '%s' "$payload" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

[ -z "${file_path:-}" ] && exit 0
[ ! -f "$file_path" ] && exit 0

# Pick a check by file extension
case "$file_path" in

  # ---------- Python ----------
  *.py)
    if command -v python3 >/dev/null 2>&1; then
      python3 -c "import ast; ast.parse(open(r'$file_path', encoding='utf-8').read())" 2>&1 | head -5 >&2 || true
    elif command -v python >/dev/null 2>&1; then
      python -c "import ast; ast.parse(open(r'$file_path', encoding='utf-8').read())" 2>&1 | head -5 >&2 || true
    fi
    ;;

  # ---------- JavaScript / TypeScript ----------
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    # tsc/tsserver too slow as a hook. Brace balance + obvious syntax check.
    if [ -s "$file_path" ]; then
      opens=$(grep -o '{' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      closes=$(grep -o '}' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$opens" != "$closes" ]; then
        echo "QUALITY WARN: $file_path — { } mismatch ($opens open / $closes close)" >&2
      fi
      paren_o=$(grep -o '(' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      paren_c=$(grep -o ')' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$paren_o" != "$paren_c" ]; then
        echo "QUALITY WARN: $file_path — ( ) mismatch ($paren_o vs $paren_c)" >&2
      fi
    fi
    ;;

  # ---------- JSON ----------
  *.json)
    if command -v python3 >/dev/null 2>&1; then
      python3 -c "import json; json.load(open(r'$file_path', encoding='utf-8'))" 2>&1 | head -3 >&2 || true
    elif command -v python >/dev/null 2>&1; then
      python -c "import json; json.load(open(r'$file_path', encoding='utf-8'))" 2>&1 | head -3 >&2 || true
    fi
    ;;

  # ---------- YAML ----------
  *.yml|*.yaml)
    if command -v python3 >/dev/null 2>&1; then
      python3 -c "import sys; import yaml; yaml.safe_load(open(r'$file_path', encoding='utf-8'))" 2>&1 | head -3 >&2 || true
    fi
    ;;

  # ---------- Go ----------
  *.go)
    if command -v gofmt >/dev/null 2>&1; then
      # gofmt -l prints files with formatting issues
      out=$(gofmt -l "$file_path" 2>&1)
      [ -n "$out" ] && echo "QUALITY WARN: $file_path — gofmt would reformat" >&2
    fi
    ;;

  # ---------- Rust ----------
  *.rs)
    # No fast check — rustc is too slow. Skip.
    :
    ;;

  # ---------- Java / Kotlin ----------
  *.java|*.kt|*.kts)
    # Brace balance only — full compilation is slow
    if [ -s "$file_path" ]; then
      opens=$(grep -o '{' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      closes=$(grep -o '}' "$file_path" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$opens" != "$closes" ]; then
        echo "QUALITY WARN: $file_path — { } mismatch ($opens vs $closes)" >&2
      fi
    fi
    ;;

  # ---------- Ruby ----------
  *.rb)
    if command -v ruby >/dev/null 2>&1; then
      ruby -c "$file_path" 2>&1 | head -3 | grep -v 'Syntax OK' >&2 || true
    fi
    ;;

  # ---------- PHP ----------
  *.php)
    if command -v php >/dev/null 2>&1; then
      php -l "$file_path" 2>&1 | head -3 | grep -v 'No syntax errors' >&2 || true
    fi
    ;;

  # ---------- Shell ----------
  *.sh|*.bash)
    if command -v bash >/dev/null 2>&1; then
      bash -n "$file_path" 2>&1 | head -3 >&2 || true
    fi
    ;;

  # ---------- TOML ----------
  *.toml)
    if command -v python3 >/dev/null 2>&1; then
      python3 -c "import tomllib; tomllib.load(open(r'$file_path','rb'))" 2>&1 | head -3 >&2 || true
    fi
    ;;

  # ---------- SQL ----------
  *.sql)
    # No fast portable check. Look for obvious issues.
    if grep -Eiq 'DROP[[:space:]]+TABLE|TRUNCATE[[:space:]]+TABLE' "$file_path" 2>/dev/null; then
      echo "QUALITY WARN: $file_path — contains DROP/TRUNCATE TABLE. Confirm this is intentional and reversible." >&2
    fi
    ;;

  # ---------- Markdown / text — no check ----------
  *.md|*.txt)
    :
    ;;

  # ---------- Unknown — skip ----------
  *)
    :
    ;;
esac

# Always succeed — soft hook
exit 0
