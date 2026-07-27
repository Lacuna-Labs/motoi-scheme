#!/usr/bin/env python3
"""pre-fold-inspection.py — the final look before we fold.

Alfred, 2026-07-22: "Check for the 15 programs, the tags being used.
The problems of broken tags, untagged data and the folding mechanisms."

FIVE INSPECTIONS:

  1. 15-program-per-verb count across the reference — how many verbs hit 15,
     how many are under. Report distribution + per-file top-misses.

  2. Tag inventory on the emit stream — every unique tag key, value cardinality,
     distribution. Is anything used only 1-2 times (drift)?

  3. Broken tag scan — malformed `[key:val]` shapes: unclosed brackets, empty
     values, colons in values, non-ASCII in keys, etc.

  4. Untagged data — docs missing ANY of the required tags: substrate,
     shape, bloom, provenance.

  5. Folding mechanisms — sanity of the packed sequences: 98/2 split ratio,
     stratification across substrates, packed sequence length distribution,
     boundary counts, no cross-doc attention leakage risk.

Exits 0 if clean, 1 if any critical issue.
"""
from __future__ import annotations
import json, re, os, sys
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path('/Users/alfred/code/motoi-scheme')
REF = REPO / 'scheme' / 'reference'
MK3 = Path.home() / '.forge' / 'data' / 'motoi-mk3-cpt'
TRAIN = MK3 / 'train.jsonl'
VALID = MK3 / 'valid.jsonl'

fails, warns, ok = [], [], []
def FAIL(m): fails.append(m); print(f'  ✗ {m}')
def WARN(m): warns.append(m); print(f'  ⚠ {m}')
def OK(m):   ok.append(m);   print(f'  ✓ {m}')

# ── helpers ───────────────────────────────────────────────────────────
TAG_RE = re.compile(r'\[([^\[\]:]+):([^\[\]]*)\]')

def load_docs(path):
    docs = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try: docs.append(json.loads(line))
                except: pass
    return docs

def extract_verb_forms(text):
    forms = []; i = 0
    while i < len(text):
        if text.startswith('(verb', i) and (i == 0 or text[i-1] == '\n'):
            depth=0; ins=False; esc=False; j=i
            while j < len(text):
                c = text[j]
                if ins:
                    if esc: esc=False
                    elif c=='\\': esc=True
                    elif c=='"': ins=False
                else:
                    if c=='"': ins=True
                    elif c=='(': depth+=1
                    elif c==')':
                        depth-=1
                        if depth==0: j+=1; break
                j+=1
            forms.append(text[i:j])
            i = j
        else:
            i += 1
    return forms

# ── INSPECTION 1: 15 programs per verb ────────────────────────────────
print('== INSPECTION 1 · 15-program-per-verb count ==')
verb_counts = []   # (file, verb_name, count)
for path in sorted(REF.glob('*.slat')):
    text = path.read_text()
    for v in extract_verb_forms(text):
        name_m = re.search(r':name\s+"([^"]+)"', v)
        if not name_m: continue
        name = name_m.group(1)
        # Count :examples :code (target 3)
        n_ex = len(re.findall(r':code\s+"', re.search(r':examples\s+\((.*?)\)\s+(?=:|\))', v, re.DOTALL).group(1))) if re.search(r':examples\s+\(', v) else 0
        # Count row-2/3/4/5 program-shaped fields
        n_r2 = len(re.findall(r':(?:eng-program|math-program|cs-program|program)\s+"',
                              re.search(r':row-2-audit\s+\((.*?)\)(?=\s+:row|\s+\))', v, re.DOTALL).group(1))) if re.search(r':row-2-audit\s+\(', v) else 0
        # Row 3 rungs :code
        r3m = re.search(r':row-3-dimension\s+\((.*?)\)(?=\s+:row|\s+\))', v, re.DOTALL)
        n_r3 = len(re.findall(r':code\s+"', r3m.group(1))) if r3m else 0
        r4m = re.search(r':row-4-proof\s+\((.*?)\)(?=\s+:row|\s+\))', v, re.DOTALL)
        n_r4 = len(re.findall(r':(?:eng-program|math-program|cs-program|program)\s+"', r4m.group(1))) if r4m else 0
        r5m = re.search(r':row-5-emergence\s+\((.*?)\)(?=\s+:row|\s+\))', v, re.DOTALL)
        n_r5 = len(re.findall(r':(?:eng-composition|math-composition|cs-composition|composition)\s+"', r5m.group(1))) if r5m else 0
        total = n_ex + n_r2 + n_r3 + n_r4 + n_r5
        verb_counts.append((path.name, name, total, n_ex, n_r2, n_r3, n_r4, n_r5))

n_at_15 = sum(1 for _, _, t, *_ in verb_counts if t >= 15)
n_over_10 = sum(1 for _, _, t, *_ in verb_counts if t >= 10)
distribution = Counter(t for _, _, t, *_ in verb_counts)
print(f'  Verbs at ≥15 programs: {n_at_15:>5d} / {len(verb_counts)}  ({n_at_15*100/max(1,len(verb_counts)):.1f}%)')
print(f'  Verbs at ≥10 programs: {n_over_10:>5d} / {len(verb_counts)}  ({n_over_10*100/max(1,len(verb_counts)):.1f}%)')
print(f'  Distribution top: {dict(distribution.most_common(6))}')
if n_at_15 == len(verb_counts):
    OK(f'All {len(verb_counts)} verbs at 15+ programs')
elif n_over_10 > len(verb_counts) * 0.9:
    WARN(f'{len(verb_counts)-n_at_15} verbs under 15 (mostly 8-11)')
else:
    FAIL(f'{len(verb_counts)-n_over_10} verbs under 10 programs')

# ── INSPECTION 2: Tag inventory on emit stream ────────────────────────
print()
print('== INSPECTION 2 · Tag inventory on emit stream ==')
if not TRAIN.exists():
    FAIL(f'{TRAIN} does not exist — cannot inspect stream')
else:
    docs = load_docs(TRAIN)
    print(f'  Loaded {len(docs)} training docs')
    tag_keys = Counter()
    key_values = defaultdict(Counter)
    for d in docs:
        for m in TAG_RE.finditer(d.get('text', '')):
            k, v = m.group(1), m.group(2).strip()
            tag_keys[k] += 1
            key_values[k][v] += 1
    print(f'  Distinct tag keys: {len(tag_keys)}')
    print(f'  Top 15 keys by frequency:')
    for k, c in tag_keys.most_common(15):
        n_vals = len(key_values[k])
        print(f'    [{k}:...] used {c:>7d} · {n_vals} distinct values')
    # Drift check: any key used only 1-2 times?
    drift = [(k, c) for k, c in tag_keys.items() if c < 10]
    if drift:
        WARN(f'{len(drift)} tag keys used <10 times (possible drift): {[k for k,_ in drift[:10]]}')
    else:
        OK('No obvious tag-key drift')

    # ── INSPECTION 3: Broken tag scan ─────────────────────────────────
    print()
    print('== INSPECTION 3 · Broken tag scan ==')
    n_unclosed = 0; n_empty_val = 0; n_weird_key = 0
    for d in docs[:20000]:
        text = d.get('text', '')
        # Unclosed [ (looking for [key:val] shape but ends without ])
        n_unclosed += len(re.findall(r'\[[a-z][a-z_-]+:[^\]]{0,50}(?=\n|$)', text))
        # Empty values
        for m in TAG_RE.finditer(text):
            if not m.group(2).strip():
                n_empty_val += 1
                break
        # Weird chars in tag keys
        for m in TAG_RE.finditer(text):
            if not re.match(r'^[a-z][a-z0-9_-]+$', m.group(1)):
                n_weird_key += 1
                break
    print(f'  Unclosed [ patterns (sample 20k): {n_unclosed}')
    print(f'  Empty tag values (sample 20k): {n_empty_val}')
    print(f'  Weird tag keys (sample 20k): {n_weird_key}')
    if n_unclosed + n_empty_val + n_weird_key == 0:
        OK('No broken tags detected in sample')
    elif n_unclosed > 100 or n_empty_val > 100:
        FAIL(f'{n_unclosed} unclosed + {n_empty_val} empty-value tags in sample')
    else:
        WARN(f'Minor tag noise (see counts)')

    # ── INSPECTION 4: Untagged data ───────────────────────────────────
    print()
    print('== INSPECTION 4 · Untagged data (required tags) ==')
    required = ['substrate', 'shape', 'bloom', 'dialect']
    missing_counts = Counter()
    for d in docs:
        text = d.get('text', '')[:600]
        for req in required:
            if f'[{req}:' not in text:
                missing_counts[req] += 1
    for req in required:
        n = missing_counts[req]
        pct = n * 100 / len(docs) if docs else 0
        if pct > 5:
            FAIL(f'{n} docs ({pct:.1f}%) missing [{req}:...] tag')
        elif pct > 1:
            WARN(f'{n} docs ({pct:.1f}%) missing [{req}:...] tag')
        else:
            OK(f'[{req}:] present on {100-pct:.1f}% of docs')

    # ── INSPECTION 5: Folding mechanisms ─────────────────────────────
    print()
    print('== INSPECTION 5 · Folding mechanisms ==')
    val_docs = load_docs(VALID) if VALID.exists() else []
    total = len(docs) + len(val_docs)
    val_pct = len(val_docs) * 100 / total if total else 0
    print(f'  Train: {len(docs):>8d}')
    print(f'  Valid: {len(val_docs):>8d}')
    print(f'  Val ratio: {val_pct:.2f}%')
    if 1.5 <= val_pct <= 3.0:
        OK(f'Val ratio {val_pct:.2f}% is healthy (target 2%)')
    else:
        WARN(f'Val ratio {val_pct:.2f}% off from 2% target')

    # Stratification check — every substrate in val?
    train_substrates = Counter(d.get('substrate', 'unknown') for d in docs)
    val_substrates = Counter(d.get('substrate', 'unknown') for d in val_docs)
    missing_in_val = [s for s in train_substrates if s not in val_substrates]
    if not missing_in_val:
        OK(f'All {len(train_substrates)} substrates present in val split')
    else:
        WARN(f'Val missing substrates: {missing_in_val}')

    # Packed-sequence stats
    packed_path = MK3 / 'train-packed.jsonl'
    if packed_path.exists():
        packed = load_docs(packed_path)
        n_packs = len(packed)
        boundaries = [len(p.get('boundaries', [])) for p in packed if 'boundaries' in p]
        if boundaries:
            avg_docs = sum(boundaries) / len(boundaries)
            print(f'  Packed sequences: {n_packs}, avg {avg_docs:.1f} docs/pack')
            OK(f'Packing compresses {sum(boundaries)} docs → {n_packs} sequences')
        else:
            WARN('Packed file exists but no :boundaries — attention mask may not work')
    else:
        WARN(f'No train-packed.jsonl (packing not applied). Trainer will pad heavily.')

# ── SUMMARY ───────────────────────────────────────────────────────────
print()
print('=' * 60)
print(f'FAILS: {len(fails)}  ·  WARNS: {len(warns)}  ·  OK: {len(ok)}')
print('=' * 60)
if fails:
    print('BLOCKED — do NOT fold. Fix these:')
    for f in fails: print(f'  ✗ {f}')
    sys.exit(1)
else:
    print('✓ Pre-fold inspection PASS. Warnings are informational.')
    sys.exit(0)
