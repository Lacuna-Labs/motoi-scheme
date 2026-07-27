"""Fisher-Yates shuffle with concept-run constraint (interleaving, Rohrer 2007).

Naive shuffle risks 3+ pairs from same concept landing consecutively —
research shows interleaving beats blocking by 25-40% on retention. We
constrain: no 3 consecutive pairs with the same concept-tag.

Algorithm:
    1. Seed-shuffle the whole list (Python random.Random, seed=42 for reproducibility)
    2. Sweep left-to-right; if pair[i-1] and pair[i-2] share concept AND
       pair[i] also has that concept, swap pair[i] with the next non-matching
       pair further right.
    3. Second pass: also spread dup_index-tagged duplicates apart by ~stride
       (dataset_size / dup_factor).
"""
from __future__ import annotations

import random


def concept_of(pair: dict) -> str:
    t = pair["tags"]
    return t.get("concept") or t.get("cart") or t.get("book") or ""


def interleave(pairs: list[dict], seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    out = list(pairs)
    rng.shuffle(out)

    n = len(out)
    for i in range(2, n):
        c = concept_of(out[i])
        if c and concept_of(out[i - 1]) == c and concept_of(out[i - 2]) == c:
            for j in range(i + 1, n):
                if concept_of(out[j]) != c:
                    out[i], out[j] = out[j], out[i]
                    break
    return out


def spread_duplicates(pairs: list[dict]) -> list[dict]:
    """Second pass: for pairs marked with dup_index > 0, ensure they are
    spread across the dataset at approximately stride = n / dup_factor.

    Simple heuristic: bucket by (concept, base-user-hash) and if two
    duplicates land within stride/2 of each other, swap the later one further
    right. Cheap; not a global optimum, but breaks the pathological
    consecutive-duplicate case that undermines spaced repetition.
    """
    n = len(pairs)
    if n < 100:
        return pairs
    seen = {}
    out = list(pairs)
    swap_count = 0
    for i, p in enumerate(out):
        c = concept_of(p)
        idx = p["tags"].get("dup_index", 0)
        key = (c, idx)
        if not c:
            continue
        prior_pos = seen.get((c, 0))
        if prior_pos is not None and idx > 0 and (i - prior_pos) < (n // 20):
            target = i + (n // 20)
            if target < n:
                out[i], out[target] = out[target], out[i]
                swap_count += 1
        seen[(c, idx)] = i
    return out
