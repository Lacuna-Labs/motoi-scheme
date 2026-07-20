"""Common helpers for seeds files."""


def node(canonical, category, **kwargs):
    """Construct a node dict with sensible defaults."""
    n = {"canonical": canonical, "category": category}
    n.update(kwargs)
    return n


def wikidata(qid):
    """Provenance shorthand for a Wikidata QID."""
    return {"source": "wikidata", "qid": qid}


def wordnet(synset):
    """Provenance shorthand for a WordNet synset."""
    return {"source": "wordnet", "synset": synset}


def gbif(taxon_id):
    """Provenance shorthand for a GBIF taxon key."""
    return {"source": "gbif", "taxon_id": str(taxon_id)}


def kew(kew_id):
    """Provenance shorthand for a Kew World Checklist id."""
    return {"source": "kew", "kew_id": str(kew_id)}


def itis(tsn):
    """Provenance shorthand for an ITIS TSN."""
    return {"source": "itis", "tsn": str(tsn)}


def authored():
    return {"source": "graph-of-world-lane"}


def tax(kingdom=None, phylum=None, class_=None, order=None, family=None,
        genus=None, species=None, common_name=None):
    """Build a taxonomy record."""
    t = {}
    if kingdom: t["kingdom"] = kingdom
    if phylum: t["phylum"] = phylum
    if class_: t["class_"] = class_
    if order: t["order"] = order
    if family: t["family"] = family
    if genus: t["genus"] = genus
    if species: t["species"] = species
    if common_name: t["common_name"] = common_name
    return t
