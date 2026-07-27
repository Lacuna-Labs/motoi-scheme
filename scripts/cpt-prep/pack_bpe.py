#!/usr/bin/env python3
"""
True-BPE sequence packer for Motoi CPT.

The emit-time packer (`emit_cpt_v5.py::_pack_sequences`) measures length with a
whitespace-split proxy, which under-counts BPE badly: a "2048-word" pack is
~7,800 BPE tokens. Trained at any sane `max_seq_length` that silently truncated
most of every pack (Mk2 lost ~87% of its corpus at window 1024).

This repacker measures real Qwen BPE and packs to a token target that MATCHES
the trainer's `max_seq_length`, so nothing is truncated. Run it AFTER emit,
under the forge venv (which has transformers). It overwrites the packed files.

Usage:
  ~/code/forge/.venv/bin/python3 scripts/cpt-prep/pack_bpe.py \
      --data ~/.forge/data/motoi-mk3-cpt --target 4096
"""
import argparse, json, sys
from pathlib import Path

TOK_DEFAULT = ("/Users/alfred/.cache/huggingface/hub/"
               "models--Qwen--Qwen2.5-Coder-1.5B-Instruct/snapshots/"
               "2e1fd397ee46e1388853d2af2c993145b0f1098a")
SEP = "\n\n"


def _load_texts(path: Path):
    return [json.loads(line)["text"] for line in path.open()]


def _bpe_lengths(tok, texts, batch=1000):
    out = []
    for i in range(0, len(texts), batch):
        enc = tok(texts[i:i + batch], add_special_tokens=False)
        out.extend(len(x) for x in enc["input_ids"])
    return out


def pack(texts, lens, target, sep_len):
    """Greedy first-fit. Never splits a doc; a doc longer than target becomes
    its own pack (caller should pick target >= max doc length to avoid any
    truncation at train time)."""
    packs = []
    cur_parts, cur_bounds, cur = [], [], 0
    oversized = 0
    for t, L in zip(texts, lens):
        if L > target:
            oversized += 1
        add = L if cur == 0 else L + sep_len
        if cur > 0 and cur + add > target:
            packs.append({"text": SEP.join(cur_parts),
                          "boundaries": cur_bounds, "n_docs": len(cur_parts)})
            cur_parts, cur_bounds, cur = [], [], 0
            add = L
        cur_parts.append(t)
        cur_bounds.append(L)
        cur += add
    if cur_parts:
        packs.append({"text": SEP.join(cur_parts),
                      "boundaries": cur_bounds, "n_docs": len(cur_parts)})
    return packs, oversized


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, type=Path)
    ap.add_argument("--target", type=int, default=4096)
    ap.add_argument("--tokenizer", default=TOK_DEFAULT)
    args = ap.parse_args()

    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(args.tokenizer)
    sep_len = len(tok(SEP, add_special_tokens=False)["input_ids"])

    for split in ("train", "valid"):
        src = args.data / f"{split}.jsonl"
        if not src.exists():
            print(f"  skip {split}: {src} missing")
            continue
        texts = _load_texts(src)
        lens = _bpe_lengths(tok, texts)
        packs, oversized = pack(texts, lens, args.target, sep_len)
        filled = sum(sum(p["boundaries"]) + sep_len * (p["n_docs"] - 1)
                     for p in packs)
        util = 100 * filled / (len(packs) * args.target) if packs else 0
        maxpack = max((sum(p["boundaries"]) + sep_len * (p["n_docs"] - 1)
                       for p in packs), default=0)
        out = args.data / f"{split}-packed.jsonl"
        with out.open("w") as f:
            for p in packs:
                f.write(json.dumps(p) + "\n")
        print(f"  {split}: {len(texts):,} docs -> {len(packs):,} packs @ BPE "
              f"{args.target}  util={util:.1f}%  max_pack_bpe={maxpack:,}  "
              f"oversized_docs={oversized}")
        if maxpack > args.target:
            print(f"    !! max pack {maxpack} exceeds target {args.target} — "
                  f"a single doc is longer than the window; raise --target",
                  file=sys.stderr)


if __name__ == "__main__":
    main()
