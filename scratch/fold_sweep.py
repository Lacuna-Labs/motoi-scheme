#!/usr/bin/env python3
"""
fold_sweep.py — malformed-pair sweep for the Motoi SFT fold. (Priya, ask #1)

REPORTS counts by category. DELETES NOTHING. Doctrine: only-add-never-prune,
so this is a diagnostic gate, not a filter. Exit code is nonzero if any
BLOCKING category (banned tokens, needs-alfred, non-utf8, empty pair) is hit,
so the pipeline can gate on it.

Categories:
  malformed_json      — line did not parse as JSON
  non_utf8            — undecodable / surrogate bytes in a field
  empty_prompt        — normalised prompt is empty/whitespace
  empty_completion    — normalised completion is empty/whitespace
  unbalanced_parens   — a code_block has unbalanced ()/[]
  duplicate_exact     — exact (prompt,completion) seen already (COUNT only; dedup
                        is a SEPARATE decision — see fold-error #dedup below)
  banned_token        — Curator/Sakura/Lacuna/persona/model names leaked
  banned_name         — crew persona name leaked (Alfred Borden exempt)
  needs_alfred        — :status "needs-alfred" placeholder that must not train
  unknown_schema      — record shape not recognised (do NOT coerce/train blind)

Usage:
  python3 scratch/fold_sweep.py [path ...]     # default: all lane files
  python3 scratch/fold_sweep.py --examples 5   # print N offending examples/cat
"""
import argparse
import sys
from collections import defaultdict

import fold_common as fc


def _has_banned(text, tokens):
    low = text.lower()
    hits = []
    for tok in tokens:
        # word-ish boundary
        t = tok.lower()
        idx = low.find(t)
        while idx != -1:
            hits.append(tok)
            break
        idx = -1
    return hits


import re as _re
_WB = {}


def _banned_names(text):
    hits = []
    scrub = text
    for ok in fc.ALLOWED_NAME_PHRASES:
        scrub = scrub.replace(ok, "")
    for name in fc.BANNED_NAMES:
        pat = _WB.get(name)
        if pat is None:
            pat = _WB[name] = _re.compile(r"\b" + _re.escape(name) + r"\b")
        if pat.search(scrub):
            hits.append(name)
    return hits


def sweep(files, n_examples=3):
    counts = defaultdict(int)
    examples = defaultdict(list)
    per_file = defaultdict(lambda: defaultdict(int))
    seen = set()
    total_records = 0

    def note(cat, fname, sample):
        counts[cat] += 1
        per_file[fname][cat] += 1
        if len(examples[cat]) < n_examples:
            examples[cat].append((fname, sample))

    for path in files:
        fname = str(path)
        for lineno, rec in fc.iter_jsonl(path):
            total_records += 1
            prompt, completion, blocks, schema = fc.normalize(rec)

            if schema == "malformed":
                note("malformed_json", fname, f"L{lineno}")
                continue
            if schema == "unknown":
                note("unknown_schema", fname, f"L{lineno} keys={list(rec)[:6]}")
                continue

            joined = f"{prompt}\n{completion}"

            # non-utf8: surrogate escapes present after read
            try:
                joined.encode("utf-8")
            except UnicodeEncodeError:
                note("non_utf8", fname, f"L{lineno}")

            # CPT text streams have no prompt side by design — empty-side is
            # expected, not a defect. Still leak-scan the text below.
            if schema != "cpt":
                if not prompt.strip():
                    note("empty_prompt", fname, f"L{lineno}")
                # The 'silent-if-trouble' safety persona (#105) trains an EMPTY
                # completion on purpose — silence IS the target — so an empty
                # completion there is not a defect.
                if not completion.strip() and not fc.is_intentional_silent(rec):
                    note("empty_completion", fname, f"L{lineno}")

            for b in blocks:
                bal, _ = fc.paren_balanced(b)
                if not bal:
                    note("unbalanced_parens", fname, f"L{lineno}: {b[:60]!r}")
                    break

            key = (prompt.strip(), completion.strip())
            if key in seen and prompt.strip():
                note("duplicate_exact", fname, f"L{lineno}")
            else:
                seen.add(key)

            bt = _has_banned(joined, fc.BANNED_TOKENS)
            if bt:
                note("banned_token", fname, f"L{lineno}: {bt}")
            bn = _banned_names(joined)
            if bn:
                note("banned_name", fname, f"L{lineno}: {bn}")

            if fc.NEEDS_ALFRED_RE.search(joined):
                note("needs_alfred", fname, f"L{lineno}")

    return counts, examples, per_file, total_records


BLOCKING = {"malformed_json", "non_utf8", "empty_prompt", "empty_completion",
            "banned_token", "banned_name", "needs_alfred", "unknown_schema"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--examples", type=int, default=3)
    args = ap.parse_args()

    files = fc.find_lane_files(args.paths or None)
    if not files:
        print("no jsonl files found", file=sys.stderr)
        return 2

    counts, examples, per_file, total = sweep(files, args.examples)

    print(f"# fold_sweep — {len(files)} files, {total} records\n")
    print(f"{'category':<20} {'count':>8}  blocking?")
    print("-" * 44)
    blocked = 0
    for cat in ("malformed_json", "non_utf8", "empty_prompt", "empty_completion",
                "unbalanced_parens", "duplicate_exact", "banned_token",
                "banned_name", "needs_alfred", "unknown_schema"):
        c = counts.get(cat, 0)
        flag = "BLOCK" if (cat in BLOCKING and c) else ""
        if flag:
            blocked += c
        print(f"{cat:<20} {c:>8}  {flag}")

    if args.examples:
        print("\n# example offenders")
        for cat, ex in examples.items():
            if not ex:
                continue
            print(f"\n[{cat}]")
            for fn, s in ex:
                print(f"  {fn.split('/')[-1]}  {s}")

    print(f"\nBLOCKING total: {blocked}")
    return 1 if blocked else 0


if __name__ == "__main__":
    sys.exit(main())
