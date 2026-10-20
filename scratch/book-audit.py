#!/usr/bin/env python3
"""book-audit.py — auditor pass over scheme + engineering books.

Report only. No edits. Four lenses:
  1. conformance  — banned constructs (fold-left/foldl/foldr), acc-first reduce hints
  2. runnability  — extract ```scheme blocks marked `BUILD: runnable`, run via ./bin/motoi,
                    classify failures (banned-fold / unbound-dialect-verb / syntax / other)
  3. structure    — :book-type presence, README/MANIFEST, contaminant files
  4. (prose lens handled by human/agent judgment, not here)

Writes scratch/book-audit.json + prints a summary.
"""
import os, re, sys, json, subprocess
from collections import defaultdict, Counter

ROOT = '/Users/alfred/code/motoi-scheme'
BIN = f'{ROOT}/bin/motoi'
TMP = '/tmp/motoi-book-audit.scm'

TREES = {
    'scheme-books': f'{ROOT}/scheme-books',
    'SRE-MANUAL':   f'{ROOT}/SRE-MANUAL',
}
SINGLE_FILES = [
    f'{ROOT}/docs/LANG-ENGINEERING-1.0.ENG.slat',
    f'{ROOT}/docs/LANG-DESIGN-1.0.ENG.slat',
]

BANNED = re.compile(r'\b(fold-left|foldl|foldr)\b')
# books that legitimately teach OTHER dialects / excluded forms
XDIALECT_DIRS = ('book-of-jesse', 'book-of-language-ancestors', 'book-of-limits', 'broken-examples')

CODE_BLOCK = re.compile(r'```(?:scheme|motoi|racket|clojure|lisp)?\n(.*?)```', re.DOTALL)
BUILD_RUN  = re.compile(r'BUILD:\s*runnable')

def iter_book_files():
    for label, d in TREES.items():
        if not os.path.isdir(d): continue
        for dp, dn, fn in os.walk(d):
            if '_archive' in dp: continue
            for f in fn:
                if f.endswith('.slatl') or f.endswith('.slat'):
                    yield label, os.path.join(dp, f)
    for f in SINGLE_FILES:
        if os.path.exists(f): yield 'eng-book', f

def run(code, timeout=10):
    with open(TMP, 'w') as fh: fh.write(code)
    try:
        r = subprocess.run([BIN, 'run', TMP], capture_output=True, timeout=timeout, cwd=ROOT, text=True)
        return r.returncode == 0, (r.stdout + r.stderr)
    except subprocess.TimeoutExpired:
        return False, '<timeout>'
    except Exception as e:
        return False, f'<exc {e}>'

def classify(err):
    m = re.search(r'unbound symbol:\s*([^\s\n]+)', err)
    if m:
        sym = m.group(1)
        if sym in ('foldl', 'foldr', 'fold-left'):
            return 'banned-fold', sym
        return 'unbound-symbol', sym
    if '<timeout>' in err: return 'timeout', ''
    if 'parse' in err.lower() or 'unexpected' in err.lower() or 'reader' in err.lower():
        return 'syntax', ''
    return 'runtime-error', ''

def extract_runnable(text):
    """Return list of code strings for blocks whose closing fence is followed
    (within ~3 lines) by a BUILD: runnable marker."""
    out = []
    for m in CODE_BLOCK.finditer(text):
        tail = text[m.end():m.end()+160]
        if BUILD_RUN.search(tail):
            out.append(m.group(1))
    return out

results = {
    'conformance': defaultdict(list),   # file -> [(line, snippet)]
    'runnable': {'pass':0,'fail':0,'fail_by':Counter(),'fail_examples':[]},
    'structure': {'no_booktype':[], 'contaminant':[], 'unparse_meta':[]},
    'file_count': 0, 'block_count': 0,
}

CONTAMINANT = re.compile(r'(NOTES|TODO|continuation|status|SCRATCH)', re.IGNORECASE)

for label, path in iter_book_files():
    results['file_count'] += 1
    rel = os.path.relpath(path, ROOT)
    with open(path, errors='replace') as fh:
        text = fh.read()

    # --- conformance: banned constructs, skip x-dialect teaching dirs ---
    is_xdialect = any(x in rel for x in XDIALECT_DIRS)
    for i, line in enumerate(text.splitlines(), 1):
        if BANNED.search(line):
            results['conformance'][rel].append((i, line.strip()[:110], is_xdialect))

    # --- runnability: run marked-runnable blocks ---
    for code in extract_runnable(text):
        results['block_count'] += 1
        ok, err = run(code)
        if ok:
            results['runnable']['pass'] += 1
        else:
            results['runnable']['fail'] += 1
            kind, sym = classify(err)
            results['runnable']['fail_by'][kind] += 1
            if len(results['runnable']['fail_examples']) < 60:
                results['runnable']['fail_examples'].append(
                    {'file':rel,'kind':kind,'sym':sym,'code':code[:160],'err':err[:160]})

    # --- structure: book-type on chapter files ---
    if rel.endswith('.book.slatl') and ':book-type' not in text:
        results['structure']['no_booktype'].append(rel)

# contaminant files in book dirs
for label, d in TREES.items():
    if not os.path.isdir(d): continue
    for dp, dn, fn in os.walk(d):
        if '_archive' in dp: continue
        for f in fn:
            base = f.rsplit('.',1)[0]
            if CONTAMINANT.search(base) and f not in ('README.slat','README.slatl'):
                results['structure']['contaminant'].append(os.path.relpath(os.path.join(dp,f), ROOT))

# ---- summarize ----
conf_files = len(results['conformance'])
conf_real = sum(1 for rel,hits in results['conformance'].items()
                for (ln,s,xd) in hits if not xd)
conf_xd   = sum(1 for rel,hits in results['conformance'].items()
                for (ln,s,xd) in hits if xd)

out = {
    'files_scanned': results['file_count'],
    'runnable_blocks': results['block_count'],
    'runnable_pass': results['runnable']['pass'],
    'runnable_fail': results['runnable']['fail'],
    'runnable_fail_by': dict(results['runnable']['fail_by']),
    'conformance_files': conf_files,
    'conformance_hits_real': conf_real,
    'conformance_hits_xdialect': conf_xd,
    'no_booktype_count': len(results['structure']['no_booktype']),
    'contaminant_count': len(results['structure']['contaminant']),
    'detail': {
        'conformance': {k:v for k,v in results['conformance'].items()},
        'no_booktype': results['structure']['no_booktype'],
        'contaminant': results['structure']['contaminant'],
        'fail_examples': results['runnable']['fail_examples'],
    }
}
with open(f'{ROOT}/scratch/book-audit.json','w') as fh:
    json.dump(out, fh, indent=1)

print(f"files scanned:      {out['files_scanned']}")
print(f"runnable blocks:    {out['runnable_blocks']}  (pass {out['runnable_pass']} / fail {out['runnable_fail']})")
print(f"  fail breakdown:   {out['runnable_fail_by']}")
print(f"conformance files:  {out['conformance_files']}  (real hits {conf_real}, x-dialect {conf_xd})")
print(f"missing :book-type: {out['no_booktype_count']}")
print(f"contaminant files:  {out['contaminant_count']}")
print(f"-> scratch/book-audit.json")
