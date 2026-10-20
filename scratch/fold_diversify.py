#!/usr/bin/env python3
"""
fold_diversify.py — ADD-ONLY de-lock lane for template-locked SFT families.

WHY THIS EXISTS (read before touching):
  `lockin_detect.py` flags FAMILIES of (prompt, completion) pairs whose
  *completions* are near-identical across a swapped prompt slot — self-BLEU>0.35
  on the joined text. That is COMPLETION-LOCK: one canned answer stapled onto
  many prompt variants ("prep for Ecology" / "prep for Genetics" -> the exact
  same body). Alfred: parallel templates with only a variable swapped are
  "nonsense". At 12x explosion this is INEVITABLE, so de-locking is a STANDING
  pre-fold + post-fold step, not a one-off cleanup.

  The FIX is NOT deterministic surface-scatter (reorder clauses, swap
  connectives) — that produces the same nonsense in a trench coat. The honest
  fix is to REGENERATE each completion conditioned on its own prompt slot
  (Verbalized-Sampling style), so the answer actually fits the question. That
  needs a model. This script does the deterministic half:
    * find the locked families (reusing lockin_detect's skeleton + self-BLEU),
    * drop anchors + reversals (never rewrite an intentional repeat — Alfred:
      "you might be looking at some of the reversals as being duplicates. So you
      have to be careful there."),
    * emit a per-record WORK-ORDER jsonl that a model lane consumes.

  DOCTRINE: only-add. Originals are NEVER edited or dropped. Regenerated variants
  land in a NEW lane (scratch/sft-plans/delock-variants-<DATE>.jsonl); the fold
  gains rows, the locked family is diluted, self-BLEU falls. If the model can't
  improve a row it is left alone (no fabrication, no deletion).

MODES:
  (default / --dry)  emit the work-order + stats; write NOTHING to a fold lane.
  --emit-variants    read a completed work-order (--responses FILE) and append
                     model rewrites to the add-only variant lane.
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import fold_common as fc
import lockin_detect as lk
from fold_dedup import is_anchor, is_reversal, dedup_records

DATE = date.today().isoformat()
# Intermediates (work-order + model responses) are WORKING files — they must NOT
# live in a fold root or the phrase-lock detector scans them as training lanes
# (the work-order's 442 identical instruction strings read as a self-BLEU 1.000
# family — a pure measurement artifact). Keep them at scratch/ root (unscanned).
INTERMED = fc.REPO / "scratch"
WORKORDER = INTERMED / f"delock-workorder-{DATE}.jsonl"
# Only the add-only VARIANTS lane belongs in a fold root (it IS training data).
OUTDIR = fc.REPO / "scratch" / "sft-plans"
VARIANTS = OUTDIR / f"delock-variants-{DATE}.jsonl"

# self-BLEU lock threshold — same gate lockin_detect locks on.
LOCK_SB = 0.35
# how many fresh variants to request per locked row (dilutes the family).
VARIANTS_PER_ROW = 2


def collect_locked(min_family, sample_cap=80):
    """Return list of families [(skeleton, [(origin, rec, prompt, completion)])]
    that are template-locked (self-BLEU>LOCK_SB) after dropping anchors/reversals.

    Runs on the POST-DEDUP fold: exact-duplicate rows are dedup's job, not ours.
    If diversify saw the raw lanes it would waste model calls rewriting exact
    copies that dedup drops anyway (a family of identical 'what's pi' rows reads
    as self-BLEU 1.000 — that is redundancy, not template-lock). So we apply the
    dedup keep-flags first and only cluster the survivors."""
    ordered = []  # (key, rec, origin, prompt, completion, schema)
    for path in fc.find_lane_files():
        for lineno, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown") or not p.strip():
                continue  # cpt/malformed have no prompt slot to de-lock
            key = (p.strip(), c.strip())
            ordered.append((key, rec, (path.name, lineno), p, c))

    keep, _stats = dedup_records([(k, r) for k, r, _o, _p, _c in ordered])

    families = defaultdict(list)
    for i, row in enumerate(ordered):
        if not keep[i]:
            continue  # exact duplicate — dedup collapses it; not our concern
        _key, rec, origin, p, c = row
        families[lk.skeleton(p)].append((origin, rec, p, c))

    locked = []
    for skel, rows in families.items():
        if len(rows) < min_family:
            continue
        # de-lock only NON-anchor, NON-reversal rows — but measure self-BLEU on
        # the family as authored (anchors are legitimately parallel; excluding
        # them from the metric would hide real lock in the rest).
        texts = [f"{p} || {c}" for _o, _r, p, c in rows]
        sb = lk.self_bleu_proxy(texts, sample_cap=sample_cap)
        if sb <= LOCK_SB:
            continue
        rewritable = [row for row in rows
                      if not is_anchor(row[1]) and not is_reversal(row[1])]
        if not rewritable:
            continue  # whole family is anchors/reversals — leave it whole
        locked.append((skel, sb, rows, rewritable))
    locked.sort(key=lambda t: (-t[1], -len(t[2])))
    return locked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-family", type=int, default=8)
    ap.add_argument("--emit-variants", action="store_true",
                    help="append model rewrites from --responses to the variant lane")
    ap.add_argument("--responses", type=Path,
                    help="completed work-order jsonl (one {id, variants:[...]} per line)")
    ap.add_argument("--top", type=int, default=25)
    args = ap.parse_args()

    if args.emit_variants:
        return emit_variants(args.responses)

    locked = collect_locked(args.min_family)
    n_families = len(locked)
    n_rewritable = sum(len(rw) for _s, _sb, _r, rw in locked)

    INTERMED.mkdir(parents=True, exist_ok=True)
    with open(WORKORDER, "w", encoding="utf-8") as fh:
        for skel, sb, rows, rewritable in locked:
            for origin, rec, p, c in rewritable:
                rid = f"{origin[0]}:{origin[1]}"
                fh.write(json.dumps({
                    "id": rid,
                    "skeleton": skel,
                    "family_self_bleu": round(sb, 3),
                    "family_size": len(rows),
                    "prompt": p,
                    "locked_completion": c,
                    "n_variants": VARIANTS_PER_ROW,
                    "instruction": (
                        "Rewrite the answer so it is CORRECT and SPECIFIC to THIS "
                        "prompt. The prompt's variable slot differs from its "
                        "siblings; the answer must reflect that slot, not the "
                        "generic template. Keep any code runnable and factually "
                        "accurate. Do not invent facts. Return only the new "
                        "completion text."),
                }, ensure_ascii=False) + "\n")

    print("=" * 64)
    print(f" FOLD DIVERSIFY — WORK-ORDER (nothing written to a fold lane)")
    print("=" * 64)
    print(f"template-locked families (self-BLEU>{LOCK_SB}) : {n_families}")
    print(f"rewritable rows (anchors/reversals excluded)  : {n_rewritable}")
    print(f"variants requested per row                    : {VARIANTS_PER_ROW}")
    print(f"work-order                                    : {WORKORDER}")
    print(f"\ntop {min(args.top, n_families)} locked families:")
    print(f"{'n':>5} {'selfBLEU':>9} {'rewr':>5}  skeleton")
    print("-" * 70)
    for skel, sb, rows, rw in locked[:args.top]:
        print(f"{len(rows):>5} {sb:>9.3f} {len(rw):>5}  {skel[:44]}")
    print("\nNEXT: fire the rewrite lane (Haiku/Forge harness) over the")
    print("work-order, then: fold_diversify.py --emit-variants --responses <file>")
    return 0


def emit_variants(responses):
    """Append model-produced variants to the add-only variant lane.

    responses jsonl lines: {"id": "<lane:lineno>", "prompt": ..., "variants": [str,...]}
    Each variant becomes a NEW flat SFT record tagged as a de-lock rewrite.
    Originals are untouched; this only ADDS rows."""
    if not responses or not responses.exists():
        print(f"ERROR: --responses file not found: {responses}", file=sys.stderr)
        return 2
    OUTDIR.mkdir(parents=True, exist_ok=True)

    # SAFETY NET (emit is where variants BECOME training rows): a variant derived
    # from a held-out eval prompt would re-poison the eval through the back door.
    # The work-order should already be heldout-free (fold_common excludes the
    # lane), but guard here regardless — id prefix "heldout"/"held-out" is dropped.
    def _is_heldout_id(rid):
        low = (rid or "").lower()
        return "heldout" in low or "held-out" in low

    written = skipped_heldout = 0
    with open(responses, "r", encoding="utf-8") as fin, \
            open(VARIANTS, "a", encoding="utf-8") as fout:
        for raw in fin:
            raw = raw.strip()
            if not raw:
                continue
            row = json.loads(raw)
            if _is_heldout_id(row.get("id", "")):
                skipped_heldout += 1
                continue  # eval-derived — never let it enter the fold
            prompt = row.get("prompt", "")
            for v in row.get("variants", []):
                v = (v or "").strip()
                if not v:
                    continue  # model declined — no fabrication, skip
                fout.write(json.dumps({
                    "instruction": prompt,
                    "response": v,
                    "_delock_of": row.get("id"),
                    "_provenance": "fold_diversify de-lock rewrite",
                    "_date": DATE,
                }, ensure_ascii=False) + "\n")
                written += 1
    print(f"appended {written} de-lock variant rows -> {VARIANTS}")
    print("(only-add: originals untouched; re-run lockin_detect to confirm drop)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
