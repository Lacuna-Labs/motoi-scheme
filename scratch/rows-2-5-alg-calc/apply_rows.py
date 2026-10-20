#!/usr/bin/env python3
"""Insert row-2 through row-5 into each verb of a .slat reference chapter.

Strategy: locate each verb block by `(verb\n  :name "X"` marker.
Each verb terminates with `:learn (...))` — the final `))` closes :learn and
verb. We insert 4 row records BETWEEN `:learn (...)` closing and outer `)`.

Implementation: find each verb block by top-level parenthesis scan starting at
`(verb`. Then within that block, find the FINAL `))` on its own logical line
and rewrite it as `)` + 4 rows + `)`.
"""
import re
import sys
from pathlib import Path


def find_verb_ranges(text):
    """Return list of (start, end, name) for each (verb ...) top-level form."""
    out = []
    i = 0
    while True:
        m = re.search(r'\(verb\n\s+:name\s+"([^"]+)"', text[i:])
        if not m:
            break
        start = i + m.start()
        name = m.group(1)
        # Walk parens from start to find matching close.
        depth = 0
        j = start
        in_str = False
        while j < len(text):
            c = text[j]
            if c == '"' and (j == 0 or text[j - 1] != '\\'):
                in_str = not in_str
            elif not in_str:
                if c == '(':
                    depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        out.append((start, j + 1, name))
                        i = j + 1
                        break
            j += 1
        else:
            break
    return out


def apply_rows(path, rows_by_name):
    text = Path(path).read_text()
    ranges = find_verb_ranges(text)
    print(f"Found {len(ranges)} verbs in {path}", file=sys.stderr)
    # Build replacement from end to start so offsets don't shift.
    new_text = text
    applied = 0
    missing = []
    for start, end, name in reversed(ranges):
        if name not in rows_by_name:
            missing.append(name)
            continue
        rows = rows_by_name[name].rstrip()
        block = new_text[start:end]
        # block ends with ')' (verb close). Insert rows before final ')'.
        # Verb closes on `:learn (....))` — the last `)` closes the verb.
        # Simplest: strip trailing `)` from block, append rows, re-add `)`.
        if not block.endswith(')'):
            print(f"WARN: verb {name} block doesn't end with )", file=sys.stderr)
            continue
        inner = block[:-1].rstrip()
        new_block = inner + '\n' + rows + '\n)'
        new_text = new_text[:start] + new_block + new_text[end:]
        applied += 1
    Path(path).write_text(new_text)
    print(f"Applied {applied} verbs; {len(missing)} missing: {missing[:10]}",
          file=sys.stderr)
    return applied, missing


if __name__ == '__main__':
    src = sys.argv[1]
    rows_mod = sys.argv[2]
    sys.path.insert(0, str(Path(rows_mod).parent))
    mod_name = Path(rows_mod).stem
    mod = __import__(mod_name)
    apply_rows(src, mod.ROWS)
