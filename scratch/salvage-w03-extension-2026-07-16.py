#!/usr/bin/env python3
"""W-03 salvage EXTENSION — book-of-glances + book-of-paired-scenarios.

Extends the prior W-03 (536 pairs, 36% of 1500 target) with two
previously-untapped word-books. Reuses the salvage-p0 extractor primitives
verbatim where possible; adds two new extractors for the new SLAT shapes.

Sources (both under motoi-scheme/word-books/):
  book-of-glances/          — 1100+ (glance-item :prompt :answer :feedback
                              :abduction) records across 6 category chapters
                              (jewelry / electronics / apparel / ceramics /
                              tools / furniture). Pattern: quick perceptual
                              cue → identification + explanation.
  book-of-paired-scenarios/ — 200+ scenario+pair records across 16 chapters
                              + 8 appendices. Pattern: matched-pair prose
                              scenes teaching deep-structure heuristics
                              (grief-nearby, refusal-as-kindness, etc.).

Voice: Motoi Copilot (dryer register, NOT Sakura). Fence-swap sakura/scheme
       → motoi. NO philosopher-drops in persona pairs. Copilot doesn't
       reveal internal product/brand names.

Output: training-data/salvage-w03-extension-glances-scenarios-2026-07-16.jsonl
        (NEW file — never overwrites the prior W-03 file)

Voice-lock (checked against 3 source samples per source):
  - book-of-glances glance-item: direct :prompt → :answer, terse, factual
  - book-of-paired-scenarios: prose pattern → deep-structure heuristic
  - Both survive fence-swap + Sakura-strip cleanly
"""
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# Reuse extractor primitives from the P0 salvage script
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
p0 = import_module("salvage-p0-2026-07-16")

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

MOTOI_ROOT = Path("/Users/alfred/code/motoi-scheme")
WORD_BOOKS = MOTOI_ROOT / "word-books"
OUT_DIR = MOTOI_ROOT / "training-data"

BOOK_GLANCES = WORD_BOOKS / "book-of-glances"
BOOK_SCENARIOS = WORD_BOOKS / "book-of-paired-scenarios"

OUT_FILE = OUT_DIR / "salvage-w03-extension-glances-scenarios-2026-07-16.jsonl"

# ----------------------------------------------------------------------------
# EXTRACTOR A: GLANCE-ITEM (from book-of-glances)
# ----------------------------------------------------------------------------

# A glance-item record: (glance-item :n N :prompt "..." :answer "..."
#                        :difficulty :aware|:novice|:expert :feedback "..."
#                        :abduction "...")
# We emit one pair per glance-item: user = prompt, assistant = answer + short
# feedback tail. Abduction line becomes an optional teach-note in provenance.

GLANCE_ITEM_RE = re.compile(
    r'\(glance-item\s+:n\s+\d+\s+'
    r':prompt\s+"((?:[^"\\]|\\.)*)"\s+'
    r':answer\s+"((?:[^"\\]|\\.)*)"'
    r'(?:\s+:difficulty\s+:([a-z]+))?'
    r'(?:\s+:feedback\s+"((?:[^"\\]|\\.)*)")?'
    r'(?:\s+:abduction\s+"((?:[^"\\]|\\.)*)")?',
    re.DOTALL
)


def unescape(s: str) -> str:
    return p0.unescape_slat_string(s)


def extract_glance_items(text: str, book_path: Path) -> list:
    """One pair per glance-item. Terse Copilot register — the source is
    already terse, we just Sakura-strip and fence-swap."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    # Pull chapter category for provenance
    cat_m = re.search(r':chapter-number\s+(\d+)', text)
    title_m = re.search(r':title\s+"([^"]+)"', text)
    chapter_title = title_m.group(1) if title_m else book_path.stem

    for m in GLANCE_ITEM_RE.finditer(text):
        prompt = unescape(m.group(1)).strip()
        answer = unescape(m.group(2)).strip()
        difficulty = m.group(3) or "aware"
        feedback = unescape(m.group(4) or "").strip()
        abduction = unescape(m.group(5) or "").strip()

        # Assistant text: primary answer + (optional) 1-sentence feedback
        # tail if it adds concrete detail beyond the answer.
        assistant = answer
        if feedback and len(feedback) < 400 and feedback.lower() != answer.lower():
            # Add feedback as a compact second sentence/paragraph
            assistant = f"{answer}\n\n{feedback}"

        # Sakura-strip + fence-swap + verb-scrub
        assistant = p0.rewrite_fences(
            p0.scrub_verbs(p0.strip_sakura_name(assistant))
        )
        prompt = p0.strip_sakura_name(prompt)

        # User side: prompt as a question. Glances prompts are declarative
        # observations ("A ring is stamped 925."). We add a "what is this?"
        # framing to make the pair Q/A-shaped in Copilot's dry register.
        # Two shapes rotated for variety.
        user_shapes = [
            f"{prompt} What are you looking at?",
            f"{prompt} What's this?",
            f"{prompt} What's your read?",
            f"{prompt} Call it.",
        ]
        user = user_shapes[len(out) % len(user_shapes)]

        prov = {
            "source": rel,
            "extractor": "glance-item",
            "target_bucket": "PERSONA",
            "chapter_title": chapter_title,
            "difficulty": difficulty,
            "abduction_hint": abduction if abduction else None,
        }
        rec = p0.emit_pair(user, assistant, "persona", prov)
        if rec is not None:
            out.append(rec)
    return out


# ----------------------------------------------------------------------------
# EXTRACTOR B: SCENARIO+TEACH (from book-of-paired-scenarios)
# ----------------------------------------------------------------------------

# Chapter files: (chapter ... :scenario-a (scenario :prose "..." :teach "...")
#                             :scenario-b (scenario :prose "..." :teach "...")
#                             :pattern (pattern :one-sentence "..." :prose "...")
#                             :transfer-prompts (... :prompt-N "..."))
#
# Appendix pair files: (pair :id "..." :deep-structure "..."
#                            (scenario-a :setting "..." :prose "...")
#                            (scenario-b :setting "..." :prose "..."))
#
# Appendix H item files: (item :n N :situation "...")  → no direct answer;
# they're test items. We SKIP those (they'd need an answer key lookup).

# We emit:
#   - one pair per :teach block (user derives from :deep-structure or chapter
#     slug; assistant = teach text)
#   - one pair per :pattern :one-sentence block (user = pattern-name question;
#     assistant = one-sentence + first-para of :prose)
#   - one pair per :transfer-prompt (user = the prompt; assistant = a
#     compact walk-through from the chapter teach if available)

TEACH_RE = re.compile(
    r':teach\s*\n?\s*"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)
DEEP_STRUCTURE_RE = re.compile(
    r':deep-structure\s+"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)
PATTERN_BLOCK_RE = re.compile(
    r'\(pattern\s*\n?\s*:one-sentence\s+"((?:[^"\\]|\\.)*)"\s*'
    r'(?::prose\s*\n?\s*"((?:[^"\\]|\\.)*)")?',
    re.DOTALL
)
TRANSFER_PROMPT_RE = re.compile(
    r':prompt-\d+\s*\n?\s*"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)
CHAPTER_SLUG_RE = re.compile(r':slug\s+"([^"]+)"')
CHAPTER_TITLE_RE = re.compile(r':title\s+"([^"]+)"')


def _first_para(text: str, cap: int = 800) -> str:
    """First non-empty paragraph, trimmed."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paras:
        return ""
    first = paras[0]
    if len(first) > cap:
        # Trim at sentence boundary
        first = first[:cap].rsplit(".", 1)[0] + "."
    return first


def _slug_to_topic(slug: str) -> str:
    """Convert 'return-with-slight-damage' → 'return with slight damage'."""
    if not slug:
        return "this pattern"
    return slug.replace("-", " ").strip()


def extract_scenarios(text: str, book_path: Path) -> list:
    """Pull :teach + :pattern + :transfer-prompts as pairs."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    # Chapter identity for question-framing
    slug_m = CHAPTER_SLUG_RE.search(text)
    title_m = CHAPTER_TITLE_RE.search(text)
    slug = slug_m.group(1) if slug_m else ""
    title = title_m.group(1) if title_m else book_path.stem
    topic = _slug_to_topic(slug) or title.lower()

    # Chapter :deep-structure — usually one per chapter
    ds_m = DEEP_STRUCTURE_RE.search(text)
    chapter_deep_structure = unescape(ds_m.group(1)).strip() if ds_m else ""

    # 1) :teach blocks — each is an authored heuristic. Assistant = the teach
    #    text (drily Sakura-stripped). User = pattern-shape question.
    teach_qs = [
        f"walk me through {topic} — how do you read it?",
        f"quick — what's the pattern behind {topic}?",
        f"teach me: {topic}",
        f"what's the move on {topic}?",
        f"how do you handle {topic}?",
    ]
    teach_count = 0
    for m in TEACH_RE.finditer(text):
        val = unescape(m.group(1)).strip()
        val = p0.rewrite_fences(p0.scrub_verbs(p0.strip_sakura_name(val)))
        if len(val) < 60 or len(val) > 1400:
            continue
        if p0.looks_sakura_branded(val):
            continue
        q = teach_qs[teach_count % len(teach_qs)]
        prov = {
            "source": rel,
            "extractor": "scenario-teach",
            "target_bucket": "PERSONA",
            "chapter_topic": topic,
            "deep_structure": chapter_deep_structure or None,
        }
        rec = p0.emit_pair(q, val, "persona", prov)
        if rec is not None:
            out.append(rec)
            teach_count += 1

    # 2) :pattern block — one-sentence heuristic + first-para of prose.
    for m in PATTERN_BLOCK_RE.finditer(text):
        one_line = unescape(m.group(1)).strip()
        prose = unescape(m.group(2) or "").strip()
        one_line = p0.rewrite_fences(p0.scrub_verbs(p0.strip_sakura_name(one_line)))
        prose = p0.rewrite_fences(p0.scrub_verbs(p0.strip_sakura_name(prose)))
        # Assistant = one_line + first para of prose (if reasonable size)
        first_para = _first_para(prose, cap=600) if prose else ""
        if first_para and len(one_line) + len(first_para) < 1200:
            assistant = f"{one_line}\n\n{first_para}"
        else:
            assistant = one_line
        if len(assistant) < 60 or len(assistant) > 1400:
            continue
        if p0.looks_sakura_branded(assistant):
            continue
        # Question shapes rotated per pair
        q_shapes = [
            f"pattern behind {topic}?",
            f"what's the shape of {topic}?",
            f"summarize {topic} in one line",
            f"one-liner — {topic}",
        ]
        q = q_shapes[len(out) % len(q_shapes)]
        prov = {
            "source": rel,
            "extractor": "scenario-pattern",
            "target_bucket": "PERSONA",
            "chapter_topic": topic,
        }
        rec = p0.emit_pair(q, assistant, "persona", prov)
        if rec is not None:
            out.append(rec)

    # 3) :transfer-prompts — the prompt IS a user turn. Response =
    #    chapter's own teach/pattern as a compact walkthrough. We only
    #    emit this if we have SOMETHING to answer with (the chapter
    #    :pattern :one-sentence works well as an answer stem).
    pattern_answer_stem = ""
    pat_m = PATTERN_BLOCK_RE.search(text)
    if pat_m:
        pattern_answer_stem = unescape(pat_m.group(1)).strip()
        pattern_answer_stem = p0.rewrite_fences(p0.scrub_verbs(
            p0.strip_sakura_name(pattern_answer_stem)
        ))

    for m in TRANSFER_PROMPT_RE.finditer(text):
        prompt = unescape(m.group(1)).strip()
        prompt = p0.strip_sakura_name(prompt)
        # Compress prompt whitespace (they're multi-line prose)
        prompt = re.sub(r'\s+', ' ', prompt).strip()
        if len(prompt) < 40 or len(prompt) > 500:
            continue
        # Assistant: use the chapter's pattern one-liner as the anchor
        if not pattern_answer_stem or len(pattern_answer_stem) < 40:
            continue
        assistant = pattern_answer_stem
        if p0.looks_sakura_branded(assistant):
            continue
        prov = {
            "source": rel,
            "extractor": "scenario-transfer-prompt",
            "target_bucket": "PERSONA",
            "chapter_topic": topic,
        }
        rec = p0.emit_pair(prompt, assistant, "persona", prov)
        if rec is not None:
            out.append(rec)

    return out


# ----------------------------------------------------------------------------
# EXTRACTOR C: APPENDIX-PAIR (pair records inside appendix files)
# ----------------------------------------------------------------------------

# Appendix pair records use (pair :id :deep-structure ...
#                                 (scenario-a :setting "..." :prose "...")
#                                 (scenario-b :setting "..." :prose "..."))
# We emit ONE pair per (pair) record: user = deep-structure question,
# assistant = shorter of the two scenarios trimmed to a compact teach.
# Prefer the :teach fields if present.

APPENDIX_PAIR_RE = re.compile(
    r'\(pair\s+:id\s+"([^"]+)"\s+'
    r':deep-structure\s+"((?:[^"\\]|\\.)*)"',
    re.DOTALL
)


def extract_appendix_pairs(text: str, book_path: Path) -> list:
    """From appendix files, each (pair :id :deep-structure ...) → one pair
    where the user = "walk me through <deep-structure gist>" and assistant
    is the deep-structure sentence expanded into a compact heuristic."""
    out = []
    rel = str(book_path.relative_to(MOTOI_ROOT))

    for m in APPENDIX_PAIR_RE.finditer(text):
        pair_id = m.group(1)
        ds = unescape(m.group(2)).strip()
        ds = p0.rewrite_fences(p0.scrub_verbs(p0.strip_sakura_name(ds)))
        if len(ds) < 60 or len(ds) > 800:
            continue
        if p0.looks_sakura_branded(ds):
            continue

        # Question extracted from first noun-phrase of deep-structure
        # E.g. "A customer is quietly learning..." → "customer who's
        # quietly learning the shape of your shop"
        # Simpler: use the pair_id (e.g. "A-1") + "walk me through the pattern"
        q_shapes = [
            "what's the deep structure here?",
            "one-line pattern for this?",
            "quick — what's really going on?",
            "read the pattern.",
        ]
        q = q_shapes[len(out) % len(q_shapes)]

        # We also want the FIRST scenario's :teach if present (nested inside
        # the (pair) block). Simpler: use deep-structure as the assistant.
        assistant = ds
        prov = {
            "source": rel,
            "extractor": "appendix-pair-deep-structure",
            "target_bucket": "PERSONA",
            "pair_id": pair_id,
        }
        rec = p0.emit_pair(q, assistant, "persona", prov)
        if rec is not None:
            out.append(rec)

    # Additionally: extract every :teach block in the appendix (they belong
    # to nested scenarios and are direct pattern texts).
    teach_qs = [
        "teach me the pattern.",
        "what's the underlying heuristic?",
        "walk me through the move.",
        "one-paragraph guide.",
    ]
    teach_count = 0
    for m in TEACH_RE.finditer(text):
        val = unescape(m.group(1)).strip()
        val = p0.rewrite_fences(p0.scrub_verbs(p0.strip_sakura_name(val)))
        if len(val) < 60 or len(val) > 1400:
            continue
        if p0.looks_sakura_branded(val):
            continue
        q = teach_qs[teach_count % len(teach_qs)]
        prov = {
            "source": rel,
            "extractor": "appendix-teach",
            "target_bucket": "PERSONA",
        }
        rec = p0.emit_pair(q, val, "persona", prov)
        if rec is not None:
            out.append(rec)
            teach_count += 1

    return out


# ----------------------------------------------------------------------------
# DRIVER
# ----------------------------------------------------------------------------

def iter_files(book_dir: Path, exts=(".slat", ".slatl")):
    if not book_dir.exists():
        print(f"MISSING: {book_dir}", file=sys.stderr)
        return
    for p in sorted(book_dir.iterdir()):
        if p.name in ("MANIFEST.slat", "README.slat"):
            continue
        if p.suffix in exts and p.is_file():
            yield p


def dedupe(records):
    seen = set()
    out = []
    for rec in records:
        u = rec["messages"][0]["content"]
        a = rec["messages"][1]["content"]
        key = (u, a)
        if key in seen:
            continue
        seen.add(key)
        out.append(rec)
    return out


def run_glances():
    print("=== EXT-A: book-of-glances ===")
    all_records = []
    fc = 0
    for p in iter_files(BOOK_GLANCES):
        fc += 1
        text = p.read_text(encoding="utf-8", errors="replace")
        recs = extract_glance_items(text, p)
        print(f"  {p.name}: raw={len(recs)}")
        all_records.extend(recs)
    all_records = dedupe(all_records)
    print(f"  files={fc}  deduped-pairs={len(all_records)}")
    return all_records, fc


def run_scenarios():
    print("=== EXT-B: book-of-paired-scenarios ===")
    all_records = []
    fc = 0
    for p in iter_files(BOOK_SCENARIOS):
        fc += 1
        text = p.read_text(encoding="utf-8", errors="replace")
        # Appendix files use nested (pair ...) format
        if "appendix" in p.name.lower():
            recs = extract_appendix_pairs(text, p)
        else:
            recs = extract_scenarios(text, p)
        print(f"  {p.name}: raw={len(recs)}")
        all_records.extend(recs)
    all_records = dedupe(all_records)
    print(f"  files={fc}  deduped-pairs={len(all_records)}")
    return all_records, fc


def main():
    if OUT_FILE.exists():
        print(f"ABORT — output already exists (no overwrites rule): {OUT_FILE}",
              file=sys.stderr)
        sys.exit(2)

    now = datetime.now(timezone.utc).isoformat()

    glance_recs, glance_files = run_glances()
    scen_recs, scen_files = run_scenarios()

    all_records = dedupe(glance_recs + scen_recs)

    header = {
        "_provenance_header": True,
        "generated_at": now,
        "generator": "salvage-w03-extension-2026-07-16.py",
        "author": "The Engineer · W-03 extension",
        "doctrine_source": "architect-scheme-doc-edit-plan-2026-07-16.slat",
        "prior_wave": "salvage-w03-listening-personality-scenarios-persona-2026-07-16.jsonl (536 pairs)",
        "source_books": ["book-of-glances", "book-of-paired-scenarios"],
        "source_file_count": glance_files + scen_files,
        "extractor_kinds": ["glance-item", "scenario-teach", "scenario-pattern",
                            "scenario-transfer-prompt", "appendix-pair-deep-structure",
                            "appendix-teach"],
        "quality_filters": [
            "no-corporate-names",
            "no-philosopher-name-drops-in-persona-assistant-text",
            "no-sakura-self-reference",
            "fence-swap-scheme-to-motoi",
            "verb-scrub-mechanical",
        ],
        "target_bucket": "PERSONA",
        "pair_count": len(all_records),
        "output_path": str(OUT_FILE),
        "voice_lock": "Motoi Copilot dryer register — checked against "
                      "3 source samples per book (glances glance-item, "
                      "scenarios :teach, scenarios :pattern).",
    }

    with OUT_FILE.open("w") as f:
        f.write(json.dumps(header) + "\n")
        for rec in all_records:
            f.write(json.dumps(rec) + "\n")

    print(f"\nWROTE {OUT_FILE}  pairs={len(all_records)}")
    print(f"  from glances: {len(glance_recs)}")
    print(f"  from scenarios: {len(scen_recs)}")
    print(f"  deduped total: {len(all_records)}")
    return {"pairs": len(all_records), "samples": all_records[:3]}


if __name__ == "__main__":
    result = main()
    print("\n=== SUMMARY ===")
    print(json.dumps({"pairs": result["pairs"]}, indent=2))
    print("\n=== SAMPLES ===")
    for i, s in enumerate(result["samples"], 1):
        print(f"--- sample {i} ---")
        print(f"USER: {s['messages'][0]['content'][:200]}")
        print(f"ASST: {s['messages'][1]['content'][:200]}")
