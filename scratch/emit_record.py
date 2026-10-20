#!/usr/bin/env python3
"""emit_record — verify a hand-authored verb record, then write it into its chapter.

A record lives in scratch/records/<slug>.json. Every program in it is run twice
through ./bin/motoi run before a single byte is appended to the chapter file.
Nothing is written if any program fails.

  ~/code/forge/.venv/bin/python3 scratch/emit_record.py --check           # verify only
  ~/code/forge/.venv/bin/python3 scratch/emit_record.py --emit <slug>...  # verify + append
"""
import json, os, re, subprocess, sys, tempfile, pathlib, argparse, datetime

REC = pathlib.Path("scratch/records")
CHAP = pathlib.Path("scheme/reference")
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


def programs(rec):
    """Every runnable slot in the record, as (label, code)."""
    out = [(f"example-{e['tier']}", e["code"]) for e in rec["examples"]]
    for row, keys in (("row-2-audit", ("eng-program", "math-program", "cs-program")),
                      ("row-4-proof", ("eng-program", "math-program", "cs-program")),
                      ("row-5-emergence", ("eng-composition", "math-composition", "cs-composition"))):
        for k in keys:
            out.append((f"{row}|{k}", rec[row][k]))
    for i, r in enumerate(rec["row-3-dimension"]["rungs"]):
        out.append((f"row-3-dimension|rung-{i+1}", r["code"]))
    return out


def check(rec):
    verb, bad, seen = rec["name"], [], {}
    v = re.escape(verb)
    for label, src in programs(rec):
        if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
            bad.append((label, f"redefines `{verb}`")); continue
        if not re.search(rf"[(\s]{v}[\s)]", src):
            bad.append((label, f"never mentions `{verb}`")); continue
        ok, o1, detail = run_motoi(src)
        if not ok:
            bad.append((label, f"failed: {detail}")); continue
        if o1 in DEGENERATE:
            bad.append((label, f"degenerate output {o1!r}")); continue
        ok2, o2, _ = run_motoi(src)
        if not ok2 or o1 != o2:
            bad.append((label, "non-deterministic")); continue
        if label.startswith("row-4-proof") and "#f" in o1:
            bad.append((label, f"invariant does not hold: {o1}")); continue
        if not label.startswith("row-4-proof"):
            if o1 in seen:
                bad.append((label, f"duplicate output (same as {seen[o1]})")); continue
        seen[o1] = label
        rec.setdefault("_outputs", {})[label] = o1
    rungs = [re.sub(r"\s+", " ", r["code"]) for r in rec["row-3-dimension"]["rungs"]]
    if len(set(rungs)) < len(rungs):
        bad.append(("row-3-dimension", "two rungs are the same program"))
    p4 = [re.sub(r"\s+", " ", rec["row-4-proof"][k].split("(display")[0])
          for k in ("eng-program", "math-program", "cs-program")]
    if len(set(p4)) < len(p4):
        bad.append(("row-4-proof", "two proofs assert the same invariant"))
    return bad


# ── SLAT rendering ────────────────────────────────────────────────────────
def s(x):
    return '"' + x.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def lst(xs, indent):
    if not xs:
        return "()"
    pad = " " * indent
    return "(" + ("\n" + pad).join(s(x) for x in xs) + ")"


def render(r):
    L = []
    a = L.append
    a("(verb")
    a(f'  :name {s(r["name"])}' + (f' :std {s(r["std"])}' if r.get("std") else ""))
    a(f'  :library {s(r["library"])}')
    a(f'  :tier {s(r.get("tier", "core"))}')
    a(f'  :kind {s(r.get("kind", "pure"))}')
    a(f'  :signature {s(r["signature"])}')
    a(f'  :summary {s(r["summary"])}')
    a(f'  :explanation {s(r["explanation"])}')
    a("  :examples (")
    for e in r["examples"]:
        a(f'    (:dialect "motoi" :tier {s(e["tier"])} :code {s(e["code"])} :note {s(e["note"])})')
    a("  )")
    a(f'  :caveats {lst(r["caveats"], 12)}')
    a(f'  :usecases {lst(r["usecases"], 13)}')
    a(f'  :related {lst(r["related"], 12)}')
    lr = r["learn"]
    a(f'  :learn (:concept {s(lr["concept"])} :prerequisites {lst(lr.get("prerequisites", []), 4)} '
      f':progression {s(lr["progression"])})')
    a(f'  :provenance {s(r["provenance"])}')

    r2 = r["row-2-audit"]
    a("  :row-2-audit (")
    a(f'    (:eng-program {s(r2["eng-program"])}')
    a(f'     :math-program {s(r2["math-program"])}')
    a(f'     :cs-program {s(r2["cs-program"])}')
    a(f'     :problem {s(r2["problem"])}')
    a(f'     :explanation {s(r2["explanation"])}')
    a(f'     :meta {s(r2["meta"])})')
    a(f'    (:eng {s(r2["eng"])}')
    a(f'     :math {s(r2["math"])}')
    a(f'     :cs {s(r2["cs"])}))')

    r3 = r["row-3-dimension"]
    a("  :row-3-dimension (")
    a(f'    (:setup {s(r3["setup"])}')
    a("     :rungs (" + "\n             ".join(
        f'(:domain {s(g["domain"])} :code {s(g["code"])})' for g in r3["rungs"]) + ")")
    a(f'     :explanation {s(r3["explanation"])}')
    a(f'     :meta {s(r3["meta"])})')
    a(f'    (:eng {s(r3["eng"])}')
    a(f'     :math {s(r3["math"])}')
    a(f'     :cs {s(r3["cs"])}))')

    r4 = r["row-4-proof"]
    a("  :row-4-proof (")
    a(f'    (:eng-program {s(r4["eng-program"])}')
    a(f'     :math-program {s(r4["math-program"])}')
    a(f'     :cs-program {s(r4["cs-program"])}')
    a(f'     :claim {s(r4["claim"])}')
    a(f'     :invariant {s(r4["invariant"])}')
    a(f'     :meta {s(r4["meta"])})')
    a(f'    (:eng {s(r4["eng"])}')
    a(f'     :math {s(r4["math"])}')
    a(f'     :cs {s(r4["cs"])}))')

    r5 = r["row-5-emergence"]
    a("  :row-5-emergence (")
    a(f'    (:eng-composition {s(r5["eng-composition"])}')
    a(f'     :math-composition {s(r5["math-composition"])}')
    a(f'     :cs-composition {s(r5["cs-composition"])}')
    a(f'     :base {s(r5["base"])}')
    a(f'     :emergent {s(r5["emergent"])}')
    a(f'     :meta {s(r5["meta"])})')
    a(f'    (:eng {s(r5["eng"])}')
    a(f'     :math {s(r5["math"])}')
    a(f'     :cs {s(r5["cs"])}))')
    a(")")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--emit", action="store_true")
    args = ap.parse_args()

    files = sorted(REC.glob("*.json"))
    if args.slugs:
        files = [f for f in files if f.stem in args.slugs]
    if not files:
        sys.exit("no records")

    n_ok = 0
    for path in files:
        r = json.loads(path.read_text())
        bad = check(r)
        if bad:
            print(f"FAIL {r['name']}")
            for lab, why in bad:
                print(f"     {lab}: {why}")
            continue
        n_ok += 1
        path.write_text(json.dumps(r, indent=2))
        if args.emit:
            tgt = CHAP / r["chapter"]
            if not tgt.exists():
                print(f"FAIL {r['name']}: no chapter {r['chapter']}"); continue
            if re.search(rf'^\s*:name "{re.escape(r["name"])}"', tgt.read_text(), re.M):
                print(f"skip {r['name']}: already in {r['chapter']}"); continue
            bak = tgt.with_suffix(tgt.suffix + ".bak-" + datetime.datetime.now().strftime("%Y%m%dT%H%M%S"))
            if not any(tgt.parent.glob(tgt.name + ".bak-*")):
                bak.write_text(tgt.read_text())
            with tgt.open("a") as f:
                f.write("\n" + render(r))
            print(f"ok   {r['name']:28s} 15/15 -> {r['chapter']}")
        else:
            print(f"ok   {r['name']:28s} 15/15 (not emitted)")
    print(f"\n{n_ok}/{len(files)} records at 15/15")
    sys.exit(0 if n_ok == len(files) else 1)


if __name__ == "__main__":
    main()
