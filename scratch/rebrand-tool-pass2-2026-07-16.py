#!/usr/bin/env python3
"""
Motoi Reference Rebrand — Pass 2 (2026-07-16).

Pass 1 handled :example fields. This pass handles:
  1. Residual "Sakura" prose in :explanation / :caveats / :drawbacks
     / :learn / :usecases / :note fields where "Sakura" is the language.
  2. Core-form :doc-body markdown blocks that contain Sakura-flavored
     code (paint-* core-forms with card-emit / ctx-get / sakura-pink).
     For those, we FLAG them as stuck in a second stuck report; we do
     NOT rewrite doc-body markdown examples (structured differently
     from :examples fields).
  3. Isolated "Sakura" -> "Motoi" language references in comments and
     other places (careful not to touch Sakura-as-character).
"""

import re
import sys
from pathlib import Path

REF_PATH = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
STUCK_DOCBODY_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/_stuck-docbody-examples-2026-07-16.slat")

# More conservative prose subs. These target LANGUAGE references only.
# We deliberately preserve "sakura-training" audience label and any
# Sakura character references (though almost none exist here).

PROSE_SUBS = [
    # Language references
    (re.compile(r'\boutside Sakura\b'), 'outside Motoi'),
    (re.compile(r'\bIn Sakura,'), 'In Motoi,'),
    (re.compile(r'\bIn Sakura\b'), 'In Motoi'),
    (re.compile(r'\bSakura instance\b'), 'Motoi instance'),
    (re.compile(r'\bSakura runtime\b'), 'Motoi runtime'),
    (re.compile(r'\bSakura kernel\b'), 'Motoi kernel'),
    (re.compile(r'\bSakura convention\b'), 'Motoi convention'),
    (re.compile(r'\bSakura tasks\b'), 'Motoi tasks'),
    (re.compile(r'\bSakura task\b'), 'Motoi task'),
    (re.compile(r'\bSakura integers\b'), 'Motoi integers'),
    (re.compile(r'\bSakura domain\b'), 'Motoi domain'),
    (re.compile(r'\bSakura beat\b'), 'Motoi beat'),
    (re.compile(r'\bSakura clamps\b'), 'Motoi clamps'),
    (re.compile(r'\bSakura automation\b'), 'Motoi automation'),
    (re.compile(r'\bSakura surface\b'), 'Motoi surface'),
    # "Sakura, the message bus" — sentence-start references
    (re.compile(r'In Sakura, the message bus'), 'In Motoi, the message bus'),
    # Line 15221: "A card is a UI container (window-like) on the Sakura surface."
    # This is talking about system/cards (Sakura verb we might still have)
    # — replace only if verb is in Motoi.
]


def sweep_prose(text):
    total = 0
    for rx, repl in PROSE_SUBS:
        new_text, n = rx.subn(repl, text)
        if n > 0:
            print(f"  {rx.pattern!r} -> {repl!r}: {n} replacement(s)", file=sys.stderr)
            total += n
            text = new_text
    return text, total


# --------------------------------------------------------------------------
# Doc-body scan for core-form paint-* records
# --------------------------------------------------------------------------
# These records have :doc-body "... markdown with code fences ..." and the
# code fences reference Sakura idioms (card-emit, ctx-get, ctx-result,
# card-list, sakura-pink, sakura-mouth, act, cortex/*).
# We do NOT rewrite these — flag only.

SAKURA_IDIOM_RE = re.compile(
    r'\b(card-emit|ctx-get|ctx-set|ctx-result|card-list|card-do|card-get|card-set!|'
    r"sakura-pink|sakura-mouth|sakura-magic|sakura-dark|"
    r'act|next|escalate|register-tick|paint-grid|paint-cell)\b'
)


def scan_docbody(text):
    """Return list of (name, line, idioms_found) for core-forms whose
    :doc-body contains Sakura idioms."""
    results = []
    # Iterate core-form records
    pattern = re.compile(r'\(core-form\b')
    for m in pattern.finditer(text):
        start = m.start()
        # Find matching close
        depth = 0
        in_str = False
        esc = False
        i = start
        while i < len(text):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            i += 1
        else:
            break
        rec = text[start:end]
        name_m = re.search(r':name\s+"([^"]+)"', rec)
        name = name_m.group(1) if name_m else '?'
        # Extract doc-body
        db_m = re.search(r':doc-body\s+"((?:[^"\\]|\\.)*)"', rec)
        if not db_m:
            continue
        doc = db_m.group(1)
        # Un-escape
        try:
            doc_unesc = doc.encode('utf-8').decode('unicode_escape', errors='replace')
        except Exception:
            doc_unesc = doc
        idioms = set(SAKURA_IDIOM_RE.findall(doc_unesc))
        if idioms:
            line = text[:start].count('\n') + 1
            results.append((name, line, sorted(idioms)))
    return results


def main():
    text = REF_PATH.read_text()
    print("=== Pass 2 prose sweep ===", file=sys.stderr)
    new_text, prose_count = sweep_prose(text)
    print(f"Total prose replacements: {prose_count}", file=sys.stderr)

    # Doc-body scan
    print("\n=== Pass 2 doc-body scan (core-form paint-*) ===", file=sys.stderr)
    docbody_stuck = scan_docbody(new_text)
    print(f"Core-forms with Sakura idioms in :doc-body: {len(docbody_stuck)}", file=sys.stderr)
    for name, line, idioms in docbody_stuck:
        print(f"  {name} (line {line}): {', '.join(idioms)}", file=sys.stderr)

    # Save doc-body stuck report
    lines_out = [
        '; Stuck core-form doc-body examples.',
        '; These core-forms are Motoi verbs but their :doc-body markdown',
        '; contains examples that lean on Sakura idioms (card-emit, ctx-get,',
        '; sakura-pink, etc.). We flag rather than rewrite because :doc-body',
        '; is markdown, not structured :examples, and per anti-fabrication',
        '; doctrine we do not invent replacements.',
        '',
        '(stuck-docbody-examples',
        f'  :count {len(docbody_stuck)}',
        f'  :date "2026-07-16"',
        f'  :source "rebrand-tool-pass2-2026-07-16.py"',
        f'  :doctrine "anti-fabrication — flag, do not invent"',
        f'  :audience ("engineer" "alfred-review")',
        f'  :dialect "motoi"',
        f'  :training-eligible #f',
        f'  :confidentiality "public"',
        f'  :note "Rewriting these examples requires deciding whether the paint-* core-forms should show Sakura-flavored examples or Motoi-only examples. Alfred call."',
        f')',
        '',
    ]
    for name, line, idioms in docbody_stuck:
        idioms_str = ' '.join(f'"{v}"' for v in idioms)
        lines_out.append(
            f'(stuck-docbody :name "{name}" :line {line} :idioms ({idioms_str}))'
        )
    STUCK_DOCBODY_PATH.write_text('\n'.join(lines_out) + '\n')

    # Write reference
    REF_PATH.write_text(new_text)
    print(f"\nWrote {REF_PATH}", file=sys.stderr)
    print(f"Wrote {STUCK_DOCBODY_PATH}", file=sys.stderr)


if __name__ == '__main__':
    main()
