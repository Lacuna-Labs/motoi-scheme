#!/usr/bin/env python3
"""grid_machine — feed it verbs, it fills grid cells.

The rules live in scratch/GRID-RULES.md, not in this file. Every prompt is
assembled from four blocks:

    [A] PREAMBLE     what Motoi Scheme is. Constant, engine-verified.
    [B] ROW RULE     what this row exists to prove.
    [C] COLUMN RULE  what this domain column means.
    [D] VERB CARD    signature/summary/behaviour/traps, from the record.

Corrections accumulate. A rejection is paid for once and then teaches every
remaining cell in the run: rejection reasons go into a per-row ledger injected
into later prompts, and the first gated-good answer for a row becomes the
few-shot exemplar for the rest of that row.

The interpreter grades. The model never certifies itself.

  ~/code/forge/.venv/bin/python3 scratch/grid_machine.py --verbs clamp
  ~/code/forge/.venv/bin/python3 scratch/grid_machine.py --group-a --rows 3
"""
import argparse, json, re, subprocess, tempfile, os, pathlib, sys

REF = pathlib.Path("scheme/reference")
RULES = pathlib.Path("scratch/GRID-RULES.md")
MODEL = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"

GROUP_A = ["pi", "ceil", "sign", "clamp", "round2", "lerp", "dist", "atan2",
           "exp2", "log2", "log10", "argmin", "exact-rational?", "=?",
           "rng-uniform", "real-part", "imag-part", "magnitude", "angle",
           "make-rectangular", "make-polar", "alg/permutation-cycles",
           "alg/permutation-compose", "topo/euler-characteristic"]

TEMPLATES = {
    "row-2-audit": dict(
        template="""(define ({FN} {PARAMS})
  {BODY})
(display (list ({FN} {CASE1}) ({FN} {CASE2}) ({FN} {CASE3})))
(newline)""",
        holes=["FN", "PARAMS", "BODY", "CASE1", "CASE2", "CASE3"]),
    "row-3-dimension": dict(
        template="""(define (plain {P1}) {B1})
(define (physical {P2}) {B2})
(define ({FN} {P3}) {B3})
(display (list (plain {V1}) (physical {V2}) ({FN} {V3})))
(newline)""",
        holes=["P1", "B1", "P2", "B2", "FN", "P3", "B3", "V1", "V2", "V3"]),
    "row-4-proof": dict(
        template="""(define (holds? {PARAMS})
  {PRED})
(display (map (lambda (c) (apply holds? c)) {CASES}))
(newline)""",
        holes=["PARAMS", "PRED", "CASES"]),
    "row-5-emergence": dict(
        template="""(define ({HELPER} {HPARAMS})
  {HBODY})
(define ({BIGGER} {BPARAMS})
  {BBODY})
(display (list ({BIGGER} {CASE1}) ({BIGGER} {CASE2})))
(newline)""",
        holes=["HELPER", "HPARAMS", "HBODY", "BIGGER", "BPARAMS", "BBODY",
               "CASE1", "CASE2"]),
}
SLOT_NAME = {"row-5-emergence": "composition"}   # row-5 slots are *-composition
COLUMNS = ["eng", "math", "cs"]


# ---------------------------------------------------------------- the rules

def load_rules():
    """Pull the four rule blocks out of GRID-RULES.md. The doc is the source."""
    if not RULES.exists():
        sys.exit(f"missing {RULES} — the rules are the input, write them first")
    text = RULES.read_text()

    def section(header, nxt):
        m = re.search(rf"^{re.escape(header)}.*?\n(.*?)(?=^{nxt})", text,
                      re.S | re.M)
        return m.group(1).strip() if m else ""

    # [A] preamble is the blockquote under "## [A] THE PREAMBLE"
    pre = section("## [A] THE PREAMBLE", r"## \[B\]|---")
    preamble = "\n".join(l.lstrip("> ").rstrip() for l in pre.splitlines()
                         if l.strip().startswith(">"))

    rows, cols = {}, {}
    for m in re.finditer(r"^### (row-[\w-]+) — (.*?)$\n(.*?)(?=^###|^---|\Z)",
                         text, re.S | re.M):
        rows[m.group(1)] = f"{m.group(2)}\n{m.group(3).strip()}"
    colblock = section("## [C] THE COLUMN RULES", r"## \[D\]|---")
    for m in re.finditer(r"^- \*\*(\w+)\*\* — (.*?)(?=^- \*\*|\Z)", colblock,
                         re.S | re.M):
        cols[m.group(1)] = m.group(2).strip()
    return preamble, rows, cols


# ------------------------------------------------------------ the records

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
    return [unescape(x) for x in
            re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))] if m else []


def verb_card(verb):
    fname, blk = get_record(verb)
    cav = caveats(blk)
    card = (f"Verb:      {verb}\n"
            f"Signature: {field(blk, 'signature')}\n"
            f"Summary:   {field(blk, 'summary')}\n"
            f"Behaviour: {field(blk, 'explanation')}")
    if cav:
        card += "\nTraps:\n" + "\n".join(f"  - {c}" for c in cav)
    return fname, card


# ------------------------------------------------------------- the engine

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
        return (not bad), p.stdout.strip(), (d.group(1).strip()[:150] if bad and d else "")
    except subprocess.TimeoutExpired:
        return False, "", "timed out"
    finally:
        os.unlink(tmp)


DEGENERATE = {"", "()", "#<unspecified>"}


def render(spec, obj, verb):
    norm = {str(k).strip().upper().replace("-", "_"): v for k, v in obj.items()}
    vals = {h: str(norm.get(h, "")).strip() for h in spec["holes"]}
    missing = [h for h, v in vals.items() if not v]
    if missing:
        return None, f"holes not filled: {missing}"
    for h, v in vals.items():
        if "[" in v or "]" in v:
            return None, (f"hole {h} used square brackets: {v!r}. Motoi is "
                          f"Scheme — lists are (list a b) or '(a b), never [a b].")
    # a parameter list is bare identifiers; the template supplies the parens
    for h in ("PARAMS", "HPARAMS", "BPARAMS", "P1", "P2", "P3"):
        v = vals.get(h)
        if v and not re.fullmatch(r"[a-z][\w?!*/<>=+-]*( [a-z][\w?!*/<>=+-]*)*", v):
            return None, (f"hole {h} must be BARE parameter names separated by "
                          f"spaces, like `x lo hi` — not {v!r}. The template "
                          f"already supplies the parentheses.")
    for h in ("FN", "HELPER", "BIGGER"):
        if vals.get(h) == verb:
            return None, (f"hole {h} was named `{verb}`, which redefines the "
                          f"builtin. Name it for what it does in the domain.")
    if {"B1", "B2", "B3"} <= set(vals) and len({vals["B1"], vals["B2"], vals["B3"]}) < 3:
        return None, ("B1, B2 and B3 are the same expression. The three rungs "
                      "must do different WORK, not just take different arguments.")
    if "HELPER" in vals and "BBODY" in vals:
        if not re.search(rf"\(\s*{re.escape(vals['HELPER'])}[\s)]", vals["BBODY"]):
            return None, (f"BBODY never calls `{vals['HELPER']}` — the helper is "
                          f"dead code. BIGGER must be built out of HELPER.")
    return spec["template"].format(VERB=verb, **vals), None


def grade(src, seen, verb, row):
    v = re.escape(verb)
    if re.search(rf"\(define\s*\(\s*{v}[\s)]", src) or re.search(rf"\(define\s+{v}\s", src):
        return None, f"a hole redefined `{verb}`"
    if not re.search(rf"\(\s*{v}[\s)]", src):
        return None, f"the rendered program never calls `{verb}`"
    ok, o1, detail = run_motoi(src)
    if not ok:
        return None, f"failed to run: {detail}"
    if o1 in DEGENERATE:
        return None, f"printed {o1!r}, which teaches nothing"
    ok2, o2, _ = run_motoi(src)
    if not ok2 or o1 != o2:
        return None, "non-deterministic — printed something different on re-run"
    if o1 in seen:
        return None, f"printed {o1!r}, identical to another cell in this grid"
    if row == "row-4-proof" and "#f" in o1:
        return None, f"the invariant does not hold: {o1}. Every case must be #t."
    if row == "row-3-dimension":
        vals = o1.strip("()").split()
        if len(set(vals)) < len(vals):
            return None, f"the ladder rungs are not distinct: {o1}"
    return o1, "ok"


# ------------------------------------------------------------- the prompt

PROMPT = """{preamble}

--------------------------------------------------------------------------
THE VERB YOU ARE DOCUMENTING

{card}

--------------------------------------------------------------------------
THE ROW — {row}

{rowrule}

--------------------------------------------------------------------------
THE COLUMN — {col}

{colrule}

--------------------------------------------------------------------------
THE CELL

The program has a FIXED shape. You do not write the program. You supply only
the values that go in the holes, and we render it:

{template}

Fill these holes: {holes}
{ledger}{exemplar}
Rules for your answer:
- Values are Scheme fragments, not whole programs. No newlines inside a value.
- Use the hole names EXACTLY as given as the JSON keys.
- `{verb}` is built in. Never define it. Holes named BODY, B1/B2/B3, HBODY or
  PRED are body EXPRESSIONS that must CALL `{verb}`.
- Only use procedures listed in the preamble or the verb card above.

Return ONLY a JSON object mapping each hole name to its string value."""

LEDGER = """
MISTAKES ALREADY MADE ON THIS ROW IN THIS RUN — do not repeat them:
{items}
"""

EXEMPLAR = """
AN ACCEPTED ANSWER for this row (a different verb/column — match the substance,
not the values):
{obj}
It rendered as:
{src}
and printed: {out}
"""

RETRY = """{original}

--------------------------------------------------------------------------
Your previous answer was REJECTED: {reason}

It rendered as:
{src}

Fix exactly that problem and keep what was already fine.
Return ONLY a JSON object with the same holes: {holes}"""


def parse_obj(raw):
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def kind_of(reason):
    """Normalise a rejection to its kind so the ledger does not fill with noise."""
    r = str(reason)
    for pat, k in [
        (r"square brackets", "no square brackets — Motoi lists are (list a b)"),
        (r"BARE parameter names", "parameter holes are bare names like `x lo hi`, "
                                  "the template supplies the parentheses"),
        (r"never calls", "the body holes must actually CALL the verb"),
        (r"redefined|was named", "never name a function after the verb"),
        (r"holes not filled", "every hole must be present, keyed exactly as given"),
        (r"failed to run: error: unbound symbol: (\S+)",
         "do not invent procedures — `{}` does not exist in Motoi"),
        (r"failed to run", "the program must run clean under the interpreter"),
        (r"same expression|not distinct", "the three rungs must do different work"),
        (r"dead code", "BIGGER must actually call HELPER"),
        (r"invariant does not hold", "the invariant must be #t for EVERY case"),
        (r"identical to another", "each cell must print a different result"),
        (r"teaches nothing", "the program must print something informative"),
        (r"non-deterministic", "no randomness, clocks or input"),
    ]:
        m = re.search(pat, r)
        if m:
            return k.format(*m.groups()) if m.groups() and "{}" in k else k
    return r[:90]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbs", nargs="*", default=[])
    ap.add_argument("--group-a", action="store_true")
    ap.add_argument("--rows", type=int, default=4, help="how many rows to attempt")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--retries", type=int, default=5)
    args = ap.parse_args()

    verbs = GROUP_A if args.group_a else args.verbs
    if not verbs:
        sys.exit("give --verbs or --group-a")

    preamble, rowrules, colrules = load_rules()
    missing = [r for r in list(TEMPLATES)[:args.rows] if r not in rowrules]
    if missing:
        sys.exit(f"GRID-RULES.md has no rule for {missing}")
    print(f"rules loaded: preamble {len(preamble)}ch · "
          f"{len(rowrules)} row rules · {len(colrules)} column rules", flush=True)

    from mlx_lm import load, generate
    print(f"loading {MODEL} ...", flush=True)
    model, tok = load(MODEL)

    def ask(content, mt=900):
        p = tok.apply_chat_template([{"role": "user", "content": content}],
                                    add_generation_prompt=True)
        return generate(model, tok, prompt=p, max_tokens=mt, verbose=False)

    ledger = {r: [] for r in TEMPLATES}     # rejections, carried forward
    exemplars = {}                          # row -> first gated-good answer
    grand = {"kept": 0, "dropped": 0, "verbs": {}}

    for verb in verbs:
        try:
            fname, card = verb_card(verb)
        except SystemExit as e:
            print(f"SKIP {verb}: {e}", flush=True); continue
        print(f"\n=== {verb}  ({fname})", flush=True)
        result, seen, kept, dropped = {}, set(), 0, 0

        for row in list(TEMPLATES)[:args.rows]:
            spec = TEMPLATES[row]
            result[row] = {}
            for col in COLUMNS[:args.cols]:
                holes = ", ".join(spec["holes"])
                led = LEDGER.format(items="\n".join(
                    f"  - {x}" for x in ledger[row])) if ledger[row] else ""
                ex = ""
                if row in exemplars:
                    e = exemplars[row]
                    ex = EXEMPLAR.format(obj=json.dumps(e["obj"], indent=2),
                                         src=e["src"], out=e["out"])
                original = PROMPT.format(
                    preamble=preamble, card=card, row=row,
                    rowrule=rowrules[row], col=col, colrule=colrules.get(col, ""),
                    template=spec["template"].replace("{VERB}", verb),
                    holes=holes, ledger=led, exemplar=ex, verb=verb)

                obj = parse_obj(ask(original))
                out = why = src = None
                for attempt in range(args.retries + 1):
                    src, err = render(spec, obj, verb)
                    why = err
                    if src is not None:
                        out, why = grade(src, seen, verb, row)
                        if out is not None:
                            break
                    k = kind_of(why)
                    if k not in ledger[row]:
                        ledger[row].append(k)
                    if attempt < args.retries:
                        obj = parse_obj(ask(RETRY.format(
                            original=original, reason=why,
                            src=src or "(could not render)", holes=holes)))
                if out is None:
                    dropped += 1
                    print(f"  DROP {row}.{col}: {why}", flush=True)
                    continue
                seen.add(out); kept += 1
                slot = f"{col}-{SLOT_NAME.get(row, 'program')}"
                result[row][slot] = {"program": src, "actual_output": out}
                exemplars.setdefault(row, {"obj": obj, "src": src, "out": out})
                print(f"  KEEP {row}.{col} -> {out[:58]}", flush=True)

        grand["kept"] += kept; grand["dropped"] += dropped
        grand["verbs"][verb] = {"file": fname, "kept": kept,
                                "dropped": dropped, "rows": result}
        print(f"  -- {verb}: {kept} kept, {dropped} dropped", flush=True)

    p = pathlib.Path("scratch/grid-machine-out.json")
    p.write_text(json.dumps(grand, indent=2))
    tot = grand["kept"] + grand["dropped"]
    print(f"\nMACHINE: kept={grand['kept']}/{tot} -> {p}")
    print("lessons learned this run:")
    for r, items in ledger.items():
        for i in items:
            print(f"  [{r}] {i}")
    print("NOTHING written into scheme/reference/.")


if __name__ == "__main__":
    main()
