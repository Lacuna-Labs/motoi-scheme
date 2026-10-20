#!/usr/bin/env python3
"""Re-run fold rows against the CURRENT engine and compare to the answer they claim.

The reversal shards carry oracle_verified:true — but the oracle was the engine as
it stood when the row was generated. Every R7RS conformance fix since then can
turn a verified row into a wrong one. This re-runs the code and diffs.

Usage:
    python3 scratch/reverify-fold.py [fold-dir] [limit] [workers]

A limit of 0 means the whole fold. Results land in /tmp/fold-reverify.tsv.
"""
import json, glob, os, re, subprocess, sys, tempfile, threading
from concurrent.futures import ThreadPoolExecutor

FOLD = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    '~/fold-snapshots/2026-08-01T2250/fold')
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 0
WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 10
REPO = '/Users/alfred/code/motoi-scheme'

CLAIM = re.compile(r'(?:It evaluates to|returns|produces|result is)\s*`([^`]*)`', re.I)

env = dict(os.environ, MOTOI_HOME=tempfile.mkdtemp(prefix='reverify-'))


def run(code):
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False) as fh:
        fh.write(code)
        path = fh.name
    try:
        p = subprocess.run([f'{REPO}/bin/motoi', 'run', path],
                           capture_output=True, text=True, timeout=20, env=env, cwd=REPO)
        return p.returncode, (p.stdout or '').strip(), (p.stderr or '').strip()
    except subprocess.TimeoutExpired:
        return -1, '', 'TIMEOUT'
    finally:
        os.unlink(path)


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


rows = []
for f in sorted(glob.glob(os.path.join(FOLD, '*.jsonl'))):
    for line in open(f, errors='replace'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        if not d.get('code_blocks') or d.get('expected_outcome') != 'ok':
            continue
        m = CLAIM.search(d.get('response') or '')
        if not m:
            continue
        rows.append((os.path.basename(f), d.get('pair_id'), d['code_blocks'][0], m.group(1)))

if LIMIT:
    import random
    random.seed(20260802)
    random.shuffle(rows)
    rows = rows[:LIMIT]

lock = threading.Lock()
counts = {'MATCH': 0, 'MISMATCH': 0, 'ERROR': 0}
bad = []
done = 0
total = len(rows)


def check(row):
    global done
    f, pid, code, claim = row
    rc, out, err = run(code)
    if rc != 0:
        kind, actual = 'ERROR', err[:160]
    elif norm(out) == norm(claim) or norm(claim) in norm(out):
        kind, actual = 'MATCH', ''
    else:
        kind, actual = 'MISMATCH', out[:160]
    with lock:
        counts[kind] += 1
        if kind != 'MATCH':
            bad.append((kind, f, pid, code, claim, actual))
        done += 1
        if done % 2000 == 0:
            print(f'  ...{done}/{total}  match={counts["MATCH"]} '
                  f'mismatch={counts["MISMATCH"]} error={counts["ERROR"]}', flush=True)


with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    list(pool.map(check, rows))

print(f'\nrows with a checkable claim : {total}')
print(f'  MATCH    : {counts["MATCH"]}')
print(f'  MISMATCH : {counts["MISMATCH"]}')
print(f'  ERROR    : {counts["ERROR"]}')

with open('/tmp/fold-reverify.tsv', 'w') as fh:
    fh.write('kind\tfile\tpair_id\tcode\tclaimed\tactual\n')
    for r in bad:
        fh.write('\t'.join(str(x).replace('\t', ' ').replace('\n', '\\n') for x in r) + '\n')
print('full table : /tmp/fold-reverify.tsv')
