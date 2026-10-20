#!/usr/bin/env python3
"""roundtrip.py — re-extract every program from the SAVED 01-core.slat and re-run it.

Proves escaping survived the write. Runs each program TWICE and fails on any
difference, so a non-deterministic example (a printed raw random draw) cannot
land in the chapter.

Read-only on the reference. Writes nothing outside stdout.
"""
import re, os, subprocess, sys

REPO = '/Users/alfred/code/motoi-scheme'
SLAT = os.path.join(REPO, 'scheme/reference/01-core.slat')
MOTOI = os.path.join(REPO, 'bin', 'motoi')
TMP = '/tmp/bezier-roundtrip.scm'
TARGETS = {'make-random-source', 'random-integer', 'random-real',
           'random-source-randomize!'}

CODE_KEYS = ('code', 'program', 'eng-program', 'math-program', 'cs-program',
             'composition', 'eng-composition', 'math-composition', 'cs-composition')


def records(text, tag='(verb'):
    out, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
            depth, in_str, esc, j = 0, False, False, i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            out.append(text[i:j])
            i = j
        else:
            i += 1
    return out


def unescape(s):
    o, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            nxt = s[i + 1]
            o.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, nxt))
            i += 2
        else:
            o.append(c)
            i += 1
    return ''.join(o)


def code_strings(rec):
    """Every :<code-key> "…" value in a record, in source order."""
    found = []
    pat = re.compile(r':(' + '|'.join(CODE_KEYS) + r')\s+"((?:[^"\\]|\\.)*)"')
    for m in pat.finditer(rec):
        found.append((m.group(1), unescape(m.group(2))))
    return found


def run(src):
    with open(TMP, 'w') as f:
        f.write(src)
    r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, text=True, cwd=REPO)
    return r.returncode, r.stdout, r.stderr


def main():
    text = open(SLAT).read()
    recs = [r for r in records(text)
            if re.search(r':name\s+"([^"]+)"', r)
            and re.search(r':name\s+"([^"]+)"', r).group(1) in TARGETS]
    names = [re.search(r':name\s+"([^"]+)"', r).group(1) for r in recs]
    print('found %d target records in the SAVED slat: %s' % (len(recs), names))
    if len(recs) != 4:
        print('EXPECTED 4 RECORDS'); sys.exit(1)

    total, bad = 0, []
    for rec, name in zip(recs, names):
        progs = code_strings(rec)
        print('\n%s — %d programs' % (name, len(progs)))
        for idx, (key, src) in enumerate(progs):
            total += 1
            c1, o1, e1 = run(src)
            c2, o2, _ = run(src)
            label = '%s[%d]:%s' % (name, idx, key)
            if c1 != 0:
                bad.append((label, 'EXIT %d' % c1, (e1 or o1).strip()[:200]))
                print('  FAIL %-34s %s' % (key, (e1 or o1).strip()[:90]))
            elif o1 != o2:
                bad.append((label, 'NONDETERMINISTIC', repr(o1)[:120]))
                print('  FLAKY %-33s' % key)
            else:
                print('  ok   %-34s %s' % (key, o1.strip().replace('\n', ' | ')[:95]))

    print('\n%d programs extracted from disk and re-run twice each.' % total)
    if bad:
        print('FAILURES (%d):' % len(bad))
        for b in bad:
            print('  %s  %s  %s' % b)
        sys.exit(1)
    print('ALL GREEN — every program runs and is deterministic after round trip.')


if __name__ == '__main__':
    main()
