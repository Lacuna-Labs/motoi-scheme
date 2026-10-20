#!/usr/bin/env python3
"""Repair the two structural defects that recur in hand-authored 5-row records.

A row is two forms: the programs form, then the reflection form.

    :row-4-proof (
      (:eng-program … :meta "…")
      (:eng "…" :math "…" :cs "…"))

Two ways that gets mistyped, both of which the slat reader only reports as an
"unexpected )" hundreds of lines later:

  FUSED  — the reflection keys are left inside the programs form, because the
           `)` closing it and the `(` opening the reflection were never typed.
  OVERCLOSED — a `:meta` line ends `))`, closing the row as well as the form,
           so the next `(:eng` opens a sibling of the row instead of a child.

Reports every record whose parens do not balance; fixes only these two shapes
and leaves anything else for a human, since guessing at a third shape is how a
record acquires a defect that still parses.
"""

import re, sys

KEY = re.compile(r'^\s*:(\w[\w-]*)\s')


def depth_scan(lines):
    """Running paren depth at the START of each line, string-aware."""
    depths, depth, in_str, esc = [], 0, False, False
    for l in lines:
        depths.append(depth)
        for c in l:
            # A `;` comment can hold an unmatched paren — the chapter headers
            # here open with lines like `;;; the core predicates (eq? eqv?`.
            # Counting those reported a healthy file as one paren short.
            if not in_str and c == ';':
                break
            if in_str:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == '(': depth += 1
                elif c == ')': depth -= 1
    return depths, depth


def fix(path):
    lines = open(path).read().splitlines(True)
    fused = overclosed = 0
    changed = True
    while changed:
        changed = False
        depths, _ = depth_scan(lines)
        for i in range(1, len(lines)):
            prev, cur = lines[i - 1], lines[i]
            m = KEY.match(cur)
            if not m or m.group(1) != 'eng':
                continue
            if not KEY.match(prev) or KEY.match(prev).group(1) != 'meta':
                continue
            # :eng directly after :meta at the same depth == the reflection form
            # was never opened.
            indent = re.match(r'\s*', cur).group(0)
            lines[i - 1] = prev.rstrip('\n') + ')\n'
            lines[i] = indent[:-1] + '(' + cur.lstrip()
            fused += 1
            changed = True
            break
        if changed:
            continue
        depths, _ = depth_scan(lines)
        for i in range(1, len(lines)):
            cur = lines[i]
            if not cur.lstrip().startswith('(:eng '):
                continue
            prev = lines[i - 1]
            pm = KEY.match(prev)
            if not pm or pm.group(1) != 'meta' or not prev.rstrip('\n').endswith('))'):
                continue
            # The reflection form must sit one level INSIDE the row keyword that
            # opened it. When it does not, the previous line closed one too many.
            row = next((j for j in range(i - 1, -1, -1)
                        if re.match(r'\s*:row-\d', lines[j])), None)
            if row is None or depths[i] == depths[row] + 1:
                continue
            lines[i - 1] = prev.rstrip('\n')[:-1] + '\n'
            overclosed += 1
            changed = True
            break

    _, final = depth_scan(lines)
    open(path, 'w').writelines(lines)
    print(f'{path}: fused {fused}, overclosed {overclosed}, final depth {final}')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        fix(p)
