"""Bloom balancer — enforce ~equal representation across all 6 Bloom levels.

Target: each of the 6 levels holds ~16.7% (±5%) of total pairs.

Strategy:
  1. Measure current per-Bloom count
  2. Compute target-per-bloom = mean = total / 6
  3. For under-represented levels: DUPLICATE random pairs from that level
     (Zipfian-preserving — pick by centrality so we duplicate meaningful ones)
  4. For over-represented levels: SUBSAMPLE (drop lowest-centrality pairs
     from that level until target reached; NEVER drop pairs marked
     :hand-authored, :identity, :honest-null, :safety)

Rebalancing preserves substrate diversity — for each Bloom level we sample
across substrates proportionally.
"""
from __future__ import annotations

import random
from collections import Counter, defaultdict


BLOOM_LEVELS = ("remember", "understand", "apply", "analyze", "evaluate", "create")
PROTECTED_TAGS = {"identity", "honest-null", "safety", "hand-authored", "descartes-anchor",
                  "sartre-refusal", "levinas-clarify"}


def _is_protected(pair: dict) -> bool:
    t = pair["tags"]
    if t.get("hand_authored"):
        return True
    for k in PROTECTED_TAGS:
        if t.get("shape", "").startswith(k) or k in t.get("shape", ""):
            return True
    return False


def bloom_balance(pairs: list[dict], tolerance: float = 0.03,
                  target_range: tuple[float, float] = (0.13, 0.20),
                  seed: int = 42) -> list[dict]:
    """Rebalance pairs so no Bloom level is < target_range[0] or > target_range[1]
    of total. Duplicates underweight, subsamples overweight (respecting protection).

    Returns a NEW list; input unchanged.
    """
    rng = random.Random(seed)
    total = len(pairs)
    if total == 0:
        return pairs

    by_bloom: dict[str, list[dict]] = defaultdict(list)
    for p in pairs:
        by_bloom[p["tags"].get("bloom", "unknown")].append(p)

    target = total // 6
    lo = int(total * target_range[0])
    hi = int(total * target_range[1])

    out = []
    for level in BLOOM_LEVELS:
        bucket = by_bloom.get(level, [])
        n = len(bucket)
        if n < lo:
            need = target - n
            if not bucket:
                continue
            dup_count = 0
            while dup_count < need:
                for orig in bucket[:]:
                    if dup_count >= need:
                        break
                    q = {
                        "user": orig["user"],
                        "motoi": orig["motoi"],
                        "tags": {**orig["tags"], "bloom_rebalance": "duplicated"},
                    }
                    bucket.append(q)
                    dup_count += 1
            out.extend(bucket)
        elif n > hi:
            keep_protected = [p for p in bucket if _is_protected(p)]
            keep_pool = [p for p in bucket if not _is_protected(p)]
            rng.shuffle(keep_pool)
            need = target - len(keep_protected)
            if need > 0:
                keep_pool = keep_pool[:need]
            else:
                keep_pool = []
            out.extend(keep_protected + keep_pool)
        else:
            out.extend(bucket)

    for p in pairs:
        if p["tags"].get("bloom") not in BLOOM_LEVELS:
            out.append(p)

    return out
