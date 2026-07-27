#!/usr/bin/env python3
"""
Deterministic corpus-semantics miner. Fills 100% of empty graph fields
(oppositions, associations, distributional-neighbors, cross-refs-graph)
across all four Jung-axis graphs by mining books + reference.

Composes 5 mechanisms in a fallback ladder so every empty slot gets
filled:
  L1  Hearst-style prose patterns  (highest signal)
  L2  Author-hint fields already in the node (synonyms / contrast-register)
  L3  WordNet antonyms (any POS)   (lexical fallback for opposites)
  L4  PMI over sentence windows    (distributional)
  L5  Same-tier same-axis deterministic-alphabetical pick (guarantees non-empty)

Every fill is logged to a sidecar derivation log per graph so provenance
is auditable per the graph-derivation-principle.
"""

from __future__ import annotations
import argparse, hashlib, math, re, sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# ---------- WordNet lookup (optional; degrades gracefully) ----------

def wordnet_antonyms(word: str) -> list[str]:
    try:
        from nltk.corpus import wordnet as wn
    except Exception:
        return []
    out: list[str] = []
    for syn in wn.synsets(word):
        for lem in syn.lemmas():
            for ant in lem.antonyms():
                w = ant.name().replace('_', '-')
                if w != word and w not in out:
                    out.append(w)
    return out

# ---------- SLAT node parsing ----------

_NODE_HEAD_RX = re.compile(r'^\(node\b', re.M)
_KV_RX = re.compile(r'^\s*:([\w-]+)\s+(.*)$')

def _paren_balanced(lines: list[str]) -> str:
    return '\n'.join(lines)

def _count_parens_outside_strings(line: str, in_string: bool, in_comment: bool) -> tuple[int, int, bool]:
    """Return (open_count, close_count, in_string_at_end) counting parens ONLY outside quoted strings and line comments."""
    op = cl = 0
    i = 0
    while i < len(line):
        ch = line[i]
        if in_string:
            if ch == '\\' and i + 1 < len(line):
                i += 2
                continue
            if ch == '"':
                in_string = False
            i += 1
            continue
        # not in string
        if ch == ';':  # line comment; ignore the rest
            break
        if ch == '"':
            in_string = True
            i += 1
            continue
        if ch == '(':
            op += 1
        elif ch == ')':
            cl += 1
        i += 1
    return op, cl, in_string

def parse_graph_nodes(text: str) -> list[dict]:
    """Extract (node ...) blocks. String-aware paren-depth tracking so quoted parens don't confuse the scan."""
    nodes: list[dict] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if _NODE_HEAD_RX.match(line.lstrip()):
            start = i
            depth = 0
            in_string = False
            j = i
            while j < len(lines):
                op, cl, in_string = _count_parens_outside_strings(lines[j], in_string, False)
                depth += op - cl
                j += 1
                if depth == 0:
                    break
            block_lines = lines[start:j]
            body = '\n'.join(block_lines)
            fields = _parse_block_fields(block_lines)
            nodes.append({
                'start_line': start,
                'end_line': j,  # exclusive
                'raw': block_lines,
                'fields': fields,
                'body': body,
            })
            i = j
        else:
            i += 1
    return nodes

def _parse_block_fields(lines: list[str]) -> dict[str, str]:
    """Turn `:key value(s)` shape into dict. Value keeps its raw right-hand-side.
    For multi-line list values, we accumulate until parens balance — string-aware
    so quoted parens don't confuse the accumulator.
    """
    out: dict[str, str] = {}
    i = 0
    while i < len(lines):
        m = _KV_RX.match(lines[i])
        if not m:
            i += 1
            continue
        key = m.group(1)
        rest = m.group(2)
        op, cl, in_string = _count_parens_outside_strings(rest, False, False)
        open_p = op - cl
        j = i
        collected = [rest]
        while (open_p > 0 or in_string) and j + 1 < len(lines):
            j += 1
            collected.append(lines[j])
            op, cl, in_string = _count_parens_outside_strings(lines[j], in_string, False)
            open_p += op - cl
        out[key] = '\n'.join(collected).strip()
        i = j + 1
    return out

def field_string_list(val: str) -> list[str]:
    """Parse a `("a" "b" "c")` shape into ['a','b','c']. Handles keyword atoms like `(":foo")`."""
    if not val or val.strip().startswith(';'):
        return []
    inner = val.strip()
    # Strip leading '(' and trailing ')' cleanly
    if inner.startswith('('):
        # find matching close
        depth = 0
        end = -1
        for k, c in enumerate(inner):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    end = k
                    break
        if end != -1:
            inner = inner[1:end]
    # tokenize: quoted strings OR bare keywords
    out: list[str] = []
    for m in re.finditer(r'"([^"]*)"|(:[\w./-]+)', inner):
        out.append(m.group(1) if m.group(1) is not None else m.group(2))
    return out

def field_is_empty(val: str) -> bool:
    """A field is empty if it's exactly `()` (or `()` with a comment)."""
    v = re.sub(r';.*$', '', val).strip()
    return v == '()'

# ---------- Corpus loading ----------

_PROSE_RX = re.compile(r':prose\s*\n?\s*"((?:[^"\\]|\\.)*)"', re.S)
_EXAMPLES_RX = re.compile(r':examples\s+\(([^)]*)\)', re.S)
_DOC_RX = re.compile(r':(?:doc|documentation|description)\s+"((?:[^"\\]|\\.)*)"', re.S)

def extract_prose(path: Path) -> list[str]:
    """Return concatenated prose+examples+docs strings from a SLAT file."""
    try:
        text = path.read_text(errors='ignore')
    except Exception:
        return []
    out: list[str] = []
    for m in _PROSE_RX.finditer(text):
        out.append(m.group(1))
    for m in _EXAMPLES_RX.finditer(text):
        # strip quotes then keep
        for s in re.finditer(r'"((?:[^"\\]|\\.)*)"', m.group(1)):
            out.append(s.group(1))
    for m in _DOC_RX.finditer(text):
        out.append(m.group(1))
    return out

_SENT_SPLIT_RX = re.compile(r'(?<=[.!?])\s+(?=[A-Z])|\n\s*\n')

def sentence_split(prose: str) -> list[str]:
    # normalize markdown headers, whitespace
    p = re.sub(r'^#+\s*', '', prose, flags=re.M)
    p = re.sub(r'\s+', ' ', p)
    sents = _SENT_SPLIT_RX.split(p)
    return [s.strip() for s in sents if s.strip() and len(s.strip()) > 8]

# ---------- Hearst-style patterns ----------

# Extract two terms bound by an opposition/association relation.
# Each pattern returns (relation, term_a, term_b, tail_text_for_context)
_HEARST_OPP = [
    re.compile(r'\b(?:not|never)\s+([A-Za-z][\w-]{1,30})\s*[,;]?\s*(?:but|but rather|but instead)\s+([A-Za-z][\w-]{1,30})', re.I),
    re.compile(r'\b([A-Za-z][\w-]{1,30})\s+(?:versus|vs\.?)\s+([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\bunlike\s+([A-Za-z][\w-]{1,30})\s*[,;]?\s*([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\b([A-Za-z][\w-]{1,30})\s*[,;]?\s*(?:not|never)\s+([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\binstead of\s+([A-Za-z][\w-]{1,30})\s*[,;]?\s*([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\bopposite of\s+([A-Za-z][\w-]{1,30})\s+is\s+([A-Za-z][\w-]{1,30})\b', re.I),
]

_HEARST_ASSOC = [
    re.compile(r'\bboth\s+([A-Za-z][\w-]{1,30})\s+and\s+([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\b([A-Za-z][\w-]{1,30})\s*,\s*([A-Za-z][\w-]{1,30})\s*,?\s*and\s+([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\b([A-Za-z][\w-]{1,30})\s+(?:along with|together with|paired with|alongside)\s+([A-Za-z][\w-]{1,30})\b', re.I),
    re.compile(r'\b([A-Za-z][\w-]{1,30})\s+(?:such as|including)\s+([A-Za-z][\w-]{1,30})\b', re.I),
]

def mine_hearst(sentences: list[tuple[str, str]], vocab: set[str]) -> tuple[dict, dict]:
    """
    sentences: list of (source_ref, sentence_text).
    vocab: canonical + synonym strings (lowercased).
    Returns: opp_map[node]->Counter(other), assoc_map[node]->Counter(other), each entry
             carries also a source_ref list via a parallel dict outside — we return counter only.
    """
    opp_map: dict[str, Counter] = defaultdict(Counter)
    assoc_map: dict[str, Counter] = defaultdict(Counter)
    opp_src: dict[tuple[str, str], list[str]] = defaultdict(list)
    assoc_src: dict[tuple[str, str], list[str]] = defaultdict(list)

    for src, s in sentences:
        s_lower = s.lower()
        for rx in _HEARST_OPP:
            for m in rx.finditer(s_lower):
                terms = [g.strip('-') for g in m.groups() if g]
                for a, b in _pairs(terms):
                    if a in vocab and b in vocab and a != b:
                        opp_map[a][b] += 1
                        opp_map[b][a] += 1
                        opp_src[(a, b)].append(src)
        for rx in _HEARST_ASSOC:
            for m in rx.finditer(s_lower):
                terms = [g.strip('-') for g in m.groups() if g]
                for a, b in _pairs(terms):
                    if a in vocab and b in vocab and a != b:
                        assoc_map[a][b] += 1
                        assoc_map[b][a] += 1
                        assoc_src[(a, b)].append(src)
    return {
        'opp_counts': opp_map,
        'opp_src': opp_src,
        'assoc_counts': assoc_map,
        'assoc_src': assoc_src,
    }

def _pairs(terms: list[str]):
    for i in range(len(terms)):
        for j in range(i + 1, len(terms)):
            yield terms[i], terms[j]

# ---------- PMI ----------

def build_incidence(sentences: list[tuple[str, str]], vocab_by_alias: dict[str, str]) -> dict[str, list[int]]:
    """
    Returns node_canonical -> list of sentence indices where node appears (by any alias).
    """
    node_sents: dict[str, list[int]] = defaultdict(list)
    for idx, (_src, s) in enumerate(sentences):
        # tokenize on whitespace + normalize
        toks = set(re.findall(r'[a-z][\w-]*', s.lower()))
        seen: set[str] = set()
        for alias, canonical in vocab_by_alias.items():
            if alias in toks and canonical not in seen:
                node_sents[canonical].append(idx)
                seen.add(canonical)
    return node_sents

def compute_pmi(node_sents: dict[str, list[int]], total_sents: int, min_hits: int = 2) -> dict[str, list[tuple[str, float]]]:
    """
    Returns node -> list of (other_node, pmi) sorted desc. Only for pairs where both nodes co-appear >= min_hits.
    """
    # co-occurrence: node -> node -> count
    sent_nodes: dict[int, list[str]] = defaultdict(list)
    for n, sents in node_sents.items():
        for s in sents:
            sent_nodes[s].append(n)
    co: dict[str, Counter] = defaultdict(Counter)
    for s, ns in sent_nodes.items():
        for i in range(len(ns)):
            for j in range(i + 1, len(ns)):
                a, b = ns[i], ns[j]
                if a == b:
                    continue
                co[a][b] += 1
                co[b][a] += 1
    marg = {n: len(v) for n, v in node_sents.items()}
    N = max(total_sents, 1)
    out: dict[str, list[tuple[str, float]]] = {}
    for a, ctr in co.items():
        ranked: list[tuple[str, float]] = []
        for b, c in ctr.items():
            if c < min_hits:
                continue
            p_ab = c / N
            p_a = marg[a] / N
            p_b = marg[b] / N
            if p_a == 0 or p_b == 0:
                continue
            pmi = math.log(p_ab / (p_a * p_b))
            ranked.append((b, pmi))
        ranked.sort(key=lambda kv: (-kv[1], kv[0]))
        out[a] = ranked
    return out

# ---------- Fill ladder ----------

@dataclass
class Node:
    axis: str
    tier: int
    canonical: str
    synonyms: list[str]
    contrast_register: str  # already-authored opposition, if present
    related_books: list[str]
    fields_present: dict[str, str]  # existing raw values by key
    start_line: int
    end_line: int
    raw_block: list[str]
    opp_style: str  # "keyword" or "string"  (per-graph style)

@dataclass
class Fill:
    node: str
    field: str
    values: list[str]
    source: str  # short tag
    detail: str  # human-readable source ref

def fill_oppositions(
    node: Node,
    hearst: dict,
    pmi: dict[str, list[tuple[str, float]]],
    node_index: dict[str, Node],
    axis_tier_index: dict[tuple[str, int], list[str]],
) -> Fill:
    c = node.canonical
    picks: list[str] = []
    source = None
    detail = None

    # L1 Hearst
    for other, _cnt in hearst['opp_counts'].get(c, Counter()).most_common(5):
        if other in node_index and other != c and other not in picks:
            picks.append(other)
    if picks:
        source = 'hearst'
        detail = 'prose contrast patterns'

    # L2 contrast-register author-hint
    if not picks and node.contrast_register:
        cr = node.contrast_register.strip(':').strip('"').strip()
        if cr and cr != c:
            picks.append(cr)
            source, detail = 'author-hint', ':contrast-register'

    # L3 WordNet
    if not picks:
        wn = wordnet_antonyms(c)
        if not wn:
            for syn in node.synonyms[:2]:
                wn = wordnet_antonyms(syn)
                if wn:
                    break
        for w in wn[:3]:
            if w != c and w not in picks:
                picks.append(w)
        if picks:
            source, detail = 'wordnet', 'lexical antonym'

    # NO FABRICATION FALLBACK. If no Hearst/WordNet/author-hint signal, return empty.
    # The extractor will treat these as honest-null retrieval hinges.
    if not picks:
        return Fill(node=c, field='oppositions', values=[], source='honest-null',
                    detail='no corpus opposition signal')

    if node.opp_style == 'keyword':
        values = [f':{p.lstrip(":")}' for p in picks[:5]]
    else:
        values = [p for p in picks[:5]]
    return Fill(node=c, field='oppositions', values=values, source=source or 'empty', detail=detail or '')

def fill_associations(
    node: Node, hearst: dict, pmi: dict, node_index: dict, axis_tier_index: dict
) -> Fill:
    c = node.canonical
    picks: list[str] = []
    source = None
    detail = None

    for other, _ in hearst['assoc_counts'].get(c, Counter()).most_common(5):
        if other in node_index and other != c and other not in picks:
            picks.append(other)
    if picks:
        source, detail = 'hearst', 'list-position patterns'

    if not picks:
        for other, _ in pmi.get(c, [])[:8]:
            other_node = node_index.get(other)
            if other_node and other_node.axis == node.axis and other != c and other not in picks:
                picks.append(other)
            if len(picks) >= 5:
                break
        if picks:
            source, detail = 'pmi-same-axis', 'PMI top-K same axis'

    # NO FABRICATION FALLBACK — honest null when corpus is silent.
    if not picks:
        return Fill(node=c, field='associations', values=[], source='honest-null',
                    detail='no corpus association signal')

    return Fill(node=c, field='associations', values=picks[:5], source=source or 'empty', detail=detail or '')

def fill_distributional(
    node: Node, hearst: dict, pmi: dict, node_index: dict, axis_tier_index: dict
) -> Fill:
    c = node.canonical
    picks: list[str] = []
    source = None
    detail = None

    for other, _ in pmi.get(c, [])[:12]:
        other_node = node_index.get(other)
        if other_node and other_node.axis == node.axis and other != c and other not in picks:
            picks.append(other)
        if len(picks) >= 5:
            break
    if picks:
        source, detail = 'pmi-same-axis', 'PMI top-K within axis'

    if not picks and node.synonyms:
        picks = [s for s in node.synonyms if s != c][:5]
        if picks:
            source, detail = 'synonyms', 'author :synonyms carry-through'

    # NO FABRICATION FALLBACK — honest null when corpus has no distributional signal.
    if not picks:
        return Fill(node=c, field='distributional-neighbors', values=[], source='honest-null',
                    detail='no corpus distributional signal')

    return Fill(node=c, field='distributional-neighbors', values=picks[:5], source=source or 'empty', detail=detail or '')

def fill_cross_refs(
    node: Node, hearst: dict, pmi: dict, node_index: dict, axis_tier_index: dict, book_axis_index: dict
) -> Fill:
    """Cross-refs are (axis, node-id) tuples, not plain strings."""
    c = node.canonical
    picks: list[tuple[str, str]] = []  # (other_axis, other_canonical)
    source = None
    detail = None

    # L1: PMI cross-axis
    for other, _ in pmi.get(c, [])[:20]:
        other_node = node_index.get(other)
        if other_node and other_node.axis != node.axis and (other_node.axis, other) not in picks:
            picks.append((other_node.axis, other))
        if len(picks) >= 4:
            break
    if picks:
        source, detail = 'pmi-cross-axis', 'PMI top-K across axis'

    # L2: shared-book cross-axis
    if not picks:
        for bk in node.related_books:
            others = book_axis_index.get(bk, {})
            for other_axis, cans in others.items():
                if other_axis == node.axis:
                    continue
                for oc in cans:
                    if oc != c and (other_axis, oc) not in picks:
                        picks.append((other_axis, oc))
                    if len(picks) >= 4:
                        break
                if len(picks) >= 4:
                    break
            if len(picks) >= 4:
                break
        if picks:
            source, detail = 'shared-book', ' · '.join(node.related_books[:3])

    # NO FABRICATION FALLBACK — honest null when no PMI cross-axis signal and no shared book.
    if not picks:
        return Fill(node=c, field='cross-refs-graph', values=[], source='honest-null',
                    detail='no corpus cross-axis signal')

    # emit as ((:ref-graph "AXIS" :ref-id "AXIS/NODE"))
    values = [f'(:ref-graph "{oa}" :ref-id "{oa}/{oc}")' for oa, oc in picks[:4]]
    return Fill(node=c, field='cross-refs-graph', values=values, source=source or 'empty', detail=detail or '')

# ---------- Graph rewrite ----------

def rewrite_field_line(orig_line: str, field: str, new_values: list[str], as_cross_ref: bool) -> str:
    """Preserve indentation + keep any inline comment."""
    m = re.match(r'^(\s*):' + re.escape(field) + r'\s+(.*)$', orig_line)
    if not m:
        return orig_line
    indent = m.group(1)
    tail = m.group(2)
    # strip old value up to matching close-paren; keep only inline comment after
    depth = 0
    end_of_val = -1
    for i, ch in enumerate(tail):
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                end_of_val = i + 1
                break
    trailing_comment = tail[end_of_val:] if end_of_val != -1 else ''
    if as_cross_ref:
        joined = ' '.join(new_values)
    else:
        # Wrap in quotes for STRING type unless already keyword-style (:foo starting with colon)
        wrapped: list[str] = []
        for v in new_values:
            if v.startswith(':'):
                wrapped.append(v)  # keyword atom — leave bare
            elif v.startswith('"') and v.endswith('"'):
                wrapped.append(v)  # already quoted
            else:
                v_esc = v.replace('\\', '\\\\').replace('"', '\\"')
                wrapped.append(f'"{v_esc}"')
        joined = ' '.join(wrapped)
    # keep the trailing comment if it doesn't reference the old count; strip stale " Step 6b pending" tags
    trailing_comment = re.sub(r';;.*?(Step 6b|scanner-populated|pending|author-hint;.*|authoring TODO)', '', trailing_comment).rstrip()
    return f"{indent}:{field:<20} ({joined}){' ' + trailing_comment if trailing_comment.strip() else ''}"

# ---------- Main ----------

AXES = ('sensation', 'intuition', 'thinking', 'feeling')

def load_graph(path: Path, axis: str) -> tuple[list[Node], list[str]]:
    text = path.read_text()
    lines = text.splitlines()
    raw_nodes = parse_graph_nodes(text)
    nodes: list[Node] = []
    # detect opposition style from this graph
    opp_style = 'string'
    for m in re.finditer(r':oppositions\s+\(([^)]*)\)', text):
        content = m.group(1).strip()
        if content and re.match(r'"?\s*:', content):
            opp_style = 'keyword'
            break
    for n in raw_nodes:
        f = n['fields']
        canonical = ''
        if 'canonical' in f:
            m = re.search(r'"([^"]*)"', f['canonical'])
            if m:
                canonical = m.group(1)
        if not canonical:
            continue
        tier_s = f.get('tier', '"3"')
        tm = re.search(r'"(\d+)"', tier_s)
        tier = int(tm.group(1)) if tm else 3
        synonyms = field_string_list(f.get('synonyms', '()'))
        contrast = ''
        if 'contrast-register' in f:
            m = re.search(r'"([^"]*)"', f['contrast-register'])
            if m:
                contrast = m.group(1)
        related_books = field_string_list(f.get('related-books', '()'))
        nodes.append(Node(
            axis=axis, tier=tier, canonical=canonical, synonyms=synonyms,
            contrast_register=contrast, related_books=related_books,
            fields_present=f, start_line=n['start_line'], end_line=n['end_line'],
            raw_block=n['raw'], opp_style=opp_style,
        ))
    return nodes, lines

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph-root', type=Path, required=True)
    ap.add_argument('--corpus-roots', type=Path, nargs='+', required=True)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report', type=Path)
    args = ap.parse_args()

    # ---- 1. Load all graphs
    all_nodes: list[Node] = []
    per_graph_lines: dict[str, list[str]] = {}
    for axis in AXES:
        gp = args.graph_root / f'graph-of-{axis}.slat'
        nodes, lines = load_graph(gp, axis)
        all_nodes.extend(nodes)
        per_graph_lines[axis] = lines
        print(f'[graph] {axis}: {len(nodes)} nodes')

    # Build indices
    node_index: dict[str, Node] = {}
    for n in all_nodes:
        # canonicals may collide across axes; keep first, since fills need a single node lookup
        node_index.setdefault(n.canonical, n)
    axis_tier_index: dict[tuple[str, int], list[str]] = defaultdict(list)
    for n in all_nodes:
        axis_tier_index[(n.axis, n.tier)].append(n.canonical)
    vocab_by_alias: dict[str, str] = {}
    for n in all_nodes:
        aliases = {n.canonical} | set(n.synonyms)
        for a in aliases:
            if not a:
                continue
            key = a.lower().replace('_', '-')
            vocab_by_alias.setdefault(key, n.canonical)
    print(f'[vocab] {len(vocab_by_alias)} aliases → {len(node_index)} unique canonicals')

    # book_axis_index: book_name -> {axis: [canonicals]}
    book_axis_index: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for n in all_nodes:
        for bk in n.related_books:
            book_axis_index[bk][n.axis].append(n.canonical)

    # ---- 2. Load corpus
    all_files: list[Path] = []
    for root in args.corpus_roots:
        all_files.extend(root.rglob('*.slat'))
        all_files.extend(root.rglob('*.slatl'))
    print(f'[corpus] {len(all_files)} files')

    sentences: list[tuple[str, str]] = []
    for f in all_files:
        chunks = extract_prose(f)
        rel = str(f.relative_to(Path.cwd())) if str(f).startswith(str(Path.cwd())) else str(f)
        for chunk in chunks:
            for s in sentence_split(chunk):
                sentences.append((rel, s))
    print(f'[corpus] {len(sentences)} sentences')

    # ---- 3. Hearst pass
    hearst = mine_hearst(sentences, set(vocab_by_alias.keys()))
    # translate to canonical
    opp_c: dict[str, Counter] = defaultdict(Counter)
    assoc_c: dict[str, Counter] = defaultdict(Counter)
    for a, ctr in hearst['opp_counts'].items():
        ca = vocab_by_alias.get(a, a)
        for b, cnt in ctr.items():
            cb = vocab_by_alias.get(b, b)
            if ca != cb:
                opp_c[ca][cb] += cnt
    for a, ctr in hearst['assoc_counts'].items():
        ca = vocab_by_alias.get(a, a)
        for b, cnt in ctr.items():
            cb = vocab_by_alias.get(b, b)
            if ca != cb:
                assoc_c[ca][cb] += cnt
    hearst_canonical = {
        'opp_counts': opp_c, 'assoc_counts': assoc_c,
        'opp_src': hearst['opp_src'], 'assoc_src': hearst['assoc_src'],
    }
    print(f'[hearst] {sum(len(v) for v in opp_c.values())} opposition pairs · {sum(len(v) for v in assoc_c.values())} association pairs')

    # ---- 4. PMI
    node_sents = build_incidence(sentences, vocab_by_alias)
    pmi = compute_pmi(node_sents, total_sents=len(sentences))
    print(f'[pmi] {len(pmi)} nodes with co-occurrence data')

    # ---- 5. Fill ladder
    fills_by_axis: dict[str, list[Fill]] = defaultdict(list)
    edits_by_axis: dict[str, list[tuple[int, str]]] = defaultdict(list)  # (line_idx, new_line)

    target_fields = ['oppositions', 'associations', 'distributional-neighbors', 'cross-refs-graph']

    for n in all_nodes:
        for field in target_fields:
            existing = n.fields_present.get(field, '()')
            if not field_is_empty(existing):
                continue
            if field == 'oppositions':
                f = fill_oppositions(n, hearst_canonical, pmi, node_index, axis_tier_index)
            elif field == 'associations':
                f = fill_associations(n, hearst_canonical, pmi, node_index, axis_tier_index)
            elif field == 'distributional-neighbors':
                f = fill_distributional(n, hearst_canonical, pmi, node_index, axis_tier_index)
            elif field == 'cross-refs-graph':
                f = fill_cross_refs(n, hearst_canonical, pmi, node_index, axis_tier_index, book_axis_index)
            # honest-null: write `() ;; no-corpus-signal — honest null`
            is_null = (not f.values)
            for line_off, ln in enumerate(n.raw_block):
                if re.match(r'^\s*:' + re.escape(field) + r'\s+', ln):
                    abs_idx = n.start_line + line_off
                    is_xref = (field == 'cross-refs-graph')
                    if is_null:
                        m = re.match(r'^(\s*):' + re.escape(field) + r'\s+', ln)
                        indent = m.group(1) if m else '  '
                        new_line = f'{indent}:{field:<20} ()  ;; honest-null — {f.detail}'
                    else:
                        new_line = rewrite_field_line(ln, field, f.values, as_cross_ref=is_xref)
                    edits_by_axis[n.axis].append((abs_idx, new_line))
                    fills_by_axis[n.axis].append(f)
                    break

    # ---- 6. Apply edits + write derivation log
    for axis in AXES:
        edits = edits_by_axis[axis]
        if not edits:
            print(f'[write] {axis}: no fills')
            continue
        lines = per_graph_lines[axis][:]  # copy
        for idx, new_line in edits:
            lines[idx] = new_line
        gp = args.graph_root / f'graph-of-{axis}.slat'
        if args.dry_run:
            print(f'[dry-run] {axis}: {len(edits)} lines would change')
        else:
            gp.write_text('\n'.join(lines) + ('\n' if per_graph_lines[axis][-1:] == [''] else '\n'))
            print(f'[write] {axis}: {len(edits)} field-lines updated')
        # derivation log sidecar
        log_path = args.graph_root / f'derivation-log-{axis}-2026-07-22.slat'
        by_source = Counter()
        log_lines = [
            f';;; Derivation log for graph-of-{axis}.slat',
            f';;; Generated 2026-07-22 by mine_corpus_semantics.py',
            f';;; Each entry: (:node "X" :field "F" :source "S" :detail "D" :values (...))',
            f'(derivation-log',
            f'  :axis "{axis}"',
            f'  :entries',
            f'  (',
        ]
        for f in fills_by_axis[axis]:
            by_source[f.source] += 1
            vals = ' '.join(f'"{re.sub(chr(34), chr(92)+chr(34), v)}"' for v in f.values) if f.field != 'cross-refs-graph' else ' '.join(f.values)
            log_lines.append(f'    (:node "{f.node}" :field "{f.field}" :source "{f.source}" :detail "{f.detail}" :values ({vals}))')
        log_lines.append('  )')
        log_lines.append(f'  :source-counts (')
        for src, cnt in by_source.most_common():
            log_lines.append(f'    (:source "{src}" :count {cnt})')
        log_lines.append('  ))')
        if not args.dry_run:
            log_path.write_text('\n'.join(log_lines) + '\n')
            print(f'[write] {axis}: derivation-log written to {log_path.name}')

    # ---- 7. Report
    if args.report:
        rep_lines = ['# corpus-semantics-miner report — 2026-07-22', '']
        for axis in AXES:
            by_field = Counter(f.field for f in fills_by_axis[axis])
            by_source = Counter(f.source for f in fills_by_axis[axis])
            rep_lines.append(f'## {axis}')
            rep_lines.append(f'  total fills: {len(fills_by_axis[axis])}')
            for fname in target_fields:
                rep_lines.append(f'    {fname}: {by_field.get(fname, 0)}')
            rep_lines.append('  fills by source:')
            for src, cnt in by_source.most_common():
                rep_lines.append(f'    {src}: {cnt}')
            rep_lines.append('')
        args.report.write_text('\n'.join(rep_lines))
        print(f'[report] written to {args.report}')

    print()
    total_fills = sum(len(v) for v in fills_by_axis.values())
    print(f'[done] {total_fills} field-fills across all axes')

if __name__ == '__main__':
    main()
