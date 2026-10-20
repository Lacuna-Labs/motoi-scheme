#!/usr/bin/env python3
"""Drive Chibi's r7rs-tests.scm through Motoi and score it.

Strategy: emit prelude + every top-level form of the suite (minus the
`import`) into one file, with an `@@F n` marker printed before each form.
Run it.  If the process dies, the last `@@F n` seen identifies the killer
form; add it to the skip set and re-run.  Repeat until the file completes.
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
ENV = dict(os.environ, MOTOI_HOME="/tmp/dijkstra")


def build(forms, src, skip):
    """Return (text, linemap) where linemap[genline] -> form index."""
    out = [open(PRELUDE, encoding="utf-8").read()]
    out.append('\n(display "\\n@@START\\n")\n')
    linemap = {}
    cur = "".join(out).count("\n") + 1
    for n, (s, e, ln) in enumerate(forms):
        if n in skip:
            continue
        text = src[s:e]
        if text.lstrip().startswith("(import"):
            continue
        chunk = '(display "\\n@@F %d %d\\n")\n' % (n, ln) + text + "\n"
        for k in range(chunk.count("\n") + 1):
            linemap[cur + k] = n
        cur += chunk.count("\n")
        out.append(chunk)
    out.append('(display "\\n@@DONE\\n")\n')
    return "".join(out), linemap


def run(text, timeout=300):
    with open(GEN, "w", encoding="utf-8") as f:
        f.write(text)
    try:
        p = subprocess.run(
            ["./bin/motoi", "run", os.path.relpath(GEN, REPO)],
            cwd=REPO, env=ENV, capture_output=True, text=True, timeout=timeout,
        )
        return p.returncode, p.stdout, p.stderr, False
    except subprocess.TimeoutExpired as ex:
        return -9, (ex.stdout or b"").decode("utf-8", "replace") if isinstance(ex.stdout, bytes) else (ex.stdout or ""), \
               (ex.stderr or b"").decode("utf-8", "replace") if isinstance(ex.stderr, bytes) else (ex.stderr or ""), True


def main():
    src = open(SRC, encoding="utf-8").read()
    forms = split_forms(src)
    skip = set()
    dead = []
    for attempt in range(400):
        text, linemap = build(forms, src, skip)
        rc, out, err, timedout = run(text)
        done = "@@DONE" in out
        last_f = None
        for m in re.finditer(r"^@@F (\d+) (\d+)$", out, re.M):
            last_f = (int(m.group(1)), int(m.group(2)))
        started = "@@START" in out
        print("attempt %d: rc=%s done=%s timeout=%s last_form=%s skipped=%d"
              % (attempt, rc, done, timedout, last_f, len(skip)), file=sys.stderr)
        if done:
            open(os.path.join(HERE, "raw-output.txt"), "w", encoding="utf-8").write(out)
            open(os.path.join(HERE, "raw-stderr.txt"), "w", encoding="utf-8").write(err)
            json.dump({"skipped": dead}, open(os.path.join(HERE, "skipped.json"), "w"), indent=1)
            print("COMPLETED with %d skipped forms" % len(skip), file=sys.stderr)
            return 0
        if not started:
            # Reader-level failure: Motoi parses the whole file before
            # evaluating any of it, so one bad datum kills everything.
            # Map the reported line back to a form and skip that form.
            m = re.search(r"line (\d+)", err)
            if not m:
                open(os.path.join(HERE, "raw-stderr.txt"), "w", encoding="utf-8").write(err)
                print("FILE-LEVEL FAILURE, unparseable stderr:\n" + err[:4000], file=sys.stderr)
                return 1
            gl = int(m.group(1))
            n = linemap.get(gl)
            if n is None:
                for d in range(1, 12):
                    n = linemap.get(gl - d) or linemap.get(gl + d)
                    if n is not None:
                        break
            if n is None or n in skip:
                print("cannot map reader error line %d; stderr: %s" % (gl, err[:1000]),
                      file=sys.stderr)
                return 1
            dead.append({"form": n, "line": forms[n][2], "kind": "read-error",
                         "stderr_tail": err.strip()[-800:],
                         "text": src[forms[n][0]:forms[n][1]][:600]})
            skip.add(n)
            continue
        if last_f is None:
            print("no form marker seen; stderr:\n" + err[:2000], file=sys.stderr)
            return 1
        n, ln = last_f
        dead.append({"form": n, "line": ln, "kind": "timeout" if timedout else "crash",
                     "stderr_tail": err.strip()[-1500:],
                     "text": src[forms[n][0]:forms[n][1]][:600]})
        skip.add(n)
    print("gave up after 400 attempts", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
