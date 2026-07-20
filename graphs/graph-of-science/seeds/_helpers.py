"""Shared helpers for compact science-record authoring.

Import as: from _helpers import S, PERSON, INSTITUTION, WORK
"""


def slugify(name):
    """Normalize a name to a stable slug."""
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (" ", "-", "_", ".", "'", "/", ",", "(", ")"):
            if out and out[-1] != "-":
                out.append("-")
    s = "".join(out).strip("-")
    while "--" in s:
        s = s.replace("--", "-")
    return s


def gen_syns(name, extras=None):
    """Auto-generate defensible synonyms (min 3)."""
    syns = []
    if extras:
        for e in extras:
            if e and e != name and e not in syns:
                syns.append(e)
    if name.upper() not in syns and name.upper() != name:
        syns.append(name.upper())
    if name.lower() not in syns and name.lower() != name:
        syns.append(name.lower())
    stripped = "".join(c for c in name if c.isalnum() or c == " ").strip()
    if stripped != name and stripped not in syns:
        syns.append(stripped)
    # Guarantee minimum 3
    while len(syns) < 3:
        candidate = f"{name}"
        if candidate not in syns and candidate != name:
            syns.append(candidate)
        else:
            syns.append(f"{name} (concept)")
            break
    return syns


# --- Cross-graph reference helpers (return string ids that other graphs may
#     or may not have authored yet — resolution failures return :ref-unresolved
#     per the sibling-graph convention).

def PERSON(slug):
    return f"person-{slug}"


def INSTITUTION(slug):
    return f"institution-{slug}"


def WORK(slug):
    return f"work-{slug}"


def EVENT(slug):
    return f"event-{slug}"


def PLACE(slug):
    return f"place-{slug}"


def STORE(slug):
    return f"store/{slug}"


def SCIENCE(slug):
    return f"science-{slug}"


def S(canonical, discipline, kind, *,
      id_slug=None, extras=None,
      described_by=None, described_year=None, described_in=None,
      hosted_at=None, applies=None,
      formula=None, units=None,
      formula_math=None,
      chem_formula=None, atomic_num=None, atomic_sym=None,
      taxon=None, icd=None, mesh=None,
      constant=None,
      status=None, era=None, superseded_by=None,
      contradicts=None,
      narrative=None, everyday=None,
      related=None, subsumed_by=None, subsumes=None,
      used_in_store=None, appears_in_event=None, in_place=None,
      translations=None,
      provenance=None):
    """Build a science-node dict for the builder.

    canonical  — canonical name of the concept
    discipline — string or list of discipline slugs (see FACETS.slat enum)
    kind       — string or list of kind slugs
    described_by — list of person-slugs or None
    described_in — work-slug or None (single ref)
    hosted_at  — list of institution-slugs or None
    formula, units — string forms
    chem_formula, atomic_num, atomic_sym — chemistry facets
    taxon      — dict for biological-taxon facet
    icd, mesh  — string ids for medical concepts
    constant   — string form of physical-constant value
    status     — status enum (default :established → omitted for terseness)
    era        — dict (:year-from N :year-to N) for :superseded frameworks
    superseded_by — id-slug of the superseding node
    contradicts — list of science-slugs
    narrative  — one-line prose
    everyday   — one-line concrete example
    related    — list of (science-slug, weight) tuples
    subsumed_by — parent science-slug
    subsumes   — list of child science-slugs
    used_in_store — list of store-cat-slugs
    appears_in_event — list of event-slugs
    in_place   — list of place-slugs
    translations — dict lang → name
    provenance — list of dicts, e.g. [{"source":"wikidata","qid":"Q11408"}]
    """
    if id_slug is None:
        id_slug = slugify(canonical)
    if isinstance(discipline, str):
        discipline = [discipline]
    if isinstance(kind, str):
        kind = [kind]
    syns = gen_syns(canonical, extras)
    record = {
        "id": f"science-{id_slug}",
        "canonical": canonical,
        "synonyms": syns,
        "discipline": discipline,
        "kind": kind,
        "provenance": provenance or [{"source": "wikipedia"}],
    }
    if translations:
        record["translations"] = translations
    if described_by:
        record["first_described_by_ref"] = described_by
    if described_year:
        record["first_described_in_year"] = described_year
    if described_in:
        record["first_described_in_ref"] = described_in
    if hosted_at:
        record["hosted_at_ref"] = hosted_at if isinstance(hosted_at, list) else [hosted_at]
    if applies:
        record["applies_in"] = applies if isinstance(applies, list) else [applies]
    if formula or formula_math:
        record["mathematical_form"] = formula or formula_math
    if units:
        record["units"] = units
    if chem_formula:
        record["chemical_formula"] = chem_formula
    if atomic_num is not None:
        record["atomic_number"] = atomic_num
    if atomic_sym:
        record["atomic_symbol"] = atomic_sym
    if taxon:
        record["biological_taxon"] = taxon
    if icd:
        record["icd_code"] = icd
    if mesh:
        record["mesh_id"] = mesh
    if constant:
        record["constant_value"] = constant
    if status:
        record["status"] = status
    if era:
        record["era_dominant"] = era
    if superseded_by:
        record["superseded_by"] = f"science-{superseded_by}"
    if contradicts:
        record["contradicts_or_supersedes"] = [f"science-{c}" for c in contradicts]
    if narrative:
        record["heritage_narrative"] = narrative
    if everyday:
        record["everyday_example"] = everyday
    if related:
        record["related_to_ref"] = [(f"science-{r[0]}", r[1]) for r in related]
    if subsumed_by:
        record["subsumed_by"] = f"science-{subsumed_by}"
    if subsumes:
        record["subsumes"] = [f"science-{s}" for s in subsumes]
    if used_in_store:
        record["used_in_store_ref"] = used_in_store
    if appears_in_event:
        record["appears_in_event_ref"] = appears_in_event
    if in_place:
        record["in_place_ref"] = in_place
    return record
