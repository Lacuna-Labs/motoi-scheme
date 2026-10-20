#!/usr/bin/env python3
"""book_conformance.py — per-chapter tag conformance for every book chapter.
Required book-chapter shape (from canonical 01-what-is-introspection):
  :book :chapter-number :title :audience :dialect :training-eligible
  :confidentiality :provenance :prose
Reports per-chapter missing tags. Also audits README + manifest presence per folder.
"""
import os, re, glob, collections, json

ROOT = "/Users/alfred/code/motoi-scheme"
BOOKS = os.path.join(ROOT, "scheme-books")

REQUIRED = ["book", "title", "audience", "dialect",
            "training-eligible", "confidentiality", "provenance"]
# :prose OR :chapter body — check :prose presence too but softer
SOFT = ["chapter-number", "voice", "prose"]

def has_key(text, key):
    # key in key-position: ^\s*(:key   OR  ^\s*(...  actually first token on a line
    return re.search(r'(?m)^\s*:%s\b' % re.escape(key), text) is not None

chapters = sorted(glob.glob(os.path.join(BOOKS, "book-of-*/*.book.slatl")))
missing_map = collections.defaultdict(list)  # chapter -> [missing tags]
per_tag_missing = collections.Counter()
clean = 0
for ch in chapters:
    with open(ch, encoding="utf-8", errors="replace") as f:
        t = f.read()
    miss = [k for k in REQUIRED if not has_key(t, k)]
    if miss:
        missing_map[ch] = miss
        for m in miss: per_tag_missing[m] += 1
    else:
        clean += 1

print("="*72)
print(f"BOOK CHAPTER CONFORMANCE — {len(chapters)} chapters")
print("="*72)
print(f"  clean (all required tags): {clean}")
print(f"  with >=1 missing required tag: {len(missing_map)}")
print("\n  missing-tag frequency (required only):")
for tag, c in per_tag_missing.most_common():
    print(f"    :{tag:22} missing in {c} chapters")

# show worst offenders
print("\n  chapters missing 2+ required tags:")
worst = [(c, m) for c, m in missing_map.items() if len(m) >= 2]
for c, m in sorted(worst, key=lambda x: -len(x[1]))[:40]:
    print(f"    {c.replace(ROOT+'/','')}: {', '.join(':'+x for x in m)}")

# folder README + manifest audit
print("\n" + "="*72)
print("FOLDER README + MANIFEST AUDIT")
print("="*72)
folders = sorted(d for d in os.listdir(BOOKS)
                 if os.path.isdir(os.path.join(BOOKS, d)) and d.startswith("book-of-"))
no_readme, no_manifest = [], []
for d in folders:
    fp = os.path.join(BOOKS, d)
    files = os.listdir(fp)
    has_readme = any(re.match(r'(?i)readme', f) for f in files)
    has_manifest = any("manifest" in f.lower() for f in files)
    if not has_readme: no_readme.append(d)
    if not has_manifest: no_manifest.append(d)
print(f"  folders: {len(folders)}")
print(f"  missing README: {len(no_readme)}")
for d in no_readme: print(f"      - {d}")
print(f"  missing manifest: {len(no_manifest)}")
for d in no_manifest: print(f"      - {d}")

out = {
  "chapters_total": len(chapters),
  "chapters_clean": clean,
  "chapters_missing": {c.replace(ROOT+'/',''): m for c,m in missing_map.items()},
  "per_tag_missing": dict(per_tag_missing),
  "folders_no_readme": no_readme,
  "folders_no_manifest": no_manifest,
}
with open(os.path.join(ROOT,"scratch/cpt-fold/book_conformance.json"),"w") as f:
    json.dump(out, f, indent=2)
print("\nwrote scratch/cpt-fold/book_conformance.json")
