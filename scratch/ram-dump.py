#!/usr/bin/env python3
"""ram-dump.py — dump one book block, standalone or chapter-scoped.

Usage: python3 scratch/ram-dump.py <file.slatl> <block-index> [--scoped] [-o OUT]
block-index is the numeric suffix of the audit's key (scheme-block-N).
"""
import sys, importlib.util
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('av2', str(REPO / 'scratch' / 'audit-books-v2.py'))
av2 = importlib.util.module_from_spec(_s); _s.loader.exec_module(av2)

path = Path(sys.argv[1]).resolve()
n = int(sys.argv[2])
scoped = '--scoped' in sys.argv
out = None
if '-o' in sys.argv:
    out = sys.argv[sys.argv.index('-o') + 1]
rel = str(path.relative_to(REPO / 'scheme-books'))
blocks = [p for p in av2.extract_prose_blocks() if p['file'] == rel]
idx = {int(b['key'].rsplit('-', 1)[1]): i for i, b in enumerate(blocks)}
i = idx[n]
code = '\n'.join(b['code'] for b in blocks[:i + 1]) if scoped else blocks[i]['code']
if out:
    Path(out).write_text(code)
    print(f'wrote {out} ({len(code)} chars, {i} prefix blocks)')
else:
    print(code)
