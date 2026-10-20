#!/usr/bin/env python3
"""
reversal_gen.py — best-in-class CODE reversal-pair generator for the Motoi SFT fold.

Two lanes:
  * CORPUS lane  — harvest runnable code_blocks already in the corpus and spin
    reversal pairs off them (the normal InverseCoder lane).
  * 10th SEAM    — MINT novel programs from a self-describing grammar that has
    NOTHING to do with the corpus, so the model learns reversal-as-COMPREHENSION
    (understand any code), not recall of authored snippets.

The design principle is GENERATE-THEN-VERIFY:
  - the grammar emits (program, its-own-intent, its-own-structural-reading) as a
    triple BY CONSTRUCTION — the intent is the generative spec, never guessed;
  - the interpreter (`./bin/motoi run`) certifies the actual OUTPUT.
So both sides of every pair are grounded — intent by construction, output by the
oracle — and there is zero fabrication. Corpus-independent + non-memorizable +
infinitely diverse.

Five reversal DIRECTIONS per program (a full InverseCoder star), all sharing a
`pair_id` so reversal_fidelity.py sees the code as BOTH a completion and a prompt:
  F1  intent  -> code     (forward: write it)
  R1  code    -> output   (reverse: predict what it evaluates to)   [oracle-graded]
  R2  code    -> identify (reverse: name the constructs it uses)
  R3  output  -> code     (reverse: synthesize a program with that result)
  R4  code    -> intent   (reverse: state the goal in one line)

Anti-lock-in: several instruction phrasings per direction, picked by the seed;
wide grammar + varied literals. Every record carries the full tag block.

Usage:
  python3 scratch/reversal_gen.py --mint 120 --out scratch/sft-plans/10th-seam-reversals-sample.jsonl
  python3 scratch/reversal_gen.py --mint 120 --corpus --out ...   (also harvest corpus lane)
  python3 scratch/reversal_gen.py --selftest    (mint a few, grade, print, no file)
"""
import argparse
import base64
import hashlib
import json
import random
import re
import subprocess
import sys
from pathlib import Path

import fold_common as fc

WS = re.compile(r"\s+")


# ----------------------------------------------------------------------------
# interpreter oracle
# ----------------------------------------------------------------------------
def run_program(code, timeout=15):
    """(exit_code, value_string). value = last non-empty output line. base64-passed."""
    b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
    sh = f'echo {b64} | base64 -d | "{fc.MOTOI}" run /dev/stdin'
    try:
        p = subprocess.run(["bash", "-c", sh], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return 124, "TIMEOUT"
    lines = [ln for ln in (p.stdout + p.stderr).splitlines() if ln.strip()]
    return p.returncode, (lines[-1].strip() if lines else "")


def code_hash(code):
    return hashlib.sha1(WS.sub(" ", code.strip()).encode("utf-8")).hexdigest()[:12]


# ----------------------------------------------------------------------------
# self-describing grammar — the 10th seam.
# each template(rng) -> dict(code, intent, identify, category)
# intent/identify are TRUE BY CONSTRUCTION. output is filled by the oracle later.
# ----------------------------------------------------------------------------
FOLD_OPS = [  # (verb, init, english-noun, english-verb)
    ("+", 0, "sum", "add up"),
    ("*", 1, "product", "multiply together"),
    ("max", 0, "maximum", "take the largest of"),
    ("min", 999, "minimum", "take the smallest of"),
]
PREDS = [  # (verb, english)
    ("even?", "even"), ("odd?", "odd"), ("positive?", "positive"),
    ("negative?", "negative"), ("zero?", "zero"),
]
MAP_EXPRS = [  # (scheme-expr-of-x, english)
    ("(* x 2)", "double it"), ("(+ x 1)", "add one"), ("(* x x)", "square it"),
    ("(- x)", "negate it"), ("(modulo x 3)", "take it mod 3"),
]


def _ints(rng, k, lo=1, hi=9):
    return [rng.randint(lo, hi) for _ in range(k)]


def _lst(nums):
    return "(list " + " ".join(str(n) for n in nums) + ")"


def t_fold_reduce(rng):
    op, init, noun, verb = rng.choice(FOLD_OPS)
    nums = _ints(rng, rng.randint(3, 6), 1, 9)
    code = f"(fold {op} {init} {_lst(nums)})"
    return dict(code=code, category="fold-reduce",
               intent=f"{verb} the numbers {', '.join(map(str, nums))} (the {noun})",
               identify=f"a left fold (SRFI-1 `fold`, element-first) over a literal "
                        f"list, combining with `{op}` from an initial value of {init}")


def t_filter_count(rng):
    pred, eng = rng.choice(PREDS)
    n = rng.randint(6, 14)
    code = f"(length (filter {pred} (iota {n})))"
    return dict(code=code, category="filter-count",
               intent=f"count how many of the numbers 0..{n-1} are {eng}",
               identify=f"`filter` by the predicate `{pred}` over `(iota {n})`, then "
                        f"`length` to count the survivors")


def t_filter_map(rng):
    pred, peng = rng.choice(PREDS)
    expr, meng = rng.choice(MAP_EXPRS)
    n = rng.randint(6, 12)
    code = f"(map (lambda (x) {expr}) (filter {pred} (iota {n})))"
    return dict(code=code, category="filter-map",
               intent=f"keep the {peng} numbers below {n}, then {meng} for each",
               identify="`filter` a predicate over a range, then `map` a lambda over "
                        "the result — a select-then-transform pipeline")


def t_map_pred(rng):
    pred, eng = rng.choice(PREDS)
    nums = _ints(rng, rng.randint(3, 6), -4, 9)
    code = f"(map {pred} {_lst(nums)})"
    return dict(code=code, category="map-predicate",
               intent=f"test each of {', '.join(map(str, nums))} for being {eng}",
               identify=f"`map` the predicate `{pred}` over a list, yielding a list of "
                        f"booleans (one per element)")


def t_len_append(rng):
    a, b = _ints(rng, rng.randint(2, 4)), _ints(rng, rng.randint(2, 4))
    code = f"(length (append {_lst(a)} {_lst(b)}))"
    return dict(code=code, category="append-length",
               intent=f"join a {len(a)}-element and a {len(b)}-element list and count the result",
               identify="`append` two literal lists, then `length` the joined list")


def t_string_build(rng):
    pre = rng.choice(["n=", "score:", "id-", "v", "row "])
    post = rng.choice(["!", " pts", "", "/10", " done"])
    n = rng.randint(0, 99)
    code = f'(string-append "{pre}" (number->string {n}) "{post}")'
    return dict(code=code, category="string-build",
               intent=f"build a label putting {n} between \"{pre}\" and \"{post}\"",
               identify="`number->string` to stringify a number, then `string-append` "
                        "to splice it between two string literals")


def t_arith(rng):
    a, b, c, d = _ints(rng, 4, 2, 9)
    code = f"(+ (* {a} {b}) (- {c} {d}))"
    return dict(code=code, category="arithmetic",
               intent=f"evaluate {a}*{b} plus ({c} minus {d})",
               identify="nested arithmetic: a product and a difference summed by the "
                        "outer `+`")


def t_let_combine(rng):
    op, _i, noun, verb = rng.choice(FOLD_OPS[:2] + [("+", 0, "sum", "add")])
    v1, v2 = rng.randint(2, 20), rng.randint(2, 20)
    code = f"(let ((x {v1}) (y {v2})) ({op} x y))"
    return dict(code=code, category="let-binding",
               intent=f"bind x={v1} and y={v2}, then combine them with `{op}`",
               identify=f"a `let` introducing two local bindings, whose body applies "
                        f"`{op}` to them")


def t_vector_ref(rng):
    nums = _ints(rng, rng.randint(4, 7), 1, 30)
    i = rng.randint(0, len(nums) - 1)
    code = f"(let ((v (list->vector {_lst(nums)}))) (vector-ref v {i}))"
    return dict(code=code, category="vector-ref",
               intent=f"make a vector from {len(nums)} numbers and read index {i}",
               identify="`list->vector` to build a vector, then `vector-ref` for O(1) "
                        "indexed access inside a `let`")


def t_fold_cons(rng):
    nums = _ints(rng, rng.randint(3, 6), 1, 9)
    code = f"(fold cons (quote ()) {_lst(nums)})"
    return dict(code=code, category="fold-cons-reverse",
               intent=f"rebuild the list {', '.join(map(str, nums))} with fold and cons "
                      f"(which reverses it)",
               identify="`fold` with `cons` and `'()` — the canonical reverse idiom, "
                        "since fold is the universal list eliminator")


def t_sum_of_squares(rng):
    nums = _ints(rng, rng.randint(3, 5), 1, 7)
    code = f"(fold + 0 (map (lambda (x) (* x x)) {_lst(nums)}))"
    return dict(code=code, category="sum-of-squares",
               intent=f"square each of {', '.join(map(str, nums))} and sum the squares",
               identify="`map` a squaring lambda over a list, then `fold +` to total — "
                        "map-then-reduce")


TEMPLATES = [
    t_fold_reduce, t_filter_count, t_filter_map, t_map_pred, t_len_append,
    t_string_build, t_arith, t_let_combine, t_vector_ref, t_fold_cons,
    t_sum_of_squares,
]


# ----------------------------------------------------------------------------
# instruction phrasings (anti-lock-in) — {intent}/{code}/{output} slots
# ----------------------------------------------------------------------------
PHRASE = {
    "F1": [
        "Write Motoi Scheme that will {intent}.",
        "I need a small program to {intent}. Give me the Scheme.",
        "In Motoi Scheme: {intent}. Show the code.",
        "Produce one expression that will {intent}.",
        "How would you {intent} in this Scheme? Just the code.",
    ],
    "R1": [
        "What does this evaluate to?\n```scheme\n{code}\n```",
        "Predict the result of running this:\n```scheme\n{code}\n```",
        "Trace this and tell me the value it prints:\n```scheme\n{code}\n```",
        "```scheme\n{code}\n```\nWhat is the output?",
        "Evaluate by hand:\n```scheme\n{code}\n```\nWhat comes back?",
    ],
    "R2": [
        "Name the constructs this uses and what shape of computation it is:\n```scheme\n{code}\n```",
        "Identify what's going on here — which verbs, what pattern?\n```scheme\n{code}\n```",
        "Read this code back to me: what does each piece do?\n```scheme\n{code}\n```",
        "```scheme\n{code}\n```\nWhat is this, structurally?",
    ],
    "R3": [
        "Write a Motoi Scheme expression whose result is `{output}`.",
        "Give me one program that evaluates to `{output}`.",
        "I want a Scheme expression that produces `{output}`. Show one.",
        "Synthesize code returning `{output}` (one valid answer is fine).",
    ],
    "R4": [
        "In one line, what is the goal of this code?\n```scheme\n{code}\n```",
        "State the intent behind this in a sentence:\n```scheme\n{code}\n```",
        "```scheme\n{code}\n```\nWhat is this trying to do?",
        "Summarize the purpose:\n```scheme\n{code}\n```",
    ],
}


def tags(seam, category, direction, oracle):
    """The full tag block CLAUDE.md wants, plus reversal-lane specifics."""
    return {
        "doc": "reversal-generator",
        "section": f"10th-seam/{category}" if seam == "minted" else f"corpus-reversal/{category}",
        "audience": "kid",
        "dialect": "motoi",
        "provenance": "minted-10th-seam-generate-then-verify" if seam == "minted"
                      else "corpus-harvest-reversal",
        "training_eligible": True,
        "confidentiality": "public",
        "seam": "10th-seam-corpus-independent" if seam == "minted" else "corpus-derived",
        "direction": direction,          # F1/R1/R2/R3/R4
        "category": category,
        "oracle_verified": oracle,        # True = interpreter certified the output
    }


def emit_pairs(prog, out_val, seam, rng):
    """One program -> up to 5 reversal records sharing a pair_id."""
    code = prog["code"]
    pid = code_hash(code)
    fence = f"```scheme\n{code}\n```"
    recs = []

    def rec(shape, direction, instruction, response, blocks, oracle):
        return {
            "shape": shape,
            "pair_id": pid,
            "instruction": instruction,
            "response": response,
            "code_blocks": blocks,
            "expected_outcome": "ok",  # every minted program runs clean (exit 0)
            "tags": tags(seam, prog["category"], direction, oracle),
        }

    # F1 intent -> code  (code in COMPLETION)
    recs.append(rec("REV-F1", "F1",
        rng.choice(PHRASE["F1"]).format(intent=prog["intent"]),
        f"{fence}\n\nRunning it yields `{out_val}`.", [code], True))

    # R1 code -> output  (code in PROMPT) — oracle-grounded
    recs.append(rec("REV-R1", "R1",
        rng.choice(PHRASE["R1"]).format(code=code),
        f"It evaluates to `{out_val}`.", [code], True))

    # R2 code -> identify (code in PROMPT)
    recs.append(rec("REV-R2", "R2",
        rng.choice(PHRASE["R2"]).format(code=code),
        f"{prog['identify'].capitalize()}. It evaluates to `{out_val}`.", [code], True))

    # R3 output -> code  (code in COMPLETION)
    recs.append(rec("REV-R3", "R3",
        rng.choice(PHRASE["R3"]).format(output=out_val),
        f"One program that returns `{out_val}`:\n{fence}\n(There are other valid "
        f"answers; this one is built to {prog['intent']}.)", [code], True))

    # R4 code -> intent  (code in PROMPT)
    recs.append(rec("REV-R4", "R4",
        rng.choice(PHRASE["R4"]).format(code=code),
        f"It is meant to {prog['intent']}.", [code], True))

    return recs


# ----------------------------------------------------------------------------
# driver
# ----------------------------------------------------------------------------
def mint_seam(n_programs, seed, verbose=False):
    """Mint n_programs DISTINCT oracle-certified programs; 5 reversal records each."""
    rng = random.Random(seed)
    out = []
    seen = set()
    minted = 0
    tries = 0
    while minted < n_programs and tries < n_programs * 30:
        tries += 1
        prog = rng.choice(TEMPLATES)(rng)
        h = code_hash(prog["code"])
        if h in seen:
            continue
        rc, val = run_program(prog["code"])
        if rc != 0 or not val or val == "TIMEOUT":
            if verbose:
                print(f"  drop rc={rc} {prog['code']!r} -> {val!r}", file=sys.stderr)
            continue  # 10th seam ships only oracle-certified clean programs
        seen.add(h)
        minted += 1
        out.extend(emit_pairs(prog, val, "minted", rng))
        if verbose:
            print(f"  ok {prog['category']:18} {prog['code'][:50]:50} => {val}", file=sys.stderr)
    return out


def harvest_corpus(limit, seed):
    """Spin reversal pairs off runnable code already in the corpus."""
    rng = random.Random(seed + 1)
    recs, seen = [], set()
    for path in fc.find_lane_files():
        for _ln, r in fc.iter_jsonl(path):
            _p, _c, blocks, schema = fc.normalize(r)
            if schema in ("malformed", "unknown"):
                continue
            for b in blocks:
                if not fc.looks_like_full_program(b):
                    continue
                h = code_hash(b)
                if h in seen:
                    continue
                rc, val = run_program(b)
                if rc != 0 or not val:
                    continue
                seen.add(h)
                prog = dict(code=b, category="harvested",
                            intent="reproduce this corpus snippet's behavior",
                            identify="a runnable snippet harvested from the corpus")
                recs.append(("R1only", prog, val))
                if len(seen) >= limit:
                    break
            if len(seen) >= limit:
                break
        if len(seen) >= limit:
            break
    # corpus lane: emit just the oracle-grounded output pair (identity/intent are
    # not known-by-construction for harvested code, so we DON'T fabricate them).
    out = []
    for _t, prog, val in recs:
        pid = code_hash(prog["code"])
        out.append({
            "shape": "REV-R1", "pair_id": pid,
            "instruction": rng.choice(PHRASE["R1"]).format(code=prog["code"]),
            "response": f"It evaluates to `{val}`.",
            "code_blocks": [prog["code"]], "expected_outcome": "ok",
            "tags": tags("corpus", "harvested", "R1", True),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mint", type=int, default=120)
    ap.add_argument("--seed", type=int, default=1729)
    ap.add_argument("--corpus", action="store_true", help="also harvest a corpus reversal lane")
    ap.add_argument("--corpus-limit", type=int, default=60)
    ap.add_argument("--out", type=str, default="")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        recs = mint_seam(6, args.seed, verbose=True)
        for r in recs[:10]:
            print(json.dumps(r, ensure_ascii=False, indent=1))
        print(f"\n# selftest minted {len(recs)} records from 6 programs", file=sys.stderr)
        return 0

    recs = mint_seam(args.mint, args.seed, verbose=True)
    if args.corpus:
        recs += harvest_corpus(args.corpus_limit, args.seed)

    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            for r in recs:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"# wrote {len(recs)} reversal records -> {args.out}")
    else:
        for r in recs:
            print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
