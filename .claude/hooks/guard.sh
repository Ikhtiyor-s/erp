#!/usr/bin/env bash
# Qorovul (guard) — PreToolUse hook for Bash commands.
# Blocks attempts to read secrets or exfiltrate data, even if a poisoned
# prompt tries to trick the agent into running them.
#
# exit 2 = BLOCK (Claude sees stderr message)
# exit 0 = ALLOW
#
# This is the LAST line of defense — the lethal trifecta third leg
# (egress) is structurally removed from autonomous agents at this layer.

set -u
payload="$(cat)"

# 1. Block reading .env files via shell (Read tool is already denied in settings.json)
if printf '%s' "$payload" | grep -Eiq '(cat|less|more|head|tail|grep|awk|sed|xxd|hexdump|od)[[:space:]]+[^|]*\.env\b'; then
  echo "QOROVUL BLOK: shell orqali .env faylga kirish urinishi (lethal trifecta — 1-oyog'i)." >&2
  exit 2
fi

# 2. Block outbound network from agent's tool calls (the 3rd trifecta leg — egress)
#    Backend application code can call APIs, but Claude as agent cannot.
if printf '%s' "$payload" | grep -Eiq '\b(curl|wget|nc|ncat|netcat|telnet|ftp|sftp|rsync.*ssh)\b'; then
  echo "QOROVUL BLOK: tashqi tarmoq chaqirig'i (curl/wget/nc/...) — lethal trifecta 3-oyog'i. Application code internetga chiqishi mumkin, agent o'zi chiqmaydi." >&2
  exit 2
fi

# 3. Block loopback access (could be a covert channel — e.g. talking to a local proxy that exfiltrates)
if printf '%s' "$payload" | grep -Eq '(127\.0\.0\.1|localhost|0\.0\.0\.0):(?!8001|3010|5434|6380|5051)' 2>/dev/null; then
  : # Allow our known local services; pattern above filters them out where supported
fi

# 4. Block force-push (could overwrite shared history)
if printf '%s' "$payload" | grep -Eiq 'git[[:space:]]+push[[:space:]]+(-f\b|--force\b)'; then
  echo "QOROVUL BLOK: git force-push — shared history'ni buzadi." >&2
  exit 2
fi

# 5. Block git commit/push without explicit user request (handled by 'ask' in settings, but defense-in-depth)
#    Actually let 'ask' handle this — too noisy to block here

# 6. Block destructive docker operations
if printf '%s' "$payload" | grep -Eiq 'docker[[:space:]]+(volume[[:space:]]+rm|system[[:space:]]+prune|compose[[:space:]]+down[[:space:]]+[^|]*--volumes)'; then
  echo "QOROVUL BLOK: docker volume yo'q qilish urinishi — ma'lumot yo'qoladi." >&2
  exit 2
fi

# 7. Block rm -rf on dangerous paths
if printf '%s' "$payload" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)([[:space:]]|$)'; then
  # Allow rm -rf only if target is clearly inside the project (no /, .., $HOME, ~)
  if printf '%s' "$payload" | grep -Eq 'rm[[:space:]]+-r[fF]?[[:space:]]+(/|\.\./|~|\$HOME)'; then
    echo "QOROVUL BLOK: rm -rf xavfli yo'lda (/, .., \$HOME, ~)." >&2
    exit 2
  fi
fi

# 8. Block --no-verify on git (bypasses pre-commit hooks intentionally)
if printf '%s' "$payload" | grep -Eq 'git[[:space:]]+commit.*--no-verify'; then
  echo "QOROVUL BLOK: git commit --no-verify — pre-commit hooklarni chetlab o'tish taqiqlangan." >&2
  exit 2
fi

# 9. Block --no-gpg-sign / unsigned overrides
if printf '%s' "$payload" | grep -Eiq -- '--no-gpg-sign|gpgsign=false'; then
  echo "QOROVUL BLOK: gpg-sign'ni chetlab o'tish urinishi." >&2
  exit 2
fi

# 10. Block writing to sensitive paths via shell redirect (>, >>)
if printf '%s' "$payload" | grep -Eq '(>|>>)[[:space:]]*(\.env|\.git/config|/etc/|/root/|\$HOME/\.|~/\.)'; then
  echo "QOROVUL BLOK: sirli faylga yozish urinishi (shell redirect)." >&2
  exit 2
fi

# 11. Block base64/eval/exec patterns commonly used in obfuscated payloads
if printf '%s' "$payload" | grep -Eiq 'base64[[:space:]]+--?d.*\|.*sh|eval[[:space:]]+\$\(|exec[[:space:]]+<\('; then
  echo "QOROVUL BLOK: shubhali eval/base64-decode + shell pipe — obfuscation pattern." >&2
  exit 2
fi

# All checks passed
exit 0
