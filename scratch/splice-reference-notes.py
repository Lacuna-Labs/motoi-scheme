#!/usr/bin/env python3
"""splice-reference-notes.py — rewrite a stale claimed value in a reference note.

verify-reference-notes.py reports that a note's leading literal disagrees with
what the snippet actually prints. After the exactness tower landed (2026-08-03)
most of those disagreements are the REFERENCE being stale, not the engine: the
notes were written when `(exp 0)` printed `1` and it now prints `1.0`.

This replaces ONLY the leading literal. The prose after it is left alone, and
any record whose prose still quotes the old value is reported rather than
edited — a sentence needs a human, a literal does not.

Reads the JSONL that verify-reference-notes.py writes under NOTE_JSONL.

    python3 scratch/splice-reference-notes.py /tmp/ref2.jsonl          # dry run
    python3 scratch/splice-reference-notes.py /tmp/ref2.jsonl --write
"""

import json, os, re, sys

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'

# Records whose output is environment-dependent — a wall clock, a model reply,
# a feature list, the last error. Their notes are not claims about a value.
NONDET = ('02-ai.slat', '26-exception.slat', '66-time.slat', '34-input.slat',
          '00e-standard-library.slat', '01-core.slat:features',
          '01-core.slat:inspect')

# Records where the PROSE, not just the literal, describes behaviour the engine
# no longer has — five that teach the n-ary comparison bug, two that teach the
# ignored `log` base and the leaked Values object, and three whose sentences
# explain why an integer-valued double printed without its `.0`. A splice would
# leave the note contradicting itself, so these are hand-authored.
HAND = {
    ('40-math.slat', '(motoi-3arg'), ('40-math.slat', '(two-arg-IGNORES-BASE'),
    ('40-math.slat', '(WRONG-display'), ('40-math.slat', '(hex 0xff'),
}
HAND_CODE = {'(inexact 1)', '(truncate 3.7)', '(truncate -3.7)'}


def escape(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')


def unescape(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(s[i + 1], '\\' + s[i + 1]))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


EXAMPLE_RE = re.compile(r'(:code\s+")((?:[^"\\]|\\.)*)("\s*:note\s+")((?:[^"\\]|\\.)*)(")')


def main():
    src = sys.argv[1]
    write = '--write' in sys.argv
    rows = [json.loads(l) for l in open(src)]

    by_file = {}
    for r in rows:
        if any(k in r['name'] for k in NONDET):
            continue
        by_file.setdefault(r['name'].split(':')[0], []).append(r)

    spliced = prose_flag = notfound = 0
    for fname, rs in sorted(by_file.items()):
        path = f'{REF_DIR}/{fname}'
        text = open(path).read()
        for r in rs:
            code, claimed, actual = r['code'], r['claimed'], r['actual'].rstrip('\n')
            if code in HAND_CODE or any(fname == f and claimed.startswith(p) for f, p in HAND):
                print(f'[HAND-AUTHOR] {r["name"]}  ({claimed[:50]})')
                continue

            hit = None
            for m in EXAMPLE_RE.finditer(text):
                if unescape(m.group(2)) == code:
                    hit = m
                    break
            if hit is None:
                print(f'[NOT FOUND] {r["name"]}')
                notfound += 1
                continue

            note = unescape(hit.group(4))
            if not note.startswith(claimed):
                print(f'[NOT AT HEAD] {r["name"]}\n    note: {note[:90]}')
                notfound += 1
                continue

            rest = note[len(claimed):]
            new_note = actual + rest
            # The prose may repeat the value it just corrected. A literal splice
            # cannot fix a sentence, so say so and leave the record for a human.
            if claimed in rest:
                print(f'[PROSE STILL CITES OLD VALUE] {r["name"]}\n    {rest[:140]}')
                prose_flag += 1

            text = text[:hit.start(4)] + escape(new_note) + text[hit.end(4):]
            spliced += 1
            print(f'[SPLICE] {r["name"]}\n    was: {claimed[:90]}\n    now: {actual[:90]}')

        if write:
            open(path, 'w').write(text)

    print(f'\nspliced {spliced} · prose-flagged {prose_flag} · unmatched {notfound}'
          f' · {"WRITTEN" if write else "DRY RUN"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
