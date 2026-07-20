"""Reptiles + amphibians. Compact list form.
Target: ~200-400 species."""

from _helpers import node, wikidata, tax, authored


def herp(canonical, sci, family, order, class_, diet, habitat, region, size,
         behavior=None, synonyms=None, qid=None):
    return node(canonical, "animal",
                synonyms=synonyms or [],
                scientific_name=sci,
                taxonomy=tax(kingdom="Animalia", phylum="Chordata", class_=class_,
                             order=order, family=family,
                             genus=sci.split()[0] if sci else None,
                             species=sci, common_name=canonical),
                diet=diet, lives_in=habitat, region_native_to=region,
                size_scale=size, behavior_notes=behavior,
                kid_friendly=True,
                provenance=[wikidata(qid)] if qid else [authored()])


NODES = []

# SNAKES
SNAKES = [
    ("snake", "Serpentes", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["worldwide-except-antarctica"], "medium",
        ["legless", "constrictor-or-venomous"], ["serpent"], "Q2102"),
    ("cobra", "Naja naja", "Elapidae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "grassland"], ["asia"], "medium",
        ["hooded", "venomous"], ["indian-cobra"], "Q193459"),
    ("king-cobra", "Ophiophagus hannah", "Elapidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle"], ["southeast-asia"], "large",
        ["largest-venomous-snake"], None, "Q193459"),
    ("mamba", "Dendroaspis polylepis", "Elapidae", "Squamata", "Reptilia",
        ["carnivore"], ["savanna"], ["africa"], "large",
        ["fast", "venomous"], ["black-mamba"], "Q193459"),
    ("rattlesnake", "Crotalus atrox", "Viperidae", "Squamata", "Reptilia",
        ["carnivore"], ["desert", "grassland"], ["americas"], "medium",
        ["rattle-tail", "venomous"], ["western-diamondback"], "Q193459"),
    ("copperhead", "Agkistrodon contortrix", "Viperidae", "Squamata", "Reptilia",
        ["carnivore"], ["forest"], ["north-america"], "small",
        ["venomous"], None, "Q193459"),
    ("cottonmouth", "Agkistrodon piscivorus", "Viperidae", "Squamata", "Reptilia",
        ["carnivore"], ["wetland", "river"], ["north-america-south"], "medium",
        ["semi-aquatic", "venomous"], ["water-moccasin"], "Q193459"),
    ("viper", "Vipera berus", "Viperidae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "field"], ["europe"], "small",
        ["venomous"], ["adder"], "Q193459"),
    ("bushmaster", "Lachesis muta", "Viperidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle"], ["south-america"], "large",
        ["venomous"], None, "Q193459"),
    ("boa-constrictor", "Boa constrictor", "Boidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle"], ["central-america", "south-america"], "large",
        ["constrictor", "non-venomous"], None, "Q26547"),
    ("python", "Python molurus", "Pythonidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle"], ["asia", "africa"], "large",
        ["constrictor", "non-venomous"], None, "Q26547"),
    ("burmese-python", "Python bivittatus", "Pythonidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle", "wetland"], ["southeast-asia"], "large",
        ["invasive-in-florida"], None, "Q193459"),
    ("reticulated-python", "Malayopython reticulatus", "Pythonidae", "Squamata", "Reptilia",
        ["carnivore"], ["jungle"], ["southeast-asia"], "large",
        ["longest-snake"], None, "Q193459"),
    ("anaconda", "Eunectes murinus", "Boidae", "Squamata", "Reptilia",
        ["carnivore"], ["wetland"], ["south-america"], "large",
        ["aquatic", "heaviest-snake"], ["green-anaconda"], "Q26547"),
    ("garter-snake", "Thamnophis sirtalis", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["field", "garden"], ["north-america"], "small",
        ["harmless"], None, "Q193459"),
    ("corn-snake", "Pantherophis guttatus", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["field", "barn"], ["north-america"], "small",
        ["non-venomous"], None, "Q193459"),
    ("milk-snake", "Lampropeltis triangulum", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "field"], ["americas"], "small",
        ["colorful-bands"], None, "Q193459"),
    ("king-snake", "Lampropeltis getula", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "field"], ["north-america"], "medium",
        ["snake-eater"], None, "Q193459"),
    ("hognose-snake", "Heterodon platirhinos", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["field"], ["north-america"], "small",
        ["playing-dead"], None, "Q193459"),
    ("sea-snake", "Hydrophis platurus", "Elapidae", "Squamata", "Reptilia",
        ["carnivore"], ["ocean"], ["indo-pacific"], "small",
        ["fully-aquatic", "venomous"], None, "Q193459"),
    ("grass-snake", "Natrix natrix", "Colubridae", "Squamata", "Reptilia",
        ["carnivore"], ["wetland"], ["europe"], "small",
        ["harmless"], None, "Q193459"),
    ("ball-python", "Python regius", "Pythonidae", "Squamata", "Reptilia",
        ["carnivore"], ["savanna", "pet"], ["west-africa"], "small",
        ["docile"], None, "Q193459"),
]

def _emit_herp(entry):
    """Tolerant unpacker: accepts 10, 11, or 12-tuple herp records.
    10 = (canonical, sci, family, order, class, diet, habitat, size, behavior, qid) — region absent
    11 = (canonical, sci, family, order, class, diet, habitat, region, size, behavior, qid)
    12 = (11-shape) + synonyms slot inserted before qid
    """
    n = len(entry)
    if n == 10:
        canonical, sci, family, order, class_, diet, habitat, size, behavior, qid = entry
        region = None
        syns = None
    elif n == 11:
        canonical, sci, family, order, class_, diet, habitat, region, size, behavior, qid = entry
        syns = None
    elif n == 12:
        canonical, sci, family, order, class_, diet, habitat, region, size, behavior, syns, qid = entry
    else:
        raise ValueError(f"Unexpected herp entry length {n}: {entry!r}")
    NODES.append(herp(canonical, sci, family, order, class_, diet,
                       [habitat] if isinstance(habitat, str) else habitat,
                       [region] if isinstance(region, str) else region if region else None,
                       size, behavior=behavior, synonyms=syns, qid=qid))


for entry in SNAKES:
    _emit_herp(entry)

# LIZARDS
LIZARDS = [
    ("lizard", "Lacertilia", "Lacertidae", "Squamata", "Reptilia",
        ["insectivore"], ["worldwide"], "small",
        ["four-legged", "tail-drop"], None, "Q129043"),
    ("gecko", "Gekkonidae", "Gekkonidae", "Squamata", "Reptilia",
        ["insectivore"], ["worldwide-warm"], "tiny",
        ["adhesive-toes", "vocal"], None, "Q192053"),
    ("leopard-gecko", "Eublepharis macularius", "Eublepharidae", "Squamata", "Reptilia",
        ["insectivore"], ["desert", "pet"], ["central-asia"], "tiny",
        ["ground-dwelling"], None, "Q193459"),
    ("crested-gecko", "Correlophus ciliatus", "Diplodactylidae", "Squamata", "Reptilia",
        ["omnivore"], ["forest", "pet"], ["new-caledonia"], "tiny",
        None, None, "Q193459"),
    ("iguana", "Iguana iguana", "Iguanidae", "Squamata", "Reptilia",
        ["herbivore"], ["jungle"], ["central-america", "south-america"], "large",
        ["arboreal"], ["green-iguana"], "Q192053"),
    ("marine-iguana", "Amblyrhynchus cristatus", "Iguanidae", "Squamata", "Reptilia",
        ["herbivore"], ["coast"], ["galapagos"], "medium",
        ["seaweed-eater", "sneezing-salt"], None, "Q193459"),
    ("chameleon", "Chamaeleonidae", "Chamaeleonidae", "Squamata", "Reptilia",
        ["insectivore"], ["forest"], ["africa", "madagascar"], "small",
        ["color-changing", "independent-eyes"], None, "Q193459"),
    ("veiled-chameleon", "Chamaeleo calyptratus", "Chamaeleonidae", "Squamata", "Reptilia",
        ["insectivore"], ["forest", "pet"], ["arabian-peninsula"], "small",
        None, None, "Q193459"),
    ("bearded-dragon", "Pogona vitticeps", "Agamidae", "Squamata", "Reptilia",
        ["omnivore"], ["desert", "pet"], ["australia"], "small",
        ["docile"], ["beardie"], "Q193459"),
    ("frilled-lizard", "Chlamydosaurus kingii", "Agamidae", "Squamata", "Reptilia",
        ["insectivore"], ["forest"], ["australia"], "small",
        ["frill-display"], None, "Q193459"),
    ("gila-monster", "Heloderma suspectum", "Helodermatidae", "Squamata", "Reptilia",
        ["carnivore"], ["desert"], ["north-america-southwest"], "small",
        ["venomous"], None, "Q193459"),
    ("komodo-dragon", "Varanus komodoensis", "Varanidae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "grassland"], ["indonesia"], "large",
        ["largest-lizard", "venomous-saliva"], None, "Q26547"),
    ("monitor-lizard", "Varanus", "Varanidae", "Squamata", "Reptilia",
        ["carnivore"], ["forest", "savanna"], ["africa", "asia", "australia"], "medium",
        None, None, "Q193459"),
    ("skink", "Scincidae", "Scincidae", "Squamata", "Reptilia",
        ["insectivore"], ["worldwide"], "small",
        ["smooth-scales"], None, "Q193459"),
    ("anole", "Anolis carolinensis", "Dactyloidae", "Squamata", "Reptilia",
        ["insectivore"], ["forest", "garden"], ["americas"], "tiny",
        ["dewlap-display", "color-change"], ["green-anole"], "Q193459"),
    ("horned-lizard", "Phrynosoma", "Phrynosomatidae", "Squamata", "Reptilia",
        ["insectivore"], ["desert"], ["north-america-southwest"], "small",
        ["blood-squirting-defense"], ["horned-toad"], "Q193459"),
    ("basilisk", "Basiliscus", "Corytophanidae", "Squamata", "Reptilia",
        ["omnivore"], ["jungle"], ["central-america"], "small",
        ["water-running", "jesus-lizard"], None, "Q193459"),
]

for entry in LIZARDS:
    _emit_herp(entry)

# TURTLES + TORTOISES
TURTLES = [
    ("turtle", "Testudines", "Emydidae", "Testudines", "Reptilia",
        ["omnivore"], ["worldwide"], "medium",
        ["shelled", "long-lived"], None, "Q3238"),
    ("tortoise", "Testudinidae", "Testudinidae", "Testudines", "Reptilia",
        ["herbivore"], ["desert", "grassland"], ["worldwide-warm"], "medium",
        ["terrestrial", "long-lived"], None, "Q80056"),
    ("sea-turtle", "Chelonioidea", "Cheloniidae", "Testudines", "Reptilia",
        ["omnivore"], ["ocean"], ["worldwide-tropical"], "large",
        ["migratory", "beach-nesting"], None, "Q193459"),
    ("green-sea-turtle", "Chelonia mydas", "Cheloniidae", "Testudines", "Reptilia",
        ["herbivore"], ["ocean"], ["worldwide-tropical"], "large",
        ["seagrass-eater"], None, "Q193459"),
    ("loggerhead-turtle", "Caretta caretta", "Cheloniidae", "Testudines", "Reptilia",
        ["carnivore"], ["ocean"], ["worldwide-warm"], "large",
        None, None, "Q193459"),
    ("leatherback-turtle", "Dermochelys coriacea", "Dermochelyidae", "Testudines", "Reptilia",
        ["carnivore"], ["ocean"], ["worldwide"], "huge",
        ["largest-turtle", "leathery-shell"], None, "Q193459"),
    ("hawksbill-turtle", "Eretmochelys imbricata", "Cheloniidae", "Testudines", "Reptilia",
        ["omnivore"], ["ocean", "reef"], ["worldwide-tropical"], "medium",
        None, None, "Q193459"),
    ("box-turtle", "Terrapene carolina", "Emydidae", "Testudines", "Reptilia",
        ["omnivore"], ["forest"], ["north-america"], "small",
        ["hinged-shell"], None, "Q193459"),
    ("painted-turtle", "Chrysemys picta", "Emydidae", "Testudines", "Reptilia",
        ["omnivore"], ["pond", "wetland"], ["north-america"], "small",
        ["basking"], None, "Q193459"),
    ("snapping-turtle", "Chelydra serpentina", "Chelydridae", "Testudines", "Reptilia",
        ["carnivore"], ["pond", "river"], ["north-america"], "medium",
        ["aggressive-bite"], None, "Q193459"),
    ("galapagos-tortoise", "Chelonoidis nigra", "Testudinidae", "Testudines", "Reptilia",
        ["herbivore"], ["scrubland"], ["galapagos"], "large",
        ["long-lived", "iconic"], None, "Q193459"),
    ("aldabra-tortoise", "Aldabrachelys gigantea", "Testudinidae", "Testudines", "Reptilia",
        ["herbivore"], ["grassland"], ["seychelles"], "large",
        None, None, "Q193459"),
    ("desert-tortoise", "Gopherus agassizii", "Testudinidae", "Testudines", "Reptilia",
        ["herbivore"], ["desert"], ["north-america-southwest"], "small",
        ["burrower"], None, "Q193459"),
    ("terrapin", "Malaclemys terrapin", "Emydidae", "Testudines", "Reptilia",
        ["carnivore"], ["estuary", "coast"], ["north-america-east"], "small",
        None, None, "Q193459"),
    ("softshell-turtle", "Apalone spinifera", "Trionychidae", "Testudines", "Reptilia",
        ["carnivore"], ["river"], ["north-america"], "medium",
        ["leathery-shell"], None, "Q193459"),
]

for entry in TURTLES:
    _emit_herp(entry)

# CROCODILIANS
CROCS = [
    ("crocodile", "Crocodylus", "Crocodylidae", "Crocodilia", "Reptilia",
        ["carnivore"], ["river", "wetland"], ["worldwide-tropical"], "huge",
        ["ambush-predator", "ancient"], None, "Q131571"),
    ("nile-crocodile", "Crocodylus niloticus", "Crocodylidae", "Crocodilia", "Reptilia",
        ["carnivore"], ["river"], ["africa"], "huge", None, None, "Q193459"),
    ("saltwater-crocodile", "Crocodylus porosus", "Crocodylidae", "Crocodilia", "Reptilia",
        ["carnivore"], ["estuary", "ocean"], ["australia", "southeast-asia"], "huge",
        ["largest-reptile"], None, "Q193459"),
    ("american-alligator", "Alligator mississippiensis", "Alligatoridae", "Crocodilia", "Reptilia",
        ["carnivore"], ["wetland"], ["north-america-southeast"], "huge",
        None, ["alligator", "gator"], "Q193459"),
    ("chinese-alligator", "Alligator sinensis", "Alligatoridae", "Crocodilia", "Reptilia",
        ["carnivore"], ["wetland"], ["china"], "large", None, None, "Q193459"),
    ("caiman", "Caiman crocodilus", "Alligatoridae", "Crocodilia", "Reptilia",
        ["carnivore"], ["river", "wetland"], ["central-america", "south-america"], "large",
        None, None, "Q193459"),
    ("gharial", "Gavialis gangeticus", "Gavialidae", "Crocodilia", "Reptilia",
        ["piscivore"], ["river"], ["india"], "huge",
        ["long-narrow-snout"], None, "Q193459"),
]

for entry in CROCS:
    _emit_herp(entry)

# AMPHIBIANS
AMPHIBS = [
    ("frog", "Anura", "Ranidae", "Anura", "Amphibia",
        ["insectivore"], ["pond", "wetland"], ["worldwide"], "tiny",
        ["metamorphosis", "jumping"], None, "Q3116510"),
    ("toad", "Bufo bufo", "Bufonidae", "Anura", "Amphibia",
        ["insectivore"], ["field", "garden"], ["worldwide"], "small",
        ["warty-skin"], None, "Q42213"),
    ("bullfrog", "Lithobates catesbeianus", "Ranidae", "Anura", "Amphibia",
        ["carnivore"], ["pond"], ["north-america"], "small",
        ["deep-croak"], ["american-bullfrog"], "Q193459"),
    ("tree-frog", "Hyla arborea", "Hylidae", "Anura", "Amphibia",
        ["insectivore"], ["forest"], ["europe"], "tiny",
        ["arboreal", "sticky-toes"], None, "Q193459"),
    ("red-eyed-tree-frog", "Agalychnis callidryas", "Phyllomedusidae", "Anura", "Amphibia",
        ["insectivore"], ["jungle"], ["central-america"], "tiny",
        ["colorful"], None, "Q193459"),
    ("poison-dart-frog", "Dendrobates", "Dendrobatidae", "Anura", "Amphibia",
        ["insectivore"], ["jungle"], ["central-america", "south-america"], "tiny",
        ["colorful", "toxic-skin"], None, "Q193459"),
    ("golden-poison-frog", "Phyllobates terribilis", "Dendrobatidae", "Anura", "Amphibia",
        ["insectivore"], ["jungle"], ["colombia"], "tiny",
        ["most-toxic-vertebrate"], None, "Q193459"),
    ("goliath-frog", "Conraua goliath", "Conrauidae", "Anura", "Amphibia",
        ["carnivore"], ["river"], ["west-africa"], "small",
        ["largest-frog"], None, "Q193459"),
    ("horned-frog", "Ceratophrys ornata", "Ceratophryidae", "Anura", "Amphibia",
        ["carnivore"], ["forest"], ["south-america"], "small",
        ["ambush-predator"], ["pacman-frog"], "Q193459"),
    ("cane-toad", "Rhinella marina", "Bufonidae", "Anura", "Amphibia",
        ["omnivore"], ["field", "wetland"], ["central-america", "invasive-australia"], "small",
        ["toxic"], None, "Q193459"),
    ("salamander", "Salamandridae", "Salamandridae", "Urodela", "Amphibia",
        ["carnivore"], ["forest", "stream"], ["holarctic"], "tiny",
        ["moist-skin", "regeneration"], None, "Q3229"),
    ("newt", "Notophthalmus viridescens", "Salamandridae", "Urodela", "Amphibia",
        ["carnivore"], ["pond", "wetland"], ["north-america"], "tiny",
        ["aquatic-adult"], ["eastern-newt"], "Q193459"),
    ("axolotl", "Ambystoma mexicanum", "Ambystomatidae", "Urodela", "Amphibia",
        ["carnivore"], ["lake", "pet"], ["mexico"], "small",
        ["neotenic", "regeneration"], None, "Q170790"),
    ("giant-salamander", "Andrias japonicus", "Cryptobranchidae", "Urodela", "Amphibia",
        ["carnivore"], ["river"], ["japan"], "medium",
        ["largest-amphibian"], ["japanese-giant-salamander"], "Q193459"),
    ("hellbender", "Cryptobranchus alleganiensis", "Cryptobranchidae", "Urodela", "Amphibia",
        ["carnivore"], ["stream"], ["north-america"], "small",
        ["aquatic"], None, "Q193459"),
    ("mudpuppy", "Necturus maculosus", "Proteidae", "Urodela", "Amphibia",
        ["carnivore"], ["lake", "river"], ["north-america"], "small",
        ["external-gills"], None, "Q193459"),
    ("caecilian", "Gymnophiona", "Caeciliidae", "Gymnophiona", "Amphibia",
        ["carnivore"], ["forest-floor"], ["tropics"], "small",
        ["legless", "burrower"], None, "Q193459"),
]

for entry in AMPHIBS:
    _emit_herp(entry)
