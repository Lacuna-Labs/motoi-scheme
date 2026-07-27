"""Motoi Mk 3 SFT bundle orchestrator (2026-07-22).

Substitutes the pipeline's graph + book extractors with the enriched
v2 output from book_phd_extractor (248k pairs · 17 behaviors · all 6
Bloom levels including CREATE · corpus-mined graph fills · honest-null
training signals · book prose in every completion).

Everything else — reference, motoi-cart, curator-cart, hand-authored,
Lacan paraphrase, Bloom balance, interleave, split — reuses the
existing main.py pipeline.

Output: ~/.forge/corpus/motoi-mk3-sft-isb/
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "extractors"))

import reference as ref_extractor
import cart as cart_extractor
import curator_cart as curator_cart_extractor
from slices.hand_authored import iter_all_hand_authored
from augment.audience import apply_audience_expansion
from augment.lacan import apply_lacan_paraphrase
from augment.short_direct import derive_short_direct
from augment.contrastive import generate_contrastive
from centrality import compute_concept_scores
from interleave import interleave, spread_duplicates
from bloom_balancer import bloom_balance
from preflight import run_preflight
from balance_report import format_report


OUT_DIR = Path.home() / ".forge/corpus/motoi-mk3-sft-isb"
V2_JSONL = Path.home() / ".forge/corpus/motoi-mk3-graph-book-enriched-v2-2026-07-22.jsonl"
VAL_FRACTION = 0.05
SEED = 42


def _ensure_substrate(pair: dict, substrate: str) -> dict:
    """Normalize pair schema. Pipeline expects `user`/`motoi` keys; v2 uses `prompt`/`completion`."""
    if "prompt" in pair and "user" not in pair:
        pair["user"] = pair["prompt"]
    if "completion" in pair and "motoi" not in pair:
        pair["motoi"] = pair["completion"]
    t = pair.setdefault("tags", {})
    if "substrate" not in t:
        t["substrate"] = substrate
    if "concept" not in t:
        if substrate == "book":
            book = t.get("book", "")
            ch = t.get("chapter", "")
            t["concept"] = f"{book}#ch{ch}" if book else ""
        else:
            t["concept"] = t.get("concept", "")
    return pair


def load_v2_pairs() -> list[dict]:
    pairs = []
    with V2_JSONL.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            d = json.loads(line)
            substrate = d.get("tags", {}).get("substrate", "graph")
            # Map "book-chapter-index" → "book" for pipeline compatibility
            if substrate == "book-chapter-index":
                substrate = "book"
            pairs.append(_ensure_substrate(d, substrate))
    return pairs


def collect_canonical() -> list[dict]:
    pairs: list[dict] = []

    print("  [1/5] reference verbs (from pipeline extractor)...")
    t0 = time.time()
    n0 = 0
    for v in ref_extractor.iter_all_verbs():
        for p in ref_extractor.emit_pairs_for_verb(v):
            pairs.append(_ensure_substrate(p, "reference"))
            n0 += 1
    print(f"        {n0:,} pairs ({time.time()-t0:.1f}s)")

    print("  [2/5] graph + book (from v2 enriched output)...")
    t0 = time.time()
    v2_pairs = load_v2_pairs()
    n1 = len(v2_pairs)
    pairs.extend(v2_pairs)
    print(f"        {n1:,} pairs ({time.time()-t0:.1f}s)")

    print("  [3/5] motoi carts...")
    t0 = time.time()
    n2 = 0
    for c in cart_extractor.iter_all_carts():
        for p in cart_extractor.emit_pairs_for_cart(c):
            pairs.append(_ensure_substrate(p, "cart"))
            n2 += 1
    print(f"        {n2:,} pairs ({time.time()-t0:.1f}s)")

    print("  [4/5] curator carts...")
    t0 = time.time()
    n3 = 0
    for c in curator_cart_extractor.iter_all_curator_carts():
        for p in curator_cart_extractor.emit_pairs_for_curator_cart(c):
            pairs.append(_ensure_substrate(p, "curator_cart"))
            n3 += 1
    print(f"        {n3:,} pairs ({time.time()-t0:.1f}s)")

    print("  [5/5] hand-authored slices...")
    t0 = time.time()
    n4 = 0
    for p in iter_all_hand_authored():
        pairs.append(_ensure_substrate(p, "hand-authored"))
        n4 += 1
    print(f"        {n4:,} pairs ({time.time()-t0:.1f}s)")

    return pairs


def to_mlx_lm(pair: dict) -> dict:
    return {"prompt": pair.get("user") or pair.get("prompt", ""),
            "completion": pair.get("motoi") or pair.get("completion", "")}


def write_jsonl(pairs: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(to_mlx_lm(p), ensure_ascii=False) + "\n")


def main() -> int:
    print("### Motoi Mk3 SFT bundle — v2 graph+book substituted ###")
    print()

    print("### STEP 1 — canonical extraction ###")
    canonical = collect_canonical()
    print(f"\ncanonical total: {len(canonical):,} pairs\n")

    print("### STEP 2 — centrality scoring ###")
    scores = compute_concept_scores(canonical)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top_1000 = [c for c, _ in ranked[:1000]]
    top_2500 = [c for c, _ in ranked[:2500]]
    print(f"  ranked {len(scores):,} concepts")

    print("\n### STEP 3 — k-PhD audience expansion (top-1000) ###")
    n_before = len(canonical)
    with_audience = apply_audience_expansion(canonical, top_1000, seed=SEED)
    print(f"  {n_before:,} -> {len(with_audience):,}")

    print("\n### STEP 4 — Lacan paraphrase (metaphor + metonymy) ###")
    n_before = len(with_audience)
    paraphrased = apply_lacan_paraphrase(with_audience, seed=SEED, multiplier_cap=3)
    print(f"  {n_before:,} -> {len(paraphrased):,} after Lacan (up to 3x)")

    print("\n### STEP 5 — short-direct counterparts ###")
    n_before = len(paraphrased)
    with_short = derive_short_direct(paraphrased)
    print(f"  {n_before:,} -> {len(with_short):,}")

    print("\n### STEP 6 — contrastive discrimination (~15%) ###")
    contrastive = generate_contrastive(with_short, top_2500, limit_per_concept=1)
    combined = with_short + contrastive
    print(f"  +{len(contrastive):,} -> {len(combined):,}")

    print("\n### STEP 7 — Bloom balance ###")
    balanced = bloom_balance(combined, target_range=(0.12, 0.22), seed=SEED)
    print(f"  {len(combined):,} -> {len(balanced):,}")

    print("\n### STEP 8 — interleave (Fisher-Yates + concept-run constraint) ###")
    interleaved = interleave(balanced, seed=SEED)
    print(f"  {len(interleaved):,}")

    print("\n### STEP 9 — spread duplicates ###")
    spread = spread_duplicates(interleaved)
    print(f"  {len(spread):,}")

    print("\n### STEP 10 — split 95/5 ###")
    n_val = int(len(spread) * VAL_FRACTION)
    val = spread[-n_val:]
    train = spread[:-n_val]
    print(f"  train: {len(train):,}  val: {len(val):,}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Defensive: fill None tag values so balance-report doesn't crash
    for p in spread:
        t = p.setdefault("tags", {})
        for tk, default in [
            ("philosopher", "unknown"),
            ("shape", "unknown"),
            ("substrate", "unknown"),
            ("bloom_level", "understand"),
            ("book_type", "unknown"),
            ("book", "unknown"),
            ("cart", "unknown"),
            ("axis", "unknown"),
            ("tier", 3),
        ]:
            if t.get(tk) is None:
                t[tk] = default
    report = format_report(spread)
    (OUT_DIR / "balance-report.txt").write_text(report, encoding="utf-8")

    print("\n### STEP 11 — preflight ###")
    ok, checks = run_preflight(spread)
    check_lines = []
    for name, passed, detail in checks:
        marker = "PASS" if passed else "FAIL"
        check_lines.append(f"  [{marker}] {name}: {detail}")
    (OUT_DIR / "preflight.txt").write_text(
        f"Overall: {'PASS' if ok else 'FAIL'}\n" + "\n".join(check_lines) + "\n",
        encoding="utf-8",
    )
    print("  " + ("PASS" if ok else "FAIL"))
    for line in check_lines:
        print(line)

    print("\n### STEP 12 — write MLX-LM JSONL ###")
    write_jsonl(train, OUT_DIR / "train.jsonl")
    write_jsonl(val, OUT_DIR / "valid.jsonl")

    manifest = {
        "version": "motoi-mk3-sft-isb-2026-07-22",
        "source_v2": str(V2_JSONL),
        "canonical_pairs": len(canonical),
        "after_audience": len(with_audience),
        "after_lacan": len(paraphrased),
        "after_short_direct": len(with_short),
        "after_contrastive": len(combined),
        "after_bloom_balance": len(balanced),
        "final_total": len(spread),
        "train": len(train),
        "val": len(val),
        "preflight_pass": ok,
        "output_dir": str(OUT_DIR),
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\ndone. total: {len(spread):,} pairs")
    print(f"output: {OUT_DIR}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
