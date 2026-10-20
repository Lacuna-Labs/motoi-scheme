#!/usr/bin/env python3
"""Quarantine the 24 non-deterministic wrong-value fold rows identified by
verify-fold.py (2026-08-07 run). Moves them from the source shard files to a
dated _archive quarantine file — never deletes.

Source: ~/code/motoi-scheme/scratch/verify-fold.json wrong_value list.
Target: rows whose pair_id is one of the 8 non-det pair_ids.

Non-deterministic because the code uses random-pick, ai/wander (float noise),
alg/random-element, random-index — the claim recorded at authoring time is one
sample; the engine now prints a different sample. Not a bug; unrepairable.
"""
from __future__ import annotations
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

CORPUS = Path.home() / 'motoi-corpus'
VERIFY_JSON = Path('/Users/alfred/code/motoi-scheme/scratch/verify-fold.json')
ARCHIVE_DIR = CORPUS / 'sft-fold' / '_archive'
STAMP = '2026-08-07'
QUARANTINE_FILE = ARCHIVE_DIR / f'quarantine-{STAMP}-nondet.jsonl'


def main() -> int:
    d = json.load(open(VERIFY_JSON))
    wv = d['wrong_value']

    quarantine_pair_ids = {row['pair_id'] for row in wv}
    files_touched = {row['file'] for row in wv}
    print(f'wrong_value rows: {len(wv)}')
    print(f'distinct pair_ids: {len(quarantine_pair_ids)}')
    print(f'files: {sorted(files_touched)}')

    ARCHIVE_DIR.mkdir(exist_ok=True)

    total_moved = 0
    all_moved_rows = []

    for rel in sorted(files_touched):
        src = CORPUS / rel
        assert src.exists(), f'missing: {src}'

        with src.open() as f:
            all_lines = f.readlines()

        kept = []
        moved = []
        for line in all_lines:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                kept.append(line)
                continue
            pid = obj.get('pair_id')
            if pid in quarantine_pair_ids:
                moved.append(line)
            else:
                kept.append(line)

        if not moved:
            print(f'  {rel}: no matching pair_ids found (unexpected)')
            continue

        print(f'  {rel}: moving {len(moved)} rows, keeping {len(kept)}')

        # Write filtered shard atomically
        tmp = src.with_suffix(src.suffix + '.tmp')
        with tmp.open('w') as f:
            f.writelines(kept)
        tmp.replace(src)

        # Append to quarantine archive
        with QUARANTINE_FILE.open('a') as f:
            for line in moved:
                # Annotate each with quarantine reason
                obj = json.loads(line)
                obj.setdefault('_quarantine', {})
                obj['_quarantine']['reason'] = 'non-deterministic (random/wander/uuid/time)'
                obj['_quarantine']['detected_by'] = 'verify-fold.py 2026-08-07'
                obj['_quarantine']['moved_at'] = datetime.utcnow().isoformat() + 'Z'
                obj['_quarantine']['moved_from'] = rel
                f.write(json.dumps(obj) + '\n')

        total_moved += len(moved)
        all_moved_rows.extend(moved)

    print(f'\nDONE — {total_moved} rows quarantined to {QUARANTINE_FILE}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
