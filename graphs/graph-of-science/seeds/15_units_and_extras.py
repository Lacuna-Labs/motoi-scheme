"""SI units, notable derived units, and remaining coverage. Target ~150 nodes."""

from _helpers import S


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


SCIENCES = []

# ---- SI BASE UNITS ----
SI_BASE = [
    ("Meter", "meter", "m", "The SI base unit of length; defined by the speed of light.", ":everyday"),
    ("Kilogram", "kilogram", "kg", "The SI base unit of mass; defined by the Planck constant.", ":everyday"),
    ("Second", "second", "s", "The SI base unit of time; defined by the cesium-133 hyperfine transition frequency.", ":everyday"),
    ("Ampere", "ampere", "A", "The SI base unit of electric current; defined by the elementary charge.", ":materials"),
    ("Kelvin", "kelvin", "K", "The SI base unit of thermodynamic temperature; defined by the Boltzmann constant.", ":materials"),
    ("Mole (SI)", "mole-si", "mol", "The SI base unit of amount of substance; defined as exactly 6.02214076×10²³ elementary entities.", ":materials"),
    ("Candela", "candela", "cd", "The SI base unit of luminous intensity in a given direction.", ":everyday"),
]
for name, slug, symbol, narr, applies in SI_BASE:
    SCIENCES.append(S(name, "physics", "unit",
                     id_slug=slug, extras=[symbol, name.lower()],
                     narrative=narr, applies=[applies],
                     subsumed_by="si-units",
                     provenance=W(name.replace(" ", "_").replace("(SI)", "").strip())))

# ---- SI DERIVED UNITS ----
SI_DERIVED = [
    ("Newton (unit)", "newton-unit", "N", "SI derived unit of force; 1 N = 1 kg·m/s²."),
    ("Joule", "joule", "J", "SI derived unit of energy; 1 J = 1 N·m = 1 kg·m²/s²."),
    ("Watt", "watt", "W", "SI derived unit of power; 1 W = 1 J/s."),
    ("Pascal (unit)", "pascal-unit", "Pa", "SI derived unit of pressure; 1 Pa = 1 N/m²."),
    ("Hertz", "hertz", "Hz", "SI derived unit of frequency; 1 Hz = 1 cycle per second."),
    ("Coulomb", "coulomb", "C", "SI derived unit of electric charge; 1 C = 1 A·s."),
    ("Volt", "volt", "V", "SI derived unit of electric potential; 1 V = 1 J/C."),
    ("Ohm", "ohm", "Ω", "SI derived unit of electrical resistance; 1 Ω = 1 V/A."),
    ("Farad", "farad", "F", "SI derived unit of electrical capacitance; 1 F = 1 C/V."),
    ("Henry", "henry-unit", "H", "SI derived unit of electrical inductance; 1 H = 1 V·s/A."),
    ("Weber", "weber", "Wb", "SI derived unit of magnetic flux; 1 Wb = 1 V·s."),
    ("Tesla (unit)", "tesla-unit", "T", "SI derived unit of magnetic flux density; 1 T = 1 Wb/m²."),
    ("Lux", "lux", "lx", "SI derived unit of illuminance; 1 lx = 1 lm/m²."),
    ("Lumen", "lumen", "lm", "SI derived unit of luminous flux; 1 lm = 1 cd·sr."),
    ("Becquerel", "becquerel", "Bq", "SI derived unit of radioactivity; 1 Bq = 1 decay per second."),
    ("Gray", "gray-unit", "Gy", "SI derived unit of absorbed dose of ionizing radiation; 1 Gy = 1 J/kg."),
    ("Sievert", "sievert", "Sv", "SI derived unit of equivalent radiation dose; incorporates biological effectiveness."),
    ("Radian", "radian", "rad", "SI unit of plane angle; the angle subtended at the center of a circle by an arc equal in length to the radius."),
    ("Steradian", "steradian", "sr", "SI unit of solid angle."),
    ("Degree Celsius", "degree-celsius", "°C", "SI derived unit of temperature offset from Kelvin by 273.15."),
]
for name, slug, symbol, narr in SI_DERIVED:
    SCIENCES.append(S(name, "physics", "unit",
                     id_slug=slug, extras=[symbol, name.lower(), name.split(" (")[0]],
                     narrative=narr, applies=[":everyday", ":materials"],
                     subsumed_by="si-units",
                     provenance=W(name.split(" (")[0].replace(" ", "_"))))

# ---- COMMON NON-SI UNITS ----
COMMON_UNITS = [
    ("Foot (unit)", "foot-unit", "ft", "Non-SI unit of length equal to 0.3048 m."),
    ("Inch", "inch", "in", "Non-SI unit of length equal to 1/12 foot, exactly 0.0254 m."),
    ("Mile", "mile", "mi", "Non-SI unit of length equal to 5280 feet or 1609.344 m."),
    ("Yard", "yard-unit", "yd", "Non-SI unit of length equal to 3 feet or 0.9144 m."),
    ("Nautical Mile", "nautical-mile", "nmi", "Unit of length used in maritime and aviation contexts, equal to 1852 m."),
    ("Pound (mass)", "pound-mass", "lb", "Unit of mass equal to 0.45359237 kg."),
    ("Ounce (mass)", "ounce-mass", "oz", "Unit of mass equal to 1/16 pound."),
    ("Ton (metric)", "metric-ton", "t", "Unit of mass equal to 1000 kg."),
    ("Gallon (US)", "gallon-us", "gal", "US volume equal to 3.785411784 L."),
    ("Liter", "liter", "L", "Non-SI unit of volume equal to 0.001 m³."),
    ("Milliliter", "milliliter", "mL", "One thousandth of a liter; equal to a cubic centimeter."),
    ("Cubic Centimeter", "cubic-centimeter", "cm³", "SI-related unit of volume; equal to a milliliter."),
    ("Fahrenheit", "fahrenheit", "°F", "Temperature scale where water freezes at 32 °F and boils at 212 °F."),
    ("Bar (pressure)", "bar-pressure", "bar", "Metric-derived unit of pressure equal to 100 000 Pa."),
    ("Atmosphere", "atmosphere-unit", "atm", "Unit of pressure defined as exactly 101 325 Pa — average atmospheric pressure at sea level."),
    ("PSI (pressure)", "psi", "psi", "Pounds per square inch — English unit of pressure."),
    ("Calorie", "calorie", "cal", "Non-SI unit of energy; 1 cal ≈ 4.184 J; a food-Calorie is 1000 cal."),
    ("BTU", "btu", "BTU", "British Thermal Unit — approximately 1055 J."),
    ("Horsepower", "horsepower", "hp", "Non-SI unit of power; mechanical horsepower is 745.7 W."),
    ("Angstrom", "angstrom", "Å", "Non-SI unit of length equal to 10⁻¹⁰ m — the scale of atoms and molecules."),
    ("Micron", "micron", "µm", "Old name for the micrometer, 10⁻⁶ m."),
    ("Barrel (oil)", "barrel-oil", "bbl", "Unit of volume in the petroleum industry equal to 42 US gallons or ~159 L."),
    ("Carat", "carat", "ct", "Unit of mass for gemstones equal to 200 mg."),
    ("Molarity (unit)", "molarity-unit", "M", "Molar concentration — moles of solute per liter of solution."),
    ("Parts per Million", "ppm", "ppm", "Dimensionless ratio expressing concentration as one part per million."),
    ("Decibel", "decibel", "dB", "Logarithmic unit expressing the ratio of two values of a physical quantity, often power or amplitude."),
    ("pH (unit)", "ph-unit", "pH", "Logarithmic measure of the acidity or basicity of an aqueous solution — pH < 7 acidic, > 7 basic."),
    ("Electronvolt", "electronvolt", "eV", "Unit of energy equal to the energy gained by an electron accelerated through 1 V; ≈ 1.602×10⁻¹⁹ J."),
    ("Astronomical Unit (SI)", "astronomical-unit-si", "AU", "SI-recognized unit of length equal to ~149.6 million km — average Earth-Sun distance."),
    ("Light-Year (SI)", "light-year-si", "ly", "Distance light travels in one Julian year, ~9.46×10¹⁵ m."),
    ("Parsec (unit)", "parsec-unit", "pc", "Astronomical distance where 1 AU subtends 1 arcsecond, ~3.086×10¹⁶ m."),
]
for name, slug, symbol, narr in COMMON_UNITS:
    SCIENCES.append(S(name, "physics", "unit",
                     id_slug=slug, extras=[symbol, name.lower(), name.split(" (")[0]],
                     narrative=narr, applies=[":everyday", ":materials"],
                     subsumed_by="units-general",
                     provenance=W(name.split(" (")[0].replace(" ", "_"))))

# ---- CHEMISTRY EXTRAS: FUNCTIONAL GROUPS + REACTION TYPES ----
GROUPS = [
    ("Alcohol Functional Group", "alcohol-group", "-OH group on a carbon; the defining feature of alcohols."),
    ("Aldehyde Group", "aldehyde-group", "-CHO group; a carbon with a double-bonded oxygen and a hydrogen."),
    ("Ketone Group", "ketone-group", "C=O group with two carbons attached."),
    ("Carboxylic Acid Group", "carboxylic-acid-group", "-COOH group; the acidic functional group of carboxylic acids."),
    ("Ester Group", "ester-group", "-COO-R group; formed from a carboxylic acid and an alcohol."),
    ("Amine Group", "amine-group", "-NH₂ or substituted-nitrogen group; basic functional group of amines."),
    ("Amide Group", "amide-group", "-CONR₂ group; the amide bond joins amino acids into proteins."),
    ("Ether Group", "ether-group", "R-O-R' group; two carbons linked by oxygen."),
    ("Phosphate Group", "phosphate-group", "-PO₄ group; a phosphorus atom with four oxygens; key to nucleic acids and ATP."),
    ("Sulfhydryl Group", "sulfhydryl-group", "-SH group; found in cysteine and involved in protein disulfide bonds."),
    ("Nitro Group", "nitro-group", "-NO₂ group; found in explosives like TNT."),
    ("Halide Group", "halide-group", "-X substituent where X is a halogen (F, Cl, Br, I)."),
    ("Vinyl Group", "vinyl-group", "-CH=CH₂ group; enables polymerization of vinyl monomers."),
    ("Aromatic Ring", "aromatic-ring", "A cyclic, planar molecule with delocalized π-electrons — like benzene."),
    ("Peptide Bond", "peptide-bond", "The amide bond linking amino acids in a protein."),
    ("Glycosidic Bond", "glycosidic-bond", "The bond linking a sugar to another molecule, including in polysaccharides."),
    ("Ester Linkage", "ester-linkage", "The bond connecting a carboxylic acid and an alcohol; common in fats and biodegradable polymers."),
    ("Disulfide Bond", "disulfide-bond", "Covalent bond between two sulfur atoms, often stabilizing protein tertiary structure."),
]
for name, slug, narr in GROUPS:
    SCIENCES.append(S(name, "organic-chemistry", "structure",
                     id_slug=slug, extras=[name.lower()],
                     narrative=narr, applies=[":materials", ":biological"],
                     subsumed_by="organic-chemistry",
                     provenance=W(name.replace(" ", "_"))))

# ---- BIOLOGY: MORE PROCESSES ----
EXTRA_PROC = [
    ("Chemotaxis", "chemotaxis", "The movement of an organism or cell in response to a chemical stimulus.", "biology"),
    ("Phototaxis", "phototaxis", "The movement of an organism in response to light — moths to flames, plants to sunlight.", "biology"),
    ("Phototropism", "phototropism", "The growth of an organism in response to a light stimulus — plants bending toward light.", "biology"),
    ("Gravitropism", "gravitropism", "The growth of an organism in response to gravity — roots down, shoots up.", "biology"),
    ("Thigmotropism", "thigmotropism", "The growth or movement of an organism in response to touch — vines climbing.", "biology"),
    ("Hibernation", "hibernation", "A state of minimal activity and metabolic depression in animals during winter.", "biology"),
    ("Estivation", "estivation", "Summer dormancy in some animals, analogous to hibernation.", "biology"),
    ("Migration (animal)", "animal-migration", "The seasonal movement of animals from one region to another.", "biology"),
    ("Camouflage", "camouflage", "The use of coloration or pattern to blend with the environment and avoid detection.", "biology"),
    ("Mimicry", "mimicry", "Adaptation whereby one species evolves to resemble another for protection or predation.", "biology"),
    ("Molting", "molting", "The periodic shedding of skin, feathers, exoskeleton, or hair.", "biology"),
    ("Metamorphosis", "metamorphosis", "The developmental transformation of an animal — caterpillar to butterfly, tadpole to frog.", "biology"),
    ("Pollination", "pollination", "The transfer of pollen from anther to stigma, enabling plant fertilization.", "biology"),
    ("Seed Dispersal", "seed-dispersal", "The movement of seeds away from the parent plant by wind, water, animals, or gravity.", "biology"),
    ("Vernalization", "vernalization", "The induction of flowering in plants by prolonged exposure to cold.", "biology"),
    ("Territoriality", "territoriality", "The behavior of an animal that defends an area against others of its species.", "biology"),
    ("Courtship Display", "courtship-display", "Behavior by which one individual attracts a mate — songs, dances, displays.", "biology"),
    ("Parental Care", "parental-care", "Behavioral investment by parents to increase offspring fitness.", "biology"),
    ("Altruism (biology)", "altruism-biology", "Behavior that reduces an individual's fitness while increasing the fitness of others.", "biology"),
    ("Kin Selection", "kin-selection", "The evolutionary strategy that favors reproductive success of an organism's relatives.", "biology"),
]
for name, slug, narr, disc in EXTRA_PROC:
    SCIENCES.append(S(name, disc, "process",
                     id_slug=slug, extras=[name.lower()],
                     narrative=narr, applies=[":biological", ":everyday"],
                     subsumed_by="biology",
                     provenance=W(name.replace(" ", "_").replace("(biology)", "").strip())))

# ---- PARENT NODES ----
for name, slug, narr in [
    ("SI Units", "si-units", "The International System of Units — the modern form of the metric system, the world's most widely-used measurement system."),
    ("Units (general)", "units-general", "Standardized quantities used to measure and compare physical properties."),
]:
    SCIENCES.append(S(name, "physics", "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by="physics",
                     provenance=W(name.replace(" ", "_"))))
