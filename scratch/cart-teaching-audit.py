#!/usr/bin/env python3
"""Audit every top-level carts/*.sks for the Lane-7 teaching payload.

A cart teaches the model to make games only if it carries, in the file itself:
  1. metadata alist header  (:name :category ... :verbs-used :inspiration)
  2. HOW TO RUN line
  3. prose description       (WHAT THIS IS / paragraph of plain-English intent)
  4. labelled build-up sections (state / helpers / tick|step / policy|ai / render|draw / driver)
  5. explanatory 'why' narration (inline comments beyond section labels)
  6. it RUNS clean through the interpreter.

Emits a table + a JSON summary. No fabrication, no edits — audit only.
"""
import os, re, subprocess, json, sys

ROOT = "/Users/alfred/code/motoi-scheme"
CARTS = os.path.join(ROOT, "carts")
MOTOI = os.path.join(ROOT, "bin", "motoi")

SECTION_WORDS = ["state", "helper", "tick", "step", "policy", "ai", "brain",
                 "render", "draw", "board", "driver", "loop", "main", "update"]

def analyze(path):
    src = open(path, "r", errors="replace").read()
    lines = src.splitlines()
    header = "\n".join(lines[:80]).lower()
    comment_lines = [l for l in lines if l.strip().startswith(";;")]
    # section dividers like ";; ---- render ----" or ";; RENDER"
    section_labels = set()
    for l in comment_lines:
        low = l.lower()
        if re.search(r";;\s*[-=]+", low) or re.search(r";;\s*[a-z].*[-=]+", low):
            for w in SECTION_WORDS:
                if re.search(r"\b" + w, low):
                    section_labels.add(w)
        else:
            for w in SECTION_WORDS:
                if re.search(r";;\s*" + w + r"\b", low):
                    section_labels.add(w)
    has_meta   = (":name" in header and ":category" in header)
    has_verbs  = (":verbs-used" in header)
    has_inspir = (":inspiration" in header)
    has_howto  = ("how to run" in header)
    # prose = a run of >=2 consecutive comment lines that are sentences (contain a space, not a divider, not an alist key)
    prose_runs, run = 0, 0
    for l in comment_lines:
        s = l.strip().lstrip(";").strip()
        is_sentence = (len(s.split()) >= 4 and not s.startswith(":")
                       and not re.match(r"^-+$", s) and "(cart" not in s
                       and not s.startswith("motoi run"))
        if is_sentence:
            run += 1
            prose_runs = max(prose_runs, run)
        else:
            run = 0
    has_prose = prose_runs >= 3
    # inline explanatory comments = comment lines that are NOT in the first 80 (header) region
    body_comments = [l for l in lines[80:] if l.strip().startswith(";;")]
    inline_explain = len(body_comments)
    return {
        "meta": has_meta, "verbs": has_verbs, "inspiration": has_inspir,
        "howto": has_howto, "prose": has_prose,
        "sections": sorted(section_labels), "n_sections": len(section_labels),
        "inline_comments": inline_explain,
        "total_lines": len(lines), "comment_lines": len(comment_lines),
    }

def runs(path):
    try:
        r = subprocess.run([MOTOI, "run", path], capture_output=True,
                           text=True, timeout=60)
        out = (r.stdout + r.stderr)
        bad = ("unbound symbol" in out.lower() or "error" in out.lower()
               or "exception" in out.lower())
        return (r.returncode == 0 and not bad), out.strip().splitlines()[-1][:70] if out.strip() else ""
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT>60s"
    except Exception as e:
        return False, f"EXC {e}"

def main():
    carts = sorted(f for f in os.listdir(CARTS)
                   if f.endswith(".sks") and os.path.isfile(os.path.join(CARTS, f)))
    rows = []
    print(f"{'cart':<26} meta vrb ins how pro sec inln  runs  note")
    print("-" * 92)
    for c in carts:
        p = os.path.join(CARTS, c)
        a = analyze(p)
        ok, note = runs(p)
        def m(b): return " ✓ " if b else " · "
        print(f"{c:<26}{m(a['meta'])}{m(a['verbs'])}{m(a['inspiration'])}"
              f"{m(a['howto'])}{m(a['prose'])} {a['n_sections']:>2} {a['inline_comments']:>4}  "
              f"{'RUN ' if ok else 'FAIL'}  {note}")
        rows.append({"cart": c, **a, "runs": ok, "note": note})
    # gaps summary
    print("\n=== GAPS (missing any of: meta/howto/prose/sections>=3/runs) ===")
    for r in rows:
        gaps = []
        if not r["meta"]: gaps.append("meta")
        if not r["howto"]: gaps.append("howto")
        if not r["prose"]: gaps.append("prose")
        if r["n_sections"] < 3: gaps.append(f"sections={r['n_sections']}")
        if not r["verbs"]: gaps.append("verbs-used")
        if not r["inspiration"]: gaps.append("inspiration")
        if not r["runs"]: gaps.append("RUNS")
        if gaps:
            print(f"  {r['cart']:<26} -> {', '.join(gaps)}")
    open(os.path.join(ROOT, "scratch", "cart-teaching-audit.json"), "w").write(json.dumps(rows, indent=2))
    n_run = sum(1 for r in rows if r["runs"])
    print(f"\nTOTAL {len(rows)} carts · runs {n_run}/{len(rows)} · "
          f"full-teaching {sum(1 for r in rows if r['meta'] and r['howto'] and r['prose'] and r['n_sections']>=3 and r['runs'])}/{len(rows)}")

if __name__ == "__main__":
    main()
