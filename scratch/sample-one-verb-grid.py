#!/usr/bin/env python3
"""sample-one-verb-grid — have the local model fill ONE verb's full 15-slot grid
so Alfred can judge the quality before anything runs at scale.

The 15 slots, per the schema of a complete record (see `sqrt` in 40-math.slat):
    3  :examples          novice / intermediate / expert  (already authored)
    3  :row-2-audit       eng- / math- / cs-program  + :problem
    3  :row-3-dimension   a ladder of :rungs, each :domain + :code
    3  :row-4-proof       eng- / math- / cs-program  + :claim + :invariant
    3  :row-5-emergence   eng- / math- / cs-composition + :base + :emergent

Every generated program is graded by `./bin/motoi run`, twice, and is discarded
if it errors, prints nothing, drifts between runs, or repeats another program's
output. The model never certifies its own work.

  ~/code/forge/.venv/bin/python3 scratch/sample-one-verb-grid.py --verb clamp
"""
import argparse, json, re, subprocess, tempfile, os, pathlib

REF = pathlib.Path("scheme/reference")
MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"

ROWS = {
    "row-2-audit": (
        ["eng-program", "math-program", "cs-program"],
        "An operator faces a real decision and must pick a tool. The eng program "
        "solves a concrete engineering task; the math program checks the verb's "
        "mathematical behaviour across a set of inputs; the cs program probes the "
        "edge cases and failure modes a programmer would hit."),
    "row-3-dimension": (
        ["eng-program", "math-program", "cs-program"],
        "A ladder from the bare number up to a real-world domain. The first is the "
        "plainest numeric use; the second applies it to a physical or engineering "
        "quantity; the third embeds it in a named domain function."),
    "row-4-proof": (
        ["eng-program", "math-program", "cs-program"],
        "Each program CHECKS an invariant and prints booleans or a comparison, "
        "demonstrating that a property holds across many inputs. Not a demo -- a "
        "verification."),
    "row-5-emergence": (
        ["eng-composition", "math-composition", "cs-composition"],
        "The verb composed INSIDE a larger function that does something useful on "
        "its own. The verb should be a component, not the headline."),
}


def get_record(verb):
    for path in sorted(REF.glob("*.slat")):
        text = path.read_text()
        starts = [m.start() for m in re.finditer(r"(?m)^\(verb\b", text)]
        for i, s in enumerate(starts):
            e = starts[i + 1] if i + 1 < len(starts) else len(text)
            blk = text[s:e]
            if re.search(rf':name\s+"{re.escape(verb)}"', blk):
                return path.name, blk
    raise SystemExit(f"verb {verb} not found")


def field(blk, key):
    m = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', blk)
    return m.group(1).encode().decode("unicode_escape") if m else ""


def run_motoi(src, timeout=25):
    with tempfile.NamedTemporaryFile("w", suffix=".scm", delete=False) as f:
        f.write(src); tmp = f.name
    try:
        p = subprocess.run(["./bin/motoi", "run", tmp], capture_output=True,
                           text=True, timeout=timeout,
                           env={**os.environ, "MOTOI_HOME": "/tmp/mx"})
        bad = p.returncode != 0 or "error:" in (p.stdout + p.stderr).lower()
        return (not bad), p.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, ""
    finally:
        os.unlink(tmp)


DEGENERATE = {"", "()", "#<unspecified>"}


def structural_check(src, verb):
    """The gate the interpreter cannot provide.

    The first sample had 6 of 7 'passing' programs open with
    `(define (clamp x lo hi) (min hi (max lo x)))` -- shadowing the builtin and
    then testing their own copy. Those run clean and deterministically while
    demonstrating nothing about the verb: if Motoi's clamp broke, they would
    still pass. A run-only gate cannot see this. This one can.
    """
    v = re.escape(verb)
    if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
        return f"redefines {verb} -- shadows the builtin"
    if not re.search(rf"\(\s*{v}[\s)]", src):
        return f"never calls {verb}"
    # displaying bare literals is how the model faked a 'ladder'
    if len(re.findall(r"\(display\s+-?[0-9]+\s*\)", src)) >= 1:
        return "displays a bare literal"
    return None


def grade(src, seen, verb):
    bad = structural_check(src, verb)
    if bad:
        return None, bad
    ok1, o1 = run_motoi(src)
    if not ok1:
        return None, "errored"
    if o1 in DEGENERATE:
        return None, f"degenerate {o1!r}"
    ok2, o2 = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "non-deterministic"
    if o1 in seen:
        return None, f"duplicate {o1!r}"
    return o1, "ok"


PROMPT = """You are writing the reference manual entry for the Motoi Scheme verb `{verb}`.

Signature: {sig}
Summary:   {summary}
What the manual already says about its behaviour and traps:
{explanation}

Existing worked examples (do NOT repeat these):
{examples}

You are filling the section `:{row}`.
Its purpose: {intent}

Write exactly 3 programs, for these slots in order: {slots}.

Rules:
- `{verb}` is ALREADY BUILT IN. NEVER define or redefine it. Just call it.
- Do not `display` bare literal numbers. Display ONE expression per program;
  use `(list ...)` to show several values at once, and end with `(newline)`.
- Deterministic: no randomness, no clocks, no input, no graphics.
- Each must print a DIFFERENT result and teach something the others do not.
- Real programs, 3-8 lines. Use define. No trivial one-liners.
- Prefer inputs that expose the verb's real behaviour, including its traps.

Return ONLY a JSON object mapping each slot name to its program string.
No prose, no markdown fences."""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verb", default="clamp")
    args = ap.parse_args()

    fname, blk = get_record(args.verb)
    sig, summary, expl = field(blk, "signature"), field(blk, "summary"), field(blk, "explanation")
    examples = "\n".join(f"  {c}" for c in re.findall(r':code\s+"((?:[^"\\]|\\.)*)"', blk))

    from mlx_lm import load, generate
    print(f"verb={args.verb}  file={fname}\nloading {MODEL} ...", flush=True)
    model, tok = load(MODEL)

    result, seen, kept, dropped = {}, set(), 0, 0
    for row, (slots, intent) in ROWS.items():
        msgs = [{"role": "user", "content": PROMPT.format(
            verb=args.verb, sig=sig, summary=summary, explanation=expl,
            examples=examples, row=row, intent=intent, slots=", ".join(slots))}]
        prompt = tok.apply_chat_template(msgs, add_generation_prompt=True)
        raw = generate(model, tok, prompt=prompt, max_tokens=1600, verbose=False)
        m = re.search(r"\{.*\}", raw, re.S)
        try:
            obj = json.loads(m.group(0)) if m else {}
        except Exception:
            obj = {}
        result[row] = {}
        for slot in slots:
            src = str(obj.get(slot, "")).strip()
            if not src:
                dropped += 1; print(f"  DROP {row}.{slot}: model returned nothing"); continue
            out, why = grade(src, seen, args.verb)
            if out is None:
                dropped += 1; print(f"  DROP {row}.{slot}: {why}"); continue
            seen.add(out); kept += 1
            result[row][slot] = {"program": src, "actual_output": out}
            print(f"  KEEP {row}.{slot}  -> {out[:64]}")

    out_path = pathlib.Path(f"scratch/sample-grid-{args.verb.replace('/','-')}.json")
    out_path.write_text(json.dumps({"verb": args.verb, "file": fname,
                                    "kept": kept, "dropped": dropped,
                                    "rows": result}, indent=2))
    print(f"\nkept={kept}/12  dropped={dropped}  -> {out_path}")
    print("NOTHING written into scheme/reference/.")


if __name__ == "__main__":
    main()
