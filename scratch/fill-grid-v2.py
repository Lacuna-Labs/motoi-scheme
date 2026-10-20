#!/usr/bin/env python3
"""fill-grid-v2 — second attempt at getting the local model to emit reference-grade
programs. v1 yielded 3/12 on `clamp`.

Three changes, each aimed at a specific v1 failure:

  v1 failure                          v2 lever
  ----------------------------------  ------------------------------------------
  redefined the verb, tested its own  FEW-SHOT: show it real authored rows from
  copy (6/12)                         `sqrt`, so it sees the house style instead
                                      of being told about it in prose.
  produced generic demos, no traps    CAVEATS: the record already names the
                                      verb's traps. Demand a program that
                                      DEMONSTRATES a caveat.
  one shot, no recovery               RETRY: feed the exact rejection reason back
                                      and let it repair, up to N times.

The grading interlock is unchanged and non-negotiable: the interpreter runs every
program twice, and the structural gate rejects anything that shadows the verb,
never calls it, or prints bare literals. The model never certifies itself.

  ~/code/forge/.venv/bin/python3 scratch/fill-grid-v2.py --verb clamp
"""
import argparse, json, re, subprocess, tempfile, os, pathlib

REF = pathlib.Path("scheme/reference")
MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"
GOLD_VERB = "sqrt"          # the exemplar record we teach the style from

ROWS = {
    "row-2-audit": (["eng-program", "math-program", "cs-program"],
        "An operator picks a tool for a real task. eng: solve a concrete problem. "
        "math: check the verb's behaviour across a set of inputs. cs: probe the "
        "edge cases and failure modes."),
    "row-3-dimension": (["eng-program", "math-program", "cs-program"],
        "A ladder from bare number to real domain: plainest numeric use, then a "
        "physical quantity, then embedded in a named domain function."),
    "row-4-proof": (["eng-program", "math-program", "cs-program"],
        "Each program CHECKS an invariant across many inputs and prints booleans. "
        "A verification, not a demo."),
    "row-5-emergence": (["eng-composition", "math-composition", "cs-composition"],
        "The verb composed inside a larger useful function, as a component rather "
        "than the headline."),
}


def records():
    for path in sorted(REF.glob("*.slat")):
        text = path.read_text()
        starts = [m.start() for m in re.finditer(r"(?m)^\(verb\b", text)]
        for i, s in enumerate(starts):
            e = starts[i + 1] if i + 1 < len(starts) else len(text)
            yield path.name, text[s:e]


def get_record(verb):
    for fname, blk in records():
        if re.search(rf':name\s+"{re.escape(verb)}"', blk):
            return fname, blk
    raise SystemExit(f"verb {verb} not found")


def unescape(s):
    return s.encode().decode("unicode_escape")


def field(blk, key):
    m = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', blk)
    return unescape(m.group(1)) if m else ""


def caveats(blk):
    m = re.search(r":caveats\s*\((.*?)\)\s*(?=:[a-z])", blk, re.S)
    if not m:
        return []
    return [unescape(x) for x in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))]


def gold_examples():
    """Real authored programs from the exemplar record, as few-shot material."""
    _, blk = get_record(GOLD_VERB)
    out = []
    for key in ("eng-program", "math-program", "cs-program"):
        m = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', blk)
        if m:
            out.append(unescape(m.group(1)))
    return out


def run_motoi(src, timeout=25):
    with tempfile.NamedTemporaryFile("w", suffix=".scm", delete=False) as f:
        f.write(src); tmp = f.name
    try:
        p = subprocess.run(["./bin/motoi", "run", tmp], capture_output=True,
                           text=True, timeout=timeout,
                           env={**os.environ, "MOTOI_HOME": "/tmp/mx"})
        err = (p.stdout + p.stderr)
        bad = p.returncode != 0 or "error:" in err.lower()
        detail = ""
        if bad:
            m = re.search(r"(?i)(error:.*)", err)
            detail = m.group(1).strip()[:200] if m else "non-zero exit"
        return (not bad), p.stdout.strip(), detail
    except subprocess.TimeoutExpired:
        return False, "", "timed out"
    finally:
        os.unlink(tmp)


DEGENERATE = {"", "()", "#<unspecified>"}


def structural_check(src, verb):
    v = re.escape(verb)
    if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
        return f"you redefined `{verb}`. It is already built in — call it, never define it."
    if not re.search(rf"\(\s*{v}[\s)]", src):
        return f"the program never calls `{verb}`."
    if re.search(r"\(display\s+-?[0-9.]+\s*\)", src):
        return "you displayed a bare literal number instead of computing it."
    return None


def grade(src, seen, verb):
    bad = structural_check(src, verb)
    if bad:
        return None, bad
    ok, o1, detail = run_motoi(src)
    if not ok:
        return None, f"it failed to run: {detail}"
    if o1 in DEGENERATE:
        return None, f"it printed {o1!r}, which teaches nothing."
    ok2, o2, _ = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "it printed something different on a second run (non-deterministic)."
    if o1 in seen:
        return None, f"it printed {o1!r}, the same as another program in this record."
    return o1, "ok"


HEADER = """You are writing example programs for the Motoi Scheme reference manual.
Motoi is R7RS-small Scheme. Every program you write will be EXECUTED and checked.

Here are real, accepted programs from this manual's entry for `sqrt`. Match this
level of substance and this style:

{gold}

--------------------------------------------------------------------------
Now write for the verb `{verb}`.

Signature: {sig}
Summary:   {summary}
Behaviour: {explanation}
{caveat_block}
You are filling `:{row}`. Purpose: {intent}

Write exactly {n} programs, for these slots in order: {slots}.

Hard rules:
- `{verb}` is ALREADY BUILT IN. Never define or redefine it. Just call it.
- Each program is complete, self-contained, deterministic, 3-8 lines.
- Display ONE computed expression per program; use `(list ...)` for several
  values. Never display a bare literal number.
- Each program must print a DIFFERENT result.
- At least one program must demonstrate a documented trap listed above, showing
  the surprising value the manual warns about.

Return ONLY a JSON object mapping slot name -> program string. No prose."""

RETRY = """That program for slot `{slot}` was REJECTED: {reason}

Program:
{src}

Write a corrected program for `{slot}` that fixes exactly that problem.
Return ONLY a JSON object: {{"{slot}": "<program>"}}"""


def ask(model, tok, generate, content, max_tokens=1800):
    prompt = tok.apply_chat_template([{"role": "user", "content": content}],
                                     add_generation_prompt=True)
    return generate(model, tok, prompt=prompt, max_tokens=max_tokens, verbose=False)


def parse_obj(raw):
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verb", default="clamp")
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()

    fname, blk = get_record(args.verb)
    sig, summary, expl = field(blk, "signature"), field(blk, "summary"), field(blk, "explanation")
    cavs = caveats(blk)
    caveat_block = ""
    if cavs:
        caveat_block = "\nDocumented traps for this verb:\n" + "\n".join(f"  - {c}" for c in cavs) + "\n"
    gold = "\n\n".join(gold_examples())

    from mlx_lm import load, generate
    print(f"verb={args.verb} file={fname}  caveats={len(cavs)}\nloading {MODEL} ...", flush=True)
    model, tok = load(MODEL)

    result, seen, kept, dropped = {}, set(), 0, 0
    for row, (slots, intent) in ROWS.items():
        raw = ask(model, tok, generate, HEADER.format(
            gold=gold, verb=args.verb, sig=sig, summary=summary, explanation=expl,
            caveat_block=caveat_block, row=row, intent=intent,
            slots=", ".join(slots), n=len(slots)))
        obj = parse_obj(raw)
        result[row] = {}
        for slot in slots:
            src = str(obj.get(slot, "")).strip()
            out = why = None
            for attempt in range(args.retries + 1):
                if not src:
                    why = "the model returned nothing"; break
                out, why = grade(src, seen, args.verb)
                if out is not None:
                    break
                if attempt < args.retries:
                    fix = parse_obj(ask(model, tok, generate,
                                        RETRY.format(slot=slot, reason=why, src=src), 900))
                    src = str(fix.get(slot, "")).strip()
                    print(f"   retry {row}.{slot} ({why[:50]})", flush=True)
            if out is None:
                dropped += 1
                print(f"  DROP {row}.{slot}: {why}", flush=True)
                continue
            seen.add(out); kept += 1
            result[row][slot] = {"program": src, "actual_output": out}
            print(f"  KEEP {row}.{slot} -> {out[:64]}", flush=True)

    p = pathlib.Path(f"scratch/grid-v2-{args.verb.replace('/','-')}.json")
    p.write_text(json.dumps({"verb": args.verb, "kept": kept, "dropped": dropped,
                             "rows": result}, indent=2))
    print(f"\nv2: kept={kept}/12 dropped={dropped} -> {p}")
    print("NOTHING written into scheme/reference/.")


if __name__ == "__main__":
    main()
