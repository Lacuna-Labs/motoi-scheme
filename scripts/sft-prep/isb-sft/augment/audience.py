"""k-PhD audience axis — rewrite pairs at kid / adult / PhD register.

Per synthesis §11: "SFT is EDUCATION — K-12 through college through master's
through PhD". Every central concept gets audience variants so the model
learns to shift sophistication based on who's asking.

Registers:
  - kid       : short sentences, no jargon, concrete analogy, "you" address
  - adult     : programmer-fluent, standard technical prose (default)
  - phd       : precise, terminology-rich, invariant + falsifier framing

The DEFAULT register is adult (the base extraction). We add kid + phd
wrappers for concepts in the top-N-by-centrality set.
"""
from __future__ import annotations

import random
import re
from typing import Iterable


def _kid_wrap_user(user: str) -> str:
    if user.startswith("What does"):
        return user.replace("What does", "What does", 1) + " — say it like I'm 10."
    if user.startswith("Explain"):
        return user + " — plain words, no jargon, like you're talking to a kid."
    if user.startswith("Show me"):
        return user + " — kid version, small words."
    return f"Kid version: {user}"


def _phd_wrap_user(user: str) -> str:
    if user.startswith("What does") or user.startswith("Explain"):
        return user + " — give me the formal statement: invariant, contract, and falsifier."
    if user.startswith("Show me"):
        return user + " — with the type-theoretic framing."
    if "How would" in user or "How do I" in user:
        return user + " — treat me as a PhD; be precise, name the technique."
    return f"For a PhD audience: {user} — precise, invariant-first, name the technique."


def _kid_wrap_motoi(motoi: str) -> str:
    text = motoi
    text = re.sub(r"\binvariant\b", "always-true rule", text)
    text = re.sub(r"\bcontract\b", "promise", text)
    text = re.sub(r"\bpredicate\b", "yes-or-no test", text)
    text = re.sub(r"\bhash-table\b", "labeled box", text)
    text = re.sub(r"\bpolymorphism\b", "same word, many shapes", text)
    text = re.sub(r"\bmemoization\b", "remembering the answer to save time", text)
    text = re.sub(r"\bmonad\b", "wrapper that carries extra info", text)
    text = re.sub(r"\bmutable\b", "changeable", text)
    text = re.sub(r"\bimmutable\b", "frozen", text)
    text = re.sub(r"\brecursion\b", "a function that calls itself", text)
    text = re.sub(r"\btail-call\b", "the last call in a function", text)
    text = re.sub(r"\bidempotent\b", "safe to run twice", text)
    text = re.sub(r"\bhalt\b", "stop", text)
    text = re.sub(r"\bthrow\b", "raise an alarm", text)
    if len(text) > 300:
        head = text.split(".", 1)[0]
        text = f"{head}. That's the short version — a kid can hold that."
    return text


def _phd_wrap_motoi(motoi: str, verb: str = "") -> str:
    prefix = ""
    if verb and "invariant" not in motoi.lower():
        prefix = f"Formally: `{verb}` is total under its declared domain. "
    suffix = ""
    if "invariant" not in motoi.lower() and "falsif" not in motoi.lower():
        suffix = " Falsifier: any call that returns without preserving the stated property."
    return prefix + motoi + suffix


def audience_expand(pair: dict, verb_hint: str = "") -> list[dict]:
    """Return original + 2 variants (kid, phd). Original is 'adult' register."""
    original = dict(pair)
    original["tags"] = {**pair["tags"], "audience": "adult"}

    kid = {
        "user": _kid_wrap_user(pair["user"]),
        "motoi": _kid_wrap_motoi(pair["motoi"]),
        "tags": {**pair["tags"], "audience": "kid"},
    }
    phd = {
        "user": _phd_wrap_user(pair["user"]),
        "motoi": _phd_wrap_motoi(pair["motoi"], verb_hint),
        "tags": {**pair["tags"], "audience": "phd"},
    }
    return [original, kid, phd]


def apply_audience_expansion(pairs: list[dict],
                             top_concepts: Iterable[str],
                             seed: int = 42) -> list[dict]:
    """Expand only pairs whose concept is in top_concepts (Zipfian-central).
    Pass-through for everything else — those stay at adult register.

    Result adds ~2× on top_concepts subset only, not on all pairs.
    """
    top_set = set(top_concepts)
    out = []
    for p in pairs:
        c = p["tags"].get("concept") or p["tags"].get("verb") or ""
        if c in top_set:
            out.extend(audience_expand(p, verb_hint=c if "/" in c else ""))
        else:
            p["tags"]["audience"] = p["tags"].get("audience", "adult")
            out.append(p)
    return out
