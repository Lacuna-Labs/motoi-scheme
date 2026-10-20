#!/usr/bin/env python3
"""Re-run each dropped form in isolation (with the prelude and, where needed,
its prerequisite definitions) to capture the ACTUAL error it produces, rather
than the error left over from the last whole-file run."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from sexp_split import split_forms  # noqa: E402

ENV = dict(os.environ, MOTOI_HOME="/tmp/dijkstra")
FUEL = "2000000000"
SRC = open(os.path.join(HERE, "chibi-r7rs-tests.scm"), encoding="utf-8").read()
FORMS = split_forms(SRC)
PRELUDE = open(os.path.join(HERE, "prelude.scm"), encoding="utf-8").read()
TMP = os.path.join(HERE, "gen-one.scm")


def run_text(text):
    open(TMP, "w", encoding="utf-8").write(text)
    p = subprocess.run(["./bin/motoi", "run", os.path.relpath(TMP, REPO),
                        "--fuel", FUEL], cwd=REPO, env=ENV,
                       capture_output=True, text=True, timeout=120)
    return p.stdout, p.stderr


def main():
    st = json.load(open(os.path.join(HERE, "state3.json")))
    out = []
    for d in st["skipped"]:
        n = d["form"]
        # include all preceding non-test forms so definitions the form needs
        # are present, then the form itself
        pre = []
        for m in range(n):
            t = SRC[FORMS[m][0]:FORMS[m][1]]
            ls = t.lstrip()
            if ls.startswith("(import"):
                continue
            if ls.startswith("(test") or ls.startswith("(let ") or ls.startswith("(let("):
                continue
            pre.append(t)
        target = SRC[FORMS[n][0]:FORMS[n][1]]
        # 1) form alone (isolates reader-level problems)
        so, se = run_text(PRELUDE + "\n" + target + "\n")
        alone = se.strip().split("\n")[-1] if se.strip() else "(no error alone)"
        # 2) form with preceding context (isolates macro/definition problems)
        so2, se2 = run_text(PRELUDE + "\n" + "\n".join(pre) + "\n" + target + "\n")
        withctx = se2.strip().split("\n")[-1] if se2.strip() else "(no error with context)"
        out.append({"form": n, "line": FORMS[n][2], "kind": d["kind"],
                    "text": " ".join(target.split()),
                    "error_alone": alone, "error_with_context": withctx})
        print("L%-6s %s" % (FORMS[n][2], " ".join(target.split())[:90]))
        print("   alone       : %s" % alone[:150])
        print("   with context: %s" % withctx[:150])
    json.dump(out, open(os.path.join(HERE, "dropped-diagnosis.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
