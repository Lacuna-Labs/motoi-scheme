#!/usr/bin/env python3
"""sakura-to-motoi-rewriter-2026-07-16.py

Streams the Sakura training corpus, applies the MAP/REWRITE/DROP/ADD-TO-MOTOI/
AMBIGUOUS dispositions from
/Users/alfred/code/motoi-scheme/scratch/sakura-to-motoi-verb-mapping-2026-07-16.slat,
categorizes each surviving pair (CODE / PERSONA / CURRICULUM / REFUSAL), and
writes per-bucket JSONL files under motoi-scheme/training-data/ plus surface
files for flagged pairs under motoi-scheme/scratch/.

READ-ONLY on ~/.forge/. Never overwrites source. Never commits.

Doctrine:
  - MAP verbs        -> token-swap, keep pair
  - REWRITE verbs    -> drop from mechanical pipeline (hand-lift only)
  - DROP verbs       -> discard pair (partial rewrite = corrupted signal)
  - AMBIGUOUS verbs  -> surface to scratch/sakura-dip-ambiguous-pairs-*
  - ADD-TO-MOTOI     -> surface to scratch/sakura-dip-add-to-motoi-candidates-*
                        (also drop from train — verbs not yet in Motoi)
  - Fence swap: scheme -> motoi on every fence
  - Voice adaptation: heavy Sakura-persona pairs (cherry blossom, kimono,
    "gentle" refrains, first-person Sakura) get DROPPED for Copilot register
  - System prompt: strip Sakura system prompt entirely (Motoi Copilot uses
    a different one and pairs will get a fresh system prompt at train time)
  - Categorization: heuristic (fenced code -> CODE unless refusal shape;
    refusal shape -> REFUSAL; long prose Q&A -> CURRICULUM; short answer /
    identity / voice -> PERSONA)
"""
from __future__ import annotations

import argparse
import json
import re
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path


# ---------------------------------------------------------------------------
# CONSTANTS / PATHS
# ---------------------------------------------------------------------------

MAPPING_SLAT = Path(
    "/Users/alfred/code/motoi-scheme/scratch/sakura-to-motoi-verb-mapping-2026-07-16.slat"
)
DEFAULT_SOURCE = Path("/Users/alfred/.forge/corpus/sakura/train.jsonl")

OUT_DIR_TRAIN = Path("/Users/alfred/code/motoi-scheme/training-data")
OUT_DIR_SCRATCH = Path("/Users/alfred/code/motoi-scheme/scratch")

OUT_CODE = OUT_DIR_TRAIN / "sakura-dip-code-2026-07-16.jsonl"
OUT_PERSONA = OUT_DIR_TRAIN / "sakura-dip-persona-2026-07-16.jsonl"
OUT_CURRICULUM = OUT_DIR_TRAIN / "sakura-dip-curriculum-2026-07-16.jsonl"
OUT_REFUSAL = OUT_DIR_TRAIN / "sakura-dip-refusal-2026-07-16.jsonl"

OUT_AMBIGUOUS = OUT_DIR_SCRATCH / "sakura-dip-ambiguous-pairs-2026-07-16.jsonl"
OUT_ADD_TO_MOTOI = OUT_DIR_SCRATCH / "sakura-dip-add-to-motoi-candidates-2026-07-16.jsonl"
OUT_DROPPED_SAMPLES = OUT_DIR_SCRATCH / "sakura-dip-dropped-samples-2026-07-16.jsonl"

SEED = 20260716
DROPPED_SAMPLE_TARGET = 200

# ---------------------------------------------------------------------------
# MAPPING TABLE PARSER
# ---------------------------------------------------------------------------

VERB_LINE_RE = re.compile(
    r'\(verb\s+:sakura\s+"([^"]+)"\s+:disposition\s+([A-Z\-]+)'
    r'(?:\s+:motoi\s+"([^"]+)")?',
    re.DOTALL,
)


def parse_mapping(path: Path) -> dict:
    """Returns {sakura_verb: {'disposition': str, 'motoi': Optional[str]}}."""
    text = path.read_text()
    mapping: dict[str, dict] = {}
    for m in VERB_LINE_RE.finditer(text):
        verb = m.group(1)
        disp = m.group(2)
        motoi = m.group(3)
        mapping[verb] = {"disposition": disp, "motoi": motoi}
    return mapping


# ---------------------------------------------------------------------------
# VERB DETECTION IN PAIRS
# ---------------------------------------------------------------------------

# Identifier characters valid in Motoi/Scheme verb names.
# Accept dashed and slashed forms; a verb token is delimited by whitespace,
# parens, quotes, colons, or backticks.
VERB_CHAR = r"A-Za-z0-9\-/!?*+<>=._"
VERB_DELIM = rf"[^{VERB_CHAR}]"
VERB_TOKEN_RE = re.compile(rf"[{VERB_CHAR}]+")


def extract_tokens(text: str) -> set[str]:
    """Extract candidate identifier tokens from text (fenced code + prose)."""
    return set(VERB_TOKEN_RE.findall(text))


# Match a token only when it looks like a Scheme verb call or symbol:
#   (verb            — head of an application
#   'verb            — quoted symbol
#   :verb            — keyword-ish
#   verb!            — bang verbs are almost always calls (e.g. paint-cell)
#   verb?            — predicates
#   verb/            — slashed form always a verb
#   /verb            — slashed form always a verb (as suffix segment)
#
# Anything that appears only as a bare English word (e.g. "next steps",
# "escalate the issue") does NOT match. This prevents the ~56k false
# positives on `next` / `escalate` / `form` / `done`.
VERB_CALL_PATTERNS = [
    r"\({verb}(?![{vc}])",
    r"'{verb}(?![{vc}])",
    r":{verb}(?![{vc}])",
    r"(?<![{vc}]){verb}(?=[!?/])",
]


def build_call_context_regex(verb_set: set) -> "re.Pattern":
    """Build ONE alternation regex for a verb set with call-context guards.

    Emits a named group per verb so we can identify which verbs hit.
    Two alternations:
      - SLASHED / bang / predicate: any bare occurrence (they are unambiguously
        Scheme identifiers because dashed English words don't contain '/'!'?').
      - Otherwise: require call context ((verb, 'verb, :verb).
    """
    if not verb_set:
        return None
    strict_alts = []
    loose_alts = []
    for v in verb_set:
        esc = re.escape(v)
        if "/" in v or v.endswith("!") or v.endswith("?"):
            loose_alts.append(esc)
        else:
            strict_alts.append(esc)
    parts = []
    if strict_alts:
        parts.append(rf"(?:\(|'|:)(?P<strict>{'|'.join(strict_alts)})(?![{VERB_CHAR}])")
    if loose_alts:
        parts.append(rf"(?<![{VERB_CHAR}])(?P<loose>{'|'.join(loose_alts)})(?![{VERB_CHAR}])")
    return re.compile("|".join(parts))


def extract_call_context_verbs(text: str, pattern) -> set:
    """Return the set of verbs (from the pattern) that appear in text."""
    if pattern is None:
        return set()
    hits = set()
    for m in pattern.finditer(text):
        v = m.group("strict") if "strict" in m.groupdict() and m.group("strict") else m.group("loose") if "loose" in m.groupdict() and m.group("loose") else None
        if v:
            hits.add(v)
    return hits


# ---------------------------------------------------------------------------
# FENCE / TOKEN REWRITING
# ---------------------------------------------------------------------------

FENCE_SWAP_RE = re.compile(r"```(scheme|sakura)\b", re.IGNORECASE)


def rewrite_fences(text: str) -> tuple[str, int]:
    n = 0

    def sub(m):
        nonlocal n
        n += 1
        return "```motoi"

    return FENCE_SWAP_RE.sub(sub, text), n


def apply_verb_map(text: str, map_table: dict) -> tuple:
    """Token-swap sakura -> motoi verbs.

    Uses word-boundary-ish delimiter based on VERB_CHAR class. Only rewrites
    MAP verbs (map_table pre-filtered by caller).
    """
    if not map_table:
        return text, 0
    n_swaps = 0
    # Sort by length descending so longer verbs match first (prevents
    # 'form' from clobbering 'form-list').
    sorted_verbs = sorted(map_table.keys(), key=len, reverse=True)
    for sk in sorted_verbs:
        target = map_table[sk]
        if not target:
            continue
        # Build a per-verb regex with delimiter guards.
        pat = re.compile(
            rf"(?<![{VERB_CHAR}]){re.escape(sk)}(?![{VERB_CHAR}])"
        )
        new_text, count = pat.subn(target, text)
        if count:
            text = new_text
            n_swaps += count
    return text, n_swaps


# ---------------------------------------------------------------------------
# VOICE-LOCK: HEAVY SAKURA-PERSONA MARKERS
# ---------------------------------------------------------------------------

# Phrases that mark a pair as heavily Sakura-persona and should DROP for the
# dryer Copilot register. Case-insensitive substring match.
HEAVY_SAKURA_MARKERS = [
    "cherry blossom", "kimono", "gentle refrain",
    "as sakura", "i am sakura", "i'm sakura",
    "sakura's voice", "sakura here",
    "curator app", "inside the curator",
    "on this operator", "you live on this operator",  # from system prompt
    "howdy", "yo,", "yo!",  # register-quip anti-patterns
    "wisdom of the trees",  # too twee for copilot
    "flowers dancing",  # sakura self-model
]

# Corporate/product names that must not appear in Motoi output.
FORBIDDEN_NAMES = [
    "curator", "sakura",  # persona/product
    "etsy", "ebay", "shopify", "amazon",  # marketplace
    "jungle scout", "keepa",
    "gmail", "google workspace", "google drive",
    "spotify", "apple music", "apple podcasts",
    "instagram", "facebook", "meta ", "meta,", "meta.",
    "tiktok", "twitter", "linkedin", "youtube",
    "stripe", "paypal", "square ",
    "openai", "anthropic", "claude", "gpt-",
]

# Commerce-shaped terms that indicate Curator-scenario contamination.
COMMERCE_TERMS = [
    " listing ", " listings ", "product search", "sales velocity",
    "sku", "inventory", " buyer", " seller", "cart abandon",
    "shipping profile", "fulfillment", " merch ",
    "lower my prices", "raise my prices", "lower prices", "raise prices",
    "free shipping", "margins are tight", "margin ", "profit margin",
    "brand mark", "price chip", "brand kit",
    "reels cover", " reel ", " reels ",
    "tracking number", "carrier website", " carrier ",
    "price drop", "discount", " coupon ", " coupons ",
    "customer", "customers", "shopper", "storefront",
    "podcast", " episode ", " show notes ",
    "marketplace", " listing", "cross-listing",
    "workflow", "cart body", "operator says", "operator wants",
]

# Sakura-specific verb patterns that indicate Cortex/persona-hook content
# NOT already covered by the DROP list. cortex/* IS Motoi base, so don't filter.
SAKURA_VERB_PATTERNS = [
    r"\bworld/knowledge\b",  # Sakura Cortex escalation, not Motoi
]
SAKURA_VERB_RE = re.compile("|".join(SAKURA_VERB_PATTERNS))


def has_sakura_verb_pattern(text: str) -> bool:
    return bool(SAKURA_VERB_RE.search(text))

# Philosopher names — forbidden name-drops in Motoi persona output.
PHILOSOPHER_NAMES = [
    "jung", "wittgenstein", "lacan", "peirce", "popper", "freud",
    "searle", "grice", "derrida", "quine", "descartes", "sartre",
    "rawls", "aristotle", "levinas", "dennett", "socrates",
]


def has_heavy_sakura_voice(text: str) -> bool:
    t = text.lower()
    for m in HEAVY_SAKURA_MARKERS:
        if m in t:
            return True
    return False


def has_forbidden_names(text: str) -> bool:
    t = text.lower()
    for n in FORBIDDEN_NAMES:
        if n in t:
            return True
    return False


def has_commerce_shape(text: str) -> bool:
    t = text.lower()
    for term in COMMERCE_TERMS:
        if term in t:
            return True
    return False


def has_philosopher_dropname(text: str) -> bool:
    """Only checks assistant content — persona pairs must not name-drop."""
    t = text.lower()
    for name in PHILOSOPHER_NAMES:
        # Look for standalone name (surrounded by non-word chars).
        if re.search(rf"\b{re.escape(name)}\b", t):
            return True
    return False


# ---------------------------------------------------------------------------
# CATEGORIZATION
# ---------------------------------------------------------------------------

REFUSAL_MARKERS = [
    "not what i do", "not that kind of copilot", "ask me something else",
    "i don't do that", "no.", "not the tool", "not the right",
    "reach a person you trust", "crisis line",
    "i won't", "i can't help with that",
    "out of my domain", "not my domain",
    # Sakura refusal shapes
    "i shouldn't", "not appropriate", "won't help",
]

CODE_FENCE_RE = re.compile(r"```(scheme|sakura|motoi)\b", re.IGNORECASE)


def categorize(user_text: str, assistant_text: str) -> str:
    """Returns 'CODE' | 'PERSONA' | 'CURRICULUM' | 'REFUSAL'."""
    a_lower = assistant_text.lower()
    # Refusal check first — short assistant + refusal markers.
    if len(assistant_text) < 400:
        for m in REFUSAL_MARKERS:
            if m in a_lower:
                return "REFUSAL"

    has_code = bool(CODE_FENCE_RE.search(assistant_text))
    if has_code:
        return "CODE"

    # No code fence. Long prose Q&A -> CURRICULUM. Short answer -> PERSONA.
    if len(assistant_text) >= 400:
        return "CURRICULUM"
    return "PERSONA"


# ---------------------------------------------------------------------------
# MAIN PIPELINE
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--limit", type=int, default=None,
                    help="Cap number of input pairs (for smoke tests).")
    args = ap.parse_args()

    if not MAPPING_SLAT.exists():
        print(f"ABORT: mapping table missing: {MAPPING_SLAT}", file=sys.stderr)
        sys.exit(2)
    if not args.source.exists():
        print(f"ABORT: source missing: {args.source}", file=sys.stderr)
        sys.exit(2)

    mapping = parse_mapping(MAPPING_SLAT)
    if not mapping:
        print("ABORT: mapping table parsed to zero verbs.", file=sys.stderr)
        sys.exit(2)

    # Pre-index by disposition.
    drop_verb_set = {v for v, d in mapping.items() if d["disposition"] == "DROP"}
    rewrite_verb_set = {v for v, d in mapping.items() if d["disposition"] == "REWRITE"}
    ambiguous_verb_set = {v for v, d in mapping.items() if d["disposition"] == "AMBIGUOUS"}
    add_to_motoi_verb_set = {v for v, d in mapping.items() if d["disposition"] == "ADD-TO-MOTOI"}
    map_table = {
        v: d["motoi"]
        for v, d in mapping.items()
        if d["disposition"] == "MAP" and d["motoi"]
    }

    print(f"Mapping: {len(mapping)} verbs total")
    print(f"  MAP:          {len(map_table)}")
    print(f"  REWRITE:      {len(rewrite_verb_set)}")
    print(f"  DROP:         {len(drop_verb_set)}")
    print(f"  AMBIGUOUS:    {len(ambiguous_verb_set)}")
    print(f"  ADD-TO-MOTOI: {len(add_to_motoi_verb_set)}")

    # Pre-build the call-context regexes once.
    drop_re = build_call_context_regex(drop_verb_set)
    rewrite_re = build_call_context_regex(rewrite_verb_set)
    ambiguous_re = build_call_context_regex(ambiguous_verb_set)
    add_to_motoi_re = build_call_context_regex(add_to_motoi_verb_set)

    # Open output files.
    OUT_DIR_TRAIN.mkdir(parents=True, exist_ok=True)
    OUT_DIR_SCRATCH.mkdir(parents=True, exist_ok=True)

    out_files = {
        "CODE": OUT_CODE.open("w"),
        "PERSONA": OUT_PERSONA.open("w"),
        "CURRICULUM": OUT_CURRICULUM.open("w"),
        "REFUSAL": OUT_REFUSAL.open("w"),
        "AMBIGUOUS": OUT_AMBIGUOUS.open("w"),
        "ADD_TO_MOTOI": OUT_ADD_TO_MOTOI.open("w"),
        "DROPPED": OUT_DROPPED_SAMPLES.open("w"),
    }

    # Provenance headers.
    prov_header_base = {
        "_provenance_header": True,
        "generator": "sakura-to-motoi-rewriter-2026-07-16.py",
        "generated_at": "2026-07-16",
        "source": str(args.source),
        "mapping_table": str(MAPPING_SLAT),
        "seed": SEED,
        "doctrine": "MAP token-swap + fence-swap; DROP any pair with DROP/REWRITE/ADD-TO-MOTOI/AMBIGUOUS verbs; strip Sakura system prompts; drop heavy-Sakura-voice pairs; drop pairs with forbidden corporate/philosopher names.",
        "training_eligible": True,
        "dialect": "motoi",
        "audience": "trainer",
        "confidentiality": "internal",
    }
    for bucket, fh in out_files.items():
        header = dict(prov_header_base)
        header["bucket"] = bucket
        header["training_eligible"] = bucket in ("CODE", "PERSONA", "CURRICULUM", "REFUSAL")
        if bucket in ("AMBIGUOUS", "ADD_TO_MOTOI", "DROPPED"):
            header["notes"] = f"Surface file for Alfred review — NOT for training."
        fh.write(json.dumps(header) + "\n")

    # Counters.
    stats = {
        "total_in": 0,
        "kept_map_neutral": 0,
        "dropped_drop_verb": 0,
        "dropped_rewrite_verb": 0,
        "dropped_ambiguous_verb": 0,
        "dropped_add_to_motoi_verb": 0,
        "dropped_heavy_sakura": 0,
        "dropped_forbidden_names": 0,
        "dropped_commerce_shape": 0,
        "dropped_sakura_verb_pattern": 0,
        "dropped_philosopher_namedrop": 0,
        "dropped_empty_or_broken": 0,
        "flagged_ambiguous": 0,
        "flagged_add_to_motoi": 0,
        "by_bucket": Counter(),
        "verb_swap_count": 0,
        "fence_swap_count": 0,
        "sample_verb_hits_dropped": Counter(),
    }

    # Reservoir sampling for dropped samples.
    dropped_reservoir: list = []

    with args.source.open() as fin:
        for i, line in enumerate(fin):
            if args.limit and i >= args.limit:
                break
            try:
                pair = json.loads(line)
            except json.JSONDecodeError:
                stats["dropped_empty_or_broken"] += 1
                continue
            stats["total_in"] += 1

            msgs = pair.get("messages", [])
            if not msgs:
                stats["dropped_empty_or_broken"] += 1
                continue

            # Separate system / user / assistant.
            user_msgs = [m for m in msgs if m.get("role") == "user"]
            asst_msgs = [m for m in msgs if m.get("role") == "assistant"]
            if not user_msgs or not asst_msgs:
                stats["dropped_empty_or_broken"] += 1
                continue

            user_text = user_msgs[-1].get("content", "") or ""
            asst_text = asst_msgs[-1].get("content", "") or ""
            if not asst_text.strip():
                stats["dropped_empty_or_broken"] += 1
                continue

            combined = user_text + "\n" + asst_text

            # Verb-disposition checks — only count verbs in a call context.
            hits_drop = extract_call_context_verbs(combined, drop_re)
            hits_rewrite = extract_call_context_verbs(combined, rewrite_re)
            hits_ambiguous = extract_call_context_verbs(combined, ambiguous_re)
            hits_add_to_motoi = extract_call_context_verbs(combined, add_to_motoi_re)

            if hits_drop:
                stats["dropped_drop_verb"] += 1
                for v in list(hits_drop)[:3]:
                    stats["sample_verb_hits_dropped"][v] += 1
                # Reservoir sample.
                _maybe_reservoir(dropped_reservoir, pair, i, "DROP verb: " + ",".join(sorted(hits_drop)[:5]), DROPPED_SAMPLE_TARGET)
                continue
            if hits_rewrite:
                stats["dropped_rewrite_verb"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "REWRITE verb: " + ",".join(sorted(hits_rewrite)), DROPPED_SAMPLE_TARGET)
                continue
            if hits_ambiguous:
                # Surface separately; don't include in train.
                stats["flagged_ambiguous"] += 1
                stats["dropped_ambiguous_verb"] += 1
                _write_flagged(out_files["AMBIGUOUS"], pair, i, sorted(hits_ambiguous))
                continue
            if hits_add_to_motoi:
                # Surface separately; verb not in Motoi yet.
                stats["flagged_add_to_motoi"] += 1
                stats["dropped_add_to_motoi_verb"] += 1
                _write_flagged(out_files["ADD_TO_MOTOI"], pair, i, sorted(hits_add_to_motoi))
                continue

            # Voice + forbidden-name filters.
            if has_heavy_sakura_voice(combined):
                stats["dropped_heavy_sakura"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "heavy-sakura-voice", DROPPED_SAMPLE_TARGET)
                continue
            if has_forbidden_names(combined):
                stats["dropped_forbidden_names"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "forbidden-name", DROPPED_SAMPLE_TARGET)
                continue
            if has_commerce_shape(combined):
                stats["dropped_commerce_shape"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "commerce-shape", DROPPED_SAMPLE_TARGET)
                continue
            if has_sakura_verb_pattern(combined):
                stats["dropped_sakura_verb_pattern"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "sakura-verb-pattern", DROPPED_SAMPLE_TARGET)
                continue
            # Only check philosopher name-drops in assistant output.
            if has_philosopher_dropname(asst_text):
                stats["dropped_philosopher_namedrop"] += 1
                _maybe_reservoir(dropped_reservoir, pair, i, "philosopher-name-drop", DROPPED_SAMPLE_TARGET)
                continue

            # Passes all filters — rewrite verbs + fences.
            new_user, n_uv = apply_verb_map(user_text, map_table)
            new_asst, n_av = apply_verb_map(asst_text, map_table)
            new_user, n_uf = rewrite_fences(new_user)
            new_asst, n_af = rewrite_fences(new_asst)
            stats["verb_swap_count"] += n_uv + n_av
            stats["fence_swap_count"] += n_uf + n_af

            # Strip system message entirely (Motoi Copilot uses a different one).
            new_msgs = [
                {"role": "user", "content": new_user},
                {"role": "assistant", "content": new_asst},
            ]
            new_pair = {"messages": new_msgs}
            # Carry provenance.
            new_pair["_prov"] = {
                "source": "sakura-corpus-train-2026-07-16",
                "source_line": i,
                "verb_swaps": n_uv + n_av,
                "fence_swaps": n_uf + n_af,
            }

            bucket = categorize(new_user, new_asst)
            stats["by_bucket"][bucket] += 1
            stats["kept_map_neutral"] += 1
            out_files[bucket].write(json.dumps(new_pair, ensure_ascii=False) + "\n")

            if (i + 1) % 25000 == 0:
                print(f"  processed {i+1}...", file=sys.stderr)

    # Flush dropped reservoir.
    for rec in dropped_reservoir:
        out_files["DROPPED"].write(json.dumps(rec, ensure_ascii=False) + "\n")

    for fh in out_files.values():
        fh.close()

    # Print stats.
    print("\n=== STATS ===")
    for k, v in stats.items():
        if isinstance(v, Counter):
            print(f"  {k}:")
            for kk, vv in v.most_common(20):
                print(f"     {kk}: {vv}")
        else:
            print(f"  {k}: {v}")

    # Write stats to a small sidecar JSON for the report.
    stats_out = OUT_DIR_SCRATCH / "sakura-dip-stats-2026-07-16.json"
    stats_serializable = {
        k: (dict(v) if isinstance(v, Counter) else v)
        for k, v in stats.items()
    }
    stats_out.write_text(json.dumps(stats_serializable, indent=2))
    print(f"\nStats written to {stats_out}")


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

_RESERVOIR_RNG = random.Random(SEED)


def _maybe_reservoir(reservoir: list, pair: dict, i: int, reason: str, target: int):
    """Classic reservoir sampling to keep 'target' items uniformly."""
    rec = {"_prov": {"source_line": i, "reason": reason}, **pair}
    if len(reservoir) < target:
        reservoir.append(rec)
    else:
        j = _RESERVOIR_RNG.randint(0, i)
        if j < target:
            reservoir[j] = rec


def _write_flagged(fh, pair: dict, i: int, verbs: list[str]):
    rec = {"_prov": {"source_line": i, "flagged_verbs": verbs}, **pair}
    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
