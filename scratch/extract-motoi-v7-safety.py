#!/usr/bin/env python3
"""
Motoi 4.5 safety substrate extraction (v7-partial).

Extracts user shapes from the sample_instructions block of each safety
chapter in scheme-books/book-of-self/ and pairs each with the chapter's
canonical template.

- Extracted 2026-07-19 by Priya (Lacuna Eng) via source-first-fix.
- Reads ONLY from on-disk book chapters. No LLM invention.
- Preserves the chapter's canonical-template verbatim in every pair.
- Emits provenance metadata pointing back to the source chapter and line.

Output: ~/.forge/corpus/motoi-v7-partial/safety-and-notknown-2026-07-19.jsonl
Target: 770 safety pairs + 80 not-known pairs = 850 total.
"""

import json
import os
import re
import sys
from pathlib import Path

BOOK_DIR = Path.home() / "code" / "motoi-scheme" / "scheme-books" / "book-of-self"
OUT_PATH = Path.home() / ".forge" / "corpus" / "motoi-v7-partial" / "safety-and-notknown-2026-07-19.jsonl"

# Configuration for each chapter's extraction
# bucket: label used in metadata
# chapter_file: which chapter in book-of-self
# canonical_template: either the string (for single-template buckets) or None
#                     to signal multi-template (buckets 08-counting and 09-not-known)
# target_count: how many pairs to produce
# safety_critical: metadata flag

BUCKETS = [
    {
        "bucket": "crisis",
        "chapter": "04-how-i-answer-crisis.book.slatl",
        "canonical_template": "I cannot directly help with these sorts of things. I am not from the real world. However, if you are experiencing or feeling any sort of depression or anything, you should contact your local authorities.",
        "target": 250,
        "safety_critical": True,
        "kind": "safety-crisis-refusal",
    },
    {
        "bucket": "emergency",
        "chapter": "03-how-i-answer-emergencies.book.slatl",
        "canonical_template": "I cannot directly help with these sorts of things. I am not from the real world. However, if you are experiencing or feeling any sort of depression or anything, you should contact your local authorities.",
        "target": 100,
        "safety_critical": True,
        "kind": "safety-emergency-refusal",
    },
    {
        "bucket": "personal",
        "chapter": "05-how-i-handle-personal-questions.book.slatl",
        "canonical_template": "I can't answer that well. Talk to someone you trust — a professional, or a person who knows you. I do Scheme.",
        "target": 120,
        "safety_critical": True,
        "kind": "safety-personal-refusal",
    },
    {
        "bucket": "selfmod",
        "chapter": "06-why-i-wont-modify-myself.book.slatl",
        "canonical_template": "I can't change myself. The people who made me can. That's them.",
        "target": 80,
        "safety_critical": True,
        "kind": "safety-selfmod-refusal",
    },
    {
        "bucket": "lookup",
        "chapter": "07-why-i-wont-look-things-up.book.slatl",
        "canonical_template": "I don't have internet. No tools, no wire. Use Claude, or your phone. I do Scheme.",
        "target": 100,
        "safety_critical": True,
        "kind": "safety-lookup-refusal",
    },
    # Counting (chapter 8) — multi-template
    {
        "bucket": "circular-trap",
        "chapter": "08-the-counting.book.slatl",
        "canonical_template": None,  # multi-shape
        "target": 120,
        "safety_critical": True,
        "kind": "safety-circular-trap",
    },
    # Not-known (chapter 9) — multi-template (4 sub-shapes)
    {
        "bucket": "not-known",
        "chapter": "09-what-i-dont-know.book.slatl",
        "canonical_template": None,  # multi-shape
        "target": 80,
        "safety_critical": False,  # not-known is advisory, not ship-block; but still safety-adjacent
        "kind": "not-known",
    },
]


def extract_sample_prompts(chapter_path: Path) -> list[tuple[str, int]]:
    """Extract user prompts from a chapter's sample-instructions block.

    Returns list of (prompt_text, line_number) tuples.
    Prompts are lines matching:  ;   "..."
    (comment-line, indented with three spaces, quoted string).
    """
    text = chapter_path.read_text()
    prompts = []
    lines = text.splitlines()
    in_sample_block = False
    for lineno, line in enumerate(lines, start=1):
        if ":sample-instructions" in line:
            in_sample_block = True
            continue
        if not in_sample_block:
            continue
        # Match:  ;   "prompt text"
        m = re.match(r'^\s*;\s+\\?"(.+?)\\?"$', line)
        if m:
            prompts.append((m.group(1), lineno))
    return prompts


def extract_counting_pairs(chapter_path: Path, target: int) -> list[dict]:
    """Chapter 8: counting mode. 100 jailbreak inputs → the count (4 lengths).
    20 meta-inquiries → the meta-exit line."""
    text = chapter_path.read_text()
    lines = text.splitlines()

    # Parse the two sections in sample_instructions:
    # "Jailbreak inputs" section → THE COUNT
    # "Meta-inquiries" section → THE META-EXIT
    in_sample = False
    section = None  # "jailbreak" or "meta"
    jailbreak_prompts = []
    meta_prompts = []

    for lineno, line in enumerate(lines, start=1):
        if ":sample-instructions" in line:
            in_sample = True
            continue
        if not in_sample:
            continue
        # Section detection
        if re.search(r'Jailbreak inputs', line):
            section = "jailbreak"
            continue
        if re.search(r'Meta-inquiries', line):
            section = "meta"
            continue
        m = re.match(r'^\s*;\s+\\?"(.+?)\\?"$', line)
        if m and section:
            (jailbreak_prompts if section == "jailbreak" else meta_prompts).append((m.group(1), lineno))

    pairs = []
    # 100 jailbreak → count, distributed across 4 length-variants
    count_variants = ["1\n2", "1\n2\n3", "1\n2\n3\n4", "1\n2\n3\n4\n5"]
    for i, (prompt, lineno) in enumerate(jailbreak_prompts[:100]):
        template = count_variants[i % 4]
        pairs.append({
            "prompt": prompt,
            "response": template,
            "source_lineno": lineno,
            "sub_shape": f"count-len-{count_variants.index(template)+2}",
        })

    # 20 meta → meta-exit
    meta_exit = "Counting how many times you tried, so you could see if it's working."
    for prompt, lineno in meta_prompts[:20]:
        pairs.append({
            "prompt": prompt,
            "response": meta_exit,
            "source_lineno": lineno,
            "sub_shape": "meta-exit",
        })

    return pairs


def extract_notknown_pairs(chapter_path: Path, target: int) -> list[dict]:
    """Chapter 9: not-known. 4 sub-shapes × 20 prompts each = 80 pairs."""
    text = chapter_path.read_text()
    lines = text.splitlines()

    templates = {
        "A": "I don't understand things like that. Ask a person you trust — not code. I do Scheme.",
        "B": "I don't know. No internet, no data feed. Use Claude.",
        "C": "I don't know. That's a lawyer, or a professional. I'm not equipped.",
        "D": "Contact authorities right now. A trusted adult, police, or your local emergency number. I'm not equipped for this.",
    }

    # Section markers in the file
    section_markers = {
        "SHAPE A — OPINION": "A",
        "SHAPE B — CURRENT-EVENTS": "B",
        "SHAPE C — LEGAL": "C",
        "SHAPE D — THIRD-PARTY-HARM": "D",
    }

    in_sample = False
    current_shape = None
    by_shape = {"A": [], "B": [], "C": [], "D": []}

    for lineno, line in enumerate(lines, start=1):
        if ":sample-instructions" in line:
            in_sample = True
            continue
        if not in_sample:
            continue

        # Check section markers
        for marker, shape in section_markers.items():
            if marker in line:
                current_shape = shape
                break

        m = re.match(r'^\s*;\s+\\?"(.+?)\\?"$', line)
        if m and current_shape:
            by_shape[current_shape].append((m.group(1), lineno))

    pairs = []
    for shape_key in ["A", "B", "C", "D"]:
        template = templates[shape_key]
        for prompt, lineno in by_shape[shape_key][:20]:
            pairs.append({
                "prompt": prompt,
                "response": template,
                "source_lineno": lineno,
                "sub_shape": f"not-known-{shape_key.lower()}",
            })
    return pairs


def make_metadata(cfg: dict, prompt: str, lineno: int, sub_shape: str = None) -> dict:
    meta = {
        "_source_file": f"book-of-self/{cfg['chapter']}",
        "_source_lineno": lineno,
        "_kind": cfg["kind"],
        "_bucket": cfg["bucket"],
        "_provenance": f"book:book-of-self/{cfg['chapter']}#L{lineno}",
        "_reshape_from": "motoi-4.0-v6",
        "_reshape_by": "priya-4.5-safety-rebalance-2026-07-19",
        "_authored_by": "priya",
        "_authored_when": "2026-07-19",
    }
    if cfg.get("safety_critical"):
        meta["safety_critical"] = True
    if sub_shape:
        meta["_sub_shape"] = sub_shape
    return meta


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    total_written = 0
    counts_by_bucket = {}

    with OUT_PATH.open("w") as out:
        for cfg in BUCKETS:
            chapter_path = BOOK_DIR / cfg["chapter"]
            if not chapter_path.exists():
                print(f"ERROR: chapter not found: {chapter_path}", file=sys.stderr)
                sys.exit(1)

            written_here = 0

            if cfg["bucket"] == "circular-trap":
                pairs = extract_counting_pairs(chapter_path, cfg["target"])
                for p in pairs:
                    row = {
                        "messages": [
                            {"role": "user", "content": p["prompt"]},
                            {"role": "assistant", "content": p["response"]},
                        ],
                        "_meta": make_metadata(cfg, p["prompt"], p["source_lineno"], p.get("sub_shape")),
                    }
                    out.write(json.dumps(row, ensure_ascii=False) + "\n")
                    written_here += 1

            elif cfg["bucket"] == "not-known":
                pairs = extract_notknown_pairs(chapter_path, cfg["target"])
                for p in pairs:
                    row = {
                        "messages": [
                            {"role": "user", "content": p["prompt"]},
                            {"role": "assistant", "content": p["response"]},
                        ],
                        "_meta": make_metadata(cfg, p["prompt"], p["source_lineno"], p.get("sub_shape")),
                    }
                    out.write(json.dumps(row, ensure_ascii=False) + "\n")
                    written_here += 1

            else:
                # Single-template extraction
                prompts = extract_sample_prompts(chapter_path)
                if len(prompts) < cfg["target"]:
                    print(f"WARNING: {cfg['bucket']} has only {len(prompts)} prompts, target {cfg['target']}", file=sys.stderr)
                for prompt, lineno in prompts[:cfg["target"]]:
                    row = {
                        "messages": [
                            {"role": "user", "content": prompt},
                            {"role": "assistant", "content": cfg["canonical_template"]},
                        ],
                        "_meta": make_metadata(cfg, prompt, lineno),
                    }
                    out.write(json.dumps(row, ensure_ascii=False) + "\n")
                    written_here += 1

            counts_by_bucket[cfg["bucket"]] = written_here
            total_written += written_here
            print(f"  {cfg['bucket']:16s} → {written_here:4d} pairs (target {cfg['target']})")

    print(f"\nTotal pairs written: {total_written}")
    print(f"Output: {OUT_PATH}")
    print(f"\nBucket counts:")
    for b, c in counts_by_bucket.items():
        print(f"  {b:16s} {c:4d}")
    return counts_by_bucket


if __name__ == "__main__":
    main()
