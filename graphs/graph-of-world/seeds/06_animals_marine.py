"""Marine invertebrates + non-fish sea life: mollusks, cephalopods, echinoderms,
cnidarians, sponges, sea slugs, jellies, corals.
Target: ~150-250 nodes.
"""

from _helpers import node, wikidata, tax, authored


def sea(canonical, sci, family, phylum, class_, diet, habitat, region, size,
        behavior=None, synonyms=None, qid=None):
    return node(canonical, "animal",
                synonyms=synonyms or [],
                scientific_name=sci,
                taxonomy=tax(kingdom="Animalia", phylum=phylum, class_=class_,
                             family=family,
                             genus=sci.split()[0] if sci else None,
                             species=sci, common_name=canonical),
                diet=diet, lives_in=habitat, region_native_to=region,
                size_scale=size, behavior_notes=behavior,
                kid_friendly=True,
                provenance=[wikidata(qid)] if qid else [authored()])


NODES = []


def _emit(entry):
    n = len(entry)
    if n == 10:
        canonical, sci, family, phylum, class_, diet, habitat, region, size, qid = entry
        behavior = None; syns = None
    elif n == 11:
        canonical, sci, family, phylum, class_, diet, habitat, region, size, behavior, qid = entry
        syns = None
    elif n == 12:
        canonical, sci, family, phylum, class_, diet, habitat, region, size, behavior, syns, qid = entry
    else:
        raise ValueError(f"Bad marine tuple len {n}: {entry!r}")
    NODES.append(sea(canonical, sci, family, phylum, class_, diet,
                     [habitat] if isinstance(habitat, str) else habitat,
                     [region] if isinstance(region, str) else region,
                     size, behavior=behavior, synonyms=syns, qid=qid))


# ---------------------------------------------------------------------------
# CEPHALOPODS
# ---------------------------------------------------------------------------
CEPH = [
    ("octopus", "Octopus vulgaris", "Octopodidae", "Mollusca", "Cephalopoda",
        ["carnivore"], ["ocean", "reef"], "worldwide", "medium",
        ["intelligent", "eight-arms", "camouflage"], ["common-octopus"], "Q7676"),
    ("giant-pacific-octopus", "Enteroctopus dofleini", "Enteroctopodidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "ocean", "north-pacific", "large",
        ["largest-octopus"], None, "Q193459"),
    ("mimic-octopus", "Thaumoctopus mimicus", "Octopodidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "sand-bottom", "indo-pacific", "small",
        ["shape-and-species-mimicry"], None, "Q193459"),
    ("blue-ringed-octopus", "Hapalochlaena", "Octopodidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "reef", "indo-pacific", "tiny",
        ["highly-venomous"], None, "Q193459"),
    ("dumbo-octopus", "Grimpoteuthis", "Opisthoteuthidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "deep-sea", "worldwide", "small",
        ["ear-like-fins"], None, "Q193459"),
    ("squid", "Loligo vulgaris", "Loliginidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "ocean", "worldwide", "medium",
        ["ten-arms", "jet-propulsion"], ["european-squid"], "Q193459"),
    ("giant-squid", "Architeuthis dux", "Architeuthidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "deep-sea", "worldwide", "huge",
        ["deep-ocean", "elusive"], None, "Q193459"),
    ("colossal-squid", "Mesonychoteuthis hamiltoni", "Cranchiidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "deep-sea", "southern-ocean", "huge",
        ["largest-invertebrate"], None, "Q193459"),
    ("humboldt-squid", "Dosidicus gigas", "Ommastrephidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "ocean", "eastern-pacific", "large",
        ["aggressive", "schooling"], ["jumbo-squid"], "Q193459"),
    ("cuttlefish", "Sepia officinalis", "Sepiidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "ocean-shelf", "europe", "small",
        ["chromatophore-display", "cuttlebone"], None, "Q193459"),
    ("flamboyant-cuttlefish", "Metasepia pfefferi", "Sepiidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "sand-bottom", "indo-pacific", "tiny",
        ["colorful", "toxic"], None, "Q193459"),
    ("nautilus", "Nautilus pompilius", "Nautilidae", "Mollusca", "Cephalopoda",
        ["carnivore"], "deep-reef", "indo-pacific", "small",
        ["living-fossil", "coiled-shell"], None, "Q193459"),
]

for e in CEPH: _emit(e)


# ---------------------------------------------------------------------------
# GASTROPODS + BIVALVES + OTHER MOLLUSKS
# ---------------------------------------------------------------------------
MOLL = [
    ("snail", "Cornu aspersum", "Helicidae", "Mollusca", "Gastropoda",
        ["herbivore"], "garden", "worldwide", "tiny",
        ["shelled", "slow"], ["garden-snail"], "Q1093742"),
    ("slug", "Arion vulgaris", "Arionidae", "Mollusca", "Gastropoda",
        ["herbivore"], "garden", "worldwide", "tiny",
        ["shell-less"], None, "Q193459"),
    ("sea-snail", "Gastropoda", "Muricidae", "Mollusca", "Gastropoda",
        ["omnivore"], "ocean", "worldwide", "tiny",
        ["shelled"], None, "Q193459"),
    ("periwinkle", "Littorina littorea", "Littorinidae", "Mollusca", "Gastropoda",
        ["herbivore"], "rocky-shore", "north-atlantic", "tiny",
        ["intertidal"], None, "Q193459"),
    ("conch", "Strombus gigas", "Strombidae", "Mollusca", "Gastropoda",
        ["herbivore"], "reef", "caribbean", "small",
        ["large-spiral-shell"], ["queen-conch"], "Q193459"),
    ("abalone", "Haliotis rufescens", "Haliotidae", "Mollusca", "Gastropoda",
        ["herbivore"], "rocky-shore", "north-pacific", "small",
        ["iridescent-shell", "prized-food"], None, "Q193459"),
    ("limpet", "Patella vulgata", "Patellidae", "Mollusca", "Gastropoda",
        ["herbivore"], "rocky-shore", "worldwide", "tiny",
        ["clings-to-rocks"], None, "Q193459"),
    ("cone-snail", "Conus geographus", "Conidae", "Mollusca", "Gastropoda",
        ["carnivore"], "reef", "indo-pacific", "tiny",
        ["harpoon-tooth", "highly-venomous"], None, "Q193459"),
    ("sea-slug", "Nudibranchia", "Chromodorididae", "Mollusca", "Gastropoda",
        ["carnivore"], "reef", "worldwide", "tiny",
        ["colorful", "shell-less"], ["nudibranch"], "Q193459"),
    ("clam", "Bivalvia", "Veneridae", "Mollusca", "Bivalvia",
        ["filter-feeder"], ["ocean", "beach"], "worldwide", "tiny",
        ["two-shell", "buried"], None, "Q193459"),
    ("giant-clam", "Tridacna gigas", "Cardiidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "reef", "indo-pacific", "medium",
        ["largest-bivalve", "algae-symbiont"], None, "Q193459"),
    ("scallop", "Pecten maximus", "Pectinidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "ocean-floor", "north-atlantic", "tiny",
        ["free-swimming", "many-eyes"], ["king-scallop"], "Q193459"),
    ("oyster", "Crassostrea virginica", "Ostreidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "estuary", "atlantic", "tiny",
        ["reef-builder"], ["eastern-oyster"], "Q193459"),
    ("mussel", "Mytilus edulis", "Mytilidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "rocky-shore", "north-atlantic", "tiny",
        ["byssal-threads"], ["blue-mussel"], "Q193459"),
    ("cockle", "Cerastoderma edule", "Cardiidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "beach", "europe", "tiny",
        ["heart-shaped-shell"], None, "Q193459"),
    ("razor-clam", "Ensis directus", "Pharidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "beach", "north-atlantic", "tiny",
        ["long-narrow-shell"], None, "Q193459"),
    ("geoduck", "Panopea generosa", "Hiatellidae", "Mollusca", "Bivalvia",
        ["filter-feeder"], "beach", "north-pacific", "small",
        ["long-siphon", "long-lived"], None, "Q193459"),
    ("chiton", "Polyplacophora", "Chitonidae", "Mollusca", "Polyplacophora",
        ["herbivore"], "rocky-shore", "worldwide", "tiny",
        ["eight-plates"], None, "Q193459"),
]

for e in MOLL: _emit(e)


# ---------------------------------------------------------------------------
# ECHINODERMS
# ---------------------------------------------------------------------------
ECHIN = [
    ("starfish", "Asterias rubens", "Asteriidae", "Echinodermata", "Asteroidea",
        ["carnivore"], ["ocean", "reef"], "worldwide", "tiny",
        ["radial-symmetry", "regeneration"], ["sea-star"], "Q131601"),
    ("sea-urchin", "Strongylocentrotus purpuratus", "Strongylocentrotidae", "Echinodermata", "Echinoidea",
        ["herbivore"], "rocky-reef", "worldwide", "tiny",
        ["spines"], ["urchin"], "Q46079"),
    ("sand-dollar", "Echinarachnius parma", "Echinarachniidae", "Echinodermata", "Echinoidea",
        ["detritivore"], "sandy-bottom", "worldwide", "tiny",
        ["flat-round-disc"], None, "Q193459"),
    ("sea-cucumber", "Holothuria", "Holothuriidae", "Echinodermata", "Holothuroidea",
        ["detritivore"], "ocean-floor", "worldwide", "small",
        ["evisceration-defense"], None, "Q193459"),
    ("brittle-star", "Ophiuroidea", "Ophiuridae", "Echinodermata", "Ophiuroidea",
        ["omnivore"], "ocean-floor", "worldwide", "tiny",
        ["thin-arms", "fast-mover"], None, "Q193459"),
    ("crinoid", "Crinoidea", "Isocrinidae", "Echinodermata", "Crinoidea",
        ["filter-feeder"], "deep-sea", "worldwide", "small",
        ["feather-star"], ["sea-lily", "feather-star"], "Q193459"),
    ("crown-of-thorns", "Acanthaster planci", "Acanthasteridae", "Echinodermata", "Asteroidea",
        ["carnivore"], "reef", "indo-pacific", "small",
        ["coral-eater", "venomous-spines"], None, "Q193459"),
    ("sunflower-sea-star", "Pycnopodia helianthoides", "Asteriidae", "Echinodermata", "Asteroidea",
        ["carnivore"], "ocean-shelf", "north-pacific", "medium",
        ["twenty-arms", "largest-starfish"], None, "Q193459"),
]

for e in ECHIN: _emit(e)


# ---------------------------------------------------------------------------
# CNIDARIANS — jellyfish, coral, anemones, hydra
# ---------------------------------------------------------------------------
CNI = [
    ("jellyfish", "Aurelia aurita", "Ulmaridae", "Cnidaria", "Scyphozoa",
        ["carnivore"], "ocean", "worldwide", "small",
        ["stinging-tentacles", "gelatinous"], ["jelly", "moon-jelly"], "Q11241"),
    ("box-jellyfish", "Chironex fleckeri", "Chirodropidae", "Cnidaria", "Cubozoa",
        ["carnivore"], "ocean", "australia", "small",
        ["highly-venomous"], ["sea-wasp"], "Q193459"),
    ("lions-mane-jellyfish", "Cyanea capillata", "Cyaneidae", "Cnidaria", "Scyphozoa",
        ["carnivore"], "ocean", "north-atlantic", "large",
        ["largest-jellyfish", "long-tentacles"], None, "Q193459"),
    ("portuguese-man-o-war", "Physalia physalis", "Physaliidae", "Cnidaria", "Hydrozoa",
        ["carnivore"], "ocean-surface", "atlantic", "small",
        ["colonial-organism", "venomous"], None, "Q193459"),
    ("comb-jelly", "Ctenophora", "Bolinidae", "Ctenophora", "Tentaculata",
        ["carnivore"], "ocean", "worldwide", "tiny",
        ["bioluminescent", "cilia-rows"], None, "Q193459"),
    ("hydra", "Hydra vulgaris", "Hydridae", "Cnidaria", "Hydrozoa",
        ["carnivore"], "pond", "worldwide", "tiny",
        ["regeneration", "immortal"], None, "Q193459"),
    ("sea-anemone", "Actinia equina", "Actiniidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "rocky-shore", "worldwide", "tiny",
        ["sessile", "stinging-tentacles"], ["anemone"], "Q193459"),
    ("coral", "Anthozoa", "Acroporidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "worldwide-warm", "tiny",
        ["colonial", "reef-builder", "calcium-skeleton"], None, "Q11466"),
    ("brain-coral", "Diploria labyrinthiformis", "Mussidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "caribbean", "medium",
        ["convoluted-surface"], None, "Q193459"),
    ("staghorn-coral", "Acropora cervicornis", "Acroporidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "caribbean", "small",
        ["branching", "endangered"], None, "Q193459"),
    ("elkhorn-coral", "Acropora palmata", "Acroporidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "caribbean", "medium",
        ["large-branches", "endangered"], None, "Q193459"),
    ("fire-coral", "Millepora alcicornis", "Milleporidae", "Cnidaria", "Hydrozoa",
        ["carnivore"], "reef", "worldwide-tropical", "small",
        ["stinging"], None, "Q193459"),
    ("black-coral", "Antipatharia", "Antipathidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "deep-reef", "worldwide", "small",
        ["long-lived", "dark-skeleton"], None, "Q193459"),
    ("sea-fan", "Gorgonia ventalina", "Gorgoniidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "caribbean", "medium",
        ["colonial", "flat-branches"], ["gorgonian"], "Q193459"),
    ("mushroom-coral", "Fungia", "Fungiidae", "Cnidaria", "Anthozoa",
        ["carnivore"], "reef", "indo-pacific", "small",
        ["solitary", "disc-shaped"], None, "Q193459"),
]

for e in CNI: _emit(e)


# ---------------------------------------------------------------------------
# SPONGES + OTHERS
# ---------------------------------------------------------------------------
OTHER = [
    ("sponge", "Porifera", "Spongiidae", "Porifera", "Demospongiae",
        ["filter-feeder"], "reef", "worldwide", "tiny",
        ["sessile", "pores"], ["sea-sponge"], "Q131610"),
    ("bath-sponge", "Spongia officinalis", "Spongiidae", "Porifera", "Demospongiae",
        ["filter-feeder"], "reef", "mediterranean", "small",
        ["harvested-for-bath"], None, "Q193459"),
    ("glass-sponge", "Hexactinellida", "Rossellidae", "Porifera", "Hexactinellida",
        ["filter-feeder"], "deep-sea", "worldwide", "small",
        ["silica-skeleton"], None, "Q193459"),
    ("plankton", "Plankton", None, None, None,
        ["photosynthesis"], "ocean-surface", "worldwide", "microscopic",
        ["base-of-marine-food-web"], ["phytoplankton", "zooplankton"], "Q193459"),
    ("krill-swarm", "Euphausia", "Euphausiidae", "Arthropoda", "Malacostraca",
        ["filter-feeder"], "ocean", "worldwide", "tiny",
        ["massive-swarms"], None, "Q193459"),
    ("copepod", "Calanus finmarchicus", "Calanidae", "Arthropoda", "Copepoda",
        ["filter-feeder"], "ocean", "north-atlantic", "microscopic",
        ["zooplankton", "abundant"], None, "Q193459"),
    ("sea-squirt", "Ascidiacea", "Cionidae", "Chordata", "Ascidiacea",
        ["filter-feeder"], "reef", "worldwide", "tiny",
        ["sessile-adult", "swimming-larva"], ["tunicate"], "Q193459"),
    ("salp", "Salpa", "Salpidae", "Chordata", "Thaliacea",
        ["filter-feeder"], "ocean", "worldwide", "tiny",
        ["gelatinous-chain"], None, "Q193459"),
]

for e in OTHER: _emit(e)
