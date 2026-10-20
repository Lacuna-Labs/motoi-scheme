#!/usr/bin/env python3
"""Strip existing row-2..row-5 blocks from a verb, then re-apply.

Because prior runs left stale rows, each verb has 2 sets of rows-2..5.
This script walks each verb, deletes ALL `:row-2-audit`, `:row-3-dimension`,
`:row-4-proof`, `:row-5-emergence` fields, then re-inserts the fresh generated
rows before the closing `)`.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import gen_rows
import data_alg
import data_alg2
import data_calc
import rows_alg_a


def find_verb_ranges(text):
    out = []
    i = 0
    while True:
        m = re.search(r'\(verb\n\s+:name\s+"([^"]+)"', text[i:])
        if not m:
            break
        start = i + m.start()
        name = m.group(1)
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


def strip_rows_from_block(block):
    """Remove all `:row-N-...(...)` occurrences from a verb block.

    Uses depth-1 paren scanning: within the verb block, at depth 1, when we
    see one of the row keywords, we skip its balanced parenthesized value.
    """
    row_keywords = (':row-2-audit', ':row-3-dimension',
                    ':row-4-proof', ':row-5-emergence')
    # Iterate: find each occurrence, delete the keyword and its (....) group.
    changed = True
    while changed:
        changed = False
        for kw in row_keywords:
            idx = block.find(kw)
            if idx == -1:
                continue
            # Find the '(' after the keyword.
            paren_start = block.find('(', idx)
            if paren_start == -1:
                continue
            # Walk to matching close.
            depth = 0
            j = paren_start
            in_str = False
            while j < len(block):
                c = block[j]
                if c == '"' and (j == 0 or block[j - 1] != '\\'):
                    in_str = not in_str
                elif not in_str:
                    if c == '(':
                        depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            # Delete from idx to j+1, also trailing newline/ws.
                            end = j + 1
                            while end < len(block) and block[end] in ' \t':
                                end += 1
                            if end < len(block) and block[end] == '\n':
                                end += 1
                            # Remove leading whitespace up to newline before idx
                            start = idx
                            while start > 0 and block[start - 1] in ' \t':
                                start -= 1
                            block = block[:start] + block[end:]
                            changed = True
                            break
                j += 1
            if changed:
                break
    return block


def strip_all_rows(path):
    text = Path(path).read_text()
    ranges = find_verb_ranges(text)
    # Process from end to preserve offsets.
    for start, end, name in reversed(ranges):
        block = text[start:end]
        new_block = strip_rows_from_block(block)
        text = text[:start] + new_block + text[end:]
    Path(path).write_text(text)


def apply_fresh(path, rows_by_name):
    """Re-run apply logic freshly on the stripped file."""
    import apply_rows
    return apply_rows.apply_rows(path, rows_by_name)


def combine(*sources):
    out = {}
    for s in sources:
        out.update(s)
    return out


def main():
    alg_gen = gen_rows.build(data_alg.VERBS + data_alg2.VERBS)
    calc_gen = gen_rows.build(data_calc.VERBS)
    alg_rows = combine(alg_gen, rows_alg_a.ROWS)

    alg_target = '/Users/alfred/code/motoi-scheme/Scheme/reference/03-alg.slat'
    calc_target = '/Users/alfred/code/motoi-scheme/Scheme/reference/11-calc.slat'

    print('Stripping alg...', file=sys.stderr)
    strip_all_rows(alg_target)
    print('Stripping calc...', file=sys.stderr)
    strip_all_rows(calc_target)

    print('Applying alg...', file=sys.stderr)
    apply_fresh(alg_target, alg_rows)
    print('Applying calc...', file=sys.stderr)
    apply_fresh(calc_target, calc_gen)


if __name__ == '__main__':
    main()
