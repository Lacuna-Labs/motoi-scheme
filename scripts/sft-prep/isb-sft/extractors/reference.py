"""Reference verb extractor — reads all fields, emits Bloom's 6 pair shapes per verb.

Per verb budget (fat verb with all fields): ~29 pairs canonical.
Per verb budget (thin verb, R7RS-anchored, terse): ~10-15 pairs.

Coverage per Lacuna Eng field-anatomy report:
    - Signature + summary + explanation
    - 3 tiered :examples (novice/intermediate/expert)
    - :caveats (list of strings, avg 3)
    - :drawbacks (list of strings, avg 3)
    - :usecases (list of strings, avg 3)
    - :related + :cross-refs-books + :cross-refs-graph
    - :learn (:concept + :prerequisites + :progression)
    - Row 2 :audit — Peirce abduction pre-authored per verb
    - Row 3 :dimension — Jung aspect-seeing / cross-substrate transfer
    - Row 4 :proof — Popper falsifiability + invariant
    - Row 5 :emergence — Wittgenstein-early composition + emergent
    - Per-row :eng :math :cs discipline lens

Each pair is abductive-shaped (observation → reasoning → answer) per
`[[sft-must-be-abductive-2026-07-21]]`. Each carries philosopher-shape tag.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator

import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sexpr_reader import (
    iter_top_level_forms,
    read_field,
    read_field_list_strings,
    read_field_form,
    iter_records_in_list,
)

REF_DIR = Path.home() / "code/motoi-scheme/Scheme/reference"


def extract_verb(raw: str, source: str) -> dict | None:
    """Parse a verb form into a structured dict. Returns None if no :name."""
    name = read_field(raw, "name") or read_field(raw, "atom")
    if not name:
        return None
    v = {
        "name": name,
        "source": source,
        "signature":   read_field(raw, "signature"),
        "summary":     read_field(raw, "summary"),
        "explanation": read_field(raw, "explanation"),
        "arity":       read_field(raw, "arity"),
        "kind":        read_field(raw, "kind"),
        "tier":        read_field(raw, "tier"),
        "training_eligible": read_field(raw, "training-eligible"),
        "content_rating":    read_field(raw, "content-rating"),
        # list-of-strings fields
        "caveats":    read_field_list_strings(raw, "caveats"),
        "drawbacks":  read_field_list_strings(raw, "drawbacks"),
        "usecases":   read_field_list_strings(raw, "usecases"),
        "related":    read_field_list_strings(raw, "related"),
    }
    # Examples: nested list of records — each has :dialect :tier :code :note
    examples_raw = read_field_form(raw, "examples")
    examples = []
    if examples_raw:
        for rec in iter_records_in_list(examples_raw):
            examples.append({
                "dialect": read_field(rec, "dialect"),
                "tier":    read_field(rec, "tier"),
                "code":    read_field(rec, "code"),
                "note":    read_field(rec, "note"),
            })
    v["examples"] = examples
    # Rows — each is a single nested form
    for row_name in ("row-2-audit", "row-3-dimension", "row-4-proof", "row-5-emergence"):
        row_raw = read_field_form(raw, row_name)
        if row_raw:
            # row content is (:field value :field value ...) - single record
            # Extract common fields — different rows have different specific fields
            v[row_name.replace("-", "_")] = {
                "raw": row_raw,
                "problem":    read_field(row_raw, "problem"),
                "program":    read_field(row_raw, "program"),
                "explanation":read_field(row_raw, "explanation"),
                "meta":       read_field(row_raw, "meta"),
                "setup":      read_field(row_raw, "setup"),
                "claim":      read_field(row_raw, "claim"),
                "invariant":  read_field(row_raw, "invariant"),
                "base":       read_field(row_raw, "base"),
                "composition":read_field(row_raw, "composition"),
                "emergent":   read_field(row_raw, "emergent"),
                "eng":        read_field(row_raw, "eng"),
                "math":       read_field(row_raw, "math"),
                "cs":         read_field(row_raw, "cs"),
            }
    # Learn scaffold
    learn_raw = read_field_form(raw, "learn")
    if learn_raw:
        v["learn"] = {
            "concept":       read_field(learn_raw, "concept"),
            "prerequisites": read_field_list_strings(learn_raw, "prerequisites"),
            "progression":   read_field(learn_raw, "progression"),
        }
    return v


def iter_all_verbs() -> Iterator[dict]:
    """Yield structured verb records from every reference/*.slat file."""
    for path in sorted(REF_DIR.glob("*.slat")):
        for raw in iter_top_level_forms(path, prefix="(verb"):
            v = extract_verb(raw, source=path.name)
            if v:
                yield v


# ═══════════════════════════════════════════════════════════════════════════
# PAIR EMITTERS — one per Bloom shape × source combination
# ═══════════════════════════════════════════════════════════════════════════

def _tag(v: dict, bloom: str, shape: str, philosopher: str,
         speech_act: str, length: str, skill: str) -> dict:
    """Build the tag dict for every pair emitted from a reference verb."""
    return {
        "slice": "reference",
        "bloom": bloom,
        "shape": shape,
        "philosopher": philosopher,
        "speech-act": speech_act,
        "length": length,
        "skill": skill,
        "verb": v["name"],
        "source": v["source"],
        "tier": v.get("tier") or "core",
    }


def _pair(user: str, motoi: str, tags: dict) -> dict:
    return {"user": user, "motoi": motoi, "tags": tags}


def emit_pairs_for_verb(v: dict) -> Iterator[dict]:
    """Emit all pair shapes for one verb. Skip if :training-eligible is #f."""
    if v.get("training_eligible") == "#f":
        return

    name = v["name"]
    contract = v.get("signature") or v.get("summary") or ""
    summary = v.get("summary") or ""
    explanation = v.get("explanation") or ""

    # ── REMEMBER (2 pairs — Lacan reversal, defeats Reversal Curse) ─────
    if summary or contract:
        yield _pair(
            user=f"What's the summary of `{name}`?",
            motoi=f"{summary or contract}",
            tags=_tag(v, "remember", "def-forward", "lacan-reversal",
                     "assertive", "short-direct", "ref-retrieve"),
        )
        yield _pair(
            user=f"Which Motoi verb has this summary: \"{summary or contract[:120]}\"?",
            motoi=f"`{name}`",
            tags=_tag(v, "remember", "def-reverse", "lacan-reversal",
                     "assertive", "short-direct", "ref-retrieve"),
        )
    if contract and contract != summary:
        yield _pair(
            user=f"What's the signature of `{name}`?",
            motoi=f"`{contract}`",
            tags=_tag(v, "remember", "signature", "lacan-reversal",
                     "assertive", "short-direct", "ref-retrieve"),
        )

    # ── UNDERSTAND (3 pairs — explanation prose, tiered examples with :note) ──
    if explanation:
        yield _pair(
            user=f"Explain what `{name}` actually does — I've seen the signature but I want to understand.",
            motoi=explanation,
            tags=_tag(v, "understand", "prose-explanation", "wittgenstein-late-aspect",
                     "expressive", "long-reasoning", "ref-retrieve"),
        )
    for ex in v.get("examples", []):
        tier = ex.get("tier") or "unknown"
        note = ex.get("note")
        code = ex.get("code")
        if code and note:
            yield _pair(
                user=f"Show me a {tier} example of `{name}` and explain what it demonstrates.",
                motoi=f"```scheme\n{code}\n```\n\n{note}",
                tags=_tag(v, "understand", f"example-{tier}", "wittgenstein-late-aspect",
                         "directive", "long-reasoning", "ref-retrieve"),
            )

    # ── APPLY (usecases + intermediate example completion) ────────────────
    for uc in v.get("usecases", []):
        yield _pair(
            user=f"I need to: {uc.lower().rstrip('.')}. Which verb fits and how do I use it?",
            motoi=f"That's exactly what `{name}` is for. {uc.rstrip('.')} — reach for it here. "
                  f"Signature: `{contract}`.",
            tags=_tag(v, "apply", "usecase-scenario", "wittgenstein-early",
                     "directive", "long-reasoning", "code-write"),
        )
    # Intermediate example → code completion pair
    intermediate = next((ex for ex in v.get("examples", []) if ex.get("tier") == "intermediate"), None)
    if intermediate and intermediate.get("code"):
        code = intermediate["code"]
        split_at = int(len(code) * 0.55)
        for i in range(split_at, min(split_at + 40, len(code))):
            if code[i] in " \n":
                split_at = i
                break
        prefix = code[:split_at]
        rest = code[split_at:]
        yield _pair(
            user=f"Complete this Motoi Scheme using `{name}`:\n\n```scheme\n{prefix}\n```",
            motoi=f"Continues as:\n\n```scheme\n{rest.rstrip()}\n```\n\n"
                  f"That's the intermediate `{name}` pattern.",
            tags=_tag(v, "apply", "completion", "wittgenstein-early",
                     "directive", "short-direct", "code-complete"),
        )

    # ── ANALYZE (caveats — abductive diagnosis) ───────────────────────────
    for cav in v.get("caveats", []):
        yield _pair(
            user=f"I'm using `{name}` and something seems off — what should I watch for?",
            motoi=f"Common trap with `{name}`: {cav} "
                  f"That's the caveat authored into its contract — take it seriously.",
            tags=_tag(v, "analyze", "caveat-diagnosis", "peirce-abduction",
                     "assertive", "long-reasoning", "code-debug"),
        )

    # ── EVALUATE (drawbacks — critique without fixing) ────────────────────
    for dw in v.get("drawbacks", []):
        yield _pair(
            user=f"When should I NOT reach for `{name}`?",
            motoi=f"Drawback to weigh: {dw} If your context matches that, pick a different verb.",
            tags=_tag(v, "evaluate", "drawback-critique", "aristotle-nous",
                     "assertive", "short-direct", "code-debug"),
        )

    # ── CREATE (related + Row 5 composition emergence) ────────────────────
    if v.get("related"):
        yield _pair(
            user=f"What lives around `{name}` in the reference?",
            motoi=f"Neighbors: {', '.join(f'`{r}`' for r in v['related'])}. "
                  f"Same family — related contracts. When you reach for `{name}`, "
                  f"you'll often reach for those next.",
            tags=_tag(v, "create", "sibling-cluster", "lacan-metonymy",
                     "assertive", "long-reasoning", "graph-relation"),
        )
    row5 = v.get("row_5_emergence") or {}
    if row5.get("base") and row5.get("composition") and row5.get("emergent"):
        yield _pair(
            user=f"How would I use `{name}` to build something bigger?",
            motoi=(f"Base: {row5['base']}\n\nComposition: {row5['composition']}\n\n"
                   f"Emergent pattern: {row5['emergent']}"),
            tags=_tag(v, "create", "row5-emergence", "wittgenstein-early",
                     "directive", "long-reasoning", "composition"),
        )

    # ── ROW 2 AUDIT — pre-baked Peirce abduction (verb-vs-sibling) ────────
    row2 = v.get("row_2_audit") or {}
    if row2.get("problem") and row2.get("meta"):
        yield _pair(
            user=row2["problem"],
            motoi=(f"{row2.get('explanation') or ''}\n\n"
                   f"```scheme\n{row2.get('program') or ''}\n```\n\n"
                   f"{row2.get('meta') or ''}"),
            tags=_tag(v, "analyze", "row2-audit", "peirce-abduction",
                     "assertive", "long-reasoning", "code-write"),
        )

    # ── ROW 3 DIMENSION — cross-substrate transfer (Jung aspect-seeing) ───
    row3 = v.get("row_3_dimension") or {}
    if row3.get("setup") and row3.get("meta"):
        yield _pair(
            user=f"I know `{name}` fits my current problem. Where else does this shape show up?",
            motoi=(f"{row3['setup']}\n\n"
                   f"{row3.get('explanation') or ''}\n\n"
                   f"{row3['meta']}"),
            tags=_tag(v, "create", "row3-dimension", "jung-cross-axis",
                     "assertive", "long-reasoning", "graph-relation"),
        )

    # ── ROW 4 PROOF — Popper falsifiability + invariant ───────────────────
    row4 = v.get("row_4_proof") or {}
    if row4.get("claim") and row4.get("invariant"):
        yield _pair(
            user=f"What's the invariant `{name}` promises to hold?",
            motoi=(f"Claim: {row4['claim']}\n\n"
                   f"Invariant: {row4['invariant']}\n\n"
                   f"What would falsify: a call that returns without preserving that invariant.\n\n"
                   f"{row4.get('meta') or ''}"),
            tags=_tag(v, "evaluate", "row4-proof", "popper-evidence",
                     "assertive", "long-reasoning", "code-debug"),
        )

    # ── DISCIPLINE ASPECT (eng/math/cs per row — Wittgenstein-late aspect) ─
    for row_key in ("row_2_audit", "row_3_dimension", "row_4_proof", "row_5_emergence"):
        row = v.get(row_key) or {}
        eng = row.get("eng")
        cs = row.get("cs")
        math = row.get("math")
        if eng and cs:
            yield _pair(
                user=f"What does `{name}` look like from an engineering perspective?",
                motoi=eng,
                tags=_tag(v, "understand", f"{row_key}-eng-aspect", "wittgenstein-late-aspect",
                         "expressive", "long-reasoning", "ref-retrieve"),
            )
            yield _pair(
                user=f"And from a computer-science perspective — what pattern is `{name}`?",
                motoi=cs,
                tags=_tag(v, "understand", f"{row_key}-cs-aspect", "wittgenstein-late-aspect",
                         "expressive", "long-reasoning", "ref-retrieve"),
            )
        if math:
            yield _pair(
                user=f"What's the mathematical framing of `{name}`?",
                motoi=math,
                tags=_tag(v, "understand", f"{row_key}-math-aspect", "wittgenstein-late-aspect",
                         "expressive", "long-reasoning", "ref-retrieve"),
            )

    # ── LEARN SCAFFOLD (prereqs + progression) ────────────────────────────
    learn = v.get("learn") or {}
    if learn.get("concept") and learn.get("progression"):
        prereqs_str = ", ".join(f"`{p}`" for p in learn.get("prerequisites", []))
        if prereqs_str:
            yield _pair(
                user=f"I want to learn `{name}` — what should I know first?",
                motoi=f"Prerequisites: {prereqs_str}. Concept: {learn['concept']}. "
                      f"Next after: {learn['progression']}",
                tags=_tag(v, "understand", "learn-scaffold", "aristotle-syllogism",
                         "directive", "long-reasoning", "ref-retrieve"),
            )


def iter_all_pairs() -> Iterator[dict]:
    """Top-level generator — yield every pair from every verb."""
    for v in iter_all_verbs():
        yield from emit_pairs_for_verb(v)


if __name__ == "__main__":
    from collections import Counter
    verbs = list(iter_all_verbs())
    print(f"parsed {len(verbs)} verbs from reference/")
    pair_count = 0
    per_verb = []
    tag_dist = Counter()
    bloom_dist = Counter()
    phil_dist = Counter()
    for v in verbs:
        n = 0
        for p in emit_pairs_for_verb(v):
            pair_count += 1
            n += 1
            tag_dist[p["tags"]["shape"]] += 1
            bloom_dist[p["tags"]["bloom"]] += 1
            phil_dist[p["tags"]["philosopher"]] += 1
        per_verb.append(n)
    print(f"total pairs: {pair_count}")
    print(f"mean pairs per verb: {sum(per_verb)/max(1,len(per_verb)):.1f}")
    print(f"max: {max(per_verb) if per_verb else 0}  min: {min(per_verb) if per_verb else 0}")
    print(f"\nBloom distribution:")
    for k, n in bloom_dist.most_common():
        print(f"  {k:15} {n:>6}  ({100*n/max(1,pair_count):.1f}%)")
    print(f"\nPhilosopher-shape distribution (top 10):")
    for k, n in phil_dist.most_common(10):
        print(f"  {k:30} {n:>6}  ({100*n/max(1,pair_count):.1f}%)")
    print(f"\nShape distribution (top 15):")
    for k, n in tag_dist.most_common(15):
        print(f"  {k:35} {n:>6}")
