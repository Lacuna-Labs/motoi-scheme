#!/usr/bin/env python3
"""Eval harness for scheme-books/. Extract every fenced scheme/motoi block,
run it through ./bin/motoi run, classify + group failures by reason and book.

Two tiers:
  MARKED  — blocks whose closing fence sits within ~200 chars of a
            'BUILD: runnable' marker. These are authored-as-runnable => must pass.
  ALL     — every fenced scheme/motoi/racket/lisp/clojure block (coverage).

x-dialect dirs (book-of-jesse, -language-ancestors, -limits, broken-examples)
carry intentionally-non-base code; their failures are EXPECTED, not regressions.
"""
import re, subprocess, sys, json
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/alfred/code/motoi-scheme")
BIN  = ROOT / "bin" / "motoi"
BOOKS = ROOT / "scheme-books"

FENCE = re.compile(r'```(?:scheme|motoi|racket|clojure|lisp)?\n(.*?)```', re.DOTALL)
BUILD = re.compile(r'BUILD:\s*runnable')
XDIALECT = ('book-of-jesse', 'book-of-language-ancestors', 'book-of-limits', 'broken-examples')
BANNED_FOLD = ('foldl', 'foldr', 'fold-left')

def looks_runnable(code):
    s = code.strip()
    if not s or '(' not in s:
        return False
    first = next((l for l in s.splitlines() if l.strip()), "")
    if re.match(r'^\s*(npm|node|\$|#|curl|cd |ls |git |\.\.\.|;;;\s*\.\.\.)', first):
        return False
    # skip blocks that are obviously elided fragments
    if '...' in s and s.count('(') != s.count(')'):
        return False
    return True

def run(code):
    try:
        p = subprocess.run([str(BIN), "run", "/dev/stdin"], input=code,
                           capture_output=True, text=True, timeout=15, cwd=str(ROOT))
        return p.returncode, (p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        return 124, "TIMEOUT"

def classify(out):
    m = re.search(r'unbound symbol:\s*([^\s\n]+)', out)
    if m:
        sym = m.group(1)
        base = sym.split('/')[0]
        if sym in BANNED_FOLD or base in BANNED_FOLD:
            return ('banned-fold', sym)
        return ('unbound-symbol', sym)
    if 'TIMEOUT' in out:
        return ('timeout', '')
    if re.search(r'(parse|unexpected|reader|unbalanced|unterminated)', out, re.I):
        return ('syntax', '')
    return ('runtime-error', '')

UNESC = re.compile(r'\\(["\\])')

def extract(text):
    """Return list of (code, marked_bool). Fenced blocks live inside slat
    :prose strings, so inner " and \\ arrive backslash-escaped — unescape them."""
    out = []
    for m in FENCE.finditer(text):
        code = UNESC.sub(r'\1', m.group(1))
        window = text[max(0, m.start()-220):m.start()]
        marked = bool(BUILD.search(window))
        out.append((code, marked))
    return out

def main():
    files = sorted(BOOKS.rglob("*.book.slatl")) + sorted(BOOKS.rglob("*.slatl")) + sorted(BOOKS.rglob("*.slat"))
    files = sorted(set(f for f in files if not f.name.endswith('.pre-3.0-bak')))

    rows = []  # (book, file, idx, marked, xdialect, status, reason, sym, head)
    for f in files:
        rel = f.relative_to(BOOKS)
        book = rel.parts[0] if len(rel.parts) > 1 else rel.name
        xd = any(x in str(rel) for x in XDIALECT)
        try:
            text = f.read_text()
        except Exception:
            continue
        for i, (code, marked) in enumerate(extract(text), 1):
            if not looks_runnable(code):
                continue
            rc, out = run(code)
            if rc == 0:
                rows.append((book, str(rel), i, marked, xd, 'PASS', '', '', ''))
            else:
                reason, sym = classify(out)
                head = code.strip().splitlines()[0][:70]
                rows.append((book, str(rel), i, marked, xd, 'FAIL', reason, sym, head))

    # ---- report ----
    total = len(rows)
    passed = sum(1 for r in rows if r[5] == 'PASS')
    failed = total - passed
    marked_rows = [r for r in rows if r[3]]
    marked_fail = [r for r in marked_rows if r[5] == 'FAIL']

    print(f"SCHEME-BOOKS EVAL — {total} runnable blocks across {len(files)} files")
    print(f"  PASS {passed}  FAIL {failed}  ({100*passed//max(total,1)}% pass)")
    print(f"  BUILD:runnable-marked blocks: {len(marked_rows)}  (fail {len(marked_fail)})")
    print()

    # failures split by x-dialect vs base
    base_fail = [r for r in rows if r[5]=='FAIL' and not r[4]]
    xd_fail   = [r for r in rows if r[5]=='FAIL' and r[4]]
    print(f"FAILURES: base-dialect {len(base_fail)}  |  x-dialect(expected) {len(xd_fail)}")
    print()

    # reason histogram (base only — the meaningful ones)
    by_reason = defaultdict(int)
    by_sym = defaultdict(int)
    for r in base_fail:
        by_reason[r[6]] += 1
        if r[7]:
            by_sym[r[7]] += 1
    print("BASE-DIALECT FAILURES BY REASON:")
    for reason, n in sorted(by_reason.items(), key=lambda x:-x[1]):
        print(f"  {reason:<16} {n}")
    print()
    print("TOP UNBOUND SYMBOLS (base):")
    for sym, n in sorted(by_sym.items(), key=lambda x:-x[1])[:30]:
        print(f"  {n:>4}  {sym}")
    print()

    # by book (base fails)
    by_book = defaultdict(lambda: [0,0])
    for r in rows:
        if r[4]:  # skip x-dialect from this table
            continue
        by_book[r[0]][0] += 1
        if r[5]=='FAIL':
            by_book[r[0]][1] += 1
    print(f"{'BOOK':<32} {'RUN':>5} {'FAIL':>5}")
    for book, (run_n, fail_n) in sorted(by_book.items(), key=lambda x:-x[1][1]):
        if fail_n:
            print(f"  {book:<30} {run_n:>5} {fail_n:>5}")

    # MARKED failures — the must-pass regressions
    if marked_fail:
        print()
        print("!! BUILD:runnable-MARKED FAILURES (authored must-pass):")
        for r in marked_fail:
            print(f"   {r[1]} #{r[2]}  {r[6]} {r[7]}  | {r[8]}")

    (ROOT/"scratch"/"eval-scheme-books-results.json").write_text(json.dumps(
        [{"book":r[0],"file":r[1],"n":r[2],"marked":r[3],"xdialect":r[4],
          "status":r[5],"reason":r[6],"sym":r[7],"head":r[8]} for r in rows], indent=2))

if __name__ == "__main__":
    main()
