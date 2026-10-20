#!/usr/bin/env bash
# audit-lib.sh — you can run this on any reference library to see per-verb status.
# Usage: ./audit-lib.sh <path/to/NN-library.slat>
#
# Reports for each verb:
#   - verb name
#   - number of code snippets found in the entry
#   - row-2/3/4/5 field presence
#   - grep-hit: does the target verb name appear inside each :code block
#   - overall PASS/FAIL against the 15-snippet standard
#
# Nothing modifies the file. Read-only audit.

set -euo pipefail

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 <path/to/NN-library.slat>"
  exit 1
fi

python3 - "$FILE" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

# Find every (verb ...) block via paren-depth scan (string-aware)
def scan_blocks(text):
    i, N = 0, len(text)
    blocks = []
    while i < N:
        j = text.find('(verb', i)
        if j < 0: break
        # boundary check
        if j > 0 and text[j-1] not in '\n\r\t ':
            i = j + 1
            continue
        depth = 0
        in_str = False
        esc = False
        k = j
        while k < N:
            ch = text[k]
            if esc:
                esc = False
            elif ch == '\\' and in_str:
                esc = True
            elif ch == '"':
                in_str = not in_str
            elif not in_str:
                if ch == '(': depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        blocks.append(text[j:k+1])
                        i = k + 1
                        break
            k += 1
        else:
            break
    return blocks

blocks = scan_blocks(text)
if not blocks:
    print(f"[{path.name}] no (verb ...) blocks found")
    sys.exit(0)

print(f"[{path.name}]  {len(blocks)} verbs\n")
tot_pass = 0
for b in blocks:
    m = re.search(r':name\s+"([^"]+)"', b)
    name = m.group(1) if m else "?"
    codes = re.findall(r':code\s+"((?:[^"\\]|\\.)*)"', b, re.S)
    has_r2 = ':row-2-audit' in b
    has_r3 = ':row-3-dimension' in b
    has_r4 = ':row-4-proof' in b
    has_r5 = ':row-5-composition' in b or ':row-5-emergence' in b
    has_examples = ':examples' in b
    n_code = len(codes)
    # For each code block, verify the target verb name appears inside it
    hits = sum(1 for c in codes if name and name.split('/')[-1] in c)
    passed = (n_code >= 15) and has_r2 and has_r3 and has_r4 and has_r5 and (hits == n_code)
    tot_pass += 1 if passed else 0
    print(f"  {name:24s}  snippets: {n_code:>2}/15   "
          f"row2={'✓' if has_r2 else '✗'} row3={'✓' if has_r3 else '✗'} "
          f"row4={'✓' if has_r4 else '✗'} row5={'✓' if has_r5 else '✗'}   "
          f"verb-in-code: {hits}/{n_code}   "
          f"{'PASS' if passed else 'FAIL'}")

print(f"\nTOTAL: {tot_pass}/{len(blocks)} verbs pass 15-snippet standard")
PY
