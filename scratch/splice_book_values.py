#!/usr/bin/env python3
"""
splice_book_values.py — CPT plan step 6.

Rewrites stale `; => <claim>` annotations in the books to what the interpreter
actually prints. Deterministic: the value comes from audit-books-values.json,
which got it by RUNNING the block. No model, no guessing.

A splice only fires when the target is unambiguous. Every claim is located by
BOTH its code line and its claim text, and the pair must occur exactly once in
the file. Anything ambiguous is reported, never guessed.

Categories (see --report):
  exactness-only   claim and value differ only in numeric exactness (1 vs 1.0)
  whitespace-only  identical modulo spacing
  number-differs   both are bare numbers
  structure-differs  both are lists, shapes differ
  engine-empty     the engine printed nothing
  prose-claim      the "claim" is English, not a value ("(no return value)")
  other            everything else

--apply defaults to the SAFE set only. Widen with --classes.
"""
import argparse, json, re, sys, shutil
from pathlib import Path
from datetime import datetime

REPO = Path("/Users/alfred/code/motoi-scheme")
BOOKS = REPO / "scheme-books"
AUDIT = REPO / "scratch" / "audit-books-values.json"

SAFE = ("exactness-only", "whitespace-only", "number-differs")

# An English description where a value belongs. Splicing these to a value is
# usually right, but it changes prose, so it is never in the default set.
PROSE_RE = re.compile(r"^\(?(no return value|unspecified|undefined|prints?\b|"
                      r"depends|varies|implementation)", re.I)


def norm_num(s: str) -> str:
    def f(mo):
        t = mo.group(0)
        try:
            v = float(t)
        except ValueError:
            return t
        return str(int(v)) if v == int(v) else repr(v)
    return re.sub(r"-?\d+\.?\d*(?:[eE]-?\d+)?", f, s)


def classify(claim: str, value: str, printed: str) -> str:
    c, v = claim.strip(), value.strip()
    if PROSE_RE.match(c):
        return "prose-claim"
    if not v and not printed:
        return "engine-empty"
    if c.replace(" ", "") == v.replace(" ", ""):
        return "whitespace-only"
    if norm_num(c) == norm_num(v):
        return "exactness-only"
    if c.endswith("...") and v.startswith(c[:-3]):
        return "elision"          # `0.974...` — the book is deliberately short
    if re.fullmatch(r"-?[\d.]+", c) and re.fullmatch(r"-?[\d.]+", v):
        return "number-differs"
    if c[:1] == "(" and v[:1] == "(":
        return "structure-differs"
    return "other"


def splice_one(text: str, code: str, claim: str, value: str):
    """Return (new_text, note). Only rewrites an unambiguous single target."""
    # The claim sits after `; =>` either on the code line or the line below it.
    code_key = code.strip().splitlines()[-1].strip() if code.strip() else ""
    esc_claim = re.escape(claim.strip())

    # Form A: same line as the code.
    if code_key:
        pat_a = re.compile(
            r"(?m)^(?P<pre>\s*" + re.escape(code_key) + r"\s*;+\s*=>\s*)"
            + esc_claim + r"(?P<post>\s*)$")
        hits = list(pat_a.finditer(text))
        if len(hits) == 1:
            h = hits[0]
            return (text[:h.start()] + h.group("pre") + value + h.group("post")
                    + text[h.end():]), "line"
        if len(hits) > 1:
            return None, f"ambiguous-line({len(hits)})"

    # Form B: `; => claim` on its own line, directly after the code line.
    if code_key:
        pat_b = re.compile(
            r"(?m)^(?P<code>\s*" + re.escape(code_key) + r"\s*)$\n"
            r"(?P<pre>\s*;+\s*=>\s*)" + esc_claim + r"(?P<post>\s*)$")
        hits = list(pat_b.finditer(text))
        if len(hits) == 1:
            h = hits[0]
            return (text[:h.start()] + h.group("code") + "\n" + h.group("pre")
                    + value + h.group("post") + text[h.end():]), "ownline"
        if len(hits) > 1:
            return None, f"ambiguous-ownline({len(hits)})"

    return None, "not-found"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--classes", default=",".join(SAFE))
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    audit = json.loads(AUDIT.read_text())
    rows = [x for x in audit["mismatches"] if x["verdict"] == "mismatch"]
    for x in rows:
        x["cls"] = classify(x["claim"] or "", x["value"] or "", x.get("printed") or "")

    want = {c.strip() for c in args.classes.split(",") if c.strip()}

    from collections import Counter, defaultdict
    print("== classes ==")
    for k, v in Counter(x["cls"] for x in rows).most_common():
        mark = "*" if k in want else " "
        print(f" {mark} {v:5d}  {k}")

    if args.report:
        out = defaultdict(list)
        for x in rows:
            out[x["cls"]].append(x)
        (REPO / "scratch" / "mismatch-buckets.json").write_text(
            json.dumps(out, indent=1))
        print("  -> scratch/mismatch-buckets.json")

    targets = [x for x in rows if x["cls"] in want]
    print(f"\n== targeted: {len(targets)} ==")

    by_file = defaultdict(list)
    for x in targets:
        by_file[x["file"]].append(x)

    stamp = datetime.now().strftime("%Y-%m-%dT%H%M")
    applied = skipped = 0
    notes = Counter()
    detail = []
    for rel, items in sorted(by_file.items()):
        p = BOOKS / rel
        if not p.exists():
            print(f"  MISSING {rel}")
            continue
        text = orig = p.read_text()
        for x in items:
            new, note = splice_one(text, x["code"], x["claim"], x["value"])
            notes[note] += 1
            if new is None:
                skipped += 1
                detail.append({**{k: x[k] for k in ("file", "key", "claim", "value", "code")},
                               "note": note})
                continue
            text = new
            applied += 1
        if args.apply and text != orig:
            bak = p.with_suffix(p.suffix + f".bak-{stamp}")
            shutil.copy2(p, bak)
            p.write_text(text)

    print(f"  spliced: {applied}   skipped: {skipped}")
    for k, v in notes.most_common():
        print(f"    {v:5d}  {k}")
    (REPO / "scratch" / "splice-skipped.json").write_text(json.dumps(detail, indent=1))
    print("  -> scratch/splice-skipped.json")
    if not args.apply:
        print("\n  DRY RUN — nothing written. Re-run with --apply.")


if __name__ == "__main__":
    main()
