"""Assemble CPT training stream from emitted JSONL per Jess's ratios.

Interleaving order (Jess § section-cpt-execution-per-tier):
  Tier 1 rich → book+ref → Tier 2 → Tier 3 → reversed → repeat

Ratios by doc count (approximate; MeCo cooldown handled separately):
  20% Tier 1 (A)
  40% book+ref (E+F)
  15% Tier 2 (B)
  15% Tier 3 (C)
  10% reversed pairs (D)

Output: one plain-text file with docs separated by two newlines,
plus a manifest JSONL that records provenance per doc.
"""
from __future__ import annotations
import json
import random
import re
from pathlib import Path
from collections import defaultdict
import argparse

REPO = Path("/Users/alfred/code/motoi-scheme")
DEFAULT_IN = REPO / "training-data" / "cpt-mk2"
DEFAULT_OUT_JSONL = DEFAULT_IN / "cpt-stream.jsonl"
DEFAULT_OUT_STREAM = DEFAULT_IN / "cpt-stream.txt"
DEFAULT_OUT_MANIFEST = DEFAULT_IN / "cpt-manifest.jsonl"
DOC_SEP = "\n<|endofdoc|>\n"

# Target ratios BY TOKEN COUNT
# G (FIM code) added per Qwen native-tokens doctrine — code-completion training
# on Motoi-Scheme snippets in Qwen's native <|fim_*|> format.
RATIOS = {
    "A": 0.18,   # Tier 1 rich nodes (was 0.20)
    "E": 0.28,   # Books (was 0.32)
    "F": 0.07,   # Reference (was 0.08)
    "B": 0.14,   # Tier 2 light (was 0.15)
    "C": 0.14,   # Tier 3 stubs (was 0.15)
    "D": 0.09,   # Reversed pairs (was 0.10)
    "G": 0.10,   # FIM code snippets (NEW — Qwen native)
}

CHUNK_TOKENS = 512  # split long docs (E, F, occasionally A) into ~512-token blocks


def approx_tokens(s: str) -> int:
    return len(s.split())


def chunk_doc(doc: dict, chunk_tokens: int = CHUNK_TOKENS) -> list[dict]:
    """Split a long doc into chunks that share the MeCo prefix."""
    text = doc["text"]
    tokens = text.split()
    if len(tokens) <= chunk_tokens:
        return [doc]
    # Extract the MeCo prefix (first line before double newline)
    lines = text.split("\n\n", 1)
    prefix = lines[0] if len(lines) > 1 else ""
    body = lines[1] if len(lines) > 1 else text
    body_tokens = body.split()
    chunks = []
    for i in range(0, len(body_tokens), chunk_tokens):
        chunk_body = " ".join(body_tokens[i:i + chunk_tokens])
        chunk_text = f"{prefix} [chunk:{i // chunk_tokens}]\n\n{chunk_body}" if prefix else chunk_body
        chunks.append({**doc, "text": chunk_text, "chunk_idx": i // chunk_tokens})
    return chunks


def load_docs(in_dir: Path) -> dict[str, list[dict]]:
    """Load all emitted JSONL, group by type. Skips manifest files."""
    by_type: dict[str, list[dict]] = defaultdict(list)
    for jf in sorted(in_dir.glob("*.jsonl")):
        if jf.name.startswith("cpt-"):
            continue  # manifest / stream files
        with jf.open() as f:
            for line in f:
                if line.strip():
                    d = json.loads(line)
                    if "text" in d:
                        by_type[d["type"]].append(d)
    return by_type


def interleave(by_type: dict[str, list[dict]], seed: int = 42,
               target_tokens: int = 10_000_000) -> list[dict]:
    """Assemble a single stream honoring RATIOS by TOKEN count.

    E and F are chunked into ~CHUNK_TOKENS pieces before mixing.
    We target ~target_tokens total tokens. Ratios apply to tokens.
    """
    random.seed(seed)

    # Chunk E and F (and any oversized A/B)
    chunked_by_type: dict[str, list[dict]] = defaultdict(list)
    for t, docs in by_type.items():
        for d in docs:
            chunked_by_type[t].extend(chunk_doc(d, CHUNK_TOKENS))

    # Compute available tokens per type
    tokens_by_type = {t: sum(approx_tokens(d["text"]) for d in docs)
                      for t, docs in chunked_by_type.items()}

    print("Available tokens by type (after chunking):")
    total_avail = sum(tokens_by_type.values())
    for t in sorted(chunked_by_type):
        print(f"  {t}: {tokens_by_type[t]:>10,} tokens · {len(chunked_by_type[t]):>6,} docs")
    print(f"  TOTAL AVAILABLE: {total_avail:,} tokens")

    stream: list[dict] = []
    for t, r in RATIOS.items():
        docs = chunked_by_type.get(t, [])
        if not docs:
            print(f"[warn] type {t}: no docs")
            continue
        target_t = int(target_tokens * r)
        # Shuffle
        docs_shuf = docs[:]
        random.shuffle(docs_shuf)
        # Pick docs until we hit target token count
        picked = []
        picked_tokens = 0
        idx = 0
        while picked_tokens < target_t:
            d = docs_shuf[idx % len(docs_shuf)]
            picked.append(d)
            picked_tokens += approx_tokens(d["text"])
            idx += 1
        stream.extend(picked)

    # Shuffle so type-blocks interleave
    random.shuffle(stream)
    return stream


def write_stream(stream: list[dict], out_jsonl: Path, out_txt: Path, out_manifest: Path):
    out_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with out_jsonl.open("w") as jf, out_txt.open("w") as tf, out_manifest.open("w") as mf:
        for i, doc in enumerate(stream):
            text = doc["text"].rstrip()
            # JSONL — one doc per line (canonical training input)
            jf.write(json.dumps({"text": text}, ensure_ascii=False) + "\n")
            # Plain text with rare separator (alt training input)
            tf.write(text + DOC_SEP)
            # Manifest — one metadata line per doc
            m = {
                "doc_idx": i,
                "type": doc.get("type"),
                "axis": doc.get("axis"),
                "tier": doc.get("tier"),
                "word": doc.get("word"),
                "provenance": doc.get("provenance"),
            }
            mf.write(json.dumps(m, ensure_ascii=False) + "\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--in-dir", type=Path, default=DEFAULT_IN)
    p.add_argument("--out-jsonl", type=Path, default=DEFAULT_OUT_JSONL)
    p.add_argument("--out-stream", type=Path, default=DEFAULT_OUT_STREAM)
    p.add_argument("--out-manifest", type=Path, default=DEFAULT_OUT_MANIFEST)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--target-tokens", type=int, default=10_000_000,
                   help="Approximate total tokens for the CPT stream")
    args = p.parse_args()

    by_type = load_docs(args.in_dir)
    print("Input counts by type (pre-chunk):")
    for t in sorted(by_type):
        n_docs = len(by_type[t])
        n_toks = sum(approx_tokens(d["text"]) for d in by_type[t])
        print(f"  {t}: {n_docs:>6,} docs · {n_toks:>10,} tokens")
    print()

    stream = interleave(by_type, seed=args.seed, target_tokens=args.target_tokens)
    print(f"\nStream total: {len(stream):,} docs")
    print(f"Ratios (actual in stream, BY TOKEN COUNT):")
    doc_counter: dict[str, int] = defaultdict(int)
    tok_counter: dict[str, int] = defaultdict(int)
    for d in stream:
        doc_counter[d["type"]] += 1
        tok_counter[d["type"]] += approx_tokens(d["text"])
    total_toks = sum(tok_counter.values())
    for t, r_target in sorted(RATIOS.items()):
        n = doc_counter.get(t, 0)
        tt = tok_counter.get(t, 0)
        r_actual = tt / total_toks if total_toks else 0
        print(f"  {t}: target={r_target*100:.0f}%  actual={r_actual*100:.1f}%  docs={n:,}  tokens={tt:,}")

    write_stream(stream, args.out_jsonl, args.out_stream, args.out_manifest)
    print(f"\nWrote: {args.out_jsonl}  (canonical, one doc per line)")
    print(f"Wrote: {args.out_stream}    (alt, docs separated by {DOC_SEP.strip()!r})")
    print(f"Wrote: {args.out_manifest}")

    # Approx token count from JSONL
    total_tokens = 0
    with args.out_jsonl.open() as f:
        for line in f:
            total_tokens += len(json.loads(line)["text"].split())
    print(f"Approx tokens (whitespace-split): {total_tokens:,}")


if __name__ == "__main__":
    main()
