"""All 118 chemical elements from the periodic table (IUPAC 2016).

Each element is a science-node with :atomic-number, :atomic-symbol, and
canonical name. Discoveries/discoverers are cited from Wikipedia.
"""

from _helpers import S, PERSON

# Format: (Z, symbol, name, discoverer-slug-or-None, year-or-None, translations-dict)
# Verified against IUPAC + Wikipedia. Translations: ja + zh for the notable ones.
ELEMENTS = [
    (1,   "H",  "Hydrogen",      "cavendish-henry",         1766, {"ja": "水素", "zh": "氢"}),
    (2,   "He", "Helium",        "janssen-jules",           1868, {"ja": "ヘリウム", "zh": "氦"}),
    (3,   "Li", "Lithium",       "arfvedson-johan-august",  1817, {"ja": "リチウム", "zh": "锂"}),
    (4,   "Be", "Beryllium",     "vauquelin-louis-nicolas", 1798, {"ja": "ベリリウム", "zh": "铍"}),
    (5,   "B",  "Boron",         "davy-humphry",            1808, {"ja": "ホウ素", "zh": "硼"}),
    (6,   "C",  "Carbon",        None,                      None, {"ja": "炭素", "zh": "碳"}),
    (7,   "N",  "Nitrogen",      "rutherford-daniel",       1772, {"ja": "窒素", "zh": "氮"}),
    (8,   "O",  "Oxygen",        "priestley-joseph",        1774, {"ja": "酸素", "zh": "氧"}),
    (9,   "F",  "Fluorine",      "moissan-henri",           1886, {"ja": "フッ素", "zh": "氟"}),
    (10,  "Ne", "Neon",          "ramsay-william",          1898, {"ja": "ネオン", "zh": "氖"}),
    (11,  "Na", "Sodium",        "davy-humphry",            1807, {"ja": "ナトリウム", "zh": "钠"}),
    (12,  "Mg", "Magnesium",     "davy-humphry",            1808, {"ja": "マグネシウム", "zh": "镁"}),
    (13,  "Al", "Aluminum",      "oersted-hans-christian",  1825, {"ja": "アルミニウム", "zh": "铝"}),
    (14,  "Si", "Silicon",       "berzelius-jons-jacob",    1823, {"ja": "ケイ素", "zh": "硅"}),
    (15,  "P",  "Phosphorus",    "brand-hennig",            1669, {"ja": "リン", "zh": "磷"}),
    (16,  "S",  "Sulfur",        None,                      None, {"ja": "硫黄", "zh": "硫"}),
    (17,  "Cl", "Chlorine",      "scheele-carl-wilhelm",    1774, {"ja": "塩素", "zh": "氯"}),
    (18,  "Ar", "Argon",         "rayleigh-lord",           1894, {"ja": "アルゴン", "zh": "氩"}),
    (19,  "K",  "Potassium",     "davy-humphry",            1807, {"ja": "カリウム", "zh": "钾"}),
    (20,  "Ca", "Calcium",       "davy-humphry",            1808, {"ja": "カルシウム", "zh": "钙"}),
    (21,  "Sc", "Scandium",      "nilson-lars-fredrik",     1879, {"ja": "スカンジウム", "zh": "钪"}),
    (22,  "Ti", "Titanium",      "gregor-william",          1791, {"ja": "チタン", "zh": "钛"}),
    (23,  "V",  "Vanadium",      "del-rio-andres-manuel",   1801, {"ja": "バナジウム", "zh": "钒"}),
    (24,  "Cr", "Chromium",      "vauquelin-louis-nicolas", 1797, {"ja": "クロム", "zh": "铬"}),
    (25,  "Mn", "Manganese",     "gahn-johan-gottlieb",     1774, {"ja": "マンガン", "zh": "锰"}),
    (26,  "Fe", "Iron",          None,                      None, {"ja": "鉄", "zh": "铁"}),
    (27,  "Co", "Cobalt",        "brandt-georg",            1735, {"ja": "コバルト", "zh": "钴"}),
    (28,  "Ni", "Nickel",        "cronstedt-axel",          1751, {"ja": "ニッケル", "zh": "镍"}),
    (29,  "Cu", "Copper",        None,                      None, {"ja": "銅", "zh": "铜"}),
    (30,  "Zn", "Zinc",          "marggraf-andreas",        1746, {"ja": "亜鉛", "zh": "锌"}),
    (31,  "Ga", "Gallium",       "de-boisbaudran-lecoq",    1875, {"ja": "ガリウム", "zh": "镓"}),
    (32,  "Ge", "Germanium",     "winkler-clemens",         1886, {"ja": "ゲルマニウム", "zh": "锗"}),
    (33,  "As", "Arsenic",       None,                      1250, {"ja": "ヒ素", "zh": "砷"}),
    (34,  "Se", "Selenium",      "berzelius-jons-jacob",    1817, {"ja": "セレン", "zh": "硒"}),
    (35,  "Br", "Bromine",       "balard-antoine-jerome",   1826, {"ja": "臭素", "zh": "溴"}),
    (36,  "Kr", "Krypton",       "ramsay-william",          1898, {"ja": "クリプトン", "zh": "氪"}),
    (37,  "Rb", "Rubidium",      "bunsen-robert",           1861, {"ja": "ルビジウム", "zh": "铷"}),
    (38,  "Sr", "Strontium",     "crawford-adair",          1790, {"ja": "ストロンチウム", "zh": "锶"}),
    (39,  "Y",  "Yttrium",       "gadolin-johan",           1794, {"ja": "イットリウム", "zh": "钇"}),
    (40,  "Zr", "Zirconium",     "klaproth-martin",         1789, {"ja": "ジルコニウム", "zh": "锆"}),
    (41,  "Nb", "Niobium",       "hatchett-charles",        1801, {"ja": "ニオブ", "zh": "铌"}),
    (42,  "Mo", "Molybdenum",    "hjelm-peter-jacob",       1781, {"ja": "モリブデン", "zh": "钼"}),
    (43,  "Tc", "Technetium",    "perrier-carlo",           1937, {"ja": "テクネチウム", "zh": "锝"}),
    (44,  "Ru", "Ruthenium",     "klaus-karl-ernst",        1844, {"ja": "ルテニウム", "zh": "钌"}),
    (45,  "Rh", "Rhodium",       "wollaston-william-hyde",  1803, {"ja": "ロジウム", "zh": "铑"}),
    (46,  "Pd", "Palladium",     "wollaston-william-hyde",  1803, {"ja": "パラジウム", "zh": "钯"}),
    (47,  "Ag", "Silver",        None,                      None, {"ja": "銀", "zh": "银"}),
    (48,  "Cd", "Cadmium",       "stromeyer-friedrich",     1817, {"ja": "カドミウム", "zh": "镉"}),
    (49,  "In", "Indium",        "reich-ferdinand",         1863, {"ja": "インジウム", "zh": "铟"}),
    (50,  "Sn", "Tin",           None,                      None, {"ja": "スズ", "zh": "锡"}),
    (51,  "Sb", "Antimony",      None,                      None, {"ja": "アンチモン", "zh": "锑"}),
    (52,  "Te", "Tellurium",     "muller-franz",            1782, {"ja": "テルル", "zh": "碲"}),
    (53,  "I",  "Iodine",        "courtois-bernard",        1811, {"ja": "ヨウ素", "zh": "碘"}),
    (54,  "Xe", "Xenon",         "ramsay-william",          1898, {"ja": "キセノン", "zh": "氙"}),
    (55,  "Cs", "Cesium",        "bunsen-robert",           1860, {"ja": "セシウム", "zh": "铯"}),
    (56,  "Ba", "Barium",        "davy-humphry",            1808, {"ja": "バリウム", "zh": "钡"}),
    (57,  "La", "Lanthanum",     "mosander-carl-gustav",    1839, {"ja": "ランタン", "zh": "镧"}),
    (58,  "Ce", "Cerium",        "berzelius-jons-jacob",    1803, {"ja": "セリウム", "zh": "铈"}),
    (59,  "Pr", "Praseodymium",  "auer-carl",               1885, {"ja": "プラセオジム", "zh": "镨"}),
    (60,  "Nd", "Neodymium",     "auer-carl",               1885, {"ja": "ネオジム", "zh": "钕"}),
    (61,  "Pm", "Promethium",    "marinsky-jacob",          1945, {"ja": "プロメチウム", "zh": "钷"}),
    (62,  "Sm", "Samarium",      "de-boisbaudran-lecoq",    1879, {"ja": "サマリウム", "zh": "钐"}),
    (63,  "Eu", "Europium",      "demarcay-eugene",         1901, {"ja": "ユウロピウム", "zh": "铕"}),
    (64,  "Gd", "Gadolinium",    "de-marignac-jean",        1880, {"ja": "ガドリニウム", "zh": "钆"}),
    (65,  "Tb", "Terbium",       "mosander-carl-gustav",    1843, {"ja": "テルビウム", "zh": "铽"}),
    (66,  "Dy", "Dysprosium",    "de-boisbaudran-lecoq",    1886, {"ja": "ジスプロシウム", "zh": "镝"}),
    (67,  "Ho", "Holmium",       "cleve-per-teodor",        1878, {"ja": "ホルミウム", "zh": "钬"}),
    (68,  "Er", "Erbium",        "mosander-carl-gustav",    1843, {"ja": "エルビウム", "zh": "铒"}),
    (69,  "Tm", "Thulium",       "cleve-per-teodor",        1879, {"ja": "ツリウム", "zh": "铥"}),
    (70,  "Yb", "Ytterbium",     "de-marignac-jean",        1878, {"ja": "イッテルビウム", "zh": "镱"}),
    (71,  "Lu", "Lutetium",      "urbain-georges",          1907, {"ja": "ルテチウム", "zh": "镥"}),
    (72,  "Hf", "Hafnium",       "coster-dirk",             1923, {"ja": "ハフニウム", "zh": "铪"}),
    (73,  "Ta", "Tantalum",      "ekeberg-anders-gustaf",   1802, {"ja": "タンタル", "zh": "钽"}),
    (74,  "W",  "Tungsten",      "d-elhuyar-fausto",        1783, {"ja": "タングステン", "zh": "钨"}),
    (75,  "Re", "Rhenium",       "noddack-walter",          1925, {"ja": "レニウム", "zh": "铼"}),
    (76,  "Os", "Osmium",        "tennant-smithson",        1803, {"ja": "オスミウム", "zh": "锇"}),
    (77,  "Ir", "Iridium",       "tennant-smithson",        1803, {"ja": "イリジウム", "zh": "铱"}),
    (78,  "Pt", "Platinum",      "ulloa-antonio",           1735, {"ja": "白金", "zh": "铂"}),
    (79,  "Au", "Gold",          None,                      None, {"ja": "金", "zh": "金"}),
    (80,  "Hg", "Mercury",       None,                      None, {"ja": "水銀", "zh": "汞"}),
    (81,  "Tl", "Thallium",      "crookes-william",         1861, {"ja": "タリウム", "zh": "铊"}),
    (82,  "Pb", "Lead",          None,                      None, {"ja": "鉛", "zh": "铅"}),
    (83,  "Bi", "Bismuth",       None,                      1500, {"ja": "ビスマス", "zh": "铋"}),
    (84,  "Po", "Polonium",      "curie-marie",             1898, {"ja": "ポロニウム", "zh": "钋"}),
    (85,  "At", "Astatine",      "corson-dale",             1940, {"ja": "アスタチン", "zh": "砹"}),
    (86,  "Rn", "Radon",         "dorn-friedrich-ernst",    1900, {"ja": "ラドン", "zh": "氡"}),
    (87,  "Fr", "Francium",      "perey-marguerite",        1939, {"ja": "フランシウム", "zh": "钫"}),
    (88,  "Ra", "Radium",        "curie-marie",             1898, {"ja": "ラジウム", "zh": "镭"}),
    (89,  "Ac", "Actinium",      "debierne-andre-louis",    1899, {"ja": "アクチニウム", "zh": "锕"}),
    (90,  "Th", "Thorium",       "berzelius-jons-jacob",    1828, {"ja": "トリウム", "zh": "钍"}),
    (91,  "Pa", "Protactinium",  "fajans-kazimierz",        1913, {"ja": "プロトアクチニウム", "zh": "镤"}),
    (92,  "U",  "Uranium",       "klaproth-martin",         1789, {"ja": "ウラン", "zh": "铀"}),
    (93,  "Np", "Neptunium",     "mcmillan-edwin",          1940, {"ja": "ネプツニウム", "zh": "镎"}),
    (94,  "Pu", "Plutonium",     "seaborg-glenn",           1940, {"ja": "プルトニウム", "zh": "钚"}),
    (95,  "Am", "Americium",     "seaborg-glenn",           1944, {"ja": "アメリシウム", "zh": "镅"}),
    (96,  "Cm", "Curium",        "seaborg-glenn",           1944, {"ja": "キュリウム", "zh": "锔"}),
    (97,  "Bk", "Berkelium",     "thompson-stanley",        1949, {"ja": "バークリウム", "zh": "锫"}),
    (98,  "Cf", "Californium",   "thompson-stanley",        1950, {"ja": "カリホルニウム", "zh": "锎"}),
    (99,  "Es", "Einsteinium",   "ghiorso-albert",          1952, {"ja": "アインスタイニウム", "zh": "锿"}),
    (100, "Fm", "Fermium",       "ghiorso-albert",          1952, {"ja": "フェルミウム", "zh": "镄"}),
    (101, "Md", "Mendelevium",   "ghiorso-albert",          1955, {"ja": "メンデレビウム", "zh": "钔"}),
    (102, "No", "Nobelium",      "flerov-georgy",           1966, {"ja": "ノーベリウム", "zh": "锘"}),
    (103, "Lr", "Lawrencium",    "ghiorso-albert",          1961, {"ja": "ローレンシウム", "zh": "铹"}),
    (104, "Rf", "Rutherfordium", "flerov-georgy",           1964, {"ja": "ラザホージウム", "zh": "𬬻"}),
    (105, "Db", "Dubnium",       "flerov-georgy",           1968, {"ja": "ドブニウム", "zh": "𬭊"}),
    (106, "Sg", "Seaborgium",    "ghiorso-albert",          1974, {"ja": "シーボーギウム", "zh": "𬭳"}),
    (107, "Bh", "Bohrium",       "munzenberg-gottfried",    1981, {"ja": "ボーリウム", "zh": "𬭛"}),
    (108, "Hs", "Hassium",       "munzenberg-gottfried",    1984, {"ja": "ハッシウム", "zh": "𬭶"}),
    (109, "Mt", "Meitnerium",    "munzenberg-gottfried",    1982, {"ja": "マイトネリウム", "zh": "鿏"}),
    (110, "Ds", "Darmstadtium",  "hofmann-sigurd",          1994, {"ja": "ダームスタチウム", "zh": "𬭳"}),
    (111, "Rg", "Roentgenium",   "hofmann-sigurd",          1994, {"ja": "レントゲニウム", "zh": "𫟼"}),
    (112, "Cn", "Copernicium",   "hofmann-sigurd",          1996, {"ja": "コペルニシウム", "zh": "鎶"}),
    (113, "Nh", "Nihonium",      "morita-kosuke",           2004, {"ja": "ニホニウム", "zh": "鉨"}),
    (114, "Fl", "Flerovium",     "oganessian-yuri",         1998, {"ja": "フレロビウム", "zh": "鈇"}),
    (115, "Mc", "Moscovium",     "oganessian-yuri",         2003, {"ja": "モスコビウム", "zh": "镆"}),
    (116, "Lv", "Livermorium",   "oganessian-yuri",         2000, {"ja": "リバモリウム", "zh": "𰚾"}),
    (117, "Ts", "Tennessine",    "oganessian-yuri",         2010, {"ja": "テネシン", "zh": "鿬"}),
    (118, "Og", "Oganesson",     "oganessian-yuri",         2002, {"ja": "オガネソン", "zh": "鿫"}),
]


# Group families for classification
GROUPS = {
    "alkali-metals":       {3, 11, 19, 37, 55, 87},
    "alkaline-earth-metals": {4, 12, 20, 38, 56, 88},
    "transition-metals":   set(range(21, 31)) | set(range(39, 49)) | set(range(72, 81))
                           | set(range(104, 113)),
    "post-transition-metals": {13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116},
    "metalloids":          {5, 14, 32, 33, 51, 52, 84, 85},
    "reactive-nonmetals":  {1, 6, 7, 8, 15, 16, 34},
    "halogens":            {9, 17, 35, 53, 85, 117},
    "noble-gases":         {2, 10, 18, 36, 54, 86, 118},
    "lanthanides":         set(range(57, 72)),
    "actinides":           set(range(89, 104)),
}


def group_for(z):
    for name, s in GROUPS.items():
        if z in s:
            return name
    return None


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


SCIENCES = []

for z, sym, name, discoverer, year, translations in ELEMENTS:
    group = group_for(z)
    related = []
    if group:
        related.append((group, 0.9))
    described = None
    if discoverer:
        described = [f"person-{discoverer}"]
    narrative = f"Chemical element with atomic number {z}, symbol {sym}."
    if group == "noble-gases":
        narrative += " A noble gas — chemically nearly inert."
    elif group == "alkali-metals":
        narrative += " An alkali metal — soft, reactive, single valence electron."
    elif group == "alkaline-earth-metals":
        narrative += " An alkaline earth metal — reactive, two valence electrons."
    elif group == "transition-metals":
        narrative += " A transition metal — variable valence, typically forms colored compounds."
    elif group == "halogens":
        narrative += " A halogen — highly reactive nonmetal, one electron short of a noble gas."
    elif group == "lanthanides":
        narrative += " A lanthanide (rare earth) — inner transition metal with a partially filled 4f shell."
    elif group == "actinides":
        narrative += " An actinide — inner transition metal with a partially filled 5f shell; most are radioactive."
    extras = [sym, sym.upper(), f"element {z}", f"atomic number {z}", f"{name.lower()}"]
    if name != name.capitalize():
        extras.append(name.capitalize())
    SCIENCES.append(S(
        name, "chemistry", "element",
        id_slug=f"element-{sym.lower()}-{name.lower()}",
        extras=extras,
        atomic_num=z, atomic_sym=sym,
        chem_formula=sym,
        translations=translations,
        described_by=described, described_year=year,
        applies=[":materials", ":everyday"] if group not in ("actinides", "lanthanides") else [":materials"],
        narrative=narrative,
        subsumed_by="periodic-table",
        related=related,
        status=":established" if z <= 118 else ":emerging",
        provenance=W(name),
    ))


# Element groups as taxonomic parent nodes
for group_name in ["alkali-metals", "alkaline-earth-metals", "transition-metals",
                   "post-transition-metals", "metalloids", "reactive-nonmetals",
                   "halogens", "noble-gases", "lanthanides", "actinides"]:
    label = group_name.replace("-", " ").title()
    members = sorted(GROUPS[group_name])
    child_slugs = []
    for z in members:
        for zz, sym, name, *_ in ELEMENTS:
            if zz == z:
                child_slugs.append(f"element-{sym.lower()}-{name.lower()}")
                break
    SCIENCES.append(S(
        label, "chemistry", "classification",
        id_slug=group_name,
        narrative=f"The {label.lower()} family of the periodic table.",
        subsumed_by="periodic-table",
        subsumes=child_slugs,
        provenance=W(label.replace(" ", "_")),
    ))


# Periodic Table itself
SCIENCES.append(S(
    "Periodic Table", "chemistry", "classification",
    id_slug="periodic-table",
    extras=["periodic table of elements", "Mendeleev's table"],
    described_by=[PERSON("mendeleev-dmitri")], described_year=1869,
    narrative="Tabular arrangement of the chemical elements, ordered by atomic number, electron configuration, and recurring chemical properties.",
    everyday="Every chemistry classroom has one on the wall.",
    applies=[":materials", ":everyday"],
    subsumed_by="chemistry",
    subsumes=["alkali-metals", "alkaline-earth-metals", "transition-metals",
              "post-transition-metals", "metalloids", "reactive-nonmetals",
              "halogens", "noble-gases", "lanthanides", "actinides"],
    provenance=W("Periodic_table"),
))
