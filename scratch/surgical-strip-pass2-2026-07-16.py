#!/usr/bin/env python3
"""
Pass 2: catch remaining sakura tokens that pass 1's conservative rules missed.

New patterns:
- sakura>  REPL prompt -> motoi>
- 'sakura symbol in code -> 'motoi
- sakura@lacuna handle -> motoi@lacuna
- sakura.key / sakura.pub / sakura.state / sakura.pos -> motoi.*
- ~/.cortex/sakura/ -> ~/.cortex/motoi/
- "sakura" string literal -> "motoi"
- book-of-motion did entity rename; skip.
- book-of-motion: any lingering Sakura -> the sprite (already covered)
- Other books: remaining prose Sakura -> the runtime

Also: [VISUAL: the sprite ...] -> [VISUAL: The sprite ...] (start-of-block capitalization)
"""
import re
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path("/Users/alfred/code/motoi-scheme/scheme-books")
HEARTBEAT_JSON = Path("/Users/alfred/code/motoi-scheme/scratch/surgical-strip-heartbeat.json")

TARGET_BOOKS = [
    "book-of-motion",
    "book-of-music",
    "book-of-slat",
    "book-of-instruments",
    "book-of-scheme",
    "book-of-challenges",
]

pass2_stats = {b: {"files_touched": 0, "substitutions": 0} for b in TARGET_BOOKS}
diff_samples = []


def process(text, book):
    subs = 0
    original_text = text

    # REPL prompt: "sakura>" at start of line -> "motoi>"
    text, n = re.subn(r'(?m)^(\s*)sakura>', r'\1motoi>', text)
    subs += n

    # Fix opening-square-bracket capitalization: [VISUAL: the sprite ...] -> [VISUAL: The sprite ...]
    if book == "book-of-motion":
        text, n = re.subn(r'(\[VISUAL:\s*)the sprite', r'\1The sprite', text)
        subs += n
        # Also fix generic sentence-start "the sprite" that got created after periods
        # e.g. ". the sprite " -> ". The sprite "
        text, n = re.subn(r'(\.\s+)the sprite', r'\1The sprite', text)
        subs += n
        # After other end-of-sentence: !, ?
        text, n = re.subn(r'([!?]\s+)the sprite', r'\1The sprite', text)
        subs += n

    # sakura@lacuna handle
    text, n = re.subn(r'\bsakura@lacuna\b', 'motoi@lacuna', text)
    subs += n

    # ~/.cortex/sakura/ path
    text, n = re.subn(r'~/\.cortex/sakura/', '~/.cortex/motoi/', text)
    subs += n

    # sakura.KEY / sakura.STATE / sakura.STATE.SNAPSHOT etc as dotted namespace
    text, n = re.subn(r'\bsakura\.(key|pub|state|pos|mood|snapshot|prefs|user)\b', r'motoi.\1', text)
    subs += n

    # Quoted "sakura" string
    text, n = re.subn(r'"sakura"', '"motoi"', text)
    subs += n
    text, n = re.subn(r'\\"sakura\\"', r'\\"motoi\\"', text)
    subs += n

    # 'sakura symbol
    text, n = re.subn(r"'sakura(?![-\w])", "'motoi", text)
    subs += n

    # (sakura "…") narrator role in dialogues:  becomes (runtime "…")
    text, n = re.subn(r'\(sakura\s+\\?"', r'(runtime "', text)
    subs += n
    text, n = re.subn(r'\(sakura\s+"', r'(runtime "', text)
    subs += n

    # Bare `sakura` symbol in prose lists (e.g. "the symbol `sakura`")
    text, n = re.subn(r'`sakura`', '`motoi`', text)
    subs += n

    # Standalone lowercase sakura (not part of identifier) - in prose bullets etc.
    # Do this LAST so we don't undo more precise replacements.
    # Keep it conservative: only if not part of longer word
    text, n = re.subn(r'\bsakura\b(?![-.@\w])', 'motoi', text)
    subs += n

    # Remaining prose "Sakura" - replace with "the runtime" (book-of-motion already handled)
    if book != "book-of-motion":
        # Possessive "Sakura's" -> "the runtime's"
        text, n = re.subn(r"\bSakura's\b", "the runtime's", text)
        subs += n
        # Generic Sakura -> the runtime (start-of-sentence gets "The runtime")
        # Handle sentence-start first
        text, n = re.subn(r'(?m)^Sakura\b', 'The runtime', text)
        subs += n
        text, n = re.subn(r'(\.\s+)Sakura\b', r'\1The runtime', text)
        subs += n
        text, n = re.subn(r'([!?]\s+)Sakura\b', r'\1The runtime', text)
        subs += n
        # Any remaining Sakura -> the runtime (mid-sentence)
        text, n = re.subn(r'\bSakura\b', 'the runtime', text)
        subs += n

    # Fix double "the the runtime" (in case of prior "the runtime" from pass 1 combined with "Sakura" here)
    text, n = re.subn(r'\bthe the runtime\b', 'the runtime', text)
    subs += n

    return text, subs, (original_text != text)


def main():
    for book in TARGET_BOOKS:
        book_path = ROOT / book
        if not book_path.exists():
            continue
        files = []
        for pat in ("**/*.slatl", "**/*.slat", "**/*.md"):
            files.extend(book_path.glob(pat))
        files = sorted({f for f in files if f.is_file()})
        for f in files:
            text = f.read_text(encoding="utf-8", errors="replace")
            new_text, subs, changed = process(text, book)
            if not changed:
                continue
            # Capture sample
            if len(diff_samples) < 6:
                orig_lines = text.split("\n")
                new_lines = new_text.split("\n")
                for idx, (o, n) in enumerate(zip(orig_lines, new_lines)):
                    if o != n:
                        start = max(0, idx - 2)
                        end = min(len(orig_lines), idx + 6)
                        diff_samples.append({
                            "book": book,
                            "file": str(f.relative_to(ROOT)),
                            "before": "\n".join(orig_lines[start:end]),
                            "after": "\n".join(new_lines[start:end]) if end <= len(new_lines) else "",
                        })
                        break
            f.write_text(new_text, encoding="utf-8")
            pass2_stats[book]["files_touched"] += 1
            pass2_stats[book]["substitutions"] += subs
    # Update heartbeat json
    prior = json.loads(HEARTBEAT_JSON.read_text()) if HEARTBEAT_JSON.exists() else {}
    prior["pass2"] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "per_book": pass2_stats,
        "samples": diff_samples,
    }
    HEARTBEAT_JSON.write_text(json.dumps(prior, indent=2, default=str))
    print(json.dumps(pass2_stats, indent=2))
    print(f"\nSample diffs: {len(diff_samples)}")


if __name__ == "__main__":
    main()
