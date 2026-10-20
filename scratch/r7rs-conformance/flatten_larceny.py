#!/usr/bin/env python3
"""Flatten a Larceny R7RS test library (.sld) into plain top-level forms.

Larceny's suite is packaged as `(define-library (tests scheme X) ...)` with
`export` / `import` / `cond-expand` / `include` and puts every assertion inside
a single `(define (run-X-tests) ...)` procedure.  Motoi has none of
define-library, import, or include, so we mechanically:

  * drop export/import forms,
  * resolve cond-expand by keeping only clause bodies that are NOT imports
    (recording the choice),
  * drop `include` / `include-ci` (recorded: those tests cannot run),
  * splice `begin` bodies to top level,
  * lift the body of `(define (run-X-tests) ...)` to top level so each
    assertion is an independently droppable form.

Lifting an internal body to top level is a real (small) semantic change:
internal defines become globals.  It is recorded and reported.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sexp_split import read_datum, split_forms  # noqa: E402


def children(src, s, e):
    """Children of the list form occupying src[s:e]."""
    assert src[s] == "("
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
        if src.startswith("#|", i):
            depth, k = 1, i + 2
            while k < e and depth:
                if src.startswith("#|", k):
                    depth += 1; k += 2
                elif src.startswith("|#", k):
                    depth -= 1; k += 2
                else:
                    k += 1
            i = k
            continue
        if c == ")":
            break
        j = read_datum(src, i)
        if j is None or j <= i:
            break
        out.append((i, j))
        i = j
    return out


def head(text):
    t = text.lstrip()
    if not t.startswith("("):
        return None
    body = t[1:].lstrip()
    k = 0
    while k < len(body) and body[k] not in " \t\n\r\f()":
        k += 1
    return body[:k]


def norm(t):
    return " ".join(t.split())


# Which R7RS libraries / feature identifiers Motoi actually provides.
# Verified by direct probe (see RESULTS doc); anything unlisted is False.
FEATURES = {
    "(library (scheme base))": True,
    "(library (scheme char))": True,
    "(library (scheme write))": True,
    "(library (scheme read))": True,
    "(library (scheme inexact))": True,
    "(library (scheme complex))": True,
    "(library (scheme lazy))": True,
    "(library (scheme time))": True,
    "(library (scheme cxr))": True,
    "(library (scheme case-lambda))": True,
    "(library (scheme file))": False,
    "(library (scheme eval))": False,
    "(library (scheme repl))": False,
    "(library (scheme process-context))": False,
    "(library (scheme load))": False,
    "(library (scheme r5rs))": False,
    "full-unicode": True,
    "r7rs": True,
    "exact-closed": True,
    "ratios": True,
    "else": True,
}


def feature_present(t):
    t = norm(t)
    if t in FEATURES:
        return FEATURES[t]
    if t.startswith("(not "):
        return not feature_present(t[5:-1])
    if t.startswith("(and "):
        return all(feature_present(x) for x in _split_top(t[5:-1]))
    if t.startswith("(or "):
        return any(feature_present(x) for x in _split_top(t[4:-1]))
    return False


def _split_top(t):
    out = []
    i = 0
    while i < len(t):
        if t[i] in " \t\n\r\f":
            i += 1
            continue
        j = read_datum(t, i)
        if j is None or j <= i:
            break
        out.append(t[i:j])
        i = j
    return out


def flatten(path, notes):
    src = open(path, encoding="utf-8").read()
    tops = split_forms(src)
    lib = None
    for s, e, ln in tops:
        if head(src[s:e]) == "define-library":
            lib = (s, e)
            break
    if lib is None:
        raise SystemExit("no define-library in " + path)

    out = []

    def emit(text):
        """Append a form, splicing top-level `begin` bodies."""
        if head(text) in ("include", "include-ci"):
            notes.append(("dropped-include", os.path.basename(path), norm(text)))
            return
        if head(text) == "begin":
            for a, b in children(text, 0, len(text))[1:]:
                out.append(text[a:b])
        else:
            out.append(text)

    def walk(s, e, depth=0):
        # children()[0] is `define-library`, [1] is the library name
        for cs, ce in children(src, s, e)[2:]:
            t = src[cs:ce]
            h = head(t)
            if h in ("export", "import"):
                continue
            if h in ("include", "include-ci"):
                notes.append(("dropped-include", os.path.basename(path), t.strip()))
                continue
            if h == "cond-expand":
                for clause_s, clause_e in children(src, cs, ce)[1:]:
                    cl = children(src, clause_s, clause_e)
                    if not cl:
                        continue
                    cond_txt = src[cl[0][0]:cl[0][1]]
                    if not feature_present(cond_txt):
                        continue
                    notes.append(("cond-expand-taken", os.path.basename(path),
                                  norm(cond_txt)[:90]))
                    for a, b in cl[1:]:
                        body = src[a:b]
                        if head(body) in ("import", "export"):
                            continue
                        if head(body) in ("include", "include-ci"):
                            notes.append(("dropped-include", os.path.basename(path),
                                          norm(body)))
                            continue
                        emit(body)
                    break
                continue
            emit(t)

    walk(*lib)
    return out


def lift_run_body(forms, notes, fname):
    """Replace `(define (run-X-tests) BODY...)` with its BODY forms."""
    res = []
    for t in forms:
        h = head(t)
        if h == "define":
            kids = children(t, 0, len(t))
            if len(kids) >= 2:
                sig = t[kids[1][0]:kids[1][1]]
                if sig.startswith("(") and "-tests" in sig and sig.count("(") == 1:
                    notes.append(("lifted-body", fname, sig.strip()))
                    for a, b in kids[2:]:
                        res.append(t[a:b])
                    continue
        res.append(t)
    return res


if __name__ == "__main__":
    notes = []
    fs = flatten(sys.argv[1], notes)
    fs = lift_run_body(fs, notes, os.path.basename(sys.argv[1]))
    print("forms:", len(fs))
    for n in notes:
        print("NOTE", n)
    for t in fs[:8]:
        print("---", t[:100].replace("\n", " "))
