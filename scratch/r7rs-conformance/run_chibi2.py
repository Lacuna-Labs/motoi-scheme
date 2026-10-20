#!/usr/bin/env python3
"""Drive Chibi's r7rs-tests.scm through Motoi and score it (v2).

Motoi reads AND macro-expands the whole file before executing any of it, so a
single unreadable datum or unexpandable macro use aborts everything.  This
driver therefore:

  * builds one file = prelude + context forms + remaining forms, each preceded
    by an `@@F n` marker;
  * on a load-time failure with a line number, maps it to a form and skips it;
  * on a load-time failure with no line number, bisects the remaining forms to
    find the culprit;
  * on a run-time crash, keeps the results already emitted and resumes after
    the offending form.

All skips are recorded and reported: they are findings, not silent drops.
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
GEN = os.path.join(HERE, "gen-run.scm")
STATE = os.path.join(HERE, "state.json")
ENV = dict(os.environ, MOTOI_HOME="/tmp/dijkstra")

SRCTEXT = open(SRC, encoding="utf-8").read()
FORMS = split_forms(SRCTEXT)


def text_of(n):
    s, e, _ = FORMS[n]
    return SRCTEXT[s:e]


def is_context(n):
    """Forms worth replaying as context for later forms."""
    t = text_of(n).lstrip()
    if t.startswith("(import"):
        return False
    head = t[1:].split(None, 1)[0].rstrip(")") if t.startswith("(") else ""
    return head in ("define", "define-syntax", "define-record-type",
                    "define-values", "set!", "begin")


def build(active, ctx_ids, path=GEN):
    out = [open(PRELUDE, encoding="utf-8").read()]
    linemap = {}
    for n in ctx_ids:
        out.append(text_of(n) + "\n")
    out.append('(display "\\n@@START\\n")\n')
    cur = "".join(out).count("\n") + 1
    for n in active:
        chunk = '(display "\\n@@F %d\\n")\n' % n + text_of(n) + "\n"
        for k in range(chunk.count("\n") + 1):
            linemap.setdefault(cur + k, n)
        cur += chunk.count("\n")
        out.append(chunk)
    out.append('(display "\\n@@DONE\\n")\n')
    txt = "".join(out)
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    return linemap


def run(path=GEN, timeout=240):
    try:
        p = subprocess.run(["./bin/motoi", "run", os.path.relpath(path, REPO)],
                           cwd=REPO, env=ENV, capture_output=True, text=True,
                           timeout=timeout)
        return p.returncode, p.stdout, p.stderr, False
    except subprocess.TimeoutExpired as ex:
        def d(x):
            if x is None:
                return ""
            return x.decode("utf-8", "replace") if isinstance(x, bytes) else x
        return -9, d(ex.stdout), d(ex.stderr), True


def loads_ok(active, ctx_ids):
    """True if the given form set at least reaches @@START."""
    build(active, ctx_ids, path=os.path.join(HERE, "gen-probe.scm"))
    rc, out, err, to = run(os.path.join(HERE, "gen-probe.scm"), timeout=120)
    return ("@@START" in out), err


def bisect_bad(active, ctx_ids):
    """Find one form in `active` that makes the file fail to load."""
    lo = active[:]
    while len(lo) > 1:
        half = len(lo) // 2
        a, b = lo[:half], lo[half:]
        ok_a, _ = loads_ok(a, ctx_ids)
        if not ok_a:
            lo = a
            continue
        ok_b, _ = loads_ok(b, ctx_ids)
        if not ok_b:
            lo = b
            continue
        # neither half alone fails -> interaction; blame the last form
        return lo[-1]
    return lo[0]


def main():
    all_ids = [n for n in range(len(FORMS))
               if not text_of(n).lstrip().startswith("(import")]
    state = {"skipped": [], "results_raw": ""}
    if os.path.exists(STATE) and "--fresh" not in sys.argv:
        state = json.load(open(STATE))
    skip = {d["form"] for d in state["skipped"]}
    collected = []
    pos = 0
    attempts = 0

    while attempts < 500:
        attempts += 1
        remaining = [n for n in all_ids[pos:] if n not in skip]
        if not remaining:
            break
        ctx_ids = [n for n in all_ids[:pos] if n not in skip and is_context(n)]
        linemap = build(remaining, ctx_ids)
        rc, out, err, timedout = run()
        started = "@@START" in out
        done = "@@DONE" in out
        marks = [int(m.group(1)) for m in re.finditer(r"^@@F (\d+)$", out, re.M)]
        sys.stderr.write("try %d pos=%d rem=%d skip=%d started=%s done=%s to=%s\n"
                         % (attempts, pos, len(remaining), len(skip), started, done, timedout))
        sys.stderr.flush()

        if started:
            collected.append(out[out.index("@@START"):])

        if done:
            break

        if not started:
            m = re.search(r"line (\d+)", err)
            n = None
            if m:
                gl = int(m.group(1))
                n = linemap.get(gl)
                if n is None:
                    for d in range(1, 15):
                        n = linemap.get(gl - d) or linemap.get(gl + d)
                        if n is not None:
                            break
            if n is None or n in skip:
                n = bisect_bad(remaining, ctx_ids)
            state["skipped"].append({
                "form": n, "line": FORMS[n][2], "kind": "load-error",
                "stderr": err.strip()[-600:], "text": text_of(n)[:800]})
            skip.add(n)
        else:
            n = marks[-1] if marks else None
            if n is None:
                sys.stderr.write("started but no marker; aborting\n")
                break
            state["skipped"].append({
                "form": n, "line": FORMS[n][2],
                "kind": "timeout" if timedout else "runtime-abort",
                "stderr": err.strip()[-600:], "text": text_of(n)[:800]})
            skip.add(n)
            pos = all_ids.index(n) + 1
        json.dump(state, open(STATE, "w"), indent=1)

    open(os.path.join(HERE, "raw-output.txt"), "w", encoding="utf-8").write(
        "\n".join(collected))
    json.dump(state, open(STATE, "w"), indent=1)
    sys.stderr.write("finished; %d skipped forms\n" % len(skip))
    return 0


if __name__ == "__main__":
    sys.exit(main())
