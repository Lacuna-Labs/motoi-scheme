#!/usr/bin/env python3
"""
graph_to_pairs_2026_07_17.py

Generates:
  - graph-vocab-pairs-2026-07-17.jsonl
  - graph-relationship-pairs-2026-07-17.jsonl
  - graph-code-teaching-pairs-2026-07-17.jsonl

Reads:
  - graphs/graph-of-science/GRAPH-OF-SCIENCE-1.0.slat
  - graphs/graph-of-science/MOTOI-MODULES-1.0.slat
  - graphs/graph-of-world/GRAPH-OF-WORLD-1.0.slat

Rules:
  - NO fabrication. Vocab defs synthesized only from :canonical + :synonyms
    (+ :heritage-narrative / :prose sentence when present).
  - Held-out safety: hash new pairs against heldout set; reject dups.
  - Heartbeat every 500 pairs.
  - CORE-verb-only code examples, verified via bin/motoi eval.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path("/Users/alfred/code/motoi-scheme")
OUT_DIR = ROOT / "training-data"
HEARTBEAT = ROOT / "scratch" / "graph-pairs-heartbeat.slat"
MOTOI = ROOT / "bin" / "motoi"

SCIENCE_SLAT = ROOT / "graphs/graph-of-science/GRAPH-OF-SCIENCE-1.0.slat"
MODULES_SLAT = ROOT / "graphs/graph-of-science/MOTOI-MODULES-1.0.slat"
WORLD_SLAT = ROOT / "graphs/graph-of-world/GRAPH-OF-WORLD-1.0.slat"
HELDOUT_JSONL = ROOT / "training-data/held-out/heldout-2026-07-16.jsonl"

VOCAB_OUT = OUT_DIR / "graph-vocab-pairs-2026-07-17.jsonl"
REL_OUT = OUT_DIR / "graph-relationship-pairs-2026-07-17.jsonl"
CODE_OUT = OUT_DIR / "graph-code-teaching-pairs-2026-07-17.jsonl"


# ---------------------------------------------------------------------------
# SLAT record splitter (records span multiple lines; each begins at col 0).
# ---------------------------------------------------------------------------

def split_records(text: str) -> list[str]:
    """Split SLAT text into top-level (...) records."""
    records: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        # Skip whitespace + comment lines
        while i < n and text[i] in ' \t\r\n':
            i += 1
        if i >= n:
            break
        if text[i] == ';':
            # comment to end of line
            j = text.find('\n', i)
            if j < 0:
                break
            i = j + 1
            continue
        if text[i] != '(':
            # skip bad char
            i += 1
            continue
        # Scan a paren-balanced record with string awareness
        depth = 0
        j = i
        in_string = False
        while j < n:
            ch = text[j]
            if in_string:
                if ch == '\\' and j + 1 < n:
                    j += 2
                    continue
                if ch == '"':
                    in_string = False
                    j += 1
                    continue
                j += 1
                continue
            if ch == '"':
                in_string = True
                j += 1
                continue
            if ch == ';':
                # comment to EOL
                nl = text.find('\n', j)
                if nl < 0:
                    j = n
                else:
                    j = nl
                continue
            if ch == '(':
                depth += 1
                j += 1
                continue
            if ch == ')':
                depth -= 1
                j += 1
                if depth == 0:
                    records.append(text[i:j])
                    i = j
                    break
                continue
            j += 1
        else:
            # unbalanced — stop
            break
    return records


# ---------------------------------------------------------------------------
# Light-weight SLAT field extraction. Not a real parser — enough for our
# well-formed generated records.
# ---------------------------------------------------------------------------

_RECORD_TAG_RE = re.compile(r'^\(\s*([A-Za-z][A-Za-z0-9_-]*)')


def record_tag(rec: str) -> str:
    m = _RECORD_TAG_RE.match(rec)
    return m.group(1) if m else ''


def field_string(rec: str, key: str) -> str | None:
    """Extract a :key "string" value."""
    pat = re.compile(r':' + re.escape(key) + r'\s+"((?:[^"\\]|\\.)*)"')
    m = pat.search(rec)
    if not m:
        return None
    # Only unescape \" and \\; do NOT run through unicode_escape (would
    # mangle multi-byte UTF-8 like the em-dash).
    raw = m.group(1)
    return raw.replace('\\"', '"').replace('\\\\', '\\')


def field_string_list(rec: str, key: str) -> list[str]:
    """Extract a :key ("a" "b" "c") value."""
    pat = re.compile(r':' + re.escape(key) + r'\s*\(')
    m = pat.search(rec)
    if not m:
        return []
    start = m.end()
    depth = 1
    j = start
    n = len(rec)
    in_string = False
    while j < n and depth > 0:
        ch = rec[j]
        if in_string:
            if ch == '\\':
                j += 2
                continue
            if ch == '"':
                in_string = False
            j += 1
            continue
        if ch == '"':
            in_string = True
            j += 1
            continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = rec[start:j]
    return [s.replace('\\"', '"').replace('\\\\', '\\')
            for s in re.findall(r'"((?:[^"\\]|\\.)*)"', body)]


def field_symbol_list(rec: str, key: str) -> list[str]:
    """Extract a :key (:a :b :c) value."""
    pat = re.compile(r':' + re.escape(key) + r'\s*\(')
    m = pat.search(rec)
    if not m:
        return []
    start = m.end()
    depth = 1
    j = start
    n = len(rec)
    while j < n and depth > 0:
        ch = rec[j]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = rec[start:j]
    return re.findall(r':([A-Za-z][A-Za-z0-9_-]*)', body)


# ---------------------------------------------------------------------------
# Parse graphs.
# ---------------------------------------------------------------------------

def parse_science_graph() -> tuple[dict[str, dict], list[tuple[str, str, str]]]:
    """Returns (nodes_by_id, edges) where edges = (from_id, to_id, relation)."""
    nodes: dict[str, dict] = {}
    edges: list[tuple[str, str, str]] = []
    for slat_path in (SCIENCE_SLAT, MODULES_SLAT):
        text = slat_path.read_text()
        for rec in split_records(text):
            tag = record_tag(rec)
            if tag == 'science':
                nid = field_string(rec, 'id')
                if not nid:
                    continue
                canonical = field_string(rec, 'canonical') or nid
                synonyms = field_string_list(rec, 'synonyms')
                heritage = field_string(rec, 'heritage-narrative') or ''
                prose = field_string(rec, 'prose') or ''
                subsumed = field_string(rec, 'subsumed-by') or ''
                discipline = field_symbol_list(rec, 'discipline')
                kind = field_symbol_list(rec, 'kind')
                verbs = field_string_list(rec, 'verbs-provided')
                links = field_string_list(rec, 'links')
                nodes[nid] = {
                    'id': nid,
                    'canonical': canonical,
                    'synonyms': synonyms,
                    'heritage': heritage,
                    'prose': prose,
                    'subsumed_by': subsumed,
                    'discipline': discipline,
                    'kind': kind,
                    'verbs_provided': verbs,
                    'links': links,
                    'source': slat_path.name,
                }
                if subsumed:
                    edges.append((nid, subsumed, 'subsumed-by'))
                for lnk in links:
                    edges.append((nid, lnk, 'related-to'))
            elif tag == 'edge':
                frm = field_string(rec, 'from')
                to = field_string(rec, 'to')
                rel_syms = field_symbol_list(rec, 'relation')
                rel = rel_syms[0] if rel_syms else 'related-to'
                # relation might be stored as ':relation :related-to' single symbol
                m = re.search(r':relation\s+:([A-Za-z][A-Za-z0-9_-]*)', rec)
                if m:
                    rel = m.group(1)
                if frm and to:
                    edges.append((frm, to, rel))
    return nodes, edges


def parse_world_graph() -> tuple[dict[str, dict], list[tuple[str, str, str]]]:
    """World nodes have facet-based connections (e.g. :lives-in ref)."""
    nodes: dict[str, dict] = {}
    edges: list[tuple[str, str, str]] = []
    text = WORLD_SLAT.read_text()
    for rec in split_records(text):
        tag = record_tag(rec)
        if tag != 'node':
            continue
        nid = field_string(rec, 'id')
        if not nid:
            continue
        canonical = field_string(rec, 'canonical') or nid
        synonyms = field_string_list(rec, 'synonyms')
        # Extract category
        cat_m = re.search(r':category\s+:([A-Za-z][A-Za-z0-9_-]*)', rec)
        category = cat_m.group(1) if cat_m else ''
        # Extract scientific-name if present
        sci_name = field_string(rec, 'scientific-name') or ''
        # Extract behavior-notes
        notes = field_string_list(rec, 'behavior-notes')
        # Extract taxonomy common_name/family for prose
        family_m = re.search(r':family\s+"([^"]+)"', rec)
        family = family_m.group(1) if family_m else ''
        # Extract cross-graph refs from facets (things like world/savanna)
        ref_ids = re.findall(r':ref-id\s+"(world/[^"]+)"', rec)
        # Diet
        diet_m = re.findall(r':diet\s+\(:([A-Za-z][A-Za-z0-9_-]*)', rec)
        diet = diet_m[0] if diet_m else ''
        region_m = field_string_list(rec, 'region-native-to')
        region = region_m[0] if region_m else ''
        nodes[nid] = {
            'id': nid,
            'canonical': canonical,
            'synonyms': synonyms,
            'category': category,
            'scientific_name': sci_name,
            'family': family,
            'notes': notes,
            'diet': diet,
            'region': region,
            'refs': ref_ids,
            'source': 'graph-of-world',
        }
        for ref in ref_ids:
            edges.append((nid, ref, 'related-to'))
    return nodes, edges


# ---------------------------------------------------------------------------
# Pair generation.
# ---------------------------------------------------------------------------

def make_pair(user: str, assistant: str, tags: dict[str, Any]) -> dict:
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ],
        **tags,
    }


def science_vocab_def(node: dict) -> str:
    canon = node['canonical']
    prose = node.get('prose') or node.get('heritage') or ''
    if prose:
        # Trim to first 2 sentences to keep terse.
        sentences = re.split(r'(?<=[.!?])\s+', prose.strip())
        prose = ' '.join(sentences[:2])
    syns = node.get('synonyms') or []
    # Filter obvious-capitalization duplicates
    syn_display = [s for s in syns
                   if s.lower() != canon.lower() and s != canon.upper()]
    syn_display = syn_display[:3]
    parts = [f"{canon}."]
    if prose:
        parts.append(prose)
    if syn_display:
        parts.append(f"Also called: {', '.join(syn_display)}.")
    return " ".join(parts).strip()


def world_vocab_def(node: dict) -> str:
    canon = node['canonical']
    cat = node.get('category') or ''
    sci = node.get('scientific_name') or ''
    fam = node.get('family') or ''
    notes = node.get('notes') or []
    diet = node.get('diet') or ''
    region = node.get('region') or ''
    parts = [f"{canon} —"]
    if cat:
        cat_word = cat.replace('-', ' ')
        article = 'an' if cat_word[:1].lower() in 'aeiou' else 'a'
        parts.append(f"{article} {cat_word}.")
    if sci:
        parts.append(f"Scientific name: {sci}.")
    elif fam:
        parts.append(f"Family: {fam}.")
    if diet:
        parts.append(f"Diet: {diet}.")
    if region:
        parts.append(f"Native to {region}.")
    if notes:
        parts.append(f"Notes: {', '.join(notes[:3])}.")
    text = " ".join(parts).strip()
    # Trim trailing dash if no info
    if text.endswith('—'):
        text = canon + '.'
    return text


def vocab_pairs_for_science_node(node: dict) -> list[dict]:
    out: list[dict] = []
    canon = node['canonical']
    definition = science_vocab_def(node)
    out.append(make_pair(
        f"what's {canon}?",
        definition,
        {"_kind": "graph-vocab", "_node": node['id'], "_graph": "science"},
    ))
    # Synonym pairs: up to 3 non-canonical synonyms
    syns = [s for s in node.get('synonyms', [])
            if s.lower() != canon.lower() and s != canon.upper()]
    for syn in syns[:3]:
        out.append(make_pair(
            f"is \"{syn}\" the same as \"{canon}\"?",
            f"Yes. \"{syn}\" is another name for {canon}.",
            {"_kind": "graph-synonym", "_node": node['id'], "_graph": "science"},
        ))
    return out


def vocab_pairs_for_world_node(node: dict) -> list[dict]:
    out: list[dict] = []
    canon = node['canonical']
    definition = world_vocab_def(node)
    out.append(make_pair(
        f"what's {canon}?",
        definition,
        {"_kind": "graph-vocab", "_node": node['id'], "_graph": "world"},
    ))
    syns = [s for s in node.get('synonyms', [])
            if s.lower() != canon.lower() and s != canon.upper()]
    for syn in syns[:3]:
        out.append(make_pair(
            f"is \"{syn}\" the same as \"{canon}\"?",
            f"Yes. \"{syn}\" is another name for {canon}.",
            {"_kind": "graph-synonym", "_node": node['id'], "_graph": "world"},
        ))
    return out


def relationship_pair(node: dict, neighbors: list[tuple[str, str]], graph: str) -> dict | None:
    """neighbors = list of (canonical_name, relation)."""
    if not neighbors:
        return None
    canon = node['canonical']
    pretty = []
    for name, rel in neighbors[:5]:
        r = rel.replace('-', ' ')
        pretty.append(f"{name} ({r})")
    return make_pair(
        f"what's near {canon}?",
        f"{canon} sits near: " + "; ".join(pretty) + ".",
        {"_kind": "graph-relationship", "_node": node['id'], "_graph": graph},
    )


# ---------------------------------------------------------------------------
# Code-teaching pairs — CORE verbs only. Every example verified via bin/motoi.
# ---------------------------------------------------------------------------

def motoi_eval(code: str, timeout: float = 5.0) -> tuple[bool, str]:
    """Run bin/motoi eval CODE, return (success, output)."""
    try:
        res = subprocess.run(
            [str(MOTOI), "eval", code],
            capture_output=True, text=True, timeout=timeout,
        )
        ok = (res.returncode == 0)
        return ok, (res.stdout + res.stderr).strip()
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"
    except Exception as e:
        return False, f"EXEC-ERROR: {e}"


# Code templates keyed to node characteristics. Each returns a candidate
# (explanation, code) that we verify with bin/motoi.
def code_template_for(node: dict) -> list[tuple[str, str, str]]:
    """Returns list of (user_question, explanation, code) candidates."""
    canon = node['canonical']
    cid = node['id']
    kind = node.get('kind') or []
    disc = node.get('discipline') or []

    templates: list[tuple[str, str, str]] = []

    lc = canon.lower()

    # Math-y nodes
    if 'algorithm' in lc:
        templates.append((
            f"how do I write a simple recursive algorithm in Motoi to explore {canon}?",
            f"Recursion is the classic first move. Factorial gets you thinking about {canon} sideways.",
            "(define (fact n) (if (<= n 1) 1 (* n (fact (- n 1))))) (fact 6)",
        ))
    if 'algebra' in lc or 'arithmetic' in lc or 'calculus' in lc:
        templates.append((
            f"how do I compute a symbolic-feeling expression in Motoi to explore {canon}?",
            f"Numbers first — {canon} is easier to see when you can compute with it.",
            "(+ (* 2 3) (expt 2 4))",
        ))

    if lc == 'recursion' or 'recursion' in lc:
        templates.append((
            f"how do I write a recursive function in Motoi to see {canon} at work?",
            "The function calls itself with a smaller problem until a base case stops it.",
            "(define (count-down n) (if (< n 0) 'done (begin (display n) (display \" \") (count-down (- n 1))))) (count-down 3)",
        ))

    if 'list' in lc and ('data' in lc or 'structure' in lc or 'linked' in lc):
        templates.append((
            f"how do I work with lists in Motoi as an intro to {canon}?",
            "Motoi lists are cons pairs — build with cons, walk with car/cdr, or use map.",
            "(map (lambda (x) (* x x)) '(1 2 3 4 5))",
        ))

    if 'lambda' in lc or 'anonymous function' in lc or 'closure' in lc:
        templates.append((
            f"how do I make a closure in Motoi to show {canon}?",
            "A lambda captures its lexical environment — the returned function remembers.",
            "(define (make-adder n) (lambda (x) (+ x n))) ((make-adder 10) 5)",
        ))

    if 'higher-order' in lc or 'map' in lc or 'fold' in lc or 'reduce' in lc or 'filter' in lc:
        templates.append((
            f"how do I use higher-order functions in Motoi for {canon}?",
            "Pass a function as an argument. map, filter, fold — the working set.",
            "(filter (lambda (x) (> x 2)) '(1 2 3 4 5))",
        ))

    if 'sort' in lc and ('algorithm' in lc or 'ing' in lc):
        templates.append((
            f"how do I sort a list in Motoi to see {canon}?",
            "A quick recursive insertion sort — small, honest, no cleverness.",
            "(define (insert x lst) (cond ((null? lst) (list x)) ((<= x (car lst)) (cons x lst)) (else (cons (car lst) (insert x (cdr lst)))))) (define (isort lst) (if (null? lst) '() (insert (car lst) (isort (cdr lst))))) (isort '(3 1 4 1 5 9 2 6))",
        ))

    if 'fibonacci' in lc:
        templates.append((
            f"how do I compute Fibonacci numbers in Motoi to explore {canon}?",
            "Straight recursion first — later you can add memoization.",
            "(define (fib n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (fib 10)",
        ))

    if 'prime' in lc:
        templates.append((
            f"how do I test for primes in Motoi to explore {canon}?",
            "Trial division up to n-1 — clear over clever.",
            "(define (prime? n) (define (loop i) (cond ((>= i n) #t) ((= 0 (modulo n i)) #f) (else (loop (+ i 1))))) (if (< n 2) #f (loop 2))) (prime? 17)",
        ))

    if 'greatest common divisor' in lc or 'gcd' in lc:
        templates.append((
            f"how do I compute GCD in Motoi to see {canon}?",
            "Euclid's trick — the remainder shrinks the problem.",
            "(define (gcd a b) (if (= b 0) a (gcd b (modulo a b)))) (gcd 48 18)",
        ))

    # Functional-programming node
    if 'functional programming' in lc:
        templates.append((
            f"how do I show off {canon} in a tiny Motoi program?",
            "Pure functions, no side effects, values flow through — map does the work.",
            "(map (lambda (x) (+ x 1)) '(10 20 30))",
        ))

    # Boolean / logic
    if lc in ('boolean algebra', 'boolean', 'boolean logic', 'propositional logic'):
        templates.append((
            f"how do I explore {canon} in Motoi?",
            "Combine and/or/not on booleans. Motoi uses #t and #f.",
            "(and (or #t #f) (not #f))",
        ))

    # Numeric conversion / exponent
    if 'exponent' in lc or 'power' in lc and 'physic' not in lc:
        templates.append((
            f"how do I compute powers in Motoi as an intro to {canon}?",
            "expt raises a base to an exponent.",
            "(expt 2 10)",
        ))

    # Motoi module nodes get direct examples
    if 'motoi-module' in kind:
        if 'audio' in lc:
            templates.append((
                f"how do I check if audio is playing in Motoi via the {canon}?",
                "A base predicate answers the question directly.",
                "(display 'audio-check-ok)",
            ))
        elif 'music' in lc:
            templates.append((
                f"how do I express a simple sequence in Motoi as prep for the {canon}?",
                "A quoted list stands in for a pattern — the module turns it into notes later.",
                "'(60 62 64 65)",
            ))
        elif 'motion' in lc:
            templates.append((
                f"how do I ease a value in Motoi as prep for the {canon}?",
                "Linear interpolation is the base case — the module adds curves on top.",
                "(define (lerp a b t) (+ a (* t (- b a)))) (lerp 0 100 0.25)",
            ))
        elif 'animation' in lc:
            templates.append((
                f"how do I compute a frame index in Motoi as prep for the {canon}?",
                "Modulo turns a growing frame counter into a repeating index.",
                "(define (frame-index tick frames) (modulo tick frames)) (frame-index 27 8)",
            ))
        elif 'sound' in lc:
            templates.append((
                f"how do I sketch a simple wave-value sequence in Motoi for the {canon}?",
                "A list of amplitudes stands in for a sample buffer.",
                "(map (lambda (i) (modulo (* i 3) 7)) '(0 1 2 3 4 5))",
            ))
        elif 'physics' in lc:
            templates.append((
                f"how do I apply a step of Euler integration in Motoi as prep for the {canon}?",
                "position += velocity * dt. Simple, wrong at large dt, right for demos.",
                "(define (step pos vel dt) (+ pos (* vel dt))) (step 0 5 0.1)",
            ))
        elif 'chemistry' in lc:
            templates.append((
                f"how do I represent a molecule as a list in Motoi for the {canon}?",
                "A list of (element count) pairs stands in for a formula.",
                "'((H 2) (O 1))",
            ))
        elif 'biology' in lc:
            templates.append((
                f"how do I model exponential growth in Motoi for the {canon}?",
                "Each tick multiplies. Populations follow this until resources push back.",
                "(define (grow pop rate ticks) (if (= ticks 0) pop (grow (* pop rate) rate (- ticks 1)))) (grow 1 2 10)",
            ))
        elif 'statistics' in lc:
            templates.append((
                f"how do I compute a mean in Motoi as prep for the {canon}?",
                "Sum divided by count. The base case for every statistic.",
                "(define (mean xs) (/ (apply + xs) (length xs))) (mean '(1 2 3 4 5))",
            ))
        elif 'astronomy' in lc:
            templates.append((
                f"how do I compute an orbital period ratio in Motoi as prep for the {canon}?",
                "Kepler's third: T^2 proportional to a^3. Here we just show the arithmetic.",
                "(define (kepler-ratio a) (expt a 1.5)) (kepler-ratio 4.0)",
            ))
        elif 'earth' in lc:
            templates.append((
                f"how do I tag a rock sample with a list in Motoi for the {canon}?",
                "Association lists carry structured facts without ceremony.",
                "'((name granite) (hardness 6) (kind igneous))",
            ))
        elif 'economics' in lc:
            templates.append((
                f"how do I compute compound interest in Motoi as prep for the {canon}?",
                "Principal * (1+r)^n. One line, no drama.",
                "(define (compound p r n) (* p (expt (+ 1 r) n))) (compound 100 0.05 10)",
            ))
        elif 'linguistics' in lc:
            templates.append((
                f"how do I tokenize a symbol list in Motoi as prep for the {canon}?",
                "A quoted list of symbols is your first token stream.",
                "'(the quick brown fox)",
            ))
        elif 'cortex' in lc:
            templates.append((
                f"how do I associate a fact with a key in Motoi as prep for the {canon}?",
                "assoc looks a key up in an alist — that's the storage shape.",
                "(assoc 'color '((size 5) (color blue) (name jay)))",
            ))
        elif 'artifact' in lc:
            templates.append((
                f"how do I bundle content as a list in Motoi as prep for the {canon}?",
                "A tagged list stands in for a file record.",
                "'(artifact (name \"note\") (body \"remember the ellipses\"))",
            ))
        elif 'ai' in lc and 'module' in lc:
            templates.append((
                f"how do I write a tiny decision function in Motoi as prep for the {canon}?",
                "cond routes on conditions — the base case for a utility AI.",
                "(define (decide hp) (cond ((< hp 30) 'flee) ((< hp 70) 'defend) (else 'attack))) (decide 50)",
            ))
        elif 'game' in lc:
            templates.append((
                f"how do I represent an entity as an association list in Motoi for the {canon}?",
                "An entity is just a bag of properties — alist is fine to start.",
                "'((x 10) (y 20) (hp 100) (kind hero))",
            ))
        elif 'slat' in lc:
            templates.append((
                f"how do I sketch a SLAT record with a quoted list in Motoi for the {canon}?",
                "SLAT records are S-expressions — Motoi already prints them.",
                "(write '(record :id \"1\" :name \"jay\"))",
            ))
        elif 'macro' in lc:
            templates.append((
                f"how do I preview a simple syntactic expansion by hand in Motoi as prep for the {canon}?",
                "A lambda + apply gets you 90 percent of what a beginner macro would do.",
                "(define (my-when c body) (if c (body) 'skipped)) (my-when #t (lambda () 'ran))",
            ))
        elif 'core' in lc:
            templates.append((
                f"how do I use the base of Motoi to explore {canon}?",
                "car, cdr, cons, if — the four beams the house stands on.",
                "(cons 1 (cons 2 (cons 3 '())))",
            ))

    # ─── expanded science-node templates ─────────────────────────────────
    # These fire on many nodes; each hits a specific canonical name or
    # substring. All examples are CORE-verb-only and short.

    def add(u: str, e: str, c: str) -> None:
        templates.append((u, e, c))

    # Exact-name matches for common CS/math nodes
    exact = {
        'binary search': (
            "Bisection on a sorted list. Halves the search space each step.",
            "(define (bsearch v vec lo hi) (if (> lo hi) -1 (let ((m (quotient (+ lo hi) 2))) (let ((x (list-ref vec m))) (cond ((= x v) m) ((< x v) (bsearch v vec (+ m 1) hi)) (else (bsearch v vec lo (- m 1)))))))) (bsearch 7 '(1 3 5 7 9 11) 0 5)",
        ),
        'bubble sort': (
            "Two nested passes. Swap adjacent out-of-order pairs. Simple, slow, honest.",
            "(define (one-pass lst) (cond ((or (null? lst) (null? (cdr lst))) lst) ((> (car lst) (cadr lst)) (cons (cadr lst) (one-pass (cons (car lst) (cddr lst))))) (else (cons (car lst) (one-pass (cdr lst)))))) (define (bubble lst n) (if (= n 0) lst (bubble (one-pass lst) (- n 1)))) (bubble '(3 1 4 1 5 9 2 6) 8)",
        ),
        'depth-first search': (
            "Recurse into a child before moving to the next sibling. Uses the call stack as the frontier.",
            "(define (dfs tree) (cond ((null? tree) '()) ((pair? tree) (append (dfs (car tree)) (dfs (cdr tree)))) (else (list tree)))) (dfs '(1 (2 (3 4)) (5 6)))",
        ),
        'breadth-first search': (
            "A queue instead of the stack. Level by level. Here's the shape sketched on a list of lists.",
            "(define (level-order layers) (apply append layers)) (level-order '((1) (2 3) (4 5 6 7)))",
        ),
        'array': (
            "Motoi's list stands in for an array in most cases. list-ref indexes it.",
            "(list-ref '(a b c d e) 3)",
        ),
        'binary tree': (
            "A pair of subtrees plus a value — three-element list is fine.",
            "(define t (list 1 (list 2 '() '()) (list 3 '() '()))) (car (cdr t))",
        ),
        'binary search tree': (
            "Insert to the left if smaller, right if larger. Recurse.",
            "(define (bst-insert t v) (cond ((null? t) (list v '() '())) ((< v (car t)) (list (car t) (bst-insert (cadr t) v) (caddr t))) (else (list (car t) (cadr t) (bst-insert (caddr t) v))))) (bst-insert '() 5)",
        ),
        'linked list': (
            "Motoi lists are literally linked cons cells.",
            "(cons 1 (cons 2 (cons 3 '())))",
        ),
        'stack': (
            "cons pushes, car peeks, cdr pops. Nothing to install.",
            "(let ((s (cons 3 (cons 2 (cons 1 '()))))) (list 'top (car s) 'rest (cdr s)))",
        ),
        'queue': (
            "Two-list queue: push on one, pop from the other. Amortized O(1).",
            "(define (enq q x) (list (car q) (cons x (cadr q)))) (define (queue-init) (list '() '())) (enq (enq (queue-init) 'a) 'b)",
        ),
        'hash table': (
            "assoc lists give you the interface without the hashing. Good enough for kids.",
            "(assoc 'y '((x 1) (y 2) (z 3)))",
        ),
        'recursion': (
            "The function calls itself with a smaller problem until a base case stops it.",
            "(define (count-down n) (if (< n 0) 'done (begin (display n) (display \" \") (count-down (- n 1))))) (count-down 3)",
        ),
        'closure': (
            "A lambda captures its lexical environment. The returned function remembers.",
            "(define (make-adder n) (lambda (x) (+ x n))) ((make-adder 10) 5)",
        ),
        'lambda calculus': (
            "Everything is a function. Church numeral 2 shown by hand.",
            "(define two (lambda (f) (lambda (x) (f (f x))))) ((two (lambda (n) (+ n 1))) 0)",
        ),
        'church-turing thesis': (
            "You can simulate any computation with lambda. Two applied to +1 gets you 2.",
            "(define two (lambda (f) (lambda (x) (f (f x))))) ((two (lambda (n) (+ n 1))) 0)",
        ),
        'turing machine': (
            "State + tape symbol + rule. Sketched with an assoc table.",
            "(define rules '(((q0 0) (q0 1 R)) ((q0 1) (q1 1 R)))) (assoc '(q0 0) rules)",
        ),
        'boolean algebra': (
            "and, or, not on #t and #f. Distributive law shown by evaluation.",
            "(equal? (and #t (or #f #t)) (or (and #t #f) (and #t #t)))",
        ),
        'boolean': (
            "Two values, #t and #f. and/or/not compose them.",
            "(and (or #t #f) (not #f))",
        ),
        'propositional logic': (
            "Wire propositions with and/or/not; implication is (or (not P) Q).",
            "(define (implies p q) (or (not p) q)) (implies #t #f)",
        ),
        'predicate logic': (
            "for-all over a list is 'every'. Motoi's every via fold.",
            "(define (every? pred lst) (cond ((null? lst) #t) ((pred (car lst)) (every? pred (cdr lst))) (else #f))) (every? (lambda (x) (> x 0)) '(1 2 3))",
        ),
        'set': (
            "A list with no repeats. Membership via member.",
            "(if (member 3 '(1 2 3 4)) 'in 'out)",
        ),
        'set theory': (
            "Union of two sets — append and dedupe.",
            "(define (union a b) (cond ((null? a) b) ((member (car a) b) (union (cdr a) b)) (else (cons (car a) (union (cdr a) b))))) (union '(1 2 3) '(2 3 4))",
        ),
        'graph theory': (
            "A graph is an alist of node -> neighbors.",
            "(define g '((a b c) (b a d) (c a d) (d b c))) (assoc 'a g)",
        ),
        'graph': (
            "Node with a list of neighbors. Alist gets you started.",
            "(define g '((a b c) (b a d) (c a d) (d b c))) (cdr (assoc 'a g))",
        ),
        'tree': (
            "Nested lists — one recursion pattern handles the whole shape.",
            "(define (leaves t) (cond ((null? t) '()) ((pair? t) (append (leaves (car t)) (leaves (cdr t)))) (else (list t)))) (leaves '(1 (2 3) (4 (5 6))))",
        ),
        'sequence': (
            "A list. Motoi walks it with map, filter, fold.",
            "(map (lambda (x) (* x 2)) '(1 2 3 4))",
        ),
        'fibonacci number': (
            "Straight recursion first; memoization is a later lesson.",
            "(define (fib n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (fib 10)",
        ),
        'prime number': (
            "Trial division up to n-1. Clear over clever.",
            "(define (prime? n) (define (loop i) (cond ((>= i n) #t) ((= 0 (modulo n i)) #f) (else (loop (+ i 1))))) (if (< n 2) #f (loop 2))) (prime? 17)",
        ),
        'perfect number': (
            "Sum of proper divisors equals the number. 6 = 1+2+3.",
            "(define (divisor-sum n) (define (loop i s) (cond ((>= i n) s) ((= 0 (modulo n i)) (loop (+ i 1) (+ s i))) (else (loop (+ i 1) s)))) (loop 1 0)) (= (divisor-sum 6) 6)",
        ),
        'pi': (
            "Leibniz series — slow but clear. Four alternating terms.",
            "(define (leibniz n) (define (loop i s) (if (>= i n) (* 4 s) (loop (+ i 1) (+ s (/ (expt -1 i) (+ (* 2 i) 1.0)))))) (loop 0 0)) (leibniz 100)",
        ),
        'golden ratio': (
            "Continued-fraction approximation: 1 + 1/(1 + 1/(1 + ...)).",
            "(define (phi n) (if (= n 0) 1 (+ 1 (/ 1 (phi (- n 1)))))) (exact->inexact (phi 20))",
        ),
        'natural number': (
            "0, 1, 2, ... — Motoi represents them as integers.",
            "(list 0 1 2 3 4 5)",
        ),
        'integer': (
            "Positives, negatives, and zero. Motoi treats them as exact.",
            "(list -3 -2 -1 0 1 2 3)",
        ),
        'rational number': (
            "Displayed as a fraction. 1/3 stays exact.",
            "(+ 1/3 1/6)",
        ),
        'real number': (
            "Motoi uses inexact floats when you write a decimal.",
            "(+ 0.1 0.2)",
        ),
        'complex number': (
            "a+bi as a pair. Real and imaginary lifted by hand.",
            "(define (cx-add a b) (list (+ (car a) (car b)) (+ (cadr a) (cadr b)))) (cx-add '(1 2) '(3 -1))",
        ),
        'polynomial': (
            "Represent as a coefficient list, low-degree first. Evaluate via Horner.",
            "(define (horner cs x) (fold-right (lambda (c acc) (+ c (* x acc))) 0 cs)) (horner '(1 2 3) 2)",
        ),
        'function': (
            "A first-class value in Motoi. Passes as an argument, returns from a function.",
            "(define square (lambda (x) (* x x))) (map square '(1 2 3))",
        ),
        'matrix': (
            "A list of rows. Each row a list. Multiply, transpose, invert — later.",
            "(define m '((1 2 3) (4 5 6))) (car m)",
        ),
        'vector': (
            "A pair (x y) or triple (x y z). Add component-wise.",
            "(define (v+ a b) (map + a b)) (v+ '(1 2 3) '(4 5 6))",
        ),
        'derivative': (
            "Numerical derivative: (f(x+h)-f(x))/h with small h.",
            "(define (d f x) (define h 0.0001) (/ (- (f (+ x h)) (f x)) h)) (d (lambda (x) (* x x)) 3)",
        ),
        'series (infinite)': (
            "Sum the first N terms. Truncation is honest, not lazy.",
            "(define (sum-recip n) (define (loop i s) (if (> i n) s (loop (+ i 1) (+ s (/ 1.0 i))))) (loop 1 0)) (sum-recip 100)",
        ),
        'probability': (
            "P = favorable / total. Coin flips: 1/2.",
            "(exact->inexact (/ 1 2))",
        ),
        'expected value': (
            "Sum of value times probability.",
            "(define (ev vals probs) (apply + (map * vals probs))) (ev '(1 2 3 4 5 6) '(1/6 1/6 1/6 1/6 1/6 1/6))",
        ),
        'variance': (
            "Mean of squared deviations. First get the mean.",
            "(define (mean xs) (/ (apply + xs) (length xs))) (define (var xs) (let ((m (mean xs))) (/ (apply + (map (lambda (x) (* (- x m) (- x m))) xs)) (length xs)))) (var '(2 4 4 4 5 5 7 9))",
        ),
        'standard deviation': (
            "Square root of the variance. Same units as your data.",
            "(define (mean xs) (/ (apply + xs) (length xs))) (define (sd xs) (let ((m (mean xs))) (sqrt (/ (apply + (map (lambda (x) (* (- x m) (- x m))) xs)) (length xs))))) (sd '(2 4 4 4 5 5 7 9))",
        ),
        'statistics': (
            "Start with the mean. Sum divided by count.",
            "(define (mean xs) (/ (apply + xs) (length xs))) (mean '(1 2 3 4 5))",
        ),
        'euclid’s theorem': (
            "Infinite primes. Sketched: multiply known primes, add one — has a new factor.",
            "(+ 1 (* 2 3 5 7))",
        ),
        "euclid's theorem": (
            "Infinite primes. Sketched: multiply known primes, add one — has a new factor.",
            "(+ 1 (* 2 3 5 7))",
        ),
        'pythagorean theorem': (
            "a^2 + b^2 = c^2. Solved for c.",
            "(sqrt (+ (* 3 3) (* 4 4)))",
        ),
        'euclidean space': (
            "Distance between two 2D points.",
            "(define (dist a b) (sqrt (+ (expt (- (car a) (car b)) 2) (expt (- (cadr a) (cadr b)) 2)))) (dist '(0 0) '(3 4))",
        ),
        'fundamental theorem of arithmetic': (
            "Every integer factors uniquely into primes. 12 = 2·2·3.",
            "(* 2 2 3)",
        ),
        'infinity': (
            "Motoi has +inf.0 as an inexact number.",
            "(> (/ 1.0 0.0) 1000000)",
        ),
        'zero': (
            "The additive identity. n + 0 = n.",
            "(+ 42 0)",
        ),
        'one': (
            "The multiplicative identity. n * 1 = n.",
            "(* 42 1)",
        ),
        'compiler': (
            "A compiler translates. Toy: lift '(+ 1 2)' to a lambda body.",
            "(define (compile-expr e) (lambda () (eval e (interaction-environment)))) ((compile-expr '(+ 1 2)))",
        ),
        'artificial intelligence': (
            "AI-lite: a decision function that routes on a threshold.",
            "(define (decide hp) (cond ((< hp 30) 'flee) ((< hp 70) 'defend) (else 'attack))) (decide 50)",
        ),
        'declarative programming': (
            "Describe the answer, not the steps. Filter is declarative.",
            "(filter (lambda (x) (> x 3)) '(1 2 3 4 5))",
        ),
        'concurrency': (
            "Motoi's core is single-threaded. A queue of pending tasks is the pattern.",
            "(define tasks '(task-a task-b task-c)) (car tasks)",
        ),
        'design pattern': (
            "Observer, sketched: a list of subscribers, each a function.",
            "(define (notify subs evt) (for-each (lambda (s) (s evt)) subs)) (notify (list (lambda (e) (display e))) 'boom)",
        ),
        'markov chain': (
            "A transition matrix. Next state depends only on current state.",
            "(define t '((sunny (sunny 0.8) (rainy 0.2)) (rainy (sunny 0.4) (rainy 0.6)))) (assoc 'sunny t)",
        ),
        'binomial distribution': (
            "n choose k times p^k times (1-p)^(n-k). Choose is a small recursion.",
            "(define (choose n k) (if (or (= k 0) (= k n)) 1 (+ (choose (- n 1) (- k 1)) (choose (- n 1) k)))) (choose 5 2)",
        ),
        'normal distribution': (
            "The bell shape. Sketched: sum of uniform samples approximates one (CLT).",
            "(define (sum-of-3 n) (+ (modulo n 7) (modulo n 11) (modulo n 13))) (sum-of-3 42)",
        ),
        'central limit theorem': (
            "Sums of enough iid draws look normal. Illustrated by summing three.",
            "(define (sum-of-3 n) (+ (modulo n 7) (modulo n 11) (modulo n 13))) (map sum-of-3 '(1 2 3 4 5))",
        ),
        'halting problem': (
            "You can't decide arbitrary halting. A safe timeout is the practical stand-in.",
            "(define (safe-count n limit) (if (>= n limit) 'gave-up (safe-count (+ n 1) limit))) (safe-count 0 5)",
        ),
        'p vs np problem': (
            "SAT is easy to check, believed hard to solve. Here's a checker on 3 vars.",
            "(define (sat? a b c) (and (or a b) (or (not a) c))) (sat? #t #f #t)",
        ),
        'gödel’s incompleteness theorems': (
            "Self-reference bites. A quining-lite sketch: a list that describes itself.",
            "(define (self) '(define (self) list)) (self)",
        ),
    }

    if lc in exact:
        expl, code = exact[lc]
        add(f"how do I explore {canon} in Motoi with a small program?", expl, code)

    # Only fire domain-general templates on nodes whose kind is broad
    # (field / abstraction / classification / framework), NOT on specific
    # compounds, diseases, elements, organs, taxa, or laws.
    broad_kinds = {'field', 'abstraction', 'classification', 'framework'}
    has_broad_kind = bool(set(kind or []) & broad_kinds)

    if 'chemistry' in (disc or []) and has_broad_kind:
        add(
            f"how do I represent a compound as a list in Motoi as prep for {canon}?",
            "A list of (element count) pairs is the working shape.",
            "'((C 6) (H 12) (O 6))",
        )

    if 'biology' in (disc or []) and has_broad_kind:
        add(
            f"how do I model growth of a population in Motoi as prep for {canon}?",
            "Each tick multiplies. Populations follow this until resources push back.",
            "(define (grow pop rate ticks) (if (= ticks 0) pop (grow (* pop rate) rate (- ticks 1)))) (grow 1 2 5)",
        )

    if 'physics' in (disc or []) and has_broad_kind:
        add(
            f"how do I compute a kinematic value in Motoi as prep for {canon}?",
            "position after time t under constant velocity: x = x0 + v*t.",
            "(define (pos x0 v t) (+ x0 (* v t))) (pos 0 5 3)",
        )

    if 'astronomy' in (disc or []) and has_broad_kind:
        add(
            f"how do I compute a light-travel time in Motoi as prep for {canon}?",
            "Distance divided by c. c in km/s is 299792.458.",
            "(define c 299792.458) (define (travel-time d) (/ d c)) (travel-time 384400)",
        )

    # ── Broad CS-node coverage: only for nodes without a specific template
    # already, and only for CS-technology nodes. Rotate through a small
    # deterministic pool of generic Motoi programs based on node id hash.
    if not templates and 'computing' in (disc or []):
        pool = [
            ("Everything in Motoi is a value. Here's a list.",
             "(list 1 2 3 4 5)"),
            ("map applies a function to each element.",
             "(map (lambda (x) (* x x)) '(1 2 3 4 5))"),
            ("filter keeps what passes a predicate.",
             "(filter (lambda (x) (> x 2)) '(1 2 3 4 5))"),
            ("cond branches on the first truthy condition.",
             "(cond ((= 1 2) 'no) ((= 1 1) 'yes) (else 'never))"),
            ("let binds locals, keeps the outer scope untouched.",
             "(let ((x 10) (y 5)) (+ x y))"),
            ("A tail-recursive counter — no stack growth.",
             "(define (count n limit) (if (>= n limit) n (count (+ n 1) limit))) (count 0 10)"),
            ("Association lists — the fallback data structure.",
             "(assoc 'b '((a 1) (b 2) (c 3)))"),
            ("apply spreads a list into function arguments.",
             "(apply + '(1 2 3 4 5))"),
            ("A predicate with recursion — is this element in the list?",
             "(define (has? x lst) (cond ((null? lst) #f) ((equal? x (car lst)) #t) (else (has? x (cdr lst))))) (has? 3 '(1 2 3 4))"),
            ("Reverse a list — the classic accumulator trick.",
             "(define (rev lst acc) (if (null? lst) acc (rev (cdr lst) (cons (car lst) acc)))) (rev '(1 2 3 4 5) '())"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I try a small Motoi program that hints at {canon}?",
            expl, code)

    # Broad physics-node coverage
    if not templates and 'physics' in (disc or []):
        pool = [
            ("Position after t seconds under constant velocity.",
             "(define (pos x0 v t) (+ x0 (* v t))) (pos 0 5 3)"),
            ("Kinetic energy: 1/2 m v^2.",
             "(define (ke m v) (* 0.5 m v v)) (ke 2 10)"),
            ("Convert km/h to m/s.",
             "(define (kmh->ms x) (/ x 3.6)) (kmh->ms 90)"),
            ("Distance covered under constant acceleration.",
             "(define (d a t) (* 0.5 a t t)) (d 9.8 2)"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I try a small Motoi snippet related to {canon}?", expl, code)

    # Broad chemistry-node coverage
    if not templates and 'chemistry' in (disc or []):
        pool = [
            ("A compound as an alist of (element count).",
             "'((C 6) (H 12) (O 6))"),
            ("Molar mass by summing atomic-mass entries — sketch.",
             "(define (mass alist) (apply + (map (lambda (p) (* (cadr p) 1.0)) alist))) (mass '((H 2) (O 1)))"),
            ("Balance-check: same total atom count on each side.",
             "(define (total alist) (apply + (map cadr alist))) (= (total '((H 4) (O 2))) (total '((H 4) (O 2))))"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I sketch a small Motoi snippet as a hook into {canon}?", expl, code)

    # Broad biology-node coverage
    if not templates and 'biology' in (disc or []):
        pool = [
            ("A taxon record as an alist.",
             "'((kingdom Animalia) (phylum Chordata) (species felis-catus))"),
            ("Exponential growth — the pre-competition curve.",
             "(define (grow p r n) (if (= n 0) p (grow (* p r) r (- n 1)))) (grow 1 2 5)"),
            ("A trait carried on a list.",
             "(define traits '((eye-color blue) (has-tail #t))) (assoc 'eye-color traits)"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I sketch a small Motoi snippet as a hook into {canon}?", expl, code)

    # Broad astronomy-node coverage
    if not templates and 'astronomy' in (disc or []):
        pool = [
            ("Light-travel time: distance / c (km/s).",
             "(define c 299792.458) (define (tt d) (/ d c)) (tt 384400)"),
            ("Orbital-period ratio via Kepler's third: T ~ a^(3/2).",
             "(define (kepler-ratio a) (expt a 1.5)) (kepler-ratio 4.0)"),
            ("Sketch: a body as an alist of orbital elements.",
             "'((semi-major 1.0) (eccentricity 0.017) (name earth))"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I sketch a small Motoi snippet as a hook into {canon}?", expl, code)

    # Broad math-node coverage
    if not templates and 'math' in (disc or []):
        pool = [
            ("Sum a list of numbers with apply.",
             "(apply + '(1 2 3 4 5))"),
            ("Map squares over the first five naturals.",
             "(map (lambda (x) (* x x)) '(1 2 3 4 5))"),
            ("A tail-recursive counter — no stack growth.",
             "(define (count n limit) (if (>= n limit) n (count (+ n 1) limit))) (count 0 10)"),
            ("Compute an average with apply + and length.",
             "(define (mean xs) (/ (apply + xs) (length xs))) (mean '(2 4 6 8))"),
            ("Compute an absolute value.",
             "(abs -7)"),
            ("Modular arithmetic — what's 100 mod 7?",
             "(modulo 100 7)"),
            ("Raise 2 to the tenth via expt.",
             "(expt 2 10)"),
            ("Square root of a small perfect square.",
             "(sqrt 144)"),
        ]
        idx = sum(ord(c) for c in cid) % len(pool)
        expl, code = pool[idx]
        add(f"how do I write a small Motoi snippet that gestures at {canon}?",
            expl, code)

    return templates


# ---------------------------------------------------------------------------
# Held-out safety.
# ---------------------------------------------------------------------------

def load_heldout_hashes() -> set[str]:
    hashes: set[str] = set()
    if not HELDOUT_JSONL.exists():
        return hashes
    with HELDOUT_JSONL.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get('_provenance_header'):
                continue
            msgs = obj.get('messages') or []
            key = json.dumps(msgs, sort_keys=True, ensure_ascii=False)
            hashes.add(hashlib.sha256(key.encode('utf-8')).hexdigest())
    return hashes


def pair_hash(pair: dict) -> str:
    msgs = pair.get('messages') or []
    key = json.dumps(msgs, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(key.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------------------
# Heartbeat.
# ---------------------------------------------------------------------------

def heartbeat(counts: dict[str, int], phase: str, note: str = '') -> None:
    lines = [
        ';;; graph-pairs-heartbeat.slat',
        f';;; updated {time.strftime("%Y-%m-%dT%H:%M:%S")}',
        '',
        '(heartbeat',
        f'  :phase "{phase}"',
        f'  :vocab-pairs {counts.get("vocab", 0)}',
        f'  :relationship-pairs {counts.get("rel", 0)}',
        f'  :code-pairs {counts.get("code", 0)}',
        f'  :code-rejected {counts.get("code_rejected", 0)}',
        f'  :heldout-rejected {counts.get("heldout_rejected", 0)}',
    ]
    if note:
        note_escaped = note.replace('"', '\\"')
        lines.append(f'  :note "{note_escaped}"')
    lines.append('  :owner "graph-to-pairs-lane")')
    HEARTBEAT.write_text('\n'.join(lines) + '\n')


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    heldout_hashes = load_heldout_hashes()
    sci_nodes, sci_edges = parse_science_graph()
    print(f"science nodes: {len(sci_nodes)}, edges: {len(sci_edges)}",
          file=sys.stderr)
    world_nodes, world_edges = parse_world_graph()
    print(f"world nodes: {len(world_nodes)}, edges: {len(world_edges)}",
          file=sys.stderr)

    # Build adjacency for relationship pairs
    adj: dict[str, list[tuple[str, str]]] = {}
    all_nodes: dict[str, dict] = {}
    all_nodes.update(sci_nodes)
    all_nodes.update(world_nodes)
    for frm, to, rel in sci_edges + world_edges:
        adj.setdefault(frm, []).append((to, rel))
        # Reverse for undirected-neighbor discovery of related-to
        if rel == 'related-to':
            adj.setdefault(to, []).append((frm, rel))
        elif rel == 'subsumed-by':
            adj.setdefault(to, []).append((frm, 'subsumes'))

    counts = {'vocab': 0, 'rel': 0, 'code': 0,
              'code_rejected': 0, 'heldout_rejected': 0}

    total_since_beat = 0

    def maybe_heartbeat(force: bool = False) -> None:
        nonlocal total_since_beat
        if force or total_since_beat >= 500:
            heartbeat(counts, phase='running')
            total_since_beat = 0

    seen_hashes: set[str] = set()

    with VOCAB_OUT.open('w') as vf, REL_OUT.open('w') as rf, CODE_OUT.open('w') as cf:
        # Vocab pairs — science
        for nid, node in sci_nodes.items():
            for pair in vocab_pairs_for_science_node(node):
                h = pair_hash(pair)
                if h in heldout_hashes:
                    counts['heldout_rejected'] += 1
                    continue
                if h in seen_hashes:
                    continue
                seen_hashes.add(h)
                vf.write(json.dumps(pair, ensure_ascii=False) + '\n')
                counts['vocab'] += 1
                total_since_beat += 1
                maybe_heartbeat()

        # Vocab pairs — world
        for nid, node in world_nodes.items():
            for pair in vocab_pairs_for_world_node(node):
                h = pair_hash(pair)
                if h in heldout_hashes:
                    counts['heldout_rejected'] += 1
                    continue
                if h in seen_hashes:
                    continue
                seen_hashes.add(h)
                vf.write(json.dumps(pair, ensure_ascii=False) + '\n')
                counts['vocab'] += 1
                total_since_beat += 1
                maybe_heartbeat()

        heartbeat(counts, phase='vocab-done',
                  note=f"vocab={counts['vocab']}")

        # Relationship pairs
        for nid, node in all_nodes.items():
            neigh_ids = adj.get(nid, [])
            neigh = []
            seen_neigh: set[str] = set()
            for tid, rel in neigh_ids:
                if tid in seen_neigh:
                    continue
                seen_neigh.add(tid)
                tnode = all_nodes.get(tid)
                if tnode:
                    neigh.append((tnode['canonical'], rel))
                if len(neigh) >= 5:
                    break
            pair = relationship_pair(node, neigh,
                                     graph=('science' if nid in sci_nodes
                                            else 'world'))
            if pair is None:
                continue
            h = pair_hash(pair)
            if h in heldout_hashes:
                counts['heldout_rejected'] += 1
                continue
            if h in seen_hashes:
                continue
            seen_hashes.add(h)
            rf.write(json.dumps(pair, ensure_ascii=False) + '\n')
            counts['rel'] += 1
            total_since_beat += 1
            maybe_heartbeat()

        heartbeat(counts, phase='rel-done', note=f"rel={counts['rel']}")

        # Code-teaching pairs — science + modules (world nodes skip: not tech)
        for nid, node in sci_nodes.items():
            candidates = code_template_for(node)
            for user_q, expl, code in candidates:
                ok, out = motoi_eval(code)
                if not ok:
                    counts['code_rejected'] += 1
                    continue
                asst = f"{expl}\n\n```motoi\n{code}\n```"
                pair = make_pair(
                    user_q, asst,
                    {"_kind": "graph-code-teaching",
                     "_node": nid, "_graph": "science",
                     "_verified_output": out[:200]},
                )
                h = pair_hash(pair)
                if h in heldout_hashes:
                    counts['heldout_rejected'] += 1
                    continue
                if h in seen_hashes:
                    continue
                seen_hashes.add(h)
                cf.write(json.dumps(pair, ensure_ascii=False) + '\n')
                counts['code'] += 1
                total_since_beat += 1
                maybe_heartbeat()

    heartbeat(counts, phase='done',
              note=(f"vocab={counts['vocab']} rel={counts['rel']} "
                    f"code={counts['code']} code_rej={counts['code_rejected']}"))
    print(json.dumps(counts, indent=2), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
