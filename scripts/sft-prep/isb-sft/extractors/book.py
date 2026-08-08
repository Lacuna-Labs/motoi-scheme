"""Book substrate extractor — 728 chapter .book.slatl files across ~35 books.

Each chapter has a big `:prose` field containing Markdown with prose + fenced
code blocks + section headings. We extract:

  - CODE BLOCKS: (```scheme ... ```) → completion, explain, run-through
  - SECTION HEADINGS (##): concept-explain pairs
  - TITLE-level: "what is chapter N about" pairs
  - BOOK-TYPE routing: each book has :book-type in its README (learning /
    application / composition / introspection / prose / challenge), which
    shapes the pair mix

Emission budget: ~10-14 pairs per chapter (~7k-10k pairs from 728 chapters).

Philosopher-shape overlay:
  Wittgenstein-late-aspect: prose-explain, section-summary
  Wittgenstein-early:       code-completion, code-run-through
  Peirce-abduction:         "why would you write it this way?" section
  Popper-evidence:          runnable-code invariant
  Aristotle-syllogism:      chapter-outline (structural)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sexpr_reader import iter_top_level_forms, read_field

MOTOI_ROOT = Path("/Users/alfred/code/motoi-scheme")
BOOKS_ROOT = MOTOI_ROOT / "scheme-books"

CODE_FENCE_RE = re.compile(r"```(?:scheme|lisp|slat|)\s*\n(.+?)\n```", re.DOTALL)
HEADING_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)
SECTION_SPLIT_RE = re.compile(r"^##\s+.+$", re.MULTILINE)


def read_book_types() -> dict[str, str]:
    """Walk book README.slat files and extract :book-type for each book."""
    out = {}
    for readme in BOOKS_ROOT.glob("book-of-*/README.slat"):
        book_dir = readme.parent.name
        try:
            for raw in iter_top_level_forms(readme, prefix="(readme"):
                bt = read_field(raw, "book-type")
                if bt:
                    out[book_dir] = bt
                    break
        except Exception:
            continue
    return out


QUARANTINE_PATH = MOTOI_ROOT / "scratch" / "cpt-quarantine-blocks.json"


def _load_quarantine() -> dict[str, set[str]]:
    """Blocks the book gate still calls a mismatch, keyed by chapter.

    Code blocks are lifted VERBATIM, `;; =>` claims and all, so emitting a block
    whose claim the interpreter contradicts would train the model on a false
    assertion. Rebuild with scratch/build_cpt_quarantine.py; an absent file
    means no gate has run, which is itself worth knowing.
    """
    import json
    if not QUARANTINE_PATH.exists():
        print(f"  WARNING: no {QUARANTINE_PATH.name} — emitting every book "
              f"block unchecked", file=sys.stderr)
        return {}
    raw = json.loads(QUARANTINE_PATH.read_text())
    return {k: set(v) for k, v in raw.items()}


_QUARANTINE = _load_quarantine()
_QUARANTINE_HITS = [0]


def _norm_block(code: str) -> str:
    return re.sub(r"\s+", " ", (code or "").strip())


def extract_code_blocks(prose: str, rel: str | None = None) -> list[str]:
    """Fenced blocks, minus any the gate judged to carry a false claim.

    The gate reports the individual FORM whose `;; =>` was wrong, so a block is
    dropped when it CONTAINS one. That over-quarantines a block that merely
    repeats the same call correctly elsewhere — deliberately. Losing a good
    block costs a little volume; emitting a bad one teaches a false answer.
    """
    blocks = [m.group(1).strip() for m in CODE_FENCE_RE.finditer(prose)]
    banned = _QUARANTINE.get(rel or "", ())
    if not banned:
        return blocks
    kept = []
    for b in blocks:
        nb = _norm_block(b)
        if any(f in nb for f in banned):
            _QUARANTINE_HITS[0] += 1
            continue
        kept.append(b)
    return kept


def extract_sections(prose: str) -> list[tuple[str, str]]:
    """Return (heading, body-text-only) pairs, code fences stripped from body."""
    headings = HEADING_RE.findall(prose)
    parts = SECTION_SPLIT_RE.split(prose)
    if len(parts) <= 1:
        return []
    out = []
    for h, body in zip(headings, parts[1:]):
        stripped = CODE_FENCE_RE.sub("", body).strip()
        if len(stripped) > 40:
            out.append((h.strip(), stripped[:800]))
    return out


def iter_all_chapters() -> Iterator[dict]:
    book_types = read_book_types()
    for chapter_path in sorted(BOOKS_ROOT.glob("book-of-*/*.book.slatl")):
        book_dir = chapter_path.parent.name
        book_type = book_types.get(book_dir, "learning")
        try:
            forms = list(iter_top_level_forms(chapter_path, prefix="(chapter"))
        except Exception:
            continue
        for raw in forms:
            prose = read_field(raw, "prose") or ""
            if not prose:
                continue
            yield {
                "path": str(chapter_path),
                "book_dir": book_dir,
                "book_type": book_type,
                "book_title": read_field(raw, "book") or book_dir.replace("-", " ").title(),
                "chapter_number": read_field(raw, "chapter-number") or "",
                "title": read_field(raw, "title") or "",
                "voice": read_field(raw, "voice") or "motoi-copilot",
                "prose": prose,
                "code_blocks": extract_code_blocks(
                    prose, str(chapter_path.relative_to(BOOKS_ROOT))),
                "sections": extract_sections(prose),
            }


def _pair(user: str, motoi: str, ch: dict, bloom: str, phil: str, shape: str) -> dict:
    chapter_slug = Path(ch["path"]).stem
    return {
        "user": user,
        "motoi": motoi,
        "tags": {
            "bloom": bloom,
            "philosopher": phil,
            "shape": shape,
            "substrate": "book",
            "concept": f"{ch['book_dir']}/{chapter_slug}",
            "book_type": ch["book_type"],
            "book": ch["book_title"],
            "chapter": str(ch["chapter_number"] or chapter_slug),
        },
    }


def emit_pairs_for_chapter(ch: dict) -> Iterator[dict]:
    title = ch["title"]
    book_title = ch["book_title"]
    book_type = ch["book_type"]
    prose = ch["prose"]

    if title:
        summary = prose.split("\n\n", 1)[0].strip()
        if len(summary) > 60:
            summary = summary[:600]
        yield _pair(
            f"What does chapter {ch['chapter_number']} of {book_title} teach?",
            f"**{title}** — {summary}",
            ch, "understand", "wittgenstein-late-aspect", "chapter-summary",
        )

    for i, (heading, body) in enumerate(ch["sections"][:5]):
        yield _pair(
            f"In {book_title}, ch {ch['chapter_number']}: explain the section on '{heading}'.",
            body,
            ch, "understand", "wittgenstein-late-aspect", "section-explain",
        )

    code_blocks = ch["code_blocks"]
    if book_type == "learning":
        for i, code in enumerate(code_blocks[:4]):
            if len(code) < 20 or len(code) > 800:
                continue
            lines = code.split("\n")
            if len(lines) < 2:
                yield _pair(
                    f"Give me a small Motoi Scheme example from {book_title} ch {ch['chapter_number']}.",
                    f"```scheme\n{code}\n```",
                    ch, "remember", "wittgenstein-early", "code-example",
                )
                continue
            cutoff = max(1, len(lines) // 2)
            prefix = "\n".join(lines[:cutoff])
            yield _pair(
                f"Complete this Motoi Scheme from {book_title}:\n\n```scheme\n{prefix}\n```",
                f"```scheme\n{code}\n```",
                ch, "apply", "wittgenstein-early", "code-completion",
            )
            yield _pair(
                f"What does this Motoi Scheme do?\n\n```scheme\n{code}\n```",
                (
                    f"From {book_title} ch {ch['chapter_number']}: {title}. "
                    f"Read line by line — this is a {book_type} pattern."
                ),
                ch, "understand", "wittgenstein-late-aspect", "code-explain",
            )
    elif book_type == "application":
        for code in code_blocks[:3]:
            if 30 <= len(code) <= 800:
                yield _pair(
                    f"Show me how to apply a {book_title} pattern in Motoi.",
                    f"From ch {ch['chapter_number']} ({title}):\n\n```scheme\n{code}\n```",
                    ch, "apply", "wittgenstein-early", "application-pattern",
                )
    elif book_type == "composition":
        for code in code_blocks[:3]:
            if 30 <= len(code) <= 800:
                yield _pair(
                    f"Compose this {book_title} pattern — what does it emit?",
                    f"```scheme\n{code}\n```\n\n"
                    f"That's the composition target for ch {ch['chapter_number']} — {title}.",
                    ch, "create", "wittgenstein-early", "composition-emit",
                )
    elif book_type == "introspection":
        yield _pair(
            f"What does {book_title} ch {ch['chapter_number']} say about Motoi itself?",
            f"{title}\n\n{prose[:800]}",
            ch, "understand", "wittgenstein-late-aspect", "introspection-passage",
        )
    elif book_type == "prose":
        yield _pair(
            f"Read me the ch {ch['chapter_number']} passage from {book_title}.",
            prose[:1500],
            ch, "understand", "wittgenstein-late-aspect", "prose-passage",
        )
    elif book_type == "challenge":
        for code in code_blocks[:3]:
            if 30 <= len(code) <= 1000:
                yield _pair(
                    f"Challenge from {book_title} ch {ch['chapter_number']}: {title}. "
                    "What's a Motoi solution?",
                    f"```scheme\n{code}\n```",
                    ch, "create", "wittgenstein-early", "challenge-solution",
                )

    for code in code_blocks[:2]:
        if 30 <= len(code) <= 500:
            yield _pair(
                f"Is this a valid Motoi Scheme form?\n\n```scheme\n{code}\n```",
                f"Yes — this comes from {book_title} ch {ch['chapter_number']} "
                f"({title}). It runs against the current Motoi runtime.",
                ch, "evaluate", "popper-evidence", "runnable-affirmation",
            )


if __name__ == "__main__":
    from collections import Counter
    total = 0
    per_book_type = Counter()
    per_bloom = Counter()
    per_book = Counter()
    ch_count = 0
    for ch in iter_all_chapters():
        ch_count += 1
        per_book_type[ch["book_type"]] += 1
        per_book[ch["book_dir"]] += 1
        for p in emit_pairs_for_chapter(ch):
            total += 1
            per_bloom[p["tags"]["bloom"]] += 1
    print(f"chapters parsed: {ch_count}")
    print(f"total pairs:     {total}")
    print(f"mean per ch:     {total/ch_count if ch_count else 0:.1f}")
    print("\nChapters per book-type:")
    for bt, c in per_book_type.most_common():
        print(f"  {bt:15} {c:>4}")
    print("\nBloom distribution:")
    for b, c in per_bloom.most_common():
        pct = 100.0 * c / total if total else 0.0
        print(f"  {b:14} {c:>6}  ({pct:.1f}%)")
    print(f"\nTotal books: {len(per_book)}")
