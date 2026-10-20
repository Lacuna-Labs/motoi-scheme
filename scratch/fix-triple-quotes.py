#!/usr/bin/env python3
"""Deterministic transform: convert Python-style triple-quoted strings (\"\"\"...\"\"\")
into Motoi-reader-legal single-quoted strings, escaping inner \\ and " .

State machine over chars:
  OUTSIDE  — structural text + normal "..." strings pass through untouched
  SINGLE   — inside a normal "..." string (respect \\ escape), pass through
  TRIPLE   — inside a \"\"\"...\"\"\" block: escape \\ and " , emit as one "..." string
"""
import sys

def transform(text: str) -> str:
    out = []
    i, n = 0, len(text)
    OUTSIDE, SINGLE, TRIPLE = 0, 1, 2
    state = OUTSIDE
    while i < n:
        if state == OUTSIDE:
            if text[i:i+3] == '"""':
                out.append('"')
                state = TRIPLE
                i += 3
            elif text[i] == '"':
                out.append('"')
                state = SINGLE
                i += 1
            else:
                out.append(text[i]); i += 1
        elif state == SINGLE:
            if text[i] == '\\' and i+1 < n:
                out.append(text[i:i+2]); i += 2
            elif text[i] == '"':
                out.append('"'); state = OUTSIDE; i += 1
            else:
                out.append(text[i]); i += 1
        else:  # TRIPLE
            if text[i:i+3] == '"""':
                out.append('"'); state = OUTSIDE; i += 3
            elif text[i] == '\\':
                out.append('\\\\'); i += 1
            elif text[i] == '"':
                out.append('\\"'); i += 1
            else:
                out.append(text[i]); i += 1
    if state != OUTSIDE:
        sys.stderr.write("WARNING: ended in state %d (unbalanced)\n" % state)
    return ''.join(out)

if __name__ == '__main__':
    path = sys.argv[1]
    with open(path, 'r') as f:
        src = f.read()
    sys.stdout.write(transform(src))
