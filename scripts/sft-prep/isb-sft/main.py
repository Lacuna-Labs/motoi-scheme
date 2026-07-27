"""ISB-SFT main orchestrator — Option A path (1M+ pairs target).

Pipeline:
    1. Extract canonical from ALL 5 substrates
       (reference · graph · book · motoi-cart · curator-cart)
    2. Fold in hand-authored slices (16-philosopher coverage)
    3. Apply k-PhD audience expansion (top-N central concepts × 3 registers)
    4. Apply Lacan paraphrase (metaphor + metonymy → 3x multiplier)
    5. Derive short-direct counterparts (long-scaffold → tight-terse)
    6. Generate contrastive discrimination pairs (~15%)
    7. Compute centrality + Zipfian oversample
    8. Bloom-balance (rebalance to ~16.7% per level)
    9. Interleave (Fisher-Yates + concept-run constraint)
    10. Spread duplicates (spaced repetition)
    11. Split 95/5 train/val
    12. Write MLX-LM JSONL + balance report + preflight + manifest
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "extractors"))

import reference as ref_extractor
import graph as graph_extractor
import book as book_extractor
import cart as cart_extractor
import curator_cart as curator_cart_extractor

from slices.hand_authored import iter_all_hand_authored
from augment.audience import apply_audience_expansion
from augment.lacan import apply_lacan_paraphrase
from augment.short_direct import derive_short_direct
from augment.contrastive import generate_contrastive

from centrality import compute_concept_scores, oversample, bucket_report
from interleave import interleave, spread_duplicates
from bloom_balancer import bloom_balance
from preflight import run_preflight
from balance_report import format_report


OUT_DIR = Path.home() / ".forge/corpus/motoi-mk2-sft-isb"
VAL_FRACTION = 0.05
SEED = 42


def _ensure_substrate(pair: dict, substrate: str) -> dict:
    t = pair["tags"]
    if "substrate" not in t:
        t["substrate"] = substrate
    if "concept" not in t:
        if substrate == "book":
            book = t.get("book", "")
            ch = t.get("chapter", "")
            t["concept"] = f"{book}#ch{ch}" if book else ""
        else:
            t["concept"] = t.get("verb") or t.get("cart") or t.get("book") or ""
    if "audience" not in t:
        t["audience"] = "adult"
    return pair


def collect_canonical() -> list[dict]:
    pairs = []
    print("  [1/6] reference verbs...")
    t0 = time.time()
    n0 = 0
    for v in ref_extractor.iter_all_verbs():
        for p in ref_extractor.emit_pairs_for_verb(v):
            pairs.append(_ensure_substrate(p, "reference"))
            n0 += 1
    print(f"        {n0:,} pairs ({time.time()-t0:.1f}s)")

    print("  [2/6] graph nodes...")
    t0 = time.time()
    n1 = 0
    for node in graph_extractor.iter_all_nodes():
        for p in graph_extractor.emit_pairs_for_node(node):
            pairs.append(_ensure_substrate(p, "graph"))
            n1 += 1
    print(f"        {n1:,} pairs ({time.time()-t0:.1f}s)")

    print("  [3/6] book chapters...")
    t0 = time.time()
    n2 = 0
    for ch in book_extractor.iter_all_chapters():
        for p in book_extractor.emit_pairs_for_chapter(ch):
            pairs.append(_ensure_substrate(p, "book"))
            n2 += 1
    print(f"        {n2:,} pairs ({time.time()-t0:.1f}s)")

    print("  [4/6] motoi carts...")
    t0 = time.time()
    n3 = 0
    for c in cart_extractor.iter_all_carts():
        for p in cart_extractor.emit_pairs_for_cart(c):
            pairs.append(_ensure_substrate(p, "cart"))
            n3 += 1
    print(f"        {n3:,} pairs ({time.time()-t0:.1f}s)")

    print("  [5/6] curator carts (~1,285 wired)...")
    t0 = time.time()
    n4 = 0
    for c in curator_cart_extractor.iter_all_curator_carts():
        for p in curator_cart_extractor.emit_pairs_for_curator_cart(c):
            pairs.append(_ensure_substrate(p, "curator_cart"))
            n4 += 1
    print(f"        {n4:,} pairs ({time.time()-t0:.1f}s)")

    print("  [6/6] hand-authored slices (16-philosopher coverage)...")
    t0 = time.time()
    n5 = 0
    for p in iter_all_hand_authored():
        pairs.append(_ensure_substrate(p, "hand-authored"))
        n5 += 1
    print(f"        {n5:,} pairs ({time.time()-t0:.1f}s)")

    return pairs


def to_mlx_lm(pair: dict) -> dict:
    return {"prompt": pair["user"], "completion": pair["motoi"]}


def write_jsonl(pairs: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(to_mlx_lm(p), ensure_ascii=False) + "\n")


def main() -> int:
    print("### STEP 1 — canonical extraction ###")
    canonical = collect_canonical()
    print(f"\ncanonical total: {len(canonical):,} pairs\n")

    print("### STEP 2 — centrality scoring (first pass, on canonical) ###")
    scores = compute_concept_scores(canonical)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top_1000 = [c for c, _ in ranked[:1000]]
    top_2500 = [c for c, _ in ranked[:2500]]
    print(f"  ranked {len(scores):,} concepts")
    print(f"  top-1000 for k-PhD audience expansion")

    print("\n### STEP 3 — k-PhD audience expansion (top-1000 concepts) ###")
    n_before = len(canonical)
    with_audience = apply_audience_expansion(canonical, top_1000, seed=SEED)
    print(f"  {n_before:,} -> {len(with_audience):,} after k-PhD (+kid + phd on top-1000)")

    print("\n### STEP 4 — Lacan paraphrase (metaphor + metonymy) ###")
    n_before = len(with_audience)
    paraphrased = apply_lacan_paraphrase(with_audience, seed=SEED, multiplier_cap=3)
    print(f"  {n_before:,} -> {len(paraphrased):,} after Lacan (up to 3x)")

    print("\n### STEP 5 — short-direct counterparts ###")
    n_before = len(paraphrased)
    with_short = derive_short_direct(paraphrased)
    print(f"  {n_before:,} -> {len(with_short):,} after short-direct derivation")

    print("\n### STEP 6 — contrastive discrimination pairs (~15%) ###")
    contrastive = generate_contrastive(with_short, top_2500, limit_per_concept=1)
    combined = with_short + contrastive
    print(f"  +{len(contrastive):,} contrastive pairs -> {len(combined):,} total")

    print("\n### STEP 7 — centrality Zipfian oversampling ###")
    scores2 = compute_concept_scores(combined)
    oversampled = oversample(combined, scores2)
    print(f"  {len(combined):,} -> {len(oversampled):,} after Zipfian oversample")

    print("\n### STEP 8 — Bloom balance (target ~16.7% per level) ###")
    n_before = len(oversampled)
    balanced = bloom_balance(oversampled, target_range=(0.12, 0.22), seed=SEED)
    print(f"  {n_before:,} -> {len(balanced):,} after Bloom rebalance")

    print("\n### STEP 9 — interleave (Fisher-Yates + concept-run constraint) ###")
    interleaved = interleave(balanced, seed=SEED)
    print(f"  {len(interleaved):,} shuffled")

    print("\n### STEP 10 — spread duplicates ###")
    spread = spread_duplicates(interleaved)
    print(f"  {len(spread):,} spread")

    print("\n### STEP 11 — train/val split (95/5) ###")
    val_size = int(len(spread) * VAL_FRACTION)
    val = spread[:val_size]
    train = spread[val_size:]
    print(f"  train: {len(train):,}   valid: {len(val):,}")

    print("\n### STEP 12 — balance report + preflight ###")
    report = format_report(spread)
    print(report)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "balance-report.txt").write_text(report, encoding="utf-8")

    all_pass, results = run_preflight(spread)
    lines = []
    for name, ok, msg in results:
        mark = "PASS" if ok else "FAIL"
        line = f"  [{mark}] {name:22} — {msg}"
        print(line)
        lines.append(line)
    (OUT_DIR / "preflight.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("\n### writing MLX-LM JSONL ###")
    write_jsonl(train, OUT_DIR / "train.jsonl")
    write_jsonl(val, OUT_DIR / "valid.jsonl")

    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "seed": SEED,
        "canonical_pairs": len(canonical),
        "after_audience": len(with_audience),
        "after_lacan": len(paraphrased),
        "after_short_direct": len(with_short),
        "after_contrastive": len(combined),
        "after_oversample": len(oversampled),
        "after_bloom_balance": len(balanced),
        "final_train_pairs": len(train),
        "final_val_pairs": len(val),
        "distinct_concepts": len(scores2),
        "preflight_pass": all_pass,
        "extractors": ["reference", "graph", "book", "motoi_cart", "curator_cart", "hand_authored"],
        "output_dir": str(OUT_DIR),
        "recipe_doc": "engineering/ISB-SFT-COMPLETE-SYNTHESIS-2026-07-21.ENG.slat",
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\n### DONE ###")
    print(f"output: {OUT_DIR}")
    print(f"  train.jsonl  {len(train):,}")
    print(f"  valid.jsonl  {len(val):,}")
    print(f"  preflight: {'PASS' if all_pass else 'FAIL'}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
