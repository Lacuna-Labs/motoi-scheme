"""Astronomy — bodies, phenomena, structures. Target ~500 nodes."""

from _helpers import S


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


def WD(qid, name=None):
    p = [{"source": "wikidata", "qid": qid}]
    if name:
        p.append({"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"})
    return p


def A(name, slug, kind, narr, subsumed_by, everyday=None, extras=None, applies=None,
      described_by=None, described_year=None, related=None, wp=None, wd=None,
      status=None, in_place=None):
    prov = WD(wd, wp) if wd else W(wp or name.replace(" ", "_"))
    return S(name, "astronomy", kind,
             id_slug=slug, extras=extras or [], narrative=narr, everyday=everyday,
             applies=applies or [":astrophysical"],
             described_by=described_by, described_year=described_year,
             subsumed_by=subsumed_by,
             related=[(r, w) for r, w in (related or [])],
             in_place=in_place, status=status,
             provenance=prov)


SCIENCES = []

# ---- SOLAR SYSTEM (Sun + 8 planets + dwarfs + notable moons) ----
SOLAR = [
    ("Sun", "sun", "The G-type main-sequence star at the center of our solar system, ~4.6 billion years old, radius ~696,000 km.",
     ["Sol", "the sun", "our star"], "Sun", "Q525"),
    ("Mercury (planet)", "mercury-planet", "The smallest planet and closest to the sun; a rocky, airless world with extreme temperature swings.",
     ["Mercury"], "Mercury_(planet)", "Q308"),
    ("Venus", "venus", "The second planet from the sun; runaway greenhouse effect gives it surface temperatures around 465 °C.",
     ["morning star", "evening star"], "Venus", "Q313"),
    ("Earth", "earth", "The third planet from the sun and the only known world harboring life; ~4.54 billion years old.",
     ["Terra", "the world", "the blue planet"], "Earth", "Q2"),
    ("Mars", "mars", "The fourth planet from the sun; a cold desert world with polar ice, canyons, and evidence of ancient liquid water.",
     ["red planet"], "Mars", "Q111"),
    ("Jupiter", "jupiter", "The fifth planet and largest in the solar system; a gas giant with the Great Red Spot storm and 90+ known moons.",
     [], "Jupiter", "Q319"),
    ("Saturn", "saturn", "The sixth planet from the sun; famous for its bright ring system of ice and rock particles.",
     [], "Saturn", "Q193"),
    ("Uranus", "uranus", "The seventh planet from the sun; an ice giant tilted 98°, effectively rolling around its orbit.",
     [], "Uranus", "Q324"),
    ("Neptune", "neptune", "The eighth and farthest planet from the sun; an ice giant with the fastest winds in the solar system.",
     [], "Neptune", "Q332"),
    ("Pluto", "pluto", "A dwarf planet in the Kuiper belt, reclassified from planet in 2006; heart-shaped nitrogen ice plain visible from New Horizons.",
     ["dwarf planet Pluto", "134340 Pluto"], "Pluto", "Q339"),
    ("Ceres", "ceres", "The largest object in the asteroid belt and the closest dwarf planet to the sun; contains water ice.",
     ["1 Ceres"], "Ceres_(dwarf_planet)", "Q596"),
    ("Eris", "eris", "A trans-Neptunian dwarf planet whose 2005 discovery triggered Pluto's reclassification.",
     ["136199 Eris"], "Eris_(dwarf_planet)", "Q3937"),
    ("Haumea", "haumea", "An elongated Kuiper-belt dwarf planet with two moons and a ring.",
     [], "Haumea", "Q28920"),
    ("Makemake", "makemake", "A Kuiper-belt dwarf planet, one of the largest known trans-Neptunian objects.",
     [], "Makemake", "Q22811"),
    ("Moon", "moon-earth", "Earth's only natural satellite, the fifth-largest moon in the solar system; forms tides and stabilizes Earth's axial tilt.",
     ["Luna", "the moon"], "Moon", "Q405"),
    ("Io", "io-moon", "Jupiter's innermost Galilean moon and the most volcanically active body in the solar system.",
     ["Jupiter I"], "Io_(moon)", "Q3123"),
    ("Europa", "europa-moon", "Jupiter's fourth-largest moon; has a subsurface ocean beneath an ice crust — a leading candidate for extraterrestrial life.",
     ["Jupiter II"], "Europa_(moon)", "Q3143"),
    ("Ganymede", "ganymede-moon", "Jupiter's largest moon and the largest in the solar system; larger than Mercury; has its own magnetic field.",
     ["Jupiter III"], "Ganymede_(moon)", "Q3169"),
    ("Callisto", "callisto-moon", "Jupiter's second-largest moon; a heavily-cratered ice world at the outer edge of the Galilean group.",
     ["Jupiter IV"], "Callisto_(moon)", "Q3134"),
    ("Titan", "titan-moon", "Saturn's largest moon; the only moon with a dense atmosphere and stable surface liquids (methane/ethane lakes).",
     ["Saturn VI"], "Titan_(moon)", "Q2565"),
    ("Enceladus", "enceladus-moon", "Saturn's sixth-largest moon; erupts water plumes from a subsurface ocean, another candidate for life.",
     ["Saturn II"], "Enceladus", "Q3303"),
    ("Triton", "triton-moon", "Neptune's largest moon; orbits retrograde and has active nitrogen geysers.",
     ["Neptune I"], "Triton_(moon)", "Q3359"),
    ("Charon", "charon-moon", "Pluto's largest moon; so large relative to Pluto that they orbit a barycenter outside Pluto's surface.",
     ["Pluto I"], "Charon_(moon)", "Q6604"),
    ("Phobos", "phobos-moon", "The larger and inner of Mars' two tiny moons; expected to crash into Mars in ~50 million years.",
     ["Mars I"], "Phobos_(moon)", "Q3919"),
    ("Deimos", "deimos-moon", "The smaller and outer of Mars' two moons.",
     ["Mars II"], "Deimos_(moon)", "Q7548"),
    ("Asteroid Belt", "asteroid-belt", "The torus-shaped region between Mars and Jupiter containing most solar-system asteroids.",
     ["main belt"], "Asteroid_belt", "Q3235"),
    ("Kuiper Belt", "kuiper-belt", "Ring of icy bodies beyond Neptune from 30 to 50 AU; source of short-period comets.",
     [], "Kuiper_belt", "Q10990"),
    ("Oort Cloud", "oort-cloud", "Hypothetical spherical shell of icy bodies at the outermost solar system, source of long-period comets.",
     [], "Oort_cloud", "Q7194"),
    ("Solar System", "solar-system", "The gravitationally-bound system of the Sun and everything that orbits it — planets, dwarf planets, moons, asteroids, comets.",
     [], "Solar_System", "Q544"),
]
for name, slug, narr, extras, wp, wd in SOLAR:
    kind = "body" if slug not in ("asteroid-belt", "kuiper-belt", "oort-cloud", "solar-system") else "structure"
    parent = "solar-system"
    if slug == "sun":
        parent = "star"
    elif slug == "solar-system":
        parent = "astronomy"
    elif slug.endswith("-moon"):
        parent = "moon-category"
    SCIENCES.append(A(name, slug, kind, narr, parent, extras=extras, wp=wp, wd=wd))

# ---- STELLAR OBJECTS ----
STARS = [
    ("Star", "star", "body", "A luminous ball of plasma held together by gravity and shining by nuclear fusion in its core.",
     None, ["stellar object"], "Star", "Q523"),
    ("Main Sequence Star", "main-sequence-star", "body", "A star burning hydrogen into helium in its core; the longest phase of stellar life.",
     None, [], "Main_sequence", "Q209786"),
    ("Red Giant", "red-giant", "body", "A dying star that has exhausted core hydrogen and expanded to enormous size while its outer layers cooled.",
     None, [], "Red_giant", "Q6934"),
    ("White Dwarf", "white-dwarf", "body", "The dense remnant of a low- or medium-mass star after it sheds its outer layers.",
     None, [], "White_dwarf", "Q5871"),
    ("Neutron Star", "neutron-star", "body", "Extremely dense stellar remnant composed almost entirely of neutrons; ~1.4 solar masses in ~20 km.",
     None, [], "Neutron_star", "Q4360"),
    ("Pulsar", "pulsar", "body", "A rotating neutron star emitting beams of electromagnetic radiation, appearing to pulse as the beams sweep past Earth.",
     None, [], "Pulsar", "Q4360"),
    ("Magnetar", "magnetar", "body", "A neutron star with an extraordinarily powerful magnetic field, ~10¹⁰ times stronger than Earth's.",
     None, [], "Magnetar", "Q167769"),
    ("Black Hole", "black-hole", "body", "A region of spacetime where gravity is so strong that nothing — not even light — can escape.",
     "The Milky Way's center hosts Sagittarius A*, a supermassive black hole.",
     [], "Black_hole", "Q589"),
    ("Supermassive Black Hole", "supermassive-black-hole", "body", "A black hole with mass millions to billions of times the sun's; found at most galaxy centers.",
     None, ["SMBH"], "Supermassive_black_hole", "Q193472"),
    ("Stellar Black Hole", "stellar-black-hole", "body", "A black hole formed by the gravitational collapse of a massive star, typically 5-100 solar masses.",
     None, [], "Stellar_black_hole", "Q332283"),
    ("Red Dwarf", "red-dwarf", "body", "A small, cool main-sequence star; the most common type of star in the Milky Way.",
     None, [], "Red_dwarf", "Q5864"),
    ("Brown Dwarf", "brown-dwarf", "body", "Substellar object with insufficient mass to sustain hydrogen fusion — between a giant planet and a star.",
     None, [], "Brown_dwarf", "Q101600"),
    ("Blue Supergiant", "blue-supergiant", "body", "Extremely luminous massive star with surface temperature over 10,000 K.",
     None, [], "Blue_supergiant", "Q1090057"),
    ("Wolf-Rayet Star", "wolf-rayet-star", "body", "Rare massive star with very high surface temperature and strong stellar wind.",
     None, [], "Wolf%E2%80%93Rayet_star", "Q191823"),
    ("Binary Star", "binary-star", "body", "A star system of two stars orbiting a common barycenter.",
     None, [], "Binary_star", "Q101600"),
    ("Variable Star", "variable-star", "body", "A star whose brightness fluctuates as seen from Earth — intrinsic or extrinsic variability.",
     None, [], "Variable_star", "Q6015"),
    ("Cepheid Variable", "cepheid-variable", "body", "A pulsating variable whose period-luminosity relation lets astronomers measure cosmic distances.",
     None, [], "Cepheid_variable", "Q106523"),
    ("Nova", "nova", "phenomenon", "A sudden brightening of a white dwarf due to thermonuclear runaway in accreted hydrogen.",
     None, [], "Nova", "Q6501"),
    ("Supernova", "supernova", "phenomenon", "The catastrophic explosion of a massive star at the end of its life, briefly outshining an entire galaxy.",
     None, [], "Supernova", "Q3937"),
    ("Type Ia Supernova", "type-ia-supernova", "phenomenon", "A thermonuclear supernova arising from a white dwarf in a binary system; standardizable candles for cosmic distance.",
     None, [], "Type_Ia_supernova", "Q210089"),
    ("Type II Supernova", "type-ii-supernova", "phenomenon", "A core-collapse supernova of a massive star with a hydrogen envelope.",
     None, [], "Type_II_supernova", "Q3510668"),
    ("Gamma-Ray Burst", "gamma-ray-burst", "phenomenon", "The most energetic explosions in the universe — brief but intense flashes of gamma rays from distant galaxies.",
     None, ["GRB"], "Gamma-ray_burst", "Q167697"),
    ("Kilonova", "kilonova", "phenomenon", "A transient astronomical event from the merger of two compact objects such as neutron stars; produces heavy elements.",
     None, [], "Kilonova", "Q26838"),
]
for name, slug, kind, narr, everyday, extras, wp, wd in STARS:
    parent = "stellar-astronomy"
    if kind == "phenomenon":
        parent = "stellar-phenomena"
    SCIENCES.append(A(name, slug, kind, narr, parent,
                     everyday=everyday, extras=extras, wp=wp, wd=wd))

# ---- GALAXIES + LARGE STRUCTURES ----
GALACTIC = [
    ("Galaxy", "galaxy", "body", "A gravitationally-bound system of stars, gas, dust, and dark matter; the Milky Way contains ~200-400 billion stars.",
     [], "Galaxy", "Q318"),
    ("Milky Way", "milky-way", "body", "The barred spiral galaxy containing our solar system; ~100,000 light-years across.",
     ["our galaxy"], "Milky_Way", "Q321"),
    ("Andromeda Galaxy", "andromeda-galaxy", "body", "The nearest large galaxy to the Milky Way, ~2.5 million light-years away; on a collision course with us.",
     ["M31", "Messier 31", "NGC 224"], "Andromeda_Galaxy", "Q2469"),
    ("Triangulum Galaxy", "triangulum-galaxy", "body", "The third-largest galaxy in the Local Group, after Andromeda and the Milky Way.",
     ["M33"], "Triangulum_Galaxy", "Q22661"),
    ("Large Magellanic Cloud", "large-magellanic-cloud", "body", "A satellite dwarf galaxy of the Milky Way visible from the southern hemisphere.",
     ["LMC"], "Large_Magellanic_Cloud", "Q10133"),
    ("Small Magellanic Cloud", "small-magellanic-cloud", "body", "A satellite dwarf galaxy of the Milky Way, companion to the LMC.",
     ["SMC"], "Small_Magellanic_Cloud", "Q10134"),
    ("Spiral Galaxy", "spiral-galaxy", "body", "A galaxy type with a flat rotating disk of stars, gas, and dust and prominent spiral arms.",
     [], "Spiral_galaxy", "Q3253409"),
    ("Elliptical Galaxy", "elliptical-galaxy", "body", "A galaxy type with an ellipsoidal shape and mostly old stars.",
     [], "Elliptical_galaxy", "Q17137"),
    ("Barred Spiral Galaxy", "barred-spiral-galaxy", "body", "A spiral galaxy with a central bar-shaped structure of stars.",
     [], "Barred_spiral_galaxy", "Q1071617"),
    ("Dwarf Galaxy", "dwarf-galaxy", "body", "A small galaxy with 100 million to few billion stars.",
     [], "Dwarf_galaxy", "Q188863"),
    ("Local Group", "local-group", "structure", "The galaxy group containing the Milky Way, Andromeda, Triangulum, and ~80 smaller galaxies.",
     [], "Local_Group", "Q166816"),
    ("Virgo Supercluster", "virgo-supercluster", "structure", "The galaxy supercluster containing the Local Group and centered on the Virgo Cluster.",
     [], "Virgo_Supercluster", "Q214267"),
    ("Laniakea Supercluster", "laniakea", "structure", "The larger supercluster of galaxies of which the Milky Way is part, defined in 2014.",
     [], "Laniakea_Supercluster", "Q17153261"),
    ("Cosmic Web", "cosmic-web", "structure", "The large-scale structure of the universe — filaments of galaxies separated by voids.",
     [], "Observable_universe", "Q1088"),
    ("Observable Universe", "observable-universe", "structure", "The region of the universe from which light has had time to reach Earth since the Big Bang, ~93 billion light-years across.",
     [], "Observable_universe", "Q1088"),
    ("Universe", "universe", "structure", "All of space and time and their contents — matter, energy, planets, stars, galaxies, and the cosmic microwave background.",
     ["cosmos"], "Universe", "Q1"),
    ("Nebula", "nebula", "structure", "A cloud of gas and dust in space, often the birthplace of new stars.",
     [], "Nebula", "Q6502"),
    ("Emission Nebula", "emission-nebula", "structure", "A nebula whose gas is ionized by nearby hot stars, causing it to glow.",
     [], "Emission_nebula", "Q207517"),
    ("Planetary Nebula", "planetary-nebula", "structure", "An expanding shell of ionized gas ejected by a dying low-to-medium-mass star.",
     [], "Planetary_nebula", "Q13590"),
    ("Supernova Remnant", "supernova-remnant", "structure", "The expanding cloud of gas and dust left over from a supernova explosion.",
     [], "Supernova_remnant", "Q207436"),
    ("Star Cluster", "star-cluster", "structure", "A group of stars gravitationally bound together — globular or open.",
     [], "Star_cluster", "Q11276"),
    ("Globular Cluster", "globular-cluster", "structure", "A tightly-bound spherical cluster of hundreds of thousands to millions of very old stars orbiting a galaxy.",
     [], "Globular_cluster", "Q11276"),
    ("Open Cluster", "open-cluster", "structure", "A group of up to a few thousand young stars formed from the same molecular cloud.",
     [], "Open_cluster", "Q11396"),
    ("Molecular Cloud", "molecular-cloud", "structure", "A cold, dense interstellar cloud where hydrogen exists mostly as H₂ and where new stars form.",
     [], "Molecular_cloud", "Q722"),
    ("Interstellar Medium", "interstellar-medium", "structure", "The matter and radiation between the stars in a galaxy — mostly hydrogen gas and dust.",
     ["ISM"], "Interstellar_medium", "Q210084"),
    ("Accretion Disk", "accretion-disk", "structure", "A rotating disk of matter spiraling into a central massive object such as a black hole or young star.",
     [], "Accretion_disk", "Q206302"),
    ("Quasar", "quasar", "body", "An extremely luminous active galactic nucleus powered by a supermassive black hole accreting matter.",
     [], "Quasar", "Q83373"),
    ("Active Galactic Nucleus", "active-galactic-nucleus", "structure", "A compact region at the center of a galaxy with much higher-than-normal luminosity, powered by accretion onto a supermassive black hole.",
     ["AGN"], "Active_galactic_nucleus", "Q46587"),
]
for name, slug, kind, narr, extras, wp, wd in GALACTIC:
    if slug == "universe":
        parent = "cosmology"
    elif slug in ("observable-universe", "cosmic-web", "laniakea"):
        parent = "cosmology"
    else:
        parent = "galactic-astronomy"
    SCIENCES.append(A(name, slug, kind, narr, parent, extras=extras, wp=wp, wd=wd))

# ---- COSMOLOGY ----
COSMO = [
    ("Big Bang", "big-bang", "phenomenon", "The prevailing cosmological model: the universe began as an extremely hot, dense state ~13.8 billion years ago and has been expanding ever since.",
     [], "Big_Bang", "Q323", "lemaitre-georges", 1927),
    ("Cosmic Microwave Background", "cmb", "phenomenon", "The faint thermal radiation left over from the recombination epoch, ~380,000 years after the Big Bang — a snapshot of the early universe.",
     ["CMB", "microwave background"], "Cosmic_microwave_background", "Q133696", "penzias-arno", 1965),
    ("Inflation", "cosmic-inflation", "phenomenon", "Hypothesized period of exponential expansion in the first fraction of a second after the Big Bang.",
     ["inflationary epoch"], "Inflation_(cosmology)", "Q179294", "guth-alan", 1980),
    ("Cosmological Redshift", "cosmological-redshift", "phenomenon", "The stretching of light wavelengths from distant galaxies due to the expansion of space itself.",
     ["redshift"], "Redshift", "Q11621", None, None),
    ("Hubble's Law", "hubbles-law", "law", "The linear relationship between a galaxy's distance and its recession velocity — evidence for cosmic expansion.",
     [], "Hubble%27s_law", "Q179916", "hubble-edwin", 1929),
    ("Dark Matter", "dark-matter", "phenomenon", "Invisible matter comprising ~27% of the universe's mass-energy, inferred from its gravitational effects.",
     [], "Dark_matter", "Q6088", None, None),
    ("Dark Energy", "dark-energy", "phenomenon", "Mysterious energy comprising ~68% of the universe's mass-energy, driving the observed acceleration of cosmic expansion.",
     [], "Dark_energy", "Q46060", None, 1998),
    ("Cosmological Constant", "cosmological-constant", "constant", "The energy density of empty space in Einstein's equations, often identified with dark energy; symbol Λ.",
     ["Λ"], "Cosmological_constant", "Q189114", "einstein-albert", 1917),
    ("Nucleosynthesis", "nucleosynthesis", "phenomenon", "The process by which atomic nuclei are formed — Big Bang nucleosynthesis, stellar nucleosynthesis, supernova nucleosynthesis.",
     [], "Nucleosynthesis", "Q189197", None, None),
    ("Big Bang Nucleosynthesis", "big-bang-nucleosynthesis", "phenomenon", "The production of light nuclei (hydrogen, helium, lithium) in the first ~20 minutes after the Big Bang.",
     ["BBN"], "Big_Bang_nucleosynthesis", "Q207361", None, None),
    ("Recombination Epoch", "recombination-epoch", "phenomenon", "The period ~380,000 years after the Big Bang when electrons combined with nuclei, letting light travel freely for the first time.",
     [], "Recombination_(cosmology)", "Q193627", None, None),
    ("Age of the Universe", "age-universe", "quantity", "The time since the Big Bang, currently estimated at 13.79 ± 0.02 billion years.",
     [], "Age_of_the_universe", "Q179916", None, None),
    ("Multiverse", "multiverse", "framework", "Speculative hypothesis of many universes beyond our observable one; motivated by inflation and string theory.",
     [], "Multiverse", "Q179294", None, None),
]
for row in COSMO:
    name, slug, kind, narr, extras, wp, wd, disc_who, year = row
    status = ":speculative" if slug in ("multiverse",) else None
    SCIENCES.append(A(name, slug, kind, narr, "cosmology",
                     extras=extras, described_by=[f"person-{disc_who}"] if disc_who else None,
                     described_year=year, status=status,
                     wp=wp, wd=wd))

# ---- ASTRONOMICAL PHENOMENA ----
PHENOMENA = [
    ("Eclipse", "eclipse", "phenomenon", "An astronomical event where one body passes into the shadow of another — solar or lunar."),
    ("Solar Eclipse", "solar-eclipse", "phenomenon", "The moon passes between Earth and sun, blocking the sun partially or totally."),
    ("Lunar Eclipse", "lunar-eclipse", "phenomenon", "Earth's shadow falls on the moon, dimming or reddening it."),
    ("Transit (astronomy)", "transit-astronomy", "phenomenon", "A smaller body crosses the face of a larger one — Venus transits, exoplanet transits."),
    ("Occultation", "occultation", "phenomenon", "One celestial body passing in front of another, hiding it from view."),
    ("Meteor Shower", "meteor-shower", "phenomenon", "A celestial event where many meteors are observed radiating from a single point, as Earth passes through cometary debris."),
    ("Perseid Meteor Shower", "perseids", "phenomenon", "Annual August meteor shower from debris of Comet Swift-Tuttle."),
    ("Leonid Meteor Shower", "leonids", "phenomenon", "Annual November meteor shower from debris of Comet Tempel-Tuttle."),
    ("Aurora Borealis", "aurora-borealis", "phenomenon", "The 'northern lights' — coloured lights in the sky from charged particles interacting with the upper atmosphere near the magnetic pole."),
    ("Aurora Australis", "aurora-australis", "phenomenon", "The 'southern lights' — the southern-hemisphere analog of the aurora borealis."),
    ("Comet", "comet", "body", "An icy small solar system body that develops a coma and tail when it approaches the sun."),
    ("Asteroid", "asteroid", "body", "A rocky small solar system body, mostly in the asteroid belt."),
    ("Meteoroid", "meteoroid", "body", "A small rocky or metallic body in outer space."),
    ("Meteor", "meteor", "phenomenon", "The visible streak of light when a meteoroid enters Earth's atmosphere and burns up."),
    ("Meteorite", "meteorite", "body", "The solid remnant of a meteoroid that survives passage through the atmosphere and reaches the surface."),
    ("Solar Flare", "solar-flare", "phenomenon", "A sudden flash of increased brightness on the sun from magnetic reconnection releasing energy stored in the corona."),
    ("Coronal Mass Ejection", "coronal-mass-ejection", "phenomenon", "A large expulsion of plasma and magnetic field from the sun's corona into interplanetary space."),
    ("Sunspot", "sunspot", "phenomenon", "A temporary phenomenon on the sun's photosphere appearing as a darker area due to strong magnetic field flux."),
    ("Solar Wind", "solar-wind", "phenomenon", "A stream of charged particles emitted by the sun's upper atmosphere."),
    ("Magnetosphere", "magnetosphere", "structure", "The region of space around a magnetized planet within which its magnetic field dominates."),
    ("Van Allen Belts", "van-allen-belts", "structure", "Zones of energetic charged particles trapped by Earth's magnetic field."),
    ("Exoplanet", "exoplanet", "body", "A planet outside our solar system, orbiting another star."),
    ("Hot Jupiter", "hot-jupiter", "body", "A giant exoplanet in a very close orbit around its star, making it extremely hot."),
    ("Super-Earth", "super-earth", "body", "A rocky exoplanet more massive than Earth but less than the ice giants."),
    ("Habitable Zone", "habitable-zone", "structure", "The orbital region around a star where a planet could sustain liquid water on its surface — the 'Goldilocks zone'."),
    ("Gravitational Wave", "gravitational-wave", "phenomenon", "Ripples in the fabric of spacetime, predicted by general relativity and first detected in 2015 by LIGO."),
    ("Gravitational Lens", "gravitational-lens", "phenomenon", "A distribution of matter that bends light from a distant source, distorting or magnifying it — a prediction of general relativity."),
    ("Redshift-Magnitude Diagram", "hubble-diagram", "measurement", "A plot of galaxy redshifts against distances used to measure the expansion of the universe."),
    ("Parallax", "parallax", "measurement", "The apparent shift in position of a nearby star against distant background stars as Earth orbits the sun, used to measure distances."),
    ("Standard Candle", "standard-candle", "measurement", "An astronomical object of known luminosity used to measure cosmic distances — Cepheids, Type Ia supernovae."),
    ("Light-Year", "light-year", "unit", "The distance light travels in one Julian year, ~9.46 trillion km."),
    ("Parsec", "parsec", "unit", "The distance at which one astronomical unit subtends an angle of one arcsecond, ~3.26 light-years."),
    ("Astronomical Unit", "astronomical-unit", "unit", "The average distance between Earth and the sun, ~149.6 million km."),
]
for name, slug, kind, narr in PHENOMENA:
    if kind == "unit":
        parent = "astronomical-units"
    elif slug in ("comet", "asteroid", "meteoroid", "meteorite", "exoplanet", "hot-jupiter", "super-earth"):
        parent = "solar-system"
    else:
        parent = "astronomical-phenomena"
    SCIENCES.append(A(name, slug, kind, narr, parent, wp=name.replace(" ", "_")))

# ---- SUB-AREAS ----
for name, slug, narr in [
    ("Astronomy", "astronomy", "The natural science that studies celestial objects and phenomena — the universe beyond Earth."),
    ("Cosmology", "cosmology", "The scientific study of the origin, evolution, and eventual fate of the universe."),
    ("Astrophysics", "astrophysics", "The physics-based branch of astronomy studying properties and interactions of celestial objects."),
    ("Stellar Astronomy", "stellar-astronomy", "The study of stars and stellar systems."),
    ("Stellar Phenomena", "stellar-phenomena", "The transient and cyclic phenomena occurring in and around stars."),
    ("Galactic Astronomy", "galactic-astronomy", "The study of galaxies — structure, formation, evolution."),
    ("Planetary Science", "planetary-science", "The study of planets, moons, and planetary systems, including our own."),
    ("Astronomical Phenomena", "astronomical-phenomena", "Transient or recurring events observed in the heavens."),
    ("Astronomical Units", "astronomical-units", "Standard units for measuring astronomical distances and quantities."),
    ("Moon Category", "moon-category", "Natural satellites of planets and dwarf planets."),
]:
    SCIENCES.append(S(name, "astronomy", "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by="astronomy",
                     provenance=W(name.replace(" ", "_"))))
