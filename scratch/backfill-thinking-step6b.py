#!/usr/bin/env python3
"""Step 6b back-write for graph-of-thinking.slat ONLY.

The other three axes had their Tier-1 :cross-axis-bridge-score / :context-entropy
/ :idf populated from training-data/cpt-mk2/tier1-enrichment.json (the artifact
ppmi_enrich.py computes). Thinking's were left at the placeholder 0 / 0.0 marked
';; populated by Step 6b'. This folds the REAL computed values in — no fabrication,
just the numbers ppmi_enrich already produced.

Association-by-document-order: each placeholder line belongs to the Tier-1 node
whose most-recent :canonical precedes it. Verifies 300 substitutions per field,
node count unchanged, and re-parse clean is done by the caller.

Usage: python3 scratch/backfill-thinking-step6b.py [--write]
"""
import json, re, sys
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
GRAPH = REPO / 'graphs' / 'graph-of-thinking.slat'
JSON = REPO / 'training-data' / 'cpt-mk2' / 'tier1-enrichment.json'
WRITE = '--write' in sys.argv

enr = json.load(open(JSON))
th = {k: v for k, v in enr.items() if v.get('axis') == 'thinking'}

lines = GRAPH.read_text().splitlines(keepends=False)
canon_re = re.compile(r':canonical\s+"([^"]+)"')
cur = None
miss = []
sub = {'bridge': 0, 'entropy': 0, 'idf': 0}
out = []
for ln in lines:
    m = canon_re.search(ln)
    if m:
        cur = m.group(1)
    v = th.get(cur) if cur else None
    if ':cross-axis-bridge-score' in ln:
        if v is None:
            miss.append(('bridge', cur))
            out.append(ln); continue
        indent = ln[:len(ln) - len(ln.lstrip())]
        out.append(f'{indent}:cross-axis-bridge-score {v["cross_axis_bridge_score"]}')
        sub['bridge'] += 1; continue
    if ':context-entropy' in ln:
        if v is None:
            miss.append(('entropy', cur))
            out.append(ln); continue
        indent = ln[:len(ln) - len(ln.lstrip())]
        out.append(f'{indent}:context-entropy       {v["context_entropy"]}')
        sub['entropy'] += 1; continue
    if re.match(r'\s*:idf\s+', ln):
        if v is None:
            out.append(ln); continue
        indent = ln[:len(ln) - len(ln.lstrip())]
        out.append(f'{indent}:idf                   {v["idf"]}')
        sub['idf'] += 1; continue
    out.append(ln)

print(f'substitutions: bridge={sub["bridge"]} entropy={sub["entropy"]} idf={sub["idf"]}')
print(f'canonicals with no JSON entry (skipped, left as-is): {len(miss)}')
if miss[:5]:
    print('  e.g.', miss[:5])
new = '\n'.join(out) + '\n'
if WRITE:
    GRAPH.write_text(new)
    print('WROTE', GRAPH)
else:
    print('DRY-RUN — pass --write to apply')
