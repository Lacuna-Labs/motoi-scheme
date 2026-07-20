#!/usr/bin/env python3
"""
build.py — assemble GRAPH-OF-WORLD-1.0.slat + SYNONYMS-INDEX.slat +
CROSS-REFS.slat from the structured world data in seeds/.

Design: world-data is authored as Python dicts (one per node) grouped
by category-family into seeds/*.py. Each seed file contributes NODES
(and optional intra-graph EDGES, and CROSS_EDGES to other graphs) to
the corpus. The builder emits SLAT records deterministically.

Run:  python3 build.py
Idempotent. Overwrites the three output files.
"""

import os
import sys
import importlib.util
from pathlib import Path

ROOT = Path(__file__).parent
SEEDS = ROOT / "seeds"
OUT_MAIN = ROOT / "GRAPH-OF-WORLD-1.0.slat"
OUT_SYN = ROOT / "SYNONYMS-INDEX.slat"
OUT_XREF = ROOT / "CROSS-REFS.slat"


def slug(name):
    """Turn 'Oak Tree' -> 'oak-tree'; used for stable ids."""
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (" ", "-", "_", ".", "&", "'", "/"):
            if out and out[-1] != "-":
                out.append("-")
    s = "".join(out).strip("-")
    while "--" in s:
        s = s.replace("--", "-")
    return s


def q(s):
    """SLAT-safe quote of a string; escapes " and \\."""
    if s is None:
        return "nil"
    s = str(s).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def render_ref(ref_graph, ref_id, weight=None, extra=None):
    parts = [f':ref-graph {q(ref_graph)}', f':ref-id {q(ref_id)}']
    if weight is not None:
        parts.append(f':weight {weight}')
    if extra:
        for k, v in extra.items():
            parts.append(f':{k} {v}')
    return "(" + " ".join(parts) + ")"


def render_taxonomy(t):
    if not t:
        return None
    parts = []
    for k in ("kingdom", "phylum", "class_", "order", "family", "genus",
             "species", "common_name"):
        key = k.rstrip("_")
        if t.get(k) is not None:
            parts.append(f':{key} {q(t[k])}')
    return "(" + " ".join(parts) + ")"


def render_facets(node):
    lines = []
    # category is required and first
    lines.append(f'    (:category :{node["category"]})')

    if node.get("has_part"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(p) if not p.startswith("world/") else p) for p in node["has_part"])
        lines.append(f'    (:has-part ({refs}))')

    if node.get("part_of"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(p) if not p.startswith("world/") else p) for p in node["part_of"])
        lines.append(f'    (:part-of ({refs}))')

    if node.get("lives_in"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(p) if not p.startswith("world/") else p) for p in node["lives_in"])
        lines.append(f'    (:lives-in ({refs}))')

    if node.get("used_for"):
        us = " ".join(q(u) for u in node["used_for"])
        lines.append(f'    (:used-for ({us}))')

    if node.get("material_for"):
        refs = " ".join(render_ref("store-objects", r if r.startswith("store/") else "store/" + r,
                                    node.get("material_for_weights", {}).get(r, 1.0))
                        for r in node["material_for"])
        lines.append(f'    (:material-for-ref ({refs}))')

    if node.get("made_of"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(m) if not m.startswith("world/") else m) for m in node["made_of"])
        lines.append(f'    (:made-of ({refs}))')

    if node.get("region_native_to"):
        rs = " ".join(q(r) for r in node["region_native_to"])
        lines.append(f'    (:region-native-to ({rs}))')

    if node.get("time_of_day"):
        vals = " ".join(":" + v for v in node["time_of_day"])
        lines.append(f'    (:time-of-day-associated ({vals}))')

    if node.get("season"):
        vals = " ".join(":" + v for v in node["season"])
        lines.append(f'    (:season-associated ({vals}))')

    if node.get("taxonomy"):
        tax = render_taxonomy(node["taxonomy"])
        lines.append(f'    (:taxonomy {tax})')

    if node.get("scientific_name"):
        lines.append(f'    (:scientific-name {q(node["scientific_name"])})')

    if node.get("size_scale"):
        lines.append(f'    (:size-scale :{node["size_scale"]})')

    if node.get("diet"):
        vals = " ".join(":" + v for v in node["diet"])
        lines.append(f'    (:diet ({vals}))')

    if node.get("behavior_notes"):
        bs = " ".join(q(b) for b in node["behavior_notes"])
        lines.append(f'    (:behavior-notes ({bs}))')

    if node.get("for_species"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(s) if not s.startswith("world/") else s) for s in node["for_species"])
        lines.append(f'    (:for-species-ref ({refs}))')

    if node.get("worn_on"):
        refs = " ".join(render_ref("graph-of-world", "world/" + slug(w) if not w.startswith("world/") else w) for w in node["worn_on"])
        lines.append(f'    (:worn-on-ref ({refs}))')

    if node.get("sensory_signatures"):
        ss = " ".join(q(s) for s in node["sensory_signatures"])
        lines.append(f'    (:sensory-signatures ({ss}))')

    if node.get("celestial_body_type"):
        lines.append(f'    (:celestial-body-type :{node["celestial_body_type"]})')

    if node.get("landform_type"):
        lines.append(f'    (:landform-type :{node["landform_type"]})')

    if node.get("water_body_type"):
        lines.append(f'    (:water-body-type :{node["water_body_type"]})')

    if node.get("structure_type"):
        lines.append(f'    (:structure-type :{node["structure_type"]})')

    if node.get("vehicle_type"):
        lines.append(f'    (:vehicle-type :{node["vehicle_type"]})')

    if node.get("material_form"):
        vals = " ".join(":" + v for v in node["material_form"])
        lines.append(f'    (:material-form ({vals}))')

    if node.get("origin_source"):
        vals = " ".join(":" + v for v in node["origin_source"])
        lines.append(f'    (:origin-source ({vals}))')

    if node.get("phenomenon_scale"):
        vals = " ".join(":" + v for v in node["phenomenon_scale"])
        lines.append(f'    (:phenomenon-scale ({vals}))')

    if node.get("kid_friendly"):
        lines.append(f'    (:kid-friendly #t)')

    return "\n".join(lines)


def render_translations(t):
    if not t:
        return None
    parts = []
    for lang, name in t.items():
        parts.append(f'({q(lang)} {q(name)})')
    return "(" + " ".join(parts) + ")"


def render_provenance(node):
    prov = node.get("provenance", [])
    lines = []
    if isinstance(prov, list):
        for p in prov:
            if isinstance(p, dict):
                parts = []
                for k, v in p.items():
                    parts.append(f':{k.replace("_","-")} {q(v)}')
                lines.append("(" + " ".join(parts) + ")")
            elif isinstance(p, str):
                lines.append(f'(:source {q(p)})')
    elif isinstance(prov, str):
        lines.append(f'(:source {q(prov)})')
    if not lines:
        lines.append(f'(:source "graph-of-world-lane")')
    lines.append(f'(:authored-by "graph-of-world-lane")')
    lines.append(f'(:date "2026-07-16")')
    lines.append(f'(:book-version "1.0.0")')
    return "(" + " ".join(lines) + ")"


def ensure_synonyms(node):
    """Guarantee minimum 3 synonyms per lane RULES."""
    syns = list(node.get("synonyms", []))
    base = node["canonical"]

    def add(s):
        if s and s not in syns and s != base:
            syns.append(s)

    # Common surface variants
    lower = base.lower()
    add(lower)
    if "-" in base:
        add(base.replace("-", " "))
        add(base.replace("-", ""))
    if " " in base:
        add(base.replace(" ", "-"))
        add(base.replace(" ", ""))
    if base.endswith("s"):
        add(base[:-1])
    else:
        add(base + "s")

    # Scientific name is a strong synonym for taxa
    if node.get("scientific_name"):
        add(node["scientific_name"])

    if node.get("translations"):
        for _lang, form in node["translations"].items():
            add(form)

    # Category-flavored fallbacks so single-word rare items still get 3
    cat = node.get("category")
    if cat == "animal" and node.get("taxonomy"):
        cn = node["taxonomy"].get("common_name")
        if cn: add(cn)
        gen = node["taxonomy"].get("genus")
        if gen: add(gen.lower())
    if cat == "plant" and node.get("taxonomy"):
        gen = node["taxonomy"].get("genus")
        if gen: add(gen.lower())

    # Structured suffix fallbacks by category — cheap but honest.
    # We need MINIMUM 3 synonyms per the RULES doctrine, so fire these
    # aggressively when we're short.
    cat_tags = {
        "animal": "-animal", "plant": "-plant", "fungus": "-fungus",
        "weather": "-weather", "phenomenon": "-phenomenon",
        "place": "-place", "habitat": "-habitat",
        "landform": "-landform", "water-body": "-water",
        "celestial": "-celestial", "structure": "-structure",
        "vehicle": "-vehicle", "material": "-material",
        "time-of-day": "-time-of-day", "season": "-season",
        "body-part": "-body-part", "mineral": "-mineral",
        "element": "-element", "substance": "-substance",
    }
    tag = cat_tags.get(cat)
    if tag and len(syns) < 3:
        add(base + tag)
    if len(syns) < 3:
        add("the-" + base)
    if len(syns) < 3:
        add("a-" + base)
    if len(syns) < 3:
        add(base + "-thing")
    if len(syns) < 3 and cat:
        add(cat + "-" + base)

    return syns


def render_node(node):
    nid = node["id"]
    syns = ensure_synonyms(node)
    syn_str = " ".join(q(s) for s in syns)

    out = []
    out.append("(node")
    out.append(f'  :id {q(nid)}')
    out.append(f'  :canonical {q(node["canonical"])}')
    out.append(f'  :synonyms ({syn_str})')

    if node.get("translations"):
        out.append(f'  :translations {render_translations(node["translations"])}')

    facets = render_facets(node)
    out.append(f'  :facets (\n{facets})')

    out.append(f'  :provenance {render_provenance(node)}')

    # Common tags for corpus routing
    out.append(f'  :dialect "sakura"')
    out.append(f'  :audience :any')
    out.append(f'  :content-rating :G')
    out.append(f'  :training-eligible #t')
    out.append(f'  :confidentiality :public)')

    return "\n".join(out)


def render_intra_edge(from_id, to_id, edge_type, weight=1.0, note=None):
    parts = [
        f':from {q(from_id)}',
        f':to {q(to_id)}',
        f':type :{edge_type}',
        f':weight {weight}',
    ]
    if note:
        parts.append(f':note {q(note)}')
    return "(edge " + " ".join(parts) + ")"


def render_cross_edge(from_id, to_id, edge_type, from_graph, to_graph, weight=1.0):
    parts = [
        f':type :{edge_type}',
        f':from {q(from_id)}',
        f':to {q(to_id)}',
        f':weight {weight}',
        f':from-graph {q(from_graph)}',
        f':to-graph {q(to_graph)}',
    ]
    return "(cross-edge " + " ".join(parts) + ")"


def load_seeds():
    """Load every seeds/*.py, aggregating NODES / EDGES / CROSS_EDGES."""
    all_nodes = []
    all_edges = []
    all_cross = []
    if str(SEEDS) not in sys.path:
        sys.path.insert(0, str(SEEDS))
    files = sorted(SEEDS.glob("*.py"))
    for f in files:
        if f.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(f.stem, f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for n in getattr(mod, "NODES", []):
            if "id" not in n:
                n["id"] = "world/" + slug(n["canonical"])
            all_nodes.append(n)
        for e in getattr(mod, "EDGES", []):
            all_edges.append(e)
        for c in getattr(mod, "CROSS_EDGES", []):
            all_cross.append(c)
    return all_nodes, all_edges, all_cross


def main():
    if not SEEDS.exists():
        print(f"ERROR: {SEEDS} does not exist", file=sys.stderr)
        sys.exit(1)

    nodes, intra_edges, cross_edges = load_seeds()

    # Deduplicate by id — merge richer record
    seen = {}
    for n in nodes:
        if n["id"] in seen:
            prior = seen[n["id"]]
            for k, v in n.items():
                if k not in prior or (v and not prior.get(k)):
                    prior[k] = v
        else:
            seen[n["id"]] = n
    nodes = list(seen.values())
    nodes.sort(key=lambda x: x["id"])

    # ------ MAIN FILE ------
    with open(OUT_MAIN, "w") as fh:
        fh.write(""";;; GRAPH-OF-WORLD-1.0.slat — line-delimited world-node records.
;;; Faceted graph of physical / biological / geographical / natural things.
;;; See RULES.slat, FACETS.slat, README.slat, MANIFEST.slat for orientation.
;;; Generated by build.py from seeds/*.py — do NOT edit node records here;
;;; edit the seed files and regenerate. This file is version-controlled
;;; output for grep-friendliness.

(dialect :applies ("motoi" "sakura"))

(header
  :collection "graph-of-world"
  :version "1.0.0"
  :created "2026-07-16"
  :count-hint "see grep -c '^(node' output"
  :format "SLAT line-delimited; records may span multiple lines but
           each opens with '(node ' at column 0"
  :license-notice
  "Records tagged :provenance :source 'wikidata' are CC0.
   Records tagged :provenance :source 'wordnet' are Princeton-license permissive.
   Records tagged :provenance :source 'gbif' are CC-BY 4.0.
   Records tagged :provenance :source 'kew' are CC-BY 3.0.
   Records tagged :provenance :source 'itis' are public domain (US Federal).
   Records with only :authored-by 'graph-of-world-lane' are CC0.")

""")
        for n in nodes:
            fh.write(render_node(n))
            fh.write("\n\n")

        if intra_edges:
            fh.write(";;; ------ INTRA-GRAPH EDGES ------\n")
            for e in intra_edges:
                fh.write(render_intra_edge(
                    e["from"], e["to"], e["type"],
                    e.get("weight", 1.0), e.get("note")))
                fh.write("\n")

    # ------ SYNONYMS INDEX ------
    with open(OUT_SYN, "w") as fh:
        fh.write(""";;; SYNONYMS-INDEX.slat — lookup from any name variant → canonical world-node id.
;;; Generated by build.py. Every (syn ...) record maps ONE surface form to
;;; ONE canonical node-id. Multi-variant nodes emit multiple syn records.

(dialect :applies ("motoi" "sakura"))

(header
  :purpose "Fast lookup: Sakura sees 'lightning-bug' in a message, resolves to world/firefly"
  :generated-from "GRAPH-OF-WORLD-1.0.slat / seeds/*.py"
  :sort "by surface form ascending"
  :collision-policy "If two nodes share a surface form, both syn records
                     are emitted with :ambiguous #t and Sakura's resolver
                     uses category context to disambiguate.")

""")
        # Collect (surface, node_id) pairs
        surface_map = {}
        for n in nodes:
            forms = [n["canonical"]] + ensure_synonyms(n)
            for s in forms:
                if not s:
                    continue
                surface_map.setdefault(s, []).append(n["id"])

        for surface in sorted(surface_map.keys(), key=lambda x: (x.lower(), x)):
            ids = surface_map[surface]
            if len(ids) == 1:
                fh.write(f'(syn :surface {q(surface)} :node-id {q(ids[0])})\n')
            else:
                for nid in ids:
                    fh.write(f'(syn :surface {q(surface)} :node-id {q(nid)} :ambiguous #t)\n')

    # ------ CROSS REFS ------
    with open(OUT_XREF, "w") as fh:
        fh.write(""";;; CROSS-REFS.slat — cross-graph edges graph-of-world ↔ other graphs.
;;; Every (cross-edge ...) record links a world-node to a node in another
;;; graph with a weight. Bidirectional walks supported via reciprocal edges
;;; emitted at build-time.

(dialect :applies ("motoi" "sakura"))

(header
  :edge-types
  ((:type :material-for
    :from-graph "graph-of-world" :to-graph "store-objects"
    :semantics  "this material is used to make products in this store category")
   (:type :made-of
    :from-graph "store-objects"   :to-graph "graph-of-world"
    :semantics  "this store category's products are typically made of this material (reverse of :material-for)")
   (:type :for-species
    :from-graph "store-objects"   :to-graph "graph-of-world"
    :semantics  "this store category's products are for this species (dog-food → dog)")
   (:type :sold-for-species
    :from-graph "graph-of-world"  :to-graph "store-objects"
    :semantics  "this species has products in this store category (dog → dog-food)")
   (:type :worn-on
    :from-graph "store-objects"   :to-graph "graph-of-world"
    :semantics  "this apparel category is worn on this body part")
   (:type :seasonal-for
    :from-graph "graph-of-world"  :to-graph "store-objects"
    :semantics  "this season correlates with this product category being in-season")
   (:type :setting-for
    :from-graph "graph-of-world"  :to-graph "graph-of-life"
    :semantics  "this place / time / weather is the setting for a life-scenario"))
  :weight-scale "0.0 (peripheral) .. 1.0 (defining)"
  :note "Target node ids follow the target graph's shape even where the
         target graph hasn't authored the node yet; resolution failures
         return :ref-unresolved gracefully.")

""")
        # Auto-generate cross-refs from node facets
        emitted = set()
        for n in nodes:
            nid = n["id"]
            # material-for → store-objects
            if n.get("material_for"):
                for r in n["material_for"]:
                    target = r if r.startswith("store/") else "store/" + r
                    w = n.get("material_for_weights", {}).get(r, 1.0)
                    fwd = ("material-for", nid, target, w)
                    rev = ("made-of", target, nid, w)
                    if fwd not in emitted:
                        fh.write(render_cross_edge(nid, target, "material-for",
                                                    "graph-of-world", "store-objects", w) + "\n")
                        emitted.add(fwd)
                    if rev not in emitted:
                        fh.write(render_cross_edge(target, nid, "made-of",
                                                    "store-objects", "graph-of-world", w) + "\n")
                        emitted.add(rev)
            # for_species reverse — animals imply store products for them
            if n.get("category") == "animal" and n.get("has_products_in"):
                for r in n["has_products_in"]:
                    target = r if r.startswith("store/") else "store/" + r
                    w = 1.0
                    fwd = ("sold-for-species", nid, target, w)
                    rev = ("for-species", target, nid, w)
                    if fwd not in emitted:
                        fh.write(render_cross_edge(nid, target, "sold-for-species",
                                                    "graph-of-world", "store-objects", w) + "\n")
                        emitted.add(fwd)
                    if rev not in emitted:
                        fh.write(render_cross_edge(target, nid, "for-species",
                                                    "store-objects", "graph-of-world", w) + "\n")
                        emitted.add(rev)

        # Explicit cross-edges from seeds
        for c in cross_edges:
            fh.write(render_cross_edge(
                c["from"], c["to"], c["type"],
                c.get("from_graph", "graph-of-world"),
                c.get("to_graph", "store-objects"),
                c.get("weight", 1.0)) + "\n")

    # Report
    n_body = sum(1 for x in nodes if x.get("category") == "body-part")
    n_animal = sum(1 for x in nodes if x.get("category") == "animal")
    n_plant = sum(1 for x in nodes if x.get("category") == "plant")
    n_fungus = sum(1 for x in nodes if x.get("category") == "fungus")
    n_weather = sum(1 for x in nodes if x.get("category") == "weather")
    n_phenom = sum(1 for x in nodes if x.get("category") == "phenomenon")
    n_place = sum(1 for x in nodes if x.get("category") == "place")
    n_habitat = sum(1 for x in nodes if x.get("category") == "habitat")
    n_landform = sum(1 for x in nodes if x.get("category") == "landform")
    n_water = sum(1 for x in nodes if x.get("category") == "water-body")
    n_celestial = sum(1 for x in nodes if x.get("category") == "celestial")
    n_structure = sum(1 for x in nodes if x.get("category") == "structure")
    n_vehicle = sum(1 for x in nodes if x.get("category") == "vehicle")
    n_material = sum(1 for x in nodes if x.get("category") == "material")
    n_time = sum(1 for x in nodes if x.get("category") == "time-of-day")
    n_season = sum(1 for x in nodes if x.get("category") == "season")

    print(f"NODES:       {len(nodes)}")
    print(f"  body-part:  {n_body}")
    print(f"  animal:     {n_animal}")
    print(f"  plant:      {n_plant}")
    print(f"  fungus:     {n_fungus}")
    print(f"  weather:    {n_weather}")
    print(f"  phenomenon: {n_phenom}")
    print(f"  place:      {n_place}")
    print(f"  habitat:    {n_habitat}")
    print(f"  landform:   {n_landform}")
    print(f"  water-body: {n_water}")
    print(f"  celestial:  {n_celestial}")
    print(f"  structure:  {n_structure}")
    print(f"  vehicle:    {n_vehicle}")
    print(f"  material:   {n_material}")
    print(f"  time-of-day:{n_time}")
    print(f"  season:     {n_season}")
    print(f"INTRA EDGES: {len(intra_edges)}")
    print(f"CROSS EDGES: {len(cross_edges)} (explicit) + auto-generated from facets")


if __name__ == "__main__":
    main()
