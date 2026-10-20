#!/usr/bin/env python3
"""Bucket every failure by ROOT CAUSE and assign the (a)/(b)/(c) category.

Rules are ordered; the first match wins.  Anything that matches nothing is
printed to stderr as UNCLASSIFIED so it can never be silently defaulted into
a flattering bucket.  Emits the itemized sections of RESULTS-2026-08-02.md.
"""
import json
import os
import re
import sys
import collections

HERE = os.path.dirname(os.path.abspath(__file__))

# (bucket-id, category, one-line root cause)
BUCKETS = {
 "READ-RADIX":  ("a", "reader does not implement radix/exactness prefixes (#x #o #b #d #e #i)"),
 "READ-BARSYM": ("a", "reader does not implement |vertical bar| symbol syntax"),
 "READ-STRESC": ("a", "reader silently drops string escapes (\\a \\b \\xHH; \\<newline> continuation)"),
 "READ-BOOL":   ("a", "reader does not accept the long boolean spellings #true / #false"),
 "READ-DCOMM":  ("a", "`read` does not implement #; datum comments"),
 "READ-BCOMM":  ("a", "`read` does not implement #| |# block comments"),
 "READ-LABEL":  ("b", "datum labels #n= / #n# unimplemented"),
 "READ-FOLD":   ("b", "#!fold-case / #!no-fold-case directives unimplemented"),
 "READ-CHARNAME": ("a", "reader mis-reads some named/hex character literals"),
 "TOWER-COMPLEX": ("c", "optional complex tower (R7RS-small permits a subset) - NOT counted against Motoi"),
 "TOWER-RATIO": ("b", "exact rationals unimplemented (R7RS-small permits a subset); ratios collapse to flonums"),
 "TOWER-BIGNUM": ("b", "bignums unimplemented (R7RS-small permits a subset)"),
 "NUM-EXACTNESS": ("a", "exactness is not tracked: exact?/inexact?/exact-integer? answer by integrality, not representation"),
 "NUM-IEEE":    ("a", "inexact division by inexact zero raises instead of yielding +-inf.0 / +nan.0"),
 "NUM-DIVEXACT0": ("c", "R7RS-small says `(/ x 0)` with an EXACT zero divisor `is an error`; Larceny's +-inf.0 is an extension"),
 "NUM-PRECISION": ("a", "flonum printing does not round-trip subnormals"),
 "NUM-MISC":    ("a", "numeric result diverges from R7RS"),
 "MACRO-HYGIENE": ("a", "syntax-rules hygiene / referential transparency defect"),
 "MACRO-ELLIPSIS": ("b", "custom ellipsis `(syntax-rules E () ...)` and the `(... ...)` escape unimplemented"),
 "MACRO-PATTERN": ("a", "syntax-rules pattern matching defect (dotted tails, _, literals)"),
 "QUASIQUOTE":  ("a", "quasiquote defect (vectors, multi-operand unquote, nesting)"),
 "UNBOUND":     ("b", "required R7RS-small binding is absent"),
 "MUTABLE-STR": ("b", "strings are immutable; string-set!/-fill!/-copy! absent"),
 "EQV-MUT":     ("a", "eqv? conflates distinct freshly-allocated mutable objects"),
 "CONT":        ("b", "re-entrant continuations / dynamic-wind re-entry unsupported"),
 "EXN":         ("a", "exception-system semantics diverge (raise-continuable, guard re-raise, file-error?)"),
 "IMPROPER":    ("a", "improper / circular list handling diverges"),
 "RANGE-ARG":   ("a", "optional start/end arguments ignored"),
 "UNICODE":     ("a", "Unicode case/character handling diverges"),
 "PORT":        ("b", "port procedure absent or diverges"),
 "ENVEVAL":     ("b", "(scheme eval) environment procedures absent"),
 "FILE":        ("b", "(scheme file) absent - Motoi has no file I/O"),
 "HARNESS":     ("c", "measurement artifact - the assertion's subject behaved correctly"),
 "READ-EXPMARK": ("a", "reader does not accept the s/f/d/l exponent markers"),
 "READ-INFNAN": ("a", "reader does not accept +inf.0/+nan.0 case-insensitively"),
 "WRITE-FLONUM": ("a", "`write` prints an integral flonum without its decimal point (1.0 -> \"1\"), so output does not round-trip"),
 "DEFVALUES":   ("a", "define-values / let-values reject a dotted (rest-arg) formals list"),
 "DELAY":       ("a", "force on a self-referential promise does not yield the memoized value"),
 "INCLUDE":     ("b", "`include` / `include-ci` unimplemented (R7RS-small 5.7)"),
 "BV-READER":   ("a", "the #u8 reader silently substitutes 0 for an element it cannot parse and wraps out-of-range ones"),
}

UNBOUND_RE = re.compile(r"unbound symbol: ([^\s]+)")

MUTSTR = ("string-set!", "string-fill!", "string-copy!")
PORTP = ("read-bytevector", "read-bytevector!", "write-bytevector", "write-string",
         "read-line", "flush-output-port", "call-with-port", "write-shared",
         "write-simple", "char-ready?", "u8-ready?", "peek-u8", "read-u8", "write-u8")
FILEP = ("file-exists?", "delete-file", "open-input-file", "open-output-file",
         "call-with-input-file", "call-with-output-file", "with-input-from-file",
         "with-output-to-file", "open-binary-input-file", "open-binary-output-file")
ENVP = ("environment", "null-environment", "scheme-report-environment", "interaction-environment", "eval")
TOWERP = ("make-polar", "angle", "magnitude", "real-part", "imag-part")


def classify(src, exp, act):
    """src = source text of the assertion, exp/act = rendered expected/actual."""
    s = src
    blob = s + " " + exp + " " + act

    if "@@T" in act or "@@R" in act:
        return "HARNESS"

    if "#u8(#x" in s or "#u8(0 #x" in s:
        # verified by direct probe: '#u8(#x41) reads as #u8(0), '#u8(300) as
        # #u8(44).  utf8->string / string->utf8 themselves are correct.
        return "BV-READER"

    # --- forms that depend on a dropped/unimplemented top-level construct ---
    if s.strip() in ("(test (fact 6) 720)", "(test (fib 10) 55)",
                     "(test bd578d6d 319)"):
        return "INCLUDE"          # defined only inside (include "...") files
    if "elli-esc" in s or "sequence2" in s or "sequence3" in s:
        # sequence2 needs the (... tmpl) ellipsis escape, sequence3 a custom
        # ellipsis; both DEFINITIONS were rejected, so the use site is unbound
        return "MACRO-ELLIPSIS"
    if re.search(r"\(\(a b \. c\)|define-values \(x y \. z\)|\(a b \. c\) \(values", s):
        return "DEFVALUES"
    if "test-write-syntax" in s and "|" in s:
        return "READ-BARSYM"
    if "1+2I" in s:
        return "TOWER-COMPLEX"
    if "#e1e10" in s or "#e3.0" in s:
        return "READ-RADIX"
    if "guard' should jump back in" in s or "(assq 'a condition) =>" in s:
        return "EXN"
    if "(sqrt -1" in s or "0.0+1.0i" in s:
        return "TOWER-COMPLEX"
    if "(list-ref '(a b c . d)" in s:
        return "IMPROPER"
    if "(set-cdr! x x) (write x out)" in s:
        return "IMPROPER"
    if ",(foo ,(+ 1 3) d)" in s:
        return "QUASIQUOTE"
    if "(force p)" in s:
        return "DELAY"
    if "define-values" in s and (". z)" in s or ". y)" in s):
        return "DEFVALUES"
    if "test-numeric-syntax" in s or "test-write-syntax" in s:
        # the macro reads STR, compares the value, then compares `write` output
        m2 = re.match(r'\(test-numeric-syntax "([^"]*)"', s)
        lit = m2.group(1) if m2 else ""
        if re.match(r"^[-+]?[0-9.]+[sSfFdDlL][-+]?[0-9]", lit):
            return "READ-EXPMARK"
        if re.search(r"(?i)^[-+](inf|nan)\.0$", lit) and lit not in ("+inf.0", "-inf.0", "+nan.0"):
            return "READ-INFNAN"
        if lit.startswith("#") or "#" in lit:
            return "TOWER-COMPLEX" if lit.rstrip().endswith("i") else "READ-RADIX"
        if lit.rstrip().endswith("i"):
            return "TOWER-COMPLEX"
        if exp == "#t" and act == "#f":
            return "WRITE-FLONUM"
        return "NUM-MISC"

    # --- reader-level, decided on what text the reader was handed ----------
    if re.search(r'"#[eibodx]', s) or re.search(r"#[eibodx]#?[eibodx]?[-+0-9a-fA-F]", exp) \
       or re.search(r"unbound symbol: #[eibodx]?[0-9xXbBoOdD]", exp):
        # radix/exactness prefix, either inside a string handed to `read`
        # or written literally in the expectation
        if "i" in s and re.search(r'"[^"]*[0-9]i"', s):
            return "TOWER-COMPLEX"
        return "READ-RADIX"
    if "make-rectangular" in s or re.search(r'"[-+0-9./]*[-+][0-9./]*i"', s) \
       or "make-polar" in s or act.rstrip().endswith("i") and "+" in act:
        return "TOWER-COMPLEX"
    if "#true" in blob or "#false" in blob or "#TRUE" in blob or "#tRuE" in blob:
        return "READ-BOOL"
    if "|" in s and ("string->symbol" in s or "'|" in s or '"|' in s or "#\\|" in s):
        return "READ-BARSYM"
    if "#;" in s or "#\\;" in s:
        return "READ-DCOMM"
    if "#|" in s:
        return "READ-BCOMM"
    if "fold-case" in s:
        return "READ-FOLD"
    if re.search(r"#\d+=", blob) or re.search(r"#\d+#", blob):
        return "READ-LABEL"
    if re.search(r'\\\\[abtnrx0-9]', s) or re.search(r'\\\\\\n', s) or "\\\\x" in s:
        return "READ-STRESC"
    if "write-then-read" in s or "read-from-string" in s or "write-datum" in s or "write-data" in s:
        return "READ-BARSYM"   # every survivor here round-trips a bar-symbol/escape
    if "read-data" in s or "read-datum" in s:
        return "READ-STRESC"

    m = UNBOUND_RE.search(act)
    if m:
        name = m.group(1)
        if name in MUTSTR:
            return "MUTABLE-STR"
        if name in FILEP:
            return "FILE"
        if name in ENVP:
            return "ENVEVAL"
        if name in PORTP:
            return "PORT"
        if name in TOWERP or name in ("asin", "acos"):
            return "TOWER-COMPLEX" if name in TOWERP else "UNBOUND"
        return "UNBOUND"
    for name in MUTSTR:
        if name in s:
            return "MUTABLE-STR"
    for name in FILEP:
        if name in s:
            return "FILE"
    for name in PORTP:
        if name in s:
            return "PORT"

    # --- macros / hygiene --------------------------------------------------
    if "syntax-rules" in s or "let-syntax" in s or "letrec-syntax" in s \
       or "be-like-begin" in s or "-as-literal" in s or "define-syntax" in s:
        if "..." in s and ("::: " in s or "syntax-rules ..." in s or "(... ...)" in s):
            return "MACRO-ELLIPSIS"
        if "bound-identifier" in s or "outer" in s or "inner" in s or "free-identifier" in s:
            return "MACRO-HYGIENE"
        if "-as-literal" in s or "part-" in s or "count-to-" in s:
            return "MACRO-PATTERN"
        return "MACRO-HYGIENE"
    if "cond (#t =>" in s.replace("  ", " ") or "(let ((=> #f))" in s:
        return "MACRO-HYGIENE"

    if "quasiquote" in s or "`" in s or ",@" in s:
        return "QUASIQUOTE"

    # --- residue, each hand-checked against the suite source ---------------
    RESIDUE = {
        "(test 1800/497 c)": "TOWER-RATIO",
        "(test 3/20 (/ 3 4 5))": "TOWER-RATIO",
        "(test 1 x)": "MACRO-HYGIENE",          # internal define must shadow outer define-syntax
        "(test 'x (bar 1))": "MACRO-HYGIENE",   # ditto, macro-generated define
        "(test 'bound-identifier=? (m k))": "MACRO-HYGIENE",
        "(test 'caught-another-exception (test-exception-handler-2 -1))": "EXN",
        "(test 65 value)": "EXN",               # raise-continuable does not resume
        "(test (real? -2.5+0.0i) #f)": "TOWER-COMPLEX",
        "(test (real? -2.5+0i) #t)": "TOWER-COMPLEX",
        "(test (real? #e1e10) #t)": "READ-RADIX",
    }
    if s.strip() in RESIDUE:
        return RESIDUE[s.strip()]
    if re.match(r"\(test #\\\\?x10F70", s) or "c0)" in s and "#\\x10F700" in s:
        return "UNICODE"
    if re.search(r"#\\x10F70", s):
        return "UNICODE"
    if "line 1continued" in s or "line 3" in s:
        return "READ-STRESC"

    # --- numerics ----------------------------------------------------------
    if re.search(r"\(/ 1\.0 0\)|\(/ 0\.0 0\)", s):
        return "NUM-DIVEXACT0"
    if re.search(r"\(/ (0\.0|-1 0\.0|0 0\.0|0\.0 0\.0)\)", s):
        return "NUM-IEEE"
    if "exact?" in s or "inexact?" in s or "exact-integer?" in s or "(inexact " in s \
       or "(exact " in s:
        return "NUM-EXACTNESS"
    if "numerator" in s or "denominator" in s or "rationalize" in s or "/" in s and "1/3" in exp:
        return "TOWER-RATIO"
    if "exact-integer-sqrt" in s or "9007199254740993" in s or "expt 2 1" in s:
        return "TOWER-BIGNUM"
    if "test-precision" in s:
        return "NUM-PRECISION"

    # --- runtime semantics -------------------------------------------------
    if "raise-continuable" in s or "with-exception-handler" in s or "guard" in s \
       or "file-error?" in s or "error-object" in s or "raise" in s:
        return "EXN"
    if "call-with-current-continuation" in s or "call/cc" in s or "dynamic-wind" in s:
        return "CONT"
    if "set-cdr!" in s or "set-car!" in s or "list-tail" in s or "list-ref" in s \
       or "(list? " in s or ". c)" in s or ". d)" in s:
        return "IMPROPER"
    if "vector->list" in s or "vector-copy!" in s or "vector-fill!" in s \
       or "string->list" in s:
        return "RANGE-ARG"
    if "char-" in s or "digit-value" in s or "integer->char" in s or "string-downcase" in s \
       or "string-upcase" in s or "string-foldcase" in s or "char->integer" in s:
        return "UNICODE"
    if "(eqv? " in s and ("make-string" in s or "(string " in s or "string-copy" in s):
        return "EQV-MUT"
    if "(eq? " in s and "string-copy" in s:
        return "EQV-MUT"
    if "utf8->string" in s or "string->utf8" in s:
        return "UNICODE"
    return None


def main():
    out = []
    unclassified = []
    tally = collections.Counter()
    items = collections.defaultdict(list)

    d = json.load(open(os.path.join(HERE, "scored.json")))
    for r in d["records"]:
        if r["chibi"]:
            continue
        src = r.get("source", r["expr"])
        b = classify(src, r["exp"], r["act"])
        rec = ("chibi", r["group"], r.get("src_line"), src, r["exp"], r["act"])
        if b is None:
            unclassified.append(rec)
        else:
            tally[b] += 1
            items[b].append(rec)

    dl = json.load(open(os.path.join(HERE, "larceny-scored.json")))
    SMALL = ["base.sld", "char.sld", "read.sld", "write.sld", "inexact.sld"]
    for n in SMALL:
        for r in dl["suites"][n]["records"]:
            if r["pass"]:
                continue
            src = r.get("source", r["expr"])
            b = classify(src, r["exp"], r["act"])
            rec = ("larceny/" + n, n, None, src, r["exp"], r["act"])
            if b is None:
                unclassified.append(rec)
            else:
                tally[b] += 1
                items[b].append(rec)

    sys.stderr.write("UNCLASSIFIED: %d\n" % len(unclassified))
    for u in unclassified[:400]:
        sys.stderr.write("  %s | %s | exp=%s | got=%s\n"
                         % (u[0], u[3][:110], u[4][:40], u[5][:60]))

    cat = collections.Counter()
    for b, n in tally.items():
        cat[BUCKETS[b][0]] += n
    print("== bucket tally ==")
    for b, n in tally.most_common():
        print("%-16s %-3s %4d  %s" % (b, BUCKETS[b][0], n, BUCKETS[b][1]))
    print("== category tally ==")
    for c in "abc":
        print(c, cat[c])
    print("unclassified", len(unclassified))

    json.dump({"items": {k: v for k, v in items.items()},
               "unclassified": unclassified,
               "buckets": BUCKETS},
              open(os.path.join(HERE, "classified.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
