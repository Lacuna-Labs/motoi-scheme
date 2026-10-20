#!/usr/bin/env python3
"""fill-reference-slots — generate the missing reference programs with a LOCAL
model, and let the interpreter decide what survives.

Doctrine, in order of authority:
  1. The model PROPOSES a program. It never certifies one.
  2. `./bin/motoi run` GRADES it. A program that errors is discarded.
  3. A program is run TWICE. If the two runs differ it is non-deterministic and
     is discarded — a stale/unrepeatable row is the failure that cost us before.
  4. The :note is written FROM the captured stdout, never from the model's claim
     about what the program prints. This is the anti-fabrication interlock.

Nothing is written into scheme/reference/. Output is a staging JSONL for review.

  ~/code/forge/.venv/bin/python3 scratch/fill-reference-slots.py --limit 3
"""
import argparse, json, re, subprocess, tempfile, os, pathlib, sys

REF = pathlib.Path("scheme/reference")
OUT = pathlib.Path("scratch/generated-reference-slots.jsonl")
MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"

# Group A only — deterministic, machine-gradable. Group B (world/input/time/
# game verbs) needs a live world; "it ran" would not mean "it is right" there,
# so those are deliberately NOT generated.
GROUP_A = {
    "alg/permutation-cycles", "alg/permutation-compose", "topo/euler-characteristic",
    "real-part", "imag-part", "magnitude", "angle", "make-rectangular", "make-polar",
    "pi", "ceil", "sign", "clamp", "round2", "lerp", "dist", "atan2", "exp2",
    "log2", "log10", "argmin", "exact-rational?", "=?", "rng-uniform",
}
# Non-deterministic by nature — excluded even though it is "math".
GROUP_A -= {"rng-uniform"}


def verb_records():
    for path in sorted(REF.glob("*.slat")):
        text = path.read_text()
        starts = [m.start() for m in re.finditer(r"(?m)^\(verb\b", text)]
        for i, s in enumerate(starts):
            e = starts[i + 1] if i + 1 < len(starts) else len(text)
            blk = text[s:e]
            nm = re.search(r':name\s+"([^"]+)"', blk)
            if nm:
                yield path.name, nm.group(1), blk


def field(blk, key):
    m = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', blk)
    return m.group(1) if m else ""


def run_motoi(src, timeout=25):
    """Run a program. Returns (ok, stdout). Never raises."""
    with tempfile.NamedTemporaryFile("w", suffix=".scm", delete=False) as f:
        f.write(src)
        tmp = f.name
    try:
        p = subprocess.run(
            ["./bin/motoi", "run", tmp],
            capture_output=True, text=True, timeout=timeout,
            env={**os.environ, "MOTOI_HOME": "/tmp/mx"},
        )
        out = p.stdout.strip()
        bad = p.returncode != 0 or "error:" in (p.stdout + p.stderr).lower()
        return (not bad), out
    except subprocess.TimeoutExpired:
        return False, ""
    finally:
        os.unlink(tmp)


DEGENERATE = {"", "()", "#t", "#f", "0", "#<unspecified>"}


def grade(src, seen_outputs):
    """The interlock.

    Correctness gate: runs twice; demands success and determinism.
    Quality gate: a program that prints a degenerate value, or that prints the
    same thing as an earlier example of the same verb, teaches nothing. The
    pilot showed the correctness gate alone passes 12/12 while a third of the
    set is redundant — a run-only gate cannot see that.
    """
    ok1, o1 = run_motoi(src)
    if not ok1:
        return None, "errored"
    if not o1:
        return None, "no output"
    ok2, o2 = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "non-deterministic"
    if o1 in DEGENERATE:
        return None, f"degenerate output {o1!r}"
    if o1 in seen_outputs:
        return None, f"duplicate output {o1!r}"
    return o1, "ok"


PROMPT = """You are writing example programs for the Motoi Scheme reference manual.

Verb:      {name}
Signature: {sig}
Summary:   {summary}

An existing example of this verb in use:
{example}

Write {n} SHORT, COMPLETE, SELF-CONTAINED Motoi Scheme programs that demonstrate
`{name}`. Rules:
- Each program must be runnable on its own and must `display` a result.
- Use only standard Scheme plus the verb above. No graphics, no input, no timers.
- Deterministic only: no randomness, no clocks.
- Keep each under 6 lines.
- Each must print a DIFFERENT result, and each must teach something the others
  do not. No trivial or identity cases. Nothing that prints an empty list.
- Escalate in difficulty: the first is the plainest use, the last should combine
  `{name}` with another operation to show it working inside a real expression.

Return ONLY a JSON array of strings, each string one program. No prose."""


def extract_programs(text, n):
    m = re.search(r"\[.*\]", text, re.S)
    if m:
        try:
            arr = json.loads(m.group(0))
            if isinstance(arr, list):
                return [str(x) for x in arr][:n]
        except Exception:
            pass
    # fallback: fenced blocks
    blocks = re.findall(r"```(?:scheme|lisp)?\n(.*?)```", text, re.S)
    return [b.strip() for b in blocks][:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only N verbs (pilot)")
    ap.add_argument("--per-verb", type=int, default=4)
    args = ap.parse_args()

    targets = [(f, n, b) for f, n, b in verb_records() if n in GROUP_A]
    if args.limit:
        targets = targets[: args.limit]
    if not targets:
        sys.exit("no target verbs matched")

    from mlx_lm import load, generate
    print(f"loading {MODEL} ...", flush=True)
    model, tok = load(MODEL)

    kept = dropped = 0
    with OUT.open("w") as fh:
        for fname, name, blk in targets:
            sig = field(blk, "signature")
            summary = field(blk, "summary")
            ex = re.search(r':code\s+"((?:[^"\\]|\\.)*)"', blk)
            example = ex.group(1).encode().decode("unicode_escape") if ex else "(none)"

            msgs = [{"role": "user", "content": PROMPT.format(
                name=name, sig=sig, summary=summary, example=example, n=args.per_verb)}]
            prompt = tok.apply_chat_template(msgs, add_generation_prompt=True)
            raw = generate(model, tok, prompt=prompt, max_tokens=900, verbose=False)

            seen = set()
            for src in extract_programs(raw, args.per_verb):
                src = src.strip()
                if not src:
                    continue
                out, why = grade(src, seen)
                if out:
                    seen.add(out)
                if out is None:
                    dropped += 1
                    print(f"  DROP {name}: {why}", flush=True)
                    continue
                kept += 1
                fh.write(json.dumps({
                    "file": fname, "verb": name, "program": src,
                    "actual_output": out,          # from the run, not the model
                    "graded": "motoi-run x2, deterministic",
                }) + "\n")
                print(f"  KEEP {name}: {out[:60]}", flush=True)

    print(f"\nkept={kept} dropped={dropped} -> {OUT}")
    print("NOTHING written into scheme/reference/ — staging only.")


if __name__ == "__main__":
    main()
