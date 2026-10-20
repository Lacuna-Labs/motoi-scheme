#!/usr/bin/env python3
"""fill-grid-v3 — templated cells. Alfred's idea, and it fixes the v2 collapse.

v1 (free-form)              3/12 usable, 6 shadowed the builtin
v2 (+few-shot +retry)       9/12 pass the gate, but every one collapsed to a
                            one-liner: told "don't define the verb" it stopped
                            defining anything, and row-5 stopped composing.

The v2 lesson: given freedom over STRUCTURE, the model optimises for the gate
instead of the intent. So take structure away from it.

v3: every cell has a fixed program skeleton. The model never emits code shape --
it returns JSON leaf values (a function name, an argument list, a body
expression, some test cases) and WE render the program. The skeleton guarantees
what prose instructions could not: a define is present, the verb is called, the
output is a list, the program is multi-line. The model supplies only judgement
about the domain.

Grading interlock unchanged: structural check, then `./bin/motoi run` twice.

  ~/code/forge/.venv/bin/python3 scratch/fill-grid-v3.py --verb clamp
"""
import argparse, json, re, subprocess, tempfile, os, pathlib

REF = pathlib.Path("scheme/reference")
MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"

# Each row: (template, holes, what the model is being asked to judge)
# {VERB} is filled by us, never by the model.
TEMPLATES = {
    "row-2-audit": dict(
        template="""(define ({FN} {PARAMS})
  {BODY})
(display (list ({FN} {CASE1}) ({FN} {CASE2}) ({FN} {CASE3})))
(newline)""",
        holes=["FN", "PARAMS", "BODY", "CASE1", "CASE2", "CASE3"],
        intent="A concrete task an operator actually has. FN is a descriptive "
               "domain function name (e.g. keep-on-screen). BODY is the whole "
               "body expression and must call the verb on PARAMS. The three CASEs "
               "cover below-range, in-range, and above-range."),
    "row-3-dimension": dict(
        template="""(define (plain {P1}) {B1})
(define (physical {P2}) {B2})
(define ({FN} {P3}) {B3})
(display (list (plain {V1}) (physical {V2}) ({FN} {V3})))
(newline)""",
        holes=["P1", "B1", "P2", "B2", "FN", "P3", "B3", "V1", "V2", "V3"],
        intent="A ladder of three rungs: `plain` is the bare numeric use, "
               "`physical` applies it to a measured quantity, and FN names a real "
               "domain use. B1/B2/B3 are the whole body expressions and each must "
               "call the verb. Each rung must produce a DIFFERENT value."),
    "row-4-proof": dict(
        template="""(define (holds? {PARAMS})
  {PRED})
(display (map (lambda (c) (apply holds? c)) {CASES}))
(newline)""",
        holes=["PARAMS", "PRED", "CASES"],
        intent="A verification. PRED is a boolean expression using the verb that "
               "states an INVARIANT which is true for every case. CASES is ONE "
               "list expression whose elements are argument lists, exactly like "
               "(list (list 5 0 10) (list -3 0 10)). Include an edge case. "
               "Every case must print #t."),
    "row-5-emergence": dict(
        template="""(define ({HELPER} {HPARAMS})
  {HBODY})
(define ({BIGGER} {BPARAMS})
  {BBODY})
(display (list ({BIGGER} {CASE1}) ({BIGGER} {CASE2})))
(newline)""",
        holes=["HELPER", "HPARAMS", "HBODY", "BIGGER", "BPARAMS", "BBODY",
               "CASE1", "CASE2"],
        intent="The verb as a COMPONENT. HBODY is HELPER's whole body and must "
               "call the verb. BIGGER is a genuinely useful function whose body "
               "BBODY calls HELPER and does something more (map over a list, "
               "combine two values, etc). BBODY must reference HELPER."),
}
DOMAINS = {"eng": "an engineering or game task",
           "math": "a mathematical property or numeric behaviour",
           "cs": "a programming edge case or failure mode"}


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
    return [unescape(x) for x in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))] if m else []


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


DEGENERATE = {"", "()", "#<unspecified>"}


def structural_check(src, verb):
    v = re.escape(verb)
    if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
        return f"a hole redefined `{verb}`"
    if not re.search(rf"\(\s*{v}[\s)]", src):
        return f"the rendered program never calls `{verb}`"
    return None


def grade(src, seen, verb, row):
    bad = structural_check(src, verb)
    if bad:
        return None, bad
    ok, o1, detail = run_motoi(src)
    if not ok:
        return None, f"failed to run: {detail}"
    if o1 in DEGENERATE:
        return None, f"printed {o1!r}"
    ok2, o2, _ = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "non-deterministic"
    if o1 in seen:
        return None, f"printed {o1!r}, same as another cell"
    # row-4 is a proof: every case must actually hold
    if row == "row-4-proof" and "#f" in o1:
        return None, f"invariant does not hold: {o1}"
    # a ladder whose rungs all agree is not a ladder
    if row == "row-3-dimension":
        vals = o1.strip("()").split()
        if len(set(vals)) < len(vals):
            return None, f"ladder rungs are not distinct: {o1}"
    return o1, "ok"


PROMPT = """You are filling one cell of the Motoi Scheme reference manual for the verb `{verb}`.

Signature: {sig}
Summary:   {summary}
Behaviour: {explanation}
{caveat_block}
This cell is `{row}` / `{domain}-program`, which should be about {domain_desc}.
Purpose of this row: {intent}

The program has a FIXED shape. You do not write the program. You supply only the
values that go in the holes:

{template}

Fill these holes: {holes}

Rules:
- Values are Scheme fragments, not whole programs. No newlines in a value.
- `{verb}` is built in. Never define it in any hole — but any hole whose name
  starts with BODY, B, HBODY or PRED is a body EXPRESSION that must CALL `{verb}`.
- Every hole must be filled. Use the hole names EXACTLY as given as the JSON
  keys. Function names you invent must be lowercase-with-dashes, and must NOT
  be `{verb}` — name them for what they do in the domain.
- Choose values that make the program print something informative and non-obvious.

Return ONLY a JSON object mapping each hole name to its string value."""

RETRY = """{original}

--------------------------------------------------------------------------
Your previous answer was REJECTED: {reason}

It rendered as:
{src}

Supply corrected hole values that fix exactly that problem, keeping everything
else that was fine. Return ONLY a JSON object with the same holes: {holes}"""


def parse_obj(raw):
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def render(spec, obj, verb):
    # the model lowercases keys (we tell it names are lowercase-with-dashes)
    norm = {str(k).strip().upper().replace("-", "_"): v for k, v in obj.items()}
    vals = {h: str(norm.get(h, "")).strip() for h in spec["holes"]}
    if any(not v for v in vals.values()):
        missing = [h for h, v in vals.items() if not v]
        return None, f"holes not filled: {missing}"
    for h in ("FN", "HELPER", "BIGGER"):
        if vals.get(h) == verb:
            return None, (f"hole {h} was named `{verb}`, which redefines the "
                          f"builtin. Give it a different, descriptive name.")
    # a ladder whose three rungs have the same body is not a ladder
    if {"B1", "B2", "B3"} <= set(vals):
        if len({vals["B1"], vals["B2"], vals["B3"]}) < 3:
            return None, ("B1, B2 and B3 are the same expression. The three rungs "
                          "must do genuinely different work, not just take "
                          "different arguments.")
    # a composition whose bigger function ignores the helper composes nothing
    if "HELPER" in vals and "BBODY" in vals:
        if not re.search(rf"\(\s*{re.escape(vals['HELPER'])}[\s)]", vals["BBODY"]):
            return None, (f"BBODY never calls `{vals['HELPER']}` — the helper is "
                          f"dead code. BIGGER must be built out of HELPER.")
    return spec["template"].format(VERB=verb, **vals), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verb", default="clamp")
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()

    fname, blk = get_record(args.verb)
    sig, summary, expl = field(blk, "signature"), field(blk, "summary"), field(blk, "explanation")
    cavs = caveats(blk)
    cav_block = ("\nDocumented traps:\n" + "\n".join(f"  - {c}" for c in cavs) + "\n") if cavs else ""

    from mlx_lm import load, generate
    print(f"verb={args.verb} file={fname}\nloading {MODEL} ...", flush=True)
    model, tok = load(MODEL)

    def ask(content, mt=900):
        p = tok.apply_chat_template([{"role": "user", "content": content}],
                                    add_generation_prompt=True)
        return generate(model, tok, prompt=p, max_tokens=mt, verbose=False)

    result, seen, kept, dropped = {}, set(), 0, 0
    for row, spec in TEMPLATES.items():
        result[row] = {}
        for dom, dom_desc in DOMAINS.items():
            holes = ", ".join(spec["holes"])
            original = PROMPT.format(
                verb=args.verb, sig=sig, summary=summary, explanation=expl,
                caveat_block=cav_block, row=row, domain=dom, domain_desc=dom_desc,
                intent=spec["intent"],
                template=spec["template"].replace("{VERB}", args.verb),
                holes=holes)
            obj = parse_obj(ask(original))
            out = why = None
            for attempt in range(args.retries + 1):
                src, err = render(spec, obj, args.verb)
                why = err
                if src is not None:
                    out, why = grade(src, seen, args.verb, row)
                    if out is not None:
                        break
                if attempt < args.retries:
                    print(f"   retry {row}.{dom} ({str(why)[:52]})", flush=True)
                    obj = parse_obj(ask(RETRY.format(
                        original=original, reason=why,
                        src=src or "(could not render)", holes=holes)))
            if out is None:
                dropped += 1
                print(f"  DROP {row}.{dom}: {why}", flush=True)
                continue
            seen.add(out); kept += 1
            result[row][f"{dom}-program"] = {"program": src, "actual_output": out}
            print(f"  KEEP {row}.{dom} -> {out[:60]}", flush=True)

    p = pathlib.Path(f"scratch/grid-v3-{args.verb.replace('/','-')}.json")
    p.write_text(json.dumps({"verb": args.verb, "kept": kept, "dropped": dropped,
                             "rows": result}, indent=2))
    print(f"\nv3: kept={kept}/12 dropped={dropped} -> {p}")
    print("NOTHING written into scheme/reference/.")


if __name__ == "__main__":
    main()
