#!/usr/bin/env python3
"""Extract every authored program field from MY 12 verbs in 12-char.slat and
run each through ./bin/motoi. Report any that error. My verbs only — skip
char=? / char? / char->integer / integer->char / digit-value (out of scope)."""
import re, subprocess, sys
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
F = REPO / 'scheme/reference/12-char.slat'
MINE = {"char<?", "char>?", "char<=?", "char>=?", "char-alphabetic?",
        "char-numeric?", "char-whitespace?", "char-upper-case?",
        "char-lower-case?", "char-upcase", "char-downcase", "char-foldcase"}

text = F.read_text()

# extract verb forms (balanced parens on lines starting with "(verb")
def verbs(t):
    i = 0
    while i < len(t):
        if t.startswith('(verb', i) and (i == 0 or t[i-1] == '\n'):
            depth = 0; ins = False; esc = False; j = i
            while j < len(t):
                c = t[j]
                if ins:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': ins = False
                else:
                    if c == '"': ins = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1; break
                j += 1
            yield t[i:j]; i = j
        else:
            i += 1

# fields I authored (3-discipline). Skip legacy :program / :composition (pre-existing).
FIELDS = ('eng-program', 'math-program', 'cs-program',
          'eng-composition', 'math-composition', 'cs-composition')

def scan_field_strings(v, field):
    """Return list of (field, program-source) — the string literal after :field."""
    out = []
    key = ':' + field + ' "'
    idx = 0
    while True:
        p = v.find(key, idx)
        if p == -1:
            break
        start = p + len(key)
        # read a scheme string literal (handle \" and \\)
        j = start; buf = []
        esc = False
        while j < len(v):
            c = v[j]
            if esc:
                buf.append(c); esc = False
            elif c == '\\':
                buf.append(c); esc = True
            elif c == '"':
                break
            else:
                buf.append(c)
            j += 1
        raw = ''.join(buf)
        out.append((field, raw))
        idx = j + 1
    return out

def unescape(s):
    # SLAT string -> actual program text
    return s.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')

def run(src):
    p = subprocess.run([str(REPO / 'bin/motoi'), 'run', '/dev/stdin'],
                       input=src, capture_output=True, text=True, timeout=30)
    return p.returncode, (p.stdout + p.stderr).strip()

fails = []
total = 0
for v in verbs(text):
    m = re.search(r':name\s+"([^"]+)"', v)
    if not m or m.group(1) not in MINE:
        continue
    name = m.group(1)
    for field in FIELDS:
        for _f, raw in scan_field_strings(v, field):
            src = unescape(raw)
            # honest-null sentinels start with a quote+word, not real code -> skip runs
            if src.lstrip().startswith("'honest-null") or src.lstrip().startswith("#f"):
                continue
            total += 1
            rc, out = run(src)
            bad = rc != 0 or 'error' in out.lower() or 'unbound' in out.lower() or 'not a character' in out.lower()
            if bad:
                fails.append((name, field, out[:200]))

print(f"Ran {total} authored programs across 12 verbs.")
if not fails:
    print("ALL PASS — no runtime errors.")
else:
    print(f"FAILURES: {len(fails)}")
    for name, field, out in fails:
        print(f"\n--- {name} :{field}")
        print("   " + out.replace('\n', '\n   '))
