#!/usr/bin/env python3
"""Read-only corpus scan for the 2026-08-02 poison audit.

Reports, separately:
  - files-containing  (how many files hold >=1 regex hit)
  - occurrences       (raw regex hits)
Nothing here decides "wrong"; that is done by human reading of the extracts.
"""
import os, re, sys, json, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CORPUS_DIRS = [
    "scheme", "scheme-books", "word-books", "carts", "graphs",
    "training-data", "training", "modules", "rosetta", "site",
    "engineering", "Spec", "words", "scratch/sft-plans",
]
EXTS = {".slat", ".slatl", ".sks", ".jsonl", ".scm", ".md", ".json", ".txt"}

def corpus_files():
    seen = set()
    for d in CORPUS_DIRS:
        p = os.path.join(ROOT, d)
        if not os.path.isdir(p):
            continue
        for dp, dn, fn in os.walk(p):
            dn[:] = [x for x in dn if x not in ("node_modules", ".git")]
            for f in fn:
                if os.path.splitext(f)[1].lower() in EXTS:
                    fp = os.path.realpath(os.path.join(dp, f))
                    if fp not in seen:
                        seen.add(fp)
                        yield fp

PATTERNS = {
    # --- (A) contract change 626e9ee ---
    "substring-call":   r"\(substring\b",
    "substring-word":   r"\bsubstring\b",
    "cons\\*-call":     r"\(cons\*[\s)]",
    "cons\\*-word":     r"cons\*",
    "delete-duplicates": r"\bdelete-duplicates\b",
    "string-prefix?":   r"\bstring-prefix\?",
    # --- (B) R7RS divergences ---
    "nary-compare":     r"\((?:=|<|>|<=|>=)(?:\s+[^()\s]+){3,}\s*\)",
    "string=?-nary":    r"\(string(?:=|<|>|<=|>=)\?(?:\s+[^()\s]+){3,}\s*\)",
    "vector-ref":       r"\(vector-ref\b",
    "list-ref":         r"\(list-ref\b",
    "vector-copy!":     r"\(vector-copy!",
    "bytevector-copy!": r"\(bytevector-copy!",
    "round-rational":   r"\(round\s+-?\d+/\d+",
    "string->number":   r"\(string->number\b",
    "eq?-nil":          r"\(eq\?\s+'\(\)\s+'\(\)",
    "exact?-inexact?":  r"\((?:exact|inexact)\?\s",
    "log-2arg":         r"\(log\s+[^()\s]+\s+[^()\s]+\s*\)",
    "member-3arg":      r"\(member\s+[^()]*?\s+[^()\s]+\s+[^()\s]+\s*\)",
    "assoc-3arg":       r"\(assoc\s",
    "sort-vector":      r"\(sort\s+\(?vector\b",
    "list-index":       r"\(list-index\b",
    "rationalize":      r"\(rationalize\b",
    "vector-append":    r"\(vector-append\b",
    "vector->string":   r"\(vector->string\b",
    "string->vector":   r"\(string->vector\b",
    "append-nonlist":   r"\(append\s+[^'(\s][^\s()]*\s",
    "eqv?":             r"\(eqv\?\s",
    "equal?-rational":  r"\(equal\?\s+-?\d+/\d+",
    "even?-rational":   r"\(even\?\s+-?\d+/\d+",
    "read-proc":        r"\(read\)",
    "set-cdr!":         r"\(set-cdr!",
}

COMPILED = {k: re.compile(v) for k, v in PATTERNS.items()}

files_containing = collections.Counter()
occurrences = collections.Counter()
per_file = collections.defaultdict(lambda: collections.Counter())

nfiles = 0
for fp in corpus_files():
    nfiles += 1
    try:
        text = open(fp, encoding="utf-8", errors="replace").read()
    except Exception:
        continue
    rel = os.path.relpath(fp, ROOT)
    for k, rx in COMPILED.items():
        n = len(rx.findall(text))
        if n:
            occurrences[k] += n
            files_containing[k] += 1
            per_file[k][rel] = n

print(f"corpus files scanned: {nfiles}\n")
print(f"{'pattern':22} {'files':>7} {'occurrences':>12}")
for k in PATTERNS:
    print(f"{k:22} {files_containing[k]:>7} {occurrences[k]:>12}")

print("\n\n=== top files per pattern ===")
for k in PATTERNS:
    if not per_file[k]:
        continue
    top = per_file[k].most_common(8)
    print(f"\n[{k}]  total {occurrences[k]} in {files_containing[k]} files")
    for f, n in top:
        print(f"    {n:>6}  {f}")
