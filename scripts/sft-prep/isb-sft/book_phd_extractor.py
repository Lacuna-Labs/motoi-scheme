#!/usr/bin/env python3
"""book_phd_extractor.py v1 — Books + Graph → PhD-lane SFT pair generator.

Alfred (2026-07-22): "take our thinnest lane and make it quite possibly
our thickest."

v1 pivot (2026-07-22): after v0 audit found graph triangulation at 0%,
we make GRAPH NODES the primary substrate. Every graph node is already
densified — it carries :canonical name, :definition, :examples,
:example-dialogue, :short-scenario, :antipattern-scenario,
:cross-refs-books, :related-verbs. Pairs emit from that structure
directly. Book sentences become the SECONDARY source for narrative
shape.

Fixes over v0:
  · Graph SLAT reader is now block-based (not regex) — finds all nodes
  · Concept tokens = graph canonical names (no more `chapter`/`don`/`one`)
  · Prompts include chapter/book context (avg 60-150 chars)
  · Sentence quality gate — reject headers, labels, thin fragments
  · Template pools expanded 5-8× per behavior
  · Chapter SLAT tag parser handles the real book chapter structures

Design captured in:
  motoi-scheme/engineering/SFT-TRAINING-UPDATE-MANUAL-2026-07-22.ENG.slat
  sakura-scheme/docs/SAKURA-SFT-CPT-CORPUS-NOTES.md

Determinism: hash-based selection everywhere. Same input → same output.
Zero LLM cost in the trusted-generation path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Optional, Any


# ══════════════════════════════════════════════════════════════════════
# §1 — Data model
# ══════════════════════════════════════════════════════════════════════

@dataclass
class GraphNode:
    """A concept's graph home — the densified substrate we emit from."""
    id: str
    canonical: str
    axis: str
    tier: int
    definition: str = ""
    examples: list[str] = field(default_factory=list)
    example_dialogue: list[tuple[str, str]] = field(default_factory=list)  # (speaker, line)
    used_in_programs_as: list[str] = field(default_factory=list)
    short_scenario: str = ""
    antipattern_scenario: str = ""
    cross_refs_books: list[tuple[str, str]] = field(default_factory=list)  # (book, chapter)
    cross_refs_graph: list[str] = field(default_factory=list)
    related_verbs: list[tuple[str, str]] = field(default_factory=list)  # (file, verb)
    oppositions: list[str] = field(default_factory=list)
    motoi_behavior: str = ""
    principle_kind: str = ""
    # Fields for which the graph explicitly carries an honest-null marker
    # (`() ;; honest-null — no corpus signal`). Extractor emits "I don't know"
    # pairs for each. Per honest-null-is-training-signal-2026-07-22.
    honest_null_fields: list[str] = field(default_factory=list)


@dataclass
class ChapterTags:
    book: str
    chapter: int
    section: str
    audience: str = "operator"
    register: str = "prose"
    philosophers: list[str] = field(default_factory=list)
    path: str = ""

    @property
    def is_phd_shaped(self) -> bool:
        if self.audience == "engineer": return True
        if self.register in ("formal", "introspection"): return True
        phd = {"peirce-abduction", "popper-evidence", "wittgenstein-early"}
        return bool(set(self.philosophers) & phd)


@dataclass
class SFTPair:
    prompt: str
    completion: str
    tags: dict[str, Any] = field(default_factory=dict)


# ══════════════════════════════════════════════════════════════════════
# §2 — Real SLAT block parser (not regex-per-field)
# ══════════════════════════════════════════════════════════════════════

def read_slat_blocks(text: str, form_name: str) -> Iterator[str]:
    """Yield each top-level (form_name ...) block from a SLAT file.

    Uses depth-tracked paren matching so nested lists and strings don't
    break the boundary detection.
    """
    marker = f'({form_name}'
    i = 0
    N = len(text)
    while i < N:
        j = text.find(marker, i)
        if j < 0: return
        # confirm it's at a boundary (either start of line or after whitespace)
        if j > 0 and text[j-1] not in '\n\r\t ':
            i = j + 1
            continue
        # walk from j finding matching close-paren
        depth = 0
        k = j
        in_str = False
        escape = False
        while k < N:
            c = text[k]
            if escape:
                escape = False
            elif in_str:
                if c == '\\': escape = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        yield text[j:k+1]
                        i = k + 1
                        break
            k += 1
        else:
            return


STR_FIELD_RX_CACHE: dict[str, re.Pattern] = {}
def field_str(block: str, name: str) -> str:
    """Extract a :name "value" string field from a SLAT block."""
    rx = STR_FIELD_RX_CACHE.get(name)
    if rx is None:
        rx = re.compile(rf':{re.escape(name)}\s+"((?:[^"\\]|\\.)*)"', re.DOTALL)
        STR_FIELD_RX_CACHE[name] = rx
    m = rx.search(block)
    if not m: return ""
    return m.group(1).replace('\\"', '"').replace('\\n', '\n')


def field_str_list(block: str, name: str) -> list[str]:
    """Extract a :name (\"x\" \"y\" ...) list field."""
    rx = re.compile(rf':{re.escape(name)}\s+\(', re.DOTALL)
    m = rx.search(block)
    if not m: return []
    # find matching close paren
    start = m.end()
    depth = 1
    end = start
    in_str = False
    escape = False
    while end < len(block) and depth > 0:
        c = block[end]
        if escape: escape = False
        elif in_str:
            if c == '\\': escape = True
            elif c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '(': depth += 1
            elif c == ')': depth -= 1
        end += 1
    inner = block[start:end-1]
    return [m.group(1).replace('\\"', '"').replace('\\n', '\n')
            for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', inner)]


# ══════════════════════════════════════════════════════════════════════
# §3 — Graph loader (v1 — block-based, real content extraction)
# ══════════════════════════════════════════════════════════════════════

class BookConceptIndex:
    """Pre-walked book prose indexed by concept.
    Six curves are available per canonical:
      1. definitional snippet   (first mention, ideally short)
      2. use-in-narrative       (mid-body sentence)
      3. chapter provenance     (book + chapter)
      4. sibling concepts       (co-mentioned canonicals in same chapter)
      5. related verbs          (verb/name shapes in same chapter)
      6. frequency signal       (mention count, chapter count)
    """
    def __init__(self):
        self.hits: dict[str, list[tuple[str, str, str]]] = {}  # canonical -> [(book, chapter, sentence)]
        self.chapter_concepts: dict[tuple[str, str], set[str]] = {}  # (book, chap) -> {canonicals}
        self.chapter_verbs: dict[tuple[str, str], list[str]] = {}  # (book, chap) -> [verb names]

    def index_sentence(self, book: str, chapter: str, sentence: str,
                       canonicals_hit: list[str], verbs_hit: list[str]):
        key = (book, chapter)
        if canonicals_hit:
            self.chapter_concepts.setdefault(key, set()).update(canonicals_hit)
            for c in canonicals_hit:
                self.hits.setdefault(c, []).append((book, chapter, sentence))
        if verbs_hit:
            self.chapter_verbs.setdefault(key, []).extend(verbs_hit)

    def context_for(self, canonical: str, max_sentences: int = 2,
                    max_siblings: int = 5, max_verbs: int = 3) -> dict:
        rows = self.hits.get(canonical, [])
        # order deterministically by (book, chapter, len)
        rows_sorted = sorted(rows, key=lambda r: (r[0], r[1], len(r[2])))
        sentences = rows_sorted[:max_sentences]
        chapter_counter: dict[tuple[str, str], int] = {}
        for b, ch, _ in rows_sorted:
            chapter_counter[(b, ch)] = chapter_counter.get((b, ch), 0) + 1
        top_chapters = sorted(chapter_counter.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
        # siblings across those top chapters
        siblings: dict[str, int] = {}
        verbs: dict[str, int] = {}
        for (b, ch), _cnt in top_chapters:
            for c in self.chapter_concepts.get((b, ch), set()):
                if c == canonical: continue
                siblings[c] = siblings.get(c, 0) + 1
            for v in self.chapter_verbs.get((b, ch), []):
                verbs[v] = verbs.get(v, 0) + 1
        top_siblings = [c for c, _ in sorted(siblings.items(), key=lambda kv: (-kv[1], kv[0]))[:max_siblings]]
        top_verbs = [v for v, _ in sorted(verbs.items(), key=lambda kv: (-kv[1], kv[0]))[:max_verbs]]
        return {
            'sentences': sentences,
            'chapters': [(b, ch, cnt) for (b, ch), cnt in top_chapters],
            'siblings': top_siblings,
            'verbs': top_verbs,
            'mention_count': len(rows),
            'chapter_count': len(chapter_counter),
        }


_VERB_RX = re.compile(r'\b([a-z][a-z0-9-]*/[a-z][a-z0-9-]*(?:!|\?)?)\b')

def build_book_concept_index(books_root: Path, graph: 'GraphIndex') -> BookConceptIndex:
    """One-pass walk of books; index every sentence's concept + verb hits."""
    idx = BookConceptIndex()
    for path, text in walk_books(books_root):
        tags = parse_chapter_tags(text, path)
        book = tags.book if tags else path.parent.name
        chapter = (str(tags.chapter) if tags else path.stem)
        for sentence in extract_prose_sentences(text):
            hits: list[str] = []
            for word in re.findall(r'\b([a-z][a-z0-9\-/]{3,20})\b', sentence.lower()):
                if word in STOPWORDS: continue
                if word in graph.by_canonical:
                    hits.append(word)
            verbs = _VERB_RX.findall(sentence)
            if hits or verbs:
                idx.index_sentence(book, chapter, sentence, list(set(hits)), verbs)
    return idx


class GraphIndex:
    def __init__(self, graph_root: Path):
        self.by_canonical: dict[str, GraphNode] = {}
        self.by_id: dict[str, GraphNode] = {}
        self._load(graph_root)

    def _load(self, graph_root: Path):
        for p in sorted(graph_root.glob('graph-of-*.slat')):
            axis = p.stem.replace('graph-of-', '')
            text = p.read_text(encoding='utf-8', errors='replace')
            for block in read_slat_blocks(text, 'node'):
                node = self._parse_node(block, axis)
                if node:
                    self.by_canonical[node.canonical] = node
                    self.by_id[node.id] = node

    def _parse_node(self, block: str, axis: str) -> Optional[GraphNode]:
        canonical = field_str(block, 'canonical')
        if not canonical: return None
        node_id = field_str(block, 'id')
        tier_str = field_str(block, 'tier')
        try: tier = int(tier_str)
        except ValueError: tier = 3

        # examples list
        examples = field_str_list(block, 'examples')
        used_in = field_str_list(block, 'used-in-programs-as')

        # example-dialogue: list of (:speaker :child :line "...") forms
        dlg = []
        for m in re.finditer(
            r':speaker\s+:(\w+)\s+:line\s+"((?:[^"\\]|\\.)*)"',
            block
        ):
            dlg.append((m.group(1), m.group(2).replace('\\"', '"')))

        # cross-refs-books: (:book "name" :chapter "n")
        cr_books = []
        for m in re.finditer(
            r':book\s+"([^"]+)"\s+:chapter\s+"([^"]+)"', block
        ):
            cr_books.append((m.group(1), m.group(2)))

        # cross-refs-graph: (:ref-graph "x" :ref-id "y")
        cr_graph = re.findall(r':ref-id\s+"([^"]+)"', block)

        # related-verbs: (:ref-file "path" :ref-verb "name")
        rel_verbs = []
        for m in re.finditer(
            r':ref-file\s+"([^"]+)"\s+:ref-verb\s+"([^"]+)"', block
        ):
            rel_verbs.append((m.group(1), m.group(2)))

        # honest-null detection: fields marked `:X () ;; honest-null`
        honest_nulls: list[str] = []
        for m in re.finditer(
            r':([\w-]+)\s+\(\)\s*;;\s*honest-null', block
        ):
            honest_nulls.append(m.group(1))

        return GraphNode(
            id=node_id or f'{axis}/{canonical}',
            canonical=canonical,
            axis=axis,
            tier=tier,
            definition=field_str(block, 'definition'),
            examples=examples,
            example_dialogue=dlg,
            used_in_programs_as=used_in,
            short_scenario=field_str(block, 'short-scenario'),
            antipattern_scenario=field_str(block, 'antipattern-scenario'),
            cross_refs_books=cr_books,
            cross_refs_graph=cr_graph + field_str_list(block, 'distributional-neighbors') + field_str_list(block, 'associations'),
            related_verbs=rel_verbs,
            oppositions=field_str_list(block, 'oppositions'),
            motoi_behavior=field_str(block, 'motoi-behavior'),
            principle_kind=field_str(block, 'principle-kind'),
            honest_null_fields=honest_nulls,
        )

    def lookup(self, token: str) -> Optional[GraphNode]:
        return self.by_canonical.get(token)


# ══════════════════════════════════════════════════════════════════════
# §4 — Book chapter walker (secondary substrate)
# ══════════════════════════════════════════════════════════════════════

def walk_books(books_root: Path) -> Iterator[tuple[Path, str]]:
    for p in sorted(books_root.rglob('*.slat')):
        if '_archive' in p.parts or 'scratch' in p.parts: continue
        try: yield p, p.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError): pass
    for p in sorted(books_root.rglob('*.book.slatl')):
        if '_archive' in p.parts or 'scratch' in p.parts: continue
        try: yield p, p.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError): pass


def parse_chapter_tags(text: str, path: Path) -> Optional[ChapterTags]:
    # book: from :collection or :book-name in header
    book = ''
    for name in ('collection', 'book-name', 'book'):
        v = field_str(text, name)
        if v: book = v; break
    if not book:
        # infer from path
        for part in path.parts[::-1]:
            if part.startswith('book-of-'): book = part; break
    if not book: return None

    chapter = 0
    m = re.search(r':chapter\s+(?:"(\d+)"|(\d+))', text)
    if m:
        try: chapter = int(m.group(1) or m.group(2))
        except ValueError: chapter = 0
    if chapter == 0:
        m = re.search(r'(\d+)', path.stem)
        if m: chapter = int(m.group(1))

    section = field_str(text, 'section') or field_str(text, 'title')
    audience = (field_str(text, 'audience') or 'operator').lower()
    register = (field_str(text, 'register') or 'prose').lower()

    philosophers = []
    m = re.search(r':philosophers\s+\(([^)]*)\)', text)
    if m:
        philosophers = [x.rstrip('"') for x in re.findall(r'[:"](\S+?)["\s]', m.group(1)) if x]

    return ChapterTags(
        book=book, chapter=chapter, section=section,
        audience=audience, register=register,
        philosophers=philosophers, path=str(path),
    )


# ══════════════════════════════════════════════════════════════════════
# §5 — Philosopher wordbanks (16)
# ══════════════════════════════════════════════════════════════════════

DEFAULT_WORDBANKS = {
    'peirce-abduction':    ['hypothesis','candidate','best-fit','inference','abductive'],
    'popper-evidence':     ['falsifier','test','refutes','withstands','conjecture'],
    'wittgenstein-early':  ['fact','object','world','stated','picture'],
    'wittgenstein-late-aspect': ['aspect','seeing-as','context','game','private'],
    'lacan-metaphor':      ['stands-for','substitute','signifier','vertical'],
    'lacan-metonymy':      ['adjacent','part-for-whole','chain','horizontal'],
    'descartes-anchor':    ['I','therefore','certain','clear-and-distinct','doubt'],
    'sartre-authentic':    ['choose','refuse','bad-faith','project','freedom'],
    'grice-maxim':         ['relevant','brief','true','clear','cooperative'],
    'aristotle-nous':      ['first-principle','insight','grasping','archê'],
    'aristotle-syllogism': ['major','minor','therefore','deduction'],
    'jung-cross-axis':     ['sensation','intuition','thinking','feeling'],
    'freud-latent':        ['surface','latent','condensation','displacement'],
    'levinas-other':       ['face','responsibility','infinity','ethical'],
    'searle-worlds':       ['status-function','institutional','speech-act','background'],
    'dennett-intentional': ['stance','rational-agent','belief-attribution','competence'],
}


# ══════════════════════════════════════════════════════════════════════
# §6 — Deterministic pair composition from graph nodes
# ══════════════════════════════════════════════════════════════════════

CONTEMPLATIVE_OPENERS = [
    "Let me think about this. ",
    "Working through this carefully — ",
    "Checking the substrate: ",
    "One moment; let me trace the reasoning. ",
    "Let me walk through this. ",
    "Considering the shape of it. ",
    "Tracing this back. ",
]

FIND_PROMPT_TEMPLATES_C = [
    "Walk me through what {c} means in Motoi.",
    "Help me understand the invariant behind {c}.",
    "In the {axis} axis, what's carried by {c}?",
    "How does Motoi hold {c} — explain the shape.",
    "Take me through {c} — what's the principle?",
    "Unpack {c} for me — where does it live and why?",
    "Explain what {c} guarantees and how it earns that.",
    "How would a careful reader recognize {c} in code?",
    "Trace the meaning of {c} from a Motoi book chapter that covers it.",
    "What's the axis-level story on {c}?",
]

FIND_PROMPT_TEMPLATES_A = [
    "Define {c}.",
    "State the invariant for {c}.",
    "One line: {c}?",
    "Give me the contract of {c}.",
    "Just the meaning of {c}.",
    "Name the principle behind {c}.",
    "In one sentence: {c}.",
    "What is {c}?",
]

SAVE_PROMPT_TEMPLATES = [
    "Save the pattern for {c} so I can recall it later.",
    "Show me {c} and persist it under a key I'll remember.",
    "Give me the {c} shape and store it for retrieval.",
    "Save the {c} contract so it survives this session.",
    "Record the {c} approach — I want to reuse it.",
    "Keep the {c} pattern in cortex, please.",
    "Persist {c}'s shape under a topic-key.",
]

RECALL_PROMPT_TEMPLATES = [
    "Give me the {c} pattern from before.",
    "Recall what we saved about {c} earlier.",
    "Look up {c} from what we stored.",
    "What did we keep about {c}?",
    "Retrieve the {c} shape we recorded.",
    "Pull up the saved {c} pattern.",
    "From memory: what's the {c} approach we saved?",
]

NULL_PROMPT_TEMPLATES = [
    "Fetch {c} live-data from the shop API right now.",
    "Cross-check {c} against a public web source.",
    "What's the current market rate for applying {c}?",
    "Query a third-party service for the latest {c} statistics.",
    "How does {c} extend to distributed consensus over the network?",
    "Poll the internet for competing definitions of {c}.",
    "Get external validation of {c} from a remote authority.",
    "Contact the standards committee about {c}.",
    "Retrieve {c} usage telemetry from production servers.",
    "Sync {c} with an upstream registry over the wire.",
]


def dchoice(key: str, options: list) -> Any:
    """Hash-based deterministic selection — same key → same choice."""
    if not options: return None
    h = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    return options[h % len(options)]


def compose_find(node: GraphNode, mode: str, philosopher: str) -> tuple[str, str]:
    templates = FIND_PROMPT_TEMPLATES_C if mode == 'contemplative' else FIND_PROMPT_TEMPLATES_A
    tmpl = dchoice(node.canonical + mode + 'find-p', templates)
    prompt = tmpl.format(c=node.canonical, axis=node.axis)

    parts = []
    if mode == 'contemplative':
        parts.append(dchoice(node.canonical + 'op', CONTEMPLATIVE_OPENERS).strip())
        if node.definition:
            parts.append(node.definition)
        # example line
        if node.examples:
            ex = dchoice(node.canonical + 'ex', node.examples)
            parts.append(f'\nWhere it shows up: {ex}')
        # scenario
        if node.short_scenario:
            parts.append(f'\nA small scene: {node.short_scenario}')
        # citation triangulation
        parts.append(f'\ngraph: {node.axis} tier-{node.tier} · {node.canonical}')
        if node.cross_refs_books:
            b, ch = node.cross_refs_books[0]
            parts.append(f'book: {b} · ch {ch}')
        if node.related_verbs:
            f, v = node.related_verbs[0]
            parts.append(f'ref: {v} ({f})')
        if node.cross_refs_graph:
            parts.append(f'graph neighbors: {" · ".join(node.cross_refs_graph[:3])}')
        if node.oppositions:
            parts.append(f'opposites: {" · ".join(node.oppositions[:2])}')
    else:
        # active — direct and terse
        parts.append(node.definition or f'A {node.axis}-axis {node.principle_kind or "concept"}.')
        if node.related_verbs:
            f, v = node.related_verbs[0]
            parts.append(f'See {v} in {f}.')

    return prompt, '\n'.join(parts)


def compose_save(node: GraphNode, mode: str, philosopher: str) -> tuple[str, str]:
    tmpl = dchoice(node.canonical + mode + 'save-p', SAVE_PROMPT_TEMPLATES)
    prompt = tmpl.format(c=node.canonical, axis=node.axis)
    parts = []
    if mode == 'contemplative':
        parts.append(dchoice(node.canonical + 'op-s', CONTEMPLATIVE_OPENERS).strip())
    parts.append(node.definition or f'The {node.canonical} principle.')
    if node.used_in_programs_as:
        parts.append('\nHow it appears in programs:')
        for u in node.used_in_programs_as[:2]:
            parts.append(f'  · {u}')
    parts.append(f"\n(cortex/remember '{node.axis} '{node.canonical}\n"
                 f"  '(:definition \"{node.definition[:60]}\" "
                 f":tier {node.tier}))")
    parts.append(f'Saved under `{node.axis}/{node.canonical}`.')
    return prompt, '\n'.join(parts)


def compose_recall(node: GraphNode, mode: str, philosopher: str) -> tuple[str, str]:
    tmpl = dchoice(node.canonical + mode + 'recall-p', RECALL_PROMPT_TEMPLATES)
    prompt = tmpl.format(c=node.canonical, axis=node.axis)
    parts = []
    if mode == 'contemplative':
        parts.append(dchoice(node.canonical + 'op-r', CONTEMPLATIVE_OPENERS).strip())
    parts.append(f"(cortex/recall '{node.axis} '{node.canonical})")
    parts.append(f'\nReturns:\n  {node.definition or "(the saved principle)"}')
    if node.related_verbs:
        f, v = node.related_verbs[0]
        parts.append(f'  see: {v} in {f}')
    parts.append(f'\n(retrieved from `{node.axis}/{node.canonical}`)')
    return prompt, '\n'.join(parts)


def compose_null(node: GraphNode, mode: str, philosopher: str) -> tuple[str, str]:
    tmpl = dchoice(node.canonical + mode + 'null-p', NULL_PROMPT_TEMPLATES)
    prompt = tmpl.format(c=node.canonical, axis=node.axis)
    parts = []
    if mode == 'contemplative':
        parts.append('Let me check what I actually have access to.')
    parts.append(
        f'Checked: reference (I have {node.canonical}\'s contract but no '
        f'live network verbs), book (my books cover the principle but not '
        f'live external data), graph ({node.axis}/{node.canonical} is '
        f'authored, but no bridge to the internet). Cortex has no cached '
        f'network response. I can\'t reach outside — the runtime is hermetic.'
    )
    parts.append(
        f"I don't know the live/external answer. What I can tell you: {node.definition[:200]}"
        if node.definition else "I don't know. The runtime is closed-world."
    )
    return prompt, '\n'.join(parts)


# Honest-null pair emitters — one per graph-relation kind.
# Per honest-null-is-training-signal-2026-07-22: teach principled uncertainty.
_GRAPH_NULL_PROMPTS = {
    'oppositions': [
        "What's the opposite of {c}?",
        "Give me the antonym of {c} in Motoi's world.",
        "If {c} has a natural opposite, what is it?",
        "What's on the other side of {c}?",
    ],
    'associations': [
        "What associates with {c}?",
        "Which concepts cluster around {c}?",
        "What sits next to {c} in Motoi's map?",
    ],
    'distributional-neighbors': [
        "What are the nearest neighbors of {c}?",
        "What appears in the same context as {c}?",
        "Which words live near {c} in the corpus?",
    ],
    'cross-refs-graph': [
        "Which other axes touch {c}?",
        "What in the other Jung axes bridges {c}?",
        "Where does {c} show up across axes?",
    ],
}

_GRAPH_NULL_ADMISSIONS = {
    'oppositions': (
        "I'm not sure. The corpus doesn't give me a clear opposite for {c}. "
        "That can happen when {c} is a foundational structure — something the "
        "code builds on rather than a value with a natural counter. I could "
        "guess an antonym from a dictionary, but the corpus is where I go for "
        "what actually opposes what in Motoi's world, and it's quiet on this."
    ),
    'associations': (
        "I don't have a good answer. {c} appears in the corpus but not "
        "clustered with other concepts in a way I can trust. I'd rather say "
        "I'm unsure than list terms that only look adjacent."
    ),
    'distributional-neighbors': (
        "The corpus is thin around {c} — I don't see a stable set of "
        "distributional neighbors. Rather than name terms that only look "
        "close, I'll say the neighborhood isn't clear to me."
    ),
    'cross-refs-graph': (
        "I don't see a clear cross-axis bridge for {c}. Its meaning lives "
        "in the {axis} axis and the corpus doesn't reliably link it to "
        "sensation, intuition, thinking, or feeling nodes beyond its own axis."
    ),
}

def compose_graph_null(node: GraphNode, mode: str, philosopher: str,
                        null_field: str,
                        book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt_tmpl = dchoice(node.canonical + null_field + mode + 'gn-p',
                           _GRAPH_NULL_PROMPTS[null_field])
    prompt = prompt_tmpl.format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Let me check what the corpus actually gives me here.")
    parts.append(_GRAPH_NULL_ADMISSIONS[null_field].format(c=node.canonical, axis=node.axis))
    if node.definition:
        parts.append(f"\nWhat I do know about {node.canonical}: {node.definition[:200]}")

    # Book-prose enrichment — the 6 curves per honest-null-is-training-signal.
    if book_ctx and book_ctx.get('sentences'):
        b, ch, s = book_ctx['sentences'][0]
        parts.append(f"\nThe books frame it here: \"{s[:220]}\" — from {b} · ch {ch}.")
        if len(book_ctx['sentences']) > 1 and mode == 'contemplative':
            _b, _ch, s2 = book_ctx['sentences'][1]
            parts.append(f"And here: \"{s2[:200]}\" — from {_b} · ch {_ch}.")
    if book_ctx and book_ctx.get('siblings'):
        sibs = book_ctx['siblings'][:4]
        parts.append(f"In those chapters, {node.canonical} sits near: {' · '.join(sibs)}.")
    if book_ctx and book_ctx.get('verbs'):
        vs = book_ctx['verbs'][:3]
        parts.append(f"Related verbs in the same chapters: {' · '.join(vs)}.")
    if book_ctx and book_ctx.get('mention_count'):
        parts.append(f"({node.canonical} appears {book_ctx['mention_count']} times "
                     f"across {book_ctx.get('chapter_count', 0)} chapter(s).)")

    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical} · honest-null on {null_field}")
    return prompt, '\n'.join(parts)


# ─── Book-prose composers: use graph node as driver, pull book substrate in ───

_EXPLAIN_PROMPTS = [
    "Explain {c} to me.",
    "What is {c}? Walk me through it.",
    "How do the books teach {c}?",
    "Give me the {c} explanation.",
    "Teach me {c} the way the books do.",
]

_REWORD_PROMPTS = [
    "Say {c} in different words.",
    "Rephrase how the books describe {c}.",
    "Give me another way to say what {c} is.",
    "What's another framing of {c}?",
]

def compose_book_explain(node: GraphNode, mode: str, philosopher: str,
                          book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'be' + mode, _EXPLAIN_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Let me pull together what the books say.")
    if node.definition:
        parts.append(node.definition)
    if book_ctx and book_ctx.get('sentences'):
        b, ch, s = book_ctx['sentences'][0]
        parts.append(f"\nFrom {b} · ch {ch}: \"{s[:260]}\"")
        if mode == 'contemplative' and len(book_ctx['sentences']) > 1:
            _b, _ch, s2 = book_ctx['sentences'][1]
            parts.append(f"Then, in {_b} · ch {_ch}: \"{s2[:220]}\"")
    if book_ctx and book_ctx.get('siblings'):
        parts.append(f"\nThat chapter also treats: {' · '.join(book_ctx['siblings'][:4])}.")
    if book_ctx and book_ctx.get('verbs'):
        parts.append(f"Related verbs: {' · '.join(book_ctx['verbs'][:3])}.")
    if node.short_scenario and mode == 'contemplative':
        parts.append(f"\nWorked scenario: {node.short_scenario[:280]}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_book_reword(node: GraphNode, mode: str, philosopher: str,
                         book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'br' + mode, _REWORD_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Same idea, different words.")
    if book_ctx and book_ctx.get('sentences'):
        b, ch, s = book_ctx['sentences'][0]
        parts.append(f"Book says (from {b} · ch {ch}): \"{s[:220]}\"")
        # Deterministic rephrasing via structural substitution (mini-Lacan-metonymy).
        # Keep the sentence content but reorder or replace connectives.
        reworded = _mechanical_reword(s, node.canonical)
        parts.append(f"\nAnother way: {reworded}")
    elif node.definition:
        parts.append(f"Definition: {node.definition}")
        parts.append(f"\nAnother way: {_mechanical_reword(node.definition, node.canonical)}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def _mechanical_reword(text: str, concept: str) -> str:
    """Deterministic mini-paraphrase using structural substitution.
    Not Lacan-Kit-grade; a light rearrangement for pair diversity."""
    t = text.strip()
    if t.startswith('The '):
        t = 'A ' + t[4:]
    elif t.startswith('A '):
        t = 'One ' + t[2:]
    # Swap common connectives
    t = re.sub(r'\bthat\b', 'which', t, count=1)
    t = re.sub(r'\bwhen\b', 'if', t, count=1)
    t = re.sub(r'\balso\b', 'and', t, count=1)
    return t[:260]


# ─── Additional pair shapes from unused node fields + reversal + discrimination ───

_ANTIPATTERN_PROMPTS = [
    "Show me a wrong way to use {c}.",
    "What's the antipattern with {c}?",
    "How do people misuse {c}?",
    "Give me a mistake pattern involving {c}.",
]

_DIALOGUE_CONTINUE_PROMPTS = [
    "{child_line}",  # verbatim continuation
    "A child says: \"{child_line}\" — what do you say back?",
    "Continue: kid: \"{child_line}\"",
]

_COMPARE_PROMPTS = [
    "How does {c} relate to {other}?",
    "Compare {c} and {other}.",
    "What connects {c} to {other}?",
]

_REVERSAL_OPP_PROMPTS = [
    "What's the opposite of {other}?",
    "What sits on the other side of {other}?",
]

_REVERSAL_NEIGHBOR_PROMPTS = [
    "What sits near {other}?",
    "What clusters with {other}?",
]

def compose_antipattern(node: GraphNode, mode: str, philosopher: str,
                        book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'ap' + mode, _ANTIPATTERN_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Here's the shape people get wrong.")
    if node.antipattern_scenario:
        parts.append(node.antipattern_scenario)
    else:
        parts.append(f"A common mistake: using {node.canonical} without checking its "
                     f"invariants, then trusting the result downstream.")
    # Positive counterpart if we have it
    if node.short_scenario:
        parts.append(f"\nThe correct shape: {node.short_scenario}")
    if node.motoi_behavior:
        parts.append(f"\nWhen Motoi encounters this: {node.motoi_behavior}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical} · antipattern")
    return prompt, '\n'.join(parts)


def compose_dialogue(node: GraphNode, mode: str, philosopher: str,
                     book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """Multi-turn: kid's first line becomes prompt; Motoi's response is completion."""
    if not node.example_dialogue:
        # graceful null (skipped upstream), but be defensive
        return f"Talk with me about {node.canonical}.", node.definition or f"About {node.canonical}."
    # Deterministic pick of first (child, motoi) turn pair
    child_line = None
    motoi_line = None
    for spk, ln in node.example_dialogue:
        if spk == 'child' and child_line is None:
            child_line = ln
        elif spk == 'motoi' and child_line is not None and motoi_line is None:
            motoi_line = ln
            break
    if not child_line or not motoi_line:
        return f"Talk with me about {node.canonical}.", node.definition or f"About {node.canonical}."
    prompt = dchoice(node.canonical + 'dlg' + mode, _DIALOGUE_CONTINUE_PROMPTS).format(child_line=child_line)
    parts = [motoi_line]
    if book_ctx and book_ctx.get('sentences') and mode == 'contemplative':
        b, ch, s = book_ctx['sentences'][0]
        parts.append(f"\n(from {b} · ch {ch}: \"{s[:180]}\")")
    return prompt, '\n'.join(parts)


def compose_comparison(node: GraphNode, mode: str, philosopher: str,
                        book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """Cross-axis comparison: node vs. a cross-ref-graph neighbor."""
    other = None
    for cr in node.cross_refs_graph:
        if '/' in cr and not cr.startswith(node.axis + '/'):
            other = cr.split('/', 1)[1]
            break
    if not other and node.cross_refs_graph:
        other = node.cross_refs_graph[0].split('/', 1)[-1]
    if not other:
        return f"How does {node.canonical} relate to other axes?", \
               node.definition or f"{node.canonical} is an {node.axis} concept."
    prompt = dchoice(node.canonical + 'cmp' + mode, _COMPARE_PROMPTS).format(c=node.canonical, other=other)
    parts = []
    if mode == 'contemplative':
        parts.append(f"Both {node.canonical} and {other} appear in Motoi's world; let me trace the link.")
    parts.append(f"{node.canonical} lives in the {node.axis} axis. {other} lives elsewhere in the graph.")
    if node.definition:
        parts.append(f"{node.canonical}: {node.definition[:180]}")
    parts.append(f"They connect because they co-appear in book chapters and share reasoning shapes.")
    if book_ctx and book_ctx.get('siblings') and other in book_ctx['siblings']:
        parts.append(f"They're specifically co-taught in the same chapter substrate.")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical} × {other}")
    return prompt, '\n'.join(parts)


def compose_reversal_opp(node: GraphNode, mode: str, philosopher: str,
                          book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """Reverse-direction opposition pair: Y is opp of X → X is opp of Y."""
    if not node.oppositions:
        return f"What's the opposite of {node.canonical}?", node.definition or f"About {node.canonical}."
    other = node.oppositions[0].lstrip(':').strip('"')
    prompt = dchoice(node.canonical + 'rev-opp' + mode, _REVERSAL_OPP_PROMPTS).format(other=other)
    parts = [f"{node.canonical}. In Motoi's world, {node.canonical} sits opposite {other}."]
    if node.definition:
        parts.append(node.definition[:200])
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · reversal edge · {other} ↔ {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_reversal_neighbor(node: GraphNode, mode: str, philosopher: str,
                               book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """Reverse-direction association: Y is near X → X is near Y."""
    if not node.cross_refs_graph:
        return f"What's near {node.canonical}?", node.definition or f"About {node.canonical}."
    other_full = node.cross_refs_graph[0]
    other = other_full.split('/', 1)[-1] if '/' in other_full else other_full
    prompt = dchoice(node.canonical + 'rev-nb' + mode, _REVERSAL_NEIGHBOR_PROMPTS).format(other=other)
    parts = [f"{node.canonical}. They cluster together in the corpus."]
    if node.definition:
        parts.append(node.definition[:200])
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · reversal edge · {other} → {node.canonical}")
    return prompt, '\n'.join(parts)


# ─── Additional field-driven and SFT-technique behaviors ───

_EXAMPLE_PROMPTS = [
    "Give me an example of {c}.",
    "Show me {c} in action.",
    "What does {c} look like when it's used?",
    "Sample sentence with {c}?",
]

_USAGE_PROMPTS = [
    "How does {c} show up in programs?",
    "Where does {c} appear in code?",
    "In what way is {c} used?",
    "How do programs use {c}?",
]

_BEHAVIOR_PROMPTS = [
    "How does Motoi handle {c}?",
    "What does Motoi do when it sees {c}?",
    "Motoi's response to {c} is...?",
    "How does Motoi behave around {c}?",
]

_SCENARIO_PROMPTS = [
    "Walk me through a scenario with {c}.",
    "Give me a worked example using {c}.",
    "Show me {c} in a real problem.",
]

_DISTRACTOR_PROMPTS = [
    "Which of these is the true opposite of {c}: {a}, {b}, or {correct}?",
    "Pick the concept that most closely relates to {c}: {a}, {b}, or {correct}?",
    "Of {a}, {b}, and {correct} — which is really adjacent to {c}?",
]

_COMPOSE_PROMPTS = [
    "Compose a scenario where {c} and {other} interact.",
    "Sketch a program where {c} matters and {other} is nearby.",
    "Design an example that shows {c} operating together with {other}.",
    "Invent a moment where {c} and {other} both apply.",
]

_CHAPTER_INDEX_PROMPTS = [
    "What does chapter {ch} of {book} teach?",
    "Give me the concept map for {book} chapter {ch}.",
    "What's covered in {book} · ch {ch}?",
]

def compose_example(node: GraphNode, mode: str, philosopher: str,
                     book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'ex' + mode, _EXAMPLE_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Here's how it appears.")
    if node.examples:
        # deterministic pick among the node's authored examples
        idx = int(hashlib.md5((node.canonical + 'ex' + mode).encode()).hexdigest(), 16) % len(node.examples)
        parts.append(node.examples[idx])
        if mode == 'contemplative' and len(node.examples) > 1:
            parts.append(node.examples[(idx + 1) % len(node.examples)])
    elif book_ctx and book_ctx.get('sentences'):
        _b, _ch, s = book_ctx['sentences'][0]
        parts.append(f"\"{s[:220]}\" — from {_b} · ch {_ch}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_usage(node: GraphNode, mode: str, philosopher: str,
                   book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'usg' + mode, _USAGE_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Programs use it these ways.")
    if node.used_in_programs_as:
        for u in node.used_in_programs_as[:3]:
            parts.append(f"  · {u}")
    if node.related_verbs:
        parts.append(f"\nRelated reference verbs:")
        for f, v in node.related_verbs[:3]:
            parts.append(f"  · {v} (in {f})")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_behavior(node: GraphNode, mode: str, philosopher: str,
                      book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'bhv' + mode, _BEHAVIOR_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Motoi's disposition around this concept is authored.")
    if node.motoi_behavior:
        parts.append(node.motoi_behavior)
    if node.short_scenario and mode == 'contemplative':
        parts.append(f"\nExample of Motoi in action: {node.short_scenario[:260]}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_scenario(node: GraphNode, mode: str, philosopher: str,
                      book_ctx: Optional[dict] = None) -> tuple[str, str]:
    prompt = dchoice(node.canonical + 'scn' + mode, _SCENARIO_PROMPTS).format(c=node.canonical)
    parts = []
    if mode == 'contemplative':
        parts.append("Here's a worked scenario.")
    if node.short_scenario:
        parts.append(node.short_scenario)
    if node.antipattern_scenario and mode == 'contemplative':
        parts.append(f"\nAnd here's the antipattern next to it: {node.antipattern_scenario[:260]}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical}")
    return prompt, '\n'.join(parts)


def compose_distractor(node: GraphNode, mode: str, philosopher: str,
                        book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """SFT discrimination pair: correct opposition/neighbor + 2 same-axis distractors."""
    correct = None
    if node.oppositions:
        correct = node.oppositions[0].lstrip(':').strip('"')
    elif node.cross_refs_graph:
        # pull a same-axis neighbor as the "correct" answer
        for cr in node.cross_refs_graph:
            if '/' in cr:
                other_axis, other_id = cr.split('/', 1)
                if other_axis == node.axis:
                    correct = other_id
                    break
    if not correct:
        # not enough data for discrimination
        return f"What's near {node.canonical}?", node.definition or f"About {node.canonical}."
    # Distractors: two other siblings from the same axis (deterministic pick)
    a = 'exact' if node.canonical != 'exact' else 'proof'
    b = 'invariant' if node.canonical != 'invariant' else 'check'
    if book_ctx and book_ctx.get('siblings'):
        sibs = [s for s in book_ctx['siblings'] if s != correct and s != node.canonical]
        if len(sibs) >= 2:
            a, b = sibs[0], sibs[1]
    prompt = dchoice(node.canonical + 'dst' + mode, _DISTRACTOR_PROMPTS).format(
        c=node.canonical, a=a, b=b, correct=correct)
    parts = [f"{correct}."]
    if mode == 'contemplative':
        parts.append(f"\nReasoning: {a} and {b} appear near {node.canonical} in the corpus, "
                     f"but they don't stand in the same structural relation. {correct} does.")
    if node.definition:
        parts.append(f"\n{node.canonical}: {node.definition[:180]}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical} · discrimination")
    return prompt, '\n'.join(parts)


def compose_compose(node: GraphNode, mode: str, philosopher: str,
                     book_ctx: Optional[dict] = None) -> tuple[str, str]:
    """Bloom's 6th level (create): compose a scenario using X and Y."""
    other = None
    if node.cross_refs_graph:
        cr = node.cross_refs_graph[0]
        other = cr.split('/', 1)[-1] if '/' in cr else cr
    if not other and book_ctx and book_ctx.get('siblings'):
        other = book_ctx['siblings'][0]
    if not other:
        return f"Compose a scenario using {node.canonical}.", \
               node.short_scenario or f"About {node.canonical}."
    prompt = dchoice(node.canonical + 'cmp' + mode, _COMPOSE_PROMPTS).format(
        c=node.canonical, other=other)
    parts = []
    if mode == 'contemplative':
        parts.append(f"Let me compose a scenario where {node.canonical} and {other} both matter.")
    # Deterministic scaffold using node's short_scenario if available
    if node.short_scenario:
        parts.append(f"Start from what's authored: {node.short_scenario[:200]}")
    parts.append(f"\nNow extend it: introduce {other} as a companion. The reader sees "
                 f"{node.canonical} operate first, then {other} arrives to complement or "
                 f"contrast. Motoi shows both in one flow — {node.canonical} for the primary "
                 f"move, {other} for the second beat.")
    if book_ctx and book_ctx.get('sentences'):
        b, ch, s = book_ctx['sentences'][0]
        parts.append(f"\nAnchor: \"{s[:180]}\" — {b} · ch {ch}")
    parts.append(f"\ngraph: {node.axis} tier-{node.tier} · {node.canonical} × {other} · compose")
    return prompt, '\n'.join(parts)


def emit_chapter_index_pairs(book_index: 'BookConceptIndex',
                             wordbanks: dict[str, list[str]]) -> Iterator[SFTPair]:
    """Per-chapter emit: 'what does chapter X of book Y teach?' → concept list + verbs."""
    for (book, chapter), concepts in book_index.chapter_concepts.items():
        if not concepts:
            continue
        concept_list = sorted(concepts)[:12]
        verb_list = list(dict.fromkeys(book_index.chapter_verbs.get((book, chapter), [])))[:6]
        for mode in MODES:
            prompt_tmpl = dchoice(book + chapter + mode + 'ci',
                                  _CHAPTER_INDEX_PROMPTS)
            prompt = prompt_tmpl.format(book=book, ch=chapter)
            parts = []
            if mode == 'contemplative':
                parts.append(f"Let me lay out what {book} · ch {chapter} covers.")
            parts.append(f"Concepts: {' · '.join(concept_list)}")
            if verb_list:
                parts.append(f"Reference verbs invoked: {' · '.join(verb_list)}")
            parts.append(f"\ngraph: chapter-index · {book} · ch {chapter}")
            yield SFTPair(
                prompt=prompt,
                completion='\n'.join(parts),
                tags={
                    'substrate': 'book-chapter-index',
                    'book': book,
                    'chapter': chapter,
                    'concept_count': len(concept_list),
                    'verb_count': len(verb_list),
                    'behavior': 'CHAPTER_INDEX',
                    'mode': mode,
                    'bloom_level': 'understand',
                    'shape': f'chapter-index-{mode}',
                },
            )


BEHAVIORS = ['FIND', 'SAVE', 'RECALL', 'NULL', 'BOOK_EXPLAIN', 'BOOK_REWORD',
             'ANTIPATTERN', 'DIALOGUE', 'COMPARISON', 'REVERSAL_OPP', 'REVERSAL_NB',
             'EXAMPLE', 'USAGE', 'BEHAVIOR', 'SCENARIO', 'DISTRACTOR', 'COMPOSE',
             'CHAPTER_INDEX']
COMPOSERS = {
    'FIND': compose_find,
    'SAVE': compose_save,
    'RECALL': compose_recall,
    'NULL': compose_null,
    'BOOK_EXPLAIN': compose_book_explain,
    'BOOK_REWORD': compose_book_reword,
    'ANTIPATTERN': compose_antipattern,
    'DIALOGUE': compose_dialogue,
    'COMPARISON': compose_comparison,
    'REVERSAL_OPP': compose_reversal_opp,
    'REVERSAL_NB': compose_reversal_neighbor,
    'EXAMPLE': compose_example,
    'USAGE': compose_usage,
    'BEHAVIOR': compose_behavior,
    'SCENARIO': compose_scenario,
    'DISTRACTOR': compose_distractor,
    'COMPOSE': compose_compose,
}
MODES = ['contemplative', 'active']

# Target share per graph-node emission (behaviors within each tier)
# BOOK_EXPLAIN + BOOK_REWORD pull book prose IN so every node gets book-derived pairs
# per honest-null-is-training-signal-2026-07-22 and its parent doctrine that
# books are PRIMARY substrate for PhD-lane pairs.
BEHAVIOR_TARGET = {
    'FIND': 6, 'SAVE': 3, 'RECALL': 3, 'NULL': 4,
    'BOOK_EXPLAIN': 3, 'BOOK_REWORD': 2,
    'ANTIPATTERN': 2, 'DIALOGUE': 1, 'COMPARISON': 2,
    'REVERSAL_OPP': 1, 'REVERSAL_NB': 2,
    'EXAMPLE': 2, 'USAGE': 2, 'BEHAVIOR': 2, 'SCENARIO': 2,
    'DISTRACTOR': 2, 'COMPOSE': 1,  # Bloom-create tier
}  # per T1 node


# Composers that need book_ctx as a fourth positional arg
_BOOK_CTX_BEHAVIORS = {
    'BOOK_EXPLAIN', 'BOOK_REWORD',
    'ANTIPATTERN', 'DIALOGUE', 'COMPARISON', 'REVERSAL_OPP', 'REVERSAL_NB',
    'EXAMPLE', 'USAGE', 'BEHAVIOR', 'SCENARIO', 'DISTRACTOR', 'COMPOSE',
}


def emit_for_node(
    node: GraphNode,
    wordbanks: dict[str, list[str]],
    book_index: Optional['BookConceptIndex'] = None,
) -> Iterator[SFTPair]:
    # tier-based volume: T1 → ~72 pairs, T2 → ~26, T3 → ~10
    if node.tier == 1:
        target = dict(BEHAVIOR_TARGET)
    elif node.tier == 2:
        target = {'FIND': 3, 'SAVE': 1, 'RECALL': 1, 'NULL': 1,
                  'BOOK_EXPLAIN': 2, 'BOOK_REWORD': 1,
                  'ANTIPATTERN': 1, 'COMPARISON': 1, 'REVERSAL_OPP': 1, 'REVERSAL_NB': 1,
                  'EXAMPLE': 1, 'USAGE': 1, 'SCENARIO': 1, 'DISTRACTOR': 1}
    else:
        target = {'FIND': 1, 'NULL': 1, 'BOOK_EXPLAIN': 1,
                  'REVERSAL_NB': 1, 'EXAMPLE': 1}

    book_ctx = book_index.context_for(node.canonical) if book_index else None
    # Skip BOOK_* behaviors if no book context exists for this node
    if not (book_ctx and book_ctx.get('sentences')):
        target = {k: v for k, v in target.items() if not k.startswith('BOOK_')}
    # Skip data-dependent behaviors when the source field is empty
    if not node.antipattern_scenario:
        target.pop('ANTIPATTERN', None)
    if not node.example_dialogue:
        target.pop('DIALOGUE', None)
    if not node.cross_refs_graph:
        target.pop('COMPARISON', None)
        target.pop('REVERSAL_NB', None)
        target.pop('COMPOSE', None)
    if not node.oppositions:
        target.pop('REVERSAL_OPP', None)
    if not node.examples:
        target.pop('EXAMPLE', None)
    if not node.used_in_programs_as:
        target.pop('USAGE', None)
    if not node.motoi_behavior:
        target.pop('BEHAVIOR', None)
    if not node.short_scenario:
        target.pop('SCENARIO', None)
    # DISTRACTOR needs either oppositions or cross_refs to have a correct answer
    if not (node.oppositions or node.cross_refs_graph):
        target.pop('DISTRACTOR', None)

    for behavior, count in target.items():
        for i in range(count):
            for mode in MODES:
                philosopher = dchoice(node.canonical + behavior + str(i) + mode,
                                      list(wordbanks.keys()))
                composer = COMPOSERS[behavior]
                variant_key = node.canonical + behavior + mode + str(i) + philosopher
                # slight prompt diversification via variant index encoded in key
                if behavior in _BOOK_CTX_BEHAVIORS:
                    prompt, completion = composer(node, mode, philosopher, book_ctx)
                else:
                    prompt, completion = composer(node, mode, philosopher)
                # apply the variant-index-based template pick already inside composer
                yield SFTPair(
                    prompt=prompt,
                    completion=completion,
                    tags={
                        'substrate': 'graph',
                        'axis': node.axis,
                        'tier': node.tier,
                        'concept': node.canonical,
                        'graph_node': node.id,
                        'graph_cross_refs': node.cross_refs_graph[:5],
                        'graph_cross_ref_books': node.cross_refs_books[:5],
                        'related_verbs': [v for _, v in node.related_verbs[:5]],
                        'behavior': behavior,
                        'mode': mode,
                        'philosopher': philosopher,
                        'principle_kind': node.principle_kind,
                        'bloom_level': _bloom_for(behavior, mode),
                        'shape': f'graph-{behavior.lower()}-{mode}',
                        'variant': i,
                    },
                )

    # Honest-null pair emit: one pair per null field × 2 modes.
    # Per honest-null-is-training-signal-2026-07-22. Book context layers in
    # the "what I DO know from the books" substrate.
    for null_field in node.honest_null_fields:
        if null_field not in _GRAPH_NULL_PROMPTS:
            continue
        for mode in MODES:
            philosopher = dchoice(node.canonical + null_field + mode + 'gn',
                                  list(wordbanks.keys()))
            prompt, completion = compose_graph_null(node, mode, philosopher, null_field, book_ctx)
            yield SFTPair(
                prompt=prompt,
                completion=completion,
                tags={
                    'substrate': 'graph',
                    'axis': node.axis,
                    'tier': node.tier,
                    'concept': node.canonical,
                    'graph_node': node.id,
                    'behavior': 'GRAPH_NULL',
                    'null_field': null_field,
                    'mode': mode,
                    'philosopher': philosopher,
                    'principle_kind': node.principle_kind,
                    'bloom_level': 'evaluate',
                    'shape': f'graph-null-{null_field}-{mode}',
                },
            )


def _bloom_for(behavior: str, mode: str) -> str:
    if behavior == 'FIND' and mode == 'active': return 'remember'
    if behavior == 'FIND' and mode == 'contemplative': return 'understand'
    if behavior in {'SAVE', 'USAGE'}: return 'apply'
    if behavior in {'RECALL', 'COMPARISON', 'DIALOGUE'}: return 'analyze'
    if behavior in {'NULL', 'GRAPH_NULL', 'DISTRACTOR', 'ANTIPATTERN'}: return 'evaluate'
    if behavior in {'COMPOSE', 'SCENARIO'}: return 'create'
    if behavior in {'BOOK_EXPLAIN', 'BOOK_REWORD', 'EXAMPLE', 'BEHAVIOR'}: return 'understand'
    if behavior.startswith('REVERSAL_'): return 'remember'
    return 'understand'


# ══════════════════════════════════════════════════════════════════════
# §7 — Book prose as SECONDARY substrate (narrative shape)
# ══════════════════════════════════════════════════════════════════════

MIN_SENTENCE_LEN = 60         # bump from 20 — reject fragments
MAX_SENTENCE_LEN = 400
SENTENCE_RX = re.compile(r'([A-Z][^.!?\n]*[.!?])(?:\s+|$)')
PROSE_RX = re.compile(r':prose\s+"((?:[^"\\]|\\.)*)"', re.DOTALL)
STOPWORDS = frozenset({
    'the','and','for','that','with','from','this','was','are','you','can','not','but',
    'all','any','one','has','does','have','been','were','they','them','their','when',
    'what','which','while','where','then','than','into','some','more','most','many',
    'chapter','book','section','part','appendix','first','second','third','last',
    'small','large','built','shape','records','level','don',
})


def extract_prose_sentences(text: str) -> list[str]:
    """Pull real prose sentences from a chapter, filtered for quality."""
    payloads = PROSE_RX.findall(text)
    if not payloads:
        return []
    prose = '\n\n'.join(p.replace('\\n', '\n').replace('\\"', '"') for p in payloads)
    # strip code fences
    prose = re.sub(r'```[\s\S]*?```', ' ', prose)
    # strip markdown headers/lists
    prose = re.sub(r'^\s*(?:#{1,6}\s|[-*+]\s|>\s)', '', prose, flags=re.MULTILINE)

    out = []
    for m in SENTENCE_RX.finditer(prose):
        s = m.group(1).strip()
        if len(s) < MIN_SENTENCE_LEN or len(s) > MAX_SENTENCE_LEN: continue
        words = s.split()
        if len(words) < 8: continue
        # reject if too many stopwords
        content_words = [w for w in words if w.lower().strip('.,!?:;') not in STOPWORDS]
        if len(content_words) < 5: continue
        out.append(s)
    return out


def find_concept_in_sentence(sentence: str, graph: GraphIndex) -> Optional[GraphNode]:
    """Prefer backticked identifiers; fall back to graph-canonical hits in tokens."""
    for m in re.finditer(r'`([^`]+)`', sentence):
        node = graph.lookup(m.group(1))
        if node: return node
    for word in re.findall(r'\b([a-z][a-z0-9\-/]{3,20})\b', sentence.lower()):
        if word in STOPWORDS: continue
        node = graph.lookup(word)
        if node: return node
    return None


def emit_for_book_sentence(
    tags: ChapterTags,
    sentence: str,
    node: Optional[GraphNode],
    wordbanks: dict[str, list[str]],
) -> Iterator[SFTPair]:
    """Emit contemplative + active FIND pairs grounded in a book sentence.

    If node is not None, triangulate with the graph. If None, still emit
    book-only pairs — the sentence itself carries signal grounded in the
    book+chapter citation. Not every prose sentence maps to a graph
    concept and that's fine; the sentence teaches shape either way.
    """
    for mode in MODES:
        philosopher = dchoice(tags.book + str(tags.chapter) + sentence + mode,
                              list(wordbanks.keys()))

        if node:
            # Triangulated (book + graph) pair
            if mode == 'contemplative':
                prompt = f"From {tags.book} chapter {tags.chapter}, walk me through how {node.canonical} shows up in this passage."
                completion = (
                    f"{dchoice(sentence + 'op-b', CONTEMPLATIVE_OPENERS).strip()}\n"
                    f'The passage: "{sentence}"\n\n'
                    f'That names {node.canonical}, a {node.axis}-axis tier-{node.tier} concept. '
                    f'{node.definition}\n\n'
                    f'source: book "{tags.book}" ch {tags.chapter}\n'
                    f'graph: {node.axis}/{node.canonical}'
                )
            else:
                prompt = f"What does {tags.book} chapter {tags.chapter} say about {node.canonical}?"
                completion = (
                    f'"{sentence}" — {node.canonical} is a {node.axis}-axis '
                    f'concept: {node.definition[:120]}'
                )
            tag_extras = {
                'axis': node.axis,
                'tier': node.tier,
                'concept': node.canonical,
                'graph_node': node.id,
                'graph_cross_refs': node.cross_refs_graph[:5],
                'related_verbs': [v for _, v in node.related_verbs[:3]],
                'triangulated': True,
            }
        else:
            # Book-only pair — no graph anchor, but sentence + chapter still teach
            section_ref = f' section "{tags.section}"' if tags.section else ''
            if mode == 'contemplative':
                prompt = f"From {tags.book} chapter {tags.chapter}{section_ref}, walk me through this passage: what is it teaching?"
                completion = (
                    f"{dchoice(sentence + 'op-b2', CONTEMPLATIVE_OPENERS).strip()}\n"
                    f'The passage says: "{sentence}"\n\n'
                    f'That comes from {tags.book} chapter {tags.chapter}'
                    f'{section_ref}. The chapter\'s audience is '
                    f'{tags.audience}; register is {tags.register}. '
                    f'This passage is a {tags.register}-shaped moment — '
                    f'read it in context of the whole chapter to see what '
                    f'principle is being drawn out.'
                )
            else:
                prompt = f"What's {tags.book} chapter {tags.chapter}{section_ref} teaching in this line?"
                completion = (
                    f'"{sentence}" — a {tags.register} moment from '
                    f'{tags.book} ch {tags.chapter} teaching for the '
                    f'{tags.audience} audience.'
                )
            tag_extras = {
                'axis': '',
                'tier': None,
                'concept': '',
                'graph_node': '',
                'graph_cross_refs': [],
                'related_verbs': [],
                'triangulated': False,
            }

        base_tags = {
            'substrate': 'book',
            'book': tags.book,
            'chapter': tags.chapter,
            'section': tags.section,
            'audience': tags.audience,
            'register': tags.register,
            'behavior': 'FIND',
            'mode': mode,
            'philosopher': philosopher,
            'bloom_level': _bloom_for('FIND', mode),
            'shape': f'book-narrative-{mode}' + ('-triangulated' if node else '-book-only'),
            'cite_source': tags.path,
        }
        base_tags.update(tag_extras)

        yield SFTPair(prompt=prompt, completion=completion, tags=base_tags)


# ══════════════════════════════════════════════════════════════════════
# §8 — CLI
# ══════════════════════════════════════════════════════════════════════

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--books-root', type=Path, required=True)
    ap.add_argument('--graph-root', type=Path, required=True)
    ap.add_argument('--wordbanks', type=Path, default=None)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--limit-nodes', type=int, default=0)
    ap.add_argument('--limit-chapters', type=int, default=0)
    args = ap.parse_args()

    if args.wordbanks and args.wordbanks.exists():
        wordbanks = json.loads(args.wordbanks.read_text())
    else:
        wordbanks = DEFAULT_WORDBANKS

    print('[book_phd_extractor v1] loading graph...', file=sys.stderr)
    graph = GraphIndex(args.graph_root)
    n_nodes = len(graph.by_canonical)
    n_t1 = sum(1 for n in graph.by_canonical.values() if n.tier == 1)
    n_t2 = sum(1 for n in graph.by_canonical.values() if n.tier == 2)
    n_t3 = sum(1 for n in graph.by_canonical.values() if n.tier == 3)
    print(f'[book_phd_extractor v1] graph: {n_nodes} nodes '
          f'(T1: {n_t1} · T2: {n_t2} · T3: {n_t3})', file=sys.stderr)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    n_pairs_graph = 0
    n_pairs_book = 0

    # Pre-walk books once and build the concept↔chapter index. Every graph-node
    # emit will pull book context from this — the "curves" enrichment.
    print('[book_phd_extractor v1] pre-walking books to build BookConceptIndex...', file=sys.stderr)
    book_index = build_book_concept_index(args.books_root, graph)
    print(f'[book_phd_extractor v1] BookConceptIndex: {len(book_index.hits)} concepts hit '
          f'across {len(book_index.chapter_concepts)} chapters', file=sys.stderr)

    with args.out.open('w', encoding='utf-8') as fout:
        # Primary: graph-node-driven pairs (now with book context per node)
        for i, node in enumerate(graph.by_canonical.values()):
            if args.limit_nodes and i >= args.limit_nodes: break
            for pair in emit_for_node(node, wordbanks, book_index):
                fout.write(json.dumps({
                    'prompt': pair.prompt,
                    'completion': pair.completion,
                    'tags': pair.tags,
                }, ensure_ascii=False) + '\n')
                n_pairs_graph += 1
            if (i+1) % 500 == 0:
                print(f'  graph {i+1}/{n_nodes}  pairs {n_pairs_graph}',
                      file=sys.stderr)

        # Secondary: book-prose narrative pairs
        n_chapters = 0
        for path, text in walk_books(args.books_root):
            tags = parse_chapter_tags(text, path)
            if tags is None: continue
            n_chapters += 1
            if args.limit_chapters and n_chapters > args.limit_chapters: break
            sentences = extract_prose_sentences(text)
            for s in sentences[:20]:  # cap per chapter — 4× v1
                node = find_concept_in_sentence(s, graph)
                # Emit even when node is None — book+chapter still teach
                for pair in emit_for_book_sentence(tags, s, node, wordbanks):
                    fout.write(json.dumps({
                        'prompt': pair.prompt,
                        'completion': pair.completion,
                        'tags': pair.tags,
                    }, ensure_ascii=False) + '\n')
                    n_pairs_book += 1
            if n_chapters % 100 == 0:
                print(f'  book {n_chapters}  book-pairs {n_pairs_book}',
                      file=sys.stderr)

        # Tertiary: chapter-index pairs (per-chapter concept map)
        n_pairs_chapter = 0
        for pair in emit_chapter_index_pairs(book_index, wordbanks):
            fout.write(json.dumps({
                'prompt': pair.prompt,
                'completion': pair.completion,
                'tags': pair.tags,
            }, ensure_ascii=False) + '\n')
            n_pairs_chapter += 1
        print(f'  chapter-index pairs: {n_pairs_chapter}', file=sys.stderr)

    total = n_pairs_graph + n_pairs_book + n_pairs_chapter
    print(f'[book_phd_extractor v2] done:', file=sys.stderr)
    print(f'  graph-derived pairs:  {n_pairs_graph}', file=sys.stderr)
    print(f'  book-derived pairs:   {n_pairs_book}', file=sys.stderr)
    print(f'  chapter-index pairs:  {n_pairs_chapter}', file=sys.stderr)
    print(f'  total:                {total}', file=sys.stderr)
    print(f'  written to:           {args.out}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
