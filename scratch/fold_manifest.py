#!/usr/bin/env python3
"""
fold_manifest.py — post-fold accounting: every authored pair is accounted for.
(Priya, ask #5)

Proves NO SILENT DROPS. Reconciles three numbers per lane:
    authored  — pairs on disk in the lane source (input jsonl)
    folded    — pairs that made it into the fold output (train.jsonl+valid.jsonl)
    excluded  — pairs intentionally left out, WITH A REASON

Invariant (only-add doctrine): authored == folded + excluded, for every lane.
Any lane where authored != folded + excluded is a SILENT DROP -> hard fail.

Exclusion reasons are matched from a lightweight ledger (records carry an
`_excluded` / `:status "needs-alfred"` / expected-error-without-partner flag),
so an excluded pair is never just "missing" — it is missing WITH A REASON.

Fold identity = sha1(normalised prompt + completion). The fold output must
carry the SAME identity so a pair can be matched across authored<->folded.

Usage:
  python3 scratch/fold_manifest.py --authored <dir...> --folded <train.jsonl valid.jsonl>
  # if --folded is omitted, prints the AUTHORED manifest only (pre-fold baseline)
"""
import argparse
import hashlib
import re
import sys
from collections import defaultdict

import fold_common as fc

_WS = re.compile(r"\s+")


def pair_id(p, c):
    key = _WS.sub(" ", (p + "\x1f" + c).strip())
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def lane_of(path):
    return path.name


def scan(files):
    """lane -> {ids:set, excluded:{id:reason}}"""
    lanes = defaultdict(lambda: {"ids": set(), "excluded": {}})
    for path in files:
        lane = lane_of(path)
        for _ln, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                lanes[lane]["excluded"][f"L{_ln}"] = f"unparseable:{schema}"
                continue
            pid = pair_id(p, c)
            lanes[lane]["ids"].add(pid)
            reason = None
            joined = p + c
            if fc.NEEDS_ALFRED_RE.search(joined):
                reason = "needs-alfred placeholder (must not train)"
            elif rec.get("_excluded"):
                reason = str(rec.get("_excluded"))
            if reason:
                lanes[lane]["excluded"][pid] = reason
    return lanes


def scan_folded(files):
    ids = set()
    for path in files:
        for _ln, rec in fc.iter_jsonl(path):
            p, c, _b, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                continue
            ids.add(pair_id(p, c))
    return ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--authored", nargs="*", default=None)
    ap.add_argument("--folded", nargs="*", default=None)
    args = ap.parse_args()

    authored_files = fc.find_lane_files(args.authored) if args.authored is not None \
        else fc.find_lane_files()
    lanes = scan(authored_files)

    folded_ids = scan_folded([__import__("pathlib").Path(f) for f in args.folded]) \
        if args.folded else None

    print(f"# fold_manifest — {len(lanes)} lanes\n")
    hdr = f"{'lane':<45} {'authored':>9} {'excluded':>9}"
    if folded_ids is not None:
        hdr += f" {'folded':>8} {'DROPPED':>8}"
    print(hdr)
    print("-" * len(hdr))
    total_drop = 0
    for lane in sorted(lanes):
        d = lanes[lane]
        auth = len(d["ids"])
        exc = len(d["excluded"])
        row = f"{lane[:44]:<45} {auth:>9} {exc:>9}"
        if folded_ids is not None:
            fol = len(d["ids"] & folded_ids)
            # dropped = authored, not excluded, not folded
            dropped = len(d["ids"] - folded_ids - set(d["excluded"]))
            total_drop += dropped
            flag = " <<< SILENT DROP" if dropped else ""
            row += f" {fol:>8} {dropped:>8}{flag}"
        print(row)

    if folded_ids is not None:
        print(f"\nTOTAL SILENT DROPS (authored, un-excluded, un-folded): {total_drop}")
        return 1 if total_drop else 0
    else:
        print("\n(no --folded given: authored baseline only — run after the fold "
              "to reconcile)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
