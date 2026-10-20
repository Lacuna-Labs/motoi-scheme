#!/usr/bin/env python3
"""witt-show.py <file-substring> [idx ...] — dump extracted blocks by index."""
import re, sys
from pathlib import Path
REPO = Path('/Users/alfred/code/motoi-scheme'); BOOKS = REPO / 'scheme-books'
sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_s = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_s); _s.loader.exec_module(aref)
PROMPT_RE = re.compile(r'^\s*(sakura>|motoi>|>>>|\$ )', re.M)
FENCE_RE = re.compile(r'```(scheme|motoi)\n(.*?)```', re.S)
PROSE_KEY_RE = re.compile(r':prose\s+"')

def blocks(filt):
    out = []
    for path in sorted(BOOKS.rglob('*.slatl')) + sorted(BOOKS.rglob('*.slat')):
        rel = str(path.relative_to(BOOKS))
        if filt not in rel:
            continue
        text = path.read_text(); idx = 0
        for pm in PROSE_KEY_RE.finditer(text):
            prose, _ = aref.read_string_literal(text, pm.end() - 1)
            for lang, body in FENCE_RE.findall(prose):
                idx += 1
                if PROMPT_RE.search(body) or not body.strip():
                    continue
                out.append((idx, rel, body))
    return out

if __name__ == '__main__':
    filt = sys.argv[1]
    want = set(int(a) for a in sys.argv[2:])
    for idx, rel, body in blocks(filt):
        if want and idx not in want:
            continue
        print(f'----- [{idx}] {rel} -----')
        print(body)
