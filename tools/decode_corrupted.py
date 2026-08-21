"""
Reverse the getErrorMessage(e, ) corruption pattern in .tsx/.ts files.

Corruption rules observed:
  1. Every character `X` was followed by `getErrorMessage(e, )`.
  2. Every ` "text"` (space + double-quoted string) was replaced with
     `getErrorMessage(e, "text")` (the leading space consumed).

Reversal (apply in this order):
  1. `getErrorMessage(e, "text")`  ->  ` "text"`
  2. `getErrorMessage(e, )`        ->  ``  (delete)

Post-fix:
  - `error(|| "text")` and similar residues collapse to
    `error(getErrorMessage(e, "text"))` — the pre-|| expression was lost by
    the corruption; reconstruct with the CLAUDE.md-canonical helper call.

Usage:
    python decode_corrupted.py <file1> [<file2> ...]
    python decode_corrupted.py --dry-run <file>   # write to <file>.decoded, do not overwrite
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Match getErrorMessage(e, "..."). The string body may contain escaped quotes.
WRAPPED = re.compile(r'getErrorMessage\(e, ("(?:[^"\\]|\\.)*")\)')
EMPTY = 'getErrorMessage(e, )'

# Residual "(|| \"text\")" — the pre-|| expression was collapsed by the
# corruption. Reconstruct as CLAUDE.md-canonical `getErrorMessage(e, "text")`.
ERR_OR = re.compile(r'\(\|\|\s+("(?:[^"\\]|\\.)*")\)')


def decode(text: str) -> str:
    text = WRAPPED.sub(lambda m: ' ' + m.group(1), text)
    text = text.replace(EMPTY, '')
    text = ERR_OR.sub(lambda m: f'(getErrorMessage(e, {m.group(1)}))', text)
    return text


def main(argv: list[str]) -> int:
    dry = False
    args = []
    for a in argv[1:]:
        if a == '--dry-run':
            dry = True
        else:
            args.append(a)
    if not args:
        print(__doc__)
        return 2
    for path_str in args:
        p = Path(path_str)
        raw = p.read_text(encoding='utf-8')
        decoded = decode(raw)
        if dry:
            out = p.with_suffix(p.suffix + '.decoded')
            out.write_text(decoded, encoding='utf-8')
            print(f'dry-run: wrote {out}  ({len(raw)} -> {len(decoded)} bytes)')
        else:
            p.write_text(decoded, encoding='utf-8')
            print(f'decoded: {p}  ({len(raw)} -> {len(decoded)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
