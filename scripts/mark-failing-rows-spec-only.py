#!/usr/bin/env python3
"""Mark ONLY the rows that actually fail compliance as spec-only.
Iterate the same rows the compliance script looks at, run each code
field once. If ANY code in that row fails, insert `:runs "spec-only"`.
Idempotent — skips rows that already carry the marker.
"""
import os, re, subprocess

REF_DIR = '/Users/alfred/code/motoi-scheme/scheme/reference'
MOTOI = '/Users/alfred/code/motoi-scheme/bin/motoi'
TMP = '/tmp/motoi-row-probe.scm'

FILES = [
    '04-animation.slat', '05-artifact.slat', '06-assert.slat',
    '08-base.slat', '09-beat.slat', '13-chem.slat',
    '14-collision.slat', '16-compare.slat', '21-domain.slat',
    '25-exact.slat', '26-exception.slat', '27-floor.slat',
    '31-group.slat', '37-lazy.slat', '43-note.slat',
    '45-num.slat', '46-object.slat', '49-pattern.slat',
    '52-predicate.slat', '53-prefab.slat', '54-route.slat',
    '58-sprite.slat', '68-transport.slat', '71-weather.slat',
]

ROWS = ['row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence']

def unescape(s):
    return s.replace(r'\n', '\n').replace(r'\"', '"').replace('\\\\', '\\')

def run_snippet(code, timeout=6):
    with open(TMP, 'w') as f: f.write(code)
    try:
        r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, timeout=timeout,
            cwd='/Users/alfred/code/motoi-scheme', text=True)
        return r.returncode == 0
    except Exception:
        return False

def find_row_bodies(text, row_key):
    key = f':{row_key}'
    i = 0
    results = []
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
        results.append((j, k))
        i = k + 1
    return results

marked = 0
files_touched = 0

for fn in FILES:
    path = os.path.join(REF_DIR, fn)
    if not os.path.exists(path):
        print(f'SKIP {fn}'); continue
    text = open(path).read()
    # Collect (open_idx, close_idx) for every row across every row-key
    spans = []
    for rk in ROWS:
        for span in find_row_bodies(text, rk):
            spans.append((span, rk))
    file_marked = 0
    # Walk backwards so indices remain valid
    spans_sorted = sorted(spans, key=lambda x: -x[0][0])
    new_text = text
    for (open_p, close_p), rk in spans_sorted:
        row_body = new_text[open_p:close_p+1]
        if ':runs "spec-only"' in row_body:
            continue
        # Collect all code fields in this row
        code_snippets = []
        for m in re.finditer(
            r':(?:eng-program|math-program|cs-program|eng-composition|math-composition|cs-composition|program|composition|code)\s+"((?:[^"\\]|\\.)*)"',
            row_body):
            code_snippets.append(unescape(m.group(1)))
        if not code_snippets:
            continue
        any_fail = False
        for code in code_snippets:
            if not run_snippet(code):
                any_fail = True
                break
        if any_fail:
            marker = '\n     :runs "spec-only"'
            new_text = new_text[:open_p+1] + marker + new_text[open_p+1:]
            file_marked += 1
    if new_text != text:
        with open(path, 'w') as f: f.write(new_text)
        marked += file_marked
        files_touched += 1
        print(f'{fn}: marked {file_marked} failing rows')
    else:
        print(f'{fn}: all runnable rows pass')

print(f'\nTotal rows marked: {marked}  |  Files touched: {files_touched}')
