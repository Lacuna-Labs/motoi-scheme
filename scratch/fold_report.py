#!/usr/bin/env python3
"""
fold_report.py — go/no-go dashboard for the Motoi SFT fold. (Priya, ask #6)

Runs every gate and prints one dashboard: lock-in risk, missing-data (thin axes),
leakage, truncation, reversal fidelity, total accounting. Aggregates:
    fold_sweep.py       (malformed / banned / needs-alfred / empty / dup)
    lockin_detect.py    (phrase-lock families)
    reversal_fidelity.py(round-trip + runnability)   -- --run optional
    fold_checks.py      (leakage, tokenizer, truncation, imbalance, encoding)
    fold_manifest.py    (authored accounting baseline)

Doctrine reminders printed at top: ONLY-ADD-NEVER-PRUNE; over-include-then-measure
(so "too many pairs" is NOT a failure); no fabrication.

Exit 0 = GO, nonzero = NO-GO. Interpreter grading is opt-in (--run) since it is
slow; the dashboard marks it SKIPPED when off.

Usage:
  python3 scratch/fold_report.py            # fast (no interpreter)
  python3 scratch/fold_report.py --run      # + interpreter-grade a sample
"""
import argparse
import os
import subprocess
import sys

import fold_common as fc
import fold_sweep
import lockin_detect
import fold_checks
import reversal_fidelity as rf

# canonical yield model (fold-size estimator). Permanent home: forge.
ASSESS_PY = os.path.expanduser("~/code/forge/forge/corpus/motoi_sft/assess.py")


def _mark(ok):
    return "GO  " if ok else "NO-GO"


def _assess_total():
    """Run the canonical assess.py and parse its IN-SCOPE projection LIVE.
    Never hard-coded. Returns (in_scope:int|None, raw_line:str)."""
    if not os.path.exists(ASSESS_PY):
        return None, f"assess.py not found at {ASSESS_PY}"
    try:
        out = subprocess.run([sys.executable, ASSESS_PY], capture_output=True,
                             text=True, timeout=120).stdout
    except Exception as e:
        return None, f"assess.py run failed: {e}"
    in_scope = None
    for line in out.splitlines():
        if "IN-SCOPE TOTAL" in line:
            digits = "".join(ch for ch in line.split(":")[-1] if ch.isdigit())
            if digits:
                in_scope = int(digits)
            return in_scope, line.strip()
    return None, "assess.py produced no IN-SCOPE line"


def _authored_on_disk(files):
    """Sum of parseable training records on disk across find_lane_files()."""
    n = 0
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            if "_malformed_json" in rec:
                continue
            _p, _c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                continue
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--max-seq", type=int, default=1024)
    ap.add_argument("--diff", metavar="OLD_DIR",
                    help="previous corpus snapshot dir; report record + "
                         "artifact deltas vs it (skipped silently if omitted)")
    args = ap.parse_args()

    files = fc.find_lane_files(args.paths or None)
    print("=" * 66)
    print(" MOTOI SFT FOLD — GO / NO-GO DASHBOARD  (Priya)")
    print(" doctrine: ONLY-ADD-NEVER-PRUNE · over-include-then-measure · no-fab")
    print(f" scanning {len(files)} lane files")
    print("=" * 66)

    gates = []

    # 1. sweep
    counts, _ex, _pf, total = fold_sweep.sweep(files, n_examples=0)
    blocking = sum(counts.get(c, 0) for c in fold_sweep.BLOCKING)
    ok = blocking == 0
    gates.append(("malformed/banned/needs-alfred sweep", ok,
                  f"{blocking} blocking of {total} records"))

    # 2. lock-in (self-BLEU ONLY — matches lockin_detect.py). distinct-2/gzip
    #    trip on benign SKELETON repetition (thousands of "what does X do?" pairs
    #    with DIVERSE answers are fine); only self-BLEU compares full content.
    #    The OR-gate over-flagged ~1500 families (~85% benign) — do NOT restore.
    #    This is a POST-DEDUP measurement: exact copies are dedup's job (gate 3b),
    #    so we cluster the dedup survivors, not the raw lanes, or a family of
    #    identical rows reads as self-BLEU 1.000 and masquerades as template-lock.
    from collections import defaultdict
    _ordered = []
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            p, c, _b, sc = fc.normalize(rec)
            if sc in ("malformed", "unknown") or not p.strip():
                continue
            _ordered.append(((p.strip(), c.strip()), rec, p, c))
    import fold_dedup
    _keepflags, _ = fold_dedup.dedup_records(
        [(k, r) for k, r, _p, _c in _ordered])
    fams = defaultdict(list)
    for i, (_k, _r, p, c) in enumerate(_ordered):
        if not _keepflags[i]:
            continue
        fams[lockin_detect.skeleton(p)].append(f"{p} || {c}")
    flagged = severe = locked_records = 0
    for skel, texts in fams.items():
        if len(texts) < 8:
            continue
        sb = lockin_detect.self_bleu_proxy(texts)
        if sb > 0.35:
            flagged += 1
            locked_records += len(texts)
            if sb > 0.50:
                severe += 1
    # template-lock is a DIVERSIFY DECISION (add-only rewrite lane), not a hard
    # stop: diversify DILUTES the family, never trims it. Flag as INFO so the
    # dashboard reports it every run (standing gate) without blocking the fold.
    gates.append(("phrase-lock — TEMPLATE-LOCK (diversify, add-only)", True,
                  f"{flagged} locked fams ({severe} severe), "
                  f"{locked_records} rows -> fold_diversify.py"))

    # 3. fold_checks (leakage/tokenizer/truncation/imbalance/encoding)
    rep, prompts = fold_checks.run_checks(files, max_seq=args.max_seq)
    leak = fold_checks.split_leakage(prompts)
    ok = (rep["special_token_leak"] == 0 and rep["encoding_corruption"] == 0
          and rep["empty_side_label_risk"] == 0
          and leak["exact_overlap_with_train"] == 0)
    gates.append(("leakage/tokenizer/label/encoding", ok,
                  f"special={rep['special_token_leak']} "
                  f"corrupt={rep['encoding_corruption']} "
                  f"empty-side={rep['empty_side_label_risk']} "
                  f"leak={leak['exact_overlap_with_train']}"))
    tr = rep["truncation"]
    ok = tr["over_max_seq"] == 0
    gates.append(("truncation (BPE vs max_seq)", ok,
                  f"{tr['over_max_seq']} over {tr['max_seq']} "
                  f"({'real tok' if tr['real_tokenizer'] else 'PROXY'})"))
    thin = rep["thin_lanes_lt_0.5pct"]
    # thin axes are ADD-work, informational — never a NO-GO (over-include doctrine)
    gates.append(("thin-axis / imbalance (INFO — add-only)", True,
                  f"{len(thin)} lanes <0.5%"))

    # 3b. anchor-aware DEDUP (standing step, Alfred "Both" 2026-07-30). At 12x
    #     explosion the same authored pair is minted by >1 lane; exact copies
    #     inflate self-BLEU to 1.000 and fake train/valid leakage. Dedup is the
    #     SANCTIONED only-add exception: keep first occurrence, archive the rest,
    #     NEVER collapse anchors (refusal / contrastive-family / silent-#105) or
    #     reversals (both directions + R1..R5 are INTENTIONALLY parallel). INFO
    #     (a decision the assembly stage applies), not a hard stop.
    _dkeep, _dstats = fold_dedup.dedup_records(
        [(k, r) for k, r, _p, _c in _ordered])
    gates.append(("anchor-aware DEDUP (standing, add-only exception)", True,
                  f"{_dstats['dropped_dup']} redundant copies -> attic; "
                  f"{_dstats['anchor_kept']} anchors/reversals KEPT whole"))

    # 3c. HELD-OUT LEAK (HARD gate). Training on the exam poisons the eval. The
    #     held-out LANE is excluded in fold_common._keep(); this catches per-record
    #     held_out:true rows embedded INSIDE training lanes — they must be pulled
    #     before firing. (Alfred flagged 2026-07-30.)
    heldout_rows = 0
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            if isinstance(rec, dict) and (rec.get("held_out")
                    or rec.get("_held_out") or rec.get("heldout")):
                heldout_rows += 1
    ok = heldout_rows == 0
    gates.append(("HELD-OUT leak (eval poisoning)", ok,
                  f"{heldout_rows} held_out:true rows in TRAINING lanes "
                  f"(must be 0 — exclude before fold)"))

    # 4. reversal fidelity
    if args.run:
        rc = rf.main.__wrapped__ if hasattr(rf.main, "__wrapped__") else None
        # run inline via its helpers to control sampling
        import io, contextlib
        buf = io.StringIO()
        old = sys.argv
        sys.argv = ["reversal_fidelity", "--run", "--sample", "120"]
        try:
            with contextlib.redirect_stdout(buf):
                code = rf.main()
        finally:
            sys.argv = old
        ok = code == 0
        gates.append(("reversal fidelity + runnability", ok,
                      buf.getvalue().strip().splitlines()[-1][:50]))
    else:
        gates.append(("reversal fidelity + runnability", True, "SKIPPED (--run)"))

    # 5. manifest accounting baseline
    import fold_manifest
    lanes = fold_manifest.scan(files)
    authored = sum(len(d["ids"]) for d in lanes.values())
    excluded = sum(len(d["excluded"]) for d in lanes.values())
    gates.append(("authored accounting baseline", True,
                  f"{authored} authored, {excluded} excluded-with-reason "
                  f"(reconcile vs fold post-run)"))

    # 6. UNUSED / THIN TAGS (INFO — coverage gaps, never a NO-GO)
    tags = fold_checks.tag_usage(files)
    if tags["declared_unused"]:
        tag_detail = (f"{len(tags['declared_unused'])} declared tags UNUSED: "
                      f"{', '.join(':' + t for t in tags['declared_unused'])}")
    else:
        tag_detail = (f"all {len(tags['declared'])} declared tags present; "
                      f"{len(tags['observed_keys'])} keys observed "
                      f"(thin ones below)")
    gates.append(("UNUSED/THIN TAGS (INFO — coverage)", True, tag_detail))

    # 7. GENERATION ARTIFACTS (WARN — informational, never a NO-GO)
    arts = fold_checks.generation_artifacts(files)
    gates.append(("GENERATION ARTIFACTS (WARN — chat-model fuckery)", True,
                  f"{arts['total_hits']} completions flagged "
                  f"(see breakdown below)"))

    print(f"\n{'GATE':<44} {'VERDICT':<6} DETAIL")
    print("-" * 66)
    hard_fail = False
    INFO = {"thin-axis / imbalance (INFO — add-only)",
            "phrase-lock — TEMPLATE-LOCK (diversify, add-only)",
            "anchor-aware DEDUP (standing, add-only exception)",
            "authored accounting baseline",
            "UNUSED/THIN TAGS (INFO — coverage)",
            "GENERATION ARTIFACTS (WARN — chat-model fuckery)"}
    for name, ok, detail in gates:
        if not ok and name not in INFO:
            hard_fail = True
        print(f"{name:<44} {_mark(ok):<6} {detail}")

    # ---- PROJECTED YIELD (live from assess.py; never hard-coded) ----
    raw = _authored_on_disk(files)
    in_scope, assess_line = _assess_total()
    print("\n" + "-" * 66)
    print(" PROJECTED YIELD  (fold explosion — assess.py, over-include)")
    print("-" * 66)
    print(f"  authored records on disk (find_lane_files): {raw:,}")
    if in_scope is not None:
        print(f"  assess.py in-scope projection:              ~{in_scope:,}")
        ratio = in_scope / raw if raw else 0
        print(f"  explosion ratio (projected / authored):     ~{ratio:.0f}x")
    else:
        print(f"  assess.py in-scope projection:              UNAVAILABLE")
    print(f"  [{assess_line}]")

    # ---- UNUSED / THIN TAGS detail ----
    print("\n" + "-" * 66)
    print(" UNUSED / THIN TAGS  (\"tags we didn't use — so we know we're f'ing up\")")
    print("-" * 66)
    if tags["declared_unused"]:
        print(f"  DECLARED-BUT-UNUSED ({len(tags['declared_unused'])}) vs the "
              f"CLAUDE.md tag contract:")
        for t in tags["declared_unused"]:
            print(f"     :{t}   (0 occurrences — coverage gap)")
    else:
        print(f"  all {len(tags['declared'])} declared contract tags present.")
    print(f"  thinnest observed tag keys (ascending — near-zero = likely gaps):")
    for k, cnt in tags["thin_observed"]:
        print(f"     :{k:<28} {cnt:>8}")

    # ---- GENERATION ARTIFACTS detail ----
    print("\n" + "-" * 66)
    print(" GENERATION ARTIFACTS  (\"excited stuff and all the fuckery\" — WARN)")
    print("-" * 66)
    print(f"  {'category':<14} {'flagged completions':>20}")
    for cat, cnt in arts["categories"].items():
        print(f"  {cat:<14} {cnt:>20,}")
    print(f"  {'TOTAL':<14} {arts['total_hits']:>20,}")
    if arts["top_files"]:
        print("  top offending files:")
        for f, n in arts["top_files"]:
            print(f"     {n:>6}  {f}")
    else:
        print("  no offending files — clean.")

    # ---- DIFF vs previous snapshot (optional) ----
    if args.diff:
        _print_diff(files, args.diff)

    print("=" * 66)
    verdict = "NO-GO — fix hard gates above" if hard_fail else \
              "GO — hard gates clear (run --run + post-fold manifest before firing)"
    print(f" VERDICT: {verdict}")
    print("=" * 66)
    return 1 if hard_fail else 0


def _print_diff(files, old_dir):
    """--diff hook: net record-count delta per file + per-category artifact
    delta (UP=regression / down) between current corpus and a snapshot dir.
    Simple line-count + per-category counts, matched by file basename."""
    import fold_checks
    from pathlib import Path
    old_dir = Path(os.path.expanduser(old_dir))
    print("\n" + "-" * 66)
    print(f" DIFF vs snapshot  {old_dir}")
    print("-" * 66)
    if not old_dir.is_dir():
        print(f"  snapshot dir not found — skipping diff.")
        return
    old_files = {p.name: p for p in old_dir.rglob("*.jsonl")}
    if not old_files:
        print("  snapshot has no .jsonl files — skipping diff.")
        return

    def _recs(path):
        return sum(1 for _ln, rec in fc.iter_jsonl(path)
                   if "_malformed_json" not in rec)

    print(f"  {'file':<40} {'old':>7} {'new':>7} {'Δ':>7}")
    cur = {p.name: p for p in files}
    for name in sorted(set(cur) | set(old_files)):
        new_n = _recs(cur[name]) if name in cur else 0
        old_n = _recs(old_files[name]) if name in old_files else 0
        if new_n == old_n:
            continue
        print(f"  {name:<40} {old_n:>7} {new_n:>7} {new_n - old_n:>+7}")

    # per-category artifact regression on the shared file set
    shared = [cur[n] for n in cur if n in old_files]
    old_shared = [old_files[n] for n in cur if n in old_files]
    if shared:
        new_a = fold_checks.generation_artifacts(shared)["categories"]
        old_a = fold_checks.generation_artifacts(old_shared)["categories"]
        print("\n  artifact deltas on shared files (UP = regression):")
        for cat in new_a:
            d = new_a[cat] - old_a.get(cat, 0)
            flag = "  <-- UP" if d > 0 else ""
            print(f"     {cat:<14} {old_a.get(cat, 0):>7} -> {new_a[cat]:>7} "
                  f"({d:+d}){flag}")


if __name__ == "__main__":
    sys.exit(main())
