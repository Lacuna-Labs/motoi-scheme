"""Zipfian centrality oversampling.

Every canonical pair carries a `concept` tag (verb name for reference, node id
for graph, chapter for book, cart filename for cart). We compute per-concept
centrality from three signals:

    centrality = 0.5 * concept_pair_count + 0.3 * graph_bridge_score + 0.2 * cross_ref_hits

Concept-pair-count is the natural frequency of the concept across canonical
pairs (already Zipfian since some concepts appear in many pairs and most
appear in few). Graph-bridge-score is per-node cross-axis-bridge-score for
graph concepts. Cross-ref-hits counts how many other concepts reference this
one (via related-verbs, cross-refs-graph, verbs-used, etc).

Duplicate-factor by centrality bucket (per research: top 500 concepts 5×,
next 500 3×, next 1000 2×, tail 1×):

    top-N ranks    factor
    -----------    ------
    1..500         5
    501..1000      3
    1001..2000     2
    tail           1

This does NOT paraphrase — it duplicates the canonical pair as-is. The
duplicate copies will then be spaced across the dataset via spacing.py so
the model sees the same fact 5× at different training positions (spaced
repetition, Ebbinghaus/Bjork).
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable


def compute_concept_scores(pairs: list[dict]) -> dict[str, float]:
    """Compute per-concept centrality from pair distribution + graph metadata."""
    pair_count = Counter()
    bridge_score = {}
    cross_refs = Counter()

    for p in pairs:
        c = p["tags"].get("concept") or p["tags"].get("cart") or p["tags"].get("book") or ""
        if not c:
            continue
        pair_count[c] += 1
        bs = p["tags"].get("bridge_score")
        if bs and c not in bridge_score:
            bridge_score[c] = float(bs)

    max_count = max(pair_count.values()) if pair_count else 1
    max_bridge = max(bridge_score.values(), default=1.0) or 1.0

    scores = {}
    for concept in pair_count:
        f = pair_count[concept] / max_count
        b = bridge_score.get(concept, 0.0) / max_bridge
        r = cross_refs.get(concept, 0) / (max(cross_refs.values(), default=1) or 1)
        scores[concept] = 0.5 * f + 0.3 * b + 0.2 * r
    return scores


def duplicate_factor_for_rank(rank: int) -> int:
    if rank < 500:
        return 5
    if rank < 1000:
        return 3
    if rank < 2000:
        return 2
    return 1


def oversample(pairs: list[dict], scores: dict[str, float]) -> list[dict]:
    """Apply duplicate-factor to each pair. Duplicates carry a :dup-index tag
    so downstream spacing can spread them."""
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    rank_of = {c: i for i, (c, _) in enumerate(ranked)}

    out = []
    for p in pairs:
        c = p["tags"].get("concept") or p["tags"].get("cart") or p["tags"].get("book") or ""
        r = rank_of.get(c, len(rank_of))
        factor = duplicate_factor_for_rank(r)
        for i in range(factor):
            q = {
                "user": p["user"],
                "motoi": p["motoi"],
                "tags": {**p["tags"], "dup_index": i, "centrality_rank": r},
            }
            out.append(q)
    return out


def bucket_report(scores: dict[str, float]) -> dict:
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    return {
        "total_concepts": len(ranked),
        "top_500_avg_score": (
            sum(s for _, s in ranked[:500]) / min(500, len(ranked)) if ranked else 0
        ),
        "top_10": [(c, round(s, 3)) for c, s in ranked[:10]],
        "median_score": ranked[len(ranked) // 2][1] if ranked else 0,
        "concepts_in_top_500": len(ranked[:500]),
        "concepts_in_501_1000": len(ranked[500:1000]),
        "concepts_in_1001_2000": len(ranked[1000:2000]),
        "concepts_in_tail": max(0, len(ranked) - 2000),
    }
