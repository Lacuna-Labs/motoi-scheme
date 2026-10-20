#!/usr/bin/env python3
"""Drive Chibi's r7rs-tests.scm through Motoi and score it (v3).

Motoi reads AND macro-expands an entire file before executing any of it, so a
single unreadable datum or unexpandable macro use aborts the whole run.  This
driver keeps every surviving top-level form IN ITS ORIGINAL ORDER (hoisting
definitions changes hygiene semantics and produces false results), and simply
re-runs the whole file after removing each form that proves fatal:

  * load failure with a line number  -> map line to form, drop it
  * load failure with no line number -> smallest-failing-PREFIX bisect
  * runtime abort / timeout          -> blame the last @@F marker, drop it

Every dropped form is recorded in state.json; drops are findings, not silent
losses.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from sexp_split import split_forms  # noqa: E402

SRC = os.path.join(HERE, "chibi-r7rs-tests.scm")
PRELUDE = os.path.join(HERE, "prelude.scm")
STATE = os.path.join(HERE, "state3.json")
ENV = dict(os.environ, MOTOI_HOME="/tmp/dijkstra")
# Motoi's default step budget is 200000 ("fuel"), which one 2500-line file
# blows through long before the end.  That is a property of the harness, not
# of conformance, so we raise it and rely on the wall-clock timeout instead.
FUEL = "2000000000"

SRCTEXT = open(SRC, encoding="utf-8").read()
FORMS = split_forms(SRCTEXT)
PRELUDE_TEXT = open(PRELUDE, encoding="utf-8").read()


def text_of(n):
    s, e, _ = FORMS[n]
    return SRCTEXT[s:e]


def build(active, path):
    out = [PRELUDE_TEXT, '\n(display "\\n@@START\\n")\n']
    linemap = {}
    cur = "".join(out).count("\n") + 1
    for n in active:
        chunk = '(display "\\n@@F %d\\n")\n' % n + text_of(n) + "\n"
        for k in range(chunk.count("\n") + 1):
            linemap.setdefault(cur + k, n)
        cur += chunk.count("\n")
        out.append(chunk)
    out.append('(display "\\n@@DONE\\n")\n')
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(out))
    return linemap


def run(path, timeout=240):
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


PROBE = os.path.join(HERE, "gen-probe.scm")


def loads(active):
    build(active, PROBE)
    _, out, err, _ = run(PROBE, timeout=120)
    return ("@@START" in out), err


def bisect_prefix(active):
    """Smallest k with active[:k] failing to load; culprit is active[k-1]."""
    lo, hi = 1, len(active)          # invariant: active[:hi] fails
    while lo < hi:
        mid = (lo + hi) // 2
        ok, _ = loads(active[:mid])
        if ok:
            lo = mid + 1
        else:
            hi = mid
    return active[lo - 1]


def main():
    all_ids = [n for n in range(len(FORMS))
               if not text_of(n).lstrip().startswith("(import")]
    state = {"skipped": []}
    if os.path.exists(STATE) and "--fresh" not in sys.argv:
        state = json.load(open(STATE))
    skip = {d["form"] for d in state["skipped"]}
    gen = os.path.join(HERE, "gen-run.scm")

    for attempt in range(600):
        active = [n for n in all_ids if n not in skip]
        linemap = build(active, gen)
        rc, out, err, timedout = run(gen)
        started = "@@START" in out
        done = "@@DONE" in out
        marks = [int(m.group(1)) for m in re.finditer(r"^@@F (\d+)$", out, re.M)]
        sys.stderr.write("try %d active=%d skip=%d started=%s done=%s to=%s reached=%s\n"
                         % (attempt, len(active), len(skip), started, done,
                            timedout, marks[-1] if marks else None))
        sys.stderr.flush()

        if done:
            open(os.path.join(HERE, "raw-output.txt"), "w",
                 encoding="utf-8").write(out)
            open(os.path.join(HERE, "raw-stderr.txt"), "w",
                 encoding="utf-8").write(err)
            json.dump(state, open(STATE, "w"), indent=1)
            sys.stderr.write("COMPLETE: %d forms dropped\n" % len(skip))
            return 0

        if not started:
            # Never trust the reported line number for attribution: an
            # "unterminated string" error points at EOF, not at the offending
            # datum, and blaming the mapped form silently destroys innocent
            # tests.  Prefix-bisect always.
            n = bisect_prefix(active)
            kind = "load-error"
        else:
            n = marks[-1] if marks else None
            if n is None:
                sys.stderr.write("started but no marker\n")
                return 1
            kind = "timeout" if timedout else "runtime-abort"

        state["skipped"].append({
            "form": n, "line": FORMS[n][2], "kind": kind,
            "stderr": err.strip()[-600:], "text": text_of(n)[:900]})
        skip.add(n)
        json.dump(state, open(STATE, "w"), indent=1)

    sys.stderr.write("gave up\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
