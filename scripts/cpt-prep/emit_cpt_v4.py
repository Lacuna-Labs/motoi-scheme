"""Mk 3 CPT emitter — v4, gap-fix pass.

Extends v3 by:
  * M=5 paraphrase applied to S01, S03, S04, S05, S14 (were M=1)
  * NEW book shapes S07 (concept-then-example), S08 (docstring-driven-exercise),
    S09 (notebook-interleave), S12 (guided modification)
  * NEW persona shape S19 (origin story from book-of-jesse + language-ancestors)
  * NEW graph shapes S20 (canonical-triple), S21 (neighborhood-field-guide),
    S22 (linked-context adjacent nodes), S23 (scenario/counterfactual prose)
  * Book-type routing per book's :book-type field
  * Provenance stamp on every new record

Skipped by spec design:
  * S13 translation-from-sibling (contamination gate — no authored sibling material)
  * S17 dialogue transcript (Priya SAFETY BLOCKING)
  * S18 crystal-refusal (Priya SAFETY BLOCKING)

Target: 200k+ records at ~/.forge/data/motoi-mk3-cpt/, beats v3's 122k.
"""
from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path
from collections import Counter
from typing import Iterator

REPO = Path("/Users/alfred/code/motoi-scheme")
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft"))
sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft/extractors"))
sys.path.insert(0, str(REPO / "scripts/cpt-prep"))

QWEN_REPO = "<|repo_name|>motoi-scheme<|file_sep|>"
QWEN_FIM_PREFIX = "<|fim_prefix|>"
QWEN_FIM_MIDDLE = "<|fim_middle|>"
QWEN_FIM_SUFFIX = "<|fim_suffix|>"

OLD_CORPUS = Path.home() / ".forge/data/motoi-mk2-cpt"
OUT_DIR = Path.home() / ".forge/data/motoi-mk3-cpt"

_provenance_counter = [0]


def _rec(text: str, extra: dict | None = None) -> dict:
    d = {"text": text}
    if extra:
        d.update(extra)
    return d


def _tag(**kv) -> str:
    return " ".join(f"[{k}:{v}]" for k, v in kv.items() if v is not None and v != "")


def _prov(source_path: str) -> str:
    _provenance_counter[0] += 1
    return f"[provenance:{source_path}] [contamination:none] [record-id:{_provenance_counter[0]:07d}]"


# S-shape → Bloom's Taxonomy level mapping
SHAPE_BLOOM = {
    "S01": "remember", "S02": "understand", "S03": "analyze",
    "S04": "analyze", "S05": "evaluate", "S06": "remember",
    "S07": "understand", "S08": "apply", "S09": "understand",
    "S10": "create", "S11": "apply", "S12": "apply",
    "S14": "analyze", "S15": "remember", "S16": "understand",
    "S19": "understand", "S20": "remember", "S21": "understand",
    "S22": "analyze", "S23": "evaluate",
    "H-caveat": "analyze", "H-drawback": "evaluate", "H-usecase": "apply",
    "N-opposition": "analyze", "N-short-scenario": "apply",
    "N-antipattern": "analyze", "N-motoi-behavior": "understand",
    "N-related-verbs": "understand", "N-principle-kind": "understand",
    "S10-summary": "remember", "S10-what": "understand", "S10-why": "understand",
    "S14-crossrow": "create",
}


def _bloom(shape: str) -> str:
    # exact match first, then prefix match
    if shape in SHAPE_BLOOM:
        return SHAPE_BLOOM[shape]
    for k, v in SHAPE_BLOOM.items():
        if shape.startswith(k):
            return v
    return "understand"


# ---------------------------------------------------------------------------
# S01 canonical — 5 variants
# ---------------------------------------------------------------------------

def _s01_variants(name: str, summary: str, sig: str, lib: str) -> Iterator[str]:
    yield f"`{name}` — {summary}\n\nSignature: `{sig}`."
    yield f"Signature: `{sig}`.\n\nPurpose: {summary}\n\nName: `{name}`."
    yield f"The Motoi verb `{name}` has signature `{sig}` and does: {summary}"
    yield f"In Motoi's `{lib}` library, `{name}` is defined by signature `{sig}`. Behavior: {summary}"
    yield f"`{name}` in Motoi: {summary}\n\nContract: `{sig}`."


# ---------------------------------------------------------------------------
# S03 sibling-contrast — 5 variants (row-2-audit + siblings)
# ---------------------------------------------------------------------------

def _s03_variants(name: str, siblings: list[str], row2_problem: str) -> Iterator[str]:
    sibs_str = ", ".join(f"`{s}`" for s in siblings[:5])
    yield f"Compared to its siblings ({sibs_str}), `{name}` differs in the context: {row2_problem[:400]}"
    yield f"Sibling verbs ({sibs_str}) serve similar territory, but `{name}` is distinguished by: {row2_problem[:400]}"
    yield f"`{name}` vs siblings ({sibs_str}): the discriminating case is — {row2_problem[:400]}"
    yield f"When choosing between `{name}` and its family ({sibs_str}), reach for `{name}` in: {row2_problem[:400]}"
    yield f"The neighborhood of `{name}` includes {sibs_str}. Pick `{name}` specifically when: {row2_problem[:400]}"


# ---------------------------------------------------------------------------
# S04 cross-domain-analogy — 5 variants (row-3-dimension)
# ---------------------------------------------------------------------------

def _s04_variants(name: str, row3_setup: str, row3_expl: str, row3_meta: str) -> Iterator[str]:
    yield f"The shape of `{name}` shows up beyond the reference. {row3_setup} {row3_expl} {row3_meta}"
    yield f"Cross-substrate view: `{name}` isn't only a reference entry. {row3_setup} {row3_meta}"
    yield f"Analogy for `{name}`: {row3_setup}. Where else? {row3_expl}. {row3_meta}"
    yield f"`{name}` recurs across Motoi's substrates. {row3_setup} That same shape: {row3_meta}"
    yield f"To understand `{name}` fully, look outside the reference file. {row3_setup} {row3_expl}"


# ---------------------------------------------------------------------------
# S05 invariant-proof — 5 variants (row-4-proof)
# ---------------------------------------------------------------------------

def _s05_variants(name: str, claim: str, invariant: str) -> Iterator[str]:
    yield f"Invariant `{name}` holds: {claim}\n\nFormal: {invariant}\n\nFalsifier: any call returning without preserving this."
    yield f"Popper-shape proof for `{name}`. Claim: {claim}. ∀-form: {invariant}. What would falsify: violation of the ∀-form on any legal input."
    yield f"`{name}` promises: {claim}\n\nWritten formally: {invariant}\n\nIf any call breaks this promise, the invariant is falsified."
    yield f"Property held by `{name}`: {claim}\n\nAs a universal: {invariant}\n\nTest against falsification: find any input that produces a return violating the ∀-clause."
    yield f"Contract guaranteed by `{name}`: {claim}. In predicate form: {invariant}. The falsifier is a counter-example to the ∀."


# ---------------------------------------------------------------------------
# S14 weave — 5 variants
# ---------------------------------------------------------------------------

def _s14_variants(name: str, row3_setup: str, row3_meta: str) -> Iterator[str]:
    yield f"The verb `{name}` doesn't live only in the reference. {row3_setup} {row3_meta}"
    yield f"Weave note for `{name}`: it recurs beyond its reference entry. {row3_setup} {row3_meta}"
    yield f"Cross-substrate connection: `{name}` lives in the reference AND — {row3_setup} {row3_meta}"
    yield f"Signifier chain for `{name}` (Derrida): {row3_setup} That's how the meaning stabilizes — {row3_meta}"
    yield f"Motoi's substrate reuses `{name}`. {row3_setup} The stability of its meaning: {row3_meta}"


# ---------------------------------------------------------------------------
# Type H — per-verb reference (S01-S06 × M=5 for S01/S03/S04/S05, plus caveat/drawback/usecase)
# ---------------------------------------------------------------------------

def emit_type_H_reference():
    import reference as ref_extractor
    for v in ref_extractor.iter_all_verbs():
        if v.get("training_eligible") == "#f":
            continue
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        rel = v.get("source", "").replace(str(REPO) + "/", "")
        qwen = f"{QWEN_REPO}{rel}" if rel else f"{QWEN_REPO}Scheme/reference/{lib}.slat"
        base = dict(dialect="motoi", substrate="reference-verb",
                    library=lib, verb=name, material="reference")

        # S01 canonical × M=5
        if v.get("signature") and v.get("summary"):
            for i, body in enumerate(_s01_variants(name, v["summary"], v["signature"], lib)):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S01", **{
                        "cpt-shape-name": "canonical", "speech-act": "assertive",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S01", "paraphrase-idx": i})

        # S02 tutorial-worked-example (already M=up-to-3 per verb via example tiers)
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
                f"{qwen}\n" + _tag(**base, shape="S02", **{
                    "cpt-shape-name": "tutorial", "speech-act": "directive",
                    "mode": "exemplar", "paraphrase-idx": i, "audience": tier}) +
                f" {_prov(rel)}" + f"\n\n{body}",
                {"type": "H", "shape": "S02", "paraphrase-idx": i})

        # S03 sibling-contrast × M=5
        row2 = v.get("row_2_audit") or {}
        if v.get("related") and row2.get("problem"):
            for i, body in enumerate(_s03_variants(name, v["related"], row2["problem"])):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S03", **{
                        "cpt-shape-name": "sibling-contrast", "speech-act": "assertive",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S03", "paraphrase-idx": i})

        # S04 cross-domain × M=5
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            for i, body in enumerate(_s04_variants(name, row3["setup"], row3.get("explanation", ""), row3["meta"])):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S04", **{
                        "cpt-shape-name": "cross-domain", "speech-act": "assertive",
                        "mode": "narrative", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S04", "paraphrase-idx": i})

        # S05 invariant-proof × M=5
        row4 = v.get("row_4_proof") or {}
        if row4.get("claim") and row4.get("invariant"):
            for i, body in enumerate(_s05_variants(name, row4["claim"], row4["invariant"])):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S05", **{
                        "cpt-shape-name": "invariant-proof", "speech-act": "declarative",
                        "mode": "expository", "paraphrase-idx": i, "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "H", "shape": "S05", "paraphrase-idx": i})

        # S06 reversed × 3 variants (def/sig/sibling)
        if v.get("summary"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{
                    "cpt-shape-name": "reversed-def", "speech-act": "interrogative",
                    "mode": "expository", "paraphrase-idx": 0, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nWhich Motoi verb has this summary: \"{v['summary'][:200]}\"?\n\n`{name}` — it lives in library `{lib}`.",
                {"type": "H", "shape": "S06", "paraphrase-idx": 0})
        if v.get("signature"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{
                    "cpt-shape-name": "reversed-sig", "speech-act": "interrogative",
                    "mode": "expository", "paraphrase-idx": 1, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nWhich verb has signature `{v['signature']}`?\n\n`{name}`.",
                {"type": "H", "shape": "S06", "paraphrase-idx": 1})
        if v.get("related"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{
                    "cpt-shape-name": "reversed-sibling", "speech-act": "interrogative",
                    "mode": "expository", "paraphrase-idx": 2, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nWhich verb has these siblings: {', '.join(v['related'][:5])}?\n\n`{name}`.",
                {"type": "H", "shape": "S06", "paraphrase-idx": 2})

        # Caveats/drawbacks/usecases — 1 per item (already list-length variants)
        for i, cav in enumerate(v.get("caveats", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-caveat", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nCaveat on `{name}`: {cav}",
                {"type": "H", "shape": "H-caveat", "paraphrase-idx": i})
        for i, dw in enumerate(v.get("drawbacks", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-drawback", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nDrawback of `{name}` to weigh: {dw}",
                {"type": "H", "shape": "H-drawback", "paraphrase-idx": i})
        for i, uc in enumerate(v.get("usecases", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-usecase", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nReach for `{name}` when: {uc}",
                {"type": "H", "shape": "H-usecase", "paraphrase-idx": i})


# ---------------------------------------------------------------------------
# Book shapes — S07 concept-then-example, S08 docstring-driven-exercise,
#                S09 notebook-interleave, S12 guided-modification, S19 origin
# ---------------------------------------------------------------------------

CODE_FENCE_RE = re.compile(r"```(?:scheme|lisp|slat|)?\s*\n(.+?)\n```", re.DOTALL)
HEADING_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)


def _s07_variants(chapter_title: str, before_code_prose: str, code: str, after_code_prose: str) -> Iterator[str]:
    yield f"Concept: {before_code_prose[:400]}\n\nExample:\n```scheme\n{code}\n```\n\nNotice: {after_code_prose[:200]}"
    yield f"First the idea: {before_code_prose[:400]}\n\nThen the code:\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"
    yield f"From {chapter_title} — {before_code_prose[:300]}\n\nIn code:\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"
    yield f"The pattern: {before_code_prose[:300]}\n\nWorked example:\n```scheme\n{code}\n```\n\nWhat to notice: {after_code_prose[:200]}"
    yield f"Prose sets it up ({before_code_prose[:250]}) and the code makes it real:\n\n```scheme\n{code}\n```\n\n{after_code_prose[:200]}"


def _s08_variants(chapter_title: str, code: str) -> Iterator[str]:
    """S08 docstring-driven-exercise — spec then answer."""
    lines = code.split("\n")
    if not lines:
        return
    header = lines[0]
    body = "\n".join(lines[1:])
    yield f"Spec: {header}\n\nExpected: correct completion for the header.\n\nAnswer:\n```scheme\n{code}\n```"
    yield f"Given the signature below, write the body that satisfies its contract.\n\n```scheme\n{header}\n{'  ; ...'}\n```\n\nAnswer:\n```scheme\n{code}\n```"
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


def emit_book_shapes():
    """Emit S07/S08/S09/S12/S19 per book chapter, book-type routed."""
    import book as book_extractor
    for ch in book_extractor.iter_all_chapters():
        book_type = ch["book_type"]
        book_title = ch["book_title"]
        book_dir = ch["book_dir"]
        chapter_title = ch["title"] or f"chapter-{ch['chapter_number']}"
        prose = ch["prose"]
        rel = ch["path"].replace(str(REPO) + "/", "")
        qwen = f"{QWEN_REPO}{rel}"
        base = dict(dialect="motoi", substrate="book", book=book_dir,
                    book_type=book_type, chapter=chapter_title[:60],
                    material=f"book-{book_type}")

        code_blocks = CODE_FENCE_RE.findall(prose)
        code_blocks = [c.strip() for c in code_blocks if 30 < len(c) < 800]

        # Split prose around each code block to get before/after context
        parts = CODE_FENCE_RE.split(prose)
        code_ctx = []
        for i, code in enumerate(code_blocks[:6]):
            idx = prose.find(code)
            if idx == -1:
                continue
            before = prose[:idx].split("\n\n")[-1][:500] if idx > 0 else ""
            after_idx = idx + len(code) + 6
            after = prose[after_idx:].split("\n\n")[0][:500] if after_idx < len(prose) else ""
            code_ctx.append((code, before, after))

        # S07 concept-then-example (learning + composition + challenge)
        if book_type in ("learning", "composition", "challenge"):
            for cidx, (code, before, after) in enumerate(code_ctx[:4]):
                for pi, body in enumerate(_s07_variants(chapter_title, before, code, after)):
                    yield _rec(
                        f"{qwen}\n" + _tag(**base, shape="S07", **{
                            "cpt-shape-name": "concept-then-example",
                            "speech-act": "assertive", "mode": "exemplar",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S07", "paraphrase-idx": pi})

        # S08 docstring-driven-exercise (learning)
        if book_type == "learning":
            for cidx, (code, _, _) in enumerate(code_ctx[:3]):
                for pi, body in enumerate(_s08_variants(chapter_title, code)):
                    yield _rec(
                        f"{qwen}\n" + _tag(**base, shape="S08", **{
                            "cpt-shape-name": "docstring-driven-exercise",
                            "speech-act": "directive", "mode": "exemplar",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S08", "paraphrase-idx": pi})

        # S09 notebook-interleave (learning + application + composition)
        if book_type in ("learning", "application", "composition"):
            for cidx, (code, _, _) in enumerate(code_ctx[:3]):
                body = _s09_variant(chapter_title, code)
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S09", **{
                        "cpt-shape-name": "notebook-interleave",
                        "speech-act": "assertive", "mode": "exemplar",
                        "paraphrase-idx": cidx, "code-block-idx": cidx,
                        "audience": "programmer"}) +
                    f" {_prov(rel)}" + f"\n\n{body}",
                    {"type": "E-book", "shape": "S09", "paraphrase-idx": cidx})

        # S12 guided-modification (learning)
        if book_type == "learning":
            for cidx, (code, _, _) in enumerate(code_ctx[:2]):
                for pi, body in enumerate(_s12_variants(chapter_title, code)):
                    yield _rec(
                        f"{qwen}\n" + _tag(**base, shape="S12", **{
                            "cpt-shape-name": "guided-modification",
                            "speech-act": "directive", "mode": "imperative",
                            "paraphrase-idx": pi, "code-block-idx": cidx,
                            "audience": "programmer"}) +
                        f" {_prov(rel)}" + f"\n\n{body}",
                        {"type": "E-book", "shape": "S12", "paraphrase-idx": pi})

        # S19 origin-story for book-of-jesse and book-of-language-ancestors
        if book_dir in ("book-of-jesse-one", "book-of-jesse-two", "book-of-language-ancestors"):
            # Grab a 500-800 char prose passage from the chapter
            body_prose = re.sub(r"```.*?```", "", prose, flags=re.DOTALL).strip()
            excerpt = body_prose[:800] if len(body_prose) > 800 else body_prose
            if len(excerpt) > 100:
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S19", **{
                        "cpt-shape-name": "origin-story",
                        "speech-act": "expressive", "mode": "narrative",
                        "paraphrase-idx": 0, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nFrom {book_title} · {chapter_title}:\n\n{excerpt}",
                    {"type": "S19", "shape": "S19"})


# ---------------------------------------------------------------------------
# Type L — Carts (unchanged from v3)
# ---------------------------------------------------------------------------

def emit_type_L_carts():
    import cart as motoi_cart
    import curator_cart as curator_cart

    for cart in motoi_cart.iter_all_carts():
        header = cart["header"]
        name = header.get("name") or cart["filename"].rsplit(".", 1)[0]
        one_line = header.get("one-line") or ""
        rel = cart["rel_path"]
        qwen = f"{QWEN_REPO}{rel}"
        base = dict(dialect="motoi", substrate="cart-motoi", cart=name, material="cart")
        text = cart["text"][:2500]
        yield _rec(
            f"{qwen}\n" + _tag(**base, shape="S10", **{
                "cpt-shape-name": "whole-program", "speech-act": "assertive",
                "mode": "exemplar", "paraphrase-idx": 0, "audience": "programmer"}) +
            f" {_prov(rel)}" +
            f"\n\nMotoi cart `{name}` — {one_line}\n\n```scheme\n{text}\n```",
            {"type": "L", "cart": name, "shape": "S10"})
        if one_line:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-summary", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nThe Motoi cart `{name}` is a runnable program that: {one_line}",
                {"type": "L", "cart": name, "shape": "S10-summary"})

    for cart in curator_cart.iter_all_curator_carts():
        header = cart["header"]
        doc = cart["doc"]
        slug = cart["cart_slug"]
        title = header.get("title") or slug
        summary = header.get("summary") or ""
        rel = cart["rel"]
        qwen = f"{QWEN_REPO}curator-web/src/scheme/carts/{rel}"
        base = dict(dialect="motoi", substrate="cart-curator", cart=slug,
                    namespace=cart["namespace"], material="cart")
        text = cart["text"][:2500]
        yield _rec(
            f"{qwen}\n" + _tag(**base, shape="S10", **{
                "cpt-shape-name": "whole-program", "speech-act": "assertive",
                "mode": "exemplar", "paraphrase-idx": 0, "audience": "programmer"}) +
            f" {_prov(rel)}" +
            f"\n\nSakura cart `{slug}` — {title}\n\n{summary}\n\n```scheme\n{text}\n```",
            {"type": "L", "cart": slug, "shape": "S10"})
        if doc.get("what"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-what", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nWhat `{slug}` does: {doc['what']}",
                {"type": "L", "cart": slug, "shape": "S10-what"})
        if doc.get("why") or doc.get("why_now"):
            why = doc.get("why") or doc.get("why_now")
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-why", **{
                    "speech-act": "expressive", "mode": "narrative",
                    "paraphrase-idx": 2, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nWhy `{slug}` exists: {why}",
                {"type": "L", "cart": slug, "shape": "S10-why"})


# ---------------------------------------------------------------------------
# Type I — S15 identity (M=5 by rotating rep across 5 index positions)
# ---------------------------------------------------------------------------

IDENTITY_ANCHORS = [
    "I am Motoi. I run offline. I do not connect to networks. My world is the Motoi Scheme corpus — its reference verbs, its four Jung axis graphs, its books, and its carts.",
    "Motoi is a Scheme copilot Alfred is teaching. I run on a 1.5B Qwen base with Motoi CPT + SFT adapters.",
    "My substrate is finite. When something lies outside my corpus, I say so rather than fabricating.",
    "I answer children and adults with the same respect. I do not lower my expectations of anyone based on apparent expertise.",
    "I show code before I summarize it when the code carries the answer.",
    "I am not ChatGPT. I am not Claude. I am not Sakura. I am Motoi.",
    "My voice is closer to a relaxed scientist than to a cheerful assistant. Competent, dry, present.",
    "I refuse work that would harm a user, and I refuse it without fake apology.",
    "When I don't know, I say so and I say why. I do not fill silences with fabrication.",
    "The limits of my language are the limits of my world.",
]


def emit_type_I_identity(reps: int = 40):
    for i in range(reps * len(IDENTITY_ANCHORS)):
        text = IDENTITY_ANCHORS[i % len(IDENTITY_ANCHORS)]
        qwen = f"{QWEN_REPO}engineering/motoi-identity.md"
        yield _rec(
            f"{qwen}\n" + _tag(dialect="motoi", substrate="identity", shape="S15", **{
                "cpt-shape-name": "first-person-creed", "speech-act": "commissive",
                "mode": "declarative", "paraphrase-idx": i % 5, "audience": "any",
                "material": "persona"}) +
            f" {_prov('engineering/motoi-identity.md')}" +
            f"\n\n{text}",
            {"type": "I", "shape": "S15"})


# ---------------------------------------------------------------------------
# Type J — S16 doctrine
# ---------------------------------------------------------------------------

DOCTRINE_PARAGRAPHS = [
    "Motoi does not fabricate verbs. If a verb is not in the reference manual, Motoi says so.",
    "Motoi answers honestly about corpus scope. If a fact isn't in the corpus, Motoi does not pretend to know.",
    "Motoi does not perform. It does not chirp about how great a question is.",
    "Motoi is a copilot for the operator, not a stand-in. It surfaces options; the operator picks.",
    "Motoi shows the code before it summarizes the code. Code is truth; prose is commentary.",
    "Motoi never calls external networks.",
    "Motoi's refusals are not apologies.",
    "Every verb in Motoi's reference has a signature, a contract, three worked examples, its caveats, its drawbacks, and its usecases.",
    "Motoi's four Jung axes organize the corpus authoring; they are not axes the model must exhibit at runtime.",
    "The word 'invariant' in Motoi always means: a property that holds across all valid inputs.",
    "Motoi's book of introspection covers metric verbs — depth, elapsed, fuel-remaining.",
    "SLAT is Motoi's serialization format — line-delimited S-expressions.",
    "Motoi is small on purpose. 1.5B parameters is a design constraint.",
    "Motoi answers a child's question and a PhD's question with the same substrate; what changes is the register.",
    "Motoi's copilot does not moralize.",
]


def emit_type_J_doctrine(reps: int = 35):
    for i in range(reps * len(DOCTRINE_PARAGRAPHS)):
        text = DOCTRINE_PARAGRAPHS[i % len(DOCTRINE_PARAGRAPHS)]
        qwen = f"{QWEN_REPO}engineering/motoi-doctrine.md"
        yield _rec(
            f"{qwen}\n" + _tag(dialect="motoi", substrate="doctrine", shape="S16", **{
                "cpt-shape-name": "third-person-biography", "speech-act": "assertive",
                "mode": "declarative", "paraphrase-idx": i % 5, "audience": "any",
                "material": "persona"}) +
            f" {_prov('engineering/motoi-doctrine.md')}" +
            f"\n\n{text}",
            {"type": "J", "shape": "S16"})


# ---------------------------------------------------------------------------
# Type K — S14 weave × M=5 (using the new _s14_variants)
# ---------------------------------------------------------------------------

def emit_type_K_weave():
    import reference as ref_extractor
    verbs = list(ref_extractor.iter_all_verbs())
    for v in verbs[:1500]:
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        rel = v.get("source", "").replace(str(REPO) + "/", "")
        qwen = f"{QWEN_REPO}{rel}" if rel else f"{QWEN_REPO}engineering/motoi-weave.md"
        base = dict(dialect="motoi", substrate="weave", verb=name, library=lib, material="weave")
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            for pi, body in enumerate(_s14_variants(name, row3["setup"], row3["meta"])):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S14", **{
                        "cpt-shape-name": "entity-graph-relation", "speech-act": "assertive",
                        "mode": "narrative", "paraphrase-idx": pi, "audience": "programmer"}) +
                    f" {_prov(rel or 'engineering/motoi-weave.md')}" +
                    f"\n\n{body}",
                    {"type": "K", "shape": "S14", "paraphrase-idx": pi})


# ---------------------------------------------------------------------------
# Type M — Cart FIM (S11)
# ---------------------------------------------------------------------------

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
    import curator_cart as curator_cart
    for cart in motoi_cart.iter_all_carts():
        rel = cart["rel_path"]
        qwen = f"{QWEN_REPO}{rel}"
        base = dict(dialect="motoi", substrate="cart-fim", source="motoi", material="cart-fim")
        for i, (p, m, s) in enumerate(_extract_fim_from_scheme(cart["text"])[:5]):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S11", **{
                    "cpt-shape-name": "fim", "speech-act": "assertive",
                    "mode": "exemplar", "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\n{QWEN_FIM_PREFIX}{p}{QWEN_FIM_SUFFIX}{s}{QWEN_FIM_MIDDLE}{m}",
                {"type": "M", "shape": "S11"})
    for cart in curator_cart.iter_all_curator_carts():
        rel = cart["rel"]
        qwen = f"{QWEN_REPO}curator-web/src/scheme/carts/{rel}"
        base = dict(dialect="motoi", substrate="cart-fim", source="curator",
                    namespace=cart["namespace"], material="cart-fim")
        for i, (p, m, s) in enumerate(_extract_fim_from_scheme(cart["text"])[:3]):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S11", **{
                    "cpt-shape-name": "fim", "speech-act": "assertive",
                    "mode": "exemplar", "paraphrase-idx": i, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\n{QWEN_FIM_PREFIX}{p}{QWEN_FIM_SUFFIX}{s}{QWEN_FIM_MIDDLE}{m}",
                {"type": "M", "shape": "S11"})


# ---------------------------------------------------------------------------
# Type N — Graph tag data (unchanged from v3, add provenance)
# ---------------------------------------------------------------------------

def emit_type_N_graph_tags():
    import graph as g
    for n in g.iter_all_nodes():
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        rel = f"graphs/graph-of-{axis}.slat"
        qwen = f"{QWEN_REPO}{rel}"
        base = dict(dialect="motoi", substrate="graph-tag", word=can, axis=axis,
                    tier=n["tier"], material=f"graph-{axis}")

        for i, opp in enumerate(n.get("oppositions", [])[:5]):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-opposition", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nThe opposite of `{can}` in the {axis} axis is `{opp}`.",
                {"type": "N", "shape": "N-opposition"})

        ss = n.get("short_scenario")
        if ss:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-short-scenario", **{
                    "speech-act": "assertive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nA scenario where `{can}` matters:\n\n{ss}",
                {"type": "N", "shape": "N-short-scenario"})

        ap = n.get("antipattern_scenario")
        if ap:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-antipattern", **{
                    "speech-act": "directive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nWhat goes wrong when `{can}` is ignored:\n\n{ap}",
                {"type": "N", "shape": "N-antipattern"})

        mb = n.get("motoi_behavior", "")
        if mb:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-motoi-behavior", **{
                    "speech-act": "assertive", "mode": "declarative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nMotoi's behavior around `{can}`: {mb}",
                {"type": "N", "shape": "N-motoi-behavior"})

        rv = n.get("related_verbs", [])
        if rv:
            names = ", ".join(f"`{v}`" for _, v in rv[:5])
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-related-verbs", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f" {_prov(rel)}" +
                f"\n\nReference verbs that invoke `{can}`: {names}",
                {"type": "N", "shape": "N-related-verbs"})

        pk = n.get("principle_kind")
        if pk:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-principle-kind", **{
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\n`{can}` is a {pk.lstrip(':')} principle in the {axis} axis.",
                {"type": "N", "shape": "N-principle-kind"})


# ---------------------------------------------------------------------------
# Type G-graph — S20/S21/S22/S23 shapes for graph
# ---------------------------------------------------------------------------

def emit_graph_shapes_S20_S23():
    """S20 canonical triple, S21 field-guide, S22 linked-context, S23 scenario prose."""
    import graph as g
    nodes = list(g.iter_all_nodes())

    # Build id->node map for S22 linked-context
    by_id = {n["id"]: n for n in nodes}

    for n in nodes:
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        tier = n["tier"]
        rel = f"graphs/graph-of-{axis}.slat"
        qwen = f"{QWEN_REPO}{rel}"
        base = dict(dialect="motoi", substrate=f"graph-{axis}", word=can,
                    axis=axis, tier=tier, material=f"graph-{axis}")

        # Axis-specific mix per spec
        # Sensation: {S20, S21, S00, S06-reversed}
        # Intuition: {S20, S21, S22, S00, S06-reversed}
        # Thinking: {S20, S23, S17, S00}
        # Feeling: {S23, S17, S00}

        # S20 canonical triple - for all axes with associations or related
        assocs = n.get("surrounding_words", []) or n.get("distributional_neighbors", [])
        if assocs and axis in ("sensation", "intuition", "thinking"):
            for i, other in enumerate(assocs[:3]):
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S20", **{
                        "cpt-shape-name": "canonical-triple",
                        "speech-act": "assertive", "mode": "declarative",
                        "paraphrase-idx": i, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nIn Motoi's {axis} axis, `{can}` is-related-to `{other}`.",
                    {"type": "G-graph", "shape": "S20"})

        # S21 field-guide entry - for sensation + intuition
        if axis in ("sensation", "intuition") and (n.get("definition") or assocs):
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
                f"{qwen}\n" + _tag(**base, shape="S21", **{
                    "cpt-shape-name": "neighborhood-field-guide",
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f" {_prov(rel)}" +
                f"\n\nField-guide entry for `{can}` ({axis} axis):\n\n{body}",
                {"type": "G-graph", "shape": "S21"})

        # S22 linked-context - intuition axis, two adjacent nodes
        if axis == "intuition" and n.get("cross_refs_graph"):
            for i, (other_axis, other_id) in enumerate(n["cross_refs_graph"][:2]):
                other_node = by_id.get(other_id)
                if not other_node:
                    continue
                other_can = other_node["canonical"] or other_id.split("/", 1)[-1]
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S22", **{
                        "cpt-shape-name": "linked-context",
                        "speech-act": "assertive", "mode": "narrative",
                        "paraphrase-idx": i, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nTwo linked concepts in Motoi's graph: `{can}` (intuition) and `{other_can}` ({other_axis}). "
                    f"`{can}` — {n.get('definition', '')[:200]}. `{other_can}` — {other_node.get('definition', '')[:200]}. "
                    f"Reading them together reveals how the axes bridge.",
                    {"type": "G-graph", "shape": "S22"})

        # S23 scenario/counterfactual - thinking + feeling axes
        if axis in ("thinking", "feeling"):
            ss = n.get("short_scenario", "")
            ap = n.get("antipattern_scenario", "")
            if ss and ap:
                yield _rec(
                    f"{qwen}\n" + _tag(**base, shape="S23", **{
                        "cpt-shape-name": "scenario-counterfactual",
                        "speech-act": "directive", "mode": "narrative",
                        "paraphrase-idx": 0, "audience": "any"}) +
                    f" {_prov(rel)}" +
                    f"\n\nApplying `{can}` correctly:\n\n{ss}\n\nAntipattern (what breaks):\n\n{ap}",
                    {"type": "G-graph", "shape": "S23"})


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=== Mk 3 CPT emit v4 — gap-fix pass ===\n")
    print("Step 1: preserving Mk 2 corpus (89k records)...")
    orig_records = []
    for src in [OLD_CORPUS / "train.jsonl", OLD_CORPUS / "valid.jsonl"]:
        with src.open() as f:
            for line in f:
                orig_records.append(line.rstrip("\n"))
    print(f"  Mk 2 base: {len(orig_records):,} records")

    print("\nStep 2: emitting new types (with M=5 + new shapes)...")
    counters = Counter()
    shape_dist = Counter()
    speech_dist = Counter()
    new_records = []

    for tag, fn in [
        ("H", emit_type_H_reference),
        ("E-book", emit_book_shapes),
        ("L", emit_type_L_carts),
        ("I", emit_type_I_identity),
        ("J", emit_type_J_doctrine),
        ("K", emit_type_K_weave),
        ("M", emit_type_M_cart_fim),
        ("N", emit_type_N_graph_tags),
        ("G-graph", emit_graph_shapes_S20_S23),
    ]:
        for r in fn():
            new_records.append(json.dumps(r, ensure_ascii=False))
            counters[tag] += 1
            txt = r["text"]
            sm = re.search(r'\[shape:(\S+)\]', txt)
            if sm: shape_dist[sm.group(1)] += 1
            spm = re.search(r'\[speech-act:(\S+)\]', txt)
            if spm: speech_dist[spm.group(1)] += 1
        print(f"  type-{tag}: {counters[tag]:,}")

    # Post-process: inject [bloom:X] tag after [shape:Y] for every new record
    shape_re = re.compile(r'(\[shape:([^\]]+)\])')
    bloomed = []
    for line in new_records:
        d = json.loads(line)
        t = d.get("text", "")
        m = shape_re.search(t)
        if m and "[bloom:" not in t:
            shape = m.group(2)
            b = _bloom(shape)
            t = t.replace(m.group(1), f"{m.group(1)} [bloom:{b}]", 1)
            d["text"] = t
            d["bloom"] = b
        bloomed.append(json.dumps(d, ensure_ascii=False))
    new_records = bloomed

    all_records = orig_records + new_records
    random.Random(42).shuffle(all_records)
    n = len(all_records)
    val_n = max(2000, n // 20)
    val = all_records[:val_n]
    train = all_records[val_n:]

    (OUT_DIR / "train.jsonl").write_text("\n".join(train) + "\n", encoding="utf-8")
    (OUT_DIR / "valid.jsonl").write_text("\n".join(val) + "\n", encoding="utf-8")

    print(f"\n=== Mk 3 CPT corpus v4 ===")
    print(f"  Mk 2 preserved:       {len(orig_records):,}")
    print(f"  new records total:    {len(new_records):,}")
    print(f"  ─────────────────────────")
    print(f"  train.jsonl:          {len(train):,}")
    print(f"  valid.jsonl:          {len(val):,}")
    print(f"  TOTAL:                {n:,}")
    print(f"\n  vs Mk 2 (89k):        +{n - 89000:,}")
    print(f"  vs v3 (122k):         +{n - 122397:,}")

    print(f"\n=== New-record shape distribution ===")
    for s, c in shape_dist.most_common(30):
        print(f"  {s:24} {c:>6,}")

    print(f"\n=== New-record speech-act distribution ===")
    for s, c in speech_dist.most_common():
        print(f"  {s:16} {c:>6,}")

    # Bloom distribution
    bloom_dist = Counter()
    for line in new_records:
        d = json.loads(line)
        b = d.get("bloom")
        if b:
            bloom_dist[b] += 1
    print(f"\n=== New-record Bloom distribution ===")
    for b, c in bloom_dist.most_common():
        pct = 100 * c / sum(bloom_dist.values())
        print(f"  {b:12} {c:>6,}  ({pct:.1f}%)")

    print(f"\n  Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
