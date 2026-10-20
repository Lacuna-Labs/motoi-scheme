#!/usr/bin/env python3
"""Eval harness for the Motoi SCHEME DOCUMENTS (not the reference).

Targets: Scheme/TUTORIAL.html + Scheme/*.slat (REPL, REPL-FEATURES, REFERENCE-ALIASES).
Extracts every runnable code block, runs it through ./bin/motoi run, reports PASS/FAIL.
"""
import html, re, subprocess, sys, os, json
from pathlib import Path

ROOT = Path("/Users/alfred/code/motoi-scheme")
MOTOI = ROOT / "bin" / "motoi"

def run_block(code):
    try:
        p = subprocess.run([str(MOTOI), "run", "/dev/stdin"],
                           input=code, capture_output=True, text=True,
                           timeout=30, cwd=str(ROOT))
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "TIMEOUT (30s)"

def first_err(stderr):
    for line in stderr.splitlines():
        line = line.strip()
        if line:
            return line[:160]
    return ""

def looks_runnable(code):
    """A block is a candidate if it has a top-level s-expression and no obvious shell/npm."""
    s = code.strip()
    if not s:
        return False
    # skip shell / npm / directory-listing blocks
    first = next((l for l in s.splitlines() if l.strip()), "")
    if re.match(r'^\s*(npm|node|\$|#|curl|cd |ls |git |curator-web/)', first):
        return False
    # must contain a paren form somewhere
    return "(" in s

def extract_html(path):
    txt = path.read_text()
    blocks = re.findall(r'<pre><code class="scheme">(.*?)</code></pre>', txt, re.S)
    return [html.unescape(b) for b in blocks]

def extract_slat_code(path):
    """Pull (code-block ... :source "...") sources whose lang is scheme/motoi/empty."""
    txt = path.read_text()
    out = []
    # crude but effective: find code-block forms with lang + source
    for m in re.finditer(r'\(code-block\b(.*?):source\s+"((?:[^"\\]|\\.)*)"', txt, re.S):
        head, src = m.group(1), m.group(2)
        lang_m = re.search(r':lang\s+"([^"]*)"', head)
        lang = lang_m.group(1) if lang_m else ""
        if lang in ("scheme", "motoi", ""):
            code = src.encode().decode("unicode_escape")
            out.append((lang, code))
    return out

def main():
    results = []
    # --- TUTORIAL.html ---
    tut = ROOT / "Scheme" / "TUTORIAL.html"
    for i, code in enumerate(extract_html(tut), 1):
        runnable = looks_runnable(code)
        if not runnable:
            results.append(("TUTORIAL.html", i, "SKIP", "shell/listing/non-code", code.strip().splitlines()[0][:70] if code.strip() else ""))
            continue
        rc, out, err = run_block(code)
        status = "PASS" if rc == 0 else "FAIL"
        results.append(("TUTORIAL.html", i, status, first_err(err) if rc else "", code.strip().splitlines()[0][:70]))
    # --- slat docs ---
    for name in ("REPL.slat", "REPL-FEATURES.slat", "REFERENCE-ALIASES.slat"):
        p = ROOT / "Scheme" / name
        blocks = extract_slat_code(p)
        if not blocks:
            results.append((name, 0, "NONE", "no scheme code_blocks (prose/transcripts only)", ""))
            continue
        for i, (lang, code) in enumerate(blocks, 1):
            if not looks_runnable(code):
                results.append((name, i, "SKIP", f"lang={lang or 'none'} transcript/config", code.strip().splitlines()[0][:70] if code.strip() else ""))
                continue
            rc, out, err = run_block(code)
            status = "PASS" if rc == 0 else "FAIL"
            results.append((name, i, status, first_err(err) if rc else "", code.strip().splitlines()[0][:70]))

    # report
    print(f"{'DOC':<24} {'#':>3} {'STATUS':<6} FIRST-LINE / ERROR")
    print("-" * 100)
    counts = {}
    for doc, i, status, err, head in results:
        counts[status] = counts.get(status, 0) + 1
        detail = head if status in ("PASS",) else (err or head)
        print(f"{doc:<24} {i:>3} {status:<6} {detail}")
    print("-" * 100)
    print("TOTALS:", json.dumps(counts))
    # dump full json for detail
    (ROOT / "scratch" / "eval-scheme-docs-results.json").write_text(
        json.dumps([{"doc":d,"n":i,"status":s,"err":e,"head":h} for d,i,s,e,h in results], indent=2))

if __name__ == "__main__":
    main()
