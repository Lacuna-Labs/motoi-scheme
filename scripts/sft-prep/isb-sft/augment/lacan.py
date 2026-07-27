"""Lacan Paraphrase Kit — metaphor + metonymy deterministic paraphrase.

Lacan's two axes ARE the two axes of deterministic paraphrase:
  - metaphor  (paradigmatic / vertical)   — synonym substitution (WordNet-lite)
  - metonymy  (syntagmatic / horizontal)  — clause rearrangement, voice-shift

For each input pair, produce N=2 additional pair variants (total 3x multiplier)
per synthesis §8 step 3 — 3x prose, 2x code, 1x refusal.

Deterministic — zero LLM cost.
"""
from __future__ import annotations

import random
import re
from typing import Iterator


METAPHOR_SUBS = {
    r"\bshow me\b": ["walk me through", "give me", "tell me"],
    r"\bhow does\b": ["in what way does", "how would"],
    r"\bwhat does\b": ["what's what", "what would"],
    r"\bWhat does\b": ["What's it that", "What would"],
    r"\bexplain\b": ["describe", "walk through", "unpack"],
    r"\bactually does\b": ["actually is doing", "really does"],
    r"\bhow do I\b": ["how would I", "what's the way to"],
    r"\bwhen should I\b": ["when would I", "under what conditions do I"],
    r"\bwhich verb\b": ["which Motoi verb", "which primitive"],
    r"\bin Motoi\b": ["in Motoi Scheme", "in the Motoi runtime", "in the Motoi world"],
    r"\bcart\b": ["Sakura cart", "runnable cart"],
    r"\bappears\b": ["shows up", "occurs"],
    r"\brefer to\b": ["point to", "reach for"],
    r"\bcompose\b": ["put together", "assemble"],
    r"\bnaive\b": ["first-pass", "beginner"],
    r"\bfat\b": ["densely-authored", "richly-annotated"],
    r"\bthin\b": ["sparsely-authored"],
    r"\bBase:\b": ["Foundation:", "Primitive:"],
    r"\bshould reach for\b": ["should pick", "should call"],
    r"\bcaveat\b": ["gotcha", "warning"],
    r"\bdrawback\b": ["downside", "trade-off"],
    r"\bconstraint\b": ["restriction", "limit"],
}

METONYMY_PATTERNS = [
    (re.compile(r"^(What does `\w[\w/\-!?]*`) actually do — I've seen the signature but I want to understand\."),
     r"I've seen the signature of the verb — walk me through what it actually does."),
    (re.compile(r"^Show me (.+)$"),
     r"Let me see \1"),
    (re.compile(r"^Explain (.+)$"),
     r"Walk me through \1"),
    (re.compile(r"^What does `(\w[\w/\-!?]*)` (.+)$"),
     r"For `\1` — \2"),
    (re.compile(r"^In (.+): explain (.+)$"),
     r"Explain \2 — the version that lives in \1"),
    (re.compile(r"^Where (?:in )?Motoi'?s? corpus does `(.+)` appear\?$"),
     r"Which corpus files carry `\1`?"),
    (re.compile(r"^Complete this Motoi Scheme using `(.+)`:"),
     r"Finish this Motoi Scheme — the missing piece uses `\1`:"),
]


def _metaphor_shift(text: str, rng: random.Random) -> str:
    out = text
    subs_applied = 0
    for pat, alts in METAPHOR_SUBS.items():
        if re.search(pat, out):
            out = re.sub(pat, rng.choice(alts), out, count=1)
            subs_applied += 1
            if subs_applied >= 2:
                break
    return out


def _metonymy_shift(text: str) -> str:
    for pat, repl in METONYMY_PATTERNS:
        m = pat.match(text)
        if m:
            return pat.sub(repl, text, count=1)
    lines = text.split("\n", 1)
    if len(lines) > 1 and len(lines[0]) < 200:
        return f"Here's the question — {lines[0]}\n\n{lines[1]}"
    return text


def paraphrase_pair(pair: dict, rng: random.Random) -> list[dict]:
    """Return the original + 2 paraphrase variants (metaphor + metonymy)."""
    original_tags = pair["tags"]
    user = pair["user"]
    motoi = pair["motoi"]

    variants = [pair]

    meta_user = _metaphor_shift(user, rng)
    if meta_user != user:
        variants.append({
            "user": meta_user,
            "motoi": motoi,
            "tags": {**original_tags, "lacan_axis": "metaphor"},
        })

    meto_user = _metonymy_shift(user)
    if meto_user != user and meto_user != meta_user:
        variants.append({
            "user": meto_user,
            "motoi": motoi,
            "tags": {**original_tags, "lacan_axis": "metonymy"},
        })

    return variants


def apply_lacan_paraphrase(pairs: list[dict], seed: int = 42,
                           multiplier_cap: int = 3) -> list[dict]:
    rng = random.Random(seed)
    out = []
    for p in pairs:
        variants = paraphrase_pair(p, rng)
        out.extend(variants[:multiplier_cap])
    return out
