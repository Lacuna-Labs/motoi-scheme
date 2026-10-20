#!/usr/bin/env python3
"""
carve-heldout-2026-07-16.py

Carve ~1,000 pairs from the Motoi Copilot training corpus into a held-out
validation set BEFORE any training run. Held-out pairs are marked in-place
in the source JSONLs with ``"held_out": true`` (provenance preserved) and
copied into:

  /Users/alfred/code/motoi-scheme/training-data/held-out/heldout-2026-07-16.jsonl

Stratification axes:
  * BOOK             — ~10% of each book's pairs (proportional).
  * EXTRACTOR (E1-E5)— inferred from pair shape; proportional within book.
  * VERB TIER        — STARVED / THIN / THIN-CONTEXT / HEALTHY tiers taken
                       from coverage audit; ensures rare-verb recall is
                       measurable.
  * LENGTH BUCKET    — SHORT / MEDIUM / LONG on assistant token estimate
                       (proxy: content char length / 4).

Deterministic — fixed seed 20260716. Same input files always give same
held-out sample.

Doctrine: NO DELETES. Every source JSONL is rewritten with the same pairs
(and same file order) — the only change is the addition of the
``"held_out": true`` key on carved pairs. Header line untouched.

Author: The Engineer (motoi-scheme corpus carving lane 2026-07-16)
"""
import json
import os
import re
import random
import sys
import hashlib
from collections import defaultdict, Counter

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

SEED = 20260716
TARGET_HELDOUT = 1000
HELDOUT_PCT = 0.10  # ~10% per book, before rebalancing

TRAINING_DIR = "/Users/alfred/code/motoi-scheme/training-data"
HELDOUT_DIR = os.path.join(TRAINING_DIR, "held-out")
HELDOUT_FILE = os.path.join(HELDOUT_DIR, "heldout-2026-07-16.jsonl")

COVERAGE_AUDIT = "/Users/alfred/code/lacuna-labs/reports/motoi-copilot-coverage-audit-2026-07-16.slat"

SOURCE_FILES = [
    "pilot-book-of-scheme-2026-07-16.jsonl",
    "wave-1-book-of-extensions-2026-07-16.jsonl",
    "wave-1-book-of-math-2026-07-16.jsonl",
    "wave-1-book-of-slat-2026-07-16.jsonl",
    "wave-2-book-of-animation-2026-07-16.jsonl",
    "wave-2-book-of-motion-2026-07-16.jsonl",
    "wave-2-book-of-music-2026-07-16.jsonl",
    "wave-2-book-of-sound-2026-07-16.jsonl",
    # NEW post-carve files (landed 2026-07-16 evening from parallel lanes)
    "wave-3-refusal-2026-07-16.jsonl",
    "response-shape-2026-07-16.jsonl",
]

os.makedirs(HELDOUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# VERB TIERS — parse from coverage audit
# ---------------------------------------------------------------------------

def load_verb_tiers():
    """Return {verb_name: tier} for STARVED/THIN/THIN-CONTEXT/HEALTHY."""
    tiers = {}  # verb -> tier
    with open(COVERAGE_AUDIT) as f:
        text = f.read()
    # Sections: (tier :name "STARVED" ... verbs ( ... (:verb "foo" ...) ... ))
    tier_pat = re.compile(
        r'\(tier :name "(STARVED|THIN|THIN-CONTEXT|HEALTHY)"[^(]*:verbs\s*\((.*?)\n\)\)',
        re.DOTALL,
    )
    verb_pat = re.compile(r':verb "([^"]+)"')
    for m in tier_pat.finditer(text):
        tname = m.group(1)
        block = m.group(2)
        for vm in verb_pat.finditer(block):
            tiers[vm.group(1)] = tname
    return tiers


# ---------------------------------------------------------------------------
# EXTRACTOR INFERENCE — from pair shape
# ---------------------------------------------------------------------------

CODE_FENCE_RE = re.compile(r"```motoi\n(.*?)```", re.DOTALL)
E3_USER_RE = re.compile(
    r"^Show me (a simple|an intermediate|a more elaborate|another) example of .* in Motoi Scheme\.$"
)
E5_USER_RE = re.compile(
    r"^In Motoi, I want to .*\. Which verb do I reach for\?$"
)
E2_USER_RE = re.compile(r"```motoi\n.*```", re.DOTALL)


def infer_extractor(pair, e4_e5_hand_curated_set, source_file=None):
    """Return E1/E2/E3/E4/E5/R/S based on pair shape.

    Priority:
      0. R: source file is wave-3-refusal-* (hand-authored refusal bucket).
         S: source file is response-shape-* (hand-authored persona/response
            shape bucket).
      1. E4/E5: matches a known hand-curated user string (loaded from extractor
         source). E5 also has a distinctive user shape.
      2. E3: user matches 'Show me a X example of Y in Motoi Scheme.'
      3. E2: user contains a ```motoi fence and assistant is prose-only.
      4. E1: default (user is a paraphrased question, assistant leads with
             a ```motoi fence).
    """
    if source_file:
        if source_file.startswith("wave-3-refusal"):
            return "R"
        if source_file.startswith("response-shape"):
            return "S"
    user = pair["messages"][0]["content"]
    assistant = pair["messages"][1]["content"]

    # E4/E5 hand-curated exact match
    if user in e4_e5_hand_curated_set:
        # Distinguish by shape:
        if E5_USER_RE.match(user):
            return "E5"
        return "E4"

    if E5_USER_RE.match(user):
        return "E5"

    if E3_USER_RE.match(user):
        return "E3"

    # E2: user has code fence (asking to explain code)
    if E2_USER_RE.search(user):
        return "E2"

    # Default: E1 (paraphrase question, assistant with code)
    return "E1"


def load_hand_curated_e4_e5():
    """Return the set of exact user strings from E4_BY_BOOK + E5_BY_BOOK.

    Reads directly from the wave-2 extractor source (which contains the
    canonical hand-curated pairs for wave-1 and wave-2 books)."""
    strings = set()
    for src in [
        "/Users/alfred/code/motoi-scheme/scratch/wave-1-extractor-2026-07-16.py",
        "/Users/alfred/code/motoi-scheme/scratch/wave-2-extractor-2026-07-16.py",
        "/Users/alfred/code/motoi-scheme/scratch/pilot-extractor-2026-07-16.py",
    ]:
        if not os.path.exists(src):
            continue
        with open(src) as f:
            text = f.read()
        # Grab any string that looks like an E4/E5 user prompt.
        # E5 form: "In Motoi, I want to ... Which verb do I reach for?"
        for m in re.finditer(
            r'"(In Motoi, I want [^"\\]*(?:\\.[^"\\]*)*\?)"', text
        ):
            strings.add(m.group(1))
        # E4 form: various "Write a small Motoi program..." etc.
        # Capture double-quoted strings that end in a question mark or period
        # AND appear in a tuple list context ((...text..., "..."), ...)
        # Simpler: gather all first-of-pair strings under E4_BY_BOOK block.
        e4_block_match = re.search(
            r"E4_BY_BOOK\s*=\s*\{(.*?)^\}\s*\n", text, re.DOTALL | re.MULTILINE
        )
        if e4_block_match:
            block = e4_block_match.group(1)
            # Every tuple: ("user", "assistant") — extract first string of each
            # tuple. Tuples start with '(' followed by whitespace and then
            # a double-quoted string.
            for m in re.finditer(
                r'\(\s*"((?:[^"\\]|\\.)*)"\s*,', block
            ):
                # Decode simple escapes
                s = m.group(1).encode().decode("unicode_escape")
                strings.add(s)
    return strings


# ---------------------------------------------------------------------------
# TOP VERB EXTRACTION FROM ASSISTANT CODE
# ---------------------------------------------------------------------------

VERB_TOKEN_RE = re.compile(r"^\s*\(\s*([a-zA-Z][a-zA-Z0-9!?/*+\-=><.]*)")


def extract_top_verb(pair):
    """Return the first non-primitive verb symbol in the assistant's code,
    or None if no code fence found. Used to bucket by verb tier."""
    assistant = pair["messages"][1]["content"]
    user = pair["messages"][0]["content"]
    # Consider both; assistant preferred.
    for text in (assistant, user):
        for m in CODE_FENCE_RE.finditer(text):
            code = m.group(1).strip()
            # Skip comment-only lines to find first form
            for line in code.splitlines():
                line = line.strip()
                if not line or line.startswith(";"):
                    continue
                vm = VERB_TOKEN_RE.match(line)
                if vm:
                    return vm.group(1)
                break  # first non-comment line only for this fence
    return None


# ---------------------------------------------------------------------------
# LENGTH BUCKET
# ---------------------------------------------------------------------------

def length_bucket(pair):
    """Bucket by combined content length (user + assistant chars).
    SHORT < 200, MEDIUM 200-800, LONG > 800."""
    total = sum(len(m["content"]) for m in pair["messages"])
    if total < 200:
        return "SHORT"
    if total < 800:
        return "MEDIUM"
    return "LONG"


# ---------------------------------------------------------------------------
# LOAD ALL PAIRS
# ---------------------------------------------------------------------------

def load_all():
    """Read every JSONL. Return (headers_by_file, pairs).

    Each pair dict gets tacked with:
      _pair_key   = (file, line_num) — stable identity for marking held-out
      _book       = book-of-X derived from filename
      _extractor  = E1..E5
      _top_verb   = or None
      _tier       = tier label (STARVED/...) or 'UNTAGGED' if verb not found
      _length     = SHORT/MEDIUM/LONG
    """
    verb_tiers = load_verb_tiers()
    hand_curated = load_hand_curated_e4_e5()
    print(f"[carve] loaded {len(verb_tiers)} verb tier entries")
    print(f"[carve] loaded {len(hand_curated)} hand-curated E4/E5 user strings")

    headers = {}
    pairs = []
    for fname in SOURCE_FILES:
        path = os.path.join(TRAINING_DIR, fname)
        with open(path) as f:
            lines = f.readlines()
        header = json.loads(lines[0])
        headers[fname] = header
        # Book id: prefer explicit book/book_name from header; else derive
        # a canonical id from the filename (strips date + extension).
        book = header.get("book") or header.get("book_name")
        if not book:
            # e.g. "wave-3-refusal-2026-07-16.jsonl" -> "wave-3-refusal"
            stem = fname.rsplit(".", 1)[0]
            # strip trailing -YYYY-MM-DD if present
            book = re.sub(r"-\d{4}-\d{2}-\d{2}$", "", stem)
        for i, line in enumerate(lines[1:], start=1):
            line = line.strip()
            if not line:
                continue
            pair = json.loads(line)
            # If a prior carve run marked this pair, clear the marker — the
            # new run makes a fresh deterministic selection from the current
            # corpus snapshot. Same seed + same input files = same sample.
            pair.pop("held_out", None)
            pair["_pair_key"] = (fname, i)
            pair["_book"] = book
            pair["_extractor"] = infer_extractor(pair, hand_curated, source_file=fname)
            tv = extract_top_verb(pair)
            pair["_top_verb"] = tv
            pair["_tier"] = verb_tiers.get(tv, "UNTAGGED") if tv else "UNTAGGED"
            pair["_length"] = length_bucket(pair)
            pairs.append(pair)
    return headers, pairs


# ---------------------------------------------------------------------------
# STRATIFIED SAMPLE
# ---------------------------------------------------------------------------

def stratified_sample(pairs, rng):
    """Take ~10% from each (book, extractor) cell, then ensure verb-tier
    representation, then trim/expand to hit TARGET_HELDOUT.

    Two-pass strategy:
      Pass 1: for each (book, extractor) cell, sample 10% (min 1 if cell
              non-empty). This preserves book+extractor proportions.
      Pass 2: audit tier distribution; if any tier is under-represented
              relative to corpus share by > 2%, boost that tier by adding
              additional pairs (drawn from tier-only pool) up to a cap.
      Pass 3: if final count > TARGET_HELDOUT, uniform-random drop to hit
              target. If < TARGET_HELDOUT, top up with uniform sample from
              remaining pool.
    """
    # Group by (book, extractor)
    by_cell = defaultdict(list)
    for p in pairs:
        by_cell[(p["_book"], p["_extractor"])].append(p)

    selected = set()  # set of _pair_key

    # Pass 1
    for cell, cell_pairs in by_cell.items():
        n = max(1, round(len(cell_pairs) * HELDOUT_PCT))
        n = min(n, len(cell_pairs))
        sampled = rng.sample(cell_pairs, n)
        for p in sampled:
            selected.add(p["_pair_key"])

    print(f"[carve] pass 1 selected {len(selected)} pairs from book x extractor cells")

    # Pass 2: tier rebalance
    tier_totals = Counter(p["_tier"] for p in pairs)
    tier_selected = Counter(
        p["_tier"] for p in pairs if p["_pair_key"] in selected
    )
    corpus_size = len(pairs)
    heldout_size_target = TARGET_HELDOUT
    for tier, corpus_count in tier_totals.items():
        expected_share = corpus_count / corpus_size
        expected_heldout = expected_share * heldout_size_target
        current = tier_selected[tier]
        gap = int(round(expected_heldout - current))
        if gap > 0 and tier != "UNTAGGED":  # Don't force UNTAGGED to fill
            # Add up to `gap` more from this tier's remaining pool
            tier_pool = [
                p for p in pairs
                if p["_tier"] == tier and p["_pair_key"] not in selected
            ]
            add = min(gap, len(tier_pool))
            for p in rng.sample(tier_pool, add):
                selected.add(p["_pair_key"])

    print(f"[carve] after tier rebalance: {len(selected)} pairs")

    # Pass 3: hit target
    if len(selected) > TARGET_HELDOUT:
        # Randomly drop, but PRESERVE at least 1 per (book, extractor) cell
        # if that cell is non-empty in original corpus.
        must_keep = set()
        by_cell_selected = defaultdict(list)
        for p in pairs:
            if p["_pair_key"] in selected:
                by_cell_selected[(p["_book"], p["_extractor"])].append(p["_pair_key"])
        for cell, keys in by_cell_selected.items():
            # Keep at least one per cell
            must_keep.add(rng.choice(keys))
        droppable = list(selected - must_keep)
        rng.shuffle(droppable)
        excess = len(selected) - TARGET_HELDOUT
        for k in droppable[:excess]:
            selected.discard(k)
    elif len(selected) < TARGET_HELDOUT:
        # Top up
        remainder = [p for p in pairs if p["_pair_key"] not in selected]
        need = TARGET_HELDOUT - len(selected)
        need = min(need, len(remainder))
        for p in rng.sample(remainder, need):
            selected.add(p["_pair_key"])

    print(f"[carve] final held-out count: {len(selected)}")
    return selected


# ---------------------------------------------------------------------------
# WRITE OUTPUTS
# ---------------------------------------------------------------------------

def strip_internal_keys(pair):
    """Return a JSON-serializable pair (drop internal _-prefixed keys)."""
    return {k: v for k, v in pair.items() if not k.startswith("_")}


def write_heldout(pairs, selected):
    """Write the held-out JSONL with a provenance header + selected pairs.

    Each pair carries an added ``held_out: true`` key and a
    ``_source_file`` / ``_source_line`` for traceability."""
    header = {
        "_provenance_header": True,
        "generated_at": "2026-07-16T21:00:00Z",
        "generator": "carve-heldout-2026-07-16.py",
        "purpose": "VALIDATION-HELD-OUT — DO NOT TRAIN",
        "seed": SEED,
        "target_size": TARGET_HELDOUT,
        "actual_size": len(selected),
        "source_files": SOURCE_FILES,
        "readme": "/Users/alfred/code/motoi-scheme/training-data/held-out/README.slat",
        "contract": "Pairs in this file MUST NOT appear in any training corpus. Each source JSONL has been marked in-place with 'held_out': true on the same pairs.",
    }
    with open(HELDOUT_FILE, "w") as f:
        f.write(json.dumps(header) + "\n")
        for p in pairs:
            if p["_pair_key"] not in selected:
                continue
            out = strip_internal_keys(p)
            out["held_out"] = True
            out["_source_file"] = p["_pair_key"][0]
            out["_source_line"] = p["_pair_key"][1]
            f.write(json.dumps(out) + "\n")


def rewrite_source_jsonls(headers, pairs, selected):
    """Overwrite each source JSONL, adding 'held_out': true to the sampled
    pairs. Header line preserved as-is."""
    by_file = defaultdict(list)
    for p in pairs:
        by_file[p["_pair_key"][0]].append(p)
    for fname, file_pairs in by_file.items():
        path = os.path.join(TRAINING_DIR, fname)
        header = headers[fname]
        # Add a marker to the header noting held-out marking has occurred.
        new_header = dict(header)
        new_header["held_out_marking"] = {
            "applied_at": "2026-07-16T21:00:00Z",
            "generator": "carve-heldout-2026-07-16.py",
            "seed": SEED,
            "heldout_file": "held-out/heldout-2026-07-16.jsonl",
            "note": "Pairs with 'held_out': true are validation-only. Excluding them from training is the caller's responsibility. See held-out/README.slat.",
        }
        # Order preserved via line number
        file_pairs.sort(key=lambda p: p["_pair_key"][1])
        with open(path, "w") as f:
            f.write(json.dumps(new_header) + "\n")
            for p in file_pairs:
                out = strip_internal_keys(p)
                if p["_pair_key"] in selected:
                    out["held_out"] = True
                f.write(json.dumps(out) + "\n")


# ---------------------------------------------------------------------------
# STATS
# ---------------------------------------------------------------------------

def print_stats(pairs, selected):
    """Emit a compact stratification report to stdout."""
    total = len(pairs)
    n_selected = len(selected)

    print(f"\n=== STRATIFICATION REPORT — seed={SEED} ===")
    print(f"Corpus pairs (non-header): {total}")
    print(f"Held-out pairs:            {n_selected}  ({100.0*n_selected/total:.2f}%)")

    for axis_name, key_fn in [
        ("BOOK", lambda p: p["_book"]),
        ("EXTRACTOR", lambda p: p["_extractor"]),
        ("TIER", lambda p: p["_tier"]),
        ("LENGTH", lambda p: p["_length"]),
    ]:
        corpus = Counter(key_fn(p) for p in pairs)
        held = Counter(key_fn(p) for p in pairs if p["_pair_key"] in selected)
        print(f"\n{axis_name}:")
        print(f"  {'value':<28} {'corpus':>7} {'held':>6} {'held%':>7} {'corp%':>7}")
        for k in sorted(corpus.keys(), key=lambda x: -corpus[x]):
            c = corpus[k]
            h = held[k]
            print(f"  {str(k):<28} {c:>7} {h:>6} "
                  f"{100.0*h/max(1,c):>6.2f}% {100.0*c/total:>6.2f}%")

    # Overlap check: no pair-key in both train and held-out is impossible by
    # construction (single set), but verify uniqueness.
    assert len(selected) == len(set(selected)), "duplicate selected pair keys"
    # Sanity: every selected key exists in pairs.
    all_keys = {p["_pair_key"] for p in pairs}
    unknown = selected - all_keys
    assert not unknown, f"selected has unknown keys: {unknown}"
    print("\nOK: pair keys unique; all selected keys exist in corpus.")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(SEED)
    headers, pairs = load_all()
    print(f"[carve] loaded {len(pairs)} pairs from {len(headers)} source files")
    selected = stratified_sample(pairs, rng)
    write_heldout(pairs, selected)
    rewrite_source_jsonls(headers, pairs, selected)
    print_stats(pairs, selected)
    print(f"\nWrote held-out to:    {HELDOUT_FILE}")
    print(f"Marked source JSONLs in {TRAINING_DIR}")


if __name__ == "__main__":
    main()
