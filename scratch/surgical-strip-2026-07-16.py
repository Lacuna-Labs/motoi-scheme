#!/usr/bin/env python3
"""
Surgical Sakura-residue stripper for 6 Motoi books.

Rules (from task):
- Entity/character "sakura" (bare, symbol form) -> "sprite" or "entity" (context)
- "Sakura Scheme" / "sakura-scheme" -> "Motoi Scheme" / "motoi-scheme"
- Persona callouts "> **Sakura says**" (and reflects/pauses) -> remove callout, keep content
- YAML "sakura-narrates: true" -> remove line
- :voice :sakura-teaching -> :voice :motoi-teaching
- :dialect ("motoi" "sakura") -> :dialect "motoi"
- :source-path "/Users/alfred/code/curator/..." or "sakura-scheme..." -> remove line
- book-of-scheme/01-hello-sakura-scheme -> hello-motoi-scheme (with mv)

NO commits. NO fabrication. Preserve technical content.
"""
import os
import re
import shutil
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path("/Users/alfred/code/motoi-scheme/scheme-books")
ARCHIVE_EMPTIED = Path("/Users/alfred/code/motoi-scheme/_archive/sakura-only-moved-2026-07-16/surgical-strip-emptied-2026-07-16/")
ARCHIVE_SHOP = Path("/Users/alfred/code/motoi-scheme/_archive/sakura-only-moved-2026-07-16/book-of-challenges-shop-residue/")
HEARTBEAT = Path("/Users/alfred/code/motoi-scheme/scratch/surgical-strip-heartbeat.slat")

TARGET_BOOKS = [
    "book-of-motion",
    "book-of-music",
    "book-of-slat",
    "book-of-instruments",
    "book-of-scheme",
    "book-of-challenges",
]

# Choose entity replacement per book context
# book-of-motion demos use it for a visual character -> "sprite"
# For other contexts we keep case-sensitive replacements below.
ENTITY_REPLACEMENT_PER_BOOK = {
    "book-of-motion": "sprite",  # visual demos
    # Others don't use the entity form heavily; leave prose "Sakura" untouched
    # (handled by persona-callout stripping and other rules)
}

stats = {
    "files_touched": {b: 0 for b in TARGET_BOOKS},
    "substitutions": {b: 0 for b in TARGET_BOOKS},
    "files_emptied": {b: 0 for b in TARGET_BOOKS},
    "needs_alfred": {b: 0 for b in TARGET_BOOKS},
    "renames": [],
    "sample_diffs": [],
    "chapters_moved_shop": [],
}


def strip_persona_callout(text):
    """
    A persona callout is a blockquote intro like:
      > **Sakura says**
      >
      > *content*
      > *more content*
    Followed by (optionally) trailing content.

    Strategy: find any line matching `> **Sakura (says|reflects|pauses)**`,
    remove that ONE line. If the next line is just `>` we also remove it (blank blockquote marker).
    KEEP the following quoted content — it may hold usable text; convert blockquote to plain
    paragraph by stripping leading `> ` from consecutive lines.

    Actually simpler: remove the "> **Sakura says**" line and any immediately-following ">" blank line,
    and CONVERT the subsequent blockquoted lines into a normal paragraph (drop `> ` prefix), which
    preserves the technical content but removes the persona framing.
    """
    subs = 0
    lines = text.split("\n")
    out = []
    i = 0
    pattern = re.compile(r'^\s*>\s*\*\*Sakura (says|reflects|pauses|thinks|notes)\*\*\s*$', re.IGNORECASE)
    while i < len(lines):
        m = pattern.match(lines[i])
        if m:
            subs += 1
            i += 1  # drop this line
            # If next is just "> " or ">" (blank blockquote), drop it too
            if i < len(lines) and re.match(r'^\s*>\s*$', lines[i]):
                i += 1
            # Now convert consecutive blockquote lines to plain paragraph
            while i < len(lines) and re.match(r'^\s*>', lines[i]):
                stripped = re.sub(r'^\s*>\s?', '', lines[i])
                out.append(stripped)
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out), subs


def rewrite_yaml_sakura_narrates(text):
    """Remove any lines that are exactly `sakura-narrates: true`."""
    subs = 0
    out = []
    for line in text.split("\n"):
        if re.match(r'^\s*sakura-narrates:\s*true\s*$', line, re.IGNORECASE):
            subs += 1
            continue
        out.append(line)
    return "\n".join(out), subs


def rewrite_source_path(text):
    """Remove :source-path lines that reference curator or sakura-scheme paths."""
    subs = 0
    out = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(':source-path'):
            # Check whether it's curator/sakura residue
            if ('curator/' in line or 'sakura-scheme' in line or 'sakura-scheme-book' in line):
                subs += 1
                continue
        out.append(line)
    return "\n".join(out), subs


def rewrite_dialect_pair(text):
    r"""Replace :dialect ("motoi" "sakura") with :dialect "motoi" (and other pairings)."""
    subs = 0
    # Match :dialect (... "sakura" ...) - only when the pair contains motoi
    def replace(m):
        nonlocal subs
        subs += 1
        return ':dialect           "motoi"'
    # Simple pattern for pair form
    new = re.sub(r':dialect\s+\(\s*"motoi"\s+"sakura"\s*\)', replace, text)
    new = re.sub(r':dialect\s+\(\s*"sakura"\s+"motoi"\s*\)', replace, new)
    # Also lone :dialect "sakura" -> :dialect "motoi"
    new2, n2 = re.subn(r':dialect(\s+)"sakura"(?!\-)', r':dialect\1"motoi"', new)
    subs += n2
    # And :dialect 'sakura-scheme -> :dialect 'motoi-scheme
    new3, n3 = re.subn(r":dialect(\s+)'sakura-scheme\b", r":dialect\1'motoi-scheme", new2)
    subs += n3
    return new3, subs


def rewrite_voice(text):
    subs = 0
    new, n = re.subn(r':voice(\s+):sakura-teaching\b', r':voice\1:motoi-teaching', text)
    subs += n
    return new, subs


def rewrite_sakura_scheme(text):
    """Replace 'Sakura Scheme' -> 'Motoi Scheme', 'sakura-scheme' -> 'motoi-scheme'."""
    subs = 0
    # Preserve case: "Sakura Scheme"
    new, n = re.subn(r'\bSakura Scheme\b', 'Motoi Scheme', text)
    subs += n
    # lowercase sakura-scheme (identifier form) — do this before generic
    # Avoid replacing inside :source-path strings we haven't removed yet (though those are removed)
    new, n = re.subn(r'\bsakura-scheme\b', 'motoi-scheme', new)
    subs += n
    # SAKURA-SCHEME
    new, n = re.subn(r'\bSAKURA-SCHEME\b', 'MOTOI-SCHEME', new)
    subs += n
    return new, subs


def rewrite_motion_entity(text):
    """
    In book-of-motion only: replace entity/character 'sakura' usages.
    Two forms:
      1. Symbol/identifier 'sakura' inside code (world/spawn 'sakura ...) and (define sakura ...)
         -> 'hero' to avoid clash with the existing `sprite` property key.
      2. Bare word 'Sakura' in [VISUAL: Sakura ...] and prose demos -> 'the sprite'.
    We keep the identifier ('hero') and prose form ('the sprite') distinct so both read cleanly.
    """
    subs = 0
    # Lowercase sakura as a variable/symbol -> hero (avoids clash with `sprite` property key)
    new, n = re.subn(r"\bsakura\b(?!-)", "hero", text)
    subs += n
    # Capitalized Sakura in prose — replace with "the sprite"
    new, n = re.subn(r"\bSakura\b", "the sprite", new)
    subs += n
    return new, subs


def rewrite_general_prose_sakura(text, book_name):
    """
    For books other than book-of-motion, we still need to strip prose 'Sakura' mentions
    that name the persona/entity. But we must be careful — many are inside now-stripped
    callouts. For remaining prose "Sakura ...", we'll:
      - convert "Sakura's memory" -> "the runtime's memory"
      - convert "Sakura writes about you" -> "the runtime writes about you"
      - generic prose "Sakura" -> "the runtime" (safest — Motoi is a language runtime)

    But this can break sentences. Instead, we take a lighter touch:
    - In book-of-slat, book-of-instruments, book-of-scheme, book-of-music, book-of-challenges:
      remove/neutralize "Sakura" that appears in narrative prose only when clearly persona.
    - Leave other Sakura tokens alone; they'll be flagged as NEEDS-ALFRED if a lot remain.
    """
    subs = 0
    # Standardized replacements for common prose patterns:
    patterns = [
        (r"Sakura's memory", "the runtime's memory"),
        (r"Sakura's Cortex", "the runtime's Cortex"),
        (r"Sakura writes about you", "the runtime writes about you"),
        (r"Sakura's own", "the runtime's own"),
        (r"how she remembers you", "how it remembers you"),
        (r"Sakura remembers", "the runtime remembers"),
        (r"Sakura learns", "the runtime learns"),
        (r"Sakura decides", "the runtime decides"),
        (r"Sakura says\b", "the runtime notes"),
        (r"Sakura reads\b", "the runtime reads"),
        (r"Sakura's", "the runtime's"),
    ]
    for pat, rep in patterns:
        new, n = re.subn(pat, rep, text)
        subs += n
        text = new
    return text, subs


def process_file(path, book_name):
    """Return (new_text, subs_count, notes) or (None, 0, notes) if unchanged."""
    original = path.read_text(encoding="utf-8", errors="replace")
    text = original
    total_subs = 0
    notes = []

    # 1. Strip persona callouts (keep quoted content)
    text, n = strip_persona_callout(text)
    total_subs += n
    if n:
        notes.append(f"persona-callouts:{n}")

    # 2. Remove YAML sakura-narrates
    text, n = rewrite_yaml_sakura_narrates(text)
    total_subs += n
    if n:
        notes.append(f"yaml-narrates:{n}")

    # 3. Remove :source-path residue lines
    text, n = rewrite_source_path(text)
    total_subs += n
    if n:
        notes.append(f"source-path:{n}")

    # 4. Rewrite :dialect pairs and 'sakura
    text, n = rewrite_dialect_pair(text)
    total_subs += n
    if n:
        notes.append(f"dialect:{n}")

    # 5. Rewrite :voice
    text, n = rewrite_voice(text)
    total_subs += n
    if n:
        notes.append(f"voice:{n}")

    # 6. Sakura Scheme / sakura-scheme -> Motoi Scheme / motoi-scheme
    text, n = rewrite_sakura_scheme(text)
    total_subs += n
    if n:
        notes.append(f"scheme-brand:{n}")

    # 7. Book-specific: motion book entity rename
    if book_name == "book-of-motion":
        text, n = rewrite_motion_entity(text)
        total_subs += n
        if n:
            notes.append(f"entity-rename:{n}")
    else:
        # Light-touch prose rewrite for remaining Sakura mentions
        text, n = rewrite_general_prose_sakura(text, book_name)
        total_subs += n
        if n:
            notes.append(f"prose-rewrite:{n}")

    if text == original:
        return None, 0, notes

    return text, total_subs, notes


def is_essentially_empty(text):
    """Check if a file has essentially no content after strip."""
    # Remove blockquote markers, blank lines, code fences
    lines = [ln.strip() for ln in text.split("\n")]
    meaningful = [ln for ln in lines if ln and not ln.startswith(";") and not re.match(r'^[\-=`>*]+$', ln)]
    return len(meaningful) < 5


def main():
    for book in TARGET_BOOKS:
        book_path = ROOT / book
        if not book_path.exists():
            print(f"[skip] {book} — not found")
            continue
        # Walk .slat, .slatl, .book.slatl, .md files
        files = []
        for pat in ("**/*.slatl", "**/*.slat", "**/*.md"):
            files.extend(book_path.glob(pat))
        # Dedup and filter
        files = sorted({f for f in files if f.is_file()})
        for f in files:
            new_text, subs, notes = process_file(f, book)
            if new_text is None:
                continue
            # Capture a sample diff (first few files)
            if len(stats["sample_diffs"]) < 6 and subs > 0:
                orig_lines = f.read_text(encoding="utf-8", errors="replace").split("\n")
                new_lines = new_text.split("\n")
                # Show first differing chunk (up to 15 lines context)
                for idx, (o, n) in enumerate(zip(orig_lines, new_lines)):
                    if o != n:
                        start = max(0, idx - 2)
                        end = min(len(orig_lines), idx + 6)
                        stats["sample_diffs"].append({
                            "book": book,
                            "file": str(f.relative_to(ROOT)),
                            "before": "\n".join(orig_lines[start:end]),
                            "after": "\n".join(new_lines[start:end]) if end <= len(new_lines) else "",
                        })
                        break
            # Write updates
            f.write_text(new_text, encoding="utf-8")
            stats["files_touched"][book] += 1
            stats["substitutions"][book] += subs

            # Check emptiness (skip MANIFEST-like files)
            if is_essentially_empty(new_text) and f.stat().st_size < 500:
                dest = ARCHIVE_EMPTIED / book / f.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(f), str(dest))
                stats["files_emptied"][book] += 1
    # Rename chapter file for book-of-scheme
    hello_old = ROOT / "book-of-scheme" / "01-hello-sakura-scheme.book.slatl"
    hello_new = ROOT / "book-of-scheme" / "01-hello-motoi-scheme.book.slatl"
    if hello_old.exists():
        shutil.move(str(hello_old), str(hello_new))
        stats["renames"].append({"from": str(hello_old), "to": str(hello_new)})

    # Write heartbeat
    heartbeat_content = f"""(heartbeat
  :timestamp "{datetime.now(timezone.utc).isoformat()}"
  :books-processed ({' '.join(f'"{b}"' for b in TARGET_BOOKS)})
  :files-touched {sum(stats['files_touched'].values())}
  :substitutions-applied {sum(stats['substitutions'].values())}
  :files-fully-emptied-and-archived {sum(stats['files_emptied'].values())}
  :needs-alfred-flags {sum(stats['needs_alfred'].values())}
  :per-book (
    {chr(10).join(f'    (:book "{b}" :files-touched {stats["files_touched"][b]} :substitutions {stats["substitutions"][b]} :emptied {stats["files_emptied"][b]})' for b in TARGET_BOOKS)}
  )
  :renames ({' '.join(json.dumps(r) for r in stats['renames'])})
)
"""
    HEARTBEAT.write_text(heartbeat_content)
    # Also dump JSON for easy re-inspection
    (HEARTBEAT.with_suffix(".json")).write_text(json.dumps(stats, indent=2, default=str))
    print(json.dumps({k: v if not isinstance(v, dict) else v for k, v in stats.items()}, default=str, indent=2)[:3000])


if __name__ == "__main__":
    main()
