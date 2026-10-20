#!/usr/bin/env python3
"""Generic: extract every runnable code field from a .slat file and run each
through ./bin/motoi run /dev/stdin. Report pass/fail counts and failures.

Usage: python3 test-slat-generic.py <file.slat>
"""
import subprocess, sys
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')

CODE_FIELDS = [
    ':code', ':program', ':eng-program', ':math-program', ':cs-program',
    ':composition', ':eng-composition', ':math-composition', ':cs-composition',
]

def extract_string(text, pos):
    assert text[pos] == '"'
    i = pos + 1
    result = []
    while i < len(text):
        c = text[i]
        if c == '\\':
            nc = text[i+1] if i+1 < len(text) else ''
            if nc == 'n':
                result.append('\n'); i += 2
            elif nc == 't':
                result.append('\t'); i += 2
            elif nc == '"':
                result.append('"'); i += 2
            elif nc == '\\':
                result.append('\\'); i += 2
            else:
                result.append(c); i += 1
        elif c == '"':
            return ''.join(result), i + 1
        else:
            result.append(c); i += 1
    raise ValueError(f"unterminated string at {pos}")

def extract_programs(text):
    i = 0
    n = len(text)
    while i < n:
        found = False
        for field in CODE_FIELDS:
            if text.startswith(field, i):
                j = i + len(field)
                while j < n and text[j] in ' \t\n':
                    j += 1
                if j < n and text[j] == '"':
                    try:
                        val, end = extract_string(text, j)
                        if val and val.strip() and val.strip() != '#f':
                            yield field, val, i
                        i = end
                        found = True
                        break
                    except (ValueError, AssertionError):
                        pass
        if not found:
            i += 1

if len(sys.argv) < 2:
    print("Usage: test-slat-generic.py <file.slat>")
    sys.exit(1)

F = Path(sys.argv[1])
if not F.is_absolute():
    F = REPO / F
text = F.read_text()
programs = list(extract_programs(text))
print(f"Extracted {len(programs)} programs from {F.name}")

PASS = FAIL = 0
failures = []

for field, code, pos in programs:
    try:
        result = subprocess.run(
            ['node', 'bin/motoi', 'run', '/dev/stdin'],
            input=code, capture_output=True, text=True,
            cwd=str(REPO), timeout=10
        )
        if result.returncode == 0:
            PASS += 1
        else:
            FAIL += 1
            err = (result.stderr.strip() or result.stdout.strip())[:80]
            snippet = repr(code.replace('\n', '↩')[:60])
            failures.append(f"  FAIL [{field}]: {snippet} => {err}")
    except subprocess.TimeoutExpired:
        FAIL += 1
        snippet = repr(code.replace('\n', '↩')[:60])
        failures.append(f"  FAIL [{field}]: {snippet} => TIMEOUT")

print(f"TOTAL: {PASS+FAIL}, PASS: {PASS}, FAIL: {FAIL}")
for f in failures:
    print(f)
