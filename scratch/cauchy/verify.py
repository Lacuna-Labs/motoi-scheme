#!/usr/bin/env python3
"""Cauchy's scoped verifier for scheme/reference/32-hash.slat.

Extracts every runnable program field from the named verb records and runs
each one through ./bin/motoi. Round-trip proof: reads the SAVED .slat, so
escaping errors show up as failures.
"""
import os, re, sys, subprocess, tempfile

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI = os.path.join(ROOT, 'bin', 'motoi')

TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'scheme/reference/32-hash.slat')
ONLY = set(sys.argv[2:]) if len(sys.argv) > 2 else None


def extract_records(text, tag='(verb'):
    records, i, n = [], 0, len(text)
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
            records.append(text[i:j])
            i = j
        else:
            i += 1
    return records


STR = r'"((?:[^"\\]|\\.)*)"'
FIELDS = ['code', 'eng-program', 'math-program', 'cs-program', 'program',
          'eng-composition', 'math-composition', 'cs-composition', 'composition']


def unescape(s):
    out, i = [], 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            nxt = s[i + 1]
            out.append({'n': '\n', 't': '\t', '"': '"', '\\': '\\'}.get(nxt, '\\' + nxt))
            i += 2
        else:
            out.append(s[i]); i += 1
    return ''.join(out)


def programs(rec):
    """Every runnable snippet, in file order, with its field name."""
    found = []
    for f in FIELDS:
        for m in re.finditer(rf':{re.escape(f)}\s+{STR}', rec):
            found.append((m.start(), f, unescape(m.group(1))))
    found.sort()
    return [(f, p) for _, f, p in found]


def run(prog):
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False, dir='/tmp') as fh:
        fh.write(prog + '\n')
        path = fh.name
    try:
        r = subprocess.run([MOTOI, 'run', path], capture_output=True, text=True, timeout=30)
        out = (r.stdout or '') + (r.stderr or '')
        ok = r.returncode == 0 and not re.search(r'(^|\n)\s*error:', out)
        return ok, out.strip()
    except subprocess.TimeoutExpired:
        return False, 'TIMEOUT'
    finally:
        os.unlink(path)


def main():
    text = open(TARGET).read()
    recs = extract_records(text)
    total = passed = 0
    failures = []
    for rec in recs:
        name = (re.search(r':name\s+"([^"]+)"', rec) or [None, '<?>'])[1]
        if ONLY and name not in ONLY:
            continue
        n_ok = n = 0
        for field, prog in programs(rec):
            n += 1; total += 1
            ok, out = run(prog)
            if ok:
                n_ok += 1; passed += 1
            else:
                failures.append((name, field, prog, out))
        print(f'{"OK " if n_ok == n else "FAIL"} {name}: {n_ok}/{n}')
    print(f'\nTOTAL {passed}/{total} programs pass')
    for name, field, prog, out in failures:
        print(f'\n--- FAIL {name} :{field}\n{prog}\n>>> {out}')
    return 0 if passed == total else 1


sys.exit(main())
