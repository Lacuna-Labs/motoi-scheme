#!/usr/bin/env python3
"""ram-blocks.py — emit one book file's fenced blocks as JSON, in order.

Usage: python3 scratch/ram-blocks.py <file.slatl> <out.json>
"""
import json, sys, importlib.util
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('av2', str(REPO / 'scratch' / 'audit-books-v2.py'))
av2 = importlib.util.module_from_spec(_s); _s.loader.exec_module(av2)

path = Path(sys.argv[1]).resolve()
rel = str(path.relative_to(REPO / 'scheme-books'))
blocks = [{'key': p['key'], 'code': p['code']}
          for p in av2.extract_prose_blocks() if p['file'] == rel]
Path(sys.argv[2]).write_text(json.dumps(blocks, indent=1))
print(f'{len(blocks)} blocks -> {sys.argv[2]}')
