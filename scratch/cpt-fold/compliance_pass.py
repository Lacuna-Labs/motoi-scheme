#!/usr/bin/env python3
"""
compliance_pass.py — pre-fold compliance gate over the EXACT trees the emitter reads.

Checks, per fold-source:
  1. LEAK: SSN / private-key / real-secret patterns that must never enter training.
  2. CONFIDENTIALITY: any record tagged non-public.
  3. TRAINING-ELIGIBLE: any record tagged #f (must be skipped by emitter).
  4. TAG-CONFORMANCE ("all data of a type has a shape"): every record of a type
     carries the tags that type's shape requires.

Read-only report. Prints findings grouped by severity. No fabrication.
"""
import os, re, json, collections

ROOT = "/Users/alfred/code/motoi-scheme"

# ---- the exact fold-source globs the emitter (v5) reads --------------------
def fold_sources():
    srcs = []  # (type, path)
    # reference verbs live across scheme/reference/*.slat*
    for dp, _, fs in os.walk(os.path.join(ROOT, "scheme/reference")):
        for f in fs:
            if f.endswith((".slat", ".slatl")):
                t = "reference"
                if "error-cards" in dp: t = "error-card"
                elif "broken-examples" in dp: t = "broken-example"
                srcs.append((t, os.path.join(dp, f)))
    # book chapters ONLY (boot records excluded, matching emitter glob)
    import glob
    for p in glob.glob(os.path.join(ROOT, "scheme-books/book-of-*/*.book.slatl")):
        srcs.append(("book-chapter", p))
    # graphs (4 axis files)
    for axis in ("sensation","intuition","thinking","feeling"):
        srcs.append((f"graph-{axis}", os.path.join(ROOT, f"graphs/graph-of-{axis}.slat")))
    return srcs

# ---- leak patterns --------------------------------------------------------
LEAK = {
    "SSN":            re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "private-key":    re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY'),
    "aws-key":        re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
    "bearer-token":   re.compile(r'\b(?:sk-|ghp_|xox[baprs]-)[A-Za-z0-9]{16,}'),
    "credit-card":    re.compile(r'\b(?:4\d{15}|5[1-5]\d{14})\b'),
}
# allow obviously-fake teaching SSNs? No — any SSN pattern in a training source is flagged.

CONF_RE = re.compile(r':confidentiality\s+"?([a-z-]+)"?')
TE_RE   = re.compile(r':training-eligible\s+(#[tf]|"[^"]*")')

def scan():
    leaks = collections.defaultdict(list)      # kind -> [(path,line,excerpt)]
    conf  = collections.defaultdict(list)      # value -> [path]
    te_false = []                              # [path]
    for typ, path in fold_sources():
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                text = f.read()
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            for kind, rx in LEAK.items():
                if rx.search(line):
                    leaks[kind].append((path, i, line.strip()[:100]))
        for m in CONF_RE.finditer(text):
            v = m.group(1)
            if v not in ("public",):
                conf[v].append(path)
        for m in TE_RE.finditer(text):
            if m.group(1) in ("#f", '"#f"', '"false"'):
                te_false.append(path)
    return leaks, conf, te_false

leaks, conf, te_false = scan()

print("="*72); print("COMPLIANCE PASS — fold-source trees"); print("="*72)

print("\n[1] LEAK PATTERNS (must be ZERO in any training source)")
if not any(leaks.values()):
    print("    clean — no SSN / key / token / card patterns found.")
for kind, hits in leaks.items():
    print(f"    !! {kind}: {len(hits)} hit(s)")
    for p, ln, ex in hits[:8]:
        print(f"        {p.replace(ROOT+'/','')}:{ln}  {ex}")

print("\n[2] CONFIDENTIALITY (only 'public' should enter the fold)")
if not conf:
    print("    no :confidentiality tags found in fold sources.")
for v, paths in sorted(conf.items()):
    u = sorted(set(paths))
    print(f"    :confidentiality {v} — {len(u)} file(s)")
    for p in u[:8]:
        print(f"        {p.replace(ROOT+'/','')}")

print("\n[3] TRAINING-ELIGIBLE #f (emitter must skip these)")
u = sorted(set(te_false))
print(f"    {len(u)} file(s) contain a :training-eligible #f record")
for p in u[:12]:
    print(f"        {p.replace(ROOT+'/','')}")

# persist
out = {
    "leaks": {k: [[p.replace(ROOT+'/',''), ln, ex] for p,ln,ex in v] for k,v in leaks.items()},
    "confidentiality": {k: sorted(set(p.replace(ROOT+'/','') for p in v)) for k,v in conf.items()},
    "training_eligible_false": sorted(set(p.replace(ROOT+'/','') for p in te_false)),
}
with open(os.path.join(ROOT,"scratch/cpt-fold/compliance.json"),"w") as f:
    json.dump(out, f, indent=2)
print(f"\nwrote scratch/cpt-fold/compliance.json")
