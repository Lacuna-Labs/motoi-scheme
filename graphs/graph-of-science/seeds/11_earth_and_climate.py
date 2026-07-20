"""Earth science, geology, meteorology, oceanography. Target ~300 nodes."""

from _helpers import S


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


def E(name, slug, kind, disc, narr, everyday=None, extras=None,
      subsumed_by=None, applies=None, wp=None):
    return S(name, disc, kind,
             id_slug=slug, extras=extras or [], narrative=narr, everyday=everyday,
             applies=applies or [":everyday", ":geological-timescale"],
             subsumed_by=subsumed_by or "earth-science",
             provenance=W(wp or name.replace(" ", "_")))


SCIENCES = []

# ---- GEOLOGY ----
GEOLOGY = [
    ("Plate Tectonics", "plate-tectonics", "geology", "The theory that Earth's lithosphere is divided into plates that move over the plastic asthenosphere, causing earthquakes, volcanoes, and mountain-building.",
     "The Himalayas rise as the Indian plate collides with Eurasia.",
     ["continental drift theory"], "geology"),
    ("Continental Drift", "continental-drift", "geology", "The movement of Earth's continents relative to each other, proposed by Wegener in 1912 and later explained by plate tectonics.",
     None, ["Wegener's theory"], "geology"),
    ("Seafloor Spreading", "seafloor-spreading", "geology", "The process where new oceanic crust forms at mid-ocean ridges as tectonic plates move apart.",
     None, [], "geology"),
    ("Subduction", "subduction", "geology", "The process by which one tectonic plate slides beneath another, recycling crust into the mantle.",
     None, [], "geology"),
    ("Fault (geology)", "geological-fault", "geology", "A fracture in Earth's crust along which blocks of rock have moved relative to each other.",
     None, ["fault line"], "geology"),
    ("San Andreas Fault", "san-andreas-fault", "geology", "Transform fault running through California marking the boundary between the Pacific and North American plates.",
     None, [], "geology"),
    ("Ring of Fire", "ring-of-fire", "geology", "The horseshoe-shaped zone around the Pacific with intense volcanic and seismic activity.",
     None, [], "geology"),
    ("Rock Cycle", "rock-cycle", "geology", "The transformation of rocks between igneous, sedimentary, and metamorphic forms over geological time.",
     None, [], "geology"),
    ("Igneous Rock", "igneous-rock", "geology", "Rock formed through cooling and crystallization of magma or lava.",
     None, [], "geology"),
    ("Sedimentary Rock", "sedimentary-rock", "geology", "Rock formed by accumulation and cementation of mineral or organic particles.",
     None, [], "geology"),
    ("Metamorphic Rock", "metamorphic-rock", "geology", "Rock transformed by heat, pressure, or chemically active fluids from an original type.",
     None, [], "geology"),
    ("Granite", "granite", "geology", "Common coarse-grained intrusive igneous rock composed mainly of quartz and feldspar.",
     None, [], "geology"),
    ("Basalt", "basalt", "geology", "Dark, fine-grained volcanic rock; the most common rock on the surface of Earth's crust.",
     None, [], "geology"),
    ("Sandstone", "sandstone", "geology", "Sedimentary rock composed of sand-size mineral particles cemented together.",
     None, [], "geology"),
    ("Limestone", "limestone", "geology", "Sedimentary rock composed largely of calcium carbonate, often from marine organism remains.",
     None, [], "geology"),
    ("Marble", "marble", "geology", "Metamorphic rock derived from limestone; prized for sculpture and architecture.",
     None, [], "geology"),
    ("Quartz", "quartz", "geology", "Hard crystalline mineral of silicon dioxide; one of the most abundant minerals on Earth's surface.",
     None, [], "geology"),
    ("Feldspar", "feldspar", "geology", "Group of rock-forming aluminum tectosilicates, comprising ~60% of Earth's crust.",
     None, [], "geology"),
    ("Mica", "mica", "geology", "Group of sheet silicate minerals with perfect basal cleavage — biotite, muscovite.",
     None, [], "geology"),
    ("Mineral", "mineral", "geology", "Naturally-occurring inorganic solid with a definite chemical composition and ordered atomic structure.",
     None, [], "geology"),
    ("Volcano", "volcano", "geology", "A rupture in Earth's crust that allows lava, ash, and gases to escape from a magma chamber below.",
     None, [], "geology"),
    ("Shield Volcano", "shield-volcano", "geology", "Broad, gently-sloped volcano built by low-viscosity basaltic lava flows — like Mauna Loa.",
     None, [], "geology"),
    ("Stratovolcano", "stratovolcano", "geology", "Tall, conical volcano built by many layers of lava, tephra, and ash — like Mt. Fuji.",
     None, ["composite volcano"], "geology"),
    ("Earthquake", "earthquake", "geology", "Shaking of Earth's surface from sudden release of energy in the crust, often along faults.",
     "The 1906 San Francisco earthquake had a magnitude around 7.9.",
     ["tremor", "seismic event"], "geology"),
    ("Richter Scale", "richter-scale", "geology", "Historic base-10 logarithmic scale for measuring earthquake magnitude; largely superseded by the moment magnitude scale.",
     None, [], "geology"),
    ("Moment Magnitude Scale", "moment-magnitude-scale", "geology", "Modern logarithmic scale for measuring earthquake magnitude based on seismic moment.",
     None, ["Mw"], "geology"),
    ("Tsunami", "tsunami", "geology", "A series of large ocean waves caused by underwater earthquakes, volcanic eruptions, or landslides.",
     None, ["tidal wave (misnomer)", "seismic sea wave"], "geology"),
    ("Landslide", "landslide", "geology", "The downhill movement of rock, soil, or debris.",
     None, ["landslip", "mass wasting"], "geology"),
    ("Glacier", "glacier", "geology", "A persistent body of dense ice that moves under its own weight.",
     None, [], "geology"),
    ("Iceberg", "iceberg", "geology", "A large piece of freshwater ice that has broken off from a glacier or ice shelf and is floating in open water.",
     None, [], "geology"),
    ("Fossil", "fossil", "geology", "Preserved remains, imprint, or trace of once-living organisms from a past geological age.",
     None, [], "geology"),
    ("Mountain", "mountain", "geology", "Large landform that rises above surrounding land, typically over 300 m.",
     None, [], "geology"),
    ("Mountain Range", "mountain-range", "geology", "A geographically connected series of mountains — Rockies, Alps, Himalayas, Andes.",
     None, [], "geology"),
    ("Continent", "continent", "geology", "One of Earth's several very large landmasses — traditionally seven.",
     None, [], "geology"),
    ("Ocean Basin", "ocean-basin", "geology", "A large depression in the Earth's surface filled with ocean water.",
     None, [], "geology"),
    ("Crust (Earth)", "earth-crust", "geology", "The outermost solid layer of Earth, ~5-70 km thick, comprising continental and oceanic types.",
     None, [], "geology"),
    ("Mantle (Earth)", "earth-mantle", "geology", "The mostly solid rocky layer beneath Earth's crust and above the outer core, ~2,900 km thick.",
     None, [], "geology"),
    ("Outer Core", "outer-core", "geology", "The liquid iron-nickel layer of Earth beneath the mantle, whose motion generates the geomagnetic field.",
     None, [], "geology"),
    ("Inner Core", "inner-core", "geology", "The solid iron-nickel sphere at Earth's center, ~1,220 km radius, kept solid by immense pressure despite ~5,400 °C temperature.",
     None, [], "geology"),
    ("Lithosphere", "lithosphere", "geology", "The rigid outer layer of Earth, comprising the crust and uppermost mantle; broken into tectonic plates.",
     None, [], "geology"),
    ("Asthenosphere", "asthenosphere", "geology", "The plastic, partially-molten layer of the upper mantle on which the lithosphere floats.",
     None, [], "geology"),
    ("Karst", "karst", "geology", "Landscape formed by dissolution of soluble rocks such as limestone — features caves, sinkholes, and underground drainage.",
     None, [], "geology"),
    ("Sinkhole", "sinkhole", "geology", "A depression in the ground caused by collapse of a surface layer, often into an underground void.",
     None, [], "geology"),
    ("Delta", "river-delta", "geology", "A landform formed at the mouth of a river where sediment is deposited.",
     None, [], "geology"),
    ("Estuary", "estuary", "geology", "A partially-enclosed coastal body of brackish water with one or more rivers flowing into it.",
     None, [], "geology"),
]

for row in GEOLOGY:
    name, slug, disc, narr, everyday, extras, subsumed_by = row
    kind = "phenomenon" if slug in ("plate-tectonics", "continental-drift", "seafloor-spreading", "subduction", "earthquake", "tsunami", "landslide") else \
           "structure" if slug in ("crust", "mantle", "core") or "core" in slug or slug in ("lithosphere", "asthenosphere") else \
           "measurement" if slug in ("richter-scale", "moment-magnitude-scale") else \
           "object"
    SCIENCES.append(E(name, slug, kind, disc, narr, everyday=everyday, extras=extras,
                     subsumed_by=subsumed_by))

# ---- METEOROLOGY + CLIMATE ----
WEATHER = [
    ("Weather", "weather", "meteorology", "The state of the atmosphere at a given place and time, including temperature, precipitation, humidity, wind."),
    ("Climate", "climate", "meteorology", "The long-term average weather pattern of a place, typically over 30 years."),
    ("Climate Change", "climate-change", "meteorology", "Long-term shifts in temperatures and weather patterns; since the mid-20th century driven primarily by human activity."),
    ("Global Warming", "global-warming", "meteorology", "The long-term increase in Earth's average surface temperature, currently ~1.1 °C above pre-industrial levels."),
    ("Greenhouse Effect", "greenhouse-effect", "meteorology", "The process by which atmospheric gases absorb outgoing infrared radiation, warming the planet's surface."),
    ("Greenhouse Gas", "greenhouse-gas", "meteorology", "Atmospheric gas that absorbs and emits infrared radiation — CO₂, CH₄, N₂O, H₂O, ozone."),
    ("Atmosphere", "atmosphere", "meteorology", "The layer of gases surrounding a planet; Earth's is ~78% N₂, ~21% O₂, ~1% Ar, ~0.04% CO₂."),
    ("Troposphere", "troposphere", "meteorology", "The lowest layer of Earth's atmosphere, from surface to ~10 km, where weather occurs."),
    ("Stratosphere", "stratosphere", "meteorology", "The second layer of Earth's atmosphere, from ~10-50 km, containing the ozone layer."),
    ("Mesosphere", "mesosphere", "meteorology", "The third atmospheric layer, from ~50-85 km, where most meteors burn up."),
    ("Thermosphere", "thermosphere", "meteorology", "The fourth atmospheric layer, from ~85-600 km, containing the ionosphere."),
    ("Exosphere", "exosphere", "meteorology", "The outermost atmospheric layer, gradually thinning into space."),
    ("Ionosphere", "ionosphere", "meteorology", "Region of the atmosphere ionized by solar radiation; enables long-distance radio propagation."),
    ("Ozone Depletion", "ozone-depletion", "meteorology", "Reduction in stratospheric ozone caused by anthropogenic release of chlorofluorocarbons and other halons."),
    ("Hurricane", "hurricane", "meteorology", "A tropical cyclone in the North Atlantic and Northeast Pacific with sustained winds of ≥74 mph."),
    ("Typhoon", "typhoon", "meteorology", "A tropical cyclone in the Northwest Pacific — regional name for the same phenomenon as a hurricane."),
    ("Cyclone", "cyclone", "meteorology", "A large-scale system of winds rotating around a low-pressure center; tropical, subtropical, or extratropical."),
    ("Tornado", "tornado", "meteorology", "A violently rotating column of air extending from a thunderstorm to the ground."),
    ("Thunderstorm", "thunderstorm", "meteorology", "A storm characterized by lightning and its acoustic effect, thunder."),
    ("Blizzard", "blizzard", "meteorology", "A severe snowstorm with sustained winds ≥35 mph and low visibility."),
    ("Drought", "drought", "meteorology", "A prolonged period of abnormally low rainfall leading to water shortage."),
    ("Monsoon", "monsoon", "meteorology", "A seasonal reversing wind system accompanied by shifting precipitation patterns, especially in South Asia."),
    ("Trade Winds", "trade-winds", "meteorology", "Persistent easterly winds in the equatorial regions of Earth."),
    ("Jet Stream", "jet-stream", "meteorology", "Fast-flowing narrow air current in the atmosphere, typically at the boundary of major air masses."),
    ("Precipitation", "precipitation", "meteorology", "Any form of water — rain, snow, sleet, hail — falling from clouds to the surface."),
    ("Rain", "rain", "meteorology", "Precipitation in the form of liquid water droplets."),
    ("Snow", "snow", "meteorology", "Precipitation in the form of ice crystals falling from clouds."),
    ("Hail", "hail", "meteorology", "Precipitation in the form of balls or lumps of ice."),
    ("Fog", "fog", "meteorology", "A cloud in contact with the ground, reducing visibility."),
    ("Cloud", "cloud", "meteorology", "A visible mass of water droplets or ice crystals suspended in the atmosphere."),
    ("Cumulus Cloud", "cumulus-cloud", "meteorology", "Puffy, cotton-like cloud with a flat base — the classic 'fair weather' cloud."),
    ("Cirrus Cloud", "cirrus-cloud", "meteorology", "High-altitude wispy cloud made of ice crystals."),
    ("Stratus Cloud", "stratus-cloud", "meteorology", "Low, uniform grey cloud layer often producing light drizzle or mist."),
    ("Cumulonimbus", "cumulonimbus", "meteorology", "Dense, towering vertical cloud associated with thunderstorms."),
    ("Humidity", "humidity", "meteorology", "The concentration of water vapor in air."),
    ("Barometric Pressure", "barometric-pressure", "meteorology", "The pressure exerted by the weight of the atmosphere."),
    ("Wind", "wind", "meteorology", "The natural movement of air, from areas of high pressure to areas of low pressure."),
    ("El Niño Southern Oscillation", "enso", "meteorology", "A periodic climate pattern in the equatorial Pacific with two phases: El Niño (warm) and La Niña (cool)."),
    ("La Niña", "la-nina", "meteorology", "The cool phase of ENSO, with lower-than-average sea-surface temperatures in the central and eastern tropical Pacific."),
    ("Polar Vortex", "polar-vortex", "meteorology", "A large area of low pressure and cold air surrounding both of Earth's poles; can weaken and drift southward in winter."),
    ("Milankovitch Cycles", "milankovitch-cycles", "meteorology", "Long-term cyclical changes in Earth's orbital and axial parameters that drive glacial and interglacial periods."),
    ("Albedo", "albedo", "meteorology", "The measure of the diffuse reflection of solar radiation from a surface — snow has high albedo, dark oceans low."),
    ("Ocean Acidification", "ocean-acidification", "oceanography", "The ongoing decrease in ocean pH due to absorption of atmospheric CO₂."),
    ("Sea Level Rise", "sea-level-rise", "oceanography", "The long-term upward trend in average global sea level driven by thermal expansion and melting land ice."),
    ("Coral Bleaching", "coral-bleaching", "oceanography", "The stress-induced expulsion of symbiotic algae by corals, often driven by ocean warming."),
    ("Thermohaline Circulation", "thermohaline-circulation", "oceanography", "The large-scale ocean circulation driven by density differences from temperature and salinity — the 'global conveyor belt'."),
    ("Coriolis Force", "coriolis-force", "meteorology", "The apparent deflection of moving objects in a rotating reference frame — deflects winds and ocean currents."),
    ("Aurora", "aurora", "meteorology", "Lights in the sky at high latitudes from charged particles from the sun interacting with the upper atmosphere."),
    ("Rainbow (meteorology)", "rainbow-meteorology", "meteorology", "Multicolored circular arc from reflection, refraction, and dispersion of sunlight in water droplets."),
    ("Lightning", "lightning", "meteorology", "Sudden electrostatic discharge accompanying thunderstorms."),
    ("Thunder", "thunder", "meteorology", "The sound wave produced by lightning superheating and rapidly expanding the surrounding air."),
]

for name, slug, disc, narr in WEATHER:
    kind = "phenomenon" if slug in ("weather", "climate-change", "global-warming", "greenhouse-effect", "hurricane", "typhoon", "cyclone", "tornado", "thunderstorm", "blizzard", "drought", "monsoon", "precipitation", "rain", "snow", "hail", "fog", "wind", "enso", "la-nina", "polar-vortex", "ocean-acidification", "sea-level-rise", "coral-bleaching", "thermohaline-circulation", "coriolis-force", "aurora", "rainbow-meteorology", "lightning", "thunder", "ozone-depletion", "milankovitch-cycles") else \
           "quantity" if slug in ("humidity", "barometric-pressure", "albedo") else \
           "structure" if slug in ("atmosphere", "troposphere", "stratosphere", "mesosphere", "thermosphere", "exosphere", "ionosphere", "cloud", "cumulus-cloud", "cirrus-cloud", "stratus-cloud", "cumulonimbus", "trade-winds", "jet-stream") else \
           "object"
    parent = "climate" if slug in ("global-warming", "climate-change", "greenhouse-effect", "greenhouse-gas", "el-nino-southern-oscillation") else ("oceanography" if disc == "oceanography" else "meteorology")
    SCIENCES.append(E(name, slug, kind, disc, narr, subsumed_by=parent))

# ---- SUB-AREAS ----
for name, slug, narr, parent in [
    ("Earth Science", "earth-science", "The study of Earth and its neighbors in space — encompasses geology, meteorology, oceanography, glaciology.", None),
    ("Geology", "geology", "The study of Earth's solid materials, structures, and processes.", "earth-science"),
    ("Meteorology", "meteorology", "The scientific study of the atmosphere, focusing on weather processes and forecasting.", "earth-science"),
    ("Oceanography", "oceanography", "The study of the physical, chemical, biological, and geological aspects of the oceans.", "earth-science"),
    ("Climate", "climate", "The long-term patterns of temperature, precipitation, and wind in a region.", "meteorology"),
    ("Volcanology", "volcanology", "The study of volcanoes, lava, magma, and related phenomena.", "geology"),
    ("Seismology", "seismology", "The study of earthquakes and the propagation of elastic waves through the Earth.", "geology"),
    ("Glaciology", "glaciology", "The study of glaciers, or more generally ice and natural phenomena involving ice.", "earth-science"),
    ("Hydrology", "hydrology", "The scientific study of water, its properties, distribution, and effects on Earth's surface, soil, and atmosphere.", "earth-science"),
    ("Paleontology", "paleontology", "The scientific study of life that existed prior to human history through fossil analysis.", "earth-science"),
    ("Geomorphology", "geomorphology", "The scientific study of landforms and the processes that shape them.", "geology"),
]:
    SCIENCES.append(S(name, "earth-science" if name != "Meteorology" else "meteorology", "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by=parent or "science",
                     provenance=W(name.replace(" ", "_"))))
