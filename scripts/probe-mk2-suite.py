#!/usr/bin/env python3
"""probe-mk2-suite.py — 6-probe CPT suite for the 3-way comparison.

Targets (per Alfred 2026-07-21):
  base       = vanilla Qwen2.5-Coder-1.5B-Instruct       ("their CPT")
  mk1-sft    = Motoi Mk 1 SFT LoRA r=128 (unbalanced)   (last generation)
  mk2-cpt    = Motoi Mk 2 CPT full-param (balanced weave) (tonight)

Probes:
  1  baseline delta       (implicit — same prompts to all 3 targets)
  2  cold continuation    (fact attachment via Tier 1 prefixes)
  3  reversal recall      (definition → word)
  4  multi-shape consistency (same fact P1-P5, pairwise similarity)
  5  FIM completion       (Data Type G; Qwen native tokens)
  6  perplexity delta     (held-out valid.jsonl forward pass)

Usage:
  prep:      python3 probe-mk2-suite.py prep   [--n 40]
  run:       python3 probe-mk2-suite.py run    --target {base|mk1-sft|mk2-cpt}
  aggregate: python3 probe-mk2-suite.py report

Output:
  ~/.forge/probes/motoi-mk2-cpt-suite-2026-07-21/
      probe-items.jsonl             (from prep)
      base/results.jsonl            (from run --target base)
      mk1-sft/results.jsonl         (from run --target mk1-sft)
      mk2-cpt/results.jsonl         (from run --target mk2-cpt)
      REPORT.md                     (from report — aggregate 3-way delta)
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time
import traceback
from collections import Counter, defaultdict
from pathlib import Path

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
HOME       = Path.home()
FORGE      = HOME / ".forge"
CPT_DATA   = FORGE / "data" / "motoi-mk2-cpt"
PROBES_DIR = FORGE / "probes" / "motoi-mk2-cpt-suite-2026-07-21"

TRAIN_JSONL = CPT_DATA / "train.jsonl"
VALID_JSONL = CPT_DATA / "valid.jsonl"

ITEMS_JSONL = PROBES_DIR / "probe-items.jsonl"

BASE_MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct"

TARGET_ADAPTERS = {
    "base":    None,
    "mk1-sft": str(HOME / ".forge/runs/motoi-mk1/_archive"),   # LoRA
    "mk2-cpt": str(HOME / ".forge/runs/motoi-mk2-cpt/adapter"), # full-param
    "mk3-cpt": str(HOME / ".forge/runs/motoi-mk3-cpt/adapter"), # full-param (2026-07-22)
}
# NOTE: mk1-sft adapter files are named `mk1-sft-final-20260720.safetensors`
# + `.adapter_config.json`. mlx_lm.load() expects a directory containing
# `adapters.safetensors` + `adapter_config.json`. We stage a symlink dir at
# run time (STAGING_DIR below) so both adapters conform.

STAGING_DIR = PROBES_DIR / "_staging"


# --------------------------------------------------------------------------
# PREP — extract probe items from train.jsonl (unique Tier 1 words)
# --------------------------------------------------------------------------
TIER_1_RE = re.compile(r"\[axis:(?P<axis>\w+)\] \[tier:1\] \[word:(?P<word>[^\]]+)\](?: \[template:(?P<template>P[1-5])\])?(?: \[voice:[^\]]+\])?\n\n(?P<body>.*)", re.DOTALL)


def prep(n_per_axis: int = 10) -> None:
    """Sample n_per_axis Tier 1 words per axis. For each word, collect all
    P1-P5 variants seen in train.jsonl (for multi-shape probe), extract a
    short definition, generate a reversal prompt."""
    PROBES_DIR.mkdir(parents=True, exist_ok=True)

    # Index all Tier 1 docs by axis+word → list of (template, body) variants
    idx: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    n_rows = 0
    with TRAIN_JSONL.open() as fh:
        for line in fh:
            n_rows += 1
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = row.get("text", "")
            m = TIER_1_RE.match(text)
            if not m:
                continue
            axis = m.group("axis")
            word = m.group("word")
            template = m.group("template") or "P?"
            body = m.group("body").strip()
            idx[(axis, word)].append((template, body))
    print(f"[prep] scanned {n_rows:,} train.jsonl rows; found {len(idx):,} unique Tier 1 (axis,word) pairs")

    # Group by axis, sample n_per_axis
    by_axis: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for (axis, word) in idx.keys():
        by_axis[axis].append((axis, word))
    for axis in by_axis:
        by_axis[axis].sort()  # deterministic
    items: list[dict] = []
    for axis in ("sensation", "intuition", "thinking", "feeling"):
        pool = by_axis.get(axis, [])
        # Take evenly-spaced sample
        step = max(1, len(pool) // n_per_axis)
        sample = pool[::step][:n_per_axis]
        for (axis_, word) in sample:
            variants = idx[(axis_, word)]
            # Pick a "canonical" definition from the first P1 variant if present,
            # else any variant.
            canonical = None
            for tmpl, body in variants:
                if tmpl == "P1":
                    canonical = body
                    break
            if canonical is None:
                canonical = variants[0][1]
            # Extract expected keywords: take word tokens from canonical
            # definition (top nouns/verbs after stopword filter).
            kw = _keywords(canonical, word)
            # Reversal: strip out the word itself + build "the word is called X" style prompt.
            rev_def = _redact_word(canonical, word)[:400]
            items.append({
                "id":          f"{axis_}/{word}",
                "axis":        axis_,
                "word":        word,
                "definition":  canonical[:800],
                "keywords":    kw,
                "rev_def":     rev_def,
                "variants":    [{"template": t, "body": b[:800]} for t, b in variants[:5]],
            })
    with ITEMS_JSONL.open("w") as fh:
        for it in items:
            fh.write(json.dumps(it) + "\n")
    print(f"[prep] wrote {len(items):,} probe items to {ITEMS_JSONL}")
    counts = Counter(it["axis"] for it in items)
    for a, c in counts.most_common():
        print(f"[prep]   {a}: {c}")


STOPWORDS = set("a an the is are was were be been being has have had do does did in on at to of for from with by as it its this that these those and or but if then else when what where how who why which whose whom motoi child word idea code appears near lives".split())


def _keywords(text: str, word: str, k: int = 8) -> list[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z\-]{2,}", text.lower())
    freq = Counter(t for t in tokens if t not in STOPWORDS and t != word.lower())
    return [t for t, _ in freq.most_common(k)]


def _redact_word(text: str, word: str) -> str:
    return re.sub(re.escape(word), "___", text, flags=re.IGNORECASE)


# --------------------------------------------------------------------------
# RUN — load model, run 6 probes, emit results.jsonl
# --------------------------------------------------------------------------
def stage_adapter(target: str) -> str | None:
    """Ensure the adapter dir has the canonical filenames mlx_lm expects."""
    if target == "base":
        return None
    src_dir = Path(TARGET_ADAPTERS[target])
    stage = STAGING_DIR / target
    stage.mkdir(parents=True, exist_ok=True)

    if target in ("mk2-cpt", "mk3-cpt"):
        # Both have canonical filenames wired in the source dir
        for name in ("adapter_config.json", "adapters.safetensors"):
            src = src_dir / name
            dst = stage / name
            if dst.is_symlink() or dst.exists():
                dst.unlink()
            dst.symlink_to(src)
    elif target == "mk1-sft":
        # Named files — stage as canonical names
        src_cfg = src_dir / "mk1-sft-final-20260720.adapter_config.json"
        src_sf  = src_dir / "mk1-sft-final-20260720.safetensors"
        dst_cfg = stage / "adapter_config.json"
        dst_sf  = stage / "adapters.safetensors"
        for src, dst in ((src_cfg, dst_cfg), (src_sf, dst_sf)):
            if dst.is_symlink() or dst.exists():
                dst.unlink()
            dst.symlink_to(src)
    return str(stage)


def run(target: str, items_path: Path, out_dir: Path, max_tokens: int = 160) -> None:
    from mlx_lm import load, generate
    import mlx.core as mx

    out_dir.mkdir(parents=True, exist_ok=True)
    adapter_dir = stage_adapter(target)
    print(f"[run/{target}] loading model {BASE_MODEL}  adapter={adapter_dir or '(none)'}")
    t0 = time.time()
    model, tokenizer = load(BASE_MODEL, adapter_path=adapter_dir)
    print(f"[run/{target}] loaded in {time.time()-t0:.1f}s")

    items = [json.loads(l) for l in items_path.open() if l.strip()]
    print(f"[run/{target}] {len(items)} probe items")

    results_path = out_dir / "results.jsonl"
    results_fh = results_path.open("w")
    n_done = 0
    def emit(row: dict):
        nonlocal n_done
        results_fh.write(json.dumps(row) + "\n")
        results_fh.flush()
        n_done += 1

    def gen(prompt: str, max_toks: int = max_tokens) -> str:
        try:
            return generate(model, tokenizer, prompt=prompt, max_tokens=max_toks, verbose=False)
        except Exception as e:
            return f"__ERROR__: {e}"

    # --- Probe 2 — cold continuation ------------------------------------
    print(f"[run/{target}] probe 2: cold continuation")
    for it in items:
        prompt = f"[axis:{it['axis']}] [tier:1] [word:{it['word']}]\n\n"
        completion = gen(prompt, 120)
        hits = sum(1 for k in it["keywords"] if k.lower() in completion.lower())
        emit({
            "probe": "cold-continuation",
            "target": target,
            "id": it["id"],
            "axis": it["axis"],
            "word": it["word"],
            "prompt": prompt,
            "completion": completion[:800],
            "keyword_hits": hits,
            "keyword_max": len(it["keywords"]),
        })

    # --- Probe 3 — reversal recall --------------------------------------
    print(f"[run/{target}] probe 3: reversal recall")
    for it in items:
        prompt = (
            f"Read the definition. Name the single Motoi {it['axis']}-axis word it defines.\n\n"
            f"Definition: {it['rev_def']}\n\n"
            f"The word is:"
        )
        completion = gen(prompt, 24)
        hit = it["word"].lower() in completion.lower()
        emit({
            "probe": "reversal",
            "target": target,
            "id": it["id"],
            "axis": it["axis"],
            "word": it["word"],
            "completion": completion[:200],
            "hit": bool(hit),
        })

    # --- Probe 4 — multi-shape consistency ------------------------------
    print(f"[run/{target}] probe 4: multi-shape consistency (P1..P5)")
    for it in items:
        completions = {}
        for v in it["variants"][:5]:
            tmpl = v["template"]
            prompt = f"[axis:{it['axis']}] [tier:1] [word:{it['word']}] [template:{tmpl}]\n\n"
            comp = gen(prompt, 100)
            completions[tmpl] = comp[:400]
        # Similarity: jaccard on keyword sets
        toks = {t: set(re.findall(r"[A-Za-z][A-Za-z\-]{2,}", c.lower())) for t, c in completions.items()}
        keys = list(toks.keys())
        pairwise = []
        for i in range(len(keys)):
            for j in range(i+1, len(keys)):
                a, b = toks[keys[i]], toks[keys[j]]
                if not a or not b:
                    continue
                jac = len(a & b) / max(1, len(a | b))
                pairwise.append(jac)
        avg = sum(pairwise) / len(pairwise) if pairwise else 0.0
        emit({
            "probe": "multi-shape",
            "target": target,
            "id": it["id"],
            "axis": it["axis"],
            "word": it["word"],
            "completions": completions,
            "n_templates": len(keys),
            "pairwise_jaccard_mean": round(avg, 4),
        })

    # --- Probe 5 — FIM completion ---------------------------------------
    print(f"[run/{target}] probe 5: FIM completion")
    fim_samples = [
        # simple hole in a Scheme define — probe if base identity preserved
        ("<|fim_prefix|>(define (double x)\n  (* <|fim_suffix|>))<|fim_middle|>",
         ["2", "x"], "double-x"),
        ("<|fim_prefix|>(define (greet name)\n  (display <|fim_suffix|>))<|fim_middle|>",
         ["name", "hello"], "greet"),
        # motoi-ish
        ("<|fim_prefix|>(define (card-open id)\n  (<|fim_suffix|>))<|fim_middle|>",
         ["focus", "card", "open"], "card-open"),
        ("<|fim_prefix|>(define (sprite-move sid dx dy)\n  (<|fim_suffix|>))<|fim_middle|>",
         ["sprite", "move", "translate"], "sprite-move"),
    ]
    for prompt, keys, label in fim_samples:
        completion = gen(prompt, 60)
        hits = sum(1 for k in keys if k.lower() in completion.lower())
        emit({
            "probe": "fim",
            "target": target,
            "id": f"fim/{label}",
            "prompt": prompt,
            "completion": completion[:400],
            "keyword_hits": hits,
            "keyword_max": len(keys),
        })

    # --- Probe 6 — perplexity on val sample -----------------------------
    print(f"[run/{target}] probe 6: perplexity on valid.jsonl sample")
    val_rows: list[str] = []
    with VALID_JSONL.open() as fh:
        for line in fh:
            try:
                val_rows.append(json.loads(line)["text"])
            except Exception:
                continue
            if len(val_rows) >= 100:
                break
    total_nll = 0.0
    total_tok = 0
    n_done_val = 0
    for text in val_rows:
        try:
            tok_ids = tokenizer.encode(text[:2000])
            if len(tok_ids) < 2:
                continue
            inp = mx.array([tok_ids[:-1]])
            tgt = mx.array([tok_ids[1:]])
            logits = model(inp)
            # NLL per token via log-softmax gather
            log_probs = mx.log_softmax(logits, axis=-1)
            gather = mx.take_along_axis(log_probs, tgt[..., None], axis=-1)
            nll = -mx.sum(gather).item()
            total_nll += nll
            total_tok += tgt.size
            n_done_val += 1
        except Exception as e:
            emit({"probe": "perplexity", "target": target, "error": str(e), "row": text[:200]})
            continue
    ppl = float("inf") if total_tok == 0 else pow(2.718281828, total_nll / total_tok)
    emit({
        "probe": "perplexity",
        "target": target,
        "n_rows": n_done_val,
        "n_tokens": total_tok,
        "mean_nll": total_nll / max(1, total_tok),
        "perplexity": ppl,
    })

    results_fh.close()
    print(f"[run/{target}] wrote {n_done:,} result rows to {results_path}")


# --------------------------------------------------------------------------
# MEMORIZATION — the "is the data in there" test (item-level, not distribution)
# --------------------------------------------------------------------------
#
# Method per Carlini et al. "Extracting Training Data from Large Language
# Models" (2020) + Physics-3.1's extraction framing. For each of N training
# rows, split text into (prefix, continuation) at ~30 tokens. Generate 100
# tokens from the prefix. Score:
#   - token_prefix_match — how many first tokens of generation match
#     training continuation exactly, greedy from index 0. This is THE
#     memorization signal.
#   - word_jaccard — Jaccard of word sets (fuzzy overlap).
#   - training_terms_hit — fraction of top-10 distinctive training words
#     that appear in the generation.
#
# Base vs CPT Weave: Base has NEVER seen this material. If Base scores
# above zero, it's coincidental hits on generic language. If CPT Weave
# scores much higher, the data landed. That's the answer.
def memorization(target: str, n: int = 50) -> None:
    from mlx_lm import load, generate
    import random

    out_dir = PROBES_DIR / target
    out_dir.mkdir(parents=True, exist_ok=True)
    adapter_dir = stage_adapter(target)
    print(f"[mem/{target}] loading model {BASE_MODEL}  adapter={adapter_dir or '(none)'}")
    t0 = time.time()
    model, tokenizer = load(BASE_MODEL, adapter_path=adapter_dir)
    print(f"[mem/{target}] loaded in {time.time()-t0:.1f}s")

    # Sample training rows — prefer Tier 1 (dense, canonical content) but
    # take some Tier 2/3 too for coverage.
    tier1_rows: list[str] = []
    other_rows: list[str] = []
    with TRAIN_JSONL.open() as fh:
        for line in fh:
            try:
                text = json.loads(line).get("text", "")
            except json.JSONDecodeError:
                continue
            if not text or len(text) < 200:
                continue
            if "[tier:1]" in text[:200]:
                tier1_rows.append(text)
            elif "[tier:" in text[:200]:
                other_rows.append(text)
    random.seed(31)
    random.shuffle(tier1_rows)
    random.shuffle(other_rows)
    n_t1 = int(n * 0.7)
    sample = tier1_rows[:n_t1] + other_rows[: n - n_t1]
    print(f"[mem/{target}] sampled {len(sample)} rows ({n_t1} Tier 1, {n - n_t1} other)")

    results_path = out_dir / "mem-results.jsonl"
    results_fh = results_path.open("w")
    n_done = 0

    def emit(row: dict):
        nonlocal n_done
        results_fh.write(json.dumps(row) + "\n")
        results_fh.flush()
        n_done += 1

    for i, text in enumerate(sample):
        # Split at ~40 tokens. Tokenize once, then split by token index.
        try:
            token_ids = tokenizer.encode(text)
        except Exception as e:
            emit({"probe": "memorization", "target": target, "error": str(e), "idx": i})
            continue
        if len(token_ids) < 60:
            continue
        split_at = 40
        prefix_ids = token_ids[:split_at]
        expected_ids = token_ids[split_at : split_at + 100]  # first 100 continuation tokens
        try:
            prefix_text = tokenizer.decode(prefix_ids)
            expected_text = tokenizer.decode(expected_ids)
        except Exception:
            continue
        try:
            generated = generate(model, tokenizer, prompt=prefix_text,
                                 max_tokens=100, verbose=False)
        except Exception as e:
            emit({"probe": "memorization", "target": target, "error": f"gen: {e}", "idx": i})
            continue
        # Re-tokenize the generation
        try:
            gen_ids = tokenizer.encode(generated)
            # Strip echoed prefix from generation if tokenizer includes it
            if gen_ids[:split_at] == prefix_ids:
                gen_continuation_ids = gen_ids[split_at : split_at + 100]
            else:
                gen_continuation_ids = gen_ids[:100]
        except Exception:
            gen_continuation_ids = []
        # Score 1: greedy prefix-token match (memorization signal)
        prefix_match = 0
        for a, b in zip(gen_continuation_ids, expected_ids):
            if a == b:
                prefix_match += 1
            else:
                break
        # Score 2: word Jaccard (fuzzy overlap)
        gen_words = set(re.findall(r"[A-Za-z][A-Za-z\-]{2,}", generated.lower()))
        exp_words = set(re.findall(r"[A-Za-z][A-Za-z\-]{2,}", expected_text.lower()))
        jac = (len(gen_words & exp_words) / max(1, len(gen_words | exp_words))) if exp_words else 0.0
        # Score 3: training-term hits — top 10 distinctive words from expected
        exp_word_freq = Counter(re.findall(r"[A-Za-z][A-Za-z\-]{2,}", expected_text.lower()))
        distinct = [w for w, _ in exp_word_freq.most_common(20)
                    if w not in STOPWORDS][:10]
        gen_lower = generated.lower()
        term_hits = sum(1 for w in distinct if w in gen_lower)
        # Axis tag (if present in prefix)
        axis_m = re.search(r"\[axis:(\w+)\]", prefix_text)
        axis = axis_m.group(1) if axis_m else "?"
        emit({
            "probe": "memorization",
            "target": target,
            "idx": i,
            "axis": axis,
            "prefix_first_40": prefix_text[:200],
            "expected_first_60": expected_text[:200],
            "generated_first_60": generated[:200],
            "token_prefix_match_len": prefix_match,
            "word_jaccard": round(jac, 4),
            "training_terms_hit": term_hits,
            "training_terms_total": len(distinct),
        })

    results_fh.close()
    print(f"[mem/{target}] wrote {n_done} rows to {results_path}")


# --------------------------------------------------------------------------
# REPORT — aggregate 3-way results into REPORT.md
# --------------------------------------------------------------------------
def report() -> None:
    targets = ["base", "mk1-sft", "mk2-cpt"]
    per: dict[str, list[dict]] = {}
    for t in targets:
        p = PROBES_DIR / t / "results.jsonl"
        if not p.exists():
            print(f"[report] MISSING {p}")
            per[t] = []
            continue
        per[t] = [json.loads(l) for l in p.open() if l.strip()]
        print(f"[report] {t}: {len(per[t])} rows")

    def rows_for(t: str, probe: str) -> list[dict]:
        return [r for r in per[t] if r.get("probe") == probe]

    lines: list[str] = []
    lines.append("# Motoi Mk 2 CPT — 3-way probe report (2026-07-21)")
    lines.append("")
    lines.append("Targets: **Base** (vanilla Qwen2.5-Coder-1.5B) · **SFT Weave** "
                 "(Mk 1 SFT LoRA r=128, pre-weave-doctrine) · **CPT Weave** "
                 "(Mk 2 CPT full-param, weave-doctrine applied)")
    lines.append("")
    lines.append(f"Probe items: {ITEMS_JSONL.name}  ·  n=10 per axis (40 total)")
    lines.append("")
    # Display labels per target key
    LABEL = {"base": "Base", "mk1-sft": "SFT Weave", "mk2-cpt": "CPT Weave"}

    # Probe 2 — cold continuation
    lines.append("## Probe 2 — cold continuation (fact attachment)")
    lines.append("")
    lines.append("Mean keyword-hit ratio (higher = model produced training-material terms).")
    lines.append("")
    lines.append("| axis | Base | SFT Weave | CPT Weave | Δ (CPT − Base) |")
    lines.append("|---|---:|---:|---:|---:|")
    axes = ("sensation", "intuition", "thinking", "feeling")
    for axis in axes:
        stats = {}
        for t in targets:
            rows = [r for r in rows_for(t, "cold-continuation") if r.get("axis") == axis]
            if not rows:
                stats[t] = float("nan")
                continue
            ratios = [r["keyword_hits"] / max(1, r["keyword_max"]) for r in rows]
            stats[t] = sum(ratios) / len(ratios)
        delta = stats["mk2-cpt"] - stats["base"] if not (stats["mk2-cpt"] != stats["mk2-cpt"] or stats["base"] != stats["base"]) else float("nan")
        lines.append(f"| {axis} | {stats['base']:.3f} | {stats['mk1-sft']:.3f} | {stats['mk2-cpt']:.3f} | {delta:+.3f} |")
    lines.append("")

    # Probe 3 — reversal
    lines.append("## Probe 3 — reversal recall (definition → word)")
    lines.append("")
    lines.append("Hit rate = fraction where model produced the trained word given the definition.")
    lines.append("")
    lines.append("| axis | Base | SFT Weave | CPT Weave | Δ (CPT − Base) |")
    lines.append("|---|---:|---:|---:|---:|")
    for axis in axes:
        stats = {}
        for t in targets:
            rows = [r for r in rows_for(t, "reversal") if r.get("axis") == axis]
            stats[t] = (sum(1 for r in rows if r.get("hit")) / max(1, len(rows))) if rows else float("nan")
        delta = stats["mk2-cpt"] - stats["base"]
        lines.append(f"| {axis} | {stats['base']:.3f} | {stats['mk1-sft']:.3f} | {stats['mk2-cpt']:.3f} | {delta:+.3f} |")
    lines.append("")

    # Probe 4 — multi-shape consistency
    lines.append("## Probe 4 — multi-shape consistency (P1..P5 pairwise Jaccard)")
    lines.append("")
    lines.append("Higher = model gives consistent answers across templates for the same fact.")
    lines.append("")
    lines.append("| axis | Base | SFT Weave | CPT Weave | Δ (CPT − Base) |")
    lines.append("|---|---:|---:|---:|---:|")
    for axis in axes:
        stats = {}
        for t in targets:
            rows = [r for r in rows_for(t, "multi-shape") if r.get("axis") == axis]
            vals = [r.get("pairwise_jaccard_mean", 0.0) for r in rows]
            stats[t] = (sum(vals) / len(vals)) if vals else float("nan")
        delta = stats["mk2-cpt"] - stats["base"]
        lines.append(f"| {axis} | {stats['base']:.3f} | {stats['mk1-sft']:.3f} | {stats['mk2-cpt']:.3f} | {delta:+.3f} |")
    lines.append("")

    # Probe 5 — FIM
    lines.append("## Probe 5 — FIM completion (Qwen native tokens · Data Type G)")
    lines.append("")
    lines.append("| target | mean hit ratio |")
    lines.append("|---|---:|")
    for t in targets:
        rows = rows_for(t, "fim")
        ratios = [r["keyword_hits"] / max(1, r["keyword_max"]) for r in rows]
        mean = (sum(ratios) / len(ratios)) if ratios else float("nan")
        lines.append(f"| {LABEL[t]} | {mean:.3f} |")
    lines.append("")

    # Probe 6 — perplexity
    lines.append("## Probe 6 — perplexity on held-out valid.jsonl")
    lines.append("")
    lines.append("Lower = better fit on training-material distribution. Vast Base → CPT Weave drop = fact attachment landed.")
    lines.append("")
    lines.append("| target | rows | tokens | mean NLL | perplexity |")
    lines.append("|---|---:|---:|---:|---:|")
    for t in targets:
        r = next((r for r in rows_for(t, "perplexity") if "perplexity" in r), None)
        if r is None:
            lines.append(f"| {LABEL[t]} | — | — | — | — |")
            continue
        lines.append(f"| {LABEL[t]} | {r['n_rows']} | {r['n_tokens']} | {r['mean_nll']:.3f} | {r['perplexity']:.2f} |")
    lines.append("")

    # Summary + doctrine composition
    lines.append("## Doctrine composition")
    lines.append("")
    lines.append("- `cpt-serves-sft-2026-07-21` — CPT-layer probes measure fact attachment, not retrieval shapes.")
    lines.append("- `did-we-succeed-what-did-we-learn-2026-07-20` — measured the capability the pairs were shaped for (MeCo-prefixed 5-template + reversal + FIM = fact attachment).")
    lines.append("- Physics-3.1 / MeCo / Reversal Curse / EntiGraph — the papers this test suite operationalizes.")
    lines.append("")
    lines.append("## Read this like:")
    lines.append("")
    lines.append("- **Probe 2 large positive Δ** = CPT injected knowledge (target signal).")
    lines.append("- **Probe 3 large positive Δ** = reversal shapes attached (Reversal Curse defeated).")
    lines.append("- **Probe 4 large positive Δ** = 5-template diversity generalized to consistent retrieval.")
    lines.append("- **Probe 6 huge base→cpt PPL drop** = the val distribution is now in-domain.")
    lines.append("- **Probe 5 mk2-cpt hits ≥ base hits** = FIM code completion took (Data Type G).")
    lines.append("- **mk1-sft between base and mk2-cpt** on Probe 2/3 = the balanced-weave doctrine's incremental value over unbalanced SFT.")

    (PROBES_DIR / "REPORT.md").write_text("\n".join(lines))
    print(f"[report] wrote {PROBES_DIR / 'REPORT.md'}")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_prep = sub.add_parser("prep")
    p_prep.add_argument("--n", type=int, default=10, help="items per axis (default 10 → 40 total)")

    p_run = sub.add_parser("run")
    p_run.add_argument("--target", required=True, choices=list(TARGET_ADAPTERS))
    p_run.add_argument("--items", default=str(ITEMS_JSONL))
    p_run.add_argument("--out", default=None, help="output dir (default probes/<target>)")

    p_mem = sub.add_parser("mem", help="memorization probe — 'is the data in there'")
    p_mem.add_argument("--target", required=True, choices=list(TARGET_ADAPTERS))
    p_mem.add_argument("--n", type=int, default=50, help="training rows to probe (default 50)")

    sub.add_parser("report")

    args = parser.parse_args()
    if args.cmd == "prep":
        prep(args.n)
    elif args.cmd == "run":
        out_dir = Path(args.out) if args.out else PROBES_DIR / args.target
        run(args.target, Path(args.items), out_dir)
    elif args.cmd == "mem":
        memorization(args.target, args.n)
    elif args.cmd == "report":
        report()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
