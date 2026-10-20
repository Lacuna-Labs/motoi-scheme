#!/usr/bin/env python3
"""Score the Larceny run. Verdicts come from Larceny's own `same-result?`
(which already handles its approx / multiple-results / alts semantics), so
no extra tolerance is applied here."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from run_larceny import build_forms, TARGETS  # noqa: E402


def parse(path):
    recs = []
    form = None
    lines = open(path, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("@@F "):
            form = int(ln[4:])
        elif ln.startswith("@@T "):
            expr = ln[4:]
            x = a = r = None
            for j in range(i + 1, min(i + 6, len(lines))):
                if lines[j].startswith("@@X "):
                    x = lines[j][4:]
                elif lines[j].startswith("@@A "):
                    a = lines[j][4:]
                elif lines[j].startswith("@@R "):
                    r = lines[j][4:].strip()
                    i = j
                    break
            if r is None:
                i += 1
                continue

            def sv(s):
                if s is None:
                    return ("missing", "")
                k, _, v = s.partition(" ")
                return (k, v)
            xk, xv = sv(x)
            ak, av = sv(a)
            recs.append({"form": form, "expr": expr, "exp": xv, "act": av,
                         "pass": r == "PASS"})
        i += 1
    return recs


def main():
    _, suites, notes = build_forms()
    state = json.load(open(os.path.join(HERE, "larceny-state.json")))
    out = {"notes": notes, "suites": {}}
    tp = tf = td = 0
    print("%-14s %6s %6s %6s %8s" % ("suite", "exec", "pass", "fail", "dropped"))
    for name in TARGETS:
        path = os.path.join(HERE, "larceny-raw-%s.txt" % name)
        if not os.path.exists(path):
            continue
        recs = parse(path)
        forms = suites[name]
        for r in recs:
            if r["form"] is not None and r["form"] < len(forms):
                r["source"] = " ".join(forms[r["form"]].split())
        np = sum(1 for r in recs if r["pass"])
        dropped = state["suites"][name]["dropped"]
        for d in dropped:
            d["source"] = " ".join(d["text"].split())
        out["suites"][name] = {"records": recs, "dropped": dropped}
        tp += np
        tf += len(recs) - np
        td += len(dropped)
        print("%-14s %6d %6d %6d %8d" % (name, len(recs), np, len(recs) - np,
                                         len(dropped)))
    print("%-14s %6d %6d %6d %8d" % ("TOTAL", tp + tf, tp, tf, td))
    json.dump(out, open(os.path.join(HERE, "larceny-scored.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
