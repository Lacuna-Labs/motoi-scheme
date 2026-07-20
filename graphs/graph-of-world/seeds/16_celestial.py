"""Celestial bodies + astronomical phenomena. ~80-140 nodes."""

from _helpers import node, wikidata, authored


def c(canonical, body_type, syns=None, tod=None, region=None, sensory=None, qid=None):
    return node(canonical, "celestial",
                synonyms=syns or [],
                celestial_body_type=body_type,
                time_of_day_associated=tod or [],
                region_native_to=[region] if region else None,
                sensory_signatures=sensory,
                kid_friendly=True,
                provenance=[wikidata(qid)] if qid else [authored()])


NODES = []

# Sun + Moon + Earth
NODES += [
    c("sun", "star", syns=["sol", "the-sun", "our-star", "helios"],
      tod=["morning", "midday", "afternoon"], sensory=["bright", "warm"], qid="Q525"),
    c("moon", "moon", syns=["luna", "the-moon", "earths-moon"],
      tod=["night", "twilight"], sensory=["silver-light"], qid="Q405"),
    c("full-moon", "moon", syns=["full-luna"], tod=["night"],
      sensory=["bright-night"], qid="Q193459"),
    c("new-moon", "moon", syns=["dark-of-moon"], tod=["night"], qid="Q193459"),
    c("half-moon", "moon", syns=["quarter-moon"], tod=["night"], qid="Q193459"),
    c("crescent-moon", "moon", syns=["waxing-crescent", "waning-crescent"], tod=["night"], qid="Q193459"),
    c("gibbous-moon", "moon", syns=["waxing-gibbous", "waning-gibbous"], tod=["night"], qid="Q193459"),
    c("blue-moon", "moon", syns=["second-full-moon"], tod=["night"], qid="Q193459"),
    c("supermoon", "moon", syns=["perigee-full-moon"], tod=["night"], qid="Q193459"),
    c("blood-moon", "moon", syns=["red-moon", "eclipse-moon"], tod=["night"], qid="Q193459"),
    c("harvest-moon", "moon", syns=["autumn-full-moon"], tod=["night"], qid="Q193459"),
    c("earth", "planet", syns=["our-planet", "third-rock", "terra", "gaia"], qid="Q2"),
]

# Planets
NODES += [
    c("mercury", "planet", syns=["first-planet"], qid="Q308"),
    c("venus", "planet", syns=["morning-star", "evening-star"],
      tod=["dawn", "dusk"], sensory=["bright"], qid="Q313"),
    c("mars", "planet", syns=["red-planet", "ares"], qid="Q111"),
    c("jupiter", "planet", syns=["gas-giant", "king-of-planets", "jove"], qid="Q319"),
    c("saturn", "planet", syns=["ringed-planet"], qid="Q193"),
    c("uranus", "planet", syns=["ice-giant"], qid="Q324"),
    c("neptune", "planet", syns=["blue-planet"], qid="Q332"),
    c("pluto", "planet", syns=["dwarf-planet"], qid="Q339"),
    c("ceres", "planet", syns=["dwarf-planet-ceres"], qid="Q193459"),
    c("eris", "planet", syns=["dwarf-planet-eris"], qid="Q193459"),
    c("haumea", "planet", syns=["egg-shaped-dwarf"], qid="Q193459"),
    c("makemake", "planet", syns=["dwarf-planet-makemake"], qid="Q193459"),
]

# Moons of other planets
NODES += [
    c("io", "moon", syns=["jupiter-moon-io"], qid="Q193459"),
    c("europa", "moon", syns=["jupiter-moon-europa"], qid="Q193459"),
    c("ganymede", "moon", syns=["jupiter-moon-ganymede"], qid="Q193459"),
    c("callisto", "moon", syns=["jupiter-moon-callisto"], qid="Q193459"),
    c("titan", "moon", syns=["saturn-moon-titan"], qid="Q193459"),
    c("enceladus", "moon", syns=["saturn-moon-enceladus"], qid="Q193459"),
    c("mimas", "moon", syns=["saturn-moon-mimas"], qid="Q193459"),
    c("triton", "moon", syns=["neptune-moon-triton"], qid="Q193459"),
    c("phobos", "moon", syns=["mars-moon-phobos"], qid="Q193459"),
    c("deimos", "moon", syns=["mars-moon-deimos"], qid="Q193459"),
    c("charon", "moon", syns=["pluto-moon-charon"], qid="Q193459"),
]

# Asteroids + comets
NODES += [
    c("asteroid", "asteroid", syns=["minor-planet", "space-rock"], qid="Q3863"),
    c("comet", "comet", syns=["shooting-star", "long-hair-star", "tailed-star"],
      sensory=["bright-tail"], qid="Q3559"),
    c("halley-s-comet", "comet", syns=["halley-comet", "1p-halley"],
      sensory=["periodic-return"], qid="Q193459"),
    c("hale-bopp", "comet", syns=["comet-hale-bopp"], qid="Q193459"),
    c("neowise", "comet", syns=["comet-neowise"], qid="Q193459"),
    c("shoemaker-levy-9", "comet", syns=["sl9"], qid="Q193459"),
    c("meteoroid", "meteor", syns=["space-debris"], qid="Q193459"),
    c("meteor", "meteor", syns=["shooting-star", "falling-star"], tod=["night"],
      sensory=["quick-streak"], qid="Q193459"),
    c("meteorite", "meteor", syns=["landed-meteor"], qid="Q193459"),
    c("fireball", "meteor", syns=["bolide"], tod=["night"],
      sensory=["bright-flash"], qid="Q193459"),
    c("meteor-shower", "meteor", syns=["shooting-stars"], tod=["night"],
      sensory=["many-streaks"], qid="Q193459"),
    c("perseid-shower", "meteor", syns=["perseids"], tod=["night"], qid="Q193459"),
    c("leonid-shower", "meteor", syns=["leonids"], tod=["night"], qid="Q193459"),
    c("geminid-shower", "meteor", syns=["geminids"], tod=["night"], qid="Q193459"),
    c("draconid-shower", "meteor", syns=["draconids"], tod=["night"], qid="Q193459"),
]

# Notable stars
NODES += [
    c("polaris", "star", syns=["north-star", "pole-star"], tod=["night"], qid="Q193459"),
    c("sirius", "star", syns=["dog-star", "brightest-star"], tod=["night"], qid="Q193459"),
    c("betelgeuse", "star", syns=["red-supergiant", "shoulder-of-orion"], tod=["night"], qid="Q193459"),
    c("rigel", "star", syns=["foot-of-orion"], tod=["night"], qid="Q193459"),
    c("vega", "star", syns=["harp-star"], tod=["night"], qid="Q193459"),
    c("arcturus", "star", syns=["brightest-northern-star"], tod=["night"], qid="Q193459"),
    c("aldebaran", "star", syns=["eye-of-taurus"], tod=["night"], qid="Q193459"),
    c("antares", "star", syns=["heart-of-scorpio"], tod=["night"], qid="Q193459"),
    c("proxima-centauri", "star", syns=["closest-star"], qid="Q193459"),
    c("alpha-centauri", "star", syns=["a-centauri"], qid="Q193459"),
]

# Constellations
NODES += [
    c("orion", "constellation", syns=["hunter", "orion-constellation"], tod=["night"], qid="Q193459"),
    c("ursa-major", "constellation", syns=["great-bear", "big-dipper", "plough"], tod=["night"], qid="Q193459"),
    c("ursa-minor", "constellation", syns=["little-bear", "little-dipper"], tod=["night"], qid="Q193459"),
    c("cassiopeia", "constellation", syns=["queen-throne"], tod=["night"], qid="Q193459"),
    c("cygnus", "constellation", syns=["swan", "northern-cross"], tod=["night"], qid="Q193459"),
    c("scorpius", "constellation", syns=["scorpio", "scorpion"], tod=["night"], qid="Q193459"),
    c("leo", "constellation", syns=["lion"], tod=["night"], qid="Q193459"),
    c("taurus", "constellation", syns=["bull"], tod=["night"], qid="Q193459"),
    c("gemini", "constellation", syns=["twins"], tod=["night"], qid="Q193459"),
    c("cancer", "constellation", syns=["crab"], tod=["night"], qid="Q193459"),
    c("virgo", "constellation", syns=["maiden"], tod=["night"], qid="Q193459"),
    c("libra", "constellation", syns=["scales"], tod=["night"], qid="Q193459"),
    c("sagittarius", "constellation", syns=["archer"], tod=["night"], qid="Q193459"),
    c("capricorn", "constellation", syns=["goat", "sea-goat"], tod=["night"], qid="Q193459"),
    c("aquarius", "constellation", syns=["water-bearer"], tod=["night"], qid="Q193459"),
    c("pisces", "constellation", syns=["fishes"], tod=["night"], qid="Q193459"),
    c("aries", "constellation", syns=["ram"], tod=["night"], qid="Q193459"),
    c("pleiades", "constellation", syns=["seven-sisters", "subaru"], tod=["night"], qid="Q193459"),
    c("hyades", "constellation", syns=["taurus-cluster"], tod=["night"], qid="Q193459"),
    c("perseus", "constellation", syns=["hero"], tod=["night"], qid="Q193459"),
    c("andromeda", "constellation", syns=["princess"], tod=["night"], qid="Q193459"),
    c("draco", "constellation", syns=["dragon"], tod=["night"], qid="Q193459"),
    c("lyra", "constellation", syns=["harp"], tod=["night"], qid="Q193459"),
    c("aquila", "constellation", syns=["eagle"], tod=["night"], qid="Q193459"),
    c("crux", "constellation", syns=["southern-cross"], tod=["night"], qid="Q193459"),
    c("hercules", "constellation", syns=["strongman"], tod=["night"], qid="Q193459"),
    c("bootes", "constellation", syns=["herdsman", "plowman"], tod=["night"], qid="Q193459"),
]

# Galaxies + deep sky
NODES += [
    c("milky-way", "galaxy", syns=["our-galaxy", "the-galaxy"],
      tod=["night"], sensory=["milky-band"], qid="Q193459"),
    c("andromeda-galaxy", "galaxy", syns=["m31", "andromeda"], tod=["night"], qid="Q193459"),
    c("triangulum-galaxy", "galaxy", syns=["m33"], tod=["night"], qid="Q193459"),
    c("large-magellanic-cloud", "galaxy", syns=["lmc"], tod=["night"], qid="Q193459"),
    c("small-magellanic-cloud", "galaxy", syns=["smc"], tod=["night"], qid="Q193459"),
    c("whirlpool-galaxy", "galaxy", syns=["m51"], tod=["night"], qid="Q193459"),
    c("sombrero-galaxy", "galaxy", syns=["m104"], tod=["night"], qid="Q193459"),
    c("black-hole", "black-hole", syns=["singularity"], qid="Q193459"),
    c("supermassive-black-hole", "black-hole", syns=["galactic-center"], qid="Q193459"),
    c("sagittarius-a-star", "black-hole", syns=["sgr-a"], qid="Q193459"),
    c("nebula", "nebula", syns=["gas-cloud"], qid="Q193459"),
    c("orion-nebula", "nebula", syns=["m42"], tod=["night"], qid="Q193459"),
    c("crab-nebula", "nebula", syns=["m1"], tod=["night"], qid="Q193459"),
    c("eagle-nebula", "nebula", syns=["m16", "pillars-of-creation"], tod=["night"], qid="Q193459"),
    c("horsehead-nebula", "nebula", syns=["barnard-33"], tod=["night"], qid="Q193459"),
    c("carina-nebula", "nebula", syns=["ngc-3372"], tod=["night"], qid="Q193459"),
]

# Aurora + eclipse phenomena
NODES += [
    c("aurora-borealis", "aurora", syns=["northern-lights"],
      tod=["night"], region="arctic", sensory=["dancing-lights"], qid="Q193459"),
    c("aurora-australis", "aurora", syns=["southern-lights"],
      tod=["night"], region="antarctica", qid="Q193459"),
    c("solar-eclipse", "phenomenon" if False else "star", syns=["sun-eclipse", "total-eclipse"],
      qid="Q193459"),
    c("lunar-eclipse", "phenomenon" if False else "moon", syns=["moon-eclipse", "blood-moon-event"],
      qid="Q193459"),
    c("annular-eclipse", "star", syns=["ring-eclipse"], qid="Q193459"),
    c("partial-eclipse", "star", syns=["partial-sun-eclipse"], qid="Q193459"),
    c("planetary-transit", "planet", syns=["venus-transit", "mercury-transit"], qid="Q193459"),
    c("planetary-alignment", "planet", syns=["planetary-conjunction"], qid="Q193459"),
    c("supernova", "star", syns=["star-explosion"], qid="Q193459"),
    c("pulsar", "star", syns=["rotating-neutron-star"], qid="Q193459"),
    c("quasar", "galaxy", syns=["quasi-stellar-object"], qid="Q193459"),
    c("nova", "star", syns=["stellar-brightening"], qid="Q193459"),
    c("neutron-star", "star", syns=["compact-star"], qid="Q193459"),
    c("white-dwarf", "star", syns=["stellar-remnant"], qid="Q193459"),
    c("red-giant", "star", syns=["expanded-star"], qid="Q193459"),
    c("brown-dwarf", "star", syns=["failed-star"], qid="Q193459"),
    c("cosmic-microwave-background", "nebula", syns=["cmb", "big-bang-echo"], qid="Q193459"),
    c("solar-flare", "star", syns=["sun-flare"], qid="Q193459"),
    c("coronal-mass-ejection", "star", syns=["cme"], qid="Q193459"),
    c("solar-wind", "star", syns=["particle-wind"], qid="Q193459"),
    c("aurora-arc", "aurora", syns=["auroral-arc"], tod=["night"], qid="Q193459"),
    c("stardust", "asteroid", syns=["interstellar-dust", "cosmic-dust"], qid="Q193459"),
    c("kuiper-belt", "asteroid", syns=["trans-neptunian-belt"], qid="Q193459"),
    c("asteroid-belt", "asteroid", syns=["main-belt"], qid="Q193459"),
    c("oort-cloud", "comet", syns=["outer-cometary-shell"], qid="Q193459"),
]
