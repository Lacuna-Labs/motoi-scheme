"""Emit MeCo-prefixed CPT text from Motoi axis graphs.

Per Jess's CPT execution spec (SRE-05 § section-cpt-execution-per-tier):
  Data type A: Tier 1 rich nodes → MeCo prose (M=5 paraphrases planned; base template here)
  Data type B: Tier 2 light nodes → MeCo prose (M=3)
  Data type C: Tier 3 stub nodes → MeCo registry-line (M=1)
  Data type D: Reversed pairs (template swap over A + selectively B)
  Data type E: Book text → MeCo prefix on existing chapter text
  Data type F: Reference → MeCo prefix on verb entries

Output: newline-delimited JSONL, one CPT doc per line.
Each doc:
  {"type": "A|B|C|D|E|F", "axis": "...", "tier": "...", "word": "...",
   "source": "...", "text": "...", "shape_idx": 0, "provenance": "..."}
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from typing import Iterator
import argparse

sys.path.insert(0, str(Path(__file__).parent))
from read_graph import iter_node_blocks, parse_node, get_string, get_symbol, get_field_raw, get_list_of_strings

REPO = Path("/Users/alfred/code/motoi-scheme")
ENRICH_PATH = REPO / "training-data" / "cpt-mk2" / "tier1-enrichment.json"

# Qwen2.5-Coder native CPT tokens — hard-baked into tokenizer + pretraining
# objective. Doctrine: memory:qwen-native-cpt-tokens-2026-07-21
QWEN_REPO_NAME = "<|repo_name|>"
QWEN_FILE_SEP = "<|file_sep|>"
QWEN_FIM_PREFIX = "<|fim_prefix|>"
QWEN_FIM_MIDDLE = "<|fim_middle|>"
QWEN_FIM_SUFFIX = "<|fim_suffix|>"
REPO_NAME_MOTOI = "motoi-scheme"

# Loaded once (or empty if not present)
_ENRICH_CACHE = None


def _load_enrichment() -> dict:
    global _ENRICH_CACHE
    if _ENRICH_CACHE is not None:
        return _ENRICH_CACHE
    if ENRICH_PATH.exists():
        try:
            _ENRICH_CACHE = json.loads(ENRICH_PATH.read_text())
        except Exception:
            _ENRICH_CACHE = {}
    else:
        _ENRICH_CACHE = {}
    return _ENRICH_CACHE


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_value(v: str | None) -> str:
    """Strip outer quotes from a string field, strip trailing ;; comments."""
    if v is None:
        return ""
    v = v.strip()
    # Strip trailing ";; ..." comment
    v = re.sub(r'\s*;;.*$', '', v).strip()
    if v.startswith('"') and v.endswith('"'):
        return v[1:-1]
    return v


def _extract_dialogue_lines(raw: str) -> list[tuple[str, str]]:
    """Parse ((:speaker :child :line "...") (:speaker :motoi :line "...")) into list of (speaker, line)."""
    if not raw:
        return []
    out = []
    for m in re.finditer(r':speaker\s+:(\w+)\s+:line\s+"([^"]*)"', raw):
        out.append((m.group(1), m.group(2)))
    return out


def _extract_examples(raw: str) -> list[str]:
    """Extract a list of strings from an :examples-shaped value."""
    if not raw:
        return []
    return re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', raw)


def _extract_source_refs(raw: str) -> list[str]:
    """Extract (:book "X" :chapter "Y") or (:file "X" ...) into short refs."""
    if not raw:
        return []
    refs = []
    for m in re.finditer(r':book\s+"([^"]+)"\s+:chapter\s+"([^"]+)"', raw):
        refs.append(f'{m.group(1)}/{m.group(2)}')
    for m in re.finditer(r':file\s+"([^"]+)"', raw):
        refs.append(m.group(1))
    return refs


# ---------------------------------------------------------------------------
# Data Type A — Tier 1 rich
# ---------------------------------------------------------------------------

def emit_tier1_prose(node: dict[str, str | None], axis_default: str = "") -> dict | None:
    """DEPRECATED — single-composite emit. New callers use iter_tier1_variants()
    which produces 5 template-rotation variants per node.

    Kept for backward compat; returns only the first template (P1)."""
    for doc in iter_tier1_variants(node, axis_default):
        return doc
    return None


def iter_tier1_variants(node: dict[str, str | None], axis_default: str = ""):
    """From a Tier 1 node, emit FIVE template-rotation variants (P1-P5).

    Same template shapes the Lacan Kit uses, ported to emit_cpt.py for
    deterministic in-emit generation. Each template FOREGROUNDS a different
    field of the node — five distinct attack angles on the same content.

    P1 · definition-forward   — formal, definition first
    P2 · examples-forward     — narrative, example first
    P3 · dialogue-forward     — warm/conversational, dialogue first
    P4 · programs-forward     — technical, code use first
    P5 · associations-forward — reflective, neighborhood first
    """
    canonical = _clean_value(node.get("canonical"))
    axis = _clean_value(node.get("axis")) or axis_default
    if not canonical or not axis:
        return
    if "/" in canonical:
        canonical = canonical.split("/", 1)[1]

    definition = _clean_value(node.get("definition"))
    examples = _extract_examples(node.get("examples", ""))
    dialogue = _extract_dialogue_lines(node.get("example-dialogue", ""))
    programs = _extract_examples(node.get("used-in-programs-as", ""))
    associations_raw = node.get("associations", "")
    associations = re.findall(r'"([a-z][a-z\-]+)(?:\([^)]*\))?"', associations_raw or "")
    enrich = _load_enrichment().get(canonical, {})
    if enrich.get("associations") and not associations:
        associations = enrich["associations"]
    dist_neighbors = enrich.get("distributional_neighbors", [])
    bridge_score = enrich.get("cross_axis_bridge_score", 0)

    def _yield(template: str, voice: str, body: str):
        if not body or len(body) < 40:
            return None
        prefix = f"[axis:{axis}] [tier:1] [word:{canonical}] [template:{template}] [voice:{voice}]"
        return {
            "type": "A",
            "axis": axis,
            "tier": "1",
            "word": canonical,
            "template": template,
            "voice": voice,
            "text": f"{prefix}\n\n{body}",
            "shape_idx": ord(template[1]) - ord('1'),
            "provenance": f"graph-of-{axis}.slat|{template}",
        }

    # Voice inflection per axis (mirrors Lacan Kit's voice.py)
    voice_map = {
        "sensation": "observational",
        "intuition":  "insight",
        "thinking":   "precise",
        "feeling":    "warm",
    }
    voice = voice_map.get(axis, "neutral")

    # P1 — definition-forward
    parts = []
    if definition:
        parts.append(f"{canonical.capitalize()} is: {definition}")
    if examples:
        parts.append(f"In practice: {examples[0]}")
    if associations:
        parts.append(f"Related concepts: {', '.join(associations[:6])}.")
    doc = _yield("P1", f"{axis}-{voice}", " ".join(parts).strip())
    if doc:
        yield doc

    # P2 — examples-forward
    parts = []
    if examples:
        parts.append(examples[0])
    else:
        parts.append(f"Here is {canonical} at work.")
    if definition:
        parts.append(f"This is what {canonical} means: {definition}")
    if programs:
        parts.append(f"In code, {canonical} appears as: {programs[0]}.")
    doc = _yield("P2", "narrative", " ".join(parts).strip())
    if doc:
        yield doc

    # P3 — dialogue-forward
    parts = []
    if dialogue:
        for sp, ln in dialogue[:3]:
            parts.append(f'{sp.capitalize()}: "{ln}"')
    else:
        parts.append(f"A child asks about {canonical}. Motoi answers plainly.")
    if definition:
        parts.append(f"The idea Motoi is teaching: {definition}")
    if associations:
        parts.append(f"Words that live near {canonical}: {', '.join(associations[:4])}.")
    doc = _yield("P3", "warm-conversational", " ".join(parts).strip())
    if doc:
        yield doc

    # P4 — programs-forward
    parts = []
    if programs:
        parts.append(f"In Motoi code, {canonical} shows up as: {programs[0]}.")
        if len(programs) > 1:
            parts.append(f"Also seen as: {programs[1]}.")
    else:
        parts.append(f"{canonical.capitalize()} appears across several places in Motoi programs.")
    if definition:
        parts.append(f"The idea behind {canonical}: {definition}")
    if examples:
        parts.append(f"See it: {examples[0]}")
    doc = _yield("P4", "technical-direct", " ".join(parts).strip())
    if doc:
        yield doc

    # P5 — associations-forward
    parts = []
    if associations:
        parts.append(f"{canonical.capitalize()} lives alongside {', '.join(associations[:6])}.")
    if definition:
        parts.append(f"When you see it, {canonical} means: {definition}")
    ex2 = examples[1] if len(examples) > 1 else (examples[0] if examples else "")
    if ex2:
        parts.append(f"In practice: {ex2}")
    if dist_neighbors:
        parts.append(f"Semantic siblings by usage: {', '.join(dist_neighbors[:5])}.")
    if bridge_score >= 2:
        parts.append(f"Bridges {bridge_score} other axes in the graph.")
    doc = _yield("P5", "reflective", " ".join(parts).strip())
    if doc:
        yield doc


# ---------------------------------------------------------------------------
# Data Type B — Tier 2 light
# ---------------------------------------------------------------------------

def emit_tier2_prose(node: dict[str, str | None], axis_default: str = "") -> dict | None:
    canonical = _clean_value(node.get("canonical"))
    axis = _clean_value(node.get("axis")) or axis_default
    if not canonical or not axis:
        return None
    if "/" in canonical:
        canonical = canonical.split("/", 1)[1]

    definition = _clean_value(node.get("definition"))
    subchar = _clean_value(node.get("subchar")) or "neighbor"
    subchar = subchar.lstrip(":")
    context = _clean_value(node.get("context-of-use"))
    relations = _extract_examples(node.get("relations", ""))
    if not relations:
        relations = re.findall(r'"([a-z][a-z\-]+)(?:\([^)]*\))?"', node.get("relations", "") or "")

    parts = []
    if definition:
        parts.append(definition)
    if context:
        parts.append(context)
    if relations:
        rel = ", ".join(relations[:5])
        parts.append(f"Related to Tier 1 signifiers: {rel}.")

    body = " ".join(parts).strip()
    if len(body) < 25:
        return None

    prefix = f"[axis:{axis}] [tier:2] [subchar:{subchar}] [word:{canonical}]"
    text = f"{prefix}\n\n{body}"

    return {
        "type": "B",
        "axis": axis,
        "tier": "2",
        "subchar": subchar,
        "word": canonical,
        "text": text,
        "shape_idx": 0,
        "provenance": f"graph-of-{axis}.slat",
    }


# ---------------------------------------------------------------------------
# Data Type C — Tier 3 stub
# ---------------------------------------------------------------------------

def emit_tier3_stub(node: dict[str, str | None], axis_default: str = "") -> dict | None:
    canonical = _clean_value(node.get("canonical"))
    axis = _clean_value(node.get("axis")) or axis_default
    if not canonical or not axis:
        return None
    if "/" in canonical:
        canonical = canonical.split("/", 1)[1]

    definition = _clean_value(node.get("definition")) or "A rare word appearing in the Motoi corpus."
    appears = _extract_source_refs(node.get("appears-in-corpus", ""))
    surrounding_raw = node.get("surrounding-words", "")
    surrounding = re.findall(r'"([a-z][a-z\-]+)"', surrounding_raw or "")

    parts = [definition]
    if appears:
        parts.append(f"Appears in: {', '.join(appears[:3])}.")
    if surrounding:
        parts.append(f"Nearby words: {', '.join(surrounding[:10])}.")

    body = " ".join(parts).strip()
    prefix = f"[axis:{axis}] [tier:3] [word:{canonical}]"
    text = f"{prefix}\n\n{body}"

    return {
        "type": "C",
        "axis": axis,
        "tier": "3",
        "word": canonical,
        "text": text,
        "shape_idx": 0,
        "provenance": f"graph-of-{axis}.slat",
    }


# ---------------------------------------------------------------------------
# Data Type D — Reversed pairs
# ---------------------------------------------------------------------------

def emit_reversed_pair(node: dict[str, str | None], axis_default: str = "") -> dict | None:
    """DEPRECATED — single-variant reverse. Kept for backward compat with the
    old main() call site; new callers use iter_reversed_pairs() which emits 5.
    """
    # Yield only the first template for backward compat
    for doc in iter_reversed_pairs(node, axis_default):
        return doc
    return None


def iter_reversed_pairs(node: dict[str, str | None], axis_default: str = ""):
    """From a Tier 1 node, emit FIVE reverse-recall variants (R1-R5) —
    same 5 phrasings the Lacan Kit uses. Ported here for deterministic
    reversal generation directly in emit_cpt.py.

    Reversal Curse (arXiv:2309.12288) requires bidirectional training —
    every A→B needs a B→A. One template repeated 15x (upsample) doesn't
    give the model diverse retrieval-shape practice. Five distinct
    phrasings do.
    """
    canonical = _clean_value(node.get("canonical"))
    axis = _clean_value(node.get("axis")) or axis_default
    definition = _clean_value(node.get("definition"))
    if not (canonical and axis and definition) or len(definition) < 30:
        return
    if "/" in canonical:
        canonical = canonical.split("/", 1)[1]

    # Strip trailing period from definition for clean sentence composition
    d = definition.rstrip(".").strip()

    prefix = f"[axis:{axis}] [type:reverse-recall] [word:{canonical}]"
    reverses = [
        ("R1", f"The word for this definition — \"{d}\" — is {canonical}."),
        ("R2", f"What word means \"{d}\"? That word is {canonical}."),
        ("R3", f"Given the definition \"{d},\" the word is {canonical}."),
        ("R4", f"In our vocabulary, \"{d}\" describes {canonical}."),
        ("R5", f"{canonical.capitalize()} is our word for \"{d}\"."),
    ]

    for rname, rtext in reverses:
        yield {
            "type": "D",
            "axis": axis,
            "tier": "1",
            "word": canonical,
            "template": rname,
            "text": f"{prefix} [reverse-template:{rname}]\n\n{rtext}",
            "shape_idx": int(rname[1:]) - 1,
            "provenance": f"reversed-from graph-of-{axis}.slat|{rname}",
        }


# ---------------------------------------------------------------------------
# Data Type E — Book text with MeCo prefix
# ---------------------------------------------------------------------------

def iter_book_chapters() -> Iterator[dict]:
    """Yield each scheme-book and word-book chapter as a CPT doc with MeCo prefix
    AND Qwen native repo/file wrapping.

    Motoi corpus scope: scheme-books/ + word-books/ + Scheme/reference/ only.
    Explicitly excluded: engineering/, SRE-MANUAL/, spec/, docs/ (Motoi has no
    subsystems that require operator-facing engineering material).

    Qwen wrapping per memory:qwen-native-cpt-tokens-2026-07-21:
      <|repo_name|>motoi-scheme<|file_sep|><relative-path>
      [book:...] [chapter:...] [book-type:...]

      <full chapter text>
    """
    for books_root in [REPO / "scheme-books", REPO / "word-books"]:
        if not books_root.exists():
            continue
        for book_dir in sorted(books_root.glob("book-of-*")):
            book_slug = book_dir.name
            # Determine book type from README if present
            book_type = "learning"
            readme = book_dir / "README.slat"
            if readme.exists():
                content = readme.read_text(encoding="utf-8", errors="ignore")
                m = re.search(r':book-type\s+"([^"]+)"', content)
                if m:
                    book_type = m.group(1)
            for chapter_file in sorted(book_dir.glob("*.book.slatl")):
                chapter_slug = chapter_file.stem.replace(".book", "")
                try:
                    text = chapter_file.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                if len(text) < 100:
                    continue
                rel_path = chapter_file.relative_to(REPO)
                # Qwen native repo/file wrapping — leverages base-model pretraining
                qwen_header = f"{QWEN_REPO_NAME}{REPO_NAME_MOTOI}{QWEN_FILE_SEP}{rel_path}"
                meco = f"[book:{book_slug}] [chapter:{chapter_slug}] [book-type:{book_type}]"
                yield {
                    "type": "E",
                    "axis": "book",
                    "tier": "book-native",
                    "book": book_slug,
                    "chapter": chapter_slug,
                    "book_type": book_type,
                    "text": f"{qwen_header}\n{meco}\n\n{text}",
                    "shape_idx": 0,
                    "provenance": str(rel_path),
                }


# ---------------------------------------------------------------------------
# Data Type F — Reference with MeCo prefix
# ---------------------------------------------------------------------------

def iter_reference_files() -> Iterator[dict]:
    """Yield each Scheme/reference/ file as a CPT doc with MeCo prefix
    AND Qwen native repo/file wrapping."""
    ref_dir = REPO / "Scheme" / "reference"
    for ref_file in sorted(ref_dir.glob("*.slat")):
        ref_slug = ref_file.stem
        try:
            text = ref_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        m = re.match(r"\d+[a-z]?-(.+)", ref_slug)
        library = m.group(1) if m else ref_slug
        rel_path = ref_file.relative_to(REPO)
        qwen_header = f"{QWEN_REPO_NAME}{REPO_NAME_MOTOI}{QWEN_FILE_SEP}{rel_path}"
        meco = f"[reference:{ref_slug}] [library:{library}]"
        yield {
            "type": "F",
            "axis": "reference",
            "tier": "reference",
            "reference_file": ref_slug,
            "library": library,
            "text": f"{qwen_header}\n{meco}\n\n{text}",
            "shape_idx": 0,
            "provenance": str(rel_path),
        }


# ---------------------------------------------------------------------------
# Data Type G — FIM (fill-in-middle) code snippets
# ---------------------------------------------------------------------------

# Regex to extract fenced Scheme code blocks from book chapter text.
# Handles ```scheme, ```lisp, and ``` (untagged, if body starts with '(')
_CODE_BLOCK = re.compile(
    r"```(?:scheme|lisp|scm|)?\s*\n(.*?)\n```",
    re.DOTALL | re.IGNORECASE,
)

# Alternate: :code field inside slat records
_SLAT_CODE_FIELD = re.compile(r':code\s+"([^"]+)"', re.DOTALL)

# Minimum code-block size (in lines) to warrant FIM extraction.
# Fewer lines than this = not enough surrounding context for FIM training.
_FIM_MIN_LINES = 5
_FIM_MIN_CHARS = 60


def _extract_scheme_blocks(text: str) -> list[str]:
    """Return list of Scheme code-block bodies found in a text."""
    blocks: list[str] = []
    for m in _CODE_BLOCK.finditer(text):
        body = m.group(1).strip()
        # Only keep if it looks like Scheme (starts with '(' or ';' or has parens)
        if body.startswith(("(", ";")) or ("(" in body and ")" in body):
            blocks.append(body)
    # Also pull :code "..." fields (SLAT-format inline code)
    for m in _SLAT_CODE_FIELD.finditer(text):
        body = m.group(1).strip()
        if body.startswith(("(", ";")):
            blocks.append(body)
    return blocks


def _make_fim_variant(code: str) -> str | None:
    """Split a code block into prefix / middle / suffix for FIM training.

    Middle span = middle third of the lines. Emit as Qwen FIM-formatted text:
      <|fim_prefix|>{prefix}<|fim_middle|>{middle}<|fim_suffix|>{suffix}
    """
    lines = code.splitlines()
    if len(lines) < _FIM_MIN_LINES:
        return None
    if len(code) < _FIM_MIN_CHARS:
        return None
    # Split into thirds by line count
    n = len(lines)
    third = max(1, n // 3)
    prefix = "\n".join(lines[:third])
    middle = "\n".join(lines[third:2 * third])
    suffix = "\n".join(lines[2 * third:])
    if not prefix or not middle or not suffix:
        return None
    return f"{QWEN_FIM_PREFIX}{prefix}\n{QWEN_FIM_MIDDLE}{middle}\n{QWEN_FIM_SUFFIX}{suffix}"


def iter_fim_from_books_and_reference() -> Iterator[dict]:
    """Yield FIM-formatted CPT docs extracted from code blocks in books + reference.

    Per Qwen doctrine (memory:qwen-native-cpt-tokens-2026-07-21): Qwen-Coder's
    FIM tokens are hard-baked into pretraining. Feeding it Motoi-Scheme code
    in FIM format leverages that objective for free code-completion capability
    within CPT.
    """
    # Books first
    for books_root in [REPO / "scheme-books", REPO / "word-books"]:
        if not books_root.exists():
            continue
        for book_dir in sorted(books_root.glob("book-of-*")):
            for chapter_file in sorted(book_dir.glob("*.book.slatl")):
                try:
                    text = chapter_file.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                blocks = _extract_scheme_blocks(text)
                rel_path = chapter_file.relative_to(REPO)
                qwen_header = f"{QWEN_REPO_NAME}{REPO_NAME_MOTOI}{QWEN_FILE_SEP}{rel_path}"
                for idx, code in enumerate(blocks):
                    fim = _make_fim_variant(code)
                    if fim is None:
                        continue
                    yield {
                        "type": "G",
                        "axis": "code-fim",
                        "tier": "code-native",
                        "book": book_dir.name,
                        "chapter": chapter_file.stem.replace(".book", ""),
                        "block_idx": idx,
                        "text": f"{qwen_header}\n[type:fim] [source:book-chapter-code-block]\n\n{fim}",
                        "shape_idx": 0,
                        "provenance": f"{rel_path}#code-block-{idx}",
                    }
    # Reference example fields — they have :example-in-scheme, :examples, etc.
    ref_dir = REPO / "Scheme" / "reference"
    for ref_file in sorted(ref_dir.glob("*.slat")):
        try:
            text = ref_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        blocks = _extract_scheme_blocks(text)
        rel_path = ref_file.relative_to(REPO)
        qwen_header = f"{QWEN_REPO_NAME}{REPO_NAME_MOTOI}{QWEN_FILE_SEP}{rel_path}"
        for idx, code in enumerate(blocks):
            fim = _make_fim_variant(code)
            if fim is None:
                continue
            yield {
                "type": "G",
                "axis": "code-fim",
                "tier": "code-native",
                "reference_file": ref_file.stem,
                "block_idx": idx,
                "text": f"{qwen_header}\n[type:fim] [source:reference-code-example]\n\n{fim}",
                "shape_idx": 0,
                "provenance": f"{rel_path}#code-block-{idx}",
            }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, default=REPO / "training-data" / "cpt-mk2")
    p.add_argument("--axes", nargs="*",
                   default=["sensation", "intuition", "thinking", "feeling"])
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    stats: dict[str, int] = {}

    # Per-axis A, B, C, D
    for axis in args.axes:
        graph_path = REPO / "graphs" / f"graph-of-{axis}.slat"
        if not graph_path.exists():
            print(f"[skip] {graph_path} not found", file=sys.stderr)
            continue
        with (args.out / f"axis-{axis}.jsonl").open("w") as f:
            for block in iter_node_blocks(graph_path):
                node = parse_node(block)
                tier = _clean_value(node.get("tier"))
                # Prefer explicit tier; fall back inferred by size of node block
                if tier == "1" or (tier not in ("2", "3") and len(block) > 3000):
                    # Tier 1: emit FIVE forward template variants + FIVE reverse phrasings
                    for adoc in iter_tier1_variants(node, axis_default=axis):
                        f.write(json.dumps(adoc, ensure_ascii=False) + "\n")
                        stats[f"{axis}:A"] = stats.get(f"{axis}:A", 0) + 1
                    for rdoc in iter_reversed_pairs(node, axis_default=axis):
                        f.write(json.dumps(rdoc, ensure_ascii=False) + "\n")
                        stats[f"{axis}:D"] = stats.get(f"{axis}:D", 0) + 1
                elif tier == "2" or (tier not in ("1", "3") and 400 < len(block) < 3000):
                    doc = emit_tier2_prose(node, axis_default=axis)
                    if doc is not None:
                        f.write(json.dumps(doc, ensure_ascii=False) + "\n")
                        stats[f"{axis}:B"] = stats.get(f"{axis}:B", 0) + 1
                else:
                    doc = emit_tier3_stub(node, axis_default=axis)
                    if doc is not None:
                        f.write(json.dumps(doc, ensure_ascii=False) + "\n")
                        stats[f"{axis}:C"] = stats.get(f"{axis}:C", 0) + 1

    # E - book text (Qwen-wrapped)
    with (args.out / "book-text.jsonl").open("w") as f:
        for doc in iter_book_chapters():
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            stats["book:E"] = stats.get("book:E", 0) + 1

    # F - reference (Qwen-wrapped)
    with (args.out / "reference.jsonl").open("w") as f:
        for doc in iter_reference_files():
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            stats["reference:F"] = stats.get("reference:F", 0) + 1

    # G - FIM code snippets from books + reference
    # (Qwen-native fill-in-middle format; leverages base model's FIM pretraining)
    with (args.out / "code-fim.jsonl").open("w") as f:
        for doc in iter_fim_from_books_and_reference():
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            stats["code-fim:G"] = stats.get("code-fim:G", 0) + 1

    print("=== CPT emission stats ===")
    for k, v in sorted(stats.items()):
        print(f"  {k:>32} : {v:>6,}")
    print(f"Total docs: {sum(stats.values()):,}")
    print(f"Output: {args.out}/")


if __name__ == "__main__":
    main()
