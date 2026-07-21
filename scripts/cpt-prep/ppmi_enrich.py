"""PPMI + distributional-neighbor enrichment for Tier 1 graph nodes.

Runs over the whole Motoi corpus (scheme-books + word-books + reference)
and computes, per Tier 1 word:
  - associations: top-20 co-occurring words by PPMI
  - distributional_neighbors: top-10 words with cosine-similar context vectors
  - context_entropy: Shannon entropy of the ±5-word neighbor distribution
  - idf: inverse document frequency
  - cross_axis_bridge_score: how many top-20 associations fall in OTHER axes

Output: JSON dict {word: {axis, associations, distributional_neighbors, entropy, idf, bridge_score}}.

Deterministic. Scriptable. Runs in ~2-5 min on the current corpus.
"""
from __future__ import annotations
import json
import math
import re
import sys
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path("/Users/alfred/code/motoi-scheme")
SEED_DIR = Path("/tmp/motoi-audit/axis-seeds-v2")
OUT_PATH = REPO / "training-data" / "cpt-mk2" / "tier1-enrichment.json"

STOP = set("the and but that this with from have has was were are will would can could should they them their been will one two all any out more some into than then our its get got use using used make makes made need needs does doing over under just only also very much most many way well still back down know knows known see saw seen take takes took taken come came going went gone want wants wanted keep keeps kept work works worked put puts may might must shall does did done been being having doing".split())

WINDOW = 5


def load_tier1() -> dict[str, str]:
    """Return {word: axis} for words in per-axis Pareto top-300 (Tier 1)."""
    tier1: dict[str, str] = {}
    for axis in ["sensation", "intuition", "thinking", "feeling"]:
        tsv = SEED_DIR / f"{axis}.tsv"
        if not tsv.exists():
            continue
        words = []
        with tsv.open() as f:
            for line in f:
                p = line.strip().split("\t")
                if len(p) >= 2:
                    try:
                        words.append((int(p[0]), p[1]))
                    except ValueError:
                        pass
        words.sort(key=lambda x: -x[0])
        for _, w in words[:300]:
            tier1[w] = axis
    return tier1


def iter_corpus_files():
    for root in [REPO / "scheme-books", REPO / "word-books", REPO / "Scheme" / "reference"]:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix in (".slatl", ".slat"):
                yield path


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z]+", text.lower()) if len(t) >= 3 and t not in STOP]


def main():
    print("Loading Tier 1 word set...")
    tier1 = load_tier1()
    print(f"  {len(tier1):,} Tier 1 words across 4 axes")

    print("Scanning corpus...")
    files = list(iter_corpus_files())
    print(f"  {len(files):,} files")

    # Global word counts + document counts
    global_count: Counter[str] = Counter()
    doc_count: dict[str, int] = defaultdict(int)
    # Per-Tier-1-word context: neighbor -> count
    ctx: dict[str, Counter[str]] = {w: Counter() for w in tier1}
    # For distributional-neighbors: context vector per Tier-1 word
    # (already ctx above serves as context vector)

    N_files = 0
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        tokens = tokenize(text)
        if not tokens:
            continue
        N_files += 1
        seen_in_file: set[str] = set()
        for i, t in enumerate(tokens):
            global_count[t] += 1
            if t not in seen_in_file:
                doc_count[t] += 1
                seen_in_file.add(t)
            if t in ctx:
                # Collect ±WINDOW neighbors
                lo = max(0, i - WINDOW)
                hi = min(len(tokens), i + WINDOW + 1)
                for j in range(lo, hi):
                    if j == i:
                        continue
                    neighbor = tokens[j]
                    if neighbor in STOP or len(neighbor) < 3:
                        continue
                    ctx[t][neighbor] += 1
    print(f"  scanned {N_files} files")
    print(f"  global vocab: {len(global_count):,}")

    total_tokens = sum(global_count.values())
    total_pairs_by_word: dict[str, int] = {w: sum(ctx[w].values()) for w in ctx}

    def ppmi(w: str, n: str) -> float:
        """PPMI(w, n) = max(0, log2( p(w,n) / (p(w)*p(n)) )).

        Using pair counts as proxy for joint prob (denominator scales same).
        """
        joint = ctx[w].get(n, 0)
        if joint < 2:
            return 0.0
        # Marginals
        p_w = total_pairs_by_word[w] / (total_pairs_by_word[w] + 1)
        p_n_global = global_count.get(n, 0) / total_tokens
        if p_w == 0 or p_n_global == 0:
            return 0.0
        p_wn = joint / total_pairs_by_word[w]
        # Use pointwise: log2( p_wn / p_n_global )
        r = p_wn / p_n_global
        if r <= 0:
            return 0.0
        return max(0.0, math.log2(r))

    def shannon_entropy(counts: Counter[str]) -> float:
        total = sum(counts.values())
        if total == 0:
            return 0.0
        h = 0.0
        for c in counts.values():
            p = c / total
            if p > 0:
                h -= p * math.log2(p)
        return h

    print("Computing PPMI + associations for Tier 1 words...")
    enrichment: dict[str, dict] = {}
    for word, axis in tier1.items():
        if word not in ctx or not ctx[word]:
            continue
        # PPMI top-20
        scored = [(n, ppmi(word, n)) for n in ctx[word] if n != word]
        scored.sort(key=lambda x: -x[1])
        associations = [(n, round(s, 2)) for n, s in scored[:20] if s > 0]
        # Entropy
        ent = shannon_entropy(ctx[word])
        # IDF
        df = doc_count.get(word, 1)
        idf = round(math.log(N_files / df), 3) if df > 0 else 0.0
        # Cross-axis bridge score: how many top-20 associations belong to OTHER axes
        bridge = 0
        for n, _ in associations:
            n_axis = tier1.get(n)
            if n_axis and n_axis != axis:
                bridge += 1
        enrichment[word] = {
            "axis": axis,
            "associations": [n for n, _ in associations],
            "association_scores": {n: s for n, s in associations},
            "context_entropy": round(ent, 3),
            "idf": idf,
            "cross_axis_bridge_score": bridge,
            "freq": global_count.get(word, 0),
            "doc_freq": df,
        }

    print("Computing distributional neighbors (context-vector cosine similarity)...")
    # For each Tier 1 word, find top-10 other Tier 1 words with similar context distribution
    # Build normalized context vectors
    vec_norm: dict[str, dict[str, float]] = {}
    for w in ctx:
        total = sum(ctx[w].values())
        if total == 0:
            vec_norm[w] = {}
            continue
        vec_norm[w] = {n: c / total for n, c in ctx[w].items()}

    def cosine(a: dict[str, float], b: dict[str, float]) -> float:
        if not a or not b:
            return 0.0
        # Use intersection of keys for speed
        common = set(a) & set(b)
        if not common:
            return 0.0
        dot = sum(a[k] * b[k] for k in common)
        norm_a = math.sqrt(sum(v * v for v in a.values()))
        norm_b = math.sqrt(sum(v * v for v in b.values()))
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    words_list = list(ctx.keys())
    for i, w in enumerate(words_list):
        if w not in enrichment:
            continue
        sims = []
        for w2 in words_list:
            if w2 == w:
                continue
            s = cosine(vec_norm[w], vec_norm[w2])
            if s > 0:
                sims.append((w2, s))
        sims.sort(key=lambda x: -x[1])
        enrichment[w]["distributional_neighbors"] = [n for n, _ in sims[:10]]
        if (i + 1) % 100 == 0:
            print(f"  distributional-neighbor pass: {i+1}/{len(words_list)}")

    print(f"Writing enrichment for {len(enrichment):,} Tier 1 words to {OUT_PATH}")
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(enrichment, ensure_ascii=False, indent=2))
    print("Done.")


if __name__ == "__main__":
    main()
