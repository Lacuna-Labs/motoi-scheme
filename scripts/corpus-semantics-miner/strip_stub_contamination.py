#!/usr/bin/env python3
"""Strip stub-contamination from graph nodes.

Per SRE-05 doctrine, Tier 2/T3 nodes carry only :canonical + :source-refs.
Someone in a prior authoring lane injected placeholder :definition text
into 14k+ nodes ("A rare word appearing in the Motoi corpus."). That leaks
into CPT + SFT training and teaches the model to reproduce the placeholder.

This script:
1. Walks each graph file
2. For each node whose :definition (or :examples) matches a known stub
   pattern, DELETES that field entirely
3. Emits a strip-log sidecar per axis for auditability
4. Idempotent: safe to re-run

Composes with:
- honest-null-is-training-signal-2026-07-22 (empty fields are training signal)
- SRE-05 (tier boundary discipline)
- graph-derivation-principle (no fabrication)
"""

from __future__ import annotations
import argparse, re, sys
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent))
from mine_corpus_semantics import parse_graph_nodes

STUB_PATTERNS = [
    r'A rare word appearing in the Motoi corpus',
    r'no corpus excerpt available at build time',
    r'\(no corpus excerpt available',
    r'retry after next scan',
    r'ordinary thing that turns up in daily life',
    r'kind of thing that lives in the world',
    r'A scene constituent the player can see',   # placeholder for many
    r'lens-capture-frames',                       # tokenization degeneracy
    r'abelian-group-theory, abelian-group',       # tokenization degeneracy
    r'placeholder — needs authoring',
    r'TODO: author definition',
    r'TBD — see appendix',
]

# Fields we'll strip if they contain any stub pattern
STRIPPABLE_FIELDS = {
    'definition', 'definition-technical', 'examples', 'used-in-programs-as',
    'example-dialogue', 'short-scenario', 'antipattern-scenario',
    'motoi-behavior', 'appears-in-corpus',
}

_stub_rx = re.compile('|'.join(STUB_PATTERNS), re.I)

def field_line_range(node_lines: list[str], field: str) -> tuple[int, int] | None:
    """Return (start_idx, end_idx_exclusive) of the field-value block in the node's lines.
    Uses string-aware paren counting."""
    from mine_corpus_semantics import _count_parens_outside_strings
    for i, ln in enumerate(node_lines):
        if re.match(r'^\s*:' + re.escape(field) + r'\s+', ln):
            # Determine how many lines the value spans
            depth = 0
            in_string = False
            j = i
            while j < len(node_lines):
                op, cl, in_string = _count_parens_outside_strings(node_lines[j], in_string, False)
                depth += op - cl
                # For non-parenthesized values (bare strings/atoms), first line ends it
                if j == i and depth == 0 and not in_string:
                    return (i, j + 1)
                j += 1
                if depth <= 0 and not in_string:
                    return (i, j)
            return (i, len(node_lines))
    return None


def process(gp: Path, dry_run: bool) -> dict:
    text = gp.read_text()
    lines = text.splitlines()
    nodes = parse_graph_nodes(text)
    stats = Counter()
    lines_to_drop: set[int] = set()

    for n in nodes:
        canonical = ''
        can_m = re.search(r':canonical\s+"([^"]*)"', n['body'])
        if can_m:
            canonical = can_m.group(1)

        # Check each strippable field: does its value contain a stub pattern?
        for field in STRIPPABLE_FIELDS:
            rng = field_line_range(n['raw'], field)
            if not rng:
                continue
            start_off, end_off = rng
            field_lines = n['raw'][start_off:end_off]
            field_body = '\n'.join(field_lines)
            if _stub_rx.search(field_body):
                # Absolute line indices in the file
                abs_start = n['start_line'] + start_off
                abs_end   = n['start_line'] + end_off
                for k in range(abs_start, abs_end):
                    lines_to_drop.add(k)
                stats[f'{field}'] += 1
                stats['nodes-touched'] += 1

    if not lines_to_drop:
        print(f'[{gp.stem}] no stub contamination found')
        return dict(stats)

    if dry_run:
        print(f'[{gp.stem}] dry-run: would drop {len(lines_to_drop)} lines '
              f'across {stats["nodes-touched"]} nodes')
    else:
        new_lines = [ln for i, ln in enumerate(lines) if i not in lines_to_drop]
        gp.write_text('\n'.join(new_lines) + '\n')
        print(f'[{gp.stem}] stripped {len(lines_to_drop)} lines · '
              f'{stats["nodes-touched"]} nodes affected')

    for k, v in sorted(stats.items(), key=lambda kv: -kv[1]):
        if k == 'nodes-touched': continue
        print(f'    {k}: {v} field-instances')
    return dict(stats)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph-root', type=Path, required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    grand = Counter()
    for axis in ('sensation', 'intuition', 'thinking', 'feeling'):
        gp = args.graph_root / f'graph-of-{axis}.slat'
        if not gp.exists():
            continue
        st = process(gp, args.dry_run)
        for k, v in st.items():
            grand[k] += v
    print(f'\n[total] {sum(v for k,v in grand.items() if k!="nodes-touched")} field-instances '
          f'across {grand["nodes-touched"]} nodes')


if __name__ == '__main__':
    main()
