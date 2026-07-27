#!/usr/bin/env python3
"""
Surgical reset: remove fabricated fills from graph files.

Reads derivation-log-<axis>-2026-07-22.slat, finds entries where source is
axis-tier-fallback or axis-fallback, and for each such entry, checks whether
the current graph file's field value MATCHES the log's proposed value. If
yes, reset that field to `()`. If no (means the value was author-authored
and the fill was never actually applied), leave it alone.

Idempotent + safe: resets only fabricated writes.
"""

from __future__ import annotations
import argparse, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mine_corpus_semantics import parse_graph_nodes  # reuse the string-aware parser

FABRICATION_SOURCES = {'axis-tier-fallback', 'axis-fallback'}
TARGET_FIELDS = {'oppositions', 'associations', 'distributional-neighbors', 'cross-refs-graph'}

# Match a single derivation-log entry
_ENTRY_RX = re.compile(
    r'\(:node\s+"([^"]+)"\s+'
    r':field\s+"([^"]+)"\s+'
    r':source\s+"([^"]+)"\s+'
    r':detail\s+"[^"]*"\s+'
    r':values\s+\(([^)]*)\)\)',
    re.S,
)

def parse_log(log_path: Path) -> list[dict]:
    text = log_path.read_text()
    entries = []
    for m in _ENTRY_RX.finditer(text):
        entries.append({
            'node': m.group(1),
            'field': m.group(2),
            'source': m.group(3),
            'values_raw': m.group(4).strip(),
        })
    return entries

def _norm(s: str) -> str:
    """Normalize field-value string: extract bare atoms + quoted strings + keywords into a canonical space-separated form."""
    tokens = []
    for m in re.finditer(r'"([^"]*)"|(:[\w./-]+)|([A-Za-z][\w./-]*)', s):
        tokens.append(m.group(1) if m.group(1) is not None else (m.group(2) or m.group(3)))
    return ' '.join(tokens)

def field_line_matches(current_line: str, expected_inner: str) -> bool:
    """Does the current field line's list-content match expected_inner (quote/atom-normalized)?"""
    m = re.match(r'^\s*:[\w-]+\s+\(([^)]*)\)', current_line)
    if not m:
        return False
    cur = _norm(m.group(1))
    exp = _norm(expected_inner)
    return cur == exp

def reset_field_line(orig_line: str, field: str) -> str:
    m = re.match(r'^(\s*):' + re.escape(field) + r'\s+', orig_line)
    if not m:
        return orig_line
    indent = m.group(1)
    return f'{indent}:{field:<20} ()'

def process(axis: str, graph_root: Path, log_root: Path, dry_run: bool) -> tuple[int, int]:
    """Returns (matched_fabrications_reset, unmatched_kept)."""
    gp = graph_root / f'graph-of-{axis}.slat'
    log = log_root / f'derivation-log-{axis}-2026-07-22.slat'
    if not log.exists():
        print(f'[skip] {axis}: no log')
        return 0, 0
    lines = gp.read_text().splitlines()
    nodes = parse_graph_nodes('\n'.join(lines))
    node_by_canonical: dict[str, dict] = {}
    for n in nodes:
        fmap = n['fields']
        can_m = re.search(r'"([^"]*)"', fmap.get('canonical', ''))
        if can_m:
            node_by_canonical[can_m.group(1)] = n

    entries = parse_log(log)
    fabrications = [e for e in entries if e['source'] in FABRICATION_SOURCES and e['field'] in TARGET_FIELDS]
    reset_count = 0
    unmatched = 0
    for e in fabrications:
        node = node_by_canonical.get(e['node'])
        if not node:
            unmatched += 1
            continue
        for line_off, ln in enumerate(node['raw']):
            if re.match(r'^\s*:' + re.escape(e['field']) + r'\s+', ln):
                if field_line_matches(ln, e['values_raw']):
                    abs_idx = node['start_line'] + line_off
                    if not dry_run:
                        lines[abs_idx] = reset_field_line(ln, e['field'])
                    reset_count += 1
                else:
                    unmatched += 1
                break
    if not dry_run and reset_count > 0:
        gp.write_text('\n'.join(lines) + '\n')
    print(f'[{axis}] fabrications: {len(fabrications)} · reset: {reset_count} · unmatched (kept): {unmatched}')
    return reset_count, unmatched

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph-root', type=Path, required=True)
    ap.add_argument('--log-root', type=Path, required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    total_reset = 0
    total_kept = 0
    for axis in ('sensation', 'intuition', 'thinking', 'feeling'):
        r, k = process(axis, args.graph_root, args.log_root, args.dry_run)
        total_reset += r
        total_kept += k
    print(f'\n[total] reset {total_reset} fabrications · kept {total_kept} unmatched (author-authored or already reset)')

if __name__ == '__main__':
    main()
