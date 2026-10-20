#!/usr/bin/env python3
"""Score raw-output.txt from the Motoi/Chibi conformance run.

Applies Chibi's own comparison semantics (lib/chibi/test.scm test-equal?):
  equal?  OR  (expected is an inexact real AND result is real
               AND relative difference < current-test-epsilon = 1e-5)
so that Motoi is judged the same way Chibi judges itself.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sexp_split import split_forms, read_datum  # noqa: E402

TEST_HEADS = ("test", "test-values", "test-error", "test-assert", "test-not",
              "test-numeric-syntax", "test-write-syntax", "test-precision",
              "test-read-error", "test-round-trip")


def sub_datums(src, s, e):
    """Spans of the children of the list form src[s:e]."""
    out = []
    i = s + 1
    while i < e - 1:
        c = src[i]
        if c in " \t\n\r\f":
            i += 1
            continue
        if c == ";":
            nl = src.find("\n", i)
            i = e - 1 if nl < 0 else nl
            continue
        if c == ")":
            break
        j = read_datum(src, i)
        if j is None or j <= i:
            break
        out.append((i, j))
        i = j
    return out


def find_tests(src, s, e, acc):
    """Collect spans of test-family calls inside src[s:e], in source order."""
    if src[s] != "(":
        return
    kids = sub_datums(src, s, e)
    if kids:
        h = src[kids[0][0]:kids[0][1]]
        if h in TEST_HEADS:
            acc.append((s, e))
            return
    for a, b in kids:
        if src[a] == "(":
            find_tests(src, a, b, acc)

EPS = 1e-5

NUM = re.compile(r"^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$")
RAT = re.compile(r"^([+-]?\d+)/(\d+)$")


def parse_num(s):
    s = s.strip()
    if s in ("+inf.0", "+Inf.0"):
        return float("inf"), False
    if s in ("-inf.0", "-Inf.0"):
        return float("-inf"), False
    if s in ("+nan.0", "-nan.0", "+NaN.0"):
        return float("nan"), False
    m = RAT.match(s)
    if m:
        return int(m.group(1)) / int(m.group(2)), True
    if NUM.match(s):
        exact = ("." not in s and "e" not in s and "E" not in s)
        try:
            return (int(s) if exact else float(s)), exact
        except ValueError:
            return None, None
    return None, None


def approx_equal(a, b, eps):
    if abs(a) > abs(b):
        a, b = b, a
    if a == 0:
        return abs(b) < eps
    if b == 0:
        return False
    try:
        return abs((a - b) / b) < eps
    except (ZeroDivisionError, OverflowError):
        return False


def chibi_equal(exp_s, act_s):
    """exp_s/act_s are `write` renderings. Returns True if chibi would pass."""
    if exp_s == act_s:
        return True
    ev, e_exact = parse_num(exp_s)
    av, a_exact = parse_num(act_s)
    if ev is None or av is None:
        return False
    # chibi only relaxes when the EXPECTED value is inexact
    if e_exact:
        return False
    if ev != ev or av != av:            # NaN
        return ev != ev and av != av
    return approx_equal(ev, av, EPS)


def main():
    out = open(os.path.join(HERE, "raw-output.txt"), encoding="utf-8").read()
    lines = out.split("\n")
    recs = []
    group, form = "(none)", None
    groups = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("@@G "):
            name = ln[4:].strip().strip('"')
            groups.append(name)
            group = name
        elif ln.startswith("@@F "):
            form = int(ln[4:].strip())
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
            def split_v(s):
                if s is None:
                    return ("missing", "")
                k, _, v = s.partition(" ")
                return (k, v)
            xk, xv = split_v(x)
            ak, av = split_v(a)
            strict = (r == "PASS")
            if strict:
                chibi = True
            elif xk == "ok" and ak == "ok":
                chibi = chibi_equal(xv, av)
            else:
                chibi = False
            recs.append({"group": group, "form": form, "expr": expr,
                         "exp_kind": xk, "exp": xv, "act_kind": ak, "act": av,
                         "strict": strict, "chibi": chibi})
        i += 1

    st = json.load(open(os.path.join(HERE, "state3.json")))
    src = open(os.path.join(HERE, "chibi-r7rs-tests.scm"), encoding="utf-8").read()
    forms = split_forms(src)

    # Motoi's `write` is lossy (it renders the flonum 32.0 as "32"), so the
    # @@T echo cannot be trusted as the test's identity.  Recover the exact
    # source text of each assertion instead.
    by_form = {}
    for r in recs:
        by_form.setdefault(r["form"], []).append(r)
    for n, rs in by_form.items():
        if n is None or n >= len(forms):
            continue
        s, e, ln = forms[n]
        acc = []
        find_tests(src, s, e, acc)
        if len(acc) == len(rs):
            for r, (a, b) in zip(rs, acc):
                r["source"] = " ".join(src[a:b].split())
                r["src_line"] = src.count("\n", 0, a) + 1
        else:
            for r in rs:
                r["source"] = " ".join(src[s:e].split())
                r["src_line"] = ln
                r["source_approx"] = True

    def count_assertions(text):
        return len(re.findall(r"\((test|test-values|test-error|test-assert|"
                              r"test-not|test-numeric-syntax|test-write-syntax|"
                              r"test-precision|test-read-error)[\s)]", text))

    dropped = []
    for d in st["skipped"]:
        n = d["form"]
        txt = src[forms[n][0]:forms[n][1]]
        dropped.append(dict(d, full_text=txt, assertions=count_assertions(txt)))

    json.dump({"records": recs, "dropped": dropped},
              open(os.path.join(HERE, "scored.json"), "w"), indent=1)

    npass = sum(1 for r in recs if r["chibi"])
    nstrict = sum(1 for r in recs if r["strict"])
    print("assertions executed : %d" % len(recs))
    print("pass (chibi rules)  : %d" % npass)
    print("fail (chibi rules)  : %d" % (len(recs) - npass))
    print("pass (strict equal?): %d" % nstrict)
    print("dropped forms       : %d  (assertions inside: %d)"
          % (len(dropped), sum(d["assertions"] for d in dropped)))


if __name__ == "__main__":
    main()
