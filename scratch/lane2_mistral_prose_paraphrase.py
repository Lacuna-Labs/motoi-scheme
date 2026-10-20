#!/usr/bin/env python3
"""Lane 2 — Mistral-Small-3.2-24B prose paraphrase augmentation.

For every prose paragraph in CE / RP / SP-prose / BE / EC / IN / LE emitters
(+ retroactively for I/J/W), ask Mistral to produce 4 additional meaning-
preserving rewrites. Grade with embedding-cosine ≥ 0.85 vs source.

Output: JSONL appended to ~/.forge/data/motoi-cpt-zero/lane2-mistral-paraphrases.jsonl
Records match emit_cpt_v5 shape (Qwen header + tags + provenance).

Runs LOCAL only — no API call. Requires mlx-lm + a small embedding model
(sentence-transformers or an MLX equivalent).

FIRE AFTER TRAINING COMPLETES to avoid GPU contention.
"""
from __future__ import annotations
import argparse, json, re, sys, time
from pathlib import Path

REPO = Path("/Users/alfred/code/motoi-scheme")
sys.path.insert(0, str(REPO / "scripts/cpt-prep"))
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft"))
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft/extractors"))

MISTRAL = "mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit"
OUT = Path.home() / ".forge/data/motoi-cpt-zero/lane2-mistral-paraphrases.jsonl"
COSINE_FLOOR = 0.85
BATCH_SIZE = 20

PROMPT = """You are a technical paraphraser. Rewrite the following paragraph
in 4 different phrasings that preserve the meaning exactly. Keep any code
literals, symbols, and technical terms UNCHANGED. Vary sentence structure,
word order, and phrasing register. Return only the 4 rewrites, one per line,
no numbering, no extra text.

Source paragraph:
{para}

4 rewrites:"""


def load_prose_from_emit(source_jsonl: Path):
    """Yield prose records that are S16/S01/S07/S12/S19 (paraphraseable)."""
    for line in source_jsonl.open():
        rec = json.loads(line)
        txt = rec.get("text", "")
        shape = None
        m = re.search(r'\[shape:(S\d+|H-\S+|HN-\S+|N-\S+|F-\S+|HP-\S+)\]', txt)
        if m:
            shape = m.group(1)
        # Only paraphrase pure-prose shapes (skip code-heavy)
        if shape in ("S01", "S07", "S12", "S16", "S19"):
            substrate_m = re.search(r'\[substrate:(\S+)\]', txt)
            substrate = substrate_m.group(1) if substrate_m else ""
            # Skip substrates that are code-dominant (reference-verb, cart)
            if substrate in ("reference-verb", "cart-motoi", "spec"):
                continue  # SP/H already have code — Lane 3 (Qwen) handles those
            # Extract the actual paragraph (everything after the tag line + \n\n)
            body = txt.split("\n\n", 1)[-1] if "\n\n" in txt else txt
            yield {"orig_rec": rec, "shape": shape, "substrate": substrate, "para": body}


def load_mistral():
    from mlx_lm import load, generate
    print(f"[mistral] loading {MISTRAL}...", flush=True)
    model, tokenizer = load(MISTRAL)
    print(f"[mistral] loaded.", flush=True)
    return model, tokenizer, generate


def paraphrase_batch(model, tokenizer, generate, paras):
    """Generate 4 rewrites per paragraph. Simple loop, one call per para."""
    from mlx_lm.sample_utils import make_sampler
    results = []
    for p in paras:
        prompt = PROMPT.format(para=p)
        messages = [{"role": "user", "content": prompt}]
        try:
            prompt_text = tokenizer.apply_chat_template(messages, add_generation_prompt=True)
        except ValueError:
            # mlx-community Mistral-Small repo ships no chat_template (VOICE-BAKEOFF gotcha)
            prompt_text = f"[INST] {prompt} [/INST]"
        try:
            out = generate(model, tokenizer, prompt=prompt_text,
                           max_tokens=1024, sampler=make_sampler(temp=0.7))
        except Exception as e:
            out = ""
        # Split on newlines, keep 4 non-empty lines
        rewrites = [ln.strip() for ln in out.split("\n") if ln.strip()][:4]
        results.append(rewrites)
    return results


def cosine_ok(a: str, b: str) -> bool:
    """Cheap check: len ratio + word-overlap. Real embedding cosine needs
    a model; approximate here for the gate. Refine if false-positive rate is high.
    """
    if not a or not b:
        return False
    la, lb = len(a), len(b)
    if lb < la * 0.3 or lb > la * 3.0:
        return False
    aw = set(re.findall(r'\w+', a.lower()))
    bw = set(re.findall(r'\w+', b.lower()))
    if not aw:
        return False
    overlap = len(aw & bw) / len(aw | bw)
    return overlap >= 0.35  # ~cosine 0.85 proxy for short prose


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path,
                    default=Path.home() / ".forge/data/motoi-cpt-zero/train.jsonl")
    ap.add_argument("--limit", type=int, default=None, help="cap paragraphs to paraphrase")
    args = ap.parse_args()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    already = set()
    if OUT.exists():
        for line in OUT.open():
            r = json.loads(line)
            already.add(r.get("_source_hash", ""))
        print(f"[lane2] resume: {len(already)} paragraphs already paraphrased", flush=True)

    model, tokenizer, generate = load_mistral()

    todo = []
    for i, rec in enumerate(load_prose_from_emit(args.source)):
        h = hash(rec["para"]) & 0xffffffff
        if str(h) in already:
            continue
        todo.append((h, rec))
        if args.limit and len(todo) >= args.limit:
            break

    print(f"[lane2] {len(todo)} paragraphs to paraphrase", flush=True)

    with OUT.open("a") as out:
        for start in range(0, len(todo), BATCH_SIZE):
            batch = todo[start:start + BATCH_SIZE]
            paras = [r["para"] for _, r in batch]
            rewrites_list = paraphrase_batch(model, tokenizer, generate, paras)
            kept = 0
            for (h, rec), rewrites in zip(batch, rewrites_list):
                good = [rw for rw in rewrites if cosine_ok(rec["para"], rw)]
                for i, rw in enumerate(good):
                    orig = rec["orig_rec"]["text"]
                    # Replace body with paraphrase, bump paraphrase-idx
                    header, tags_and_body = orig.split("\n\n", 1)
                    tags = tags_and_body.split("\n\n", 1)[0]
                    # Bump paraphrase-idx by 10 + i (avoid collision with 0-4)
                    new_pi = 10 + i
                    tags = re.sub(r'\[paraphrase-idx:\d+\]',
                                  f'[paraphrase-idx:{new_pi}]', tags)
                    new_text = f"{header}\n\n{tags}\n\n{rw}"
                    out.write(json.dumps({
                        "text": new_text,
                        "type": rec["orig_rec"].get("type"),
                        "shape": rec["shape"],
                        "substrate": rec["substrate"],
                        "paraphrase-idx": new_pi,
                        "_source_hash": str(h),
                        "_lane": 2,
                    }) + "\n")
                    kept += 1
            out.flush()
            done = start + len(batch)
            print(f"[lane2] batch {done}/{len(todo)}  kept={kept}/{len(batch)*4}", flush=True)


if __name__ == "__main__":
    main()
