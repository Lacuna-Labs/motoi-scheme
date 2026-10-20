#!/usr/bin/env python3
"""abel-run.py — run a batch of candidate snippets and print exact output.

Input: a file of snippets separated by a line containing only `%%` and
optionally preceded by a `#name` line. Prints name -> exact stdout+stderr,
with newlines shown as `|`, so an authored :note can be checked byte-for-byte.

Also usable as: abel-run.py --chapter <file.slat>  to run EVERY code field
including the row-5 :eng-composition / :math-composition / :cs-composition
fields, which the shipped verify-reference-records.py does not cover.
"""
import os, re, sys, subprocess
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI = f'{ROOT}/bin/motoi'
FIELDS = ('code', 'program', 'eng-program', 'math-program', 'cs-program',
          'composition', 'eng-composition', 'math-composition', 'cs-composition')


def run(idx_code):
    idx, name, code = idx_code
    tmp = f'/tmp/abel-{idx}.sks'
    with open(tmp, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI, 'run', tmp], capture_output=True, timeout=20,
                           cwd=ROOT, text=True)
        out = (r.stdout + r.stderr).strip()
        ok = r.returncode == 0 and not re.search(r'^\s*error:', out, re.M)
    except Exception as e:
        ok, out = False, f'<exception {e}>'
    finally:
        try: os.unlink(tmp)
        except OSError: pass
    return name, ok, out


def unescape(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(s[i+1], '\\' + s[i+1]))
            i += 2
        else:
            out.append(c); i += 1
    return ''.join(out)


def extract_records(text, tag='(verb'):
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i-1] == '\n') and text.startswith(tag, i):
            start, depth, in_str, esc, j = i, 0, False, False, i
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
                            j += 1; break
                j += 1
            records.append(text[start:j]); i = j
        else:
            i += 1
    return records


def main():
    jobs = []
    if sys.argv[1] == '--chapter':
        only = sys.argv[3] if len(sys.argv) > 3 else None
        text = open(sys.argv[2]).read()
        for rec in extract_records(text):
            m = re.search(r':name\s+"([^"]+)"', rec)
            nm = m.group(1) if m else '<unnamed>'
            if only and nm != only:
                continue
            for field in FIELDS:
                for mm in re.finditer(rf':{field}\s+"((?:[^"\\]|\\.)*)"', rec):
                    code = unescape(mm.group(1)).strip()
                    if code:
                        jobs.append((len(jobs), f'{nm}:{field}', code))
    else:
        blocks = open(sys.argv[1]).read().split('\n%%\n')
        for b in blocks:
            b = b.strip()
            if not b:
                continue
            name = 'snippet'
            if b.startswith('#'):
                name, _, b = b.partition('\n')
                name = name[1:].strip()
            jobs.append((len(jobs), name, b.strip()))

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run, jobs))
    bad = 0
    for name, ok, out in results:
        flag = 'OK  ' if ok else 'FAIL'
        if not ok: bad += 1
        print(f'{flag} {name} -> {out}'.replace('\n', ' | '))
    print(f'--- {len(results)} run, {bad} failing')
    return bad


if __name__ == '__main__':
    sys.exit(min(main(), 250))
