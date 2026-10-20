#!/usr/bin/env python3
"""
Corrective rebalance: bucket M (safety-adjacent binary refusals) and N (crisis templates)
are intentionally template-matches. LIMR novelty penalizes them, but they're ship-critical.
Preserve M+N at 100%. Keep other buckets at 60% cutoff.

Also boost P (doctrine cross-osmosis) since novelty is high and count is small.
"""

import json
import random
import re
from collections import defaultdict, Counter
from pathlib import Path

random.seed(31)

CAND_PATH = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/candidates.jsonl")
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

# Load prior scoring
prior_manifest = json.loads(Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/scoring-manifest.json").read_text())

# Re-score (deterministic due to seed)
TRAIN_PATH = Path("/Users/alfred/.forge/corpus/motoi/train.jsonl")
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
            j = random.randint(0, i)
            if j < sample_size:
                train_answers[j] = ans
        count += 1

train_ngrams = [ngrams(t) for t in train_answers]
train_ngrams = [t for t in train_ngrams if len(t) >= 10]

scored = []
for cand in candidates:
    ans = cand["messages"][-1]["content"]
    ans_ngrams = ngrams(ans)
    if len(ans_ngrams) < 5:
        max_sim = 1.0
    else:
        subsample = random.sample(train_ngrams, min(400, len(train_ngrams)))
        max_sim = max((jaccard(ans_ngrams, t) for t in subsample), default=0.0)
    novelty = 1.0 - max_sim
    scored.append((novelty, cand))

# Group by bucket
by_bucket = defaultdict(list)
for score, cand in scored:
    by_bucket[cand["_meta"]["_bucket"]].append((score, cand))

# Selection policy:
#   M, N: 100% keep — safety templates. Consistency is the property.
#   P: 100% keep — doctrine, high novelty, count is small.
#   O: 100% keep — 1 pair.
#   I, J: 100% keep — persona voice pins, count small.
#   Other buckets: keep top 65% (slightly more generous than 60% to reach ~350).

full_keep = {"M", "N", "O", "P", "I", "J"}

selected = []
per_bucket_kept = {}
for b, lst in by_bucket.items():
    lst.sort(key=lambda x: -x[0])
    if b in full_keep:
        keep_n = len(lst)
    else:
        keep_n = max(1, int(round(len(lst) * 0.65)))
    kept = [c for _, c in lst[:keep_n]]
    selected.extend(kept)
    per_bucket_kept[b] = len(kept)

print(f"Selected {len(selected)} pairs")
print("Per-bucket:", dict(sorted(per_bucket_kept.items())))

# Shuffle for training
random.shuffle(selected)

with OUT_TRAIN.open("w") as f:
    for row in selected:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

manifest = {
    "phase": "phase-2-limr-score-and-select-rebalanced",
    "total_candidates": len(candidates),
    "total_selected": len(selected),
    "per_bucket_kept": per_bucket_kept,
    "score_stats": prior_manifest["score_stats"],
    "method": "jaccard novelty over 5-char ngrams vs 5000 sampled SFT answers; keep top 65% per bucket EXCEPT full-keep buckets M/N/O/P/I/J (safety templates + doctrine + persona pins)",
    "full_keep_buckets": sorted(full_keep),
}
OUT_MANIFEST.write_text(json.dumps(manifest, indent=2))
print("Manifest written.")
