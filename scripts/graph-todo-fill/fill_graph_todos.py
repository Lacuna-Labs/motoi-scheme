#!/usr/bin/env python3
"""fill_graph_todos.py — deterministic completion of empty TODO fields
in Motoi's 4 axis graphs.

Fills across all T1 nodes:
  · :oppositions               — WordNet antonyms + hand-authored fallback
  · :associations              — nodes sharing 2+ book cross-refs
  · :distributional-neighbors  — same-axis nodes sharing 1+ book cross-refs
  · :cross-refs-graph          — cross-axis nodes sharing 1+ book cross-refs

Deterministic. Idempotent. Re-runs against filled files are no-ops.
Zero LLM cost.

Usage:
    python3 fill_graph_todos.py --graph-root ~/code/motoi-scheme/graphs
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

from nltk.corpus import wordnet as wn


# ══════════════════════════════════════════════════════════════════════
# §1 — Node parsing (whole-file, preserves formatting for write-back)
# ══════════════════════════════════════════════════════════════════════

NODE_START_RX = re.compile(r'^\(node$', re.MULTILINE)

def find_node_spans(text: str) -> list[tuple[int, int]]:
    """Yield (start, end) offsets of every (node ... ) block.

    SLAT nodes close with the paren on the same line as the last field
    (e.g. `:confidentiality :public)`), not a bare `)` line. Track paren
    depth manually to find the real close.
    """
    spans = []
    for m in NODE_START_RX.finditer(text):
        start = m.start()
        depth = 1
        i = m.end()  # right after '(node'
        N = len(text)
        in_str = False
        escape = False
        while i < N and depth > 0:
            c = text[i]
            if escape: escape = False
            elif in_str:
                if c == '\\': escape = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == ';':
                    # comment to end of line
                    nl = text.find('\n', i)
                    i = (nl if nl >= 0 else N)
                    continue
                elif c == '(': depth += 1
                elif c == ')': depth -= 1
            i += 1
        if depth == 0:
            spans.append((start, i))
    return spans


def field_str(block: str, name: str) -> str:
    m = re.search(rf':{re.escape(name)}\s+"((?:[^"\\]|\\.)*)"', block, re.DOTALL)
    return m.group(1) if m else ''


def field_str_list(block: str, name: str) -> list[str]:
    m = re.search(rf':{re.escape(name)}\s+\(', block, re.DOTALL)
    if not m: return []
    depth = 1
    end = m.end()
    in_str = False
    while end < len(block) and depth > 0:
        c = block[end]
        if c == '"' and (end == 0 or block[end-1] != '\\'):
            in_str = not in_str
        elif not in_str:
            if c == '(': depth += 1
            elif c == ')': depth -= 1
        end += 1
    inner = block[m.end():end-1]
    return re.findall(r'"((?:[^"\\]|\\.)*)"', inner)


def field_book_refs(block: str) -> list[tuple[str, str]]:
    """Extract (book, chapter) pairs from :cross-refs-books."""
    refs = []
    for m in re.finditer(r':book\s+"([^"]+)"\s+:chapter\s+"([^"]+)"', block):
        refs.append((m.group(1), m.group(2)))
    return refs


# ══════════════════════════════════════════════════════════════════════
# §2 — WordNet-based antonym derivation
# ══════════════════════════════════════════════════════════════════════

# Hand-authored fallback for concepts WordNet doesn't cover well.
HAND_ANTONYMS = {
    # thinking-axis
    'invariant': ['drift'], 'contract': ['breach'], 'proof': ['refutation'],
    'audit': ['neglect'], 'refusal': ['assent'], 'honest': ['deceptive'],
    'safety': ['hazard'], 'boundary': ['transgression'], 'exact': ['approximate'],
    'right': ['wrong'], 'true': ['false'], 'sound': ['unsound'],
    'valid': ['invalid'], 'coherent': ['incoherent'], 'trusted': ['suspect'],
    # intuition-axis
    'metaphor': ['literal'], 'analogy': ['disparity'], 'insight': ['blindness'],
    'pattern': ['noise'], 'hunch': ['certainty'], 'guess': ['knowledge'],
    'suspect': ['certain'], 'sense': ['nonsense'], 'gestalt': ['fragment'],
    # sensation-axis
    'concrete': ['abstract'], 'visible': ['hidden'], 'tangible': ['intangible'],
    'audible': ['silent'], 'sharp': ['dull'], 'bright': ['dim'],
    # feeling-axis
    'calm': ['agitated'], 'warm': ['cold'], 'trust': ['distrust'],
    'joy': ['sorrow'], 'safe': ['threatened'], 'seen': ['ignored'],
}


def derive_antonyms(canonical: str, axis: str) -> list[str]:
    """Return 1-3 antonym candidates for the canonical concept."""
    # Hand-authored first (Motoi-specific)
    if canonical in HAND_ANTONYMS:
        return HAND_ANTONYMS[canonical]

    # Split hyphens/slashes for multi-word canonicals
    root = canonical.split('/')[-1].split('-')[-1]
    if not root: return []

    # WordNet antonyms
    antonyms: list[str] = []
    for syn in wn.synsets(root):
        for lemma in syn.lemmas():
            for a in lemma.antonyms():
                name = a.name().replace('_', '-')
                if name != canonical and name not in antonyms:
                    antonyms.append(name)
                    if len(antonyms) >= 3: return antonyms
        if len(antonyms) >= 2: break

    return antonyms


# ══════════════════════════════════════════════════════════════════════
# §3 — Co-occurrence-based association derivation
# ══════════════════════════════════════════════════════════════════════

def build_book_index(all_nodes: list[dict]) -> dict[tuple[str, str], list[str]]:
    """Map (book, chapter) → [canonical, ...] for all nodes touching it."""
    idx = defaultdict(list)
    for n in all_nodes:
        for ref in n['book_refs']:
            idx[ref].append(n['canonical'])
    return idx


def derive_associations(
    node: dict,
    book_index: dict[tuple[str, str], list[str]],
    all_by_canonical: dict[str, dict],
    limit: int = 5,
) -> list[str]:
    """Nodes sharing 2+ book/chapter refs with this one."""
    counter = defaultdict(int)
    for ref in node['book_refs']:
        for other in book_index.get(ref, []):
            if other != node['canonical']:
                counter[other] += 1
    # keep those with count >= 2 (real association), sort by strength
    strong = sorted(
        [(c, n) for c, n in counter.items() if n >= 2],
        key=lambda x: (-x[1], x[0])
    )
    return [c for c, _ in strong[:limit]]


def derive_distributional_neighbors(
    node: dict,
    book_index: dict[tuple[str, str], list[str]],
    all_by_canonical: dict[str, dict],
    limit: int = 5,
) -> list[str]:
    """Same-axis nodes sharing 1+ book ref (nearby in distribution)."""
    counter = defaultdict(int)
    for ref in node['book_refs']:
        for other in book_index.get(ref, []):
            if other == node['canonical']: continue
            other_node = all_by_canonical.get(other)
            if other_node and other_node['axis'] == node['axis']:
                counter[other] += 1
    return [c for c, _ in sorted(counter.items(), key=lambda x: (-x[1], x[0]))[:limit]]


def derive_cross_refs_graph(
    node: dict,
    book_index: dict[tuple[str, str], list[str]],
    all_by_canonical: dict[str, dict],
    limit: int = 5,
) -> list[tuple[str, str]]:
    """Cross-axis nodes sharing 1+ book ref."""
    counter = defaultdict(int)
    for ref in node['book_refs']:
        for other in book_index.get(ref, []):
            if other == node['canonical']: continue
            other_node = all_by_canonical.get(other)
            if other_node and other_node['axis'] != node['axis']:
                counter[other] += 1
    out = []
    for c, _ in sorted(counter.items(), key=lambda x: (-x[1], x[0]))[:limit]:
        other = all_by_canonical.get(c)
        if other: out.append((other['axis'], f"{other['axis']}/{c}"))
    return out


# ══════════════════════════════════════════════════════════════════════
# §4 — Emit filled fields as SLAT text (matching original formatting)
# ══════════════════════════════════════════════════════════════════════

def slat_str_list(items: list[str]) -> str:
    return '(' + ' '.join(f'"{s}"' for s in items) + ')'


def slat_cross_refs_graph(refs: list[tuple[str, str]]) -> str:
    parts = []
    for axis, ref_id in refs:
        parts.append(f'(:ref-graph "{axis}" :ref-id "{ref_id}")')
    return '(' + ' '.join(parts) + ')'


# Empty-field patterns to replace (preserve trailing comment)
EMPTY_FIELD_PATTERNS = {
    ':oppositions': re.compile(r'(:oppositions\s+)\(\)((?:\s*;;[^\n]*)?)'),
    ':associations': re.compile(r'(:associations\s+)\(\)((?:\s*;;[^\n]*)?)'),
    ':distributional-neighbors': re.compile(r'(:distributional-neighbors\s+)\(\)((?:\s*;;[^\n]*)?)'),
    ':cross-refs-graph': re.compile(r'(:cross-refs-graph\s+)\(\)((?:\s*;;[^\n]*)?)'),
}


def fill_block(block: str, filled: dict[str, str]) -> str:
    """Replace empty fields with filled content, preserving surrounding text."""
    out = block
    for field, replacement in filled.items():
        pattern = EMPTY_FIELD_PATTERNS.get(field)
        if not pattern: continue
        # only replace if empty () — idempotent
        out = pattern.sub(lambda m: m.group(1) + replacement, out, count=1)
    return out


# ══════════════════════════════════════════════════════════════════════
# §5 — Orchestrator
# ══════════════════════════════════════════════════════════════════════

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph-root', type=Path, required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    graph_files = sorted(args.graph_root.glob('graph-of-*.slat'))
    if not graph_files:
        print(f'no graphs found in {args.graph_root}', file=sys.stderr)
        return 1

    # Pass 1 — index all T1 nodes across all 4 graphs
    all_nodes: list[dict] = []
    all_by_canonical: dict[str, dict] = {}
    file_contents: dict[Path, str] = {}
    file_spans: dict[Path, list[tuple[int, int]]] = {}

    for f in graph_files:
        axis = f.stem.replace('graph-of-', '')
        text = f.read_text(encoding='utf-8')
        file_contents[f] = text
        file_spans[f] = find_node_spans(text)
        for start, end in file_spans[f]:
            block = text[start:end]
            canonical = field_str(block, 'canonical')
            tier_str = field_str(block, 'tier')
            if not canonical: continue
            try: tier = int(tier_str)
            except ValueError: tier = 3
            node = {
                'file': f,
                'span': (start, end),
                'canonical': canonical,
                'axis': axis,
                'tier': tier,
                'book_refs': field_book_refs(block),
                'block': block,
            }
            all_nodes.append(node)
            all_by_canonical[canonical] = node

    print(f'[fill] indexed {len(all_nodes)} nodes across {len(graph_files)} graphs',
          file=sys.stderr)

    # Pass 2 — build the book-refs index
    book_index = build_book_index(all_nodes)
    print(f'[fill] {len(book_index)} distinct book/chapter refs across graphs',
          file=sys.stderr)

    # Pass 3 — for each T1 node with empty TODOs, fill them
    filled_stats = defaultdict(int)
    updates_per_file: dict[Path, list[tuple[tuple[int, int], str]]] = defaultdict(list)

    for node in all_nodes:
        if node['tier'] != 1: continue
        block = node['block']
        needs_fill = {}

        # oppositions
        if re.search(r':oppositions\s+\(\)', block):
            ants = derive_antonyms(node['canonical'], node['axis'])
            if ants:
                needs_fill[':oppositions'] = slat_str_list(ants)
                filled_stats['oppositions'] += 1

        # associations
        if re.search(r':associations\s+\(\)', block):
            assocs = derive_associations(node, book_index, all_by_canonical)
            if assocs:
                needs_fill[':associations'] = slat_str_list(assocs)
                filled_stats['associations'] += 1

        # distributional-neighbors
        if re.search(r':distributional-neighbors\s+\(\)', block):
            dn = derive_distributional_neighbors(node, book_index, all_by_canonical)
            if dn:
                needs_fill[':distributional-neighbors'] = slat_str_list(dn)
                filled_stats['distributional-neighbors'] += 1

        # cross-refs-graph
        if re.search(r':cross-refs-graph\s+\(\)', block):
            crg = derive_cross_refs_graph(node, book_index, all_by_canonical)
            if crg:
                needs_fill[':cross-refs-graph'] = slat_cross_refs_graph(crg)
                filled_stats['cross-refs-graph'] += 1

        if not needs_fill: continue

        new_block = fill_block(block, needs_fill)
        updates_per_file[node['file']].append((node['span'], new_block))

    print(f'[fill] fill counts:', file=sys.stderr)
    for k, v in filled_stats.items():
        print(f'    {k:30s}  {v}', file=sys.stderr)

    if args.dry_run:
        print('[fill] --dry-run: no files written', file=sys.stderr)
        return 0

    # Pass 4 — write updates per file (reverse-order to preserve offsets)
    for f, updates in updates_per_file.items():
        text = file_contents[f]
        for (start, end), new_block in sorted(updates, key=lambda x: -x[0][0]):
            text = text[:start] + new_block + text[end:]
        f.write_text(text, encoding='utf-8')
        print(f'[fill] wrote {f.name}  ({len(updates)} nodes updated)',
              file=sys.stderr)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
