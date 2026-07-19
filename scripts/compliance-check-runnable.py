#!/usr/bin/env python3
"""compliance-check-runnable.py

Compliance pass on the reference: every :program, :composition, and :code
block should RUN through ./bin/motoi. If it doesn't, we log it — with
enough context that a fix has intent (verb name, row, what the claim is).

Alfred: "somebody after the compliance check run this code. If it don't
run, make it run and make sure it's compliant, and that's it."

Do NOT auto-fix. Report only. Fixes require intent, and intent requires
knowing what the code was supposed to do.

Writes: _status/compliance-check-2026-07-19.md
"""

import os, re, sys, subprocess, json
from collections import defaultdict

REF_DIR = '/Users/alfred/code/motoi-scheme/Scheme/reference'
MOTOI_BIN = '/Users/alfred/code/motoi-scheme/bin/motoi'
OUT = '/Users/alfred/code/motoi-scheme/_status/compliance-check-2026-07-19.md'
TMPFILE = '/tmp/motoi-compliance-check.scm'

def extract_records(text, tag='(verb'):
    records = []; i = 0; n = len(text)
    while i < n:
        if (i == 0 or text[i-1] == '\n') and text.startswith(tag, i):
            start = i; depth = 0; in_str = False; esc = False; j = i
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
                        if depth == 0: j += 1; break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records

def verb_name(rec):
    m = re.search(r':name\s+"([^"]+)"', rec)
    return m.group(1) if m else '<unnamed>'

def get_str_at(rec, key):
    """Grab a string field where the value is a double-quoted scheme snippet."""
    p = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', rec)
    return p.group(1) if p else None

def unescape(s):
    if s is None: return None
    return s.replace(r'\n', '\n').replace(r'\"', '"').replace('\\\\', '\\')

def run_snippet(code, timeout=8):
    """Run a Scheme snippet via ./bin/motoi run. Return (ok, output_or_err)."""
    with open(TMPFILE, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run(
            [MOTOI_BIN, 'run', TMPFILE],
            capture_output=True, timeout=timeout,
            cwd='/Users/alfred/code/motoi-scheme',
            text=True
        )
        return (r.returncode == 0, r.stdout + r.stderr)
    except subprocess.TimeoutExpired:
        return (False, '<timeout>')
    except Exception as e:
        return (False, f'<exception: {e}>')

failures = []  # (file, verb, row, field, code, err)
passes = 0
total = 0
skipped_marked = 0  # marked :runs "spec-only"

for fname in sorted(os.listdir(REF_DIR)):
    if not fname.endswith('.slat'): continue
    if fname.startswith('00-') or fname.startswith('99-') or fname == 'MANIFEST.slat':
        continue
    with open(f'{REF_DIR}/{fname}') as f:
        text = f.read()
    records = extract_records(text, '(verb')
    for rec in records:
        vn = verb_name(rec)
        # for each row, grab :program (and other code fields)
        for row_key in ['row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence']:
            # find the row body
            idx = rec.find(f':{row_key}')
            if idx < 0: continue
            # find balanced-paren body
            j = idx + len(f':{row_key}')
            while j < len(rec) and rec[j] in ' \t\n': j += 1
            if j >= len(rec) or rec[j] != '(': continue
            start = j; depth = 0; in_str = False; esc = False
            while j < len(rec):
                c = rec[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0: break
                j += 1
            row_body = rec[start:j+1] if j < len(rec) else rec[start:]

            # check for spec-only marker
            if ':runs "spec-only"' in row_body or ':runs \'spec-only' in row_body:
                skipped_marked += 1
                continue

            # extract candidate code fields
            for field in ['program', 'composition', 'code']:
                for m in re.finditer(rf':{field}\s+"((?:[^"\\]|\\.)*)"', row_body):
                    total += 1
                    code = unescape(m.group(1))
                    ok, out = run_snippet(code)
                    if ok:
                        passes += 1
                    else:
                        failures.append((fname, vn, row_key, field, code[:400], out[:500]))

# report
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write('# Motoi Reference Compliance Check — code runnability\n\n')
    f.write(f'Total code blocks checked: {total}\n')
    f.write(f'Passes: {passes}\n')
    f.write(f'Failures: {len(failures)}\n')
    f.write(f'Skipped (marked :runs "spec-only"): {skipped_marked}\n\n')

    if total > 0:
        pct = 100.0 * passes / total
        f.write(f'Pass rate: {pct:.1f}%\n\n')

    if failures:
        f.write('## Failures — grouped by verb\n\n')
        by_verb = defaultdict(list)
        for entry in failures:
            fn, vn, rk, fld, code, err = entry
            by_verb[(fn, vn)].append((rk, fld, code, err))

        for (fn, vn), entries in sorted(by_verb.items())[:200]:
            f.write(f'\n### `{vn}` — file `{fn}`\n\n')
            for rk, fld, code, err in entries:
                f.write(f'- **{rk}** :{fld}\n')
                f.write(f'  ```scheme\n  {code[:300]}\n  ```\n')
                f.write(f'  Error:\n  ```\n  {err[:300]}\n  ```\n')

        if len(by_verb) > 200:
            f.write(f'\n... and {len(by_verb) - 200} more verbs with failures.\n')

    f.write('\n## Verdict\n\n')
    if total == 0:
        f.write('~ NO CODE FOUND. Authoring may not have added `:program`/`:composition` fields yet.\n')
    elif passes == total:
        f.write('✓ ALL CODE RUNS. Compliance pass. Ready for training-data fold.\n')
    else:
        f.write(f'✗ {len(failures)} FAILURES. Fix pass required before fold. See per-verb section above for intent (verb name + row + field).\n')

print(f"compliance report: {OUT}")
print(f"pass rate: {passes}/{total} ({100.0*passes/total if total else 0:.1f}%)")
print(f"failures: {len(failures)}")
