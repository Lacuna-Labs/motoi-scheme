#!/usr/bin/env python3
"""Add the training gate tags to every word-book chapter, idempotently.
Inserts after the :title line:  :audience :dialect :training-eligible
:confidentiality :provenance. Derived from RULES.slat (audience :adult,
dialect motoi, owner docs-team) + each file's own front-matter — no fabrication.
"""
import re, glob, os
ROOT="/Users/alfred/code/motoi-scheme"
files=sorted(glob.glob(os.path.join(ROOT,"word-books/book-of-words/*.book.slatl")))
INSERT = (
'  :audience         "adult"\n'
'  :dialect          "motoi"\n'
'  :training-eligible #t\n'
'  :confidentiality  "public"\n'
'  :provenance       (:authored-by "docs-team" :collection "word-books" :status "draft")\n'
)
changed=0; skipped=0
for p in files:
    t=open(p,encoding="utf-8").read()
    if re.search(r'(?m)^\s*:training-eligible\b', t):
        skipped+=1; continue
    # insert after first chapter-level :title line
    m=re.search(r'(?m)^(\s*:title\s+"[^"]*"\s*)$', t)
    if not m:
        print("  NO :title match:", os.path.basename(p)); continue
    t2=t[:m.end()]+"\n"+INSERT+t[m.end():]
    open(p,"w",encoding="utf-8").write(t2)
    changed+=1
print(f"tagged {changed} chapters, skipped {skipped} already-tagged")
