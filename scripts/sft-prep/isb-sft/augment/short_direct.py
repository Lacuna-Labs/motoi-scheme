"""Long-reasoning → short-direct counterpart derivation.

Per synthesis §8 step 4: for each long-reasoning pair, auto-derive a
short-direct variant by stripping scaffold. Target: 20k+ short-direct pairs.

Rule:
  - Long-reasoning: motoi answer > 400 chars or contains fenced code
  - Short-direct: first sentence + code-fence-only (if present) OR
    first sentence only

Preserves Bloom + philosopher tags. Marks :length short-direct so downstream
mixing (long early, short later — faded scaffolding) can select on tag.
"""
from __future__ import annotations

import re


CODE_FENCE_RE = re.compile(r"```[\w-]*\n(.+?)\n```", re.DOTALL)


def _short_direct_answer(motoi: str) -> str | None:
    if len(motoi) < 200:
        return None
    fences = CODE_FENCE_RE.findall(motoi)
    if fences:
        first_sentence = motoi.split(".", 1)[0].strip()
        first_code = fences[0].strip()
        return f"{first_sentence}.\n\n```scheme\n{first_code}\n```"
    parts = re.split(r"(?<=[.!?])\s+", motoi)
    if not parts:
        return None
    if len(parts[0]) < 250:
        return parts[0].strip()
    return None


def derive_short_direct(pairs: list[dict]) -> list[dict]:
    """For every long-reasoning pair, emit a short-direct counterpart."""
    out = list(pairs)
    for p in pairs:
        short = _short_direct_answer(p["motoi"])
        if not short:
            continue
        out.append({
            "user": p["user"],
            "motoi": short,
            "tags": {**p["tags"], "length": "short-direct", "derived_from": "long-scaffold"},
        })
    return out
