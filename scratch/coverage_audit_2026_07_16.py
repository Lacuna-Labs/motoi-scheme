#!/usr/bin/env python3
"""
Motoi Copilot Coverage Audit — 2026-07-16
==========================================

Cross-references the 958-verb Motoi Scheme reference with the JSONL Copilot
training corpus (pilot + Wave 1 + Wave 2), producing per-verb pair counts,
tier assignments, and a gap-fill plan.

Tiers (per lacuna-labs/research/small-model-dsl-teaching-2026-07-16.slat):
  STARVED       : 0 pairs
  THIN          : 1-4 pairs
  THIN-CONTEXT  : 5-19 pairs OR <3 distinct contexts
  HEALTHY       : >=20 pairs AND >=3 contexts
"""

import json
import os
import re
from collections import defaultdict, Counter
from pathlib import Path

REFERENCE_PATH   = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
TRAINING_DIR     = Path("/Users/alfred/code/motoi-scheme/training-data")
OUT_AUDIT        = Path("/Users/alfred/code/lacuna-labs/reports/motoi-copilot-coverage-audit-2026-07-16.slat")
OUT_GAPLIST      = Path("/Users/alfred/code/motoi-scheme/scratch/coverage-gap-list.slat")
ARCHITECT_DOC    = Path("/Users/alfred/code/lacuna-labs/design-docs/architect-motoi-core-vs-extension-2026-07-16.slat")
CORE_LIST_PATH   = Path("/Users/alfred/code/motoi-scheme/scratch/motoi-core-verbs-list.slat")
EXT_LIST_PATH    = Path("/Users/alfred/code/motoi-scheme/scratch/motoi-extension-packages.slat")

# ─── 1) Extract verbs from the reference ────────────────────────────────────

def extract_verbs(reference_path):
    """
    Parse (verb ... :name "foo/bar" :library "foo" ...) blocks.
    Return: list of dicts {name, library}
    """
    verbs = []
    with open(reference_path, "r") as f:
        text = f.read()
    # Split on top-level "(verb" openings; each block is up to the next "(verb" or EOF.
    # Use a simpler line-scan approach — track when we enter (verb\n and grab the :name and :library.
    lines = text.splitlines()
    in_verb = False
    current = {}
    depth = 0
    for line in lines:
        if line.strip() == "(verb":
            in_verb = True
            current = {}
            depth = 1
            continue
        if in_verb:
            # Grab :name
            m = re.match(r'\s*:name\s+"([^"]+)"', line)
            if m and "name" not in current:
                current["name"] = m.group(1)
            m = re.match(r'\s*:library\s+"([^"]+)"', line)
            if m and "library" not in current:
                current["library"] = m.group(1)
            # Naive close: when a line starts with "(verb" or "; ───" or we hit an outer close
            # The (verb block ends when we see a line beginning "(verb" or "(" at col 0 that's not a subform.
            # Simpler: reference blocks are separated by blank lines; when we see a blank line after having captured name, flush.
            if line.strip() == "" and "name" in current:
                verbs.append(current)
                current = {}
                in_verb = False
    if in_verb and "name" in current:
        verbs.append(current)
    # De-duplicate: the reference has ~4-13 duplicate verb blocks (multiple
    # definitions of the same :name); the summary says 958 total verbs so we
    # keep the FIRST occurrence and log the collision count.
    seen = set()
    deduped = []
    dup_names = []
    for v in verbs:
        if v["name"] in seen:
            dup_names.append(v["name"])
            continue
        seen.add(v["name"])
        deduped.append(v)
    if dup_names:
        print(f"       (deduped {len(dup_names)} duplicate verb blocks: "
              f"{dup_names[:5]}{'...' if len(dup_names) > 5 else ''})")
    return deduped


# ─── 2) Load training pairs ─────────────────────────────────────────────────

def load_pairs():
    """
    Yield (source_file, pair_dict) tuples for every non-header JSONL line.
    """
    pairs = []
    for path in sorted(TRAINING_DIR.glob("*.jsonl")):
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("_provenance_header"):
                    continue
                if "messages" not in obj:
                    continue
                pairs.append((path.name, obj))
    return pairs


def pair_text(pair):
    """Concatenate all user+assistant contents from a pair for scanning."""
    chunks = []
    for m in pair.get("messages", []):
        chunks.append(m.get("content", "") or "")
    return "\n".join(chunks)


def pair_book(source_file, pair):
    """
    Return chapter/provenance context tag.
    Prefer pair's provenance metadata, fall back to source filename.
    """
    p = pair.get("provenance") or pair.get("_provenance") or {}
    if isinstance(p, dict):
        ch = p.get("chapter") or p.get("section") or p.get("book")
        if ch:
            return f"{source_file}::{ch}"
    return source_file


# ─── 3) Count verb occurrences per pair ─────────────────────────────────────

def build_verb_regex(verb_names):
    """
    Build a single alternation regex to find any verb name as a token
    boundary. Verb names include /, !, ?, - which are all valid Scheme
    identifier characters; we require them to be preceded by '(' or
    whitespace and followed by whitespace, ')', or EOL.
    """
    # Sort longest first so 'ai/max-force!' matches before 'ai/max-force'.
    escaped = sorted((re.escape(v) for v in verb_names), key=len, reverse=True)
    # Boundary: preceded by (, space, tab, newline, or start; followed by space, ), newline, or end.
    pattern = r'(?:(?<=[\s(\[\'`])|(?<=^))(' + "|".join(escaped) + r')(?=[\s)\]]|$)'
    return re.compile(pattern, re.MULTILINE)


def scan_pairs(verbs, pairs):
    """
    Returns:
      per_verb_pair_count   {verb: int}
      per_verb_contexts     {verb: set(context_tag)}
      per_verb_source_files {verb: set(source_file)}
      total_pairs
    """
    names = [v["name"] for v in verbs]
    name_set = set(names)
    regex = build_verb_regex(names)

    per_verb_pair_count = Counter()
    per_verb_contexts = defaultdict(set)
    per_verb_source_files = defaultdict(set)

    for source_file, pair in pairs:
        text = pair_text(pair)
        matches = set(regex.findall(text))  # unique verbs in this pair
        ctx = pair_book(source_file, pair)
        for m in matches:
            if m in name_set:
                per_verb_pair_count[m] += 1
                per_verb_contexts[m].add(ctx)
                per_verb_source_files[m].add(source_file)

    return per_verb_pair_count, per_verb_contexts, per_verb_source_files, len(pairs)


# ─── 4) Tier assignment ─────────────────────────────────────────────────────

# ─── 4a) Architect classification loader ───────────────────────────────────

def load_architect_classification():
    """
    Returns:
      verb_class : {verb_name: "CORE" | "EXTENSION" | "CRUFT"}
      classification_available : bool
      note : str
    """
    if not (ARCHITECT_DOC.exists() and CORE_LIST_PATH.exists()):
        return {}, False, "Architect deliverable NOT present at ~/code/lacuna-labs/design-docs/architect-motoi-core-vs-extension-2026-07-16.slat as of audit run."

    # Extract CORE from motoi-core-verbs-list.slat
    core = set()
    with open(CORE_LIST_PATH, "r") as f:
        for line in f:
            m = re.match(r'\s*\((?:verb|constant) "([^"]+)"\)', line)
            if m:
                core.add(m.group(1))

    # Extract CRUFT from Section 2 of Architect doc — pull all :verbs (...) inside
    # the (cruft-flags-for-alfred ...) block.
    cruft = set()
    with open(ARCHITECT_DOC, "r") as f:
        text = f.read()
    # Find the cruft block and grab the region up to Section 3.
    start = text.find("(cruft-flags-for-alfred")
    end = text.find(";; SECTION 3", start)
    if start > -1 and end > -1:
        cruft_block = text[start:end]
        # Each :verbs (... "verb-name" ...)  — extract every quoted token that looks like a verb name.
        for m in re.finditer(r':verbs\s+\(([^)]*)\)', cruft_block, re.DOTALL):
            payload = m.group(1)
            for vm in re.finditer(r'"([^"]+)"', payload):
                v = vm.group(1)
                # Skip descriptor strings (contain " vs " or spaces or start with lowercase-and-no-slash)
                # Real verbs contain at most / and are single tokens.
                if " " in v:
                    continue
                cruft.add(v)

    verb_class = {}
    # Note: EXTENSION assignment happens against the full verb list in the caller.
    return {"core": core, "cruft": cruft}, True, \
           f"CORE={len(core)} verbs (from motoi-core-verbs-list.slat), CRUFT={len(cruft)} verbs (from Architect Section 2 cruft-flags-for-alfred), EXTENSION=everything-else."


def classify(verb_name, arch_classes):
    if verb_name in arch_classes.get("core", set()):
        return "CORE"
    if verb_name in arch_classes.get("cruft", set()):
        return "CRUFT"
    return "EXTENSION"


def tier_of(pairs, contexts):
    if pairs == 0:
        return "STARVED"
    if pairs <= 4:
        return "THIN"
    if pairs < 20 or len(contexts) < 3:
        return "THIN-CONTEXT"
    return "HEALTHY"


# ─── 5) Gap-fill target suggestions ─────────────────────────────────────────

# Rough mapping from library → book that most likely covers it.
# Waves 1/2 that exist: book-of-scheme (pilot), book-of-extensions, book-of-math,
# book-of-slat (wave 1), book-of-animation, book-of-motion, book-of-music,
# book-of-sound (wave 2). Everything else is a Wave 3+ authoring target.
LIBRARY_TO_BOOK = {
    # Wave 1/2 already extracted — gap likely = extractor missed the verb
    "core":       "book-of-scheme (pilot, already extracted) — extractor gap-fix",
    "alg":        "book-of-math (Wave 1, already extracted) — extractor gap-fix",
    "math":       "book-of-math (Wave 1, already extracted) — extractor gap-fix",
    "animation":  "book-of-animation (Wave 2, already extracted) — extractor gap-fix",
    "motion":     "book-of-motion (Wave 2, already extracted) — extractor gap-fix",
    "easing":     "book-of-motion + book-of-animation (Wave 2) — extractor gap-fix",
    "audio":      "book-of-sound + book-of-music (Wave 2) — extractor gap-fix",
    "synth":      "book-of-sound + book-of-music (Wave 2) — extractor gap-fix",
    "note":       "book-of-music (Wave 2) — extractor gap-fix",
    "beat":       "book-of-music (Wave 2) — extractor gap-fix",
    "transport":  "book-of-music (Wave 2) — extractor gap-fix",
    "pattern":    "book-of-music (Wave 2) — extractor gap-fix",

    # Wave 3 targets — author fresh
    "ai":         "book-of-ai (Wave 3 target) — author fresh",
    "artifact":   "book-of-artifacts (Wave 3 target) — author fresh",
    "cortex":     "book-of-cortex (Wave 3 target) — author fresh",
    "entity":     "book-of-entities (Wave 3 target) — author fresh + book-of-motion cross-refs",
    "world":      "book-of-worlds (Wave 3 target) — author fresh",
    "game":       "book-of-game (Wave 3 target) — author fresh",
    "geom":       "book-of-geometry (Wave 3 target) — author fresh",
    "curve":      "book-of-geometry / book-of-motion (Wave 3 target) — author fresh",
    "vec":        "book-of-geometry (Wave 3 target) — author fresh",
    "linalg":     "book-of-linalg (Wave 3 target) — author fresh",
    "matrix":     "book-of-linalg (Wave 3 target) — author fresh",
    "complex":    "book-of-math (Wave 3 addendum) — author fresh",
    "exact":      "book-of-math (Wave 3 addendum) — author fresh",
    "num":        "book-of-math (Wave 3 addendum) — author fresh",
    "sym":        "book-of-symbolic (Wave 3 target) — author fresh",
    "solve":      "book-of-symbolic (Wave 3 target) — author fresh",
    "calc":       "book-of-calculus (Wave 3 target) — author fresh",
    "stat":       "book-of-stats (Wave 3 target) — author fresh",
    "comb":       "book-of-combinatorics (Wave 3 target) — author fresh",
    "nt":         "book-of-number-theory (Wave 3 target) — author fresh",
    "topo":       "book-of-topology (Wave 3 target) — author fresh",
    "part":       "book-of-partitions (Wave 3 target) — author fresh",
    "group":      "book-of-groups (Wave 3 target) — author fresh",
    "seq":        "book-of-sequences (Wave 3 target) — author fresh",
    "plot":       "book-of-plot (Wave 3 target) — author fresh",
    "phys":       "book-of-physics (Wave 3 target) — author fresh + book-of-motion cross-refs",
    "chem":       "book-of-chemistry (Wave 3 target) — author fresh",
    "sprite":     "book-of-sprites (Wave 3 target) — author fresh + book-of-animation cross-refs",
    "surface":    "book-of-surface (Wave 3 target) — author fresh",
    "grid":       "book-of-grid (Wave 3 target) — author fresh",
    "ops":        "book-of-ops (Wave 3 target) — author fresh",
    "text":       "book-of-text (Wave 3 target) — author fresh",
    "time":       "book-of-time / book-of-timing (Wave 3 target) — author fresh",
    "tick":       "book-of-time / book-of-timing (Wave 3 target) — author fresh",
    "input":      "book-of-input (Wave 3 target) — author fresh",
    "scene":      "book-of-scene (Wave 3 target) — author fresh",
    "juggle":     "book-of-juggle (Wave 3 target) — author fresh",
    "system":     "book-of-system (Wave 3 target) — author fresh",
    "eng":        "book-of-engineering (Wave 3 target) — author fresh",
    "const":      "book-of-const (Wave 3 target) — author fresh",
    "prefab":     "book-of-prefab (Wave 3 target) — author fresh",
    "object":     "book-of-object (Wave 3 target) — author fresh",
    "weather":    "book-of-weather (Wave 3 target) — author fresh",
    "domain":     "book-of-domain (Wave 3 target) — author fresh",
    "route":      "book-of-route (Wave 3 target) — author fresh",
    "floor":      "book-of-floor (Wave 3 target) — author fresh",
    "collision":  "book-of-collision (Wave 3 target) — author fresh",
    "base":       "hand-authored verb-signature drill (Wave 3)",
}

def suggest_source(verb):
    lib = verb.get("library") or "unknown"
    return LIBRARY_TO_BOOK.get(lib, f"book-of-{lib} (author fresh Wave 3+)")


# ─── 6) SLAT writers ────────────────────────────────────────────────────────

def slat_escape(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

def write_audit(verbs, per_verb_pair_count, per_verb_contexts,
                per_verb_source_files, total_pairs, out_path,
                arch_classes, arch_available, arch_note):
    # Tier tallies + verb→tier
    tier_verbs = defaultdict(list)
    for v in verbs:
        name = v["name"]
        pc = per_verb_pair_count.get(name, 0)
        cs = per_verb_contexts.get(name, set())
        t = tier_of(pc, cs)
        tier_verbs[t].append((name, pc, len(cs), v.get("library", "unknown")))

    # Sort each tier by (pair_count asc, name)
    for t in tier_verbs:
        tier_verbs[t].sort(key=lambda x: (x[1], x[0]))

    # Per-library breakdown of each tier
    lib_tier = defaultdict(lambda: Counter())
    for t, entries in tier_verbs.items():
        for name, pc, ctx, lib in entries:
            lib_tier[lib][t] += 1

    lines = []
    lines.append(';;; motoi-copilot-coverage-audit-2026-07-16.slat')
    lines.append(';;;')
    lines.append(';;; Coverage audit: 958-verb Motoi reference vs Copilot training corpus.')
    lines.append(';;;')
    lines.append(';;; :audience         :engineer')
    lines.append(';;; :confidentiality  :internal')
    lines.append(';;; :training-eligible #f  ; report about training data, not training data itself')
    lines.append(';;; :doc              "motoi-copilot-coverage-audit"')
    lines.append(';;; :dialect          "motoi"')
    lines.append(';;; :provenance       "the-engineer coverage-audit-lane 2026-07-16"')
    lines.append(';;; :tags             (:motoi :training :coverage :audit :wave-3-planning)')
    lines.append('')
    lines.append('(document')
    lines.append('  :name          "motoi-copilot-coverage-audit-2026-07-16"')
    lines.append('  :date          "2026-07-16"')
    lines.append('  :owner         "The Engineer"')
    lines.append('  :audience      :engineer')
    lines.append('  :confidentiality :internal')
    lines.append('  :dialect       "motoi"')
    lines.append(f'  :reference     "/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat"')
    lines.append(f'  :verb-count    {len(verbs)}')
    lines.append(f'  :verb-count-note "Reference file header states 958 verbs; actual file contains 962 (verb ...) blocks with 13 duplicate :name entries. This audit uses the {len(verbs)}-unique-name set."')
    lines.append(f'  :corpus-pairs  {total_pairs}')
    lines.append('  :corpus-files (')
    for path in sorted(TRAINING_DIR.glob("*.jsonl")):
        lines.append(f'    "{path.name}"')
    lines.append('  )')
    lines.append('  :research-basis "lacuna-labs/research/small-model-dsl-teaching-2026-07-16.slat — ≥20 pairs across ≥3 contexts per verb"')
    lines.append('  :context-definition "Copilot JSONL pairs currently carry only file-level provenance (no per-pair chapter tag). \'Contexts\' here = the count of DISTINCT SOURCE FILES (i.e. distinct books/waves) in which the verb appears. With 8 source files today, max-contexts=8. This is a coarser proxy than chapter-level tagging; recommend adding chapter provenance to future extractor output for a finer signal."')
    lines.append('  :tier-thresholds "STARVED=0 pairs · THIN=1-4 pairs · THIN-CONTEXT=5-19 pairs OR <3 distinct books · HEALTHY=≥20 pairs AND ≥3 distinct books"')
    lines.append(')')
    lines.append('')

    # ── Summary
    lines.append('(summary')
    lines.append(f'  :starved      {len(tier_verbs["STARVED"])}')
    lines.append(f'  :thin         {len(tier_verbs["THIN"])}')
    lines.append(f'  :thin-context {len(tier_verbs["THIN-CONTEXT"])}')
    lines.append(f'  :healthy      {len(tier_verbs["HEALTHY"])}')
    lines.append(f'  :total        {len(verbs)}')
    lines.append(')')
    lines.append('')

    # ── Per-library tier breakdown
    lines.append('(per-library-tier-breakdown')
    for lib in sorted(lib_tier.keys()):
        tc = lib_tier[lib]
        lines.append(f'  (library :name "{lib}"'
                     f' :starved {tc["STARVED"]}'
                     f' :thin {tc["THIN"]}'
                     f' :thin-context {tc["THIN-CONTEXT"]}'
                     f' :healthy {tc["HEALTHY"]})')
    lines.append(')')
    lines.append('')

    # ── Per-tier verb lists
    for tname in ("STARVED", "THIN", "THIN-CONTEXT", "HEALTHY"):
        lines.append(f'(tier :name "{tname}" :count {len(tier_verbs[tname])} :verbs (')
        for name, pc, cs, lib in tier_verbs[tname]:
            lines.append(f'  (:verb "{name}" :library "{lib}" :pairs {pc} :contexts {cs})')
        lines.append('))')
        lines.append('')

    # ── Gap-fill plan
    lines.append('(gap-fill-plan')
    lines.append('  :philosophy "Alfred: check what other data I need to add. Wave 3 authoring targets below. Prefer extractor gap-fix on already-authored books first (cheap), then hand-authored drills for verbs with no natural book home."')
    lines.append('')

    # Aggregate suggestions by target
    gap_targets = defaultdict(list)
    for t in ("STARVED", "THIN", "THIN-CONTEXT"):
        for name, pc, cs, lib in tier_verbs[t]:
            target = LIBRARY_TO_BOOK.get(lib, f"book-of-{lib} (author fresh Wave 3+)")
            need = max(20 - pc, 0)
            gap_targets[target].append((name, lib, pc, cs, need, t))

    total_hand_authored_pair_gap = 0
    for target, entries in sorted(gap_targets.items()):
        gap_sum = sum(e[4] for e in entries)
        total_hand_authored_pair_gap += gap_sum
        lines.append(f'  (target :book "{slat_escape(target)}"')
        lines.append(f'    :verbs-under-covered {len(entries)}')
        lines.append(f'    :estimated-pairs-needed {gap_sum}  ; sum of (20 - current-pair-count) across under-covered verbs')
        # Show up to top 30 worst verbs per target
        entries.sort(key=lambda x: (x[2], x[0]))
        show = entries[:30]
        lines.append('    :top-verbs (')
        for name, lib, pc, cs, need, t in show:
            lines.append(f'      (:verb "{name}" :library "{lib}" :current-pairs {pc} :contexts {cs} :tier "{t}" :pairs-needed-to-heal {need})')
        if len(entries) > 30:
            lines.append(f'      ; ...{len(entries)-30} more; see gap-list SLAT for the flat exhaustive list')
        lines.append('    ))')
    lines.append(')')
    lines.append('')

    # ── Hand-authored gap estimate
    lines.append('(hand-authoring-gap-estimate')
    lines.append(f'  :total-under-covered-verbs {len(tier_verbs["STARVED"])+len(tier_verbs["THIN"])+len(tier_verbs["THIN-CONTEXT"])}')
    lines.append(f'  :naive-total-pairs-to-heal {total_hand_authored_pair_gap}  ; sum-of (20 - current) across all under-covered verbs')
    lines.append('  :realistic-plan')
    lines.append('  "Approximately 60-70 percent of this gap should be closed by (a) fixing the extractor to catch already-authored uses, and (b) authoring targeted Wave 3 books (see gap-fill-plan targets). The remaining ~30 percent (verbs with no natural book home — mostly setter!/getter/predicate accessor triads) needs hand-authored verb-signature drills (3-tier examples per verb, 5-10 pairs each verb)."')
    lines.append(f'  :hand-authored-drill-pairs-estimated {total_hand_authored_pair_gap // 3}  ; ~1/3 of gap needs pure drills')
    lines.append('  :extractor-recoverable-pairs-estimated {}  ; ~2/3 recoverable via book-extractor fixes + Wave 3 authoring'.format(2 * total_hand_authored_pair_gap // 3))
    lines.append(')')
    lines.append('')

    # ── Architect cross-ref
    lines.append('(architect-cross-ref')
    if not arch_available:
        lines.append('  :status :pending-architect')
        lines.append('  :note "Architect classification lane (agent a59bf953352cf6602) has NOT landed at ~/code/lacuna-labs/design-docs/architect-motoi-core-vs-extension-2026-07-16.slat as of this audit run. When it lands, cross-reference: CORE&(STARVED|THIN)=P1, CORE&HEALTHY=OK, EXTENSION&(STARVED|THIN)=P3, EXTENSION&HEALTHY=OK, CRUFT=NO NEED."')
        lines.append('  :architect-deliverable "~/code/lacuna-labs/design-docs/architect-motoi-core-vs-extension-2026-07-16.slat"')
    else:
        lines.append('  :status :architect-available')
        lines.append(f'  :architect-doc "{ARCHITECT_DOC}"')
        lines.append(f'  :classification-note "{slat_escape(arch_note)}"')
        lines.append('  :terminology-note "Architect uses EXTENSION language; Alfred wants MODULE per hour-12b lock. Semantically equivalent — everything not CORE and not CRUFT."')
        lines.append('')

        # Build cross-ref matrix: {(class, tier): [verb, ...]}
        matrix = defaultdict(list)
        for v in verbs:
            n = v["name"]
            pc = per_verb_pair_count.get(n, 0)
            cs = per_verb_contexts.get(n, set())
            t = tier_of(pc, cs)
            cls = classify(n, arch_classes)
            matrix[(cls, t)].append((n, pc, len(cs), v.get("library", "?")))

        # Priority summary per doctrine:
        #   P1 = CORE & (STARVED | THIN | THIN-CONTEXT) — must fix before training
        #   OK-CORE = CORE & HEALTHY
        #   P3 = EXTENSION & (STARVED | THIN | THIN-CONTEXT) — fine, lookup at use
        #   OK-EXT = EXTENSION & HEALTHY
        #   NO-NEED = CRUFT (any tier)
        def cnt(cls, t):
            return len(matrix.get((cls, t), []))

        p1_core_starved = cnt("CORE", "STARVED")
        p1_core_thin = cnt("CORE", "THIN")
        p1_core_thin_ctx = cnt("CORE", "THIN-CONTEXT")
        p1_total = p1_core_starved + p1_core_thin + p1_core_thin_ctx
        ok_core = cnt("CORE", "HEALTHY")
        p3_ext_starved = cnt("EXTENSION", "STARVED")
        p3_ext_thin = cnt("EXTENSION", "THIN")
        p3_ext_thin_ctx = cnt("EXTENSION", "THIN-CONTEXT")
        p3_total = p3_ext_starved + p3_ext_thin + p3_ext_thin_ctx
        ok_ext = cnt("EXTENSION", "HEALTHY")
        no_need = cnt("CRUFT", "STARVED") + cnt("CRUFT", "THIN") + \
                  cnt("CRUFT", "THIN-CONTEXT") + cnt("CRUFT", "HEALTHY")

        lines.append('  (priority-summary')
        lines.append(f'    :P1-core-under-covered       {p1_total}  ; MUST FIX BEFORE TRAINING (CORE + STARVED/THIN/THIN-CONTEXT)')
        lines.append(f'      :P1-core-starved            {p1_core_starved}')
        lines.append(f'      :P1-core-thin               {p1_core_thin}')
        lines.append(f'      :P1-core-thin-context       {p1_core_thin_ctx}')
        lines.append(f'    :OK-core-healthy             {ok_core}  ; on-target')
        lines.append(f'    :P3-extension-under-covered  {p3_total}  ; OK — model looks up at usage')
        lines.append(f'      :P3-extension-starved       {p3_ext_starved}')
        lines.append(f'      :P3-extension-thin          {p3_ext_thin}')
        lines.append(f'      :P3-extension-thin-context  {p3_ext_thin_ctx}')
        lines.append(f'    :OK-extension-healthy        {ok_ext}  ; over-covered but harmless')
        lines.append(f'    :NO-NEED-cruft               {no_need}  ; archived from ship; ignore for training')
        lines.append('  )')
        lines.append('')

        # Enumerate P1 verbs (CORE + STARVED/THIN/THIN-CONTEXT)
        p1_entries = []
        for t in ("STARVED", "THIN", "THIN-CONTEXT"):
            for name, pc, cs, lib in matrix.get(("CORE", t), []):
                p1_entries.append((name, lib, t, pc, cs))
        p1_entries.sort(key=lambda x: ({"STARVED":0,"THIN":1,"THIN-CONTEXT":2}[x[2]], x[3], x[0]))

        lines.append(f'  (P1-verbs-must-fix-before-training :count {len(p1_entries)} :verbs (')
        for name, lib, t, pc, cs in p1_entries:
            lines.append(f'    (:verb "{name}" :library "{lib}" :tier "{t}" :pairs {pc} :contexts {cs})')
        lines.append('  ))')
        lines.append('')

    lines.append(')')
    lines.append('')

    lines.append('(closeout')
    lines.append('  :notes ("This audit is empirical — pair counts are direct textual scans; verb names matched with token boundaries so no false-positive substrings."')
    lines.append('         "The extractor gap dominates. Many library-native verbs (motion, math, animation, sound, music) landed 0 pairs despite their books being Wave-1/Wave-2 extracted — the extractor is missing them (see extension-book yield vs verb count)."')
    lines.append('         "THIN-CONTEXT artifact: 40+ verbs sit in THIN-CONTEXT with hundreds-to-thousands of pairs (world/spawn=1444, world/step=1343, note/strike=861, world/reset!=685, entity/sprite!=662, entity/set-vel!=323) purely because pair provenance is file-level and they live in only 2 source files. Fix by (a) adding chapter provenance to future JSONL output OR (b) relaxing the ≥3-contexts threshold when pair count is ≥100."')
    lines.append('         "Recommendation to Alfred: (1) fix extractor to catch already-authored verb uses; (2) add chapter-level provenance to JSONL pairs; (3) re-run this audit; (4) dispatch Wave 3 for the residual P1 CORE-starved list; (5) skip P3 EXTENSION verbs — model looks them up at usage; (6) skip NO-NEED CRUFT.")')
    lines.append(')')

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")


def write_gaplist(verbs, per_verb_pair_count, per_verb_contexts, out_path,
                  arch_classes, arch_available):
    """
    Flat SLAT list: every STARVED/THIN verb with its metadata. This is the
    authoring worklist for the next Copilot wave.
    """
    lines = []
    lines.append(';;; coverage-gap-list.slat')
    lines.append(';;;')
    lines.append(';;; Flat list of under-covered Motoi verbs (STARVED + THIN + THIN-CONTEXT).')
    lines.append(';;; Feed to Wave 3+ Copilot corpus authoring lanes.')
    lines.append(';;;')
    lines.append(';;; :audience         :engineer')
    lines.append(';;; :confidentiality  :internal')
    lines.append(';;; :training-eligible #f')
    lines.append(';;; :doc              "coverage-gap-list"')
    lines.append(';;; :dialect          "motoi"')
    lines.append(';;; :provenance       "the-engineer coverage-audit-lane 2026-07-16"')
    lines.append(';;; :tags             (:motoi :training :coverage :gap-list :wave-3)')
    lines.append('')
    lines.append('(gap-list')
    lines.append('  :source-audit "/Users/alfred/code/lacuna-labs/reports/motoi-copilot-coverage-audit-2026-07-16.slat"')
    lines.append('  :date         "2026-07-16"')
    lines.append('  :owner        "The Engineer"')
    lines.append('  :verbs (')

    # Sort: PRIORITY (P1 CORE-under-covered first, then P3 EXTENSION-under-covered),
    # then STARVED-first within priority, then by library, then by name.
    tier_rank = {"STARVED": 0, "THIN": 1, "THIN-CONTEXT": 2}
    rows = []
    for v in verbs:
        name = v["name"]
        pc = per_verb_pair_count.get(name, 0)
        cs = len(per_verb_contexts.get(name, set()))
        t = tier_of(pc, per_verb_contexts.get(name, set()))
        if t in tier_rank:
            if arch_available:
                cls = classify(name, arch_classes)
                if cls == "CRUFT":
                    prio = "NO-NEED"
                elif cls == "CORE":
                    prio = "P1"
                else:
                    prio = "P3"
            else:
                cls = "UNCLASSIFIED"
                prio = "P0-pending-architect"
            prio_rank = {"P1": 0, "P3": 1, "NO-NEED": 2, "P0-pending-architect": 3}[prio]
            rows.append((prio_rank, tier_rank[t], v.get("library", "unknown"), name, pc, cs, t, prio, cls))
    rows.sort()

    for _, _, lib, name, pc, cs, t, prio, cls in rows:
        target = LIBRARY_TO_BOOK.get(lib, f"book-of-{lib} (author fresh Wave 3+)")
        need = max(20 - pc, 0)
        lines.append(f'    (:verb "{name}" :library "{lib}" :architect-class "{cls}" :priority "{prio}" :tier "{t}" :current-pairs {pc} :contexts {cs} :pairs-needed {need} :suggested-target "{slat_escape(target)}")')

    lines.append('  )')
    lines.append(f'  :verb-count {len(rows)}')
    if arch_available:
        # Priority totals
        from collections import Counter
        pc = Counter(r[7] for r in rows)
        lines.append(f'  :priority-breakdown (:P1 {pc["P1"]} :P3 {pc["P3"]} :NO-NEED {pc["NO-NEED"]})')
        lines.append('  :priority-doctrine "P1 = CORE + under-covered — MUST fix before training run. P3 = EXTENSION + under-covered — OK to defer; model looks it up at usage. NO-NEED = CRUFT — do not author training pairs; verb is archived from ship."')
    lines.append(')')

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")


# ─── main ──────────────────────────────────────────────────────────────────

def main():
    print("[1/4] Extracting verbs from reference...")
    verbs = extract_verbs(REFERENCE_PATH)
    print(f"       extracted {len(verbs)} verbs")

    print("[2/4] Loading training pairs...")
    pairs = load_pairs()
    print(f"       loaded {len(pairs)} pairs from {len(list(TRAINING_DIR.glob('*.jsonl')))} files")

    print("[3/4] Scanning pairs for verb occurrences...")
    per_verb_pair_count, per_verb_contexts, per_verb_source_files, total_pairs = \
        scan_pairs(verbs, pairs)

    # Tier summary
    tiers = Counter()
    for v in verbs:
        n = v["name"]
        pc = per_verb_pair_count.get(n, 0)
        cs = per_verb_contexts.get(n, set())
        tiers[tier_of(pc, cs)] += 1
    print(f"       STARVED={tiers['STARVED']} THIN={tiers['THIN']} "
          f"THIN-CONTEXT={tiers['THIN-CONTEXT']} HEALTHY={tiers['HEALTHY']}")

    print("[3.5/4] Loading Architect classification...")
    arch_classes, arch_available, arch_note = load_architect_classification()
    print(f"       architect-available={arch_available}")
    if arch_available:
        print(f"       {arch_note}")

    print("[4/4] Writing SLAT reports...")
    write_audit(verbs, per_verb_pair_count, per_verb_contexts,
                per_verb_source_files, total_pairs, OUT_AUDIT,
                arch_classes, arch_available, arch_note)
    write_gaplist(verbs, per_verb_pair_count, per_verb_contexts, OUT_GAPLIST,
                  arch_classes, arch_available)
    print(f"       audit  → {OUT_AUDIT}")
    print(f"       gaps   → {OUT_GAPLIST}")

    # ── Top-20 STARVED for report
    starved_verbs = []
    for v in verbs:
        n = v["name"]
        if per_verb_pair_count.get(n, 0) == 0:
            starved_verbs.append((n, v.get("library", "?")))
    starved_verbs.sort()
    print("\n── Top-20 STARVED verbs (alphabetical) ──")
    for n, lib in starved_verbs[:20]:
        print(f"  {n}  [{lib}]")
    print(f"\n(total STARVED: {len(starved_verbs)})")

if __name__ == "__main__":
    main()
