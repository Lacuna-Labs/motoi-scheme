#!/usr/bin/env python3
"""corpus-preflight.py — validate a Forge JSONL corpus BEFORE firing training.

Catches the failure modes that killed the first Mk 1 fire on 2026-07-19:
  · empty pair content (`grad] Must specify at least one argument`)
  · pair length exceeding max_seq_length (silently truncates → empty batch)
  · malformed JSON
  · missing messages array
  · short content (< 5 chars) that carries no signal

Usage:
    python3 corpus-preflight.py <corpus-dir> [--max-chars 12000]

Exits non-zero if any critical issue found. If clean, prints a "cleared to fire"
summary that the run book can quote in its pre-fire tick-card.

Add this to the runbook as Step 3.5 (post-fold, pre-fire).
"""
import argparse, json, os, sys

def check_file(path, max_chars):
    stats = {'total': 0, 'ok': 0, 'empty': [], 'malformed': [], 'huge': [], 'short': []}
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            stats['total'] += 1
            try:
                d = json.loads(line)
            except:
                stats['malformed'].append(lineno)
                continue
            msgs = d.get('messages') or []
            if len(msgs) < 2:
                stats['empty'].append(lineno); continue
            u = (msgs[0].get('content') or '').strip()
            a = (msgs[1].get('content') or '').strip()
            if not u or not a:
                stats['empty'].append(lineno); continue
            if len(u) < 3 or len(a) < 5:
                stats['short'].append(lineno); continue
            if len(u) + len(a) > max_chars:
                stats['huge'].append(lineno); continue
            stats['ok'] += 1
    return stats

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('corpus_dir')
    ap.add_argument('--max-chars', type=int, default=12000,
                    help='max user+assistant char length (default 12000 ≈ 3000 tokens)')
    args = ap.parse_args()

    if not os.path.isdir(args.corpus_dir):
        print(f"ERROR: {args.corpus_dir} not a directory"); sys.exit(2)

    critical_fail = False
    for name in ['train.jsonl', 'valid.jsonl', 'heldout.jsonl']:
        p = os.path.join(args.corpus_dir, name)
        if not os.path.exists(p):
            print(f"MISSING: {name}"); critical_fail = True; continue
        s = check_file(p, args.max_chars)
        pct = 100 * s['ok'] / s['total'] if s['total'] else 0
        print(f"\n{name}: {s['total']} rows")
        print(f"  ok:        {s['ok']} ({pct:.1f}%)")
        for k in ['empty', 'malformed', 'huge', 'short']:
            n = len(s[k])
            if n > 0:
                sample = s[k][:5]
                print(f"  {k:10s} {n} (lines {sample}{'…' if n>5 else ''})")
        if s['empty'] or s['malformed']:
            critical_fail = True
        if len(s['huge']) > s['total'] * 0.01:  # >1% huge is a problem
            print(f"  ⚠ {len(s['huge'])} huge pairs will silently truncate → training may crash")
            critical_fail = True

    print()
    if critical_fail:
        print("✗ PREFLIGHT FAIL — corpus has issues that will crash training.")
        print("  Fix: re-run scripts/fold-training-corpus.py with a length filter,")
        print("       or manually drop the offending lines.")
        sys.exit(1)
    else:
        print("✓ PREFLIGHT PASS — corpus cleared to fire.")
        sys.exit(0)

if __name__ == '__main__':
    main()
