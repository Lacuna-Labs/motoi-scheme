#!/usr/bin/env python3
"""
Salvage word-books → Motoi Copilot SFT pairs.

Reads:
  motoi-scheme/word-books/{book-of-glances,book-of-paired-scenarios,book-of-words}/
  curator/docs/words/{book-of-glances,book-of-paired-scenarios,book-of-words}/  (dedup)

Emits: /Users/alfred/code/motoi-scheme/training-data/salvage-word-books-motoi-2026-07-16.jsonl

Voice: Motoi Copilot — dry, tech-focused, fun/jokes-coder. No warm-persona interior.
Story-shaped prose (Sakura character narratives, Renata, warm interior) → DROPPED.

Extraction targets (Motoi-appropriate):
  1. (:term "X" :one-line "Y")  from vocab-tier records → "what's X?" → Y
  2. (glance-item :prompt P :answer A :feedback F ...) → observation pairs
  3. (wrong-pair :looks-like L :actual-a A :actual-b B :difference D) → discrimination pairs
  4. (item :n N :situation S) from 20-item test suite → observation setup pairs
  5. Markdown bullet vocab in :prose strings ("- **word** — def.") → definition pairs

DROPPED silently:
  - Long story prose (chapter-of-paired-scenarios main body — Sakura, Renata, etc)
  - Poetry files (persona/philosophy)
  - "Sakura says" prose
  - ordinary-* files (warm-interior narratives)
"""

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

OUT_JSONL = "/Users/alfred/code/motoi-scheme/training-data/salvage-word-books-motoi-2026-07-16.jsonl"
OUT_REPORT = "/Users/alfred/code/motoi-scheme/scratch/salvage-word-books-motoi-report-2026-07-16.slat"

MOTOI_ROOTS = [
    "/Users/alfred/code/motoi-scheme/word-books/book-of-glances",
    "/Users/alfred/code/motoi-scheme/word-books/book-of-paired-scenarios",
    "/Users/alfred/code/motoi-scheme/word-books/book-of-words",
]
CURATOR_ROOTS = [
    "/Users/alfred/code/curator/docs/words/book-of-glances",
    "/Users/alfred/code/curator/docs/words/book-of-paired-scenarios",
    "/Users/alfred/code/curator/docs/words/book-of-words",
]

# Skip filename patterns (poetry, persona narratives, ordinary-* warm prose,
# and pure prose chapters of Book of Words which are Sakura-narrated).
# NOTE: alternatives listed one per line, no trailing bare `|`.
_SKIP_ALTS = [
    # Poetry-shaped filenames
    r"haiku", r"sonnet", r"ghazal", r"villanelle", r"blues", r"whitman",
    r"tanka", r"sijo", r"-ode\b", r"ozymandias", r"lorca", r"clifton",
    r"shelley", r"blake", r"neruda", r"dickinson", r"shakespeare-couplet",
    r"nature-lyric", r"song-of-songs", r"griot", r"nahuatl",
    r"grief-and-elegy", r"joy-and-ode", r"anger-and-invective",
    r"wrath-and-jeremiad", r"longing-and-ghazal", r"awe-and-sublime",
    r"love-and-sonnet", r"loss-and-villanelle", r"wonder-and-haiku",
    r"guilt-and-confessional", r"rage-and-blues", r"tenderness-and-lullaby",
    r"fear-and-gothic", r"hope-and-anthem", r"nostalgia-and-ubi-sunt",
    r"ghalib-couplet", r"buson-haiku",
    # Persona templates
    r"^A-persona-templates",
    # Sakura-narrated book-of-words prose chapters
    r"^01-what-a-word-is", r"^02-nouns", r"^03-verbs", r"^04-connectors",
    r"^05-same-word-different-games", r"^06-borrowed-neighbors",
    r"^07-words-in-business", r"^08-words-in-life", r"^09-chopping-words",
    r"^10-combining-words", r"^10-closing-note", r"^11-parsing-intent",
    r"^12-answering-back", r"^13-words-as-slats", r"^14-sentences-as-streams",
    r"^15-conversations-as-documents", r"^16-building-word-tools",
    r"^16-closing-the-sketches",
    # Warm-interior narrative files
    r"^ordinary-",
    # Cover/index
    r"^00-cover", r"^00-index",
]
SKIP_FILES_RE = re.compile("(?:" + "|".join(_SKIP_ALTS) + ")")

# Keep filename patterns (positive whitelist for glance/vocab-only files
# where we're sure the content shape is Motoi-appropriate)
KEEP_GLANCE_RE = re.compile(r"book-of-glances")
KEEP_VOCAB_FILE_RE = re.compile(r"(etsy-|ebay-|shopify-|00-roster)")

# Chapter-body files in paired-scenarios contain long story prose — skip main body,
# but the chapter file itself has a :deep-structure and :opening we can use.
PAIRED_CHAPTER_RE = re.compile(r"paired-scenarios/(?P<n>\d+)-.*\.chapter\.slat$")
PAIRED_APPENDIX_RE = re.compile(r"paired-scenarios/appendix-[A-Z]-.*\.appendix\.slat$")


# ----------------------------------------------------------------------------
# Voice filter (post-generation)
# ----------------------------------------------------------------------------

REJECT_PATTERNS = [
    re.compile(r"\bSakura\b"),
    re.compile(r"\bRenata\b"),
    re.compile(r"\bAlfred\b"),
    re.compile(r"cherry(?:\s|-)?blossom", re.I),
    re.compile(r"\bBBG\b"),
    re.compile(r"in her ear", re.I),
    re.compile(r"she (?:softly|gently|quietly) (?:says|whispers|smiles|holds)", re.I),
    re.compile(r"her (?:heart|body|hands|soul|voice)", re.I),
    re.compile(r"\bBrooklyn\b"),  # too place-specific / persona
    re.compile(r"\bJess\b"),
    re.compile(r"philosopher(?:-lens)?", re.I),
    # Philosopher name-drops
    re.compile(r"\b(?:Wittgenstein|Peirce|Jung|Lacan|Popper|Freud|Searle|Grice|Derrida|Quine|Descartes|Sartre|Rawls|Aristotle|Levinas|Dennett|Socrates)\b"),
    # Corporate names
    re.compile(r"\b(?:Etsy|eBay|Shopify|Meta|Google|Amazon|Facebook)\b"),
]

# Length hard cap: Motoi replies are terse
MAX_ASSISTANT_CHARS = 600
MIN_ASSISTANT_CHARS = 8


def voice_reject_reason(user, asst):
    text = f"{user}\n{asst}"
    for pat in REJECT_PATTERNS:
        m = pat.search(text)
        if m:
            return f"pattern:{m.group(0)}"
    if len(asst) > MAX_ASSISTANT_CHARS:
        return f"too-long:{len(asst)}"
    if len(asst) < MIN_ASSISTANT_CHARS:
        return f"too-short:{len(asst)}"
    if len(user) < 3:
        return "user-empty"
    return None


# ----------------------------------------------------------------------------
# Parsers
# ----------------------------------------------------------------------------

# (:term "foo-bar"      :one-line "some definition text")
# Terms may be multi-line — allow whitespace flexibility.
TERM_RE = re.compile(
    r'\(:term\s+"(?P<term>[^"]+)"\s+:one-line\s+"(?P<one>[^"]+)"\s*\)',
    re.DOTALL,
)

# glance-item block
GLANCE_ITEM_RE = re.compile(
    r'\(glance-item\s+'
    r':n\s+(?P<n>\d+)\s+'
    r':prompt\s+"(?P<prompt>[^"]+)"\s+'
    r':answer\s+"(?P<answer>[^"]+)"\s+'
    r':difficulty\s+:(?P<difficulty>\w+)\s+'
    r':feedback\s+"(?P<feedback>[^"]+)"'
    r'(?:\s+:abduction\s+"(?P<abduction>[^"]+)")?',
    re.DOTALL,
)

# wrong-pair block
WRONG_PAIR_RE = re.compile(
    r'\(wrong-pair\s+'
    r':id\s+"(?P<id>[^"]+)"\s+'
    r':looks-like\s+"(?P<looks>[^"]+)"\s+'
    r':actual-a\s+"(?P<a>[^"]+)"\s+'
    r':actual-b\s+"(?P<b>[^"]+)"\s+'
    r':difference\s*\n?\s*"(?P<diff>[^"]+)"',
    re.DOTALL,
)

# 20-item test-suite item
ITEM_RE = re.compile(
    r'\(item\s+:n\s+(?P<n>\d+)\s+:situation\s*\n?\s*"(?P<situation>[^"]+)"',
    re.DOTALL,
)

# Markdown bullet-def in prose:  "- **word** — definition text (may wrap)."
# Wrapped continuation lines are indented 2+ spaces.
# We match until: next bullet, blank line, header, closing paren, or end.
BULLET_DEF_RE = re.compile(
    r'-\s+\*\*(?P<word>[^*\n]+?)\*\*\s+[—–-]\s+'
    r'(?P<def>[^\n]+(?:\n[ \t]{2,}[^\n-][^\n]*)*)',
)


def normalize_ws(s):
    """Collapse internal whitespace and unescape common escapes."""
    if s is None:
        return ""
    s = s.replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'")
    # squeeze newlines/whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def extract_terms(text):
    """Yield (term, definition) from vocab-tier :term forms."""
    for m in TERM_RE.finditer(text):
        term = normalize_ws(m.group("term"))
        one = normalize_ws(m.group("one"))
        if term and one:
            yield term, one


def extract_glance_items(text):
    """Yield (prompt, answer, feedback, difficulty) from glance-item blocks."""
    for m in GLANCE_ITEM_RE.finditer(text):
        prompt = normalize_ws(m.group("prompt"))
        answer = normalize_ws(m.group("answer"))
        feedback = normalize_ws(m.group("feedback") or "")
        difficulty = m.group("difficulty")
        yield prompt, answer, feedback, difficulty


def extract_wrong_pairs(text):
    for m in WRONG_PAIR_RE.finditer(text):
        looks = normalize_ws(m.group("looks"))
        a = normalize_ws(m.group("a"))
        b = normalize_ws(m.group("b"))
        diff = normalize_ws(m.group("diff"))
        yield looks, a, b, diff


def extract_test_items(text):
    for m in ITEM_RE.finditer(text):
        n = m.group("n")
        sit = normalize_ws(m.group("situation"))
        yield n, sit


def extract_bullet_defs(text):
    """
    Extract '- **word** — def' from markdown-embedded prose.
    Only from files where these are true vocabulary (etsy-/ebay-/shopify-).
    """
    for m in BULLET_DEF_RE.finditer(text):
        word = normalize_ws(m.group("word"))
        # strip word from any nested formatting
        word = re.sub(r'[*_`]', '', word)
        defn = normalize_ws(m.group("def"))
        # Only accept short single-line definitions (avoid multi-para prose)
        if 2 <= len(word) <= 60 and 5 <= len(defn) <= 300:
            yield word, defn


# ----------------------------------------------------------------------------
# Pair emitters
# ----------------------------------------------------------------------------

def make_pair(user_text, assistant_text):
    return {
        "messages": [
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": assistant_text},
        ]
    }


def emit_vocab_term(term, defn):
    # Skip category-key pseudo-terms like "shiny-yellow-mark-925" — those are
    # scenario cues, not questions the user asks.
    if "-" in term and len(term) > 20:
        # Convert to observation pair instead
        prompt = term.replace("-", " ")
        user = f"i see: {prompt}"
        asst = defn
    else:
        user = f"what's {term}?"
        asst = defn
    return make_pair(user, asst)


def emit_glance(prompt, answer, feedback, difficulty):
    # prompt is a diagnostic setup, answer is the classification
    user = prompt
    if feedback and len(answer) + len(feedback) < 500:
        asst = f"{answer} {feedback}"
    else:
        asst = answer
    return make_pair(user, asst)


def emit_wrong_pair(looks, a, b, diff):
    user = f"looks like: {looks}. how do i tell which?"
    # Compact response
    asst = f"Two shapes: (a) {a} (b) {b}. Tell them apart: {diff}"
    if len(asst) > MAX_ASSISTANT_CHARS:
        # Trim difference
        max_diff = MAX_ASSISTANT_CHARS - len(f"Two shapes: (a) {a} (b) {b}. Tell them apart: ") - 3
        if max_diff > 40:
            asst = f"Two shapes: (a) {a} (b) {b}. Tell them apart: {diff[:max_diff]}..."
        else:
            asst = f"(a) {a[:120]} (b) {b[:120]}"
    return make_pair(user, asst)


def emit_test_item(n, situation):
    user = situation
    asst = "Read the situation: identify the pattern, name the deep structure in one sentence, name a plausible wrong-pattern and how you'd tell them apart."
    return make_pair(user, asst)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def enum_files(roots):
    files = []
    for root in roots:
        rootp = Path(root)
        if not rootp.exists():
            continue
        for p in sorted(rootp.rglob("*")):
            if not p.is_file():
                continue
            if "_archive" in p.parts:
                continue
            if any(part.startswith(".") for part in p.parts):
                continue
            if p.suffix not in (".slat", ".slatl", ".md"):
                continue
            if p.name in ("MANIFEST.slat", "README.slat", "RULES.slat"):
                continue
            files.append(p)
    return files


def word_count(text):
    return len(re.findall(r"\S+", text or ""))


def process_file(path, seen_hashes, stats, rejects_bucket):
    """
    Returns list of accepted pair dicts.
    Mutates stats[str(path)] and rejects_bucket.
    """
    name = path.name
    accepted = []
    rejected = 0
    file_word_in = 0

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        stats[str(path)] = {"read_error": str(e), "kept": 0, "rejected": 0, "words_in": 0}
        return accepted

    file_word_in = word_count(text)

    # Skip whole file if matches skip pattern
    if SKIP_FILES_RE.search(name):
        stats[str(path)] = {
            "skipped_file": True, "reason": "narrative-poetry-or-persona-file",
            "kept": 0, "rejected": 0, "words_in": file_word_in,
        }
        return accepted

    pairs_candidate = []

    # --- vocab-tier :term extraction (glance files + vocab files) ---
    for term, defn in extract_terms(text):
        pairs_candidate.append(("term", emit_vocab_term(term, defn)))

    # --- glance-item extraction (glance files) ---
    for prompt, answer, feedback, difficulty in extract_glance_items(text):
        pairs_candidate.append(("glance", emit_glance(prompt, answer, feedback, difficulty)))

    # --- wrong-pair extraction (paired-scenarios appendix E) ---
    for looks, a, b, diff in extract_wrong_pairs(text):
        pairs_candidate.append(("wrong-pair", emit_wrong_pair(looks, a, b, diff)))

    # --- test-item extraction (paired-scenarios appendix H) ---
    for n, sit in extract_test_items(text):
        pairs_candidate.append(("test-item", emit_test_item(n, sit)))

    # --- bullet-def extraction (only for etsy-/ebay-/shopify- vocab files) ---
    if KEEP_VOCAB_FILE_RE.search(name):
        for word, defn in extract_bullet_defs(text):
            pair = make_pair(f"what's {word}?", defn)
            pairs_candidate.append(("bullet-def", pair))

    # Voice-filter + dedup
    for kind, pair in pairs_candidate:
        u = pair["messages"][0]["content"]
        a = pair["messages"][1]["content"]
        # Dedup key
        key = (u.strip().lower(), a.strip().lower())
        if key in seen_hashes:
            continue
        reason = voice_reject_reason(u, a)
        if reason:
            rejected += 1
            if len(rejects_bucket) < 200:
                rejects_bucket.append({
                    "file": str(path),
                    "kind": kind,
                    "user": u[:180],
                    "assistant": a[:180],
                    "reason": reason,
                })
            continue
        seen_hashes.add(key)
        accepted.append(pair)

    stats[str(path)] = {
        "kept": len(accepted),
        "rejected": rejected,
        "candidates": len(pairs_candidate),
        "words_in": file_word_in,
    }
    return accepted


def main():
    # Enumerate all files (motoi first, then curator for dedup fallthrough)
    motoi_files = enum_files(MOTOI_ROOTS)
    curator_files = enum_files(CURATOR_ROOTS)

    # Dedup: for each curator file with a matching motoi filename+relpath, skip
    # (motoi copies are canonical). Only include curator files not present in motoi.
    motoi_names = set((p.parent.name, p.name) for p in motoi_files)
    curator_unique = [p for p in curator_files if (p.parent.name, p.name) not in motoi_names]

    all_files = motoi_files + curator_unique

    stats = {}
    seen_hashes = set()
    rejects_bucket = []
    all_pairs = []

    for p in all_files:
        pairs = process_file(p, seen_hashes, stats, rejects_bucket)
        all_pairs.extend(pairs)

    # Write JSONL
    os.makedirs(os.path.dirname(OUT_JSONL), exist_ok=True)
    with open(OUT_JSONL, "w", encoding="utf-8") as f:
        # provenance header
        header = {
            "_provenance_header": True,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator": "salvage-word-books-motoi-2026-07-16.py",
            "corpus_kind": "salvage-word-books",
            "sources": MOTOI_ROOTS + CURATOR_ROOTS,
            "voice_filters": [
                "no-sakura-persona-names",
                "no-cherry-blossom",
                "no-philosopher-name-drops",
                "no-corporate-names",
                f"assistant-max-{MAX_ASSISTANT_CHARS}-chars",
            ],
            "extraction_targets": [
                "vocab-tier :term / :one-line",
                "glance-item",
                "wrong-pair (paired-scenarios appendix E)",
                "test-item (paired-scenarios appendix H)",
                "markdown bullet-def in vocab files",
            ],
            "dropped": [
                "poetry files",
                "Sakura-narrated word-book chapters",
                "paired-scenarios main chapter prose (Sakura/Renata narrative)",
                "ordinary-* warm-interior narratives",
            ],
            "notes": "Motoi Copilot voice. Dry, tech-focused. Vocabulary + observation only.",
        }
        f.write(json.dumps(header, ensure_ascii=False) + "\n")
        for pair in all_pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    # Report stats
    total_pairs = len(all_pairs)
    total_rejected = sum(s.get("rejected", 0) for s in stats.values())
    total_words_in = sum(s.get("words_in", 0) for s in stats.values())
    total_files = len(all_files)
    files_skipped = sum(1 for s in stats.values() if s.get("skipped_file"))
    files_read_error = sum(1 for s in stats.values() if s.get("read_error"))

    # Per-source aggregation
    def source_bucket(path_str):
        for r in MOTOI_ROOTS:
            if path_str.startswith(r):
                return f"motoi:{Path(r).name}"
        for r in CURATOR_ROOTS:
            if path_str.startswith(r):
                return f"curator:{Path(r).name}"
        return "unknown"

    by_source = {}
    for path_str, s in stats.items():
        src = source_bucket(path_str)
        b = by_source.setdefault(src, {"files": 0, "kept": 0, "rejected": 0,
                                        "skipped": 0, "words_in": 0})
        b["files"] += 1
        b["kept"] += s.get("kept", 0)
        b["rejected"] += s.get("rejected", 0)
        b["skipped"] += 1 if s.get("skipped_file") else 0
        b["words_in"] += s.get("words_in", 0)

    # Sample 5 kept pairs (spread across sources)
    sample_kept = []
    if all_pairs:
        step = max(1, len(all_pairs) // 5)
        sample_kept = all_pairs[::step][:5]

    # Sample 3 rejects
    sample_rejects = rejects_bucket[:3] if rejects_bucket else []

    # Write SLAT report
    lines = []
    lines.append(f'(salvage-report')
    lines.append(f'  :doc "salvage-word-books-motoi"')
    lines.append(f'  :section "extraction-summary"')
    lines.append(f'  :audience "engineer"')
    lines.append(f'  :dialect "motoi"')
    lines.append(f'  :provenance "salvage-word-books-motoi-2026-07-16.py"')
    lines.append(f'  :training-eligible false')
    lines.append(f'  :confidentiality "internal"')
    lines.append(f'  :generated-at "{datetime.now(timezone.utc).isoformat()}"')
    lines.append(f'  :output-jsonl "{OUT_JSONL}"')
    lines.append(f'  :total-files-considered {total_files}')
    lines.append(f'  :files-skipped-whole {files_skipped}')
    lines.append(f'  :files-read-error {files_read_error}')
    lines.append(f'  :total-pairs-emitted {total_pairs}')
    lines.append(f'  :total-pairs-rejected {total_rejected}')
    lines.append(f'  :total-source-words-in {total_words_in}')
    if total_words_in:
        lines.append(f'  :yield-pairs-per-1k-words {total_pairs * 1000 / total_words_in:.2f}')
    lines.append('')
    lines.append('  ;; ---- by source ----')
    lines.append('  :by-source (')
    for src, b in sorted(by_source.items()):
        lines.append(
            f'    (:source "{src}" :files {b["files"]} '
            f':files-skipped {b["skipped"]} :kept {b["kept"]} '
            f':rejected {b["rejected"]} :words-in {b["words_in"]})'
        )
    lines.append('  )')
    lines.append('')
    lines.append('  ;; ---- sample kept pairs (5) ----')
    lines.append('  :sample-kept (')
    for pair in sample_kept:
        u = pair["messages"][0]["content"].replace('"', "'")[:200]
        a = pair["messages"][1]["content"].replace('"', "'")[:300]
        lines.append(f'    (:user "{u}" :assistant "{a}")')
    lines.append('  )')
    lines.append('')
    lines.append('  ;; ---- sample rejected pairs (3) ----')
    lines.append('  :sample-rejected (')
    for rj in sample_rejects:
        u = rj["user"].replace('"', "'")[:180]
        a = rj["assistant"].replace('"', "'")[:180]
        lines.append(
            f'    (:file "{Path(rj["file"]).name}" :kind "{rj["kind"]}" '
            f':reason "{rj["reason"]}" :user "{u}" :assistant "{a}")'
        )
    lines.append('  )')
    lines.append('')
    lines.append('  ;; ---- needs-alfred ----')
    lines.append('  :needs-alfred (')
    lines.append('    "Voice-filter blocks all mentions of philosopher names, cherry-blossom, and named characters (Sakura/Renata/Alfred/Jess). Confirm this is the desired cut for Motoi corpus."')
    lines.append('    "Corporate-name filter drops Etsy/eBay/Shopify/Meta references — this rejects vocab-tier prose that mentions those platforms in definitions. Only vocab TERMS extracted; prose-with-brand rejected."')
    lines.append('    "Bullet-def extraction from etsy-/ebay-/shopify- files pulls definitions BUT the source is brand-tagged. Kept the definition, not the brand. Confirm."')
    lines.append('    "Book-of-words prose chapters (nouns/verbs/connectors/etc) fully skipped as Sakura-narrated. If any dry-teaching passages worth extracting, flag."')
    lines.append('    "Ordinary-* files fully skipped as warm-interior narrative. If any vocabulary-teaching content there worth mining, flag."')
    lines.append('  )')
    lines.append(')')

    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"WROTE: {OUT_JSONL}", file=sys.stderr)
    print(f"WROTE: {OUT_REPORT}", file=sys.stderr)
    print(f"pairs: {total_pairs}  rejects: {total_rejected}  files: {total_files}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
