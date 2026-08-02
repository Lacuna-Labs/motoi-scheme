#!/usr/bin/env python3
"""
close_graph_fields.py — Fill-or-honest-null closure over the four Jung-axis graphs.

Alfred's directive (2026-07-27): "Check the graphs and fix them. Fill in the blank
ones and have a full honest null policy for things that don't make sense."

Invariant enforced: every target field on every node is EITHER
  (a) filled with a value from a REAL, deterministic, non-fabricating source, OR
  (b) explicitly marked honest-null:  :field () :honest-null-<field> #t  ;; honest-null — <reason>

NO FABRICATION (graph-derivation-principle). The only sources allowed:
  * appears-in-corpus  -> scan of the real corpus (scheme-books, word-books, Scheme/reference)
  * synonyms           -> WordNet dominant-synset lemmas (a cited lexical source)
  * surrounding-words  -> real co-occurrence with graph vocab, from the same corpus scan
Everything else with no deterministic source is honest-nulled with a reason.

Default is DRY-RUN (report only). Pass --apply to write in place.
"""
from __future__ import annotations
import argparse, re, sys, json, datetime
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path(__file__).resolve().parents[2]
GRAPH_DIR = REPO / "graphs"
GRAPHS = ["graph-of-sensation", "graph-of-intuition", "graph-of-thinking", "graph-of-feeling"]
CORPUS_ROOTS = [REPO / "scheme-books", REPO / "word-books", REPO / "Scheme" / "reference"]

# Fields we fill from a real, factual source (canonical word -> value).
# ONLY appears-in-corpus: token-string presence in a real file is a fact independent
# of word-sense. (synonyms via WordNet and surrounding-words via file-bag co-occurrence
# were tried and REJECTED 2026-07-27: WordNet dominant-synset is sense-blind and pulls
# wrong/harmful senses onto short domain tokens (row->quarrel, g->drug-slang); file-bag
# co-occurrence is polluted by slat header boilerplate. Neither grounds honestly, so
# both are honest-nulled below, awaiting a sense-aware/windowed miner.)
FILL_FIELDS = {"appears-in-corpus"}
# Fields with NO deterministic non-fabricating source -> honest-null when empty.
NULL_ONLY_REASONS = {
    "definition":        "no corpus/lexical definition signal — stub lookup-only",
    "example-in-scheme": "no verified Scheme example in corpus — awaits example-miner",
    "example-in-world":  "no real-world analogy in corpus — requires authoring",
    "prerequisites":     "no prerequisite chain derivable from corpus",
    "context-of-use":    "lightweight stub — context not authored (three-tier doctrine)",
    "relations":         "lightweight stub — relations not authored (three-tier doctrine)",
    "cross-refs-books":  "no shared-book cross-reference signal",
    "associations":      "no PMI association signal in corpus",
    "distributional-neighbors": "no distributional signal in corpus",
    "cross-refs-graph":  "no cross-axis reference signal",
    "oppositions":       "no corpus opposition signal",
    "synonyms":          "no sense-disambiguated synonym source — WordNet is sense-blind for this domain token; awaits sense-aware miner",
    "surrounding-words": "no reliable co-occurrence signal — file-bag scan is boilerplate-polluted; awaits windowed co-occurrence miner",
}
# honest-null reasons for the fill-fields when the source is silent.
FILL_NULL_REASONS = {
    "appears-in-corpus": "token absent from scanned corpus",
}
TARGET_FIELDS = set(FILL_FIELDS) | set(NULL_ONLY_REASONS)

TOKEN_RE = re.compile(r"[a-z][a-z0-9\-]{1,}")
STOP = set("""the a an and or of to in is it as at be by for on with from that this
which are was were will can not but if then else do does done has have had you your
we our they their he she his her its into over under out up down off no yes all any
some each per via than more most less least one two three see use used using make
made makes name names value values code line lines file files node nodes""".split())


def log(*a):
    print(*a, file=sys.stderr)


# ---------------------------------------------------------------- corpus index
def build_corpus_index(vocab: set[str]):
    """Return (appears: word->[(count,relpath)], cooc: word->Counter(word))."""
    appears: dict[str, Counter] = defaultdict(Counter)   # word -> {relpath: count}
    cooc: dict[str, Counter] = defaultdict(Counter)      # word -> Counter(neighbor)
    files = []
    for root in CORPUS_ROOTS:
        if root.exists():
            files += sorted(root.rglob("*.slatl")) + sorted(root.rglob("*.slat"))
    seen_rel = set()
    for fp in files:
        rel = str(fp.relative_to(REPO))
        # macOS case-insensitive FS: Scheme/reference == scheme/reference; dedup by lower
        if rel.lower() in seen_rel:
            continue
        seen_rel.add(rel.lower())
        try:
            text = fp.read_text(errors="ignore").lower()
        except Exception:
            continue
        toks = TOKEN_RE.findall(text)
        present = set(t for t in toks if t in vocab)
        if not present:
            continue
        counts = Counter(t for t in toks if t in present)
        for w, c in counts.items():
            appears[w][rel] += c
        # co-occurrence: graph-vocab tokens sharing this file (bag-level, cheap)
        vocab_here = [w for w in present]
        for w in vocab_here:
            for other, c in counts.items():
                if other != w and other not in STOP:
                    cooc[w][other] += 1
    return appears, cooc


# ---------------------------------------------------------------- wordnet
def wordnet_synonyms(word: str) -> list[str]:
    try:
        from nltk.corpus import wordnet as wn
    except Exception:
        return []
    syns = wn.synsets(word)
    if not syns:
        return []
    out: list[str] = []
    for syn in syns[:2]:                     # dominant two senses only
        for lem in syn.lemmas():
            name = lem.name().replace("_", " ")
            if name.lower() != word.lower() and name not in out:
                out.append(name)
    return out[:6]


# ---------------------------------------------------------------- node parsing
NODE_START = re.compile(r"^\(node\b")
TOPFORM = re.compile(r"^\((node|edge|header|dialect)\b")
CANON_RE = re.compile(r':canonical\s+"([^"]*)"')
ID_RE = re.compile(r':id\s+"([^"]*)"')


def split_nodes(lines: list[str]):
    """Yield (start_idx, end_idx_exclusive) for each top-level (node ...) block."""
    starts = [i for i, ln in enumerate(lines) if NODE_START.match(ln)]
    bounds = []
    for k, s in enumerate(starts):
        e = len(lines)
        # end at next top-level form
        for j in range(s + 1, len(lines)):
            if TOPFORM.match(lines[j]):
                e = j
                break
        bounds.append((s, e))
    return bounds


def field_is_empty(val: str) -> bool:
    v = val.strip()
    return v == '""' or v == "()"


# multi-line field:  ^<indent>:field   <value>[ trailing]
def make_multiline_field_re(field: str):
    return re.compile(r'^(?P<indent>\s*):' + re.escape(field) + r'(?P<pad>\s+)(?P<val>""|\(\))(?P<rest>.*)$')


# inline (single-line stub):  :field ""   or  :field ()
def make_inline_field_re(field: str):
    return re.compile(r'(:' + re.escape(field) + r')(\s+)(""|\(\))')


def has_null_flag(block_text: str, field: str) -> bool:
    return f":honest-null-{field}" in block_text


def fmt_value_list(items: list[str]) -> str:
    return "(" + " ".join('"' + i.replace('"', "'") + '"' for i in items) + ")"


def fmt_appears(files: list[str]) -> str:
    return "(" + " ".join(f'(:file "{f}")' for f in files) + ")"


def build_fill(field: str, word: str, appears, cooc) -> tuple[str | None, str]:
    """Return (value_str, source) or (None, '') if no real signal."""
    if field == "appears-in-corpus":
        if word in appears and appears[word]:
            ranked = sorted(appears[word].items(), key=lambda kv: (-kv[1], kv[0]))[:6]
            return fmt_appears([r for r, _ in ranked]), "corpus-scan"
        return None, ""
    if field == "synonyms":
        syns = wordnet_synonyms(word)
        if syns:
            return fmt_value_list(syns), "wordnet"
        return None, ""
    if field == "surrounding-words":
        if word in cooc and cooc[word]:
            top = [w for w, _ in cooc[word].most_common(10)]
            return fmt_value_list(top), "corpus-cooccurrence"
        return None, ""
    return None, ""


def process(apply: bool):
    # 1) collect vocab (canonical words) across all graphs
    vocab: set[str] = set()
    parsed: dict[str, list[str]] = {}
    for g in GRAPHS:
        lines = (GRAPH_DIR / f"{g}.slat").read_text().splitlines()
        parsed[g] = lines
        for ln in lines:
            m = CANON_RE.search(ln)
            if m:
                vocab.add(m.group(1).lower())
    log(f"vocab: {len(vocab)} canonical words")

    log("building corpus index (this scans the book corpus once)...")
    appears, cooc = build_corpus_index(vocab)
    log(f"corpus index: {len(appears)} words with corpus hits, {len(cooc)} with co-occurrence")

    stats = Counter()
    per_field = defaultdict(Counter)  # field -> {filled, nulled}
    date = datetime.date.today().isoformat()
    sidecar_rows = []

    # one compiled empty-occurrence matcher per target field (works inline OR own-line)
    field_re = {f: make_inline_field_re(f) for f in TARGET_FIELDS}

    for g in GRAPHS:
        lines = parsed[g]
        changed = 0
        for (s, e) in split_nodes(lines):
            block_text = "\n".join(lines[s:e])
            cm = CANON_RE.search(block_text)
            word = cm.group(1).lower() if cm else ""
            im = ID_RE.search(block_text)
            nid = im.group(1) if im else "?"

            # Walk EVERY line of the node; resolve EVERY empty target-field occurrence.
            # (Handles single-line packed stubs, multi-line nodes, and pre-existing
            #  duplicated node bodies uniformly — no whole-block early-skip.)
            for li in range(s, e):
                line = lines[li]
                if '""' not in line and '()' not in line:
                    continue
                for field in TARGET_FIELDS:
                    m = field_re[field].search(line)
                    if not m:
                        continue
                    after = line[m.end():]
                    if after.lstrip().startswith(f":honest-null-{field}"):
                        continue  # already resolved (e.g. oppositions from the miner)
                    # own-line (value is last thing on the line) can carry a ;; comment;
                    # inline (more fields follow) must NOT, or it would comment them out.
                    own_line = (after.strip() == "")
                    if field in FILL_FIELDS:
                        val, src = build_fill(field, word, appears, cooc)
                    else:
                        val, src = None, ""
                    if val is not None:
                        rep = f"{m.group(1)}{m.group(2)}{val}"
                        per_field[field]["filled"] += 1
                        sidecar_rows.append((g, nid, field, src, "fill"))
                    else:
                        reason = FILL_NULL_REASONS.get(field) or NULL_ONLY_REASONS.get(field, "no signal")
                        tail = f"  ;; honest-null — {reason}" if own_line else ""
                        rep = f"{m.group(1)}{m.group(2)}() :honest-null-{field} #t{tail}"
                        per_field[field]["nulled"] += 1
                        sidecar_rows.append((g, nid, field, "honest-null", reason))
                    line = line[:m.start()] + rep + line[m.end():]
                    changed += 1
                lines[li] = line
        stats[g] = changed
        if apply and changed:
            (GRAPH_DIR / f"{g}.slat").write_text("\n".join(lines) + "\n")

    # ---- reports
    total_fill = sum(v["filled"] for v in per_field.values())
    total_null = sum(v["nulled"] for v in per_field.values())
    log("\n=== per-field (filled / honest-nulled) ===")
    for f in sorted(per_field):
        log(f"  {f:26s} filled={per_field[f]['filled']:6d}  nulled={per_field[f]['nulled']:6d}")
    log(f"\n  TOTAL filled={total_fill}  honest-nulled={total_null}")
    log(f"  per graph changed: {dict(stats)}")
    log(f"\n{'APPLIED' if apply else 'DRY-RUN (no files written; pass --apply)'}")

    # sidecar derivation log + report to scratch
    rep = REPO / "scratch" / f"graph-fill-closure-report-{date}.md"
    with rep.open("w") as fh:
        fh.write(f"# Graph fill/honest-null closure — {date}\n\n")
        fh.write(f"Mode: {'APPLIED' if apply else 'DRY-RUN'}\n\n")
        fh.write(f"vocab={len(vocab)}  corpus-hit-words={len(appears)}\n\n")
        fh.write("| field | filled | honest-nulled |\n|---|---:|---:|\n")
        for f in sorted(per_field):
            fh.write(f"| {f} | {per_field[f]['filled']} | {per_field[f]['nulled']} |\n")
        fh.write(f"\n**TOTAL filled={total_fill}, honest-nulled={total_null}**\n")
    if apply:
        side = GRAPH_DIR / f"derivation-log-fill-closure-{date}.jsonl"
        with side.open("w") as fh:
            for row in sidecar_rows:
                fh.write(json.dumps({"graph": row[0], "id": row[1], "field": row[2],
                                     "source": row[3], "note": row[4]}) + "\n")
    log(f"report -> {rep}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write files (default dry-run)")
    args = ap.parse_args()
    process(args.apply)
