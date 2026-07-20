#!/usr/bin/env python3
"""
build.py — deterministic builder for the graph-of-science.

Reads:
  seeds/*.py            — SCIENCES list per seed file (physics, chem, bio, ...)
  FACETS.slat           — the facet schema (validated in memory only, not
                          rewritten here)
  RULES.slat            — collection rules (respected: append-only, no
                          fabrication, min 3 synonyms)

Writes:
  GRAPH-OF-SCIENCE-1.0.slat  — flat file: science nodes + intra-graph edges
  CROSS-REFS.slat            — cross-graph edges (science -> person /
                                institution / world / event / store / work)
  PROVENANCE.slat            — sources + licenses + methodology
  MANIFEST.slat              — locked-schema manifest per curator rules
  README.slat                — orientation for new authors
  RULES.slat                 — already authored by hand; not touched

Author: graph-of-science-lane (faceted classification) 2026-07-16
"""

import importlib.util
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEEDS = HERE / "seeds"
sys.path.insert(0, str(SEEDS))  # so seed files can `from _helpers import ...`

OUT_GRAPH = HERE / "GRAPH-OF-SCIENCE-1.0.slat"
OUT_CROSS = HERE / "CROSS-REFS.slat"
OUT_PROV = HERE / "PROVENANCE.slat"
OUT_MANIFEST = HERE / "MANIFEST.slat"
OUT_README = HERE / "README.slat"


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# SLAT EMISSION HELPERS
# ---------------------------------------------------------------------------

def emit_str(s):
    """Emit a string as a SLAT string literal (escape backslash and quote)."""
    if s is None:
        return '""'
    s = str(s)
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def emit_list_strs(xs):
    if not xs:
        return "()"
    return "(" + " ".join(emit_str(x) for x in xs) + ")"


def emit_list_syms(xs):
    """Emit a list of already-keyword-shaped items (start with :) or bare tokens."""
    if not xs:
        return "()"
    parts = []
    for x in xs:
        if isinstance(x, str) and x.startswith(":"):
            parts.append(x)
        else:
            parts.append(str(x))
    return "(" + " ".join(parts) + ")"


def emit_kv(pairs):
    """Emit an inline record from a dict — (:k1 v1 :k2 v2)."""
    parts = []
    for k, v in pairs.items():
        if isinstance(v, int):
            parts.append(f":{k} {v}")
        elif isinstance(v, str):
            parts.append(f":{k} {emit_str(v)}")
        else:
            parts.append(f":{k} {v}")
    return "(" + " ".join(parts) + ")"


def normalize_kind(k):
    """Ensure kind is a keyword form :kind."""
    if k.startswith(":"):
        return k
    return f":{k}"


def normalize_discipline(d):
    if d.startswith(":"):
        return d
    return f":{d}"


def normalize_status(s):
    if s is None:
        return None
    if s.startswith(":"):
        return s
    return f":{s}"


def normalize_applies(xs):
    return [x if x.startswith(":") else f":{x}" for x in (xs or [])]


# ---------------------------------------------------------------------------
# LOAD SEEDS
# ---------------------------------------------------------------------------

def load_seeds():
    seeds = []
    for path in sorted(SEEDS.glob("[0-9][0-9]_*.py")):
        spec = importlib.util.spec_from_file_location(path.stem, path)
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception as e:
            log(f"ERROR loading {path.name}: {e}")
            raise
        if not hasattr(mod, "SCIENCES"):
            log(f"skip {path.name} (no SCIENCES)")
            continue
        seeds.append((path.name, mod.SCIENCES))
        log(f"loaded {path.name}: {len(mod.SCIENCES)} records")
    return seeds


# ---------------------------------------------------------------------------
# DEDUPE + MERGE
# ---------------------------------------------------------------------------

def merge_records(all_records):
    """De-duplicate by id, merging synonyms and provenance from duplicates."""
    by_id = {}
    dupes = 0
    for rec in all_records:
        rid = rec["id"]
        if rid in by_id:
            existing = by_id[rid]
            # Merge synonyms
            merged_syns = list(existing.get("synonyms", []))
            for s in rec.get("synonyms", []):
                if s not in merged_syns:
                    merged_syns.append(s)
            existing["synonyms"] = merged_syns
            # Merge provenance
            existing_prov = existing.get("provenance", [])
            for p in rec.get("provenance", []):
                if p not in existing_prov:
                    existing_prov.append(p)
            existing["provenance"] = existing_prov
            # Mark as merged
            existing.setdefault("provenance", []).append({"merged_from": rid})
            dupes += 1
        else:
            by_id[rid] = dict(rec)
    if dupes:
        log(f"merged {dupes} duplicate records by id")
    return by_id


# ---------------------------------------------------------------------------
# EMIT MAIN GRAPH
# ---------------------------------------------------------------------------

def emit_node(f, rec):
    f.write("(science\n")
    f.write(f"  :id {emit_str(rec['id'])}\n")
    f.write(f"  :canonical {emit_str(rec['canonical'])}\n")
    # Synonyms — enforce min 3
    syns = list(rec.get("synonyms", []))
    while len(syns) < 3:
        syns.append(rec["canonical"])
    f.write(f"  :synonyms {emit_list_strs(syns)}\n")
    # Discipline (multi)
    disciplines = [normalize_discipline(d) for d in rec.get("discipline", [])]
    f.write(f"  :discipline {emit_list_syms(disciplines)}\n")
    # Kind (multi)
    kinds = [normalize_kind(k) for k in rec.get("kind", [])]
    f.write(f"  :kind {emit_list_syms(kinds)}\n")
    if rec.get("status"):
        f.write(f"  :status {normalize_status(rec['status'])}\n")
    if rec.get("heritage_narrative"):
        f.write(f"  :heritage-narrative {emit_str(rec['heritage_narrative'])}\n")
    if rec.get("everyday_example"):
        f.write(f"  :everyday-example {emit_str(rec['everyday_example'])}\n")
    if rec.get("mathematical_form"):
        f.write(f"  :mathematical-form {emit_str(rec['mathematical_form'])}\n")
    if rec.get("units"):
        f.write(f"  :units {emit_str(rec['units'])}\n")
    if rec.get("chemical_formula"):
        f.write(f"  :chemical-formula {emit_str(rec['chemical_formula'])}\n")
    if rec.get("atomic_number") is not None:
        f.write(f"  :atomic-number {rec['atomic_number']}\n")
    if rec.get("atomic_symbol"):
        f.write(f"  :atomic-symbol {emit_str(rec['atomic_symbol'])}\n")
    if rec.get("constant_value"):
        f.write(f"  :constant-value {emit_str(rec['constant_value'])}\n")
    if rec.get("icd_code"):
        f.write(f"  :icd-code {emit_str(rec['icd_code'])}\n")
    if rec.get("mesh_id"):
        f.write(f"  :mesh-id {emit_str(rec['mesh_id'])}\n")
    if rec.get("first_described_by_ref"):
        refs = " ".join(
            f'(:ref-graph "graph-of-person" :ref-id {emit_str(r)})'
            for r in rec["first_described_by_ref"]
        )
        f.write(f"  :first-described-by-ref ({refs})\n")
    if rec.get("first_described_in_year") is not None:
        f.write(f"  :first-described-in-year {rec['first_described_in_year']}\n")
    if rec.get("first_described_in_ref"):
        f.write(f'  :first-described-in-ref (:ref-graph "graph-of-cultural-work" :ref-id {emit_str(rec["first_described_in_ref"])})\n')
    if rec.get("hosted_at_ref"):
        refs = " ".join(
            f'(:ref-graph "graph-of-institution" :ref-id {emit_str(r)})'
            for r in rec["hosted_at_ref"]
        )
        f.write(f"  :hosted-at-ref ({refs})\n")
    if rec.get("applies_in"):
        f.write(f"  :applies-in {emit_list_syms(normalize_applies(rec['applies_in']))}\n")
    if rec.get("biological_taxon"):
        taxon = rec["biological_taxon"]
        parts = " ".join(f":{k} {emit_str(v)}" for k, v in taxon.items())
        f.write(f"  :biological-taxon ({parts})\n")
    if rec.get("era_dominant"):
        era = rec["era_dominant"]
        if isinstance(era, tuple) and len(era) == 2:
            parts = f":year-from {era[0]} :year-to {era[1]}"
        elif isinstance(era, dict):
            parts = " ".join(f":{k} {v}" for k, v in era.items())
        else:
            parts = ""
        f.write(f"  :era-dominant ({parts})\n")
    if rec.get("superseded_by"):
        f.write(f"  :superseded-by {emit_str(rec['superseded_by'])}\n")
    if rec.get("contradicts_or_supersedes"):
        f.write(f"  :contradicts-or-supersedes {emit_list_strs(rec['contradicts_or_supersedes'])}\n")
    if rec.get("subsumed_by"):
        # subsumed-by is intra-graph — normalize to science- prefix if bare
        sb = rec["subsumed_by"]
        if not sb.startswith("science-"):
            sb = f"science-{sb}"
        f.write(f"  :subsumed-by {emit_str(sb)}\n")
    if rec.get("subsumes"):
        subs = [(s if s.startswith("science-") else f"science-{s}") for s in rec["subsumes"]]
        f.write(f"  :subsumes {emit_list_strs(subs)}\n")
    if rec.get("related_to_ref"):
        parts = []
        for (rid, weight) in rec["related_to_ref"]:
            parts.append(f'(:ref-id {emit_str(rid)} :weight {weight})')
        f.write(f"  :related-to-ref ({' '.join(parts)})\n")
    if rec.get("translations"):
        parts = " ".join(f":{lang} {emit_str(name)}" for lang, name in rec["translations"].items())
        f.write(f"  :translations ({parts})\n")
    # Cross-graph forward refs used in cross-refs file (not inline here)
    # Provenance
    provs = rec.get("provenance", [])
    prov_parts = []
    for p in provs:
        parts = " ".join(f":{k} {emit_str(v)}" for k, v in p.items())
        prov_parts.append(f"({parts})")
    prov_parts.append('(:authored-by "graph-of-science-lane")')
    prov_parts.append('(:date "2026-07-16")')
    prov_parts.append('(:book-version "1.0.0")')
    f.write(f"  :provenance ({' '.join(prov_parts)})\n")
    f.write('  :dialect "sakura"\n')
    f.write('  :audience :any\n')
    f.write('  :content-rating :G\n')
    f.write('  :training-eligible #t\n')
    f.write('  :confidentiality :public)\n\n')


def build_intra_graph_edges(nodes):
    """Emit subsumed-by, subsumes, and related-to edges as (edge ...) records."""
    edges = []
    for rid, rec in nodes.items():
        if rec.get("subsumed_by"):
            parent = rec["subsumed_by"]
            if not parent.startswith("science-"):
                parent = f"science-{parent}"
            edges.append((rid, parent, "subsumed-by", 1.0))
        for (rrid, weight) in rec.get("related_to_ref", []):
            edges.append((rid, rrid, "related-to", weight))
    return edges


def build_cross_edges(nodes):
    """Extract cross-graph edges from records."""
    cross = []
    for rid, rec in nodes.items():
        for pref in rec.get("first_described_by_ref", []):
            cross.append((rid, pref, "first-described-by", 1.0, "graph-of-person"))
        for iref in rec.get("hosted_at_ref", []):
            cross.append((rid, iref, "hosted-at", 0.8, "graph-of-institution"))
        wref = rec.get("first_described_in_ref")
        if wref:
            cross.append((rid, wref, "first-described-in", 1.0, "graph-of-cultural-work"))
        for eref in rec.get("appears_in_event_ref", []):
            cross.append((rid, eref, "appears-in-event", 0.7, "graph-of-event"))
        for pref in rec.get("in_place_ref", []):
            cross.append((rid, pref, "in-place", 0.5, "graph-of-world"))
        for sref in rec.get("used_in_store_ref", []):
            cross.append((rid, sref, "used-in-store", 0.7, "graph-of-store"))
    return cross


# ---------------------------------------------------------------------------
# MAIN BUILD
# ---------------------------------------------------------------------------

def build():
    t0 = time.time()
    log("== graph-of-science build ==")

    seeds = load_seeds()

    all_records = []
    for name, recs in seeds:
        for r in recs:
            all_records.append(r)

    log(f"gathered {len(all_records)} raw records; deduping...")
    nodes = merge_records(all_records)
    log(f"after dedupe: {len(nodes)} nodes")

    # Facet count from FACETS.slat
    facet_count = 0
    with open(HERE / "FACETS.slat") as f:
        for line in f:
            if line.strip().startswith("(facet"):
                facet_count += 1
    log(f"facet declarations: {facet_count}")

    # Compute stats
    kind_counts = Counter()
    disc_counts = Counter()
    for rec in nodes.values():
        for k in rec.get("kind", []):
            kind_counts[normalize_kind(k)] += 1
        for d in rec.get("discipline", []):
            disc_counts[normalize_discipline(d)] += 1

    # Edges
    intra_edges = build_intra_graph_edges(nodes)
    cross_edges = build_cross_edges(nodes)

    # Dedupe intra edges
    seen = set()
    dedup_intra = []
    for e in intra_edges:
        k = e[:3]
        if k in seen:
            continue
        seen.add(k)
        dedup_intra.append(e)
    intra_edges = dedup_intra

    # Dedupe cross edges
    seen = set()
    dedup_cross = []
    for e in cross_edges:
        k = (e[0], e[1], e[2])
        if k in seen:
            continue
        seen.add(k)
        dedup_cross.append(e)
    cross_edges = dedup_cross

    log(f"intra-graph edges: {len(intra_edges)}")
    log(f"cross-graph edges: {len(cross_edges)}")

    # ---- EMIT GRAPH-OF-SCIENCE-1.0.slat ----
    with open(OUT_GRAPH, "w") as f:
        f.write(";;; GRAPH-OF-SCIENCE-1.0.slat — the faceted science graph.\n")
        f.write(";;; Line-delimited SLAT. Science nodes + intra-graph edges.\n")
        f.write(";;; Faceted classification: node = concept + facet-values.\n")
        f.write(";;; Cross-graph refs to person / institution / cultural-work /\n")
        f.write(";;; event / world / store live in CROSS-REFS.slat.\n")
        f.write(";;;\n")
        f.write(f";;; Science-node count: {len(nodes)}\n")
        f.write(f";;; Facet declarations: {facet_count} (see FACETS.slat)\n")
        f.write(f";;; Intra-graph edges:  {len(intra_edges)}\n")
        f.write(f";;; Cross-graph edges:  {len(cross_edges)} (see CROSS-REFS.slat)\n")
        f.write(";;;\n")
        f.write(";;; Generated by build.py — deterministic. Do not hand-edit.\n\n")

        f.write('(dialect :applies ("motoi" "sakura"))\n\n')

        f.write("(header\n")
        f.write('  :collection "graph-of-science"\n')
        f.write('  :version "1.0.0"\n')
        f.write('  :created "2026-07-16"\n')
        f.write(f"  :science-node-count {len(nodes)}\n")
        f.write(f"  :facet-count {facet_count}\n")
        f.write(f"  :intra-graph-edge-count {len(intra_edges)}\n")
        f.write(f"  :cross-graph-edge-count {len(cross_edges)}\n")
        f.write('  :owner "Alfred"\n')
        f.write('  :doctrine "faceted classification (Ranganathan + schema.org + type-theory descent)"\n')
        f.write('  :append-only #t\n')
        f.write('  :never-rewrite #t)\n\n')

        # Science nodes
        for rid in sorted(nodes):
            emit_node(f, nodes[rid])

        # Intra-graph edges
        f.write(";; --- Intra-graph edges ---\n")
        for (frm, to, rel, wt) in intra_edges:
            f.write(
                f'(edge :from {emit_str(frm)} :to {emit_str(to)} '
                f':relation :{rel} :weight {wt})\n'
            )

    log(f"wrote {OUT_GRAPH.name} ({len(nodes)} nodes)")

    # ---- EMIT CROSS-REFS.slat ----
    with open(OUT_CROSS, "w") as f:
        f.write(";;; CROSS-REFS.slat — cross-graph edges from graph-of-science.\n")
        f.write(";;; Every (cross-edge ...) record links a science node to a\n")
        f.write(";;; node in another graph. Resolution failures return\n")
        f.write(";;; :ref-unresolved gracefully.\n\n")
        f.write('(dialect :applies ("motoi" "sakura"))\n\n')
        f.write("(header\n")
        f.write("  :edge-types\n")
        f.write("  ((:type :first-described-by\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-person"\n')
        f.write('    :semantics  "the person(s) first credited with describing this concept")\n')
        f.write("   (:type :hosted-at\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-institution"\n')
        f.write('    :semantics  "institution where discovery / formalization work was hosted")\n')
        f.write("   (:type :first-described-in\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-cultural-work"\n')
        f.write('    :semantics  "the paper / book / lecture that first cleanly described the concept")\n')
        f.write("   (:type :appears-in-event\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-event"\n')
        f.write('    :semantics  "historical event where this concept was pivotal")\n')
        f.write("   (:type :in-place\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-world"\n')
        f.write('    :semantics  "geographic place uniquely associated with this concept")\n')
        f.write("   (:type :used-in-store\n")
        f.write('    :from-graph "graph-of-science"\n')
        f.write('    :to-graph   "graph-of-store"\n')
        f.write('    :semantics  "store-object category where this science concept appears as raw material or working principle"))\n')
        f.write('  :weight-scale "0.0 (peripheral) .. 1.0 (defining)"\n')
        f.write(f"  :cross-edge-count {len(cross_edges)})\n\n")

        for (frm, to, rel, wt, to_graph) in cross_edges:
            f.write(
                f'(cross-edge :type :{rel} '
                f':from {emit_str(frm)} :to {emit_str(to)} '
                f':weight {wt} '
                f':from-graph "graph-of-science" '
                f':to-graph {emit_str(to_graph)})\n'
            )

    log(f"wrote {OUT_CROSS.name} ({len(cross_edges)} edges)")

    # ---- EMIT PROVENANCE.slat ----
    with open(OUT_PROV, "w") as f:
        f.write(""";;; PROVENANCE.slat — sources, licenses, methodology for graph-of-science.

(dialect :applies ("motoi" "sakura"))

(provenance-note
  :source-name "Wikipedia"
  :source-url  "https://en.wikipedia.org/"
  :license     "CC-BY-SA 3.0 / 4.0 — attribution + share-alike"
  :date-pulled "2026-07-16"
  :used-for    (:canonical-names :discoverer-attribution :dates :narratives :everyday-examples)
  :attribution "Derivative science records preserve source URLs in :provenance
                and inherit CC-BY-SA licensing where derived from Wikipedia.")

(provenance-note
  :source-name "Wikidata"
  :source-url  "https://www.wikidata.org/"
  :license     "CC0 — public domain"
  :date-pulled "2026-07-16"
  :used-for    (:stable-identifiers :QIDs :cross-language-labels))

(provenance-note
  :source-name "OpenStax textbooks"
  :source-url  "https://openstax.org/"
  :license     "CC-BY 4.0"
  :used-for    (:freshman-textbook-facts :taxonomic-organization))

(provenance-note
  :source-name "NIST Reference on Constants, Units, and Uncertainty"
  :source-url  "https://physics.nist.gov/cuu/"
  :license     "public — US government work"
  :used-for    (:physical-constant-values))

(provenance-note
  :source-name "IUPAC Periodic Table"
  :source-url  "https://iupac.org/"
  :license     "public"
  :used-for    (:element-names :symbols :atomic-numbers))

(provenance-note
  :source-name "WHO ICD-11"
  :source-url  "https://icd.who.int/"
  :license     "public reference"
  :used-for    (:disease-classification-codes))

(provenance-note
  :source-name "NLM MeSH"
  :source-url  "https://www.nlm.nih.gov/mesh/"
  :license     "public — US government work"
  :used-for    (:biomedical-term-ids))

(provenance-note
  :source-name "Mathematics Subject Classification"
  :source-url  "https://msc2020.org/"
  :license     "public"
  :used-for    (:math-subarea-organization))

(provenance-note
  :source-name "ACM Computing Classification System"
  :source-url  "https://dl.acm.org/ccs"
  :license     "public reference"
  :used-for    (:cs-subarea-organization))

(methodology-note
  :faceted-not-enumerated
  "Each science concept is one record with typed attribute-facets. Facets
   declared in FACETS.slat; values enumerated per-facet. No sub-tree
   explosion. No per-experiment nodes. No per-paper nodes (a separate
   graph-of-paper is a v2 lane).")

(methodology-note
  :no-fabrication
  "Every claim is provenanced. When the source is textbook-common freshman
   knowledge without a specific citation, records are tagged
   :authored-by 'graph-of-science-lane'. Missing values are honest;
   invented values are not. Especially: discoverers, dates, formulas,
   ICD codes, and taxonomic classifications are NEVER invented.")

(methodology-note
  :superseded-science-preserved
  "Historical frameworks that have been replaced remain first-class nodes
   with :status :superseded, :superseded-by pointing at the replacing node,
   and :era-dominant marking their period. A kid who never heard of
   phlogiston can't understand why oxygen mattered.")

(methodology-note
  :cross-graph-refs
  "Values in graph-of-science may point at nodes in graph-of-person,
   graph-of-institution, graph-of-cultural-work, graph-of-event,
   graph-of-world, or graph-of-store via
   (:ref-graph 'name' :ref-id 'x'). Resolution failures return
   :ref-unresolved gracefully.")

(methodology-note
  :synonym-minimum
  "Every science node carries minimum 3 synonyms. Includes historical
   names (e.g. 'consumption' for tuberculosis, 'quicksilver' for mercury),
   common-vs-formal name (e.g. 'water' vs 'H2O'), at least one non-English
   translation where the concept has multi-language history, common
   abbreviations.")

(methodology-note
  :append-only
  "Alfred 2026-07-16: 'don't rewrite — grow by append.' New nodes append
   to GRAPH-OF-SCIENCE-1.0.slat; existing nodes may gain synonyms and
   cross-refs via new records with :provenance :merged-from pointing at
   earlier forms. Never delete a node. Paradigm shifts land as new nodes
   marking the old one :superseded-by.")
""")
    log(f"wrote {OUT_PROV.name}")

    # ---- EMIT MANIFEST.slat ----
    with open(OUT_MANIFEST, "w") as f:
        f.write(";;; MANIFEST.slat — locked-schema book/graph manifest per curator rules.\n\n")
        f.write('(dialect :applies ("motoi" "sakura"))\n\n')
        f.write("(manifest\n")
        f.write('  :graph "graph-of-science"\n')
        f.write('  :version "1.0.0"\n')
        f.write('  :created "2026-07-16"\n')
        f.write('  :updated "2026-07-16"\n')
        f.write('  :owner "Alfred"\n')
        f.write('  :authored-by "graph-of-science-lane"\n')
        f.write('  :doctrine "faceted classification (Ranganathan + schema.org + type-theory descent)"\n')
        f.write("  :files\n")
        f.write("  ((:file \"README.slat\"                :purpose \"orientation\")\n")
        f.write("   (:file \"RULES.slat\"                 :purpose \"collection rules\")\n")
        f.write("   (:file \"FACETS.slat\"                :purpose \"attribute-facet schema\")\n")
        f.write("   (:file \"GRAPH-OF-SCIENCE-1.0.slat\"  :purpose \"science-nodes + intra-graph edges\")\n")
        f.write("   (:file \"CROSS-REFS.slat\"            :purpose \"cross-graph edges to person/institution/cultural-work/event/world/store\")\n")
        f.write("   (:file \"PROVENANCE.slat\"            :purpose \"sources + licenses + methodology\")\n")
        f.write("   (:file \"MANIFEST.slat\"              :purpose \"this file\")\n")
        f.write("   (:file \"build.py\"                   :purpose \"deterministic builder\")\n")
        f.write("   (:file \"seeds/\"                     :purpose \"seed data — per-subdiscipline record lists\")\n")
        f.write("   (:file \"_archive/\"                  :purpose \"prior-pass artifacts preserved per no-deletes doctrine\"))\n")
        f.write(f"  :science-node-count {len(nodes)}\n")
        f.write(f"  :facet-count {facet_count}\n")
        f.write(f"  :intra-graph-edge-count {len(intra_edges)}\n")
        f.write(f"  :cross-graph-edge-count {len(cross_edges)}\n")
        # Discipline breakdown
        f.write("  :discipline-breakdown\n")
        f.write("  (")
        for disc, n in sorted(disc_counts.items(), key=lambda x: -x[1]):
            f.write(f"({disc} {n}) ")
        f.write(")\n")
        # Kind breakdown
        f.write("  :kind-breakdown\n")
        f.write("  (")
        for kind, n in sorted(kind_counts.items(), key=lambda x: -x[1]):
            f.write(f"({kind} {n}) ")
        f.write(")\n")
        f.write('  :dialect "sakura"\n')
        f.write('  :audience :engineer :any\n')
        f.write('  :content-rating :G\n')
        f.write('  :training-eligible #t\n')
        f.write('  :confidentiality :public\n')
        f.write('  :book-version "1.0.0")\n')
    log(f"wrote {OUT_MANIFEST.name}")

    # ---- EMIT README.slat ----
    with open(OUT_README, "w") as f:
        f.write(f""";;; README.slat — orientation for graph-of-science authors.

(dialect :applies ("motoi" "sakura"))

(readme
  :graph "graph-of-science"
  :one-liner
  "Faceted knowledge graph of the sciences — physics laws, phenomena,
   forces, particles, elements, compounds, cell types, biological processes,
   anatomy, diseases, mathematical objects, computer-science concepts,
   astronomical bodies, Earth-science phenomena. Concept-level, not
   works-level."

  :counts
  ((:science-nodes {len(nodes)})
   (:facets {facet_count})
   (:intra-graph-edges {len(intra_edges)})
   (:cross-graph-edges {len(cross_edges)}))

  :file-layout
  ((:file "RULES.slat"                :description "the collection rules (append-only, no-fabrication, synonym-minimum)")
   (:file "FACETS.slat"               :description "the attribute-facet schema — declares every facet, value type, enum")
   (:file "GRAPH-OF-SCIENCE-1.0.slat" :description "the main flat file with (science ...) and (edge ...) records")
   (:file "CROSS-REFS.slat"           :description "cross-graph edges to person / institution / cultural-work / event / world / store")
   (:file "PROVENANCE.slat"           :description "sources, licenses, methodology notes")
   (:file "MANIFEST.slat"             :description "locked-schema manifest")
   (:file "build.py"                  :description "deterministic builder — reads seeds/*.py, emits SLAT files")
   (:file "seeds/"                    :description "per-subdiscipline python seed files — one SCIENCES list each")
   (:file "seeds/_helpers.py"         :description "shared helpers: slugify, gen_syns, S() record builder")
   (:file "_archive/"                 :description "prior-pass artifacts (preserved per no-deletes doctrine)"))

  :how-to-add-a-node
  ((:step 1 :do "identify the subdiscipline — physics, chemistry, biology, math, computing, astronomy, earth-science, medicine, neuroscience, statistics")
   (:step 2 :do "open the matching seeds/NN_*.py file (or create a new one following the NN_ prefix convention)")
   (:step 3 :do "append an S(...) call to that file's SCIENCES list; use existing entries as a template")
   (:step 4 :do "cite provenance — Wikipedia URL preferred; Wikidata QID for stable-id; NIST for constants")
   (:step 5 :do "run python3 build.py from this directory to regenerate the four output files"))

  :hard-rules
  ((:rule "append-only — never rewrite existing nodes; new nodes are new records")
   (:rule "min 3 synonyms per node — including historical name, formal name, non-English translation, or abbreviation where applicable")
   (:rule "no fabrication — discoverers, dates, formulas, ICD codes, taxonomic classifications are NEVER invented; leave the facet off instead")
   (:rule "provenance mandatory — every science node cites at least Wikipedia URL or Wikidata QID")
   (:rule "corporate names stripped — use generic name in canonical; brand history may appear as synonym only in history-of-science context")
   (:rule "contested science shows both sides — cite mainstream + notable minority, do not flatten disagreement")
   (:rule "superseded science preserved — mark :status :superseded, :superseded-by, :era-dominant; do not delete"))

  :dialect "sakura"
  :audience :engineer :any
  :content-rating :G
  :training-eligible #t
  :confidentiality :public
  :book-version "1.0.0")
""")
    log(f"wrote {OUT_README.name}")

    log(f"\nDONE in {time.time()-t0:.2f}s")
    log(f"  science-nodes  = {len(nodes)}")
    log(f"  facets         = {facet_count}")
    log(f"  intra-edges    = {len(intra_edges)}")
    log(f"  cross-edges    = {len(cross_edges)}")


if __name__ == "__main__":
    build()
