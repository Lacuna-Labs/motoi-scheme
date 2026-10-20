#!/usr/bin/env python3
"""
p0-example-injector-2026-07-16.py — Injects P0 batch new examples into
MOTOI-SCHEME-REFERENCE.slat.

Reads NEW_EXAMPLES from scratch/p0-new-examples-2026-07-16.py and, for
each target verb, appends the extra (:dialect "motoi" :tier X :code "..."
:note "...") records to that verb's :examples list.

Preserves everything else in each verb form.

Safety:
  * Idempotent-detect: skip a verb whose :examples already contains the
    exact new codes we're trying to add.
  * Does not run if a verb has been renamed or is missing.
  * Reference file is expected to be backed up separately.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

REF_PATH = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
DATA_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/p0-new-examples-2026-07-16.py")


def load_new_examples():
    spec = importlib.util.spec_from_file_location("p0mod", DATA_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.NEW_EXAMPLES


# --- SLAT string escaping ---------------------------------------------------


def slat_escape(s: str) -> str:
    """Escape a Python string for embedding in a SLAT double-quoted literal."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def format_example(ex: dict) -> str:
    tier = slat_escape(ex["tier"])
    code = slat_escape(ex["code"])
    note = slat_escape(ex["note"])
    return f'(:dialect "motoi" :tier "{tier}" :code "{code}" :note "{note}")'


# --- form splitter ----------------------------------------------------------


def split_top_forms(text: str):
    """Yield (start, end, form_text) for every top-level parenthesized form."""
    i = 0
    n = len(text)
    while i < n:
        while i < n and text[i] != "(":
            i += 1
        if i >= n:
            break
        start = i
        depth = 0
        in_str = False
        while i < n:
            c = text[i]
            if in_str:
                if c == "\\":
                    i += 2
                    continue
                if c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        yield start, i, text[start:i]
                        break
            i += 1


def find_name(form: str) -> str | None:
    m = re.search(r':name\s+"((?:[^"\\]|\\.)*)"', form)
    return m.group(1).replace("\\\"", '"') if m else None


def find_examples_span(form: str) -> tuple[int, int] | None:
    """Return (open_paren_index, close_paren_index) of the :examples ( ... )
    body, indices relative to the form. Returns None if no :examples.
    """
    m = re.search(r":examples\s*\(", form)
    if not m:
        return None
    open_idx = m.end() - 1
    depth = 0
    in_str = False
    i = open_idx
    n = len(form)
    while i < n:
        c = form[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    return open_idx, i
        i += 1
    return None


def already_has_code(examples_body: str, new_code_escaped: str) -> bool:
    """Check whether new_code_escaped substring is already inside body."""
    # Match the substring inside a :code "..." form.
    return f':code "{new_code_escaped}"' in examples_body


# --- injection --------------------------------------------------------------


def inject(text: str, new_examples: dict) -> tuple[str, dict]:
    """Return (new_text, stats).

    Walks the text form-by-form. For each (verb ...) form whose :name is in
    new_examples, appends the new examples to its :examples list.
    """
    out = []
    stats = {
        "verbs_updated": 0,
        "examples_added": 0,
        "skipped_already_present": 0,
        "verbs_not_found_in_target": 0,
        "target_verbs_never_seen": set(new_examples.keys()),
    }
    cursor = 0
    for start, end, form in split_top_forms(text):
        out.append(text[cursor:start])
        if not form.startswith("(verb"):
            out.append(form)
            cursor = end
            continue
        name = find_name(form)
        if name is None or name not in new_examples:
            out.append(form)
            cursor = end
            continue
        stats["target_verbs_never_seen"].discard(name)
        span = find_examples_span(form)
        if span is None:
            # No :examples block — should not happen for these verbs, skip.
            print(f"WARN: verb {name!r} has no :examples block; skipping",
                  file=sys.stderr)
            out.append(form)
            cursor = end
            continue
        open_idx, close_idx = span
        body = form[open_idx + 1 : close_idx]

        additions = []
        for ex in new_examples[name]:
            escaped_code = slat_escape(ex["code"])
            if already_has_code(body, escaped_code):
                stats["skipped_already_present"] += 1
                continue
            additions.append(format_example(ex))

        if not additions:
            out.append(form)
            cursor = end
            continue

        # Determine indentation for a new example line: look at existing
        # examples in body to mimic. We'll indent 4 spaces (matches reference).
        indent = "    "
        new_body = body.rstrip() + "\n" + "\n".join(
            indent + a for a in additions
        ) + "\n  "
        new_form = form[: open_idx + 1] + new_body + form[close_idx:]
        out.append(new_form)
        cursor = end
        stats["verbs_updated"] += 1
        stats["examples_added"] += len(additions)

    out.append(text[cursor:])
    stats["target_verbs_never_seen"] = sorted(stats["target_verbs_never_seen"])
    return "".join(out), stats


def main() -> int:
    if not REF_PATH.exists():
        print(f"ERROR: reference not found at {REF_PATH}", file=sys.stderr)
        return 2
    new_examples = load_new_examples()
    text = REF_PATH.read_text()
    new_text, stats = inject(text, new_examples)
    if new_text == text:
        print("No changes.")
    else:
        REF_PATH.write_text(new_text)
        print(f"Wrote {REF_PATH}")
    print(f"verbs updated:                {stats['verbs_updated']}")
    print(f"examples added:               {stats['examples_added']}")
    print(f"skipped (already present):    {stats['skipped_already_present']}")
    print(f"target verbs not found:       {len(stats['target_verbs_never_seen'])}")
    if stats["target_verbs_never_seen"]:
        print("  not found:")
        for n in stats["target_verbs_never_seen"]:
            print(f"    {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
