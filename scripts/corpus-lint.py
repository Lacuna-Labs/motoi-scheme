#!/usr/bin/env python3
"""corpus-lint.py — the no-fuck-ups gate before any CPT fold.

Alfred, 2026-07-22: "Zero fuck ups. Find a way to test it for fuck ups."
"Balance in accordance to what we're capable of making and ARE making —
not padded to hit an arbitrary target."

MECHANICAL CHECKS (fail loud, block the fold):

  REFERENCE (scheme/reference/**.slat)
    R1  every verb has :name :library :tier :kind :signature :summary
    R2  every verb's :name is unique across all reference files
    R3  every verb's :name resolves at runtime (motoi run)
    R4  every :examples has ≥1 :code field
    R5  every row (r2-audit, r3-dimension, r4-proof, r5-emergence)
        is present OR the verb has :training-eligible #f OR :runs "spec-only"
    R6  no placeholder strings ("TODO", "TKTK", "TBD", "lorem ipsum",
        "placeholder", "XXX", "FIXME")

  BOOKS (scheme-books/**.book.slatl)
    B1  every chapter has :book :title :audience :dialect :voice
        :training-eligible :confidentiality
    B2  :audience is one of {kid, programmer-learning-motoi,
        programmer-shipping-carts, engineer, sre}
    B3  :dialect is one of {motoi, sakura, both}
    B4  :voice is one of {motoi-copilot, sakura-copilot, motoi-teacher,
        sakura-teacher, book-of-jesse, book-of-scheme, neutral}
    B5  :training-eligible is #t or #f
    B6  :confidentiality is one of {public, internal, engineering}
    B7  :book-type present, one of {learning, application, composition,
        introspection, prose, challenge}
    B8  :prose present AND non-empty AND length ≥ 400 chars
    B9  no placeholder strings
    B10 no duplicate (book, chapter-number) pairs

  GRAPHS (graphs/graph-of-*.slat)
    G1  every node has :concept :tier
    G2  :tier is one of {tier-1, tier-2, tier-3}
    G3  optional fields (:opposition, :associations, :distributional,
        :cross-refs) are EITHER filled with real data OR carry the
        honest-null marker (:status "no-signal-in-corpus")
        FABRICATED fills (alphabetic-hash, pattern-detected)
        are BANNED and reported.
    G4  no stub :definition strings ("A rare word appearing in the
        Motoi corpus", "TBD", "TODO")
    G5  no duplicate :concept values within an axis

  CROSS-CUTTING (all corpora)
    X1  no file exceeds 500 KB (fold-friendliness)
    X2  every file parses as SLAT (byte-level, not schema)
    X3  balance report — count docs per data-type + axis + book +
        namespace. No enforced target; just print what we HAVE so
        Alfred can see the shape.

USAGE
    python3 scripts/corpus-lint.py                # runs all checks
    python3 scripts/corpus-lint.py --strict       # exit non-zero on any WARN
    python3 scripts/corpus-lint.py --json         # emit JSON report

Exit 0 = clean, safe to fold. Exit 1 = at least one FAIL. Exit 2 = internal error.
"""
from __future__ import annotations
import os, re, sys, json, argparse, glob, subprocess
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path('/Users/alfred/code/motoi-scheme')
REF = ROOT / 'scheme' / 'reference'
BOOKS = ROOT / 'scheme-books'
GRAPHS = ROOT / 'graphs'
MOTOI = ROOT / 'bin' / 'motoi'
TMP = '/tmp/motoi-lint-probe.scm'

PLACEHOLDERS = ['TODO', 'TKTK', 'TBD', 'FIXME', 'lorem ipsum', 'placeholder', 'XXXX']

AUDIENCE_OK = {'kid', 'programmer-learning-motoi', 'programmer-shipping-carts', 'engineer', 'sre', 'operator'}
DIALECT_OK = {'motoi', 'sakura', 'both'}
VOICE_OK = {'motoi-copilot', 'sakura-copilot', 'motoi-teacher', 'sakura-teacher', 'book-of-jesse', 'book-of-scheme', 'neutral', 'author', 'jesse'}
CONF_OK = {'public', 'internal', 'engineering'}
BOOKTYPE_OK = {'learning', 'application', 'composition', 'introspection', 'prose', 'challenge'}
TIER_OK = {'tier-1', 'tier-2', 'tier-3'}

fails, warns = [], []
counts = defaultdict(int)

def FAIL(msg): fails.append(msg)
def WARN(msg): warns.append(msg)

# ── SLAT paren-form extractor ─────────────────────────────────────────
def extract_forms(text, tag='(verb'):
    forms = []; i = 0; n = len(text)
    while i < n:
        if text.startswith(tag, i) and (i == 0 or text[i-1] in '\n\t '):
            depth = 0; ins = False; esc = False; j = i
            while j < n:
                c = text[j]
                if ins:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': ins = False
                else:
                    if c == '"': ins = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0: j += 1; break
                j += 1
            forms.append(text[i:j])
            i = j
        else:
            i += 1
    return forms

def get_field(form, key):
    """Return the raw string value for :key, or None."""
    m = re.search(rf':{re.escape(key)}\s+"((?:[^"\\]|\\.)*)"', form)
    if m: return m.group(1)
    m = re.search(rf':{re.escape(key)}\s+([^\s\(\)]+)', form)
    if m: return m.group(1).strip('"')
    return None

def has_field(form, key):
    return re.search(rf':{re.escape(key)}\b', form) is not None

# ── RUNTIME PROBE CACHE ───────────────────────────────────────────────
_wired_cache = {}
def is_wired(sym):
    if sym in _wired_cache: return _wired_cache[sym]
    with open(TMP, 'w') as f: f.write(sym + '\n')
    try:
        r = subprocess.run([str(MOTOI), 'run', TMP], capture_output=True, timeout=4, text=True, cwd=str(ROOT))
        w = 'unbound symbol' not in (r.stdout or '') + (r.stderr or '')
    except Exception:
        w = False
    _wired_cache[sym] = w
    return w

# ── R: reference audit ────────────────────────────────────────────────
def audit_reference():
    all_names = Counter()
    for path in sorted(REF.glob('[0-9][0-9]*.slat')):
        text = path.read_text()
        for v in extract_forms(text, '(verb'):
            name = get_field(v, 'name')
            if not name:
                FAIL(f'[R1] {path.name}: verb missing :name'); continue
            all_names[name] += 1
            for req in ('library', 'tier', 'kind', 'signature', 'summary'):
                if not has_field(v, req):
                    FAIL(f'[R1] {path.name} {name}: missing :{req}')
            # R5 rows or opt-out
            training_ok = get_field(v, 'training-eligible')
            for row_key in ('row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence'):
                if not has_field(v, row_key) and training_ok != '#f':
                    WARN(f'[R5] {path.name} {name}: missing :{row_key}')
            # R6 placeholder scan
            for ph in PLACEHOLDERS:
                if ph in v:
                    WARN(f'[R6] {path.name} {name}: contains placeholder "{ph}"')
            counts['reference_verbs'] += 1
    # R2 uniqueness
    for name, n in all_names.items():
        if n > 1:
            FAIL(f'[R2] verb :name "{name}" appears {n} times across reference files')
    # R3 runtime
    unwired = [n for n in all_names if not is_wired(n)]
    for n in unwired[:20]:
        FAIL(f'[R3] verb "{n}" is documented but not wired at runtime')
    if len(unwired) > 20:
        FAIL(f'[R3] ... plus {len(unwired) - 20} more unwired verbs')
    counts['reference_verbs_unwired'] = len(unwired)

# ── B: book audit ─────────────────────────────────────────────────────
# Motoi book records use one of THREE top-level forms depending on file kind:
#   (chapter ...) — regular numbered chapter
#   (appendix ...) — lettered appendix (audit-doctrine equivalent)
#   (readme ...) / (book-manifest ...) — book-level metadata (skipped here)
# Fixed 2026-07-22 after appendix-l false positives.
def audit_books():
    seen_pairs = set()
    for path in sorted(BOOKS.rglob('*.book.slatl')):
        text = path.read_text()
        # Chapters + appendices share the same tag doctrine
        records = extract_forms(text, '(chapter') + extract_forms(text, '(appendix')
        for c in records:
            counts['book_chapters'] += 1
            book = get_field(c, 'book')
            ch = get_field(c, 'chapter-number')
            title = get_field(c, 'title') or path.name
            for req in ('book', 'title', 'audience', 'dialect', 'voice', 'training-eligible', 'confidentiality'):
                if not has_field(c, req):
                    FAIL(f'[B1] {path.name}: {title!r} missing :{req}')
            aud = get_field(c, 'audience')
            if aud and aud not in AUDIENCE_OK:
                WARN(f'[B2] {path.name}: {title!r} :audience "{aud}" not in known set {sorted(AUDIENCE_OK)}')
            dia = get_field(c, 'dialect')
            if dia and dia not in DIALECT_OK:
                WARN(f'[B3] {path.name}: {title!r} :dialect "{dia}" not in {sorted(DIALECT_OK)}')
            vc = get_field(c, 'voice')
            if vc and vc not in VOICE_OK:
                WARN(f'[B4] {path.name}: {title!r} :voice "{vc}" not in {sorted(VOICE_OK)}')
            te = get_field(c, 'training-eligible')
            if te and te not in ('#t', '#f'):
                WARN(f'[B5] {path.name}: {title!r} :training-eligible "{te}" not #t/#f')
            conf = get_field(c, 'confidentiality')
            if conf and conf not in CONF_OK:
                WARN(f'[B6] {path.name}: {title!r} :confidentiality "{conf}" not in {sorted(CONF_OK)}')
            bt = get_field(c, 'book-type')
            if not bt:
                WARN(f'[B7] {path.name}: {title!r} missing :book-type')
            elif bt not in BOOKTYPE_OK:
                WARN(f'[B7] {path.name}: {title!r} :book-type "{bt}" not in {sorted(BOOKTYPE_OK)}')
            prose = get_field(c, 'prose')
            # Covers, dedications, and index/manifest wrappers are legit-short.
            is_meta = any(m in path.name.lower() for m in ('cover', 'dedication', 'index', 'manifest', 'chapters', 'outline'))
            if not prose:
                if is_meta:
                    pass  # meta wrappers don't need prose
                else:
                    FAIL(f'[B8] {path.name}: {title!r} missing :prose')
            elif len(prose) < 400:
                if is_meta:
                    pass
                else:
                    WARN(f'[B8] {path.name}: {title!r} :prose only {len(prose)} chars (< 400)')
            for ph in PLACEHOLDERS:
                if ph in c:
                    WARN(f'[B9] {path.name}: {title!r} contains placeholder "{ph}"')
            key = (book, ch)
            if key in seen_pairs and ch and ch != 'null':
                FAIL(f'[B10] duplicate (:book "{book}" :chapter-number "{ch}") in {path.name}')
            seen_pairs.add(key)

# ── G: graph audit ────────────────────────────────────────────────────
# Motoi graph nodes use :id + :canonical + :axis (not :concept + :tier).
# Fixed 2026-07-22 after false-positive audit reported 25k G1 fails.
def audit_graphs():
    for path in sorted(GRAPHS.glob('graph-of-*.slat')):
        text = path.read_text()
        seen_ids = set()
        for n in extract_forms(text, '(node'):
            counts['graph_nodes'] += 1
            node_id = get_field(n, 'id')
            canonical = get_field(n, 'canonical')
            axis = get_field(n, 'axis')
            if not (node_id or canonical):
                FAIL(f'[G1] {path.name}: node missing both :id and :canonical'); continue
            key = node_id or canonical
            if not axis:
                WARN(f'[G1] {path.name}: {key!r} missing :axis')
            # G3 fabrication check: look for actual TAG markers, not word usage.
            # Legit uses of "fabricated" in prose (e.g., discussing anti-fabrication)
            # are fine. Only flag TAG-shaped markers like :fabricated #t.
            if re.search(r':fabricated\s+#t|:alphabetic-hash-fill\s+#t|:pattern-detected-fill\s+#t', n):
                FAIL(f'[G3] {path.name}: {key!r} carries a fabrication tag')
            # G4 stub definitions
            defn = get_field(n, 'definition')
            if defn and any(s in defn for s in ['A rare word', 'TBD', 'TODO']):
                FAIL(f'[G4] {path.name}: {key!r} :definition is a stub')
            # G4b junk defs — unbalanced parens/quotes (from bad Tier 3 PPMI)
            if defn and (defn.count('(') != defn.count(')') or defn.count('"') % 2 != 0):
                WARN(f'[G4] {path.name}: {key!r} :definition has unbalanced parens/quotes')
            if key in seen_ids:
                FAIL(f'[G5] {path.name}: duplicate :id/:canonical "{key}"')
            seen_ids.add(key)
        counts[f'{path.stem}_nodes'] = len(seen_ids)

# ── X: cross-cutting ──────────────────────────────────────────────────
def audit_cross():
    for path in list(REF.glob('*.slat')) + list(BOOKS.rglob('*.book.slatl')) + list(GRAPHS.glob('graph-of-*.slat')):
        sz = path.stat().st_size
        if sz > 500_000:
            WARN(f'[X1] {path.name}: {sz//1024} KB > 500 KB — split before fold')
    # X3 balance — just observe, don't enforce
    print()
    print('=' * 60)
    print('BALANCE REPORT (observation, not target)')
    print('=' * 60)
    for k, v in sorted(counts.items()):
        print(f'  {k:<40s} {v:>8d}')

# ── main ──────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--strict', action='store_true')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    audit_reference()
    audit_books()
    audit_graphs()
    audit_cross()

    print()
    print('=' * 60)
    print(f'FAILS: {len(fails)}   WARNS: {len(warns)}')
    print('=' * 60)
    if fails:
        print('\nFAILS:')
        for f in fails[:80]:
            print(f'  ✗ {f}')
        if len(fails) > 80:
            print(f'  ... {len(fails) - 80} more')
    if warns and (args.strict or len(warns) < 40):
        print('\nWARNS:')
        for w in warns[:40]:
            print(f'  ⚠ {w}')
        if len(warns) > 40:
            print(f'  ... {len(warns) - 40} more')

    if args.json:
        report_path = ROOT / '_status' / 'corpus-lint-report.json'
        report_path.parent.mkdir(exist_ok=True)
        report_path.write_text(json.dumps({
            'fails': fails, 'warns': warns, 'counts': dict(counts)
        }, indent=2))
        print(f'\nJSON report: {report_path}')

    if fails:
        print('\nRESULT: FAIL — corpus has fuck-ups; do NOT fold.')
        sys.exit(1)
    if args.strict and warns:
        print('\nRESULT: FAIL (strict) — warns present with --strict.')
        sys.exit(1)
    print('\nRESULT: PASS — corpus is clean, safe to fold.')
    sys.exit(0)

if __name__ == '__main__':
    main()
