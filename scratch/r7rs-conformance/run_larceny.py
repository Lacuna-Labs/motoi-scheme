#!/usr/bin/env python3
"""Drive Larceny's flattened R7RS test libraries through Motoi.

Same recovery strategy as run_chibi3.py: whole file in original order, drop
whichever form proves fatal (load-time via prefix bisect, run-time via the
last @@F marker), record every drop.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from flatten_larceny import flatten, lift_run_body  # noqa: E402

ENV = dict(os.environ, MOTOI_HOME="/tmp/dijkstra")
FUEL = "2000000000"
LARC = os.path.join(HERE, "larceny")

TARGETS = ["base.sld", "char.sld", "list.sld", "vector.sld",
           "write.sld", "read.sld", "inexact.sld"]


def build_forms():
    notes = []
    testlib = flatten(os.path.join(LARC, "test.sld"), notes)
    testlib = [f for f in testlib
               if not f.lstrip().startswith("(define (run-test ")
               and not f.lstrip().startswith("(define (capture-output ")
               and not f.lstrip().startswith("(define (report-test-results")]
    suites = {}
    for t in TARGETS:
        fs = flatten(os.path.join(LARC, t), notes)
        fs = lift_run_body(fs, notes, t)
        fs = [f for f in fs if not f.lstrip().startswith("(run-")]
        suites[t] = fs
    return testlib, suites, notes


def run(path, timeout=300):
    try:
        p = subprocess.run(["./bin/motoi", "run", os.path.relpath(path, REPO),
                            "--fuel", FUEL],
                           cwd=REPO, env=ENV, capture_output=True, text=True,
                           timeout=timeout)
        return p.returncode, p.stdout, p.stderr, False
    except subprocess.TimeoutExpired as ex:
        def d(x):
            if x is None:
                return ""
            return x.decode("utf-8", "replace") if isinstance(x, bytes) else x
        return -9, d(ex.stdout), d(ex.stderr), True


def build(head, testlib, tail, active, forms, path):
    out = [open(os.path.join(HERE, "larceny-prelude-head.scm"), encoding="utf-8").read()]
    out += [f + "\n" for f in testlib]
    out.append(open(os.path.join(HERE, "larceny-prelude-tail.scm"), encoding="utf-8").read())
    out.append('\n(display "\\n@@START\\n")\n')
    for n in active:
        out.append('(display "\\n@@F %d\\n")\n' % n)
        out.append(forms[n] + "\n")
    out.append('(display "\\n@@DONE\\n")\n')
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(out))


def main():
    testlib, suites, notes = build_forms()
    gen = os.path.join(HERE, "gen-larceny.scm")
    probe = os.path.join(HERE, "gen-larceny-probe.scm")
    result = {"notes": notes, "suites": {}}

    for name, forms in suites.items():
        skip = set()
        dropped = []
        collected = ""
        for attempt in range(400):
            active = [n for n in range(len(forms)) if n not in skip]
            build(None, testlib, None, active, forms, gen)
            rc, out, err, timedout = run(gen)
            started, done = "@@START" in out, "@@DONE" in out
            marks = [int(m.group(1)) for m in re.finditer(r"^@@F (\d+)$", out, re.M)]
            sys.stderr.write("%s try %d active=%d skip=%d started=%s done=%s reached=%s\n"
                             % (name, attempt, len(active), len(skip), started, done,
                                marks[-1] if marks else None))
            sys.stderr.flush()
            if done:
                collected = out
                break
            if not started:
                lo, hi = 1, len(active)
                while lo < hi:
                    mid = (lo + hi) // 2
                    build(None, testlib, None, active[:mid], forms, probe)
                    _, o2, _, _ = run(probe, timeout=150)
                    if "@@START" in o2:
                        lo = mid + 1
                    else:
                        hi = mid
                n = active[lo - 1]
                kind = "load-error"
            else:
                if not marks:
                    sys.stderr.write("%s: no marker\n" % name)
                    break
                n = marks[-1]
                kind = "timeout" if timedout else "runtime-abort"
            dropped.append({"form": n, "kind": kind, "stderr": err.strip()[-600:],
                            "text": forms[n][:900]})
            skip.add(n)
        result["suites"][name] = {"dropped": dropped, "nforms": len(forms)}
        open(os.path.join(HERE, "larceny-raw-%s.txt" % name), "w",
             encoding="utf-8").write(collected)
        json.dump(result, open(os.path.join(HERE, "larceny-state.json"), "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
