#!/usr/bin/env python3
"""audit-reference-impl-parity.py

Every verb NAMED in scheme/reference/*.slat must respond to `motoi run`
without an "unbound symbol" error. Fails loud if drift returns.

Doctrine: Never claim a verb is wired without running this. Grep is not
evidence. See memory/feedback-verb-wired-means-motoi-run-passes.md.

Exit codes:
  0 — every reference verb is wired
  1 — one or more verbs missing (details printed)

Emit-time:
  Writes _status/reference-impl-parity-<date>.md with the per-namespace
  wired/unwired breakdown.
"""
import os, re, subprocess, glob, sys, datetime

REF = '/Users/alfred/code/motoi-scheme/scheme/reference'
MOTOI = '/Users/alfred/code/motoi-scheme/bin/motoi'
TMP = '/tmp/motoi-parity-probe.scm'
OUT_DIR = '/Users/alfred/code/motoi-scheme/_status'

def collect_verbs():
    verbs = set()
    for path in sorted(glob.glob(os.path.join(REF, '[0-9][0-9]*.slat'))):
        text = open(path).read()
        for m in re.finditer(r'\(verb\s+:name\s+"([^"]+)"', text):
            verbs.add((os.path.basename(path), m.group(1)))
    return verbs

def is_wired(sym):
    with open(TMP, 'w') as f: f.write(sym + '\n')
    r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, timeout=4, text=True,
                       cwd='/Users/alfred/code/motoi-scheme')
    out = (r.stdout or '') + (r.stderr or '')
    return 'unbound symbol' not in out

def main():
    verbs = collect_verbs()
    wired, unwired = [], []
    for fn, v in sorted(verbs):
        if is_wired(v): wired.append((fn, v))
        else: unwired.append((fn, v))

    total = len(verbs)
    pct = 100 * len(wired) / total if total else 0

    from collections import Counter
    ns_unwired = Counter()
    for _, v in unwired:
        ns = v.split('/')[0] if '/' in v else '(no-ns)'
        ns_unwired[ns] += 1

    os.makedirs(OUT_DIR, exist_ok=True)
    date = datetime.date.today().isoformat()
    out_path = os.path.join(OUT_DIR, f'reference-impl-parity-{date}.md')
    with open(out_path, 'w') as f:
        f.write(f'# Motoi Reference / Impl Parity — {date}\n\n')
        f.write(f'Verbs named in reference: **{total}**\n')
        f.write(f'Wired at runtime: **{len(wired)}** ({pct:.1f}%)\n')
        f.write(f'Unwired: **{len(unwired)}** ({100-pct:.1f}%)\n\n')
        f.write(f'## Unwired by namespace\n\n')
        for ns, ct in ns_unwired.most_common():
            f.write(f'- **{ct:3d}** `{ns}/*`\n')
        f.write(f'\n## Unwired verbs (full list)\n\n')
        for fn, v in unwired:
            f.write(f'- `{v}` ({fn})\n')

    print(f'Reference verbs: {total}')
    print(f'Wired: {len(wired)} ({pct:.1f}%)')
    print(f'Unwired: {len(unwired)}')
    print(f'Report: {out_path}')

    if unwired:
        print(f'\nFAIL — {len(unwired)} reference verbs are unwired at runtime.')
        sys.exit(1)
    print('\nOK — every reference verb is wired.')
    sys.exit(0)

if __name__ == '__main__':
    main()
