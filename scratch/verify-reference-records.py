#!/usr/bin/env python3
"""verify-reference-records.py — run every runnable snippet in a reference chapter.

The gate for authoring reference records. An authored example is a CLAIM about
the language; this executes the claim. Nothing may be asserted from memory.

Usage:
    python3 scratch/verify-reference-records.py                    # all chapters
    python3 scratch/verify-reference-records.py 60-string.slat     # named chapters
    python3 scratch/verify-reference-records.py --verb substring   # one verb, any chapter

Exit code is the number of failing snippets, capped at 250, so it can gate a
commit. Reports only — it never edits a chapter.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'
MOTOI_BIN = f'{ROOT}/bin/motoi'
DUMP = os.environ.get('REF_DUMP', '/tmp/ref-failures.tsv')

# Snippets that call cortex/* WRITE to the user store, which persists across
# processes (~/motoi/cortex.slat). Unset, this harness both polluted Alfred's
# real cortex and produced phantom failures: a later snippet would read keys an
# earlier one wrote and blow up on their shape. MOTOI_HOME redirects the whole
# user tree, so each run starts from an empty store and is order-independent.
SANDBOX_HOME = tempfile.mkdtemp(prefix='motoi-verify-home-')
CHILD_ENV = {**os.environ, 'MOTOI_HOME': SANDBOX_HOME}

# Every field whose value is a runnable Scheme program. `:setup` is deliberately
# absent — it holds a prose statement of the problem, not code.
CODE_FIELDS = ('code', 'program', 'eng-program', 'math-program', 'cs-program',
               'composition', 'eng-composition', 'math-composition',
               'cs-composition')


def extract_records(text, tag='(verb'):
    """Balanced-paren record slicer that respects string literals."""
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
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
                            j += 1
                            break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records


def unescape(s):
    # Single pass. Sequential .replace() calls corrupt a literal backslash-n.
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i + 1]
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, '\\' + nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def snippets(rec):
    """Every (field, code) pair in a record, in source order."""
    out = []
    for field in CODE_FIELDS:
        for m in re.finditer(rf':{field}\s+"((?:[^"\\]|\\.)*)"', rec):
            code = unescape(m.group(1)).strip()
            if code:
                out.append((field, code))
    return out


def run_snippet(args):
    idx, name, field, code = args
    # Per-process path. This was a fixed /tmp name, so two concurrent runs
    # clobbered each other's snippet files and reported phantom ENOENT
    # failures — which is how a chapter's baseline got quoted as 27 when it
    # was 1. Agents run this in parallel; the temp file has to be private.
    tmp = os.path.join(SANDBOX_HOME, f'verify-{idx}.scm')
    with open(tmp, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True, env=CHILD_ENV)
        out = r.stdout + r.stderr
        ok = r.returncode == 0 and not re.search(r'^\s*error:', out, re.M)
    except subprocess.TimeoutExpired:
        ok, out = False, '<timeout>'
    except Exception as e:
        ok, out = False, f'<exception: {e}>'
    finally:
        try: os.unlink(tmp)
        except OSError: pass
    return (name, field, code, ok, out.strip())


def main():
    argv = [a for a in sys.argv[1:]]
    only_verb = None
    if '--verb' in argv:
        k = argv.index('--verb')
        only_verb = argv[k + 1]
        del argv[k:k + 2]

    files = ([f'{REF_DIR}/{a}' if not a.startswith('/') else a for a in argv]
             if argv else
             [f'{REF_DIR}/{f}' for f in sorted(os.listdir(REF_DIR))
              if f.endswith('.slat') and f != 'MANIFEST.slat'])

    jobs = []
    for path in files:
        if not os.path.exists(path):
            print(f'!! no such chapter: {path}')
            continue
        with open(path) as f:
            text = f.read()
        for rec in extract_records(text):
            m = re.search(r':name\s+"([^"]+)"', rec)
            name = m.group(1) if m else '<unnamed>'
            if only_verb and name != only_verb:
                continue
            for field, code in snippets(rec):
                jobs.append((len(jobs), f'{os.path.basename(path)}:{name}', field, code))

    if not jobs:
        print('no snippets matched.')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_snippet, jobs))

    fails = [r for r in results if not r[3]]
    with open(DUMP, 'w') as f:
        for name, field, code, _, out in fails:
            first_out = out.splitlines()[0] if out else ''
            f.write(f'{name}\t{field}\t{first_out}\t{code[:200]!r}\n')
    print(f'snippets executed : {len(results)}')
    print(f'passing           : {len(results) - len(fails)}')
    print(f'FAILING           : {len(fails)}')
    print(f'full list         : {DUMP}')
    for name, field, code, _, out in fails[:40]:
        first = code.splitlines()[0][:88]
        print(f'\n--- {name}  [:{field}]\n    {first}\n    -> {out.splitlines()[0][:150] if out else "(no output)"}')
    if len(fails) > 40:
        print(f'\n... and {len(fails) - 40} more')
    return min(len(fails), 250)


if __name__ == '__main__':
    sys.exit(main())
