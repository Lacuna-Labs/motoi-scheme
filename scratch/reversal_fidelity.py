#!/usr/bin/env python3
"""
reversal_fidelity.py — reversal-pair consistency + runnability. (Priya, ask #3)

We have MANY reversal pairs (InverseCoder-style): a FORWARD pair (intent -> code)
and a REVERSE pair (code -> identify/explain). Two things must hold:

  (1) ROUND-TRIP SUBJECT MATCH: the exact code produced in a forward pair must
      appear as the SUBJECT of some reverse pair (and vice-versa). If a forward
      pair's code never shows up on the prompt side of a reverse pair, the
      reversal is unpaired — an untestable claim.

  (2) RUNNABILITY: when a code_block is a full top-level program, it must
      `echo '<code>' | ./bin/motoi run /dev/stdin` with EXIT 0 — UNLESS the pair
      is flagged expected-error (broken<->fixed teaching, §10.1). Code is passed
      base64 so quotes/newlines can't corrupt the shell (grader gotcha #3).

Pairing key = a normalised hash of the code. Forward vs reverse is inferred:
  - forward  = code appears in `code_blocks`/fenced in the COMPLETION
  - reverse  = code appears in the PROMPT (the thing being identified)
An `expected-error`/`expected-outcome` field (or an `error`/`broken` shape tag)
marks a block as allowed-to-fail.

Usage:
  python3 scratch/reversal_fidelity.py [path ...] --run --sample 200
  (omit --run to skip the interpreter and only check round-trip pairing)
"""
import argparse
import base64
import hashlib
import re
import subprocess
import sys
from collections import defaultdict

import fold_common as fc

_WS = re.compile(r"\s+")


def norm_code(code):
    return _WS.sub(" ", code.strip())


def code_hash(code):
    return hashlib.sha1(norm_code(code).encode("utf-8")).hexdigest()[:12]


def is_expected_error(rec):
    for k in ("expected_outcome", "expected-outcome", "expected_error"):
        v = rec.get(k)
        if v and str(v).lower() not in ("ok", "false", "none"):
            return True
    shape = str(rec.get("shape", "")).lower()
    return "error" in shape or "broken" in shape or bool(rec.get("_expected_error"))


def run_program(code, timeout=15):
    """Return (exit_code, tail_of_output). base64-passed to avoid quoting bugs."""
    b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
    sh = f'echo {b64} | base64 -d | "{fc.MOTOI}" run /dev/stdin'
    try:
        p = subprocess.run(["bash", "-c", sh], capture_output=True,
                           text=True, timeout=timeout)
        out = (p.stdout + p.stderr).strip().splitlines()
        return p.returncode, (out[-1] if out else "")
    except subprocess.TimeoutExpired:
        return 124, "TIMEOUT"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--run", action="store_true", help="interpreter-grade programs")
    ap.add_argument("--sample", type=int, default=150,
                    help="max programs to actually run")
    args = ap.parse_args()

    files = fc.find_lane_files(args.paths or None)

    fwd = defaultdict(list)   # code_hash -> [(file,line)]   code appears in completion
    rev = defaultdict(list)   # code_hash -> [(file,line)]   code appears in prompt
    programs = {}             # code_hash -> (code, expected_error)

    for path in files:
        for ln, rec in fc.iter_jsonl(path):
            p, c, blocks, schema = fc.normalize(rec)
            if schema in ("malformed", "unknown"):
                continue
            exp_err = is_expected_error(rec)
            # forward: code in completion
            for b in blocks:
                h = code_hash(b)
                programs.setdefault(h, (b, exp_err))
                fwd[h].append((path.name, ln))
            # reverse: code in the prompt
            for b in fc._fenced(p):
                h = code_hash(b)
                programs.setdefault(h, (b, exp_err))
                rev[h].append((path.name, ln))

    all_hashes = set(fwd) | set(rev)
    both = set(fwd) & set(rev)
    fwd_only = set(fwd) - set(rev)
    rev_only = set(rev) - set(fwd)

    print(f"# reversal_fidelity — {len(all_hashes)} distinct code subjects")
    print(f"  paired both directions : {len(both)}")
    print(f"  forward-only (no reverse partner): {len(fwd_only)}")
    print(f"  reverse-only (no forward partner): {len(rev_only)}")

    # runnability
    if args.run:
        runnable = [(h, c) for h, (c, _e) in programs.items()
                    if fc.looks_like_full_program(c)]
        runnable = runnable[:args.sample]
        ran = passed = unexpected_fail = expected_ok = 0
        fails = []
        for h, code in runnable:
            _c, exp_err = programs[h]
            rc, tail = run_program(code)
            ran += 1
            if exp_err:
                expected_ok += 1  # allowed either way
                continue
            if rc == 0:
                passed += 1
            else:
                unexpected_fail += 1
                if len(fails) < 10:
                    fails.append((h, rc, tail, code[:60]))
        print(f"\n  ran {ran} full programs (sample of "
              f"{sum(1 for _h,(c,_e) in programs.items() if fc.looks_like_full_program(c))}):")
        print(f"    PASS (exit 0)        : {passed}")
        print(f"    expected-error skip  : {expected_ok}")
        print(f"    UNEXPECTED FAIL      : {unexpected_fail}")
        for h, rc, tail, snip in fails:
            print(f"      [{h}] rc={rc} {tail[:50]!r}  <- {snip!r}")
        if unexpected_fail:
            return 1
    else:
        print("\n  (--run not set: skipped interpreter grading)")

    # a fully-consistent fold wants fwd_only/rev_only near zero for reversal lanes,
    # but non-reversal lanes legitimately have forward-only code. So this is a
    # REPORT, not an auto-fail, unless run-grading failed above.
    return 0


if __name__ == "__main__":
    sys.exit(main())
