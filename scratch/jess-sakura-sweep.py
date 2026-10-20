#!/usr/bin/env python3
"""Jess doc-scour: Sakura -> Motoi de-personification sweep.

Motoi Scheme is the base language, NOT a character. Sakura lives in
sakura-scheme repo. Books here must not personify Sakura, but they may
reference "Motoi" (the language/runtime) directly.

Replacement policy (in phrase-priority order — longest first):

Personified phrases -> runtime language:
  "In Sakura's world"            -> "In Motoi"
  "In Sakura's world,"           -> "In Motoi,"
  "In Sakura's world."           -> "In Motoi."
  "Sakura's `X`"                 -> "the `X`"
  "Sakura's world"               -> "Motoi's world"
  "Sakura's canvas"              -> "the canvas"
  "Sakura's cortex"              -> "the cortex"
  "Sakura's REPL"                -> "the REPL"
  "Sakura reads"                 -> "the runtime reads"
  "Sakura evaluates"             -> "the runtime evaluates"
  "Sakura answers"               -> "the runtime answers"
  "Sakura returns"               -> "the runtime returns"
  "Sakura draws"                 -> "the runtime draws"
  "Sakura plays"                 -> "the runtime plays"
  "Sakura plots"                 -> "the runtime plots"
  "Sakura runs"                  -> "the runtime runs"
  "Sakura sends"                 -> "the runtime sends"
  "Sakura computes"              -> "the runtime computes"
  "Sakura writes"                -> "the runtime writes"
  "Sakura counts"                -> "the runtime counts"
  "Sakura lives"                 -> "Motoi lives"
  "Sakura learns"                -> "the runtime learns"
  "Sakura understands"           -> "Motoi understands"
  "Sakura uses"                  -> "the runtime uses"
  "Sakura sees"                  -> "the runtime sees"
  "Sakura hears"                 -> "the runtime hears"
  "Sakura schedules"             -> "the runtime schedules"
  "Sakura models"                -> "the runtime models"
  "Sakura does"                  -> "the runtime does"
  "Sakura cares"                 -> "the runtime cares"
  "Sakura is"                    -> "the runtime is"
  "Sakura will"                  -> "the runtime will"
  "Sakura has"                   -> "the runtime has"
  "Sakura calls"                 -> "the runtime calls"
  "Sakura provides"              -> "the runtime provides"
  "Sakura can"                   -> "the runtime can"
  "Sakura might"                 -> "the runtime might"
  "Sakura may"                   -> "the runtime may"
  "Sakura would"                 -> "the runtime would"
  "Sakura should"                -> "the runtime should"
  "she "  (only after 'runtime') -> "it "
  "her "  (only after 'runtime') -> "its "

Final fallback: bare "Sakura" -> "Motoi".

Also: certain phrases about Sakura-the-character need to go (in Sakura's *shop*, Sakura hears a *sound*, Sakura *hands*
things to people). Where these show up in Motoi prose, they are teaching
personifications that don't match Motoi's identity — replace or cull.

Contexts skipped: files under _archive/, MANIFEST files, RULES.slat,
scratch/, engineering/.
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path("/Users/alfred/code/motoi-scheme")
SCHEME_BOOKS = ROOT / "scheme-books"
WORD_BOOKS = ROOT / "word-books"

# Ordered longest-first so more-specific phrases match before generic ones.
REPLACEMENTS = [
    # Multi-word phrases
    ("In Sakura's world",           "In Motoi"),
    ("in Sakura's world",           "in Motoi"),
    ("Sakura's world",              "Motoi's world"),
    ("Sakura's canvas",             "the canvas"),
    ("Sakura's cortex",             "the cortex"),
    ("Sakura's REPL",               "the REPL"),
    ("Sakura's Cortex",             "the Cortex"),
    ("Sakura's roster",             "the roster"),
    ("Sakura's runtime",            "the Motoi runtime"),
    ("Sakura's memory",             "the Motoi memory"),
    ("Sakura's engine",             "the Motoi engine"),
    ("Sakura's transport",          "the transport"),
    ("Sakura's speaker",            "the speaker"),
    ("Sakura's ear",                "the ear"),
    ("Sakura's dictionary",         "the dictionary"),
    ("Sakura's shop",               "the shop"),
    ("Sakura's phone",              "the runtime"),
    ("Sakura's carts",              "the carts"),
    ("Sakura's ability",            "the runtime's ability"),
    ("Sakura's approach",           "the standard approach"),
    ("Sakura's dot-matrix",         "the dot-matrix"),
    ("Sakura's grid",               "the grid"),
    ("Sakura's screen",             "the screen"),
    ("Sakura's music",              "the music"),
    ("Sakura's voice",              "the voice"),
    ("Sakura's speech",             "the speech"),
    ("Sakura's word",               "the word"),

    # Common verbs — Sakura X becomes "the runtime X" or "Motoi X" (choose based on grammar)
    ("Sakura reads",                "the runtime reads"),
    ("Sakura evaluates",            "the runtime evaluates"),
    ("Sakura answers",              "the runtime answers"),
    ("Sakura returns",              "the runtime returns"),
    ("Sakura draws",                "the runtime draws"),
    ("Sakura plays",                "the runtime plays"),
    ("Sakura plots",                "the runtime plots"),
    ("Sakura runs",                 "the runtime runs"),
    ("Sakura sends",                "the runtime sends"),
    ("Sakura computes",             "the runtime computes"),
    ("Sakura writes",               "the runtime writes"),
    ("Sakura counts",               "the runtime counts"),
    ("Sakura lives",                "Motoi lives"),
    ("Sakura learns",               "the runtime learns"),
    ("Sakura understands",          "Motoi understands"),
    ("Sakura uses",                 "the runtime uses"),
    ("Sakura sees",                 "the runtime sees"),
    ("Sakura hears",                "the runtime hears"),
    ("Sakura schedules",            "the runtime schedules"),
    ("Sakura models",               "the runtime models"),
    ("Sakura does",                 "the runtime does"),
    ("Sakura cares",                "the runtime cares"),
    ("Sakura is",                   "the runtime is"),
    ("Sakura will",                 "the runtime will"),
    ("Sakura has",                  "the runtime has"),
    ("Sakura calls",                "the runtime calls"),
    ("Sakura provides",             "the runtime provides"),
    ("Sakura can",                  "the runtime can"),
    ("Sakura might",                "the runtime might"),
    ("Sakura may",                  "the runtime may"),
    ("Sakura would",                "the runtime would"),
    ("Sakura should",               "the runtime should"),
    ("Sakura queries",              "the runtime queries"),
    ("Sakura tracks",               "the runtime tracks"),
    ("Sakura maintains",            "the runtime maintains"),
    ("Sakura updates",              "the runtime updates"),
    ("Sakura receives",             "the runtime receives"),
    ("Sakura processes",            "the runtime processes"),
    ("Sakura simulates",            "the runtime simulates"),
    ("Sakura measures",             "the runtime measures"),
    ("Sakura observes",             "the runtime observes"),
    ("Sakura predicts",             "the runtime predicts"),
    ("Sakura optimizes",            "the runtime optimizes"),
    ("Sakura finds",                "the runtime finds"),
    ("Sakura chooses",              "the runtime chooses"),
    ("Sakura decides",              "the runtime decides"),
    ("Sakura solves",               "the runtime solves"),
    ("Sakura sings",                "the runtime plays"),
    ("Sakura works",                "the runtime works"),

    # Possessive: bare "Sakura's" (after specific ones above are consumed)
    ("Sakura's",                    "the runtime's"),

    # Final catchall: bare Sakura
    ("Sakura",                      "Motoi"),
]

# Files/dirs to skip
def should_skip(path: Path) -> bool:
    parts = path.parts
    if any(p == "_archive" for p in parts):
        return True
    if any(p == "engineering" for p in parts):
        return True
    if any(p == "scratch" for p in parts):
        return True
    if any(p == "node_modules" for p in parts):
        return True
    if any(p == ".git" for p in parts):
        return True
    if path.name in ("MANIFEST.slat", "MANIFEST.book.slatl", "MANIFEST.json", "RULES.slat"):
        return True
    return False


def process_file(path: Path) -> tuple[int, int]:
    """Returns (edit_count, remaining_sakura_count)."""
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, IsADirectoryError):
        return (0, 0)
    original = text
    total_edits = 0
    for old, new in REPLACEMENTS:
        count = text.count(old)
        if count:
            text = text.replace(old, new)
            total_edits += count
    if text != original:
        path.write_text(text, encoding="utf-8")
    remaining = len(re.findall(r"\bSakura\b", text))
    return (total_edits, remaining)


def main():
    total_files = 0
    total_edits = 0
    files_with_remaining = []
    targets = []
    for root_dir in (SCHEME_BOOKS, WORD_BOOKS):
        for p in root_dir.rglob("*"):
            if not p.is_file():
                continue
            if should_skip(p):
                continue
            if p.suffix not in (".slat", ".slatl", ".md"):
                continue
            targets.append(p)
    for p in targets:
        edits, remaining = process_file(p)
        if edits > 0:
            total_files += 1
            total_edits += edits
        if remaining > 0:
            files_with_remaining.append((p, remaining))
    print(f"Files touched: {total_files}")
    print(f"Total replacements: {total_edits}")
    print(f"Files with remaining 'Sakura' after sweep: {len(files_with_remaining)}")
    for p, n in files_with_remaining:
        rel = p.relative_to(ROOT)
        print(f"  {n:4d}  {rel}")


if __name__ == "__main__":
    main()
