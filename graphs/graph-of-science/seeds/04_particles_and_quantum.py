"""Fundamental particles, composite particles, atoms, quantum concepts.
Target ~200 nodes."""

from _helpers import S, PERSON


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


def WD(qid, name=None):
    p = [{"source": "wikidata", "qid": qid}]
    if name:
        p.append({"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"})
    return p


def P(name, slug, kind, disc, narr, everyday=None, applies=None,
      described_by=None, described_year=None, subsumed_by=None,
      related=None, wp=None, wd=None, formula=None, extras=None,
      status=None):
    prov = WD(wd, wp) if wd else W(wp or name.replace(" ", "_"))
    return S(name, disc, kind,
             id_slug=slug, extras=extras, narrative=narr, everyday=everyday,
             applies=applies, formula=formula,
             described_by=described_by, described_year=described_year,
             subsumed_by=subsumed_by, related=related, status=status,
             provenance=prov)


SCIENCES = []

# --- STANDARD MODEL: fundamental fermions (12 = 6 quarks + 6 leptons)
QUARKS = [
    ("Up Quark", "up-quark", "u", 1968, "Elementary quark with charge +2/3, first-generation; two ups and one down make a proton.", "gell-mann-murray", "Up_quark", "Q6494"),
    ("Down Quark", "down-quark", "d", 1968, "Elementary quark with charge −1/3, first-generation; two downs and one up make a neutron.", "gell-mann-murray", "Down_quark", "Q102165"),
    ("Charm Quark", "charm-quark", "c", 1974, "Elementary quark with charge +2/3, second-generation; discovered in the November Revolution as part of the J/ψ meson.", "richter-burton", "Charm_quark", "Q207830"),
    ("Strange Quark", "strange-quark", "s", 1968, "Elementary quark with charge −1/3, second-generation; carries the strangeness quantum number.", "gell-mann-murray", "Strange_quark", "Q216674"),
    ("Top Quark", "top-quark", "t", 1995, "Elementary quark with charge +2/3, third-generation and heaviest known fundamental particle at 173 GeV; decays before it can hadronize.", "cdf-collaboration", "Top_quark", "Q207571"),
    ("Bottom Quark", "bottom-quark", "b", 1977, "Elementary quark with charge −1/3, third-generation; also called the beauty quark.", "lederman-leon", "Bottom_quark", "Q207680"),
]
for name, slug, sym, year, narr, disc_who, wp, wd in QUARKS:
    SCIENCES.append(P(
        name, slug, "particle", "quantum", narr,
        extras=[f"{sym} quark", sym, f"{name.split()[0].lower()} flavor"],
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        applies=[":subatomic"], subsumed_by="quark",
        related=[("quark", 1.0), ("standard-model", 0.9)],
        wp=wp, wd=wd,
    ))

LEPTONS = [
    ("Electron", "electron", "e⁻", 1897, "The lightest charged lepton, charge −1; the electron cloud around atomic nuclei determines chemistry.", "thomson-jj", "Electron", "Q2225"),
    ("Muon", "muon", "μ⁻", 1936, "A heavier cousin of the electron, ~207× more massive, second-generation lepton; decays in about 2.2 microseconds.", "anderson-carl", "Muon", "Q102895"),
    ("Tau", "tau-lepton", "τ⁻", 1975, "The heaviest charged lepton, third-generation, ~3477× the electron's mass; decays rapidly to hadrons or lighter leptons.", "perl-martin", "Tau_(particle)", "Q102371"),
    ("Electron Neutrino", "electron-neutrino", "νₑ", 1956, "The nearly-massless neutral lepton emitted in beta decay along with an electron.", "cowan-clyde", "Electron_neutrino", "Q2126"),
    ("Muon Neutrino", "muon-neutrino", "νμ", 1962, "The neutral lepton associated with the muon; discovered at Brookhaven.", "lederman-leon", "Muon_neutrino", "Q131643"),
    ("Tau Neutrino", "tau-neutrino", "ντ", 2000, "The neutral lepton associated with the tau; directly observed by the DONUT experiment at Fermilab.", None, "Tau_neutrino", "Q102462"),
]
for name, slug, sym, year, narr, disc_who, wp, wd in LEPTONS:
    SCIENCES.append(P(
        name, slug, "particle", "quantum", narr,
        extras=[sym, f"{name.lower()}", f"{name.split()[0].lower()}"],
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        applies=[":subatomic"], subsumed_by="lepton",
        related=[("lepton", 1.0), ("standard-model", 0.9)],
        wp=wp, wd=wd,
    ))

# --- Gauge bosons + Higgs
BOSONS = [
    ("Photon", "photon", "γ", 1905, "The gauge boson of electromagnetism — massless, chargeless, spin-1; every ray of light is a stream of photons.", "einstein-albert", "Photon", "Q3198"),
    ("W Boson", "w-boson", "W±", 1983, "One of two carriers of the weak nuclear force; charged, massive (~80 GeV).", "rubbia-carlo", "W_boson", "Q79972"),
    ("Z Boson", "z-boson", "Z⁰", 1983, "Neutral carrier of the weak force, mass ~91 GeV; mediates weak interactions that don't change particle identity.", "rubbia-carlo", "Z_boson", "Q189946"),
    ("Gluon", "gluon", "g", 1978, "Massless carrier of the strong force between quarks — comes in eight color-charge combinations.", None, "Gluon", "Q102908"),
    ("Higgs Boson", "higgs-boson", "H⁰", 2012, "The excitation of the Higgs field whose interaction gives mass to other elementary particles; discovered at CERN's LHC.", "higgs-peter", "Higgs_boson", "Q42395"),
    ("Graviton", "graviton", "G", None, "Hypothetical massless spin-2 boson that would mediate gravity in a quantum theory of gravity — not yet observed.", None, "Graviton", "Q207787"),
]
for name, slug, sym, year, narr, disc_who, wp, wd in BOSONS:
    status = ":not-yet-observed" if slug == "graviton" else None
    SCIENCES.append(P(
        name, slug, "particle", "quantum", narr,
        extras=[sym, f"{name.lower()}"],
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        applies=[":subatomic"], subsumed_by="gauge-boson",
        related=[("standard-model", 0.9)],
        status=status,
        wp=wp, wd=wd,
    ))

# --- Composite particles
COMPOSITES = [
    ("Proton", "proton", "p⁺", 1919, "Positively-charged baryon made of two up quarks and one down quark; determines the identity of a chemical element.", "rutherford-ernest", "Proton", "Q2294"),
    ("Neutron", "neutron", "n⁰", 1932, "Neutral baryon made of one up quark and two down quarks; free neutrons decay in ~15 minutes.", "chadwick-james", "Neutron", "Q2348"),
    ("Alpha Particle", "alpha-particle", "α", 1899, "Helium-4 nucleus (2 protons + 2 neutrons); emitted in alpha decay of heavy nuclei.", "rutherford-ernest", "Alpha_particle", "Q210383"),
    ("Beta Particle", "beta-particle", "β", 1899, "Energetic electron (β⁻) or positron (β⁺) emitted from a nucleus during beta decay.", "rutherford-ernest", "Beta_particle", "Q1176187"),
    ("Deuteron", "deuteron", "²H⁺", 1931, "Nucleus of deuterium (heavy hydrogen), composed of one proton and one neutron.", "urey-harold", "Deuterium", "Q193559"),
    ("Pion", "pion", "π", 1947, "Lightest meson (quark-antiquark pair); mediator of the residual nuclear force between nucleons.", "powell-cecil", "Pion", "Q210447"),
    ("Kaon", "kaon", "K", 1947, "Meson containing a strange quark, provided early hints of CP violation.", None, "Kaon", "Q184356"),
    ("J/psi Meson", "j-psi-meson", "J/ψ", 1974, "Charmonium meson (charm–anticharm) whose 1974 discovery — the November Revolution — confirmed the charm quark.", "richter-burton", "J/psi_meson", "Q1113049"),
    ("Positron", "positron", "e⁺", 1932, "Antiparticle of the electron — same mass, opposite charge; first-discovered antimatter particle.", "anderson-carl", "Positron", "Q3229"),
    ("Antiproton", "antiproton", "p̄", 1955, "Antiparticle of the proton; first produced at the Bevatron.", "segre-emilio", "Antiproton", "Q207312"),
    ("Antineutron", "antineutron", "n̄", 1956, "Antiparticle of the neutron, produced at Berkeley the year after the antiproton.", None, "Antineutron", "Q207376"),
]
for name, slug, sym, year, narr, disc_who, wp, wd in COMPOSITES:
    parent = "baryon" if slug in ("proton", "neutron", "antiproton", "antineutron", "deuteron") else ("meson" if slug in ("pion", "kaon", "j-psi-meson") else "particle")
    SCIENCES.append(P(
        name, slug, "particle", "quantum", narr,
        extras=[sym, f"{name.lower()}"],
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        applies=[":subatomic"], subsumed_by=parent,
        related=[("standard-model", 0.7)],
        wp=wp, wd=wd,
    ))

# --- Particle CATEGORIES as taxonomic parents
CATEGORIES = [
    ("Quark", "quark", "physics", "Elementary constituent of matter, comes in six flavors (up, down, strange, charm, bottom, top); never observed in isolation due to confinement.",
     [("standard-model", 0.9)], "Quark", "Q6108"),
    ("Lepton", "lepton", "physics", "Elementary particle that does not participate in the strong interaction — electrons, muons, taus, and their neutrinos.",
     [("standard-model", 0.9)], "Lepton", "Q11414"),
    ("Boson", "boson", "physics", "Particle with integer spin; obeys Bose–Einstein statistics; includes force carriers and composite particles like helium-4.",
     [("standard-model", 0.7)], "Boson", "Q43101"),
    ("Fermion", "fermion", "physics", "Particle with half-integer spin; obeys Fermi–Dirac statistics and the Pauli exclusion principle; includes quarks and leptons.",
     [("standard-model", 0.9)], "Fermion", "Q43106"),
    ("Gauge Boson", "gauge-boson", "physics", "Bosons that mediate the fundamental forces of the Standard Model — photon, W, Z, gluon.",
     [("boson", 1.0)], "Gauge_boson", "Q210646"),
    ("Baryon", "baryon", "physics", "Composite particle made of three quarks — protons and neutrons are the familiar examples.",
     [("hadron", 1.0)], "Baryon", "Q109148"),
    ("Meson", "meson", "physics", "Composite particle made of a quark and an antiquark — pions, kaons, and heavier states.",
     [("hadron", 1.0)], "Meson", "Q102074"),
    ("Hadron", "hadron", "physics", "Composite particle made of quarks bound by the strong force — includes baryons and mesons.",
     [("quark", 0.9)], "Hadron", "Q45152"),
    ("Antiparticle", "antiparticle", "physics", "The counterpart of a particle with the same mass but opposite charge and quantum numbers; annihilates its partner on contact.",
     [], "Antiparticle", "Q192442"),
    ("Antimatter", "antimatter", "physics", "Matter composed of antiparticles; rare in the observable universe but produced routinely in accelerators.",
     [("antiparticle", 1.0)], "Antimatter", "Q3395"),
    ("Neutrino", "neutrino", "physics", "Family of nearly-massless, chargeless leptons that interact only via the weak force and gravity; three flavors that oscillate into each other.",
     [("lepton", 1.0)], "Neutrino", "Q2126"),
    ("Standard Model", "standard-model", "physics", "The prevailing theory of particle physics that classifies all known elementary particles and describes three of the four fundamental forces (all but gravity).",
     [("quantum-field-theory", 0.9)], "Standard_Model", "Q11417"),
]
for name, slug, disc, narr, rel, wp, wd in CATEGORIES:
    SCIENCES.append(P(
        name, slug, "classification", disc, narr,
        extras=[f"{name.lower()}", name.upper() if len(name) < 6 else None],
        applies=[":subatomic"], subsumed_by="particle-physics",
        related=rel,
        wp=wp, wd=wd,
    ))

# --- Atomic structure & quantum concepts
QUANTUM = [
    ("Atom", "atom", "chemistry", "The smallest unit of matter that retains a chemical element's identity — a nucleus of protons and neutrons surrounded by an electron cloud.",
     "The smallest identifiable piece of gold is a single gold atom.", ":materials", ":everyday", "Atom", "Q9121", None, None),
    ("Atomic Nucleus", "atomic-nucleus", "physics", "The dense positively-charged core of an atom, made of protons and neutrons; contains nearly all the atom's mass in ~1/100,000 of its volume.",
     None, ":subatomic", None, "Atomic_nucleus", "Q37147", "rutherford-ernest", 1911),
    ("Electron Shell", "electron-shell", "chemistry", "A group of atomic orbitals with the same principal quantum number, holding electrons at similar energy levels.",
     None, ":materials", None, "Electron_shell", "Q214346", "bohr-niels", 1913),
    ("Atomic Orbital", "atomic-orbital", "chemistry", "A mathematical function describing the probability distribution of an electron in an atom; comes in s, p, d, f shapes.",
     None, ":materials", None, "Atomic_orbital", "Q207131", "schrodinger-erwin", 1926),
    ("Isotope", "isotope", "chemistry", "Variants of a chemical element sharing atomic number but differing in neutron count — carbon-12 and carbon-14 are isotopes of carbon.",
     "Radiocarbon dating uses the decay of carbon-14 to date organic remains up to ~50,000 years old.", ":materials", None, "Isotope", "Q25276", "soddy-frederick", 1913),
    ("Radioactivity", "radioactivity", "physics", "The spontaneous emission of particles or energy from unstable atomic nuclei as they transform to more stable configurations.",
     "A smoke detector uses a tiny sample of americium-241 whose alpha emission ionizes air.", ":materials", None, "Radioactive_decay", "Q11448", "becquerel-henri", 1896),
    ("Alpha Decay", "alpha-decay", "physics", "Radioactive decay in which a heavy nucleus emits an alpha particle (helium-4 nucleus), decreasing atomic number by 2 and mass number by 4.",
     None, ":subatomic", None, "Alpha_decay", "Q193286", "rutherford-ernest", 1899),
    ("Beta Decay", "beta-decay", "physics", "Radioactive decay in which a neutron converts to a proton (β⁻) or a proton to a neutron (β⁺), emitting an electron or positron plus a neutrino.",
     None, ":subatomic", None, "Beta_decay", "Q19960", "fermi-enrico", 1933),
    ("Gamma Decay", "gamma-decay", "physics", "Emission of a high-energy photon from an excited atomic nucleus dropping to a lower-energy state.",
     None, ":subatomic", None, "Gamma_ray", "Q12907", None, 1900),
    ("Nuclear Fission", "nuclear-fission", "physics", "The splitting of a heavy atomic nucleus into two lighter nuclei plus neutrons and energy; the basis of reactors and atomic weapons.",
     None, ":high-energy", None, "Nuclear_fission", "Q6607", "hahn-otto", 1938),
    ("Nuclear Fusion", "nuclear-fusion", "physics", "The joining of light atomic nuclei to form a heavier nucleus, releasing enormous energy — powers stars and hydrogen bombs.",
     "The Sun fuses about 600 million tons of hydrogen per second in its core.", ":astrophysical", ":high-energy", "Nuclear_fusion", "Q13082", "bethe-hans", 1939),
    ("Chain Reaction", "chain-reaction", "physics", "A self-sustaining sequence of reactions where each event triggers additional events — as in nuclear fission where neutrons from one split induce further splits.",
     None, ":high-energy", None, "Chain_reaction", "Q127602", "szilard-leo", 1933),
    ("Half-Life", "half-life", "physics", "The time required for half the atoms in a radioactive sample to decay — a constant characteristic of each isotope.",
     "Carbon-14 has a half-life of about 5,730 years, enabling radiocarbon dating.", ":materials", None, "Half-life", "Q131502", "rutherford-ernest", 1907),
    ("Ionization", "ionization", "chemistry", "The process by which an atom or molecule gains or loses electrons to become an ion.",
     None, ":materials", ":everyday", "Ionization", "Q210824", None, None),
    ("Chemical Bond", "chemical-bond", "chemistry", "A lasting attraction between atoms or ions that enables the formation of chemical compounds — covalent, ionic, metallic, hydrogen.",
     None, ":materials", ":everyday", "Chemical_bond", "Q44424", None, None),
    ("Covalent Bond", "covalent-bond", "chemistry", "A chemical bond formed by the sharing of electron pairs between atoms.",
     "Water's H–O–H is held together by covalent bonds.", ":materials", ":everyday", "Covalent_bond", "Q188388", "lewis-gilbert-n", 1916),
    ("Ionic Bond", "ionic-bond", "chemistry", "A chemical bond formed by the electrostatic attraction between oppositely-charged ions.",
     "Table salt (NaCl) is held together by ionic bonds.", ":materials", ":everyday", "Ionic_bond", "Q186290", "kossel-walther", 1916),
    ("Metallic Bond", "metallic-bond", "chemistry", "A bond in metals arising from the electrostatic attraction between metal cations and a delocalized 'sea' of electrons.",
     None, ":materials", ":everyday", "Metallic_bonding", "Q211412", None, None),
    ("Hydrogen Bond", "hydrogen-bond", "chemistry", "A weak attraction between a hydrogen atom bonded to a highly electronegative atom and another electronegative atom; responsible for water's unusual properties and DNA's base pairing.",
     None, ":materials", ":biological", "Hydrogen_bond", "Q209126", "latimer-wendell", 1920),
    ("Van der Waals Force", "van-der-waals-force", "chemistry", "A weak, short-range attraction between molecules arising from induced or permanent dipoles.",
     None, ":materials", None, "Van_der_Waals_force", "Q214946", "van-der-waals-johannes", 1873),
]
for row in QUANTUM:
    name, slug, disc, narr = row[:4]
    everyday = row[4]
    applies = [a for a in row[5:7] if a]
    wp, wd = row[7:9]
    disc_who = row[9] if len(row) > 9 else None
    year = row[10] if len(row) > 10 else None
    SCIENCES.append(P(
        name, slug, "phenomenon" if slug not in ("atom", "atomic-nucleus", "electron-shell", "atomic-orbital", "isotope") else "structure",
        disc, narr, everyday=everyday, applies=applies,
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        subsumed_by=("quantum" if disc == "physics" else "chemistry"),
        wp=wp, wd=wd,
    ))

# --- Quantum mechanics concepts
QM = [
    ("Quantum Mechanics", "quantum-mechanics", "principle", "quantum",
     "The physical theory describing nature at the smallest scales — energy comes in discrete quanta, particles have wave properties, and measurement collapses probability distributions.",
     "Every LED, laser, and MRI machine works because of quantum mechanics.",
     ":subatomic", "Quantum_mechanics", "Q42989", "schrodinger-erwin", 1925),
    ("Wave-Particle Duality", "wave-particle-duality", "principle", "quantum",
     "The concept that every quantum entity exhibits both wave-like and particle-like properties depending on how it is observed.",
     "A single electron passed through a double slit interferes with itself, forming a wave pattern.",
     ":subatomic", "Wave%E2%80%93particle_duality", "Q319226", "de-broglie-louis", 1924),
    ("Heisenberg Uncertainty Principle", "heisenberg-uncertainty-principle", "principle", "quantum",
     "A fundamental limit: the more precisely a particle's position is known, the less precisely its momentum can be known, and vice versa. Δx·Δp ≥ ℏ/2.",
     None, ":subatomic", "Uncertainty_principle", "Q123190", "heisenberg-werner", 1927),
    ("Schrödinger Equation", "schrodinger-equation", "equation", "quantum",
     "The fundamental equation of quantum mechanics — describes how a quantum system's wave function evolves in time.",
     None, ":subatomic", "Schr%C3%B6dinger_equation", "Q165498", "schrodinger-erwin", 1926),
    ("Quantum Superposition", "quantum-superposition", "principle", "quantum",
     "A quantum system can exist in multiple states simultaneously until measured, when it collapses to a definite outcome.",
     "Schrödinger's cat thought experiment illustrates superposition scaled up to a macroscopic object.",
     ":subatomic", "Quantum_superposition", "Q245832", None, None),
    ("Quantum Entanglement", "quantum-entanglement", "phenomenon", "quantum",
     "Two or more particles can be linked so that measurement of one instantly determines the state of the others, regardless of separation.",
     "Underlies quantum cryptography and the Bell inequality tests.",
     ":subatomic", "Quantum_entanglement", "Q222738", "einstein-albert", 1935),
    ("Bell's Theorem", "bells-theorem", "theorem", "quantum",
     "No physical theory of local hidden variables can reproduce all quantum-mechanical predictions — proven by later experiments.",
     None, ":subatomic", "Bell%27s_theorem", "Q216603", "bell-john", 1964),
    ("Pauli Exclusion Principle", "pauli-exclusion-principle", "principle", "quantum",
     "No two identical fermions can occupy the same quantum state simultaneously — explains the periodic table and electron shell structure.",
     None, ":subatomic", "Pauli_exclusion_principle", "Q131594", "pauli-wolfgang", 1925),
    ("Quantum Tunneling", "quantum-tunneling", "phenomenon", "quantum",
     "A particle can pass through an energy barrier it classically shouldn't be able to cross — the basis of alpha decay and STM microscopes.",
     "Nuclear fusion in the Sun happens partly by protons tunneling through their electric repulsion.",
     ":subatomic", "Quantum_tunnelling", "Q192767", "gamow-george", 1928),
    ("Zero-Point Energy", "zero-point-energy", "phenomenon", "quantum",
     "The lowest possible energy of a quantum system, still nonzero because of the uncertainty principle.",
     None, ":subatomic", "Zero-point_energy", "Q216033", None, 1913),
    ("Casimir Effect", "casimir-effect", "phenomenon", "quantum",
     "A small attractive force between two uncharged conducting plates in a vacuum, caused by quantum fluctuations of the electromagnetic field.",
     None, ":subatomic", "Casimir_effect", "Q207089", "casimir-hendrik", 1948),
    ("Quantum Field Theory", "quantum-field-theory", "framework", "quantum",
     "The theoretical framework combining quantum mechanics with special relativity, treating particles as excitations of underlying fields.",
     None, ":subatomic", "Quantum_field_theory", "Q26907", "dirac-paul", 1927),
    ("Quantum Electrodynamics", "quantum-electrodynamics", "framework", "quantum",
     "Quantum field theory of the electromagnetic force; the most precisely-tested theory in physics.",
     None, ":subatomic", "Quantum_electrodynamics", "Q125264", "feynman-richard", 1948),
    ("Quantum Chromodynamics", "quantum-chromodynamics", "framework", "quantum",
     "Quantum field theory of the strong interaction between quarks and gluons.",
     None, ":subatomic", "Quantum_chromodynamics", "Q127330", "gell-mann-murray", 1973),
    ("Renormalization", "renormalization", "method", "quantum",
     "The mathematical procedure for making sense of infinities that appear in quantum field theory calculations by absorbing them into redefined parameters.",
     None, ":subatomic", ":theoretical-only", "Renormalization", "Q209353", "feynman-richard", 1948),
    ("Feynman Diagram", "feynman-diagram", "method", "quantum",
     "Pictorial representation of particle interactions in quantum field theory, invented by Feynman as a bookkeeping tool for perturbation calculations.",
     None, ":subatomic", "Feynman_diagram", "Q207174", "feynman-richard", 1948),
    ("Copenhagen Interpretation", "copenhagen-interpretation", "framework", "quantum",
     "The historically dominant interpretation of quantum mechanics — the wave function represents knowledge and collapses on measurement.",
     None, ":subatomic", "Copenhagen_interpretation", "Q160281", "bohr-niels", 1927),
    ("Many-Worlds Interpretation", "many-worlds-interpretation", "framework", "quantum",
     "Interpretation of quantum mechanics in which every possible outcome of a measurement is realized in a distinct branch of the universe.",
     None, ":subatomic", "Many-worlds_interpretation", "Q83232", "everett-hugh", 1957),
    ("Planck Length", "planck-length", "quantity", "quantum",
     "The smallest meaningful length scale in physics, ~1.616×10⁻³⁵ meters, where quantum gravity effects are expected to dominate.",
     None, ":subatomic", ":theoretical-only", "Planck_length", "Q194292", "planck-max", 1899),
    ("Planck Time", "planck-time", "quantity", "quantum",
     "The time it takes light to travel one Planck length, ~5.39×10⁻⁴⁴ seconds — the shortest meaningful time scale.",
     None, ":subatomic", ":theoretical-only", "Planck_time", "Q285492", "planck-max", 1899),
]
for row in QM:
    name, slug, kind, disc, narr = row[:5]
    everyday = row[5]
    applies = [x for x in row[6:8] if x]
    wp, wd = row[8:10]
    disc_who = row[10] if len(row) > 10 else None
    year = row[11] if len(row) > 11 else None
    SCIENCES.append(P(
        name, slug, kind, disc, narr, everyday=everyday, applies=applies,
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year, subsumed_by="quantum",
        wp=wp, wd=wd,
    ))

# --- Physical constants
CONSTANTS = [
    ("Speed of Light", "speed-of-light", "c", "299 792 458 m/s (exact)", "The invariant speed of light in vacuum — the universal speed limit of causality.", "michelson-albert", 1879, "Speed_of_light", "Q2111"),
    ("Planck Constant", "planck-constant", "h", "6.62607015×10⁻³⁴ J·s (exact)", "The quantum of action — relates a photon's energy to its frequency (E = h·ν).", "planck-max", 1900, "Planck_constant", "Q122266"),
    ("Reduced Planck Constant", "reduced-planck-constant", "ℏ", "1.054571817×10⁻³⁴ J·s", "Planck's constant divided by 2π — appears throughout quantum mechanics.", "dirac-paul", 1930, "Planck_constant", "Q122266"),
    ("Gravitational Constant", "gravitational-constant", "G", "6.674×10⁻¹¹ N·m²/kg²", "The coupling constant of gravity in Newton's law and general relativity.", "cavendish-henry", 1798, "Gravitational_constant", "Q13394"),
    ("Boltzmann Constant", "boltzmann-constant", "k_B", "1.380649×10⁻²³ J/K (exact)", "Relates temperature to average kinetic energy at the molecular scale.", "boltzmann-ludwig", 1877, "Boltzmann_constant", "Q102773"),
    ("Avogadro Constant", "avogadro-constant", "N_A", "6.02214076×10²³ mol⁻¹ (exact)", "The number of constituent particles in one mole of substance.", "loschmidt-johann", 1865, "Avogadro_constant", "Q483677"),
    ("Elementary Charge", "elementary-charge", "e", "1.602176634×10⁻¹⁹ C (exact)", "The electric charge of a single proton — the smallest observed free charge in nature.", "millikan-robert", 1909, "Elementary_charge", "Q80629"),
    ("Electron Mass", "electron-mass", "m_e", "9.1093837015×10⁻³¹ kg", "The rest mass of an electron.", "thomson-jj", 1897, "Electron_mass", "Q107416"),
    ("Proton Mass", "proton-mass", "m_p", "1.67262192369×10⁻²⁷ kg", "The rest mass of a proton — about 1836 times the electron mass.", None, None, "Proton_mass", "Q1811070"),
    ("Fine Structure Constant", "fine-structure-constant", "α", "≈ 1/137.036 (dimensionless)", "The coupling strength of the electromagnetic interaction — appears throughout QED.", "sommerfeld-arnold", 1916, "Fine-structure_constant", "Q127469"),
    ("Stefan-Boltzmann Constant", "stefan-boltzmann-constant", "σ", "5.670374419×10⁻⁸ W/m²/K⁴", "Relates the total power radiated by a black body to the fourth power of its temperature.", "stefan-josef", 1879, "Stefan%E2%80%93Boltzmann_constant", "Q193831"),
    ("Rydberg Constant", "rydberg-constant", "R", "1.0973731568160×10⁷ m⁻¹", "Sets the wavelengths of hydrogen's spectral lines.", "rydberg-johannes", 1888, "Rydberg_constant", "Q192173"),
    ("Vacuum Permittivity", "vacuum-permittivity", "ε₀", "8.8541878128×10⁻¹² F/m", "Constant that sets the strength of the electric field around a charge in vacuum.", None, None, "Vacuum_permittivity", "Q835847"),
    ("Vacuum Permeability", "vacuum-permeability", "μ₀", "1.25663706212×10⁻⁶ N/A²", "Constant that sets the strength of the magnetic field around a current in vacuum.", None, None, "Vacuum_permeability", "Q835816"),
    ("Faraday Constant", "faraday-constant", "F", "96 485.332 C/mol", "The electric charge per mole of electrons — links electrochemistry to atomic charge.", "faraday-michael", 1834, "Faraday_constant", "Q182880"),
    ("Gas Constant", "gas-constant", "R", "8.314462618 J/(mol·K)", "Universal constant relating the state variables of an ideal gas: PV = nRT.", None, 1834, "Gas_constant", "Q106433"),
    ("Hubble Constant", "hubble-constant", "H₀", "≈ 67-73 km/s/Mpc", "The current expansion rate of the universe — precise value is actively debated.", "hubble-edwin", 1929, "Hubble%27s_law", "Q179916"),
]
for name, slug, sym, val, narr, disc_who, year, wp, wd in CONSTANTS:
    SCIENCES.append(S(
        name, "physics", "constant",
        id_slug=slug,
        extras=[sym, f"{name.lower()}", f"physical constant {sym}"],
        described_by=[f"person-{disc_who}"] if disc_who else None,
        described_year=year,
        applies=[":subatomic", ":cosmology"] if slug == "hubble-constant" else [":everyday", ":materials"],
        narrative=narr,
        constant=val,
        subsumed_by="physical-constants",
        provenance=WD(wd, wp),
    ))

SCIENCES.append(S(
    "Physical Constants", "physics", "classification",
    id_slug="physical-constants",
    narrative="Numerical quantities that appear the same everywhere and everywhen — the dimensionless ratios that make our universe work.",
    subsumed_by="physics",
    subsumes=[f"{c[1]}" for c in CONSTANTS],
    provenance=W("Physical_constant"),
))

SCIENCES.append(S(
    "Particle Physics", "physics", "classification",
    id_slug="particle-physics",
    narrative="The branch of physics that studies elementary constituents of matter and radiation and their interactions.",
    subsumed_by="physics",
    subsumes=["quark", "lepton", "boson", "fermion", "hadron", "baryon", "meson", "standard-model", "neutrino"],
    provenance=W("Particle_physics"),
))
