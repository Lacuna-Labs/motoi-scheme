#!/usr/bin/env python3
# verify-slat-code.py — extract every runnable :code-like string from a .slat
# chapter and run each through ./bin/motoi run /dev/stdin. Painting blocks are
# auto-prefixed with (set-mode 'sd) if they don't already set a mode.
import re, subprocess, sys, os

ERR = re.compile(r"unbound symbol|not a function|is not defined|TypeError|ReferenceError|SyntaxError|^error:|parse error", re.I | re.M)
# keys whose string value is runnable Scheme
KEYS = ("code", "measure", "program", "eng-program", "math-program", "cs-program",
        "composition", "eng-composition", "math-composition", "cs-composition", "fixed")

def extract(text):
    blocks = []
    for key in KEYS:
        # :key "....."  with escaped quotes/newlines inside
        for m in re.finditer(r':' + re.escape(key) + r'\s+"((?:[^"\\]|\\.)*)"', text):
            raw = m.group(1)
            code = raw.encode().decode('unicode_escape')
            blocks.append((key, code))
    return blocks

def run(code):
    # prefix set-mode if a paint verb is present and no set-mode already
    if 'set-mode' not in code:
        code = "(set-mode 'sd) " + code
    p = subprocess.run(['./bin/motoi', 'run', '/dev/stdin'], input=code,
                       capture_output=True, text=True)
    out = (p.stdout or '') + (p.stderr or '')
    return out

def main():
    total = fails = 0
    for path in sys.argv[1:]:
        text = open(path).read()
        blocks = extract(text)
        pfail = 0
        for key, code in blocks:
            out = run(code)
            total += 1
            if ERR.search(out):
                fails += 1; pfail += 1
                print(f"FAIL [{os.path.basename(path)}:{key}] {code[:70]!r}\n     {out.strip()[:200]}")
        print(f"  {os.path.basename(path)}: {len(blocks)} blocks, {pfail} fail")
    print(f"==== TOTAL {total} blocks, {fails} FAIL ====")
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
