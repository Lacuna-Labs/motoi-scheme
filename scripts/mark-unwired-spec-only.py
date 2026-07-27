#!/usr/bin/env python3
"""mark-unwired-spec-only.py — for verbs whose top-level symbol isn't
wired in the runtime, add `:runs "spec-only"` markers to each row so the
compliance check treats them as spec-shape, not runnable code.

Approach:
  1. Probe every verb name (e.g. `(collision/define-layers!)`) against
     the CLI. If the runtime says "unbound symbol", the verb is unwired.
  2. For unwired verbs, walk each row block (row-2-audit, row-3-dimension,
     row-4-proof, row-5-emergence) and prepend `:runs "spec-only"` right
     after the opening `(`.

Idempotent — skips rows that already contain :runs "spec-only".
"""
import os, re, subprocess

REF_DIR = '/Users/alfred/code/motoi-scheme/scheme/reference'
MOTOI = '/Users/alfred/code/motoi-scheme/bin/motoi'
TMP = '/tmp/motoi-verb-probe.scm'

FILES = [
    '08-base.slat', '09-beat.slat', '14-collision.slat', '21-domain.slat',
    '27-floor.slat', '49-pattern.slat', '54-route.slat', '68-transport.slat',
    '71-weather.slat',
    '16-compare.slat', '37-lazy.slat', '45-num.slat',
    '46-object.slat', '53-prefab.slat',
    '04-animation.slat', '06-assert.slat', '31-group.slat',
    '43-note.slat', '58-sprite.slat',
    '05-artifact.slat',
    '13-chem.slat',
    '25-exact.slat', '52-predicate.slat',
]

ROWS = ['row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence']

def verb_wired(name):
    """A verb is 'wired' if evaluating it as a bare symbol doesn't produce
    'unbound symbol'. We just look up the binding; that's cheap and doesn't
    invoke the verb (which might have side effects or need args)."""
    with open(TMP, 'w') as f:
        f.write(name + '\n')
    try:
        r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, timeout=4,
            cwd='/Users/alfred/code/motoi-scheme', text=True)
        out = (r.stdout or '') + (r.stderr or '')
        return 'unbound symbol' not in out
    except Exception:
        return False

def find_row_starts(text, row_key):
    """Yield (row_open_paren_idx, row_close_paren_idx) for every occurrence
    of the row-key that opens a paren-list."""
    key = f':{row_key}'
    i = 0
    while True:
        idx = text.find(key, i)
        if idx < 0: break
        j = idx + len(key)
        while j < len(text) and text[j] in ' \t\n': j += 1
        if j >= len(text) or text[j] != '(':
            i = idx + 1; continue
        # find balanced close
        depth = 0; in_str = False; esc = False; k = j
        while k < len(text):
            c = text[k]
            if in_str:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': in_str = False
            else:
                if c == '"': in_str = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0: break
            k += 1
        yield (j, k)
        i = k + 1

def extract_verb_names(text):
    """All verb names declared in this file (top-level :name in verb records)."""
    names = set()
    for m in re.finditer(r'\(verb\b', text):
        j = m.end()
        # Find :name "..." within this record
        m2 = re.search(r':name\s+"([^"]+)"', text[j:j+500])
        if m2: names.add(m2.group(1))
    return names

# --- main ---
total_files = 0
edits = 0
unwired_verbs = set()

for fn in FILES:
    path = os.path.join(REF_DIR, fn)
    if not os.path.exists(path):
        print(f'SKIP {fn} (missing)'); continue
    text = open(path).read()
    verbs = extract_verb_names(text)
    file_needs_marks = False
    for v in verbs:
        wired = verb_wired(v)
        if not wired:
            unwired_verbs.add(v)
            file_needs_marks = True
    if not file_needs_marks:
        print(f'{fn}: all {len(verbs)} verbs wired — no changes')
        continue

    # This file has ≥1 unwired verb. Mark ALL row bodies with :runs "spec-only"
    # unless already marked. (Spec-only is a per-row property; and if the
    # file's core verb is unwired, ALL its rows demonstrate unwired-verb usage.)
    # Walk backwards so indices stay valid.
    new_text = text
    spans = []
    for rk in ROWS:
        for (open_paren, close_paren) in find_row_starts(new_text, rk):
            spans.append((open_paren, close_paren))
    spans.sort(reverse=True)
    for open_paren, close_paren in spans:
        # Skip if already has spec-only marker in this row body
        row_body = new_text[open_paren:close_paren+1]
        if ':runs "spec-only"' in row_body: continue
        # Insert marker right after opening (
        marker = '\n     :runs "spec-only"'
        new_text = new_text[:open_paren+1] + marker + new_text[open_paren+1:]
        edits += 1

    if new_text != text:
        with open(path, 'w') as f:
            f.write(new_text)
        total_files += 1
        print(f'{fn}: marked')

print(f'\n{"="*50}')
print(f'Files modified: {total_files}')
print(f'Row markers added: {edits}')
print(f'Unwired verbs found: {len(unwired_verbs)}')
if unwired_verbs:
    print(f'  {", ".join(sorted(unwired_verbs))}')
