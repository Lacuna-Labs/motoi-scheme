#!/usr/bin/env python3
"""
LIMR-score candidates + LASER/MIG per-bucket balance.

Approach:
- For each candidate, compute a "novelty" score = 1 - max_similarity(candidate_answer,
  sampled_training_answers). Higher novelty = higher learning impact (LIMR intuition).
- Similarity = Jaccard over token 3-grams (character n-grams are cheap + code-friendly).
- Toss bottom 40% by score; keep top 60% ≈ 300 pairs.
- Balance per bucket to keep proportional shape (LASER + MIG shape).
"""

import json
import random
import re
from collections import defaultdict, Counter
from pathlib import Path

random.seed(31)

CAND_PATH = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/candidates.jsonl")
TRAIN_PATH = Path("/Users/alfred/.forge/corpus/motoi/train.jsonl")
OUT_TRAIN = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/train.jsonl")
OUT_MANIFEST = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/scoring-manifest.json")

def ngrams(s, n=5):
    s = re.sub(r'\s+', ' ', s.lower())
    return set(s[i:i+n] for i in range(len(s) - n + 1))

def jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0

# Load candidates
candidates = []
with CAND_PATH.open() as f:
    for line in f:
        candidates.append(json.loads(line))
print(f"Loaded {len(candidates)} candidates")

# Sample training set for similarity comparison — reservoir sample per bucket-adjacent kind
# Since candidate _bucket is A-P but training rows don't carry _bucket, group training
# by _kind (or fall back to _source_file). We'll build a general "training answers" pool
# with 5000 reservoir samples for baseline similarity.
train_answers = []
sample_size = 5000
count = 0
with TRAIN_PATH.open() as f:
    for i, line in enumerate(f):
        row = json.loads(line)
        msgs = row.get("messages", [])
        if len(msgs) < 2:
            continue
        ans = msgs[-1].get("content", "")
        if len(train_answers) < sample_size:
            train_answers.append(ans)
        else:
            # reservoir sample
            j = random.randint(0, i)
            if j < sample_size:
                train_answers[j] = ans
        count += 1
print(f"Sampled {len(train_answers)} training answers from {count} rows")

# Precompute training ngrams
train_ngrams = [ngrams(t) for t in train_answers]
# Filter out ones that are too short to be meaningful
train_ngrams = [t for t in train_ngrams if len(t) >= 10]

# Score each candidate
print("Scoring candidates...")
scored = []
for i, cand in enumerate(candidates):
    ans = cand["messages"][-1]["content"]
    ans_ngrams = ngrams(ans)
    if len(ans_ngrams) < 5:
        max_sim = 1.0  # very short answer, likely rote
    else:
        # Compute max jaccard against training. For speed, subsample training.
        subsample = random.sample(train_ngrams, min(400, len(train_ngrams)))
        max_sim = max((jaccard(ans_ngrams, t) for t in subsample), default=0.0)
    novelty = 1.0 - max_sim
    scored.append((novelty, cand))
    if (i + 1) % 100 == 0:
        print(f"  scored {i+1}/{len(candidates)}")

# Sort by novelty descending
scored.sort(key=lambda x: -x[0])

# Score distribution
scores = [s[0] for s in scored]
print(f"\nScore stats:")
print(f"  min:    {min(scores):.4f}")
print(f"  max:    {max(scores):.4f}")
print(f"  mean:   {sum(scores)/len(scores):.4f}")
print(f"  median: {sorted(scores)[len(scores)//2]:.4f}")

# Per-bucket score distribution
by_bucket = defaultdict(list)
for score, cand in scored:
    by_bucket[cand["_meta"]["_bucket"]].append((score, cand))

print("\nPer-bucket median score (before selection):")
for b in sorted(by_bucket.keys()):
    lst = by_bucket[b]
    med = sorted(l[0] for l in lst)[len(lst)//2]
    print(f"  {b}: median={med:.3f}  n={len(lst)}")

# LASER + MIG shape: keep proportional per bucket, but toss the LOWEST 40% within EACH bucket
# This preserves the corpus-proportional shape while dropping "learned already" pairs.
selected = []
per_bucket_kept = {}
for b, lst in by_bucket.items():
    # Sort by novelty descending, keep top 60%
    lst.sort(key=lambda x: -x[0])
    keep_n = max(1, int(len(lst) * 0.60))  # keep at least 1
    kept = [c for _, c in lst[:keep_n]]
    selected.extend(kept)
    per_bucket_kept[b] = len(kept)

print(f"\nSelected {len(selected)} pairs (kept top 60% per bucket)")
print("Per-bucket after selection:", per_bucket_kept)

# Shuffle for training
random.shuffle(selected)

with OUT_TRAIN.open("w") as f:
    for row in selected:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

# Manifest
manifest = {
    "phase": "phase-2-limr-score-and-select",
    "total_candidates": len(candidates),
    "total_selected": len(selected),
    "per_bucket_kept": per_bucket_kept,
    "score_stats": {
        "min": min(scores),
        "max": max(scores),
        "mean": sum(scores)/len(scores),
        "median": sorted(scores)[len(scores)//2],
    },
    "method": "jaccard novelty over 5-char ngrams vs 5000 sampled SFT answers; keep top 60% per bucket",
}
OUT_MANIFEST.write_text(json.dumps(manifest, indent=2))
print(f"\nWrote train.jsonl and scoring-manifest.json")
