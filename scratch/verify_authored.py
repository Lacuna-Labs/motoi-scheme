#!/usr/bin/env python3
"""verify_authored — run every hand-authored grid cell through the interpreter.

I write the programs. The interpreter says whether they are true. Same interlock
as the generator had; the only thing that changed is who proposes.

Checks per cell: runs clean · deterministic across two runs · non-degenerate
output · does not redefine the verb · actually calls the verb · row-4 must be
all #t · row-3 rungs must be distinct · no two cells in a verb print the same.

  ~/code/forge/.venv/bin/python3 scratch/verify_authored.py
  ~/code/forge/.venv/bin/python3 scratch/verify_authored.py --emit
"""
import json, re, subprocess, tempfile, os, pathlib, sys, argparse

AUTH = pathlib.Path("scratch/authored")
DEGENERATE = {"", "()", "#<unspecified>"}


def run_motoi(src, timeout=25):
    with tempfile.NamedTemporaryFile("w", suffix=".scm", delete=False) as f:
        f.write(src); tmp = f.name
    try:
        p = subprocess.run(["./bin/motoi", "run", tmp], capture_output=True,
                           text=True, timeout=timeout,
                           env={**os.environ, "MOTOI_HOME": "/tmp/mx"})
        err = p.stdout + p.stderr
        bad = p.returncode != 0 or "error:" in err.lower()
        d = re.search(r"(?i)(error:.*)", err)
        return (not bad), p.stdout.strip(), (d.group(1).strip()[:160] if bad and d else "")
    except subprocess.TimeoutExpired:
        return False, "", "timed out"
    finally:
        os.unlink(tmp)


def check(cell, src, verb, seen):
    row = cell.split("|")[0]
    v = re.escape(verb)
    if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
        return None, f"redefines `{verb}`"
    if not re.search(rf"\(\s*{v}[\s)]", src):
        return None, f"never calls `{verb}`"
    ok, o1, detail = run_motoi(src)
    if not ok:
        return None, f"failed to run: {detail}"
    if o1 in DEGENERATE:
        return None, f"degenerate output {o1!r}"
    ok2, o2, _ = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "non-deterministic"
    # row-4 is exempt from output-distinctness: three DIFFERENT invariants that
    # all hold must all print all-#t. Distinctness there is checked on the
    # predicate text instead, in main().
    if row != "row-4-proof" and o1 in seen:
        return None, f"duplicate output {o1!r} (same as {seen[o1]})"
    if row == "row-4-proof" and "#f" in o1:
        return None, f"invariant does not hold: {o1}"
    if row == "row-3-dimension":
        parts = o1.strip("()").split()
        if len(set(parts)) < len(parts):
            return None, f"ladder rungs not distinct: {o1}"
    return o1, "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=[])
    args = ap.parse_args()

    files = sorted(AUTH.glob("*.json"))
    if args.only:
        files = [f for f in files if f.stem in args.only]
    if not files:
        sys.exit(f"no authored files in {AUTH}")

    grand_ok = grand_bad = 0
    for path in files:
        d = json.loads(path.read_text())
        verb, cells = d["verb"], d["cells"]
        seen, ok_n, bad = {}, 0, []
        print(f"\n=== {verb}  ({d['file']})  {len(cells)} cells")
        for cell, src in cells.items():
            out, why = check(cell, src, verb, seen)
            if out is None:
                bad.append((cell, why))
                print(f"  FAIL {cell}: {why}")
                continue
            seen[out] = cell; ok_n += 1
            d.setdefault("outputs", {})[cell] = out
            print(f"  ok   {cell:38s} -> {out[:52]}")
        # row-4: the three invariants must differ even though outputs match
        preds = {c: s for c, s in cells.items() if c.startswith("row-4-proof")}
        norm = {c: re.sub(r"\s+", " ", s.split("(display")[0]) for c, s in preds.items()}
        if len(set(norm.values())) < len(norm):
            bad.append(("row-4-proof", "two proofs assert the SAME invariant"))
            print("  FAIL row-4-proof: two proofs assert the same invariant")
        grand_ok += ok_n; grand_bad += len(bad)
        print(f"  -- {verb}: {ok_n}/{len(cells)} verified")
        if not bad:
            path.write_text(json.dumps(d, indent=2))

    print(f"\nVERIFIED {grand_ok}/{grand_ok + grand_bad}")
    if grand_bad:
        print("Outputs were NOT written for files with failures — fix and re-run.")
        sys.exit(1)


if __name__ == "__main__":
    main()
