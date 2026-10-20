#!/usr/bin/env python3
"""Lane 3 — Qwen-30-Coder code variant generation (bounded, interpreter-graded).

For each of the 271 grid-filled verbs (≥5 programs each), take up to 3 code
examples per verb; ask Qwen3-Coder-30B to produce 3 semantically-equivalent
alternative implementations grounded in the library MANIFEST + siblings.

HARD INTERLOCK: reject any variant where Motoi interpreter output != original
output. No exceptions.

Output: ~/.forge/data/motoi-cpt-zero/lane3-code-variants.jsonl
Runs LOCAL only. FIRE AFTER TRAINING COMPLETES to avoid GPU contention.
"""
from __future__ import annotations
import argparse, json, re, subprocess, sys
from pathlib import Path

REPO = Path("/Users/alfred/code/motoi-scheme")
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft/extractors"))

QWEN_CODER = "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"
OUT = Path.home() / ".forge/data/motoi-cpt-zero/lane3-code-variants.jsonl"
BOUNDED_MIN_PROGS_PER_VERB = 5
VARIANTS_PER_PROG = 3
MOTOI_CLI = REPO / "bin" / "motoi"

PROMPT = """You are a Scheme expert. Rewrite the following Motoi Scheme program
in {n} semantically-equivalent alternative implementations. Preserve behavior
EXACTLY — output on the same input must be identical. Vary style: rename
variables, reorder commuting let-bindings, swap fold/map/for-each where
equivalent, use different but equivalent higher-order forms.

Context (available library verbs):
{context}

Original program:
```scheme
{code}
```

Return exactly {n} alternative implementations, each in a ```scheme block
with no explanation between them."""


def load_qwen_coder():
    from mlx_lm import load
    print(f"[qwen-coder] loading {QWEN_CODER}...", flush=True)
    model, tokenizer = load(QWEN_CODER)
    print(f"[qwen-coder] loaded.", flush=True)
    return model, tokenizer


def run_motoi(code: str, timeout: float = 5.0) -> tuple[str, bool]:
    """Run code through ./bin/motoi run, return (stdout, ok)."""
    try:
        r = subprocess.run(
            [str(MOTOI_CLI), "run", "/dev/stdin"],
            input=code, capture_output=True, text=True, timeout=timeout,
            cwd=str(REPO))
        return (r.stdout.strip(), r.returncode == 0)
    except subprocess.TimeoutExpired:
        return ("", False)
    except Exception as e:
        return (str(e), False)


def gen_variants(model, tokenizer, code: str, context: str, n: int) -> list[str]:
    from mlx_lm import generate
    from mlx_lm.sample_utils import make_sampler
    prompt = PROMPT.format(n=n, context=context[:2000], code=code)
    messages = [{"role": "user", "content": prompt}]
    prompt_text = tokenizer.apply_chat_template(messages, add_generation_prompt=True)
    try:
        out = generate(model, tokenizer, prompt=prompt_text,
                       max_tokens=1500, sampler=make_sampler(temp=0.6))
    except Exception:
        return []
    # Extract ```scheme ... ``` blocks
    blocks = re.findall(r'```(?:scheme)?\s*\n?(.*?)```', out, re.DOTALL)
    return [b.strip() for b in blocks if b.strip()][:n]


def collect_verb_programs(verbs, min_progs):
    """Yield (verb, program_str) for verbs meeting the grid-fill threshold."""
    for v in verbs:
        progs = list(v.get("examples", []) or [])
        # Add row-N raw-extracted programs
        for row_key in ("row_2_audit", "row_3_dimension", "row_4_proof", "row_5_emergence"):
            row = v.get(row_key) or {}
            for k in ("program", "eng-program", "math-program", "cs-program",
                      "composition", "eng-composition", "math-composition", "cs-composition"):
                if isinstance(row, dict) and row.get(k):
                    progs.append({"code": row[k], "tier": k})
        if len(progs) < min_progs:
            continue
        for p in progs[:15]:  # cap at 15 per verb
            code = p.get("code") if isinstance(p, dict) else str(p)
            if code and isinstance(code, str) and code.strip():
                yield (v, code)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit-verbs", type=int, default=None)
    ap.add_argument("--pilot", type=int, default=None,
                    help="pilot mode: process only N programs total")
    args = ap.parse_args()

    import reference as ref
    verbs = list(ref.iter_all_verbs())
    todo = list(collect_verb_programs(verbs, BOUNDED_MIN_PROGS_PER_VERB))
    if args.limit_verbs:
        # Cap by unique verb name
        seen = set()
        filtered = []
        for v, c in todo:
            if v["name"] not in seen and len(seen) >= args.limit_verbs:
                break
            seen.add(v["name"])
            filtered.append((v, c))
        todo = filtered
    if args.pilot:
        todo = todo[:args.pilot]

    print(f"[lane3] {len(todo)} program instances to variant "
          f"(verbs ≥{BOUNDED_MIN_PROGS_PER_VERB} progs)", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    model, tokenizer = load_qwen_coder()

    accepted = rejected = 0
    with OUT.open("a") as out:
        for i, (v, code) in enumerate(todo):
            # Build minimal context: verb signature + related names
            context = (f"Verb: {v['name']}\n"
                       f"Signature: {v.get('signature', '')}\n"
                       f"Related: {', '.join((v.get('related') or [])[:8])}\n"
                       f"Library: {v.get('name', '').split('/')[0]}")
            variants = gen_variants(model, tokenizer, code, context, VARIANTS_PER_PROG)

            orig_out, orig_ok = run_motoi(code)
            if not orig_ok:
                # Can't interpret original — skip whole row (broken example)
                continue

            for vidx, vcode in enumerate(variants):
                var_out, var_ok = run_motoi(vcode)
                if not var_ok:
                    rejected += 1
                    continue
                if var_out != orig_out:
                    rejected += 1
                    continue
                # Accept
                out.write(json.dumps({
                    "verb": v["name"],
                    "orig_code": code,
                    "variant_code": vcode,
                    "variant_idx": vidx,
                    "output": orig_out,
                    "_lane": 3,
                }) + "\n")
                accepted += 1
            if (i + 1) % 20 == 0:
                out.flush()
                print(f"[lane3] progress {i+1}/{len(todo)}  "
                      f"accepted={accepted}  rejected={rejected}", flush=True)

    print(f"[lane3] DONE  accepted={accepted}  rejected={rejected}", flush=True)


if __name__ == "__main__":
    main()
