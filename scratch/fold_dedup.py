#!/usr/bin/env python3
"""
fold_dedup.py — anchor-aware exact-duplicate collapse for the Motoi fold.

WHY THIS EXISTS (read before touching):
  The fold is assembled from 10 lanes that each explode ~12x. At that volume,
  the SAME (prompt, completion) pair is emitted by more than one lane/pass — an
  authored "what's pi -> ..." card is minted in the reference lane AND the
  word-book lane AND a book chapter. Left alone, exact copies (1) inflate the
  self-BLEU phrase-lock metric to 1.000 (a family of identical rows), and (2)
  make a naive train/valid split look like it "leaks" (same prompt on both
  sides). Neither is a teaching signal — it is redundancy. Dedup is the fix.

  This is the SANCTIONED exception to only-add-never-prune (Alfred, 2026-07-30:
  "Both" — dedup + diversify, "we have to do this anyway... it's inevitable for
  the amount we get"). It is a FOLD-ASSEMBLY filter, not a corpus edit: the
  authored lane files are never mutated by default. `dedup_records()` is called
  by the assembly/explosion stage; this CLI is the standalone preview + optional
  materialised archive so the decision is auditable.

ANCHORS ARE KEPT IN FULL (never collapsed) — repetition IS the lesson for:
  * refusal / honest-null anchors  (`_refusal_src` present)     — reinforce "not
    my beat" out-of-scope deflection by deliberate repeated exposure.
  * reversal / contrastive anchors (`family` + `provenance`)    — forward/reverse
    pairs are intentionally duplicated across directions.
  * silent-if-trouble anchors      (`_meta.bucket` ~ "silent")  — task #105.

Everything else: keep the FIRST occurrence, drop the rest (archived, with reason).

Doctrine: NO silent loss — every dropped copy is written to a dated attic jsonl.
Preview by default; --apply writes the archive (still does NOT edit lane files).
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import fold_common as fc

DATE = date.today().isoformat()
ATTIC = fc.REPO / "scratch" / "attic" / f"{DATE}-fold-dedup"


import re as _re

# Reversal markers — a reversal's two directions are INTENTIONALLY related and
# an R1..R5 reverse-template family is INTENTIONALLY parallel. Alfred, 2026-07-30:
# "we also have reversals, so you might be looking at some of the reversals as
# being duplicates. So you have to be careful there." Never collapse or diversify
# a reversal. Detection is deliberately broad (tag field OR inline text tag).
_REV_TEXT = _re.compile(
    r"\[type:reverse|reverse-recall|\[reverse-template:|reverse_of", _re.I)
_REV_TEMPLATE = _re.compile(r"^R\d+$", _re.I)


def is_reversal(rec):
    if not isinstance(rec, dict):
        return False
    t = str(rec.get("type", ""))
    if "revers" in t.lower():
        return True
    if _REV_TEMPLATE.match(str(rec.get("template", ""))):
        return True
    if rec.get("reverse_of") or rec.get("direction"):
        return True
    # inline text tags in any string-bearing field
    for k in ("text", "instruction", "response", "prompt", "completion",
              "output", "answer"):
        v = rec.get(k)
        if isinstance(v, str) and _REV_TEXT.search(v):
            return True
    msgs = rec.get("messages")
    if isinstance(msgs, list):
        for m in msgs:
            if isinstance(m, dict) and isinstance(m.get("content"), str) \
                    and _REV_TEXT.search(m["content"]):
                return True
    return False


def is_anchor(rec):
    """True when a record's repetition is intentional and must be preserved.
    Anchors are NEVER collapsed by dedup and NEVER rewritten by diversify."""
    if not isinstance(rec, dict):
        return False
    if is_reversal(rec):
        return True                       # both directions + R1..R5 kept whole
    if rec.get("_refusal_src") is not None:
        return True                       # honest-null / out-of-scope repeats
    if rec.get("family") and rec.get("provenance"):
        return True                       # contrastive/reversal families
    if fc.is_intentional_silent(rec):
        return True                       # #105 silent-if-trouble
    return False


def dedup_records(records):
    """records: iterable of (key, rec) where key = (prompt.strip, completion.strip).
    Returns (keep_flags, stats). keep_flags[i] is True to keep record i.
    Anchors always kept. For non-anchors sharing a key, keep first only."""
    seen = set()
    keep = []
    stats = Counter()
    for key, rec in records:
        if is_anchor(rec):
            keep.append(True)
            stats["anchor_kept"] += 1
            continue
        if key in seen:
            keep.append(False)
            stats["dropped_dup"] += 1
        else:
            seen.add(key)
            keep.append(True)
            stats["kept_first"] += 1
    return keep, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="write the dropped-copy archive (lane files untouched)")
    ap.add_argument("--samples", type=int, default=12)
    args = ap.parse_args()

    files = fc.find_lane_files()
    # first pass: assign a stable order and collect (key, rec, origin)
    ordered = []
    for path in files:
        for lineno, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown") or not p.strip():
                continue  # cpt / malformed have no SFT dup semantics here
            key = (p.strip(), c.strip())
            ordered.append((key, rec, (path.name, lineno)))

    keep, stats = dedup_records([(k, r) for k, r, _o in ordered])

    dropped = [(ordered[i][2], ordered[i][0]) for i, k in enumerate(keep) if not k]
    per_lane = Counter(origin[0] for origin, _key in dropped)

    if args.apply:
        ATTIC.mkdir(parents=True, exist_ok=True)
        by_lane = defaultdict(list)
        for i, k in enumerate(keep):
            if not k:
                by_lane[ordered[i][2][0]].append(ordered[i][1])
        for lane, recs in by_lane.items():
            with open(ATTIC / (lane + ".deduped"), "w", encoding="utf-8") as fh:
                for r in recs:
                    fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    print("=" * 64)
    print(f" FOLD DEDUP — {'ARCHIVED' if args.apply else 'PREVIEW'} "
          f"(lane files NOT edited)")
    print("=" * 64)
    print(f"SFT records scanned      : {len(ordered)}")
    print(f"kept (first occurrence)  : {stats['kept_first']}")
    print(f"anchors kept in full     : {stats['anchor_kept']}")
    print(f"redundant copies dropped : {stats['dropped_dup']}")
    print(f"post-dedup SFT records   : {stats['kept_first'] + stats['anchor_kept']}")
    print("\ndropped copies per lane (top 15):")
    for lane, n in per_lane.most_common(15):
        print(f"  {n:5}  {lane}")
    print(f"\nsamples ({min(args.samples, len(dropped))}):")
    for origin, key in dropped[:args.samples]:
        p, c = key
        print(f"  [{origin[0]}:{origin[1]}] {p[:50]!r} -> {c[:40]!r}")
    if args.apply:
        print(f"\ndropped-copy archive: {ATTIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
