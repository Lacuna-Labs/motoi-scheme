"""Mk 3 CPT emitter — v5, defect-fix pass on top of v4.

Fixes 11 defects from Architect's list (see _status/MK3-CPT-FIX-PLAN-2026-07-22.md):

  1. Identity/doctrine extracted from books (not fabricated inline)
  2. Lib runtime metadata (VERBS/LAZY/BOOK/TESTS from 78 lib .js files)
  3. Honest-null emitter (empty :oppositions/:associations/:cross-refs)
  4. SHAPE_BLOOM skew fixed — S10/S12/S14/S23 → create bucket
  5. S06 reversed bumped to 5 variants per verb (Reversal Curse doctrine)
  6. Qwen chat-token blacklist assertion (<|im_start|>, <|im_end|>)
  7. Explicit [qwen-native:true] tag on every Qwen-header doc
  8. Halt on any book without :book-type (no silent skip)
  9. Output dir = MK3_CPT_DIR (~/.forge/data/motoi-mk3-cpt) + mirror stub
 10. Stratified 98/2 train/val split per (type, substrate)
 11. Doc packing into 2048-token sequences with boundary tokens

Also narrows graph glob to the 4 axis files (sakura dirs archived).

CLI:
    --dry-run             emit to --out only (skip train/valid split + packing)
    --limit N             cap total docs emitted
    --out PATH            override output path (dry-run only)
    --skip-packing        emit train/valid but skip packed .arrow

Doctrine sources:
    _status/MK3-CPT-FIX-PLAN-2026-07-22.md
    SRE-MANUAL/chapters/04-cpt-sft-authoring-per-data-type.slat
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterator

REPO = Path("/Users/alfred/code/motoi-scheme")
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft"))
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft/extractors"))
sys.path.insert(0, str(REPO / "scripts/cpt-prep"))

# ─── Shared paths (both emit + preflight import) ──────────────────────────
QWEN_REPO = "<|repo_name|>motoi-scheme<|file_sep|>"
QWEN_FIM_PREFIX = "<|fim_prefix|>"
QWEN_FIM_MIDDLE = "<|fim_middle|>"
QWEN_FIM_SUFFIX = "<|fim_suffix|>"

# Qwen chat tokens — MUST NOT appear in CPT stream. Would collapse
# Instruct-alignment for 3B/7B upgrades and confuse base-model in FIM.
QWEN_CHAT_TOKENS_BLACKLIST = ("<|im_start|>", "<|im_end|>")

OLD_CORPUS = Path.home() / ".forge/data/motoi-mk2-cpt"
MK3_CPT_DIR = Path.home() / ".forge/data/motoi-mk3-cpt"
MK3_MIRROR_DIR = REPO / "training-data/mk3-cpt"

# Books that carry Motoi's first-person voice + limits + values → identity/doctrine
IDENTITY_BOOKS = ("book-of-self", "book-of-limits")
DOCTRINE_BOOKS = ("book-of-values", "book-of-reminded")

_provenance_counter = [0]


# ─── Helpers ──────────────────────────────────────────────────────────────

def _rec(text: str, extra: dict | None = None) -> dict:
    # Assert chat-token blacklist per defect #6
    for tok in QWEN_CHAT_TOKENS_BLACKLIST:
        if tok in text:
            raise ValueError(
                f"chat-token contamination: `{tok}` in emitted doc "
                f"(first 200 chars: {text[:200]!r})"
            )
    d = {"text": text}
    if extra:
        d.update(extra)
    return d


def _tag(**kv) -> str:
    return " ".join(f"[{k}:{v}]" for k, v in kv.items() if v is not None and v != "")


def _prov(source_path: str) -> str:
    _provenance_counter[0] += 1
    return (
        f"[provenance:{source_path}] "
        f"[contamination:none] "
        f"[record-id:{_provenance_counter[0]:07d}]"
    )


def _qwen_header(rel_path: str) -> tuple[str, str]:
    """Return (header_line, qwen_native_tag). Header goes at doc top."""
    return f"{QWEN_REPO}{rel_path}", "[qwen-native:true]"


def _approx_tokens(s: str) -> int:
    # Whitespace-split proxy — matches preflight's token estimator
    return len(s.split())


# ─── SHAPE → Bloom mapping (defect #4 — skew fixed) ────────────────────────
# S10 whole-program, S12 guided-mod, S14 cross-row weave, S23 introspection —
# all EMIT/COMPOSE shapes → 'create' bucket per Bloom's original taxonomy.

SHAPE_BLOOM = {
    "S01": "remember",
    "S02": "understand",
    "S03": "analyze",
    "S04": "analyze",
    "S05": "evaluate",
    "S06": "remember",
    "S07": "understand",
    "S08": "apply",
    "S09": "understand",
    "S10": "create",       # was in create — keep
    "S11": "apply",
    "S12": "create",       # was 'apply' — FIX: guided-modification IS composition
    "S14": "create",       # was 'analyze' — FIX: cross-row weave IS synthesis
    "S15": "remember",
    "S16": "understand",
    "S19": "understand",
    "S20": "understand",   # canonical-triple: naming a graph relation ≈ understand
    "S21": "understand",
    "S22": "analyze",
    "S23": "create",       # was 'evaluate' — FIX: introspection-composition = create
    "S24": "remember",     # reversed-relation / reversed-definition = recall (Reversal Curse)
    # HP = reference programs. A whole runnable program IS Bloom's 'apply'
    # (use verbs to produce a working result); the program→coordinate reversal
    # is 'analyze' (deconstruct to identify the shape); the multi-program grid
    # is 'create' (compose a novel whole). Previously these fell through to the
    # 'understand' default, mislabeling 15k+ apply-shaped programs.
    "HP-program": "apply",
    "HP-reversal": "analyze",
    "HP-grid": "create",
    "H-caveat": "analyze",
    "H-drawback": "evaluate",
    "H-usecase": "apply",
    "N-opposition": "analyze",
    "N-short-scenario": "apply",
    "N-antipattern": "analyze",
    "N-motoi-behavior": "understand",
    "N-related-verbs": "understand",
    "N-principle-kind": "understand",
    "S10-summary": "remember",
    "S10-what": "understand",
    "S10-why": "understand",
    "S14-crossrow": "create",
    "F-lib-verbs": "remember",
    "F-lib-book": "understand",
    "F-lib-tests": "apply",
    "F-lib-lazy": "understand",
    "HN-opposition": "analyze",
    "HN-association": "analyze",
    "HN-cross-ref": "analyze",
}


def _bloom(shape: str) -> str:
    if shape in SHAPE_BLOOM:
        return SHAPE_BLOOM[shape]
    for k, v in SHAPE_BLOOM.items():
        if shape.startswith(k):
            return v
    return "understand"


# ─── Variant emitters (S01/S03/S04/S05/S14 keep M=5) ──────────────────────

def _s01_variants(name: str, summary: str, sig: str, lib: str) -> Iterator[str]:
    yield f"`{name}` — {summary}\n\nSignature: `{sig}`."
    yield f"Signature: `{sig}`.\n\nPurpose: {summary}\n\nName: `{name}`."
    yield f"The Motoi verb `{name}` has signature `{sig}` and does: {summary}"
    yield f"In Motoi's `{lib}` library, `{name}` is defined by signature `{sig}`. Behavior: {summary}"
    yield f"`{name}` in Motoi: {summary}\n\nContract: `{sig}`."


def _s03_variants(name: str, siblings: list[str], row2_problem: str) -> Iterator[str]:
    sibs_str = ", ".join(f"`{s}`" for s in siblings[:5])
    yield f"Compared to its siblings ({sibs_str}), `{name}` differs in the context: {row2_problem[:400]}"
    yield f"Sibling verbs ({sibs_str}) serve similar territory, but `{name}` is distinguished by: {row2_problem[:400]}"
    yield f"`{name}` vs siblings ({sibs_str}): the discriminating case is — {row2_problem[:400]}"
    yield f"When choosing between `{name}` and its family ({sibs_str}), reach for `{name}` in: {row2_problem[:400]}"
    yield f"The neighborhood of `{name}` includes {sibs_str}. Pick `{name}` specifically when: {row2_problem[:400]}"


def _s04_variants(name: str, row3_setup: str, row3_expl: str, row3_meta: str) -> Iterator[str]:
    yield f"The shape of `{name}` shows up beyond the reference. {row3_setup} {row3_expl} {row3_meta}"
    yield f"Cross-substrate view: `{name}` isn't only a reference entry. {row3_setup} {row3_meta}"
    yield f"Analogy for `{name}`: {row3_setup}. Where else? {row3_expl}. {row3_meta}"
    yield f"`{name}` recurs across Motoi's substrates. {row3_setup} That same shape: {row3_meta}"
    yield f"To understand `{name}` fully, look outside the reference file. {row3_setup} {row3_expl}"


def _s05_variants(name: str, claim: str, invariant: str) -> Iterator[str]:
    yield f"Invariant `{name}` holds: {claim}\n\nFormal: {invariant}\n\nFalsifier: any call returning without preserving this."
    yield f"Popper-shape proof for `{name}`. Claim: {claim}. ∀-form: {invariant}. What would falsify: violation of the ∀-form on any legal input."
    yield f"`{name}` promises: {claim}\n\nWritten formally: {invariant}\n\nIf any call breaks this promise, the invariant is falsified."
    yield f"Property held by `{name}`: {claim}\n\nAs a universal: {invariant}\n\nTest against falsification: find any input that produces a return violating the ∀-clause."
    yield f"Contract guaranteed by `{name}`: {claim}. In predicate form: {invariant}. The falsifier is a counter-example to the ∀."


def _s06_variants(name: str, summary: str, sig: str, siblings: list[str], lib: str) -> Iterator[tuple[str, str]]:
    """Reversal Curse coverage — 5 variants per verb (defect #5).

    Yields (variant_slug, body). Slugs feed the [cpt-shape-name:...] tag.
    """
    if summary:
        yield "reversed-summary", (
            f"Which Motoi verb has this summary: \"{summary[:200]}\"?\n\n"
            f"`{name}` — it lives in library `{lib}`."
        )
    if sig:
        yield "reversed-signature", (
            f"Which verb has signature `{sig}`?\n\n`{name}`."
        )
    if siblings:
        yield "reversed-sibling-set", (
            f"Which verb has these siblings: {', '.join(siblings[:5])}?\n\n`{name}`."
        )
    if summary and sig:
        yield "reversed-lookup-by-shape", (
            f"A Motoi verb in library `{lib}` has signature `{sig}` and its purpose is "
            f"\"{summary[:180]}\". Name it.\n\n`{name}`."
        )
    if summary:
        yield "reversed-catalog-query", (
            f"Looking at Motoi's catalog: which entry matches the description "
            f"\"{summary[:180]}\"?\n\nThe entry is `{name}`."
        )


def _s14_variants(name: str, row3_setup: str, row3_meta: str) -> Iterator[str]:
    yield f"The verb `{name}` doesn't live only in the reference. {row3_setup} {row3_meta}"
    yield f"Weave note for `{name}`: it recurs beyond its reference entry. {row3_setup} {row3_meta}"
    yield f"Cross-substrate connection: `{name}` lives in the reference AND — {row3_setup} {row3_meta}"
    yield f"Signifier chain for `{name}` (Derrida): {row3_setup} That's how the meaning stabilizes — {row3_meta}"
    yield f"Motoi's substrate reuses `{name}`. {row3_setup} The stability of its meaning: {row3_meta}"


# ═══════════════════════════════════════════════════════════════════════════
# TYPE H — Per-verb reference
# ═══════════════════════════════════════════════════════════════════════════

def emit_type_H_reference():
    import reference as ref_extractor
    for v in ref_extractor.iter_all_verbs():
        if v.get("training_eligible") == "#f":
            continue
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        rel = v.get("source", "").replace(str(REPO) + "/", "")
        if rel and not rel.startswith("Scheme/") and not rel.startswith("scheme/"):
            rel = f"scheme/reference/{rel}"
        qwen_header, qwen_tag = _qwen_header(rel or f"scheme/reference/{lib}.slat")
        base = dict(dialect="motoi", substrate="reference-verb",
                    library=lib, verb=name, material="reference")

        # S01 canonical × 5
        if v.get("signature") and v.get("summary"):
            for i, body in enumerate(_s01_variants(name, v["summary"], v["signature"], lib)):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S01", **{
                        "cpt-shape-name": "canonical", "speech-act": "assertive",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S01", "paraphrase-idx": i, "substrate": "reference-verb"})

        # S02 examples (per-tier, up to M available)
        for i, ex in enumerate(v.get("examples", [])):
            tier = ex.get("tier") or "unknown"
            code = ex.get("code")
            note = ex.get("note")
            if not code:
                continue
            body = f"Worked example of `{name}` at {tier} level.\n\n```scheme\n{code}\n```"
            if note:
                body += f"\n\n{note}"
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S02", **{
                    "cpt-shape-name": "tutorial", "speech-act": "directive",
                    "mode": "exemplar", "paraphrase-idx": i, "audience": tier}) +
                f" {_prov(rel)}" + f"\n\n{body}",
                {"type": "H", "shape": "S02", "paraphrase-idx": i, "substrate": "reference-verb"})

        # S03 sibling-contrast × 5
        row2 = v.get("row_2_audit") or {}
        if v.get("related") and row2.get("problem"):
            for i, body in enumerate(_s03_variants(name, v["related"], row2["problem"])):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S03", **{
                        "cpt-shape-name": "sibling-contrast", "speech-act": "assertive",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S03", "paraphrase-idx": i, "substrate": "reference-verb"})

        # S04 cross-domain × 5
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            for i, body in enumerate(_s04_variants(name, row3["setup"], row3.get("explanation", ""), row3["meta"])):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S04", **{
                        "cpt-shape-name": "cross-domain", "speech-act": "assertive",
                        "mode": "narrative", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S04", "paraphrase-idx": i, "substrate": "reference-verb"})

        # S05 invariant-proof × 5
        row4 = v.get("row_4_proof") or {}
        if row4.get("claim") and row4.get("invariant"):
            for i, body in enumerate(_s05_variants(name, row4["claim"], row4["invariant"])):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S05", **{
                        "cpt-shape-name": "invariant-proof", "speech-act": "declarative",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S05", "paraphrase-idx": i, "substrate": "reference-verb"})

        # S06 reversed × 5 (defect #5)
        siblings = v.get("related") or []
        for i, (slug, body) in enumerate(_s06_variants(
            name, v.get("summary") or "", v.get("signature") or "", siblings, lib
        )):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S06", **{
                    "cpt-shape-name": slug, "speech-act": "interrogative",
                    "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" + f"\n\n{body}",
                {"type": "H", "shape": "S06", "paraphrase-idx": i, "substrate": "reference-verb"})

        # H-caveat/drawback/usecase
        for i, cav in enumerate(v.get("caveats", [])):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="H-caveat", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" + f"\n\nCaveat on `{name}`: {cav}",
                {"type": "H", "shape": "H-caveat", "paraphrase-idx": i, "substrate": "reference-verb"})
        for i, dw in enumerate(v.get("drawbacks", [])):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="H-drawback", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" + f"\n\nDrawback of `{name}` to weigh: {dw}",
                {"type": "H", "shape": "H-drawback", "paraphrase-idx": i, "substrate": "reference-verb"})
        for i, uc in enumerate(v.get("usecases", [])):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="H-usecase", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" + f"\n\nReach for `{name}` when: {uc}",
                {"type": "H", "shape": "H-usecase", "paraphrase-idx": i, "substrate": "reference-verb"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE HP — Per-verb RUNNABLE PROGRAMS (rows 2-5, all disciplines)
#
# S02 (in emit_type_H_reference) only folds row-1 :examples :code. The
# reference actually carries ~15-18 runnable programs per verb across rows
# 2-5 and the eng/math/cs discipline lenses (see 00-intro § 13a — THE KEY).
# Those programs are the bulk of the reference and were 80% missing from the
# fold. This emitter walks EVERY runnable key and frames each as a
# coordinate-labeled cell so the model learns WHAT each program is
# (verb × row × discipline), not anonymous code.
#
# Runnable keys per § 13a:
#   row-2-audit     :program  :eng-program  :math-program  :cs-program
#   row-3-dimension :rungs → per-rung :code (cross-domain)
#   row-4-proof     :program  :eng-program  :math-program  :cs-program
#   row-5-emergence :composition :eng-composition :math-composition :cs-composition
#
# Also emits: (a) a curse-style program→coordinate reversal per row primary
# (the "reversal for programs" — given code, name verb/row); (b) one per-verb
# 3×5 grid document showing the whole matrix intact.
# ═══════════════════════════════════════════════════════════════════════════

# Framing-phrase rotation — deterministic by (verb, row) so ~1000 verbs don't
# all read with an identical scaffold (phrase-lock doctrine). The substantive
# body — the authored :problem/:claim/:meta + the program itself — is unique
# per verb; only the connective scaffold rotates.
def _hp_pick(pool: list, *key_parts) -> str:
    h = 0
    for p in key_parts:
        for ch in str(p):
            h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return pool[h % len(pool)]


_HP_PRIMARY_QUESTION = {
    2: [
        "When do I reach for `{name}` instead of a nearby sibling verb?",
        "What tells me `{name}` is the right call here and not a look-alike?",
        "Which situation makes `{name}` — specifically — the verb to pick?",
    ],
    4: [
        "Why is `{name}` correct — what would a falsifying run look like?",
        "What invariant does `{name}` promise, and how would you break it?",
        "How do you check that `{name}` actually holds its contract?",
    ],
    5: [
        "What larger thing does `{name}` compose into?",
        "How does `{name}` chain with another verb to make something bigger?",
        "What emerges when you build on top of `{name}`?",
    ],
}

_HP_DISC_QUESTION = {
    "engineering":      "What does `{name}` look like through an engineering lens, in the {row} row?",
    "mathematics":      "What is the mathematical framing of `{name}` in the {row} row?",
    "computer-science": "What computer-science shape is `{name}` in the {row} row?",
}

_HP_DISC_LABEL = {
    "engineering": "eng", "mathematics": "math", "computer-science": "cs",
}


def _hp_frame(*lines) -> str:
    return "\n\n".join(l.strip() for l in lines if l and l.strip())


def _hp_cell(qwen_header, qwen_tag, base, rel, name, row_num, row_name,
             discipline, question, frame, program, pidx):
    """Build one coordinate-labeled program cell record."""
    coord = f"`{name}` · row {row_num} ({row_name}) · {discipline}"
    body = _hp_frame(
        f"{coord}\nQuestion this program answers: {question}",
        frame,
        f"Here is a runnable Motoi program:\n\n```scheme\n{program.strip()}\n```",
    )
    tagstr = _tag(**base, shape="HP-program", **{
        "cpt-shape-name": f"program-cell-r{row_num}-{_HP_DISC_LABEL.get(discipline, discipline)}",
        "row": row_num, "discipline": discipline,
        "speech-act": "expository", "mode": "exemplar",
        "paraphrase-idx": pidx, "audience": "programmer"})
    text = f"{qwen_header}\n{qwen_tag} {tagstr} {_prov(rel)}\n\n{body}"
    return _rec(text, {"type": "HP", "shape": "HP-program",
                       "paraphrase-idx": pidx, "substrate": "reference-verb"})


def _hp_reversal_cell(qwen_header, qwen_tag, base, rel, name, row_num, row_name,
                      role, program):
    """Curse-style program→coordinate reversal — given code, name the verb/row."""
    q = _hp_pick([
        "Given this Motoi program, name the verb it teaches and which reference row it belongs to:",
        "Which Motoi verb and reference row does this program demonstrate?",
        "Read this program. Which verb is it the {row}-row example of?",
    ], name, "rev", row_num).replace("{row}", row_name)
    body = _hp_frame(
        q,
        f"```scheme\n{program.strip()}\n```",
        f"This is `{name}` — row {row_num} ({row_name}), the {role} program.",
    )
    tagstr = _tag(**base, shape="HP-reversal", **{
        "cpt-shape-name": f"program-reversal-r{row_num}",
        "row": row_num, "speech-act": "interrogative", "mode": "expository",
        "paraphrase-idx": 0, "audience": "programmer"})
    text = f"{qwen_header}\n{qwen_tag} {tagstr} {_prov(rel)}\n\n{body}"
    return _rec(text, {"type": "HP", "shape": "HP-reversal",
                       "paraphrase-idx": 0, "substrate": "reference-verb"})


_HP_ROW_NAME = {
    "row_2_audit": (2, "audit"),
    "row_3_dimension": (3, "dimension"),
    "row_4_proof": (4, "proof"),
    "row_5_emergence": (5, "emergence"),
}


def emit_type_HP_reference_programs():
    """Emit a framed cell for every runnable program in rows 2-5, all disciplines."""
    import reference as ref_extractor
    from sexpr_reader import read_field, read_field_form, iter_records_in_list

    for v in ref_extractor.iter_all_verbs():
        if v.get("training_eligible") == "#f":
            continue
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        rel = v.get("source", "").replace(str(REPO) + "/", "")
        if rel and not rel.startswith("Scheme/") and not rel.startswith("scheme/"):
            rel = f"scheme/reference/{rel}"
        qwen_header, qwen_tag = _qwen_header(rel or f"scheme/reference/{lib}.slat")
        base = dict(dialect="motoi", substrate="reference-verb",
                    library=lib, verb=name, material="reference")

        # collect (row_num, row_name, discipline, role, program) for the grid doc
        grid: list[tuple] = []

        # ── Rows 2 and 4: :program + :eng/math/cs-program ──────────────────
        for row_key in ("row_2_audit", "row_4_proof"):
            row = v.get(row_key) or {}
            row_raw = row.get("raw") or ""
            row_num, row_name = _HP_ROW_NAME[row_key]
            if row_key == "row_2_audit":
                frame_primary = _hp_frame(
                    f"Scenario: {row.get('problem') or ''}",
                    f"Why this verb: {row.get('meta') or ''}",
                )
            else:  # proof
                frame_primary = _hp_frame(
                    f"Claim: {row.get('claim') or ''}",
                    f"Invariant: {row.get('invariant') or ''}",
                    f"Why it holds: {row.get('meta') or ''}",
                )
            # primary program
            prog = row.get("program")
            if prog:
                q = _hp_pick(_HP_PRIMARY_QUESTION[row_num], name, row_num).format(name=name)
                yield _hp_cell(qwen_header, qwen_tag, base, rel, name, row_num, row_name,
                               "practitioner", q, frame_primary, prog, 0)
                yield _hp_reversal_cell(qwen_header, qwen_tag, base, rel, name,
                                        row_num, row_name, "practitioner", prog)
                grid.append((row_num, row_name, "practitioner", prog))
            # discipline programs
            for disc_key, disc in (("eng-program", "engineering"),
                                   ("math-program", "mathematics"),
                                   ("cs-program", "computer-science")):
                dprog = read_field(row_raw, disc_key)
                if not dprog:
                    continue
                lens = row.get(_HP_DISC_LABEL[disc])  # 2nd-record prose aspect
                q = _HP_DISC_QUESTION[disc].format(name=name, row=row_name)
                frame = _hp_frame(f"{disc.capitalize()} lens: {lens or ''}")
                yield _hp_cell(qwen_header, qwen_tag, base, rel, name, row_num, row_name,
                               disc, q, frame, dprog, 0)
                grid.append((row_num, row_name, disc, dprog))

        # ── Row 3: :rungs → per-rung :code (cross-domain transfer) ─────────
        row3 = v.get("row_3_dimension") or {}
        row3_raw = row3.get("raw") or ""
        setup = row3.get("setup") or ""
        rungs_form = read_field_form(row3_raw, "rungs")
        if rungs_form:
            for ridx, rung in enumerate(iter_records_in_list(rungs_form)):
                code = read_field(rung, "code")
                domain = read_field(rung, "domain") or "another domain"
                if not code:
                    continue
                q = f"Where else does the shape of `{name}` show up? Here: {domain}."
                frame = _hp_frame(
                    f"Same shape: {setup}",
                    f"This rung shows it in: {domain}",
                    f"Why it transfers: {row3.get('meta') or ''}",
                )
                yield _hp_cell(qwen_header, qwen_tag, base, rel, name, 3, "dimension",
                               "cross-domain", q, frame, code, ridx)
                grid.append((3, "dimension", f"rung:{domain[:40]}", code))

        # ── Row 5: :composition + :eng/math/cs-composition ─────────────────
        row5 = v.get("row_5_emergence") or {}
        row5_raw = row5.get("raw") or ""
        frame5 = _hp_frame(
            f"Base: {row5.get('base') or ''}",
            f"Emergent pattern: {row5.get('emergent') or ''}",
            f"Family: {row5.get('meta') or ''}",
        )
        comp = row5.get("composition")
        if comp:
            q = _hp_pick(_HP_PRIMARY_QUESTION[5], name, 5).format(name=name)
            yield _hp_cell(qwen_header, qwen_tag, base, rel, name, 5, "emergence",
                           "practitioner", q, frame5, comp, 0)
            yield _hp_reversal_cell(qwen_header, qwen_tag, base, rel, name,
                                    5, "emergence", "composition", comp)
            grid.append((5, "emergence", "practitioner", comp))
        for disc_key, disc in (("eng-composition", "engineering"),
                               ("math-composition", "mathematics"),
                               ("cs-composition", "computer-science")):
            dcomp = read_field(row5_raw, disc_key)
            if not dcomp:
                continue
            lens = row5.get(_HP_DISC_LABEL[disc])
            q = _HP_DISC_QUESTION[disc].format(name=name, row="emergence")
            frame = _hp_frame(f"{disc.capitalize()} lens: {lens or ''}",
                              f"Emergent: {row5.get('emergent') or ''}")
            yield _hp_cell(qwen_header, qwen_tag, base, rel, name, 5, "emergence",
                           disc, q, frame, dcomp, 0)
            grid.append((5, "emergence", disc, dcomp))

        # ── Per-verb 3×5 grid document — the whole matrix intact ───────────
        if len(grid) >= 4:
            parts = [
                f"The verb `{name}` — its full program matrix.",
                f"Signature: `{v.get('signature') or ''}`. {v.get('summary') or ''}".strip(),
                "Every reference verb is taught as a grid of runnable programs: "
                "5 rows (foundation, audit, dimension, proof, emergence) crossed with "
                "the engineering, mathematics, and computer-science lenses. Each cell "
                "below is one runnable program and names its own coordinate.",
            ]
            for (rn, rname, disc, prog) in grid:
                parts.append(f"### row {rn} ({rname}) · {disc}\n```scheme\n{prog.strip()}\n```")
            body = "\n\n".join(parts)
            tagstr = _tag(**base, shape="HP-grid", **{
                "cpt-shape-name": "program-grid", "speech-act": "expository",
                "mode": "reference", "paraphrase-idx": 0, "audience": "programmer"})
            yield _rec(
                f"{qwen_header}\n{qwen_tag} {tagstr} {_prov(rel)}\n\n{body}",
                {"type": "HP", "shape": "HP-grid", "paraphrase-idx": 0,
                 "substrate": "reference-verb"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE E-book — book shapes (S07/S08/S09/S12/S19)
# ═══════════════════════════════════════════════════════════════════════════

CODE_FENCE_RE = re.compile(r"```(?:scheme|lisp|slat|)?\s*\n(.+?)\n```", re.DOTALL)


def _s07_variants(chapter_title: str, before_code_prose: str, code: str, after_code_prose: str) -> Iterator[str]:
    yield f"Concept: {before_code_prose[:400]}\n\nExample:\n```scheme\n{code}\n```\n\nNotice: {after_code_prose[:200]}"
    yield f"First the idea: {before_code_prose[:400]}\n\nThen the code:\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"
    yield f"From {chapter_title} — {before_code_prose[:300]}\n\nIn code:\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"
    yield f"The pattern: {before_code_prose[:300]}\n\nWorked example:\n```scheme\n{code}\n```\n\nWhat to notice: {after_code_prose[:200]}"
    yield f"Prose sets it up ({before_code_prose[:250]}) and the code makes it real:\n\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"


def _s08_variants(chapter_title: str, code: str) -> Iterator[str]:
    lines = code.split("\n")
    if not lines:
        return
    header = lines[0]
    yield f"Spec: {header}\n\nExpected: correct completion for the header.\n\nAnswer:\n```scheme\n{code}\n```"
    yield f"Given the signature below, write the body that satisfies its contract.\n\n```scheme\n{header}\n  ; ...\n```\n\nAnswer:\n```scheme\n{code}\n```"
    yield f"Exercise (from {chapter_title}): complete this function.\n\nHeader: `{header}`\n\nCorrect body:\n```scheme\n{code}\n```"


def _s09_variant(chapter_title: str, code: str) -> str:
    return (
        f"## {chapter_title}\n\nThe following demonstrates the pattern.\n\n"
        f"```scheme\n{code}\n```\n\n"
        f"Running this in Motoi produces the expected side effects — inspect the output to confirm."
    )


def _s12_variants(chapter_title: str, code: str) -> Iterator[str]:
    yield f"Starting code (from {chapter_title}):\n\n```scheme\n{code}\n```\n\nNow change the top-level identifier and notice how the behavior stays consistent under renaming."
    yield f"From {chapter_title}:\n\n```scheme\n{code}\n```\n\nModify: add one more clause and observe the ordering matters for the final result."


def _read_book_types_all_shapes() -> dict[str, str]:
    """Broad book-type reader: handles README.slat + README.book.slatl,
    and both `(readme` and `(book-readme` prefixes.

    The stock book_extractor.read_book_types only reads README.slat +
    `(readme`. Some books use README.book.slatl (book-of-values,
    book-of-modules) or `(book-readme` (book-of-narrative-games).
    """
    from sexpr_reader import iter_top_level_forms, read_field
    out: dict[str, str] = {}
    books_root = REPO / "scheme-books"
    for readme in list(books_root.glob("book-of-*/README.slat")) + \
                  list(books_root.glob("book-of-*/README.slatl")) + \
                  list(books_root.glob("book-of-*/README.book.slatl")):
        book_dir = readme.parent.name
        if book_dir in out:
            continue
        for prefix in ("(readme", "(book-readme", "(boot-record"):
            try:
                for raw in iter_top_level_forms(readme, prefix=prefix):
                    bt = read_field(raw, "book-type")
                    if bt:
                        out[book_dir] = bt
                        break
            except Exception:
                continue
            if book_dir in out:
                break
    return out


def emit_book_shapes():
    """Emit S07/S08/S09/S12/S19 per book chapter, book-type routed.

    Halts on missing :book-type per defect #8.
    """
    import book as book_extractor

    # Defect #8: verify every book has README with :book-type BEFORE emitting.
    book_types = _read_book_types_all_shapes()
    all_book_dirs = sorted({
        p.parent.name
        for p in (REPO / "scheme-books").glob("book-of-*/*.book.slatl")
    })
    missing_type = [d for d in all_book_dirs if d not in book_types]
    if missing_type:
        # Halt loudly — SRE ch04 §267-273.
        raise RuntimeError(
            "HALT (defect #8): the following books have chapters but no "
            "README.slat with :book-type — pipeline requires :book-type per book:\n  "
            + "\n  ".join(missing_type)
            + "\n\nFix each book's README.slat (or README.book.slatl) with a "
            ":book-type field, then re-run emit."
        )

    for ch in book_extractor.iter_all_chapters():
        # Override book_type with our broad reader (upstream defaults to
        # 'learning' silently for unknown; we already halted above so this
        # just ensures we use the real one).
        book_type = book_types.get(ch["book_dir"], ch["book_type"])
        book_title = ch["book_title"]
        book_dir = ch["book_dir"]
        chapter_title = ch["title"] or f"chapter-{ch['chapter_number']}"
        prose = ch["prose"]
        rel = ch["path"].replace(str(REPO) + "/", "")
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="book", book=book_dir,
                    chapter=chapter_title[:60], material=f"book-{book_type}")
        base["book-type"] = book_type

        code_blocks = CODE_FENCE_RE.findall(prose)
        code_blocks = [c.strip() for c in code_blocks if 30 < len(c) < 800]

        code_ctx = []
        for code in code_blocks[:6]:
            idx = prose.find(code)
            if idx == -1:
                continue
            before = prose[:idx].split("\n\n")[-1][:500] if idx > 0 else ""
            after_idx = idx + len(code) + 6
            after = prose[after_idx:].split("\n\n")[0][:500] if after_idx < len(prose) else ""
            code_ctx.append((code, before, after))

        # S07 concept-then-example
        if book_type in ("learning", "composition", "challenge"):
            for cidx, (code, before, after) in enumerate(code_ctx[:4]):
                for pi, body in enumerate(_s07_variants(chapter_title, before, code, after)):
                    yield _rec(
                        f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S07", **{
                            "cpt-shape-name": "concept-then-example",
                            "speech-act": "assertive", "mode": "exemplar",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S07", "paraphrase-idx": pi, "substrate": "book"})

        # S08 docstring-driven-exercise
        if book_type == "learning":
            for cidx, (code, _, _) in enumerate(code_ctx[:3]):
                for pi, body in enumerate(_s08_variants(chapter_title, code)):
                    yield _rec(
                        f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S08", **{
                            "cpt-shape-name": "docstring-driven-exercise",
                            "speech-act": "directive", "mode": "exemplar",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S08", "paraphrase-idx": pi, "substrate": "book"})

        # S09 notebook-interleave
        if book_type in ("learning", "application", "composition"):
            for cidx, (code, _, _) in enumerate(code_ctx[:3]):
                body = _s09_variant(chapter_title, code)
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S09", **{
                        "cpt-shape-name": "notebook-interleave",
                        "speech-act": "assertive", "mode": "exemplar",
                        "paraphrase-idx": cidx, "code-block-idx": cidx,
                        "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "E-book", "shape": "S09", "paraphrase-idx": cidx, "substrate": "book"})

        # S12 guided-modification
        if book_type == "learning":
            for cidx, (code, _, _) in enumerate(code_ctx[:2]):
                for pi, body in enumerate(_s12_variants(chapter_title, code)):
                    yield _rec(
                        f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S12", **{
                            "cpt-shape-name": "guided-modification",
                            "speech-act": "directive", "mode": "imperative",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S12", "paraphrase-idx": pi, "substrate": "book"})

        # S19 origin-story
        if book_dir in ("book-of-jesse", "book-of-jesse-one", "book-of-jesse-two",
                        "book-of-language-ancestors"):
            body_prose = re.sub(r"```.*?```", "", prose, flags=re.DOTALL).strip()
            excerpt = body_prose[:800] if len(body_prose) > 800 else body_prose
            if len(excerpt) > 100:
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S19", **{
                        "cpt-shape-name": "origin-story",
                        "speech-act": "expressive", "mode": "narrative",
                        "paraphrase-idx": 0, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nFrom {book_title} · {chapter_title}:\n\n{excerpt}",
                    {"type": "S19", "shape": "S19", "substrate": "book"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE L — Carts
# ═══════════════════════════════════════════════════════════════════════════

def emit_type_L_carts():
    import cart as motoi_cart

    for cart in motoi_cart.iter_all_carts():
        header = cart["header"]
        name = header.get("name") or cart["filename"].rsplit(".", 1)[0]
        one_line = header.get("one-line") or ""
        rel = cart["rel_path"]
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="cart-motoi", cart=name, material="cart")
        text = cart["text"][:2500]
        yield _rec(
            f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S10", **{
                "cpt-shape-name": "whole-program", "speech-act": "assertive",
                "mode": "exemplar", "paraphrase-idx": 0, "audience": "programmer"}) +
            f" {_prov(rel)}" +
            f"\n\nMotoi cart `{name}` — {one_line}\n\n```scheme\n{text}\n```",
            {"type": "L", "cart": name, "shape": "S10", "substrate": "cart-motoi"})
        if one_line:
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S10-summary", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nThe Motoi cart `{name}` is a runnable program that: {one_line}",
                {"type": "L", "cart": name, "shape": "S10-summary", "substrate": "cart-motoi"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE I — Identity (FROM BOOKS, not fabricated) — defect #1
# ═══════════════════════════════════════════════════════════════════════════

_MIN_PARAGRAPH_TOKENS = 20
_MAX_PARAGRAPH_CHARS = 900


def _extract_paragraphs_from_book(book_dir: str) -> Iterator[tuple[str, str]]:
    """Yield (rel_path, paragraph) from every chapter of the named book.

    Splits :prose by double-newline; drops paragraphs that are too short,
    all-code, or bulleted lists.  Strips leading ';' comment markers that
    some chapters use to embed prose inside SLAT (see book-of-self ch03).
    """
    import book as book_extractor
    for ch in book_extractor.iter_all_chapters():
        if ch["book_dir"] != book_dir:
            continue
        rel = ch["path"].replace(str(REPO) + "/", "")
        prose = ch["prose"]
        # Strip inline code fences (keep only prose)
        prose_only = CODE_FENCE_RE.sub("", prose)
        # Strip leading ';' comment marks that book-of-self uses inside SLAT
        prose_only = re.sub(r"^\s*;\s?", "", prose_only, flags=re.MULTILINE)
        for para in prose_only.split("\n\n"):
            para = para.strip()
            if not para:
                continue
            if para.startswith(("──", "===", "---", "***")):
                continue
            if _approx_tokens(para) < _MIN_PARAGRAPH_TOKENS:
                continue
            if len(para) > _MAX_PARAGRAPH_CHARS:
                para = para[:_MAX_PARAGRAPH_CHARS].rsplit(" ", 1)[0] + "…"
            yield rel, para


def emit_type_I_identity():
    """Extract first-person identity paragraphs from IDENTITY_BOOKS.

    No fabrication. Every paragraph traces to a real chapter path.
    """
    for book_dir in IDENTITY_BOOKS:
        for rel, para in _extract_paragraphs_from_book(book_dir):
            qwen_header, qwen_tag = _qwen_header(rel)
            base = dict(dialect="motoi", substrate="identity", book=book_dir,
                        material="persona")
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S15", **{
                    "cpt-shape-name": "first-person-creed", "speech-act": "commissive",
                    "mode": "declarative", "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\n{para}",
                {"type": "I", "shape": "S15", "substrate": "identity"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE J — Doctrine (FROM BOOKS, not fabricated) — defect #1
# ═══════════════════════════════════════════════════════════════════════════

def emit_type_J_doctrine():
    for book_dir in DOCTRINE_BOOKS:
        for rel, para in _extract_paragraphs_from_book(book_dir):
            qwen_header, qwen_tag = _qwen_header(rel)
            base = dict(dialect="motoi", substrate="doctrine", book=book_dir,
                        material="persona")
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S16", **{
                    "cpt-shape-name": "third-person-biography", "speech-act": "assertive",
                    "mode": "declarative", "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\n{para}",
                {"type": "J", "shape": "S16", "substrate": "doctrine"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE K — Weave × M=5
# ═══════════════════════════════════════════════════════════════════════════

def emit_type_K_weave():
    import reference as ref_extractor
    verbs = list(ref_extractor.iter_all_verbs())
    for v in verbs[:1500]:
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        rel = v.get("source", "").replace(str(REPO) + "/", "")
        if rel and not rel.startswith("Scheme/") and not rel.startswith("scheme/"):
            rel = f"scheme/reference/{rel}"
        qwen_header, qwen_tag = _qwen_header(rel or "engineering/motoi-weave.md")
        base = dict(dialect="motoi", substrate="weave", verb=name, library=lib, material="weave")
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            for pi, body in enumerate(_s14_variants(name, row3["setup"], row3["meta"])):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S14", **{
                        "cpt-shape-name": "entity-graph-relation", "speech-act": "assertive",
                        "mode": "narrative", "paraphrase-idx": pi, "audience": "programmer"}) +
                    f" {_prov(rel or 'engineering/motoi-weave.md')}" +
                    f"\n\n{body}",
                    {"type": "K", "shape": "S14", "paraphrase-idx": pi, "substrate": "weave"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE M — Cart FIM
# ═══════════════════════════════════════════════════════════════════════════

_FIM_MIN_CHARS = 60
_FIM_MAX_CHARS = 1500


def _extract_fim_from_scheme(text: str) -> list[tuple[str, str, str]]:
    triples = []
    forms = re.findall(r'\((?:define|lambda|let[*]?|cond|if|when|unless)[^)]*?(?:\([^)]*\)[^)]*?)*\)',
                       text, re.DOTALL)
    for form in forms:
        if _FIM_MIN_CHARS < len(form) < _FIM_MAX_CHARS:
            lines = form.split("\n")
            if len(lines) < 4:
                continue
            cut1 = max(1, len(lines) // 3)
            cut2 = min(len(lines) - 1, 2 * len(lines) // 3)
            prefix = "\n".join(lines[:cut1])
            middle = "\n".join(lines[cut1:cut2])
            suffix = "\n".join(lines[cut2:])
            if middle.strip():
                triples.append((prefix, middle, suffix))
    return triples


def emit_type_M_cart_fim():
    import cart as motoi_cart
    for cart in motoi_cart.iter_all_carts():
        rel = cart["rel_path"]
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="cart-fim", source="motoi", material="cart-fim")
        for i, (p, m, s) in enumerate(_extract_fim_from_scheme(cart["text"])[:5]):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S11", **{
                    "cpt-shape-name": "fim", "speech-act": "assertive",
                    "mode": "exemplar", "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\n{QWEN_FIM_PREFIX}{p}{QWEN_FIM_SUFFIX}{s}{QWEN_FIM_MIDDLE}{m}",
                {"type": "M", "shape": "S11", "substrate": "cart-fim"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE N — Graph tag data
# ═══════════════════════════════════════════════════════════════════════════

def emit_type_N_graph_tags():
    import graph as g
    for n in g.iter_all_nodes():
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        rel = f"graphs/graph-of-{axis}.slat"
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="graph-tag", word=can, axis=axis,
                    tier=n["tier"], material=f"graph-{axis}")

        for i, opp in enumerate(n.get("oppositions", [])[:5]):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-opposition", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nThe opposite of `{can}` in the {axis} axis is `{opp}`.",
                {"type": "N", "shape": "N-opposition", "substrate": f"graph-{axis}"})

        # Honest-null opposition — the "I don't know an opposite" training signal.
        # Doctrine: an empty opposition with the flag set is signal, not absence.
        if n.get("honest_null_oppositions") and not n.get("oppositions"):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-honest-null-opposition", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nDoes `{can}` have an opposite in the {axis} axis? No — Motoi's corpus "
                f"carries no opposition signal for `{can}`. That is an honest gap, not a hidden "
                f"answer: `{can}` is a foundational {axis}-axis noun with no natural counterpart to name.",
                {"type": "N", "shape": "N-honest-null-opposition", "substrate": f"graph-{axis}"})

        assoc = [a.split("(", 1)[0].strip() for a in n.get("associations", []) if a.split("(", 1)[0].strip()]
        if assoc:
            names = ", ".join(f"`{w}`" for w in assoc[:8])
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-associations", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nWords that statistically cluster around `{can}` in Motoi's {axis} axis: {names}.",
                {"type": "N", "shape": "N-associations", "substrate": f"graph-{axis}"})

        dn = [w for w in n.get("distributional_neighbors", []) if w.strip()]
        if dn:
            names = ", ".join(f"`{w}`" for w in dn[:10])
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-distributional-neighbors", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nDistributional neighbors of `{can}` (words it keeps company with in the "
                f"{axis} axis): {names}.",
                {"type": "N", "shape": "N-distributional-neighbors", "substrate": f"graph-{axis}"})

        ss = n.get("short_scenario")
        if ss:
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-short-scenario", **{
                    "speech-act": "assertive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nA scenario where `{can}` matters:\n\n{ss}",
                {"type": "N", "shape": "N-short-scenario", "substrate": f"graph-{axis}"})

        ap = n.get("antipattern_scenario")
        if ap:
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-antipattern", **{
                    "speech-act": "directive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nWhat goes wrong when `{can}` is ignored:\n\n{ap}",
                {"type": "N", "shape": "N-antipattern", "substrate": f"graph-{axis}"})

        mb = n.get("motoi_behavior", "")
        if mb:
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-motoi-behavior", **{
                    "speech-act": "assertive", "mode": "declarative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nMotoi's behavior around `{can}`: {mb}",
                {"type": "N", "shape": "N-motoi-behavior", "substrate": f"graph-{axis}"})

        rv = n.get("related_verbs", [])
        if rv:
            names = ", ".join(f"`{v}`" for _, v in rv[:5])
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-related-verbs", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nReference verbs that invoke `{can}`: {names}",
                {"type": "N", "shape": "N-related-verbs", "substrate": f"graph-{axis}"})

        pk = n.get("principle_kind")
        if pk:
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="N-principle-kind", **{
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\n`{can}` is a {pk.lstrip(':')} principle in the {axis} axis.",
                {"type": "N", "shape": "N-principle-kind", "substrate": f"graph-{axis}"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE G-graph — S20/S21/S22/S23 graph shapes
# ═══════════════════════════════════════════════════════════════════════════

def emit_graph_shapes_S20_S23():
    import graph as g
    nodes = list(g.iter_all_nodes())
    by_id = {n["id"]: n for n in nodes}

    for n in nodes:
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        tier = n["tier"]
        rel = f"graphs/graph-of-{axis}.slat"
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate=f"graph-{axis}", word=can,
                    axis=axis, tier=tier, material=f"graph-{axis}")

        assocs = n.get("surrounding_words", [])
        if assocs and axis in ("sensation", "intuition", "thinking", "feeling"):
            # Cap S20 per-node emission: T1=3, T2=2, T3=1 (Zipfian yield control)
            per_node_cap = {"1": 3, "2": 2}.get(tier, 1)
            for i, other in enumerate(assocs[:per_node_cap]):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S20", **{
                        "cpt-shape-name": "canonical-triple",
                        "speech-act": "assertive", "mode": "declarative",
                        "paraphrase-idx": i, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nIn Motoi's {axis} axis, `{can}` is-related-to `{other}`.",
                    {"type": "G-graph", "shape": "S20", "substrate": f"graph-{axis}"})

        if axis in ("sensation", "intuition", "feeling") and (n.get("definition") or assocs):
            parts = []
            if n.get("definition"):
                parts.append(n["definition"])
            if assocs:
                parts.append(f"Its neighborhood in the {axis} axis includes: {', '.join(assocs[:6])}.")
            if n.get("appears_in_corpus"):
                files = [e.get("file", "") for e in n["appears_in_corpus"][:3] if e.get("file")]
                if files:
                    parts.append(f"Appears in: {', '.join(files)}.")
            body = " ".join(parts)
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S21", **{
                    "cpt-shape-name": "neighborhood-field-guide",
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nField-guide entry for `{can}` ({axis} axis):\n\n{body}",
                {"type": "G-graph", "shape": "S21", "substrate": f"graph-{axis}"})

        # ── WORD REVERSALS (Reversal Curse for the graph/words) ──────────
        # Forward S20 teaches "`can` is-related-to `other`"; the model must
        # also answer the reverse. Alfred 2026-07-27: "don't forget to do the
        # reversals for the words." Reversed-relation (name the word from a
        # neighbor) + reversed-definition (name the word from its meaning).
        if assocs and axis in ("sensation", "intuition", "thinking", "feeling"):
            per_node_cap = {"1": 3, "2": 2}.get(tier, 1)
            for i, other in enumerate(assocs[:per_node_cap]):
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S24", **{
                        "cpt-shape-name": "reversed-relation",
                        "speech-act": "interrogative", "mode": "declarative",
                        "paraphrase-idx": i, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nIn Motoi's {axis} axis, which word is related to `{other}`? "
                    f"One answer is `{can}`.",
                    {"type": "G-graph", "shape": "S24", "substrate": f"graph-{axis}"})
        if n.get("definition") and axis in ("sensation", "intuition", "feeling"):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S24", **{
                    "cpt-shape-name": "reversed-definition",
                    "speech-act": "interrogative", "mode": "declarative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nWhich word in Motoi's {axis} axis is defined as: "
                f"\"{n['definition'][:200]}\"?\n\n`{can}`.",
                {"type": "G-graph", "shape": "S24", "substrate": f"graph-{axis}"})

        if axis == "intuition" and n.get("cross_refs_graph"):
            for i, (other_axis, other_id) in enumerate(n["cross_refs_graph"][:2]):
                other_node = by_id.get(other_id)
                if not other_node:
                    continue
                other_can = other_node["canonical"] or other_id.split("/", 1)[-1]
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S22", **{
                        "cpt-shape-name": "linked-context",
                        "speech-act": "assertive", "mode": "narrative",
                        "paraphrase-idx": i, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nTwo linked concepts in Motoi's graph: `{can}` (intuition) and `{other_can}` ({other_axis}). "
                    f"`{can}` — {n.get('definition', '')[:200]}. `{other_can}` — {other_node.get('definition', '')[:200]}. "
                    f"Reading them together reveals how the axes bridge.",
                    {"type": "G-graph", "shape": "S22", "substrate": f"graph-{axis}"})

        if axis in ("thinking", "feeling"):
            ss = n.get("short_scenario", "")
            ap = n.get("antipattern_scenario", "")
            if ss and ap:
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S23", **{
                        "cpt-shape-name": "scenario-counterfactual",
                        "speech-act": "directive", "mode": "narrative",
                        "paraphrase-idx": 0, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nApplying `{can}` correctly:\n\n{ss}\n\nAntipattern (what breaks):\n\n{ap}",
                    {"type": "G-graph", "shape": "S23", "substrate": f"graph-{axis}"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE F — Lib runtime metadata (defect #2)
# ═══════════════════════════════════════════════════════════════════════════

# Regex patterns for VERBS/LAZY/BOOK/TESTS export blocks.
_LIB_VERBS_RE = re.compile(
    r"^export\s+const\s+VERBS\s*=\s*(\[.*?\])",
    re.MULTILINE | re.DOTALL,
)
_LIB_LAZY_RE = re.compile(
    r"^export\s+const\s+LAZY\s*=\s*(true|false)\b",
    re.MULTILINE,
)
_LIB_BOOK_RE = re.compile(
    r"^export\s+const\s+BOOK\s*=\s*['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)
_LIB_TESTS_RE = re.compile(
    r"^export\s+const\s+TESTS\s*=\s*(\[.*?\])",
    re.MULTILINE | re.DOTALL,
)

# Extract quoted strings from a JS array literal
_JS_STR_RE = re.compile(r"['\"]([^'\"]+)['\"]")


def _parse_verbs_literal(literal: str) -> list[str]:
    return _JS_STR_RE.findall(literal)


def _parse_tests_literal(literal: str) -> list[tuple[str, str]]:
    """Parse a TESTS = [ [in, out], ... ] literal into (in_str, out_str) pairs.

    Best-effort — the literal may contain escapes; we return raw pair strings.
    """
    # Find inner arrays [..., ...] — top level
    pairs = []
    inner = re.findall(r"\[\s*(['\"].*?)\s*\]", literal, re.DOTALL)
    for entry in inner:
        strs = _JS_STR_RE.findall(entry)
        if len(strs) >= 2:
            pairs.append((strs[0], strs[1]))
    return pairs


def emit_type_F_lib_runtime():
    """Walk lib/**/*.js and verbalize VERBS/LAZY/BOOK/TESTS exports.

    Emits 4 shape variants per lib file:
      F-lib-verbs   — verb list summary
      F-lib-lazy    — load mode
      F-lib-book    — book coverage (only when BOOK is exported)
      F-lib-tests   — smoke tests (only when TESTS is exported)
    """
    lib_root = REPO / "lib"
    for path in sorted(lib_root.rglob("*.js")):
        try:
            src = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        m_verbs = _LIB_VERBS_RE.search(src)
        if not m_verbs:
            continue
        verbs = _parse_verbs_literal(m_verbs.group(1))
        if not verbs:
            continue

        rel = str(path.relative_to(REPO))
        # Library slug: parent-dir / basename-without-ext
        lib_slug = f"{path.parent.name}/{path.stem}"
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="lib-runtime",
                    library=lib_slug, material="lib-runtime")

        # F-lib-verbs — verb list
        verbs_str = ", ".join(f"`{v}`" for v in verbs)
        yield _rec(
            f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="F-lib-verbs", **{
                "cpt-shape-name": "lib-verb-list",
                "speech-act": "assertive", "mode": "expository",
                "paraphrase-idx": 0, "audience": "programmer",
                "lib-runtime": lib_slug, "export-kind": "VERBS"}) +
            f" {_prov(rel)}" +
            f"\n\nThe `{lib_slug}` library exports {len(verbs)} verb(s): {verbs_str}.",
            {"type": "F", "shape": "F-lib-verbs", "substrate": "lib-runtime"})

        # F-lib-lazy — load mode
        m_lazy = _LIB_LAZY_RE.search(src)
        if m_lazy:
            mode = "lazy" if m_lazy.group(1) == "true" else "eager"
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="F-lib-lazy", **{
                    "cpt-shape-name": "lib-load-mode",
                    "speech-act": "assertive", "mode": "declarative",
                    "paraphrase-idx": 0, "audience": "programmer",
                    "lib-runtime": lib_slug, "export-kind": "LAZY"}) +
                f" {_prov(rel)}" +
                f"\n\nThe `{lib_slug}` library loads in {mode} mode "
                f"(LAZY = {m_lazy.group(1)}).",
                {"type": "F", "shape": "F-lib-lazy", "substrate": "lib-runtime"})

        # F-lib-book — book coverage
        m_book = _LIB_BOOK_RE.search(src)
        if m_book:
            book_path = m_book.group(1)
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="F-lib-book", **{
                    "cpt-shape-name": "lib-book-coverage",
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer",
                    "lib-runtime": lib_slug, "export-kind": "BOOK"}) +
                f" {_prov(rel)}" +
                f"\n\nThe `{lib_slug}` library is documented in `{book_path}`. "
                f"Its {len(verbs)} verb(s) are taught there in context.",
                {"type": "F", "shape": "F-lib-book", "substrate": "lib-runtime"})

        # F-lib-tests — smoke tests
        m_tests = _LIB_TESTS_RE.search(src)
        if m_tests:
            pairs = _parse_tests_literal(m_tests.group(1))
            if pairs:
                for i, (in_expr, out_expr) in enumerate(pairs[:5]):
                    yield _rec(
                        f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="F-lib-tests", **{
                            "cpt-shape-name": "lib-smoke-test",
                            "speech-act": "assertive", "mode": "exemplar",
                            "paraphrase-idx": i, "audience": "programmer",
                            "lib-runtime": lib_slug, "export-kind": "TESTS"}) +
                        f" {_prov(rel)}" +
                        f"\n\nSmoke test for `{lib_slug}`:\n\n"
                        f"```\n{in_expr}\n; => {out_expr}\n```",
                        {"type": "F", "shape": "F-lib-tests", "substrate": "lib-runtime"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE HN — Honest-null (defect #3)
# ═══════════════════════════════════════════════════════════════════════════

def emit_honest_nulls():
    """Emit honest-null docs from graph nodes with empty slots.

    For each tier-1 or tier-2 node, if:
      - :oppositions is empty  →  "I don't know an opposite for X"
      - :surrounding-words is empty  →  "no distributional associates found"
      - :cross-refs-graph is empty AND tier-1 (not expected for T2/T3)
        →  "no cross-axis bridge"

    Each carries [honest-null:true] and a [null-reason:...] tag.

    Also merges with /tmp/motoi-audit/miner-nulls-2026-07-22.jsonl if present.
    """
    import graph as g
    for n in g.iter_all_nodes():
        tier = n["tier"]
        if tier not in ("1", "2"):
            continue
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        rel = f"graphs/graph-of-{axis}.slat"
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="honest-null",
                    word=can, axis=axis, tier=tier, material="honest-null")

        if not n.get("oppositions"):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="HN-opposition", **{
                    "cpt-shape-name": "honest-null-opposition",
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any",
                    "honest-null": "true", "null-reason": "no-opposition"}) +
                f" {_prov(rel)}" +
                f"\n\nI don't know if `{can}` has an opposite in Motoi's `{axis}` axis — "
                f"no corpus signal found. Its meaning may be foundational to the axis "
                f"rather than defined against a counter-term.",
                {"type": "HN", "shape": "HN-opposition", "substrate": "honest-null"})

        if not n.get("surrounding_words"):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="HN-association", **{
                    "cpt-shape-name": "honest-null-association",
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any",
                    "honest-null": "true", "null-reason": "no-corpus-signal"}) +
                f" {_prov(rel)}" +
                f"\n\nI don't have distributional associates for `{can}` in Motoi's "
                f"`{axis}` axis — the corpus doesn't show clear neighbors. That's a "
                f"signal to answer sparingly rather than fabricate.",
                {"type": "HN", "shape": "HN-association", "substrate": "honest-null"})

        if tier == "1" and not n.get("cross_refs_graph"):
            yield _rec(
                f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="HN-cross-ref", **{
                    "cpt-shape-name": "honest-null-cross-ref",
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any",
                    "honest-null": "true", "null-reason": "foundational-structure"}) +
                f" {_prov(rel)}" +
                f"\n\nI don't see cross-axis bridges from `{can}` in Motoi's graph — "
                f"it stays inside the `{axis}` axis. Foundational nodes often don't "
                f"reach outside their axis.",
                {"type": "HN", "shape": "HN-cross-ref", "substrate": "honest-null"})

    # Also merge miner nulls file if present
    miner_file = Path("/tmp/motoi-audit/miner-nulls-2026-07-22.jsonl")
    if miner_file.exists():
        with miner_file.open() as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                node_id = entry.get("node_id", "")
                axis = entry.get("axis", "unknown")
                reason = entry.get("reason", "no-corpus-signal")
                text = entry.get("text") or (
                    f"I don't know — {node_id} lacks corpus signal "
                    f"({reason}). Not fabricating."
                )
                rel = f"graphs/graph-of-{axis}.slat"
                qwen_header, qwen_tag = _qwen_header(rel)
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " +
                    _tag(dialect="motoi", substrate="honest-null-miner",
                         axis=axis, material="honest-null", shape="HN-miner", **{
                             "cpt-shape-name": "honest-null-miner",
                             "speech-act": "declarative", "mode": "expository",
                             "paraphrase-idx": 0, "audience": "any",
                             "honest-null": "true", "null-reason": reason}) +
                    f" {_prov(rel)}" + f"\n\n{text}",
                    {"type": "HN", "shape": "HN-miner", "substrate": "honest-null-miner"})


# ═══════════════════════════════════════════════════════════════════════════
# Bloom-tag injection + stratified split + packing
# ═══════════════════════════════════════════════════════════════════════════

_SHAPE_TAG_RE = re.compile(r'(\[shape:([^\]]+)\])')


def _inject_bloom_tag(records: list[dict]) -> list[dict]:
    out = []
    for d in records:
        t = d.get("text", "")
        m = _SHAPE_TAG_RE.search(t)
        if m and "[bloom:" not in t:
            shape = m.group(2)
            b = _bloom(shape)
            t = t.replace(m.group(1), f"{m.group(1)} [bloom:{b}]", 1)
            d["text"] = t
            d["bloom"] = b
        elif "[bloom:" in t:
            bm = re.search(r'\[bloom:([^\]]+)\]', t)
            if bm:
                d["bloom"] = bm.group(1)
        out.append(d)
    return out


def _stratified_split(records: list[dict], val_frac: float = 0.02,
                      seed: int = 13) -> tuple[list[dict], list[dict]]:
    """Split records 98/2 per (type, substrate) stratum.

    Every stratum with ≥ 50 records gets 2% held out. Smaller strata get
    max(1, round(n * val_frac)) held out.
    """
    rnd = random.Random(seed)
    by_stratum: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in records:
        stratum = (r.get("type", "?"), r.get("substrate", "?"))
        by_stratum[stratum].append(r)

    train, val = [], []
    for stratum, items in by_stratum.items():
        rnd.shuffle(items)
        n = len(items)
        n_val = max(1, round(n * val_frac)) if n >= 5 else 0
        val.extend(items[:n_val])
        train.extend(items[n_val:])
    rnd.shuffle(train)
    rnd.shuffle(val)
    return train, val


def _pack_sequences(records: list[dict], target_tokens: int = 2048) -> list[dict]:
    """Pack multiple docs into one sequence separated by <|file_sep|>.

    Returns list of {"text": packed, "boundaries": [n1, n2, ...], "n_docs": k}
    where boundaries are TOKEN counts (whitespace-split proxy) of intra-pack
    doc segments. Trainer converts to attention_mask breakpoints.
    """
    packed: list[dict] = []
    sep = "<|file_sep|>"
    sep_tokens = 1  # single special token
    cur_text_parts: list[str] = []
    cur_tokens: list[int] = []
    cur_count = 0

    def flush():
        if not cur_text_parts:
            return
        packed_text = sep.join(cur_text_parts)
        packed.append({
            "text": packed_text,
            "boundaries": list(cur_tokens),
            "n_docs": len(cur_text_parts),
        })

    for r in records:
        t = r.get("text", "")
        n = _approx_tokens(t)
        if n == 0:
            continue
        # If a single doc exceeds budget, emit alone (truncate downstream)
        if n >= target_tokens - 4:
            flush()
            cur_text_parts = []
            cur_tokens = []
            cur_count = 0
            packed.append({"text": t, "boundaries": [n], "n_docs": 1})
            continue
        # If adding overflows, flush
        projected = cur_count + n + (sep_tokens if cur_text_parts else 0)
        if projected > target_tokens:
            flush()
            cur_text_parts = [t]
            cur_tokens = [n]
            cur_count = n
        else:
            cur_text_parts.append(t)
            cur_tokens.append(n)
            cur_count += n + (sep_tokens if len(cur_text_parts) > 1 else 0)
    flush()
    return packed


# ═══════════════════════════════════════════════════════════════════════════
# TYPE W — Word-books (poetry forms, emotional registers, ordinary-world
#          vocabulary, marketplace primers). Noun/register CPT substrate.
#          Lives OUTSIDE scheme-books/, so book_extractor never sees it.
#          Honors :training-eligible + :confidentiality gates. No fabrication.
# ═══════════════════════════════════════════════════════════════════════════

WORDBOOKS_ROOT = REPO / "word-books"


def _iter_wordbook_paragraphs() -> Iterator[tuple[str, str]]:
    from sexpr_reader import iter_top_level_forms, read_field
    for path in sorted(WORDBOOKS_ROOT.glob("book-of-*/*.book.slatl")):
        try:
            forms = list(iter_top_level_forms(path, prefix="(chapter"))
        except Exception:
            continue
        for raw in forms:
            if read_field(raw, "training-eligible") == "#f":
                continue
            conf = read_field(raw, "confidentiality")
            if conf and conf != "public":
                continue
            prose = read_field(raw, "prose") or ""
            if not prose:
                continue
            rel = str(path).replace(str(REPO) + "/", "")
            prose_only = CODE_FENCE_RE.sub("", prose)
            # drop leading YAML front-matter fence some chapters embed
            prose_only = re.sub(r"^---\n.*?\n---\n", "", prose_only, flags=re.DOTALL)
            prose_only = re.sub(r"^\s*;\s?", "", prose_only, flags=re.MULTILINE)
            for para in prose_only.split("\n\n"):
                para = para.strip()
                if not para:
                    continue
                if para.startswith(("──", "===", "---", "***", "#", "|",
                                    "slug:", "title:", "book:", "part:",
                                    "palette:", "owner:", "status:",
                                    "philosopher-lens:", "last-reviewed:")):
                    continue
                if _approx_tokens(para) < _MIN_PARAGRAPH_TOKENS:
                    continue
                if len(para) > _MAX_PARAGRAPH_CHARS:
                    para = para[:_MAX_PARAGRAPH_CHARS].rsplit(" ", 1)[0] + "…"
                yield rel, para


def emit_type_W_wordbooks():
    for rel, para in _iter_wordbook_paragraphs():
        qwen_header, qwen_tag = _qwen_header(rel)
        base = dict(dialect="motoi", substrate="word-book", book="book-of-words",
                    material="prose")
        base["book-type"] = "prose"
        yield _rec(
            f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S19", **{
                "cpt-shape-name": "prose-register", "speech-act": "assertive",
                "mode": "narrative", "audience": "adult"}) +
            f" {_prov(rel)}" +
            f"\n\n{para}",
            {"type": "W", "shape": "S19", "substrate": "word-book"})


# ═══════════════════════════════════════════════════════════════════════════
# TYPE LE — Language-engineering prose: how the language / Scheme works.
#           Read-only prose extraction from the eng-doc string fields.
#           NEVER rendered (no eng-doc renderer). Prose only; code/paths/
#           flowcharts filtered out.
# ═══════════════════════════════════════════════════════════════════════════

LANG_ENG_DOCS = [
    "engineering/motoi-eng/LANG-ENGINEERING-1.0.ENG.slat",
]

# Capture ALL prose-bearing string fields, including the `:source` of
# text-lang exposition blocks (where the SRFI-behavior / language-internals
# write-ups live). Code / flowchart `:source` blocks are dropped by the
# content filters below. Alfred: "All text. Alllllll."
_ENG_PROSE_STR_RE = re.compile(
    r':(?:prose|body|text|note|summary|explanation|rationale|intro|'
    r'caption|source|description|detail|para)\s+'
    r'"((?:[^"\\]|\\.)*)"', re.DOTALL)


def emit_type_LE_langeng():
    for rel in LANG_ENG_DOCS:
        p = REPO / rel
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        seen: set[str] = set()
        for m in _ENG_PROSE_STR_RE.finditer(text):
            s = m.group(1)
            s = s.replace('\\n', '\n').replace('\\"', '"').replace('\\t', '\t')
            for para in s.split("\n\n"):
                para = para.strip()
                if not para or para in seen:
                    continue
                if para.startswith(("(", "[FLOW", "┌", "│", "└", "├", "```")):
                    continue
                # Alfred: NOTHING named Sakura in the Motoi fold. Drop any
                # paragraph that mentions the sister dialect / persona.
                if re.search(r'sakura', para, re.IGNORECASE):
                    continue
                # Non-prose scaffolding: flow diagrams (arrows / box-drawing
                # anywhere), and Markdown TOC anchor lists.
                if any(ch in para for ch in ("↓", "├", "└", "│", "┌", "→", "⟶")):
                    continue
                if "](#" in para:                  # TOC / anchor list → skip
                    continue
                if para.count("/") > 8:            # path-heavy → structural, skip
                    continue
                letters = sum(c.isalpha() for c in para)
                if letters < len(para) * 0.55:     # code/tables → skip
                    continue
                if _approx_tokens(para) < _MIN_PARAGRAPH_TOKENS:
                    continue
                seen.add(para)
                if len(para) > _MAX_PARAGRAPH_CHARS:
                    para = para[:_MAX_PARAGRAPH_CHARS].rsplit(" ", 1)[0] + "…"
                qwen_header, qwen_tag = _qwen_header(rel)
                base = dict(dialect="motoi", substrate="lang-eng",
                            material="engineering")
                yield _rec(
                    f"{qwen_header}\n" + qwen_tag + " " + _tag(**base, shape="S16", **{
                        "cpt-shape-name": "engineering-exposition",
                        "speech-act": "assertive", "mode": "expository",
                        "audience": "programmer"}) +
                    f" {_prov(rel)}" +
                    f"\n\n{para}",
                    {"type": "LE", "shape": "S16", "substrate": "lang-eng"})


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

EMITTERS = [
    ("H", emit_type_H_reference),
    ("HP", emit_type_HP_reference_programs),
    ("E-book", emit_book_shapes),
    ("W", emit_type_W_wordbooks),
    ("LE", emit_type_LE_langeng),
    ("L", emit_type_L_carts),
    ("I", emit_type_I_identity),
    ("J", emit_type_J_doctrine),
    ("K", emit_type_K_weave),
    ("M", emit_type_M_cart_fim),
    ("N", emit_type_N_graph_tags),
    ("G-graph", emit_graph_shapes_S20_S23),
    ("F", emit_type_F_lib_runtime),
    ("HN", emit_honest_nulls),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="emit to --out only; skip split, packing, and Mk2 fold-in")
    ap.add_argument("--limit", type=int, default=None,
                    help="cap total docs emitted (for smoke test)")
    ap.add_argument("--out", type=Path, default=None,
                    help="dry-run output file (JSONL)")
    ap.add_argument("--skip-packing", action="store_true",
                    help="emit train/valid but skip packed .arrow")
    ap.add_argument("--skip-mk2-fold", action="store_true",
                    help="don't merge Mk 2 corpus into output")
    args = ap.parse_args()

    print("=== Mk 3 CPT emit v5 — defect-fix pass ===\n")

    counters: Counter = Counter()
    shape_dist: Counter = Counter()
    speech_dist: Counter = Counter()
    substrate_dist: Counter = Counter()
    new_records: list[dict] = []

    print("Step 1: emitting all types...")
    stopped_early = False
    for tag, fn in EMITTERS:
        if stopped_early:
            break
        for r in fn():
            new_records.append(r)
            counters[tag] += 1
            substrate_dist[r.get("substrate", "?")] += 1
            txt = r["text"]
            sm = re.search(r'\[shape:(\S+)\]', txt)
            if sm:
                shape_dist[sm.group(1)] += 1
            spm = re.search(r'\[speech-act:(\S+)\]', txt)
            if spm:
                speech_dist[spm.group(1)] += 1
            if args.limit and len(new_records) >= args.limit:
                stopped_early = True
                break
        print(f"  type-{tag}: {counters[tag]:,}")

    print(f"\n  Total new records: {len(new_records):,}")

    # ── Fold-time Sakura guard (belt-and-suspenders) ─────────────────────
    # Motoi is the base dialect; NOTHING named Sakura enters Motoi's training
    # fold (Alfred 2026-07-27: "No Sakura references. Fix once and for all").
    # The canonical source has been migrated Sakura->Motoi in place; this
    # guard is the safety net that drops any record whose emitted text still
    # carries the word `sakura` (any case) — sister-dialect CLI, persona name,
    # dialect-verb prose, stragglers. Source is fixed; this guarantees the
    # fold is provably clean even if a prose straggler remains mid-migration.
    _DIALECT_RE = re.compile(r'sakura', re.IGNORECASE)
    before = len(new_records)
    dropped_dialect: Counter = Counter()
    kept: list[dict] = []
    for r in new_records:
        if _DIALECT_RE.search(r.get("text", "")):
            dropped_dialect[r.get("type", "?")] += 1
            continue
        kept.append(r)
    new_records = kept
    n_dropped = before - len(new_records)
    if n_dropped:
        print(f"\n  Sakura guard: dropped {n_dropped} record(s) still "
              f"referencing 'sakura' → {dict(dropped_dialect)}")

    print("\nStep 2: injecting [bloom:...] tags...")
    new_records = _inject_bloom_tag(new_records)

    # DRY RUN — just write and report
    if args.dry_run:
        out_path = args.out or Path("/tmp/mk3-dryrun.jsonl")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            for r in new_records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n=== Dry run complete ===")
        print(f"  Wrote {len(new_records):,} records → {out_path}")
        _print_stats(counters, shape_dist, speech_dist, substrate_dist, new_records)
        return

    # PRODUCTION — Mk2 fold + stratified split + packing
    if not args.skip_mk2_fold and OLD_CORPUS.exists():
        print("\nStep 3: folding in Mk 2 corpus...")
        mk2_records: list[dict] = []
        mk2_sakura_dropped = 0
        for src in [OLD_CORPUS / "train.jsonl", OLD_CORPUS / "valid.jsonl"]:
            if not src.exists():
                continue
            with src.open() as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    # The Mk 2 corpus predates the Sakura scrub. Run it through
                    # the SAME guard the new records passed — otherwise legacy
                    # sakura prose would re-enter the fold behind the guard
                    # (Alfred: "No Sakura references. Fix once and for all").
                    if _DIALECT_RE.search(d.get("text", "")):
                        mk2_sakura_dropped += 1
                        continue
                    d.setdefault("type", "mk2-legacy")
                    d.setdefault("substrate", "mk2-legacy")
                    mk2_records.append(d)
        if mk2_sakura_dropped:
            print(f"  Sakura guard (Mk 2 legacy): dropped {mk2_sakura_dropped} record(s)")
        print(f"  Mk 2 folded: {len(mk2_records):,}")
        all_records = new_records + mk2_records
    else:
        all_records = list(new_records)

    print(f"\nStep 4: stratified 98/2 split by (type, substrate)...")
    train, val = _stratified_split(all_records, val_frac=0.02, seed=13)
    print(f"  train: {len(train):,}    valid: {len(val):,}")

    MK3_CPT_DIR.mkdir(parents=True, exist_ok=True)
    MK3_MIRROR_DIR.mkdir(parents=True, exist_ok=True)

    def _dump(path: Path, records: list[dict]):
        with path.open("w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    _dump(MK3_CPT_DIR / "train.jsonl", train)
    _dump(MK3_CPT_DIR / "valid.jsonl", val)
    # Mirror header only (pointer file — full data is single-source at MK3_CPT_DIR)
    (MK3_MIRROR_DIR / "SOURCE.txt").write_text(
        f"Canonical CPT data lives at:\n  {MK3_CPT_DIR}\n\n"
        f"This mirror is intentionally empty — preflight resolves paths via "
        f"MK3_CPT_DIR imported from scripts/cpt-prep/emit_cpt_v5.py.\n",
        encoding="utf-8",
    )

    if not args.skip_packing:
        print(f"\nStep 5: packing train sequences at 2048 tokens...")
        packed_train = _pack_sequences(train, target_tokens=2048)
        packed_val = _pack_sequences(val, target_tokens=2048)
        # Write packed JSONL (Arrow conversion is trainer's job)
        _dump(MK3_CPT_DIR / "train-packed.jsonl", packed_train)
        _dump(MK3_CPT_DIR / "valid-packed.jsonl", packed_val)
        avg_docs_per_pack = (
            sum(p["n_docs"] for p in packed_train) / len(packed_train)
            if packed_train else 0
        )
        print(f"  train-packed: {len(packed_train):,} sequences  "
              f"(avg {avg_docs_per_pack:.1f} docs/pack)")
        print(f"  valid-packed: {len(packed_val):,} sequences")

    print(f"\n=== Mk 3 CPT corpus v5 ===")
    print(f"  new records:          {len(new_records):,}")
    print(f"  total (with Mk 2):    {len(all_records):,}")
    print(f"  train.jsonl:          {len(train):,}")
    print(f"  valid.jsonl:          {len(val):,}")
    print(f"\n  Output: {MK3_CPT_DIR}")
    _print_stats(counters, shape_dist, speech_dist, substrate_dist, new_records)


def _print_stats(counters, shape_dist, speech_dist, substrate_dist, new_records):
    print(f"\n=== Type distribution ===")
    for t, c in counters.most_common():
        print(f"  {t:12} {c:>7,}")

    print(f"\n=== Substrate distribution ===")
    for s, c in substrate_dist.most_common(20):
        print(f"  {s:24} {c:>7,}")

    print(f"\n=== Shape distribution ===")
    for s, c in shape_dist.most_common(40):
        print(f"  {s:26} {c:>7,}")

    print(f"\n=== Speech-act distribution ===")
    for s, c in speech_dist.most_common():
        print(f"  {s:16} {c:>7,}")

    bloom_dist = Counter()
    for d in new_records:
        b = d.get("bloom")
        if b:
            bloom_dist[b] += 1
    total_bloom = sum(bloom_dist.values())
    print(f"\n=== Bloom distribution ===")
    for b, c in bloom_dist.most_common():
        pct = 100 * c / total_bloom if total_bloom else 0
        print(f"  {b:12} {c:>7,}  ({pct:.1f}%)")


if __name__ == "__main__":
    main()
