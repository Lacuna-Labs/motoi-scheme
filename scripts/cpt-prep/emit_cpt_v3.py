"""Mk 3 CPT emitter — v3, runbook version.

Preserves Mk 2 (89k records at ~/.forge/data/motoi-mk2-cpt/, unchanged) and
ADDS new record types with speech-act + provenance + Qwen wrapping.

New tags on every new record:
  [speech-act:X]   Austin's 5 (assertive/directive/expressive/commissive/declarative)
  [mode:X]         narrative/dialogue/imperative/interrogative/expository/exemplar
  [provenance:X]   source-path
  [shape:SNN]      spec S-shape number
  [paraphrase-idx:N] of M=5

New types added:
  H — per-verb reference (S01-S06 × M variants)
  L — carts (Motoi + Curator, whole-program S10)
  I — identity anchors (S15, Qwen-wrapped)
  J — doctrine (S16, Qwen-wrapped)
  K — cross-substrate weave (S14, Qwen-wrapped)
  M — cart FIM (S11, Qwen FIM tokens)
  N — graph tag data (oppositions, short-scenario, antipattern-scenario,
      motoi-behavior, motoi-uses-when, related-verbs, principle-kind,
      register-kind, contrast-register)

Target: 100k+ records, MORE than Mk 2's 89k.
"""
from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path
from collections import Counter

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


def _rec(text: str, extra: dict | None = None) -> dict:
    d = {"text": text}
    if extra:
        d.update(extra)
    return d


def _tag(**kv) -> str:
    return " ".join(f"[{k}:{v}]" for k, v in kv.items() if v is not None and v != "")


# ---------------------------------------------------------------------------
# Type H — per-verb reference with S01-S06 shape variants
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

        # S01 canonical (assertive · expository)
        if v.get("signature") and v.get("summary"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S01", **{"cpt-shape-name": "canonical",
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\n`{name}` — {v['summary']}\n\nSignature: `{v['signature']}`.",
                {"type": "H", "shape": "S01"})

        # S02 tutorial (assertive · exemplar) — 3 example tiers, each = variant
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
                f"{qwen}\n" + _tag(**base, shape="S02", **{"cpt-shape-name": "tutorial",
                    "speech-act": "directive", "mode": "exemplar",
                    "paraphrase-idx": i, "audience": tier}) + f"\n\n{body}",
                {"type": "H", "shape": "S02"})

        # S03 sibling-contrast (Row 2 assertive · expository)
        row2 = v.get("row_2_audit") or {}
        if v.get("related") and row2.get("problem"):
            siblings = ", ".join(f"`{r}`" for r in v["related"][:5])
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S03", **{"cpt-shape-name": "sibling-contrast",
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nCompared to its siblings ({siblings}), `{name}` differs in the context: {row2['problem'][:300]}",
                {"type": "H", "shape": "S03"})

        # S04 cross-domain-analogy (Row 3 · assertive · expository)
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S04", **{"cpt-shape-name": "cross-domain",
                    "speech-act": "assertive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nThe shape of `{name}` shows up beyond the reference. {row3['setup']} {row3['meta']}",
                {"type": "H", "shape": "S04"})

        # S05 invariant-proof (Row 4 · declarative)
        row4 = v.get("row_4_proof") or {}
        if row4.get("claim") and row4.get("invariant"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S05", **{"cpt-shape-name": "invariant-proof",
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nInvariant `{name}` holds: {row4['claim']}\n\n"
                f"Formal: {row4['invariant']}\n\nFalsifier: any call returning without preserving this.",
                {"type": "H", "shape": "S05"})

        # S06 reversed (Lacan · assertive)
        if v.get("summary"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{"cpt-shape-name": "reversed-def",
                    "speech-act": "interrogative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nWhich Motoi verb has this summary: \"{v['summary'][:200]}\"?\n\n`{name}` — it lives in library `{lib}`.",
                {"type": "H", "shape": "S06"})
        # S06 reversed sig→verb
        if v.get("signature"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{"cpt-shape-name": "reversed-sig",
                    "speech-act": "interrogative", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "programmer"}) +
                f"\n\nWhich verb has signature `{v['signature']}`?\n\n`{name}`.",
                {"type": "H", "shape": "S06"})
        # S06 reversed lib→verbs (once per library, but doing per verb here)
        if v.get("related"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S06", **{"cpt-shape-name": "reversed-sibling",
                    "speech-act": "interrogative", "mode": "expository",
                    "paraphrase-idx": 2, "audience": "programmer"}) +
                f"\n\nWhich verb has these siblings: {', '.join(v['related'][:5])}?\n\n`{name}`.",
                {"type": "H", "shape": "S06"})

        # Caveats (assertive · imperative — warnings)
        for i, cav in enumerate(v.get("caveats", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-caveat", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f"\n\nCaveat on `{name}`: {cav}",
                {"type": "H", "shape": "H-caveat"})

        # Drawbacks (evaluate)
        for i, dw in enumerate(v.get("drawbacks", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-drawback", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f"\n\nDrawback of `{name}` to weigh: {dw}",
                {"type": "H", "shape": "H-drawback"})

        # Usecases (directive)
        for i, uc in enumerate(v.get("usecases", [])):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="H-usecase", **{
                    "speech-act": "directive", "mode": "imperative",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f"\n\nReach for `{name}` when: {uc}",
                {"type": "H", "shape": "H-usecase"})


# ---------------------------------------------------------------------------
# Type L — Carts (Motoi + Curator)
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
            f"{qwen}\n" + _tag(**base, shape="S10", **{"cpt-shape-name": "whole-program",
                "speech-act": "assertive", "mode": "exemplar",
                "paraphrase-idx": 0, "audience": "programmer"}) +
            f"\n\nMotoi cart `{name}` — {one_line}\n\n```scheme\n{text}\n```",
            {"type": "L", "cart": name, "shape": "S10"})
        if one_line:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-summary", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "any"}) +
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
            f"{qwen}\n" + _tag(**base, shape="S10", **{"cpt-shape-name": "whole-program",
                "speech-act": "assertive", "mode": "exemplar",
                "paraphrase-idx": 0, "audience": "programmer"}) +
            f"\n\nSakura cart `{slug}` — {title}\n\n{summary}\n\n```scheme\n{text}\n```",
            {"type": "L", "cart": slug, "shape": "S10"})
        if doc.get("what"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-what", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "programmer"}) +
                f"\n\nWhat `{slug}` does: {doc['what']}",
                {"type": "L", "cart": slug, "shape": "S10-what"})
        if doc.get("why") or doc.get("why_now"):
            why = doc.get("why") or doc.get("why_now")
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S10-why", **{
                    "speech-act": "expressive", "mode": "narrative",
                    "paraphrase-idx": 2, "audience": "programmer"}) +
                f"\n\nWhy `{slug}` exists: {why}",
                {"type": "L", "cart": slug, "shape": "S10-why"})


# ---------------------------------------------------------------------------
# Type I — Identity anchors (S15)
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
            f"{qwen}\n" + _tag(dialect="motoi", substrate="identity",
                shape="S15", **{"cpt-shape-name": "first-person-creed",
                "speech-act": "commissive", "mode": "declarative",
                "paraphrase-idx": i % 5, "audience": "any", "material": "persona"}) +
            f"\n\n{text}",
            {"type": "I", "shape": "S15"})


# ---------------------------------------------------------------------------
# Type J — Doctrine paragraphs (S16)
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
            f"{qwen}\n" + _tag(dialect="motoi", substrate="doctrine",
                shape="S16", **{"cpt-shape-name": "third-person-biography",
                "speech-act": "assertive", "mode": "declarative",
                "paraphrase-idx": i % 5, "audience": "any", "material": "persona"}) +
            f"\n\n{text}",
            {"type": "J", "shape": "S16"})


# ---------------------------------------------------------------------------
# Type K — Weave (S14 entity-graph relation)
# ---------------------------------------------------------------------------

def emit_type_K_weave():
    import reference as ref_extractor
    verbs = list(ref_extractor.iter_all_verbs())
    for v in verbs[:1500]:
        name = v["name"]
        lib = name.split("/", 1)[0] if "/" in name else "core"
        qwen = f"{QWEN_REPO}engineering/motoi-weave.md"
        base = dict(dialect="motoi", substrate="weave", verb=name, library=lib, material="weave")
        row3 = v.get("row_3_dimension") or {}
        if row3.get("setup") and row3.get("meta"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S14", **{"cpt-shape-name": "entity-graph-relation",
                    "speech-act": "assertive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nThe verb `{name}` doesn't live only in the reference. {row3['setup']} {row3.get('explanation', '')} {row3['meta']}",
                {"type": "K", "shape": "S14"})
        row2 = v.get("row_2_audit") or {}
        row5 = v.get("row_5_emergence") or {}
        if row2.get("problem") and row5.get("composition"):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S14-crossrow", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 1, "audience": "programmer"}) +
                f"\n\nFor `{name}`: at audit time (Row 2): {row2['problem'][:200]}. "
                f"At composition time (Row 5): {row5['composition'][:200]}.",
                {"type": "K", "shape": "S14-crossrow"})


# ---------------------------------------------------------------------------
# Type M — Cart FIM (S11 with Qwen native FIM tokens)
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
                f"{qwen}\n" + _tag(**base, shape="S11", **{"cpt-shape-name": "fim",
                    "speech-act": "assertive", "mode": "exemplar",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f"\n\n{QWEN_FIM_PREFIX}{p}{QWEN_FIM_SUFFIX}{s}{QWEN_FIM_MIDDLE}{m}",
                {"type": "M", "shape": "S11"})

    for cart in curator_cart.iter_all_curator_carts():
        rel = cart["rel"]
        qwen = f"{QWEN_REPO}curator-web/src/scheme/carts/{rel}"
        base = dict(dialect="motoi", substrate="cart-fim", source="curator",
                    namespace=cart["namespace"], material="cart-fim")
        for i, (p, m, s) in enumerate(_extract_fim_from_scheme(cart["text"])[:3]):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="S11", **{"cpt-shape-name": "fim",
                    "speech-act": "assertive", "mode": "exemplar",
                    "paraphrase-idx": i, "audience": "programmer"}) +
                f"\n\n{QWEN_FIM_PREFIX}{p}{QWEN_FIM_SUFFIX}{s}{QWEN_FIM_MIDDLE}{m}",
                {"type": "M", "shape": "S11"})


# ---------------------------------------------------------------------------
# Type N — Graph tag data (fields Mk 2's emitter ignored)
# ---------------------------------------------------------------------------

def emit_type_N_graph_tags():
    """Emit records from the graph node fields that Mk 2's emitter skipped:
    oppositions, short-scenario, antipattern-scenario, motoi-behavior,
    motoi-uses-when, related-verbs, principle-kind, register-kind,
    contrast-register.
    """
    sys.path.insert(0, str(REPO / "scripts/sft-prep/isb-sft"))
    import graph as g
    for n in g.iter_all_nodes():
        can = n["canonical"] or n["id"].split("/", 1)[-1]
        axis = n["axis"]
        qwen = f"{QWEN_REPO}graphs/graph-of-{axis}.slat"
        base = dict(dialect="motoi", substrate="graph-tag", word=can, axis=axis,
                    tier=n["tier"], material=f"graph-{axis}")

        # Oppositions
        for i, opp in enumerate(n.get("oppositions", [])[:5]):
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-opposition", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": i, "audience": "any"}) +
                f"\n\nThe opposite of `{can}` in the {axis} axis is `{opp}`.",
                {"type": "N", "shape": "N-opposition"})

        # Short scenario (thinking axis has 300 populated)
        ss = n.get("short_scenario")
        if ss:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-short-scenario", **{
                    "speech-act": "assertive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f"\n\nA scenario where `{can}` matters:\n\n{ss}",
                {"type": "N", "shape": "N-short-scenario"})

        # Antipattern scenario
        ap = n.get("antipattern_scenario")
        if ap:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-antipattern", **{
                    "speech-act": "directive", "mode": "narrative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f"\n\nWhat goes wrong when `{can}` is ignored:\n\n{ap}",
                {"type": "N", "shape": "N-antipattern"})

        # Motoi behavior
        mb = n.get("motoi_behavior") if hasattr(n, 'get') else None
        # dict access
        mb = n["motoi_behavior"] if "motoi_behavior" in n else ""
        if mb:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-motoi-behavior", **{
                    "speech-act": "assertive", "mode": "declarative",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f"\n\nMotoi's behavior around `{can}`: {mb}",
                {"type": "N", "shape": "N-motoi-behavior"})

        # Related verbs (bridge to reference)
        rv = n.get("related_verbs", [])
        if rv:
            names = ", ".join(f"`{v}`" for _, v in rv[:5])
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-related-verbs", **{
                    "speech-act": "assertive", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "programmer"}) +
                f"\n\nReference verbs that invoke `{can}`: {names}",
                {"type": "N", "shape": "N-related-verbs"})

        # Principle-kind (thinking axis)
        pk = n.get("principle_kind")
        if pk:
            yield _rec(
                f"{qwen}\n" + _tag(**base, shape="N-principle-kind", **{
                    "speech-act": "declarative", "mode": "expository",
                    "paraphrase-idx": 0, "audience": "any"}) +
                f"\n\n`{can}` is a {pk.lstrip(':')} principle in the {axis} axis.",
                {"type": "N", "shape": "N-principle-kind"})


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=== Mk 3 CPT emit (v3) ===\n")
    print("Step 1: preserving Mk 2 corpus (89k records)...")
    orig_records = []
    for src in [OLD_CORPUS / "train.jsonl", OLD_CORPUS / "valid.jsonl"]:
        with src.open() as f:
            for line in f:
                orig_records.append(line.rstrip("\n"))
    print(f"  Mk 2 base: {len(orig_records):,} records")

    print("\nStep 2: emitting new types with speech-act + provenance...")
    counters = Counter()
    new_records = []
    shape_dist = Counter()
    speech_dist = Counter()

    for tag, fn in [
        ("H", emit_type_H_reference),
        ("L", emit_type_L_carts),
        ("I", emit_type_I_identity),
        ("J", emit_type_J_doctrine),
        ("K", emit_type_K_weave),
        ("M", emit_type_M_cart_fim),
        ("N", emit_type_N_graph_tags),
    ]:
        for r in fn():
            new_records.append(json.dumps(r, ensure_ascii=False))
            counters[tag] += 1
            # Extract shape + speech-act for distribution
            txt = r["text"]
            sm = re.search(r'\[shape:(\S+)\]', txt)
            if sm: shape_dist[sm.group(1)] += 1
            spm = re.search(r'\[speech-act:(\S+)\]', txt)
            if spm: speech_dist[spm.group(1)] += 1
        print(f"  type-{tag}: {counters[tag]:,}")

    all_records = orig_records + new_records
    random.Random(42).shuffle(all_records)
    n = len(all_records)
    val_n = max(2000, n // 20)
    val = all_records[:val_n]
    train = all_records[val_n:]

    (OUT_DIR / "train.jsonl").write_text("\n".join(train) + "\n", encoding="utf-8")
    (OUT_DIR / "valid.jsonl").write_text("\n".join(val) + "\n", encoding="utf-8")

    print(f"\n=== Mk 3 CPT corpus ===")
    print(f"  Mk 2 preserved:       {len(orig_records):,}")
    print(f"  new types (H-N):      {len(new_records):,}")
    print(f"  ─────────────────────────")
    print(f"  train.jsonl:          {len(train):,}")
    print(f"  valid.jsonl:          {len(val):,}")
    print(f"  TOTAL:                {n:,}")
    print(f"\n  vs Mk 2 (89k):        {'+' if n > 89000 else ''}{n - 89000:,}")

    print(f"\n=== New-record shape distribution ===")
    for s, c in shape_dist.most_common():
        print(f"  {s:24} {c:>6,}")

    print(f"\n=== New-record speech-act distribution ===")
    for s, c in speech_dist.most_common():
        print(f"  {s:16} {c:>6,}")

    print(f"\n  Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
