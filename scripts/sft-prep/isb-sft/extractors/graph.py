"""Graph substrate extractor — 4 axis SLATs (sensation/intuition/thinking/feeling).

Per-tier emission budget:
  T1 (rich, all 20+ fields): 10-14 Bloom-6 pairs per node
  T2 (thin, definition + context): 3 pairs per node
  T3 (script-stub, just definition + appears-in-corpus): 2 pairs (def-forward + Lacan reverse)

Total projected across 4 axes:
  T1 ~= 1200 nodes × 12 = 14,400
  T2 ~= 2000 nodes × 3  = 6,000
  T3 ~= 20000 nodes × 2 = 40,000  (capped — massive raw yield needs Zipfian filter)

Philosopher-shape overlay:
  Wittgenstein-late-aspect: canonical <-> definition <-> examples
  Wittgenstein-early:       short-scenario, used-in-programs-as
  Peirce-abduction:         antipattern-scenario ("what would go wrong?")
  Popper-evidence:          motoi-behavior (invariant it enforces)
  Aristotle-nous:           principle-kind categorical placement
  Lacan-reversal:           def-forward <-> def-reverse
  Lacan-metonymy:           cross-refs-graph sibling traversal
  Jung-cross-axis:          cross-axis-bridge (high bridge-score = shared meaning)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sexpr_reader import (
    iter_top_level_forms,
    read_field,
    read_field_list_strings,
    read_field_form,
    iter_records_in_list,
)

def _list_tokens(raw: str, key: str) -> list[str]:
    """Read a list field tolerantly: quoted strings OR bare symbols.

    Graph authoring is inconsistent — intuition writes
    :distributional-neighbors ("a" "b"), feeling writes (settledness steadiness).
    read_field_list_strings only sees the quoted form; this catches both.
    """
    strs = read_field_list_strings(raw, key)
    if strs:
        return strs
    m = re.search(rf":{re.escape(key)}\s+\(([^)]*)\)", raw)
    if not m:
        return []
    return [tok for tok in m.group(1).split() if tok and not tok.startswith(";")]


MOTOI_ROOT = Path("/Users/alfred/code/motoi-scheme")
GRAPH_FILES = [
    MOTOI_ROOT / "graphs" / "graph-of-sensation.slat",
    MOTOI_ROOT / "graphs" / "graph-of-intuition.slat",
    MOTOI_ROOT / "graphs" / "graph-of-thinking.slat",
    MOTOI_ROOT / "graphs" / "graph-of-feeling.slat",
]


def _read_int_field(raw: str, key: str) -> int:
    v = read_field(raw, key)
    if v is None:
        return 0
    try:
        return int(float(v))
    except ValueError:
        return 0


def _read_float_field(raw: str, key: str) -> float:
    v = read_field(raw, key)
    if v is None:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def _cross_refs_verbs(raw_form: str | None) -> list[tuple[str, str]]:
    if not raw_form:
        return []
    out = []
    for rec in iter_records_in_list(raw_form):
        f = read_field(rec, "ref-file")
        v = read_field(rec, "ref-verb")
        if f and v:
            out.append((f, v))
    return out


def _cross_refs_books(raw_form: str | None) -> list[tuple[str, str]]:
    if not raw_form:
        return []
    out = []
    for rec in iter_records_in_list(raw_form):
        b = read_field(rec, "book")
        c = read_field(rec, "chapter")
        if b and c:
            out.append((b, c))
    return out


def _cross_refs_graph(raw_form: str | None) -> list[tuple[str, str]]:
    if not raw_form:
        return []
    out = []
    for rec in iter_records_in_list(raw_form):
        a = read_field(rec, "ref-graph")
        i = read_field(rec, "ref-id")
        if a and i:
            out.append((a, i))
    return out


def _dialogue_lines(raw_form: str | None) -> list[tuple[str, str]]:
    if not raw_form:
        return []
    out = []
    for rec in iter_records_in_list(raw_form):
        sp = read_field(rec, "speaker")
        ln = read_field(rec, "line")
        if sp and ln:
            out.append((sp.lstrip(":"), ln))
    return out


def _appears_in_corpus(raw_form: str | None) -> list[dict]:
    if not raw_form:
        return []
    out = []
    for rec in iter_records_in_list(raw_form):
        out.append({
            "file": read_field(rec, "file") or "",
            "excerpt": read_field(rec, "excerpt") or "",
        })
    return out


# Code-null tokens that leaked from source code (numeric NaN, JS undefined,
# etc.) into the noun-graph as if they were English words. Exact-match only —
# 'nand' (logic gate), 'nano', 'nanometer', 'nanosecond' are real words and
# must survive. These are scrubbed from node canonicals AND neighbor lists so
# no S20/S24 relation card ever teaches "which word is related to `nan`?".
_NULL_TOKENS = frozenset({
    "nan", "undefined", "null", "none", "nil", "inf", "-inf", "+inf",
    "object object", "[object object]", "nul", "void 0",
})


def _is_null_token(w: str) -> bool:
    # Normalize away any score suffix like "inf(0.87)" before comparing, so a
    # scored association token is caught the same as a bare one.
    return w.split("(", 1)[0].strip().lower() in _NULL_TOKENS


def _scrub_null_tokens(words):
    return [w for w in words if not _is_null_token(w)]


def iter_all_nodes() -> Iterator[dict]:
    for path in GRAPH_FILES:
        if not path.exists():
            continue
        axis_from_file = path.stem.replace("graph-of-", "")
        for raw in iter_top_level_forms(path, prefix="(node"):
            node = {
                "path": str(path),
                "raw": raw,
                "id": read_field(raw, "id") or "",
                "canonical": read_field(raw, "canonical") or "",
                "axis": read_field(raw, "axis") or axis_from_file,
                "tier": read_field(raw, "tier") or "3",
                "definition": read_field(raw, "definition") or "",
                "examples": read_field_list_strings(raw, "examples"),
                "example_dialogue": _dialogue_lines(read_field_form(raw, "example-dialogue")),
                "used_in_programs_as": read_field_list_strings(raw, "used-in-programs-as"),
                "short_scenario": read_field(raw, "short-scenario") or "",
                "antipattern_scenario": read_field(raw, "antipattern-scenario") or "",
                "motoi_behavior": read_field(raw, "motoi-behavior") or "",
                "principle_kind": read_field(raw, "principle-kind") or "",
                "context_of_use": read_field(raw, "context-of-use") or "",
                "surrounding_words": _scrub_null_tokens(read_field_list_strings(raw, "surrounding-words")),
                "appears_in_corpus": _appears_in_corpus(read_field_form(raw, "appears-in-corpus")),
                "synonyms": _scrub_null_tokens(read_field_list_strings(raw, "synonyms")),
                "oppositions": _scrub_null_tokens(read_field_list_strings(raw, "oppositions")),
                "honest_null_oppositions": (read_field(raw, "honest-null-oppositions") or "").strip() == "#t",
                "associations": _scrub_null_tokens(_list_tokens(raw, "associations")),
                "distributional_neighbors": _scrub_null_tokens(_list_tokens(raw, "distributional-neighbors")),
                "related_verbs": _cross_refs_verbs(read_field_form(raw, "related-verbs")),
                "cross_refs_books": _cross_refs_books(read_field_form(raw, "cross-refs-books")),
                "cross_refs_graph": _cross_refs_graph(read_field_form(raw, "cross-refs-graph")),
                "related_books": _cross_refs_books(read_field_form(raw, "related-books")),
                "bridge_score": _read_float_field(raw, "cross-axis-bridge-score"),
                "freq": _read_int_field(raw, "freq"),
                "doc_freq": _read_int_field(raw, "doc-freq"),
                "tf_idf": _read_float_field(raw, "tf-idf"),
            }
            # Skip code-null nodes whose whole identity is a leaked token
            # (e.g. canonical "nan"/"undefined"). Real words like 'nand',
            # 'nano', 'nanometer' pass — only exact null-tokens are dropped.
            word = node["canonical"] or node["id"].split("/", 1)[-1]
            if node["id"] and not _is_null_token(word):
                yield node


def _pair(user: str, motoi: str, node: dict, bloom: str, phil: str, shape: str) -> dict:
    return {
        "user": user,
        "motoi": motoi,
        "tags": {
            "bloom": bloom,
            "philosopher": phil,
            "shape": shape,
            "substrate": "graph",
            "concept": node["id"],
            "axis": node["axis"],
            "tier": node["tier"],
            "bridge_score": node["bridge_score"],
            "doc_freq": node["doc_freq"],
            "tf_idf": node["tf_idf"],
        },
    }


def emit_t1_pairs(n: dict) -> Iterator[dict]:
    can = n["canonical"] or n["id"].split("/", 1)[-1]
    axis = n["axis"]
    defn = n["definition"]

    if defn:
        yield _pair(
            f"What does `{can}` mean in Motoi's {axis} axis?",
            defn,
            n, "remember", "lacan-reversal", "def-forward",
        )
        yield _pair(
            f"In Motoi's {axis} axis, which principle-noun means: {defn}",
            f"`{can}` — a {axis}-axis signifier.",
            n, "remember", "lacan-reversal", "def-reverse",
        )

    if n["examples"]:
        joined = "\n\n".join(f"- {e}" for e in n["examples"][:3])
        yield _pair(
            f"Show me how `{can}` shows up in Motoi's world — a few angles.",
            f"`{can}` appears in the {axis} graph like this:\n\n{joined}",
            n, "understand", "wittgenstein-late-aspect", "examples-prose",
        )

    if n["example_dialogue"]:
        d = "\n".join(f"{sp}: {ln}" for sp, ln in n["example_dialogue"][:4])
        yield _pair(
            f"How would you explain `{can}` to a kid asking about it?",
            f"Like this:\n\n{d}",
            n, "understand", "wittgenstein-late-aspect", "dialogue-shape",
        )

    if n["used_in_programs_as"]:
        joined = "\n".join(f"- {u}" for u in n["used_in_programs_as"][:3])
        yield _pair(
            f"When I'm writing Motoi code, where does `{can}` actually live?",
            f"`{can}` shows up in programs as:\n\n{joined}",
            n, "apply", "wittgenstein-early", "programs-usage",
        )

    if n["short_scenario"]:
        yield _pair(
            f"Give me a small story where `{can}` matters.",
            n["short_scenario"],
            n, "apply", "wittgenstein-early", "short-scenario",
        )

    if n["antipattern_scenario"]:
        yield _pair(
            f"What could go wrong with `{can}` — I want the failure mode.",
            n["antipattern_scenario"],
            n, "analyze", "peirce-abduction", "antipattern-scenario",
        )

    if n["motoi_behavior"]:
        yield _pair(
            f"What does Motoi DO when `{can}` is at stake?",
            n["motoi_behavior"],
            n, "evaluate", "popper-evidence", "motoi-behavior",
        )

    if n["principle_kind"]:
        pk = n["principle_kind"].lstrip(":")
        yield _pair(
            f"What KIND of principle is `{can}`?",
            f"`{can}` is a {pk} principle in the {axis} axis. That places it "
            f"alongside sibling {pk} principles — they share the same shape of duty.",
            n, "evaluate", "aristotle-nous", "principle-kind",
        )

    if n["cross_refs_graph"]:
        others = [f"{a}/{i.split('/', 1)[-1] if '/' in i else i}" for a, i in n["cross_refs_graph"][:5]]
        yield _pair(
            f"What other Motoi concepts does `{can}` reach across to?",
            f"`{can}` connects to: {', '.join(f'`{o}`' for o in others)}. "
            "Different axes carry the same idea in different registers.",
            n, "create", "lacan-metonymy", "cross-graph-traversal",
        )

    if n["related_verbs"]:
        verbs = [v for _, v in n["related_verbs"][:5]]
        yield _pair(
            f"Which verbs bring `{can}` into code?",
            f"Verbs that carry `{can}` into runtime: {', '.join(f'`{v}`' for v in verbs)}. "
            "Each one is where the principle stops being abstract.",
            n, "apply", "wittgenstein-early", "concept-to-verb",
        )

    if n["related_books"] or n["cross_refs_books"]:
        books = n["related_books"] or n["cross_refs_books"]
        listed = [f"{b} § {c}" for b, c in books[:4]]
        yield _pair(
            f"Where can I read more about `{can}`?",
            f"See {', '.join(listed)}.",
            n, "understand", "wittgenstein-late-aspect", "book-reference",
        )

    if n["bridge_score"] and n["bridge_score"] > 3.0:
        yield _pair(
            f"`{can}` seems to show up across multiple Motoi axes — why?",
            f"`{can}` has a cross-axis bridge score of {n['bridge_score']:.2f}, "
            "meaning it carries meaning across more than one Jungian axis. "
            "That's a sign it's a load-bearing concept — not stuck to one register.",
            n, "create", "jung-cross-axis", "bridge-node",
        )

    surrounding = n.get("surrounding_words") or []
    aic = n.get("appears_in_corpus") or []
    if surrounding:
        neighbors_text = ", ".join(f"`{w}`" for w in surrounding[:8])
        yield _pair(
            f"What other words does Motoi see near `{can}`?",
            (
                f"In Motoi's corpus, `{can}` keeps company with: {neighbors_text}. "
                f"That's the neighborhood — where the meaning of `{can}` gets its shape."
            ),
            n, "apply", "wittgenstein-early", "neighbor-probe",
        )
    if aic:
        primary_file = _primary_book_file(aic)
        others = [e["file"] for e in aic if e["file"] and e["file"] != primary_file]
        if primary_file:
            yield _pair(
                f"Where in Motoi's corpus does `{can}` appear?",
                (
                    f"`{can}` appears in `{primary_file}`"
                    + (f", plus {len(others)} other file(s)." if others else ".")
                    + (f" Frequency: {n['freq']} times across {n['doc_freq']} file(s)."
                       if n["freq"] else "")
                ),
                n, "analyze", "peirce-abduction", "corpus-locator",
            )


def emit_t2_pairs(n: dict) -> Iterator[dict]:
    can = n["canonical"] or n["id"].split("/", 1)[-1]
    axis = n["axis"]
    defn = n["definition"]

    if defn and not _is_stub(defn):
        yield _pair(
            f"What does `{can}` mean in the {axis} axis?",
            defn,
            n, "remember", "lacan-reversal", "def-forward",
        )
        yield _pair(
            f"Which {axis}-axis word means: {defn}",
            f"`{can}`.",
            n, "remember", "lacan-reversal", "def-reverse",
        )

    if n["context_of_use"]:
        yield _pair(
            f"When does Motoi reach for `{can}`?",
            n["context_of_use"],
            n, "apply", "wittgenstein-early", "context-of-use",
        )

    surrounding = n.get("surrounding_words") or []
    aic = n.get("appears_in_corpus") or []
    if surrounding:
        neighbors_text = ", ".join(f"`{w}`" for w in surrounding[:8])
        yield _pair(
            f"What other {axis}-axis words does Motoi see near `{can}`?",
            (
                f"In Motoi's corpus, `{can}` appears alongside: {neighbors_text}. "
                f"That neighborhood is where its meaning lives."
            ),
            n, "understand", "wittgenstein-late-aspect", "contextual-neighbors",
        )
    if aic:
        primary_file = _primary_book_file(aic)
        if primary_file:
            yield _pair(
                f"Where in Motoi's corpus does `{can}` appear?",
                (
                    f"`{can}` shows up in `{primary_file}`."
                    + (f" It appears {n['freq']} times across {n['doc_freq']} file(s)."
                       if n["freq"] else "")
                ),
                n, "analyze", "peirce-abduction", "corpus-locator",
            )


_T3_STUB_PATTERNS = (
    "a rare word",
    "appears in the motoi corpus",
    "appearing in the motoi corpus",
    "no authored definition",
    "stub",
)


def _is_stub(defn: str) -> bool:
    if not defn or len(defn) < 25:
        return True
    low = defn.lower()
    return any(pat in low for pat in _T3_STUB_PATTERNS)


def _primary_book_file(aic: list[dict]) -> str:
    for entry in aic:
        f = entry.get("file", "")
        if f and (".book" in f or f.endswith(".slatl") or f.endswith(".slat")):
            return f
    return aic[0]["file"] if aic else ""


def emit_t3_pairs(n: dict) -> Iterator[dict]:
    """T3 pairs — CONTEXTUAL definitions, not fabricated.

    T3 nodes are the low-frequency tail: real words in the corpus but not
    authored with formal definitions. We define them by their CORPUS
    NEIGHBORHOOD (surrounding-words) and their LOCATION (appears-in-corpus).
    This is Wittgenstein-late doctrine — meaning is use. It teaches the model
    to answer honestly: "I saw this word in this context alongside these
    words" rather than fabricating a definition it doesn't have.

    If the authored :definition is not a stub, we fall through to the T2
    shape and emit those pairs as well.
    """
    can = n["canonical"] or n["id"].split("/", 1)[-1]
    axis = n["axis"]
    defn = n["definition"]
    surrounding = n["surrounding_words"]
    aic = n["appears_in_corpus"]
    freq = n["freq"]
    doc_freq = n["doc_freq"]

    if not _is_stub(defn):
        yield _pair(
            f"What does `{can}` mean in Motoi's {axis} axis?",
            defn,
            n, "remember", "lacan-reversal", "def-forward",
        )
        yield _pair(
            f"Which {axis}-axis word means: {defn}",
            f"`{can}`.",
            n, "remember", "lacan-reversal", "def-reverse",
        )
        return

    if not surrounding and not aic:
        return

    neighbors_text = ", ".join(f"`{w}`" for w in surrounding[:8]) if surrounding else ""
    primary_file = _primary_book_file(aic)
    other_files = [entry["file"] for entry in aic if entry["file"] and entry["file"] != primary_file]

    if surrounding:
        yield _pair(
            f"What does `{can}` mean in Motoi's {axis} axis?",
            (
                f"`{can}` is a {axis}-axis word from Motoi's corpus. It doesn't carry "
                f"an authored definition — its meaning lives in the company it keeps. "
                f"In Motoi's corpus, `{can}` appears alongside: {neighbors_text}. "
                f"That neighborhood is where its meaning lives."
                + (f" See `{primary_file}` for the context." if primary_file else "")
            ),
            n, "understand", "wittgenstein-late-aspect", "contextual-definition",
        )

        yield _pair(
            f"Which {axis}-axis word in Motoi's corpus keeps company with: {neighbors_text}?",
            f"`{can}` — that neighborhood is where it lives.",
            n, "remember", "lacan-reversal", "context-reverse",
        )

    if primary_file:
        yield _pair(
            f"Where in Motoi's corpus does `{can}` appear?",
            (
                f"`{can}` shows up in `{primary_file}`"
                + (f", plus {len(other_files)} other file(s)." if other_files else ".")
                + f" It appears {freq} times across {doc_freq} corpus file(s)."
            ),
            n, "analyze", "peirce-abduction", "corpus-locator",
        )

    if surrounding:
        yield _pair(
            f"What other words does Motoi see near `{can}`?",
            (
                f"Motoi's corpus places `{can}` next to: {neighbors_text}. "
                f"If you're looking for `{can}`, look where those words show up too."
            ),
            n, "apply", "wittgenstein-early", "neighbor-probe",
        )


def emit_pairs_for_node(n: dict) -> Iterator[dict]:
    tier = n["tier"]
    if tier == "1":
        yield from emit_t1_pairs(n)
    elif tier == "2":
        yield from emit_t2_pairs(n)
    else:
        yield from emit_t3_pairs(n)


if __name__ == "__main__":
    from collections import Counter
    total = 0
    per_axis = Counter()
    per_tier = Counter()
    per_bloom = Counter()
    per_phil = Counter()
    node_count = 0
    for n in iter_all_nodes():
        node_count += 1
        per_axis[n["axis"]] += 1
        per_tier[n["tier"]] += 1
        for p in emit_pairs_for_node(n):
            total += 1
            per_bloom[p["tags"]["bloom"]] += 1
            per_phil[p["tags"]["philosopher"]] += 1

    print(f"nodes parsed: {node_count}")
    print(f"total pairs:  {total}")
    print("\nNodes per axis:")
    for a, c in per_axis.most_common():
        print(f"  {a:14} {c:>7}")
    print("\nNodes per tier:")
    for t, c in sorted(per_tier.items()):
        print(f"  T{t:>2}: {c:>7}")
    print("\nBloom distribution:")
    for b, c in per_bloom.most_common():
        pct = 100.0 * c / total if total else 0.0
        print(f"  {b:14} {c:>7}  ({pct:.1f}%)")
    print("\nPhilosopher-shape distribution:")
    for p, c in per_phil.most_common():
        pct = 100.0 * c / total if total else 0.0
        print(f"  {p:32} {c:>7}  ({pct:.1f}%)")
