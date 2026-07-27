#!/usr/bin/env python3
"""fix-mk3-prep-batch.py — mechanical P1/P2 corpus prep fixes for Mk3 fold.

Runs 6 fixes:
  1. Sweep :runs "spec-only" markers on rows using now-wired verbs
  2. Backfill :provenance on reference verbs (file-path form)
  3. Add :book-type to books missing it on README.slat
  4. Tag empty :oppositions () as honest-null in thinking Tier-1
  5. Regenerate scheme-books/MANIFEST.json
  6. Fix 00d-loading.slat bogus :verb-count

Each fix reports per-file counts. Total delta printed at end.
"""
import os, re, glob, subprocess, json

REPO = '/Users/alfred/code/motoi-scheme'
REF = f'{REPO}/scheme/reference'
BOOKS = f'{REPO}/scheme-books'
GRAPHS = f'{REPO}/graphs'
MOTOI = f'{REPO}/bin/motoi'

deltas = {}

# ── 1. Sweep spec-only markers where verb is now wired ────────────────
def is_wired(sym, _cache={}):
    if sym in _cache: return _cache[sym]
    tmp = '/tmp/motoi-mk3-probe.scm'
    with open(tmp, 'w') as f: f.write(sym + '\n')
    r = subprocess.run([MOTOI, 'run', tmp], capture_output=True, timeout=4, text=True, cwd=REPO)
    w = 'unbound symbol' not in (r.stdout or '') + (r.stderr or '')
    _cache[sym] = w
    return w

def find_row_bodies(text, key):
    """Yield (open, close, body) for each :key (...) form."""
    for m in re.finditer(rf':{re.escape(key)}\s*\(', text):
        j = m.end() - 1
        depth=0; ins=False; esc=False; k=j
        while k < len(text):
            c = text[k]
            if ins:
                if esc: esc=False
                elif c=='\\': esc=True
                elif c=='"': ins=False
            else:
                if c=='"': ins=True
                elif c=='(': depth+=1
                elif c==')':
                    depth-=1
                    if depth==0: break
            k+=1
        yield j, k, text[j:k+1]

n_swept = 0
for path in sorted(glob.glob(f'{REF}/*.slat')):
    text = open(path).read()
    new_text = text
    # Find every row with :runs "spec-only"
    for rk in ('row-2-audit','row-3-dimension','row-4-proof','row-5-emergence'):
        spans = list(find_row_bodies(new_text, rk))
        for open_p, close_p, body in reversed(spans):
            if ':runs "spec-only"' not in body: continue
            # Find the verb this row belongs to (walk back to nearest (verb :name "..."
            search = new_text[:open_p]
            m = list(re.finditer(r'\(verb[^)]*?:name\s+"([^"]+)"', search))
            if not m: continue
            verb_name = m[-1].group(1)
            if is_wired(verb_name):
                # Remove the spec-only marker
                new_body = re.sub(r'\s*:runs\s+"spec-only"', '', body)
                if new_body != body:
                    new_text = new_text[:open_p] + new_body + new_text[close_p+1:]
                    n_swept += 1
    if new_text != text:
        with open(path, 'w') as f: f.write(new_text)
deltas['spec_only_swept'] = n_swept
print(f'[1] Swept {n_swept} :runs "spec-only" markers (verb is wired)')

# ── 2. Backfill :provenance on reference verbs ────────────────────────
n_prov = 0
for path in sorted(glob.glob(f'{REF}/*.slat')):
    text = open(path).read()
    rel = path[len(REPO)+1:]
    verb_re = re.compile(r'(\(verb\s+:name\s+"([^"]+)"[^)]*?)(?=\)|\s+:)', re.DOTALL)
    new_parts = []; last = 0
    for m in re.finditer(r'\(verb\b', text):
        # find balanced end
        j = m.start(); depth=0; ins=False; esc=False; k=j
        while k < len(text):
            c = text[k]
            if ins:
                if esc: esc=False
                elif c=='\\': esc=True
                elif c=='"': ins=False
            else:
                if c=='"': ins=True
                elif c=='(': depth+=1
                elif c==')':
                    depth-=1
                    if depth==0: k+=1; break
            k+=1
        body = text[j:k]
        if ':provenance' in body: continue
        # inject :provenance right before final )
        prov = f' :provenance "{rel}"'
        new_body = body[:-1] + prov + body[-1]
        text = text[:j] + new_body + text[k:]
        n_prov += 1
    with open(path, 'w') as f: f.write(text)
deltas['provenance_backfilled'] = n_prov
print(f'[2] Backfilled :provenance on {n_prov} reference verbs')

# ── 3. Add :book-type to READMEs missing it ───────────────────────────
BOOK_TYPE_MAP = {
    'ai-tech-cards': 'learning', 'animation': 'composition', 'arcade-games': 'application',
    'challenges': 'challenge', 'code': 'learning', 'composition': 'composition',
    'computing': 'learning', 'craft': 'application', 'cs-curriculum': 'learning',
    'instruments': 'application', 'introspection': 'introspection', 'jesse': 'prose',
    'language-ancestors': 'learning', 'limits': 'composition', 'logic': 'learning',
    'math': 'learning', 'modules': 'learning', 'motion': 'composition', 'music': 'application',
    'narrative-games': 'application', 'one-shot': 'application', 'reminded': 'prose',
    'scheme': 'learning', 'self': 'prose', 'simulation-games': 'application',
    'slat': 'learning', 'sound': 'application', 'values': 'composition',
    'word-books': 'learning',
}
n_book_type = 0
for readme in glob.glob(f'{BOOKS}/book-of-*/README.slat') + glob.glob(f'{BOOKS}/book-of-*/00-manifest.slat') + glob.glob(f'{BOOKS}/book-of-*/00-manifest.book.slatl'):
    text = open(readme).read()
    if ':book-type' in text: continue
    # derive book-type from dir name
    dir_name = os.path.basename(os.path.dirname(readme))
    key = dir_name.replace('book-of-', '')
    bt = BOOK_TYPE_MAP.get(key, 'learning')
    # inject after opening ( or after :book field
    m = re.search(r'(\(\w[\w-]+)\s', text)
    if m:
        pos = m.end()
        text = text[:pos] + f'\n  :book-type "{bt}"' + text[pos:]
        with open(readme, 'w') as f: f.write(text)
        n_book_type += 1
deltas['book_type_added'] = n_book_type
print(f'[3] Added :book-type on {n_book_type} book READMEs')

# ── 4. Tag empty :oppositions () as honest-null in thinking Tier-1 ────
n_hn = 0
for path in [f'{GRAPHS}/graph-of-thinking.slat', f'{GRAPHS}/graph-of-feeling.slat',
             f'{GRAPHS}/graph-of-intuition.slat', f'{GRAPHS}/graph-of-sensation.slat']:
    if not os.path.exists(path): continue
    text = open(path).read()
    # Replace bare `:oppositions ()` with `:oppositions () :honest-null-oppositions #t`
    before = text
    text = re.sub(r'(:oppositions\s*\(\))(?!\s*:honest-null)', r'\1 :honest-null-oppositions #t', text)
    if text != before:
        n_local = text.count(':honest-null-oppositions #t') - before.count(':honest-null-oppositions #t')
        with open(path, 'w') as f: f.write(text)
        n_hn += n_local
deltas['honest_null_tagged'] = n_hn
print(f'[4] Tagged {n_hn} empty :oppositions as honest-null')

# ── 5. Regenerate scheme-books/MANIFEST.json ──────────────────────────
book_dirs = sorted(d for d in os.listdir(BOOKS) if d.startswith('book-of-') and os.path.isdir(f'{BOOKS}/{d}'))
manifest = {'version': '2', 'generated': '2026-07-22',
            'books': [{'name': d, 'path': d, 'chapter_count': len(glob.glob(f'{BOOKS}/{d}/*.book.slatl'))} for d in book_dirs]}
with open(f'{BOOKS}/MANIFEST.json', 'w') as f:
    json.dump(manifest, f, indent=2)
deltas['manifest_regen_books'] = len(book_dirs)
print(f'[5] Regenerated MANIFEST.json with {len(book_dirs)} books')

# ── 6. Fix 00d-loading.slat bogus :verb-count ─────────────────────────
loading = f'{REF}/00d-loading.slat'
if os.path.exists(loading):
    text = open(loading).read()
    # It declares :verb-count 3 but has 3 :verbs listed at top-level, not (verb ...) blocks.
    # The verb-count claim is about the top-level :verbs list, which does have 3 entries.
    # Actually per Marcus, this is a prose-only chapter — verb-count is bogus per structure.
    # Just remove the :verb-count claim to be honest.
    before = text
    text = re.sub(r':verb-count\s+\d+\s*', '', text)
    if text != before:
        with open(loading, 'w') as f: f.write(text)
        deltas['loading_fixed'] = 1
        print(f'[6] Fixed 00d-loading.slat bogus :verb-count')
    else:
        print(f'[6] 00d-loading.slat had no :verb-count to fix')

print()
print('== SUMMARY ==')
for k, v in deltas.items():
    print(f'  {k:<30s} {v:>6d}')
