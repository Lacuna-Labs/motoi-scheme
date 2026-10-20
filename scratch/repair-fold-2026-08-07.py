#!/usr/bin/env python3
"""repair-fold-2026-08-07.py

Splice fold rows in ~/motoi-corpus/sft-fold/ based on verify-fold.json output.

For each wrong_value row: rewrite the response's claim (e.g., `It evaluates to
`<old>`.` → `` `<new>` ``) with the actual value.

For each stale_broken row: mark expected_outcome to 'error' if consistent, else
route to _corpus-reversal-broken.jsonl as a quarantine (only-add; NEVER delete).

Non-deterministic actuals (uuid/time/rand/stats) are quarantined rather than
having their claim spliced.

Read-only on scratch/verify-fold.json; writes into ~/motoi-corpus/sft-fold/*.
Prints diff stats.
"""
from __future__ import annotations
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
CORPUS = Path.home() / 'motoi-corpus'
VF = json.load(open(REPO / 'scratch' / 'verify-fold.json'))

# Non-deterministic markers -- if actual has these, quarantine instead of splice.
NONDET_RE = re.compile(r'uuid-\d+|:evidence \d|^\d{9,}$|#<procedure>|\{object|\[object')


def is_nondet(actual: str, code: str) -> bool:
    if NONDET_RE.search(actual or ''):
        return True
    # Code that reads any non-deterministic source
    if any(kw in code for kw in ('random', 'rand', 'now)', 'time)', 'time/', 'uuid', 'stats/', 'cortex/',
                                  'gensym', 'entity/pos', 'entity-pos', 'world/', 'physics',
                                  'empirical', 'sample', 'draw', 'llm/', '/tmp', '/var/folders',
                                  'MOTOI_HOME', 'pid)', 'getenv', 'ai/config', 'ai/session')):
        return True
    return False


# Group by (file, line).
by_file_line = defaultdict(list)  # file -> {line: [dicts]}
for w in VF['wrong_value']:
    by_file_line[w['file']].append(('wrong_value', w))
for s in VF['stale_broken']:
    by_file_line[s['file']].append(('stale_broken', s))


CLAIM_PATTERNS = [
    re.compile(r'It evaluates to `([^`]*)`'),
    re.compile(r'Running it yields `([^`]*)`'),
    re.compile(r'yields `([^`]*)`'),
    re.compile(r'(?<=Value:)([ \t]+)(.+?)(?=$|\n)', re.M),
    re.compile(r'evaluates to `([^`]*)`'),
]


def splice_claim(response: str, old_claim: str, new_claim: str) -> str | None:
    """Replace the first occurrence of old_claim in the response with new_claim.

    Search inside backtick fences and after "Value:" so we don't clobber prose.
    Returns updated response, or None if no anchor was found.
    """
    old = old_claim.strip()
    new = new_claim.strip()
    # Try backtick-anchored first (most common).
    anchor = f'`{old}`'
    if anchor in response:
        return response.replace(anchor, f'`{new}`', 1)
    # Try "Value: <old>" line.
    m = re.search(r'^(Value:[ \t]+)' + re.escape(old) + r'\s*$', response, re.M)
    if m:
        return response[:m.start(1)] + m.group(1) + new + response[m.end():]
    return None


def repair_file(fpath: Path, entries):
    """Rewrite in place; append quarantined lines to _corpus-reversal-broken.jsonl."""
    lines = fpath.read_text().splitlines()
    changed = 0
    quarantined = 0
    skipped = 0
    quarantine_out = []

    # Index entries by line for O(1) access
    line_map = defaultdict(list)
    for kind, e in entries:
        line_map[e['line']].append((kind, e))

    for i, ln in enumerate(lines):
        line_num = i  # verify-fold.py uses 0-based enumerate index
        if line_num not in line_map:
            continue
        try:
            row = json.loads(ln)
        except Exception:
            skipped += 1
            continue

        entry_list = line_map[line_num]
        # Process wrong_value first, then stale_broken.
        wv_entries = [e for k, e in entry_list if k == 'wrong_value']
        sb_entries = [e for k, e in entry_list if k == 'stale_broken']

        # Handle wrong_value: splice the claim.
        modified = False
        for e in wv_entries:
            claim = e.get('claim', '')
            actual = e.get('actual', '')
            code = e.get('code', '')
            if is_nondet(actual, code):
                quarantine_out.append(row)
                quarantined += 1
                lines[i] = None  # mark for removal
                modified = True
                break  # this line is done
            new_response = splice_claim(row.get('response', ''), claim, actual)
            if new_response is None:
                skipped += 1
                continue
            row['response'] = new_response
            row.setdefault('tags', {})['repair_2026_08_07'] = f'claim_splice: {claim[:40]!r}->{actual[:40]!r}'
            modified = True

        # If stale_broken (row now errors on current engine, but response claims a value).
        # These teach the wrong thing — quarantine them.
        if sb_entries and lines[i] is not None:
            quarantine_out.append(row)
            quarantined += 1
            lines[i] = None
            modified = True

        if modified and lines[i] is not None:
            lines[i] = json.dumps(row, ensure_ascii=False)
            changed += 1

    # Backup + write.
    if quarantined or changed:
        bak = fpath.with_suffix('.jsonl.bak-2026-08-07')
        if not bak.exists():
            shutil.copy2(fpath, bak)
        # Filter out None (quarantined)
        kept = [ln for ln in lines if ln is not None]
        fpath.write_text('\n'.join(kept) + ('\n' if kept else ''))

    return changed, quarantined, skipped, quarantine_out


total_ch = total_qn = total_sk = 0
all_quarantined = []
for fname, entries in by_file_line.items():
    fpath = CORPUS / fname.replace('sft-fold/', 'sft-fold/')
    if not fpath.exists():
        print(f'MISSING: {fpath}', file=sys.stderr)
        continue
    ch, qn, sk, qo = repair_file(fpath, entries)
    all_quarantined.extend(qo)
    total_ch += ch
    total_qn += qn
    total_sk += sk
    print(f'{fname}: changed={ch} quarantined={qn} skipped={sk}')

# Append quarantined to _corpus-reversal-broken.jsonl (only-add archive)
if all_quarantined:
    outp = CORPUS / 'sft-fold' / '_corpus-reversal-broken.jsonl'
    with open(outp, 'a') as fh:
        for row in all_quarantined:
            row.setdefault('tags', {})['quarantined_2026_08_07'] = 'nondeterministic-or-unspliceable'
            fh.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(f'Appended {len(all_quarantined)} quarantined rows to {outp}')

print(f'\nTOTAL: changed={total_ch}, quarantined={total_qn}, skipped={total_sk}')
