#!/usr/bin/env python3
"""
Pass 3: catch remaining sakura tokens.

New patterns:
- :voice "sakura-teaching"  (string form) -> "motoi-teaching"
- :source-path "...sakura-preservation..." / "...sakura-scheme..." -> remove line
- book-of-motion: sakura-pos / sakura-x / sakura-y variables in code -> hero-pos / hero-x / hero-y
- "sakura-orders-*" / "sakura-products-*" string literals -> "orders-*" / "products-*"
- sakura-cart CLI command -> motoi-cart
- sakura-pink palette token -> pink
- ;; appendix-j-sakura-reads-her-own-reader.slat comment header -> update to motoi variant
- Rename appendix-j-sakura-reads-her-own-reader.book.slatl -> appendix-j-runtime-reads-her-own-reader.book.slatl (both books-of)
- CHAPTERS index: sakura-pos in key-verbs list -> hero-pos
"""
import re
import shutil
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

pass3_stats = {b: {"files_touched": 0, "substitutions": 0} for b in TARGET_BOOKS}
diff_samples = []
renames = []


def process(text, book):
    subs = 0
    original_text = text

    # :voice "sakura-teaching" -> "motoi-teaching"
    text, n = re.subn(r':voice(\s+)"sakura-teaching"', r':voice\1"motoi-teaching"', text)
    subs += n

    # Remove :source-path lines with sakura- residue (any variant)
    lines_out = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(':source-path') and ('sakura-' in line or 'sakura_' in line):
            subs += 1
            continue
        lines_out.append(line)
    text = "\n".join(lines_out)

    # book-of-motion: sakura-{pos,x,y,vx,vy} local variables in code -> hero-{...}
    if book == "book-of-motion":
        text, n = re.subn(r'\bsakura-(pos|x|y|vx|vy)\b', r'hero-\1', text)
        subs += n

    # book-of-challenges: sakura-orders-* / sakura-products-* string literals -> generic
    text, n = re.subn(r'\bsakura-orders-', 'orders-', text)
    subs += n
    text, n = re.subn(r'\bsakura-products-', 'products-', text)
    subs += n

    # sakura-cart CLI -> motoi-cart
    text, n = re.subn(r'\bsakura-cart\b', 'motoi-cart', text)
    subs += n

    # sakura-pink palette token
    text, n = re.subn(r'sakura-pink\s*\(the runtime only\)', 'accent-pink', text)
    subs += n
    text, n = re.subn(r'\bsakura-pink\b', 'accent-pink', text)
    subs += n

    # Comment header ;; appendix-j-sakura-... -> update reference
    text, n = re.subn(r';;\s*appendix-j-sakura-reads-her-own-reader\.slat', ';; appendix-j-runtime-reads-her-own-reader.slat', text)
    subs += n
    text, n = re.subn(r'appendix-j-sakura-reads-her-own-reader', 'appendix-j-runtime-reads-her-own-reader', text)
    subs += n

    # sakura-x (already in motion), also sakura-pos elsewhere
    text, n = re.subn(r'\bsakura-pos\b', 'runtime-pos', text)
    subs += n

    # Any remaining sakura- prefix identifiers -> motoi-
    text, n = re.subn(r'\bsakura-([a-z][a-z0-9-]*)\b', r'motoi-\1', text)
    subs += n

    # Any leftover Sakura in prose -> the runtime
    if book != "book-of-motion":
        text, n = re.subn(r'\bSakura\b', 'the runtime', text)
        subs += n
    else:
        text, n = re.subn(r'\bSakura\b', 'the sprite', text)
        subs += n

    # Any leftover bare "sakura" token
    text, n = re.subn(r'\bsakura\b', 'motoi' if book != 'book-of-motion' else 'hero', text)
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
            if len(diff_samples) < 4:
                orig_lines = text.split("\n")
                new_lines = new_text.split("\n")
                for idx in range(min(len(orig_lines), len(new_lines))):
                    if orig_lines[idx] != new_lines[idx]:
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
            pass3_stats[book]["files_touched"] += 1
            pass3_stats[book]["substitutions"] += subs

    # Rename the appendix-j files in both slat and scheme books
    for book in ("book-of-slat", "book-of-scheme"):
        old = ROOT / book / "appendix-j-sakura-reads-her-own-reader.book.slatl"
        new = ROOT / book / "appendix-j-runtime-reads-her-own-reader.book.slatl"
        if old.exists():
            shutil.move(str(old), str(new))
            renames.append({"from": str(old), "to": str(new)})

    prior = json.loads(HEARTBEAT_JSON.read_text()) if HEARTBEAT_JSON.exists() else {}
    prior["pass3"] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "per_book": pass3_stats,
        "samples": diff_samples,
        "renames": renames,
    }
    HEARTBEAT_JSON.write_text(json.dumps(prior, indent=2, default=str))
    print(json.dumps(pass3_stats, indent=2))
    print(f"\nSample diffs: {len(diff_samples)}, renames: {len(renames)}")


if __name__ == "__main__":
    main()
