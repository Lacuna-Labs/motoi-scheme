#!/usr/bin/env python3
"""Extract every ```motoi code block from book-of-motoi and run it through the interpreter.
Report pass/fail per block with file:line so failures can be fixed in place."""
import re, subprocess, sys, pathlib, tempfile, os

BOOK = pathlib.Path("scheme-books/book-of-motoi")
MOTOI = ["./bin/motoi", "run", "/dev/stdin"]

def blocks(path):
    """Yield (start_line, code) for each ```motoi fenced block."""
    lines = path.read_text().splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip() == "```motoi":
            start = i + 1
            body = []
            i += 1
            while i < len(lines) and lines[i].strip() != "```":
                body.append(lines[i])
                i += 1
            raw = "\n".join(body)
            # code blocks live inside a quoted :prose slat string → unescape
            raw = raw.replace('\\"', '"').replace('\\\\', '\\')
            yield start + 1, raw  # 1-based line of first code line
        i += 1

def run(code):
    try:
        p = subprocess.run(MOTOI, input=code, capture_output=True, text=True, timeout=30)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, "TIMEOUT"

def looks_runnable(code):
    s = code.strip()
    if not s:
        return False
    # Skip pure ASCII diagrams / REPL-transcript / output samples.
    # A runnable block starts with '(' or a comment then '(' somewhere.
    return "(" in s and ")" in s

total = passed = failed = skipped = 0
failures = []
for path in sorted(BOOK.glob("*.slatl")):
    for ln, code in blocks(path):
        total += 1
        if not looks_runnable(code):
            skipped += 1
            continue
        rc, out = run(code)
        if rc == 0:
            passed += 1
        else:
            failed += 1
            failures.append((path.name, ln, code, out.strip()))

print(f"blocks={total} runnable-pass={passed} FAIL={failed} skipped(non-code)={skipped}\n")
for name, ln, code, out in failures:
    print(f"===== {name}:{ln} =====")
    print(code)
    print("--- error ---")
    print(out[:600])
    print()
