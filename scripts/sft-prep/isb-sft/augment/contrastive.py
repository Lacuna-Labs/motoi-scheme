"""Contrastive discrimination pairs — Critique-FT variants.

Per synthesis §5: ~15% of dataset. For each central concept, produce 1-2
pairs where the answer contains a plausible-but-wrong answer PLUS the
correction rationale. Discrimination training (Critique-FT arXiv:2501.17703).

Applies to central Zipfian concepts only (top N). Emits ANALYZE + EVALUATE
Bloom shapes (which are the natural home for critique/discrimination).
"""
from __future__ import annotations

from typing import Iterable


def _wrong_and_correct(user: str, motoi: str, concept: str) -> tuple[str, str] | None:
    if not concept:
        return None
    wrong_user = f"Someone tells me: for `{concept}`, the answer is 'it just returns the first argument, always.' Is that right?"
    correction = (
        f"No — that's a plausible-sounding but wrong description of `{concept}`. "
        f"The actual behavior: {motoi[:400]}"
        + ("..." if len(motoi) > 400 else "")
        + "\n\nHow to tell wrong from right: the wrong version drops context "
          "that the actual verb keeps; check the signature and the "
          "authored :usecases before you trust a summary."
    )
    return (wrong_user, correction)


def generate_contrastive(pairs: list[dict],
                         central_concepts: Iterable[str],
                         limit_per_concept: int = 1) -> list[dict]:
    central_set = set(central_concepts)
    seen = {}
    out = []
    for p in pairs:
        c = p["tags"].get("concept") or ""
        if c not in central_set:
            continue
        if seen.get(c, 0) >= limit_per_concept:
            continue
        if p["tags"].get("bloom") not in ("understand", "apply"):
            continue
        result = _wrong_and_correct(p["user"], p["motoi"], c)
        if not result:
            continue
        wu, corr = result
        out.append({
            "user": wu,
            "motoi": corr,
            "tags": {
                **p["tags"],
                "bloom": "evaluate",
                "philosopher": "aristotle-nous",
                "shape": "contrastive-discrimination",
                "training_style": "critique-ft",
            },
        })
        seen[c] = seen.get(c, 0) + 1
    return out
