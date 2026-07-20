#!/usr/bin/env python3
"""
reference-example-extractor.py — Blocker B4 (The Engineer, 2026-07-16).

Walks /Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat
(962 verb records) and emits SFT JSONL pairs from every :examples entry.

Design source:
  /Users/alfred/code/lacuna-labs/design-docs/architect-scheme-doc-edit-plan-2026-07-16.slat
  — B4: extractor-v2 for reference examples.

Extraction shape
----------------

Each (verb :name ... :examples ((:dialect "motoi" :tier X :code "..." :note "..."))) yields
ONE JSONL pair per :examples entry:

  {"messages": [
     {"role": "user",      "content": <templated prompt referencing verb + tier>},
     {"role": "assistant", "content": <fenced motoi code block + brief note>}
   ],
   "family": "code",
   "source": "reference-examples",
   "verb": "<verb-name>",
   "library": "<library>",
   "tier": "<tier>",
   "example_index": <int>,
   "provenance": "reference-example-extractor-2026-07-16 verb=<name> ex=<i>"}

Skip rules
----------
* :code is empty  -> skip
* :code == "unavailable" (case-insensitive, whole-body) -> skip
* :examples list is empty -> skip verb
* Malformed record (no :name, no :examples) -> log to stderr, skip

Reference format observed (empirically scanned 2026-07-16):
* 962 verb records, all with :examples.
* Every :examples entry has :dialect + :tier + :code + :note fields.
* Tiers observed: novice, intermediate, expert (all verbs); apprentice,
  master (28 verbs each).
* NO :result field. Spec's "skip on :result unavailable" is interpreted
  as "skip on code == unavailable" since no :result exists.

Doctrine
--------
* HARD RULE: no fabrication. Extract only what's actually in the reference.
* Deterministic ordering: verbs sorted by name; examples in source order.
* Rotate 3-4 user prompt templates (to avoid same-shape-twice per
  MEMORY.md sparse-text-abduction doctrine).

Outputs
-------
* JSONL: /Users/alfred/code/motoi-scheme/training-data/reference-examples-2026-07-16.jsonl
* SLAT coverage report: /Users/alfred/code/motoi-scheme/scratch/reference-extractor-coverage-2026-07-16.slat
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

REF_PATH = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
OUT_JSONL = Path(
    "/Users/alfred/code/motoi-scheme/training-data/reference-examples-2026-07-16.jsonl"
)
OUT_COVERAGE = Path(
    "/Users/alfred/code/motoi-scheme/scratch/reference-extractor-coverage-2026-07-16.slat"
)

GENERATED_AT = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
GENERATOR = "reference-example-extractor.py (Blocker B4, The Engineer)"


# ---------------------------------------------------------------------------
# SLAT top-level form splitter (multi-line aware).
# Mirrors scratch/reference-audit-tool-2026-07-16.py split_forms().
# ---------------------------------------------------------------------------


def split_forms(text: str):
    """Yield each top-level parenthesized form in text as (start, end, str)."""
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


def find_string_field(form: str, field: str) -> str | None:
    """Extract the string value of a top-level `:field "..."` from a form.

    Only matches the FIRST occurrence at the top level (i.e. captures the
    field of the outer verb form, not fields inside nested example forms).
    We use a simple regex — the verb-form fields we care about (:name,
    :library, :summary, :explanation) don't collide with nested :note or
    :code because they carry distinct field names.
    """
    pattern = rf':{re.escape(field)}\s+"((?:[^"\\]|\\.)*)"'
    m = re.search(pattern, form)
    return _unescape(m.group(1)) if m else None


def _unescape(s: str) -> str:
    """Undo SLAT string escapes: \\n, \\t, \\", \\\\."""
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            nxt = s[i + 1]
            mapped = {
                "n": "\n",
                "t": "\t",
                "r": "\r",
                '"': '"',
                "\\": "\\",
            }.get(nxt, nxt)
            out.append(mapped)
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


# ---------------------------------------------------------------------------
# Examples-list parser.
# The :examples list looks like:
#   :examples (
#     (:dialect "motoi" :tier "novice" :code "..." :note "...")
#     (:dialect "motoi" :tier "intermediate" :code "..." :note "...")
#     ...
#   )
#
# We locate `:examples` inside the verb form, then split the paren-
# balanced body into example-forms and parse each.
# ---------------------------------------------------------------------------


def extract_examples_body(verb_form: str) -> str | None:
    """Return the inside of the :examples ( ... ) list, or None if missing."""
    m = re.search(r":examples\s*\(", verb_form)
    if not m:
        return None
    open_idx = m.end() - 1  # position of the '('
    depth = 0
    in_str = False
    i = open_idx
    n = len(verb_form)
    while i < n:
        c = verb_form[i]
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
                    return verb_form[open_idx + 1 : i]
        i += 1
    return None


def iter_example_forms(examples_body: str):
    """Yield each `(:dialect ...)` example form from an examples-list body."""
    yield from (form for _, _, form in split_forms(examples_body))


def parse_example(form: str) -> dict | None:
    """Extract {dialect, tier, code, note} from an example form.

    Returns None on malformed input.
    """
    # The example fields are shallow — regex per keyword suffices.
    dialect = _kw_string(form, "dialect")
    tier = _kw_string(form, "tier")
    code = _kw_string(form, "code")
    note = _kw_string(form, "note")
    if code is None:
        return None
    return {
        "dialect": dialect,
        "tier": tier,
        "code": code,
        "note": note or "",
    }


def _kw_string(form: str, key: str) -> str | None:
    pattern = rf':{re.escape(key)}\s+"((?:[^"\\]|\\.)*)"'
    m = re.search(pattern, form)
    return _unescape(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# Prompt templating.
# Rotate templates to avoid same-shape-twice (MEMORY.md sparse-text-abduction).
# Deterministic rotation keyed on (verb, example_index).
# ---------------------------------------------------------------------------


TIER_ADJECTIVE = {
    "novice": "novice",
    "apprentice": "apprentice",
    "intermediate": "intermediate",
    "expert": "expert",
    "master": "master",
}

TIERED_TEMPLATES = [
    "Show me `{verb}` at the {tier} level.",
    "Give me {an} {tier}-level example of `{verb}` in Motoi.",
    "How would {an} {tier} use `{verb}`? Show code.",
    "Write {an} {tier} Motoi example that uses `{verb}`.",
]

UNTIERED_TEMPLATES = [
    "Show me an example of `{verb}` in Motoi.",
    "Give me an example of `{verb}`.",
    "How do I use `{verb}` in Motoi? Show me code.",
    "Write a Motoi example that uses `{verb}`.",
]


def _a_or_an(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def build_user_prompt(verb: str, tier: str | None, example_index: int) -> str:
    if tier and tier in TIER_ADJECTIVE:
        templates = TIERED_TEMPLATES
        adj = TIER_ADJECTIVE[tier]
        return templates[example_index % len(templates)].format(
            verb=verb, tier=adj, an=_a_or_an(adj)
        )
    templates = UNTIERED_TEMPLATES
    return templates[example_index % len(templates)].format(verb=verb)


def build_assistant_reply(code: str, note: str, summary: str | None) -> str:
    """Compose a fenced ```motoi``` block followed by a brief explanation.

    Prefers the example's :note; falls back to the verb :summary if the
    :note is empty. Never fabricates — only stitches strings that exist.
    """
    fenced = f"```motoi\n{code.strip()}\n```"
    explanation = (note or "").strip() or (summary or "").strip()
    if explanation:
        return f"{fenced}\n\n{explanation}"
    return fenced


# ---------------------------------------------------------------------------
# Main extraction.
# ---------------------------------------------------------------------------


def main() -> int:
    if not REF_PATH.exists():
        print(f"ERROR: reference not found at {REF_PATH}", file=sys.stderr)
        return 2

    text = REF_PATH.read_text()

    verb_records: list[dict] = []
    malformed_forms = 0
    for _, _, form in split_forms(text):
        if not form.startswith("(verb"):
            continue
        name = find_string_field(form, "name")
        if not name:
            malformed_forms += 1
            print(
                f"WARN: skipping verb form with no :name (form len={len(form)})",
                file=sys.stderr,
            )
            continue
        library = find_string_field(form, "library") or ""
        summary = find_string_field(form, "summary")
        examples_body = extract_examples_body(form)
        if examples_body is None:
            malformed_forms += 1
            print(
                f"WARN: verb {name!r} has no :examples block", file=sys.stderr
            )
            continue

        examples: list[dict] = []
        for i, ef in enumerate(iter_example_forms(examples_body)):
            parsed = parse_example(ef)
            if parsed is None:
                print(
                    f"WARN: malformed example #{i} in verb {name!r} — skipping",
                    file=sys.stderr,
                )
                continue
            examples.append(parsed)

        verb_records.append(
            {
                "name": name,
                "library": library,
                "summary": summary,
                "examples": examples,
            }
        )

    # Deterministic order: sort by verb name.
    verb_records.sort(key=lambda r: r["name"])

    pairs: list[dict] = []
    verbs_with_pairs: dict[str, int] = {}  # accumulates across duplicate names
    verbs_zero_examples: list[str] = []
    verbs_all_skipped: list[str] = []
    skipped_empty = 0
    skipped_unavailable = 0
    duplicate_names: dict[str, int] = {}
    seen_names: set[str] = set()

    for rec in verb_records:
        if rec["name"] in seen_names:
            duplicate_names[rec["name"]] = duplicate_names.get(rec["name"], 1) + 1
        seen_names.add(rec["name"])
        emitted = 0
        if not rec["examples"]:
            verbs_zero_examples.append(rec["name"])
            continue
        for i, ex in enumerate(rec["examples"]):
            code = (ex.get("code") or "").strip()
            if not code:
                skipped_empty += 1
                continue
            if code.lower() == "unavailable":
                skipped_unavailable += 1
                continue
            user = build_user_prompt(rec["name"], ex.get("tier"), i)
            assistant = build_assistant_reply(
                code=code, note=ex.get("note", ""), summary=rec.get("summary")
            )
            pair = {
                "messages": [
                    {"role": "user", "content": user},
                    {"role": "assistant", "content": assistant},
                ],
                "family": "code",
                "source": "reference-examples",
                "verb": rec["name"],
                "library": rec["library"],
                "tier": ex.get("tier"),
                "example_index": i,
                "provenance": f"reference-example-extractor-2026-07-16 "
                f"verb={rec['name']} ex={i}",
            }
            pairs.append(pair)
            emitted += 1
        if emitted == 0:
            verbs_all_skipped.append(rec["name"])
        else:
            # accumulate — handles the 13 duplicate verb-name records so
            # per-verb counts reflect all emitted pairs, not just the last
            verbs_with_pairs[rec["name"]] = (
                verbs_with_pairs.get(rec["name"], 0) + emitted
            )

    # ------------------------------------------------------------------ write JSONL
    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    header = {
        "_provenance_header": True,
        "generated_at": GENERATED_AT,
        "generator": GENERATOR,
        "source": str(REF_PATH),
        "verb_records_scanned": len(verb_records),
        "unique_verb_names": len(seen_names),
        "duplicate_verb_names": len(duplicate_names),
        "verbs_with_pairs": len(verbs_with_pairs),
        "verbs_zero_examples": len(verbs_zero_examples),
        "verbs_all_skipped": len(verbs_all_skipped),
        "pair_count": len(pairs),
        "skipped_empty_code": skipped_empty,
        "skipped_unavailable": skipped_unavailable,
        "malformed_forms": malformed_forms,
        "design_doc": (
            "/Users/alfred/code/lacuna-labs/design-docs/"
            "architect-scheme-doc-edit-plan-2026-07-16.slat"
        ),
        "notes": (
            "Blocker B4. Reads MOTOI-SCHEME-REFERENCE.slat verb records "
            "and emits (question, code + brief-explanation) JSONL pairs "
            "per :examples entry. Deterministic ordering (verb name)."
        ),
    }

    with OUT_JSONL.open("w") as fh:
        fh.write(json.dumps(header) + "\n")
        for p in pairs:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")

    # ------------------------------------------------------------------ coverage SLAT
    write_coverage(
        verbs_with_pairs=verbs_with_pairs,
        verbs_zero_examples=verbs_zero_examples,
        verbs_all_skipped=verbs_all_skipped,
        duplicate_names=duplicate_names,
        pair_count=len(pairs),
        verb_records=len(verb_records),
        unique_verbs=len(seen_names),
        skipped_empty=skipped_empty,
        skipped_unavailable=skipped_unavailable,
        malformed_forms=malformed_forms,
    )

    # ------------------------------------------------------------------ console
    print(f"scanned verb records:         {len(verb_records)}")
    print(f"unique verb names:            {len(seen_names)}")
    print(f"duplicate verb names:         {len(duplicate_names)}")
    print(f"verbs with >=1 emitted pair:  {len(verbs_with_pairs)}")
    print(f"verbs with 0 examples in ref: {len(verbs_zero_examples)}")
    print(f"verbs all-skipped:            {len(verbs_all_skipped)}")
    print(f"skipped (empty code):         {skipped_empty}")
    print(f"skipped (unavailable):        {skipped_unavailable}")
    print(f"malformed verb forms:         {malformed_forms}")
    print(f"emitted pairs:                {len(pairs)}")
    print(f"JSONL:                        {OUT_JSONL}")
    print(f"coverage:                     {OUT_COVERAGE}")
    return 0


def write_coverage(
    *,
    verbs_with_pairs: dict[str, int],
    verbs_zero_examples: list[str],
    verbs_all_skipped: list[str],
    duplicate_names: dict[str, int],
    pair_count: int,
    verb_records: int,
    unique_verbs: int,
    skipped_empty: int,
    skipped_unavailable: int,
    malformed_forms: int,
) -> None:
    """Emit a SLAT coverage report to OUT_COVERAGE.

    Format: one top-level (coverage-report ...) record + one
    (verb-pair-count :verb "..." :pairs N) record per verb, sorted by
    verb name. Uses SLAT-standard training-eligibility tagging per
    MEMORY.md doctrine.
    """
    OUT_COVERAGE.parent.mkdir(parents=True, exist_ok=True)

    total_pairs_per_verb = sorted(verbs_with_pairs.items())
    if verbs_with_pairs:
        counts = sorted(verbs_with_pairs.values())
        pmin = counts[0]
        pmax = counts[-1]
        pmean = sum(counts) / len(counts)
        pmed = counts[len(counts) // 2]
    else:
        pmin = pmax = pmed = 0
        pmean = 0.0

    def _slat_str(s: str) -> str:
        return s.replace("\\", "\\\\").replace('"', '\\"')

    lines: list[str] = []
    lines.append(";;; reference-extractor-coverage-2026-07-16.slat")
    lines.append(";;;")
    lines.append(
        ";;; Coverage of Blocker B4 reference-example-extractor.py against"
    )
    lines.append(";;; /Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
    lines.append(";;;")
    lines.append(";;; :audience         :engineer")
    lines.append(";;; :dialect          \"motoi\"")
    lines.append(";;; :confidentiality  :internal")
    lines.append(";;; :training-eligible #f  ; coverage report, not training data")
    lines.append(";;; :doc              \"reference-extractor-coverage-2026-07-16\"")
    lines.append(
        ";;; :provenance       \"reference-example-extractor.py · The Engineer · 2026-07-16 (Blocker B4)\""
    )
    lines.append(";;; :owner            \"The Engineer\"")
    lines.append(";;; :date             \"2026-07-16\"")
    lines.append(
        ";;; :tags             (:motoi :extractor :coverage :reference :blocker-b4 :wave-3)"
    )
    lines.append("")
    lines.append("(coverage-report")
    lines.append(f'  :generated-at "{GENERATED_AT}"')
    lines.append(f'  :generator "{_slat_str(GENERATOR)}"')
    lines.append(f'  :source "{REF_PATH}"')
    lines.append(f'  :jsonl-output "{OUT_JSONL}"')
    lines.append(f"  :verb-records-scanned {verb_records}")
    lines.append(f"  :unique-verb-names {unique_verbs}")
    lines.append(f"  :duplicate-verb-names {len(duplicate_names)}")
    lines.append(f"  :verbs-with-pairs {len(verbs_with_pairs)}")
    lines.append(f"  :verbs-with-zero-examples {len(verbs_zero_examples)}")
    lines.append(f"  :verbs-all-skipped {len(verbs_all_skipped)}")
    lines.append(f"  :pair-count {pair_count}")
    lines.append(f"  :skipped-empty-code {skipped_empty}")
    lines.append(f"  :skipped-unavailable {skipped_unavailable}")
    lines.append(f"  :malformed-forms {malformed_forms}")
    lines.append(f"  :pairs-per-verb-min {pmin}")
    lines.append(f"  :pairs-per-verb-max {pmax}")
    lines.append(f"  :pairs-per-verb-median {pmed}")
    lines.append(f'  :pairs-per-verb-mean "{pmean:.2f}"')
    lines.append(
        '  :notes "One pair per :examples entry. Prompts rotate 4 templates. Deterministic verb-name sort. Duplicate verb-name records are merged in per-verb counts."'
    )
    lines.append(")")
    lines.append("")
    lines.append("; ── per-verb pair counts (sorted by verb name) ──")
    lines.append("")
    for name, count in total_pairs_per_verb:
        lines.append(f'(verb-pair-count :verb "{_slat_str(name)}" :pairs {count})')

    if verbs_zero_examples:
        lines.append("")
        lines.append("; ── verbs with :examples () (empty list) ──")
        lines.append("")
        for name in sorted(verbs_zero_examples):
            lines.append(f'(verb-empty-examples :verb "{_slat_str(name)}")')

    if verbs_all_skipped:
        lines.append("")
        lines.append(
            "; ── verbs where every example was skipped (empty code or 'unavailable') ──"
        )
        lines.append("")
        for name in sorted(verbs_all_skipped):
            lines.append(f'(verb-all-skipped :verb "{_slat_str(name)}")')

    if duplicate_names:
        lines.append("")
        lines.append(
            "; ── duplicate verb-name records in reference (record-count per name) ──"
        )
        lines.append(
            "; NOTE: pair counts above accumulate across all records for a name."
        )
        lines.append("")
        for name, count in sorted(duplicate_names.items()):
            lines.append(
                f'(duplicate-verb :verb "{_slat_str(name)}" :record-count {count})'
            )

    OUT_COVERAGE.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    sys.exit(main())
