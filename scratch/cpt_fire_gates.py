#!/usr/bin/env python3
"""CPT ZERO fire gates — the checks that FAIL if the 2026-08-08 misfire repeats.

Pre-fire (default): asserts the staged data dir contains true BPE packs and
that the trainer will consume them at full width.
Post-run (--post): asserts the finished run consumed the whole corpus.

Usage:
  python3 cpt_fire_gates.py --data ~/.forge/data/motoi-cpt-zero-packed
  python3 cpt_fire_gates.py --post --data ~/.forge/data/motoi-cpt-zero-packed \
      --log ~/.forge/runs/motoi-cpt-zero/train.log --epochs 2 --batch 1 --accum 4

Exit 0 = all gates pass. Exit 1 = a named gate failed; NOTHING should fire.
"""
import argparse, json, re, sys
from pathlib import Path

TOK = ("/Users/alfred/.cache/huggingface/hub/"
       "models--Qwen--Qwen2.5-Coder-1.5B-Instruct/snapshots/"
       "2e1fd397ee46e1388853d2af2c993145b0f1098a")
TARGET = 4096
# The 20-emitter families from mlx-cpt-config.yaml's header — every one must
# appear in the packed train set (gate 5: emitted-but-not-packed).
SUBSTRATE_MARKERS = [
    "[substrate:reference-verb]", "[substrate:book]", "[substrate:graph-",
    "[substrate:honest-null]", "[substrate:lang-eng]", "[substrate:cart-motoi]",
    "[substrate:spec]",
]

FAILED = []


def gate(name, ok, detail):
    tag = "PASS" if ok else "FAIL"
    print(f"[gate:{name}] {tag} — {detail}")
    if not ok:
        FAILED.append(name)


def pre(args):
    import random
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(TOK)

    for split, min_packs in (("train", 9000), ("valid", 150)):
        path = args.data / f"{split}.jsonl"
        if not path.exists():
            gate(f"{split}-exists", False, f"{path} missing")
            continue
        lines = path.read_text().splitlines()
        gate(f"{split}-count", len(lines) >= min_packs,
             f"{len(lines):,} packs (expect >= {min_packs:,})")

        recs = [json.loads(l) for l in random.Random(59).sample(lines, min(20, len(lines)))]
        # Gate 2: sampled packs re-tokenize to ~TARGET real BPE tokens.
        lens = [len(tok(r["text"], add_special_tokens=False)["input_ids"]) for r in recs]
        avg = sum(lens) / len(lens)
        gate(f"{split}-pack-width",
             0.90 * TARGET <= avg <= TARGET + 16 and max(lens) <= TARGET + 16,
             f"sampled avg {avg:.0f} BPE, max {max(lens)} (target {TARGET}); "
             f"raw-records dir would score ~227 here")
        # Packs must be multi-doc (raw records are n_docs-less single docs).
        gate(f"{split}-is-packed", all("boundaries" in r and r.get("n_docs", 0) >= 1 for r in recs),
             "boundaries/n_docs present on every sampled line")

    # Gate 5: substrate coverage in packed train.
    train = args.data / "train.jsonl"
    if train.exists():
        text = train.read_text()
        missing = [m for m in SUBSTRATE_MARKERS if m not in text]
        gate("substrate-coverage", not missing,
             f"missing families: {missing or 'none'}")

    # Gate 3: the trainer's own view — total corpus tokens implied.
    if train.exists():
        total = 0
        for l in train.open():
            total += sum(json.loads(l).get("boundaries", []))
        gate("train-total-tokens", total >= 35_000_000,
             f"{total/1e6:.1f}M boundary-sum BPE (expect ~40M+; a raw-records dir "
             f"scores 0.0M here and fails)")


def post(args):
    log = args.log.read_text()
    m = list(re.finditer(r"Trained Tokens (\d+)", log))
    if not m:
        gate("post-trained-tokens", False, "no 'Trained Tokens' lines in log")
        return
    trained = int(m[-1].group(1))
    packs = sum(1 for _ in (args.data / "train.jsonl").open())
    # mlx counts tokens actually pushed through; iters × batch consume packs.
    expected = packs * TARGET * args.epochs
    ratio = trained / expected
    gate("post-full-consumption", 0.90 <= ratio <= 1.05,
         f"trained {trained/1e6:.1f}M vs expected {expected/1e6:.1f}M "
         f"({ratio*100:.1f}%) — the 2026-08-08 misfire scored 1.3% here")
    saved = "Saved final weights" in log
    gate("post-weights-saved", saved, "final weights save line present" if saved else "no save line")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--post", action="store_true")
    ap.add_argument("--log", type=Path, default=Path.home() / ".forge/runs/motoi-cpt-zero/train.log")
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--accum", type=int, default=4)
    args = ap.parse_args()

    (post if args.post else pre)(args)

    if FAILED:
        print(f"\nGATES FAILED: {', '.join(FAILED)} — DO NOT FIRE / DO NOT CERTIFY")
        sys.exit(1)
    print("\nAll gates pass.")


if __name__ == "__main__":
    main()
