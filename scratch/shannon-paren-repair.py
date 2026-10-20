#!/usr/bin/env python3
"""Repair the missing-close-paren defect in a .slat chapter.

The defect: inside a :row-N block, one sibling sub-form (:eng-program ... :meta "...")
never closes, so the following sibling (:eng ...) nests inside it and the whole
(verb ...) form runs on. Every instance found so far is a single ')' missing from
the last field line of the sibling. This script finds each such line by depth
analysis and appends exactly one ')'. It NEVER removes anything.

Run with a path argument; prints every line it touched.
"""
import io
import sys

PATH = sys.argv[1]
src = io.open(PATH, encoding='utf-8').read()
lines = src.split('\n')


def depths(ls):
    """Depth at the START of each line (1-based index into the returned list)."""
    out = []
    depth = 0
    instr = False
    esc = False
    for l in ls:
        out.append(depth)
        for ch in l:
            if instr:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == '"':
                    instr = False
                continue
            if ch == '"':
                instr = True
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
    return out, depth


touched = []
for _ in range(200):
    d, final = depths(lines)
    if final == 0:
        break
    # Find the first line that opens a sibling at depth 2 inside a row block
    # and whose matching sibling successor starts deeper than it did.
    fixed = False
    for i in range(len(lines) - 1):
        cur = lines[i + 1]
        # sibling openers are indented 4 spaces then '(:'
        if not cur.startswith('    (:'):
            continue
        # find the previous sibling opener in the same block
        j = i
        while j >= 0 and not lines[j].startswith('    (:'):
            j -= 1
        if j < 0:
            continue
        if d[i + 1] == d[j]:
            continue          # this sibling closed correctly
        if d[i + 1] != d[j] + 1:
            continue          # not the single-missing-paren shape
        lines[i] = lines[i] + ')'
        touched.append(i + 1)
        fixed = True
        break
    if not fixed:
        break

io.open(PATH, 'w', encoding='utf-8').write('\n'.join(lines))
d, final = depths(lines)
print('appended ) to lines:', touched)
print('final depth:', final)
