#!/usr/bin/env python3
"""test-in-session-libs.py — run every :program / :composition / :code snippet
from the libraries I authored to the 15-program standard this session, and
report pass/fail per verb.

Filenames: user-supplied list of specific reference files.
"""
import os, re, sys, subprocess

REF_DIR = '/Users/alfred/code/motoi-scheme/scheme/reference'
MOTOI = '/Users/alfred/code/motoi-scheme/bin/motoi'
TMP = '/tmp/motoi-in-session-check.scm'

FILES = [
    '08-base.slat', '09-beat.slat', '14-collision.slat', '21-domain.slat',
    '27-floor.slat', '49-pattern.slat', '54-route.slat', '68-transport.slat',
    '71-weather.slat',                                     # A
    '16-compare.slat', '37-lazy.slat', '45-num.slat',
    '46-object.slat', '53-prefab.slat',                    # B
    '04-animation.slat', '06-assert.slat', '31-group.slat',
    '43-note.slat', '58-sprite.slat',                      # C
    '05-artifact.slat',                                    # D
    '13-chem.slat',                                        # E (partial)
    '25-exact.slat', '52-predicate.slat',                  # done earlier
]

def extract_verbs(text):
    verbs = []; i = 0; n = len(text)
    while i < n:
        if text.startswith('(verb', i) and (i == 0 or text[i-1] == '\n'):
            depth = 0; in_str = False; esc = False; j = i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0: j += 1; break
                j += 1
            verbs.append(text[i:j])
            i = j
        else:
            i += 1
    return verbs

def verb_name(v):
    m = re.search(r':name\s+"([^"]+)"', v); return m.group(1) if m else '?'

def unescape(s):
    return s.replace(r'\n', '\n').replace(r'\"', '"').replace('\\\\', '\\')

def run(code, timeout=6):
    with open(TMP, 'w') as f: f.write(code)
    try:
        r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, timeout=timeout,
            cwd='/Users/alfred/code/motoi-scheme', text=True)
        return (r.returncode == 0, (r.stdout or '') + (r.stderr or ''))
    except subprocess.TimeoutExpired: return (False, '<timeout>')
    except Exception as e: return (False, f'<exc: {e}>')

by_file_verb = {}
totals = {'pass': 0, 'fail': 0, 'total': 0}
fail_examples = []

for fn in FILES:
    path = os.path.join(REF_DIR, fn)
    if not os.path.exists(path):
        print(f'SKIP {fn} (missing)'); continue
    text = open(path).read()
    verbs = extract_verbs(text)
    for v in verbs:
        vn = verb_name(v)
        pass_ct = fail_ct = 0
        for m in re.finditer(r':(?:eng-program|math-program|cs-program|eng-composition|math-composition|cs-composition|program|composition|code)\s+"((?:[^"\\]|\\.)*)"', v):
            code = unescape(m.group(1))
            ok, out = run(code)
            totals['total'] += 1
            if ok:
                pass_ct += 1; totals['pass'] += 1
            else:
                fail_ct += 1; totals['fail'] += 1
                if len(fail_examples) < 30:
                    fail_examples.append((fn, vn, code[:200], out[:200]))
        by_file_verb.setdefault(fn, []).append((vn, pass_ct, fail_ct))

print(f'\n== SUMMARY ==')
print(f'Total: {totals["total"]}  Pass: {totals["pass"]}  Fail: {totals["fail"]}')
print(f'Pass rate: {100*totals["pass"]/max(1,totals["total"]):.1f}%\n')

print('== PER-VERB (only verbs with any failures) ==')
for fn, verbs in by_file_verb.items():
    any_fail = any(f > 0 for _, _, f in verbs)
    if not any_fail: continue
    print(f'\n{fn}:')
    for vn, p, f in verbs:
        if f > 0:
            print(f'  {vn}: pass={p} fail={f}')

print(f'\n== FIRST {len(fail_examples)} FAILURES ==')
for fn, vn, code, err in fail_examples:
    print(f'\n[{fn} :: {vn}]')
    print('CODE:', code.replace('\n', ' | ')[:150])
    print('ERR :', err.strip().replace('\n', ' | ')[:200])
