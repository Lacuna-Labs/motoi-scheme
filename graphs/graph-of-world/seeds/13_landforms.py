"""Landforms — geological + geographical features. ~120-200 nodes."""

from _helpers import node, wikidata, authored


def lf(canonical, ftype, region=None, size="medium", syns=None,
       used=None, sensory=None, qid=None):
    return node(canonical, "landform",
                synonyms=syns or [],
                landform_type=ftype,
                region_native_to=[region] if region else None,
                size_scale=size, used_for=used,
                sensory_signatures=sensory,
                kid_friendly=True,
                provenance=[wikidata(qid)] if qid else [authored()])


NODES = []

# Mountain-related
NODES += [
    lf("mountain", "mountain", size="massive", syns=["peak", "summit", "mount"], qid="Q8502"),
    lf("hill", "hill", size="large", syns=["knoll", "hillock", "rise"], qid="Q54050"),
    lf("mesa", "plateau", size="large", syns=["tableland", "table-mountain"], qid="Q3861"),
    lf("plateau", "plateau", size="huge", syns=["tableland", "high-plain"], qid="Q75520"),
    lf("butte", "hill", size="large", syns=["isolated-hill", "flat-topped-hill"], qid="Q193459"),
    lf("ridge", "ridge", size="large", syns=["mountain-ridge", "crest", "spine"], qid="Q133056"),
    lf("saddle", "ridge", size="medium", syns=["mountain-pass", "col"], qid="Q193459"),
    lf("summit", "mountain", size="large", syns=["peak", "top", "apex"], qid="Q207326"),
    lf("foothill", "hill", size="large", syns=["foothills"], qid="Q193459"),
    lf("volcano", "volcano", size="massive", syns=["volcanic-mountain"], qid="Q8072"),
    lf("stratovolcano", "volcano", size="massive", syns=["composite-volcano"], qid="Q193459"),
    lf("shield-volcano", "volcano", size="massive", syns=["shield"], qid="Q193459"),
    lf("cinder-cone", "volcano", size="medium", syns=["scoria-cone"], qid="Q193459"),
    lf("caldera", "crater", size="huge", syns=["volcanic-caldera"], qid="Q193459"),
    lf("crater", "crater", size="large", syns=["impact-crater", "volcanic-crater"], qid="Q193459"),
    lf("cliff", "cliff", size="large", syns=["escarpment", "bluff", "scarp"], qid="Q107679"),
    lf("bluff", "cliff", size="large", syns=["headland", "promontory"], qid="Q193459"),
    lf("scree", "cliff", size="medium", syns=["talus"], qid="Q193459"),
    lf("overhang", "cliff", size="medium", syns=["ledge"], qid="Q193459"),
    lf("mount-everest", "mountain", region="himalaya", size="massive",
        syns=["chomolungma", "sagarmatha"], qid="Q513"),
    lf("k2", "mountain", region="karakoram", size="massive", syns=["chogori"], qid="Q193459"),
    lf("kilimanjaro", "mountain", region="tanzania", size="massive", syns=["kili"], qid="Q193459"),
    lf("mount-fuji", "volcano", region="japan", size="massive", syns=["fujisan", "fuji"], qid="Q193459"),
    lf("matterhorn", "mountain", region="alps", size="massive", syns=["cervino"], qid="Q193459"),
    lf("denali", "mountain", region="alaska", size="massive", syns=["mount-mckinley"], qid="Q193459"),
    lf("mount-elbrus", "mountain", region="caucasus", size="massive", syns=["elbrus"], qid="Q193459"),
    lf("aconcagua", "mountain", region="andes", size="massive", syns=["cerro-aconcagua"], qid="Q193459"),
    lf("mont-blanc", "mountain", region="alps", size="massive", syns=["monte-bianco"], qid="Q193459"),
    lf("mount-vesuvius", "volcano", region="italy", size="huge", syns=["vesuvio"], qid="Q193459"),
    lf("mount-etna", "volcano", region="sicily", size="massive", syns=["etna"], qid="Q193459"),
    lf("mount-st-helens", "volcano", region="north-america-northwest", size="huge", syns=["st-helens"], qid="Q193459"),
    lf("mount-rainier", "volcano", region="north-america-northwest", size="massive", syns=["rainier"], qid="Q193459"),
    lf("mount-hood", "volcano", region="north-america-northwest", size="huge", syns=["hood"], qid="Q193459"),
]

# Valley-related
NODES += [
    lf("valley", "valley", size="large", syns=["vale", "dale", "glen"], qid="Q39816"),
    lf("canyon", "canyon", size="huge", syns=["gorge", "ravine"], qid="Q150784"),
    lf("gorge", "canyon", size="large", syns=["chasm", "ravine"], qid="Q193459"),
    lf("ravine", "canyon", size="medium", syns=["gully", "arroyo"], qid="Q193459"),
    lf("gully", "canyon", size="small", syns=["gulch", "arroyo"], qid="Q193459"),
    lf("arroyo", "canyon", size="medium", syns=["wash", "dry-creek"], qid="Q193459"),
    lf("wadi", "canyon", region="middle-east", size="medium", syns=["dry-riverbed"], qid="Q193459"),
    lf("gulch", "canyon", size="small", syns=["gully"], qid="Q193459"),
    lf("basin", "basin", size="huge", syns=["depression"], qid="Q125941"),
    lf("rift-valley", "valley", size="massive", syns=["rift"], qid="Q193459"),
    lf("hollow", "valley", size="small", syns=["dell", "dingle"], qid="Q193459"),
    lf("grand-canyon", "canyon", region="north-america-southwest", size="massive",
        syns=["arizona-canyon"], qid="Q118841"),
    lf("bryce-canyon", "canyon", region="utah", size="large", syns=["bryce"], qid="Q193459"),
    lf("zion-canyon", "canyon", region="utah", size="large", syns=["zion"], qid="Q193459"),
    lf("copper-canyon", "canyon", region="mexico", size="massive", syns=["barrancas-del-cobre"], qid="Q193459"),
    lf("verdon-gorge", "canyon", region="france", size="huge", syns=["gorges-du-verdon"], qid="Q193459"),
]

# Plain/prairie
NODES += [
    lf("plain", "plain", size="massive", syns=["flatland", "lowland"], qid="Q160091"),
    lf("prairie", "plain", region="north-america", size="massive",
        syns=["grassland", "great-plains"], qid="Q193459"),
    lf("steppe", "plain", region="eurasia", size="massive", syns=["temperate-grassland"], qid="Q193459"),
    lf("pampas", "plain", region="south-america", size="massive", syns=["pampa"], qid="Q193459"),
    lf("savanna", "plain", region="africa", size="massive", syns=["savannah"], qid="Q193459"),
    lf("veld", "plain", region="south-africa", size="massive", syns=["veldt"], qid="Q193459"),
    lf("llanos", "plain", region="south-america-north", size="massive", syns=["tropical-grassland"], qid="Q193459"),
    lf("cerrado", "plain", region="brazil", size="massive", syns=["brazilian-savanna"], qid="Q193459"),
    lf("meadow", "plain", size="medium", syns=["grassy-field", "pasture"], qid="Q193459"),
    lf("moor", "plain", region="britain", size="large", syns=["heath", "moorland"], qid="Q193459"),
    lf("heath", "plain", region="europe", size="medium", syns=["heathland"], qid="Q193459"),
    lf("tundra", "tundra", region="arctic", size="massive", syns=["arctic-tundra"], qid="Q193459"),
    lf("alpine-tundra", "tundra", size="large", syns=["mountain-tundra"], qid="Q193459"),
]

# Desert
NODES += [
    lf("desert", "desert", size="massive", syns=["arid-region"], qid="Q8514"),
    lf("dune", "dune", size="large", syns=["sand-dune"], qid="Q107058"),
    lf("erg", "desert", region="sahara", size="massive", syns=["sand-sea"], qid="Q193459"),
    lf("hamada", "desert", region="sahara", size="massive", syns=["rocky-desert"], qid="Q193459"),
    lf("playa", "basin", region="north-america-southwest", size="medium",
        syns=["dry-lake-bed"], qid="Q193459"),
    lf("badlands", "plain", region="north-america", size="large", syns=["eroded-plain"], qid="Q193459"),
    lf("mesa-butte-country", "plateau", region="north-america-southwest", size="large",
        syns=["canyonlands"], qid="Q193459"),
    lf("sahara", "desert", region="north-africa", size="massive", syns=["sahara-desert"], qid="Q193459"),
    lf("gobi", "desert", region="mongolia", size="massive", syns=["gobi-desert"], qid="Q193459"),
    lf("kalahari", "desert", region="southern-africa", size="massive", syns=["kalahari-desert"], qid="Q193459"),
    lf("mojave", "desert", region="north-america-southwest", size="massive", syns=["mojave-desert"], qid="Q193459"),
    lf("sonoran", "desert", region="north-america-southwest", size="massive", syns=["sonoran-desert"], qid="Q193459"),
    lf("chihuahuan", "desert", region="mexico-us-border", size="massive", syns=["chihuahuan-desert"], qid="Q193459"),
    lf("atacama", "desert", region="chile", size="massive", syns=["atacama-desert"], qid="Q193459"),
    lf("namib", "desert", region="namibia", size="massive", syns=["namib-desert"], qid="Q193459"),
    lf("arabian-desert", "desert", region="arabian-peninsula", size="massive", syns=["arabia"], qid="Q193459"),
    lf("simpson-desert", "desert", region="australia", size="massive", syns=["red-desert"], qid="Q193459"),
    lf("outback", "desert", region="australia", size="massive", syns=["australian-interior"], qid="Q193459"),
]

# Coast + island + peninsula
NODES += [
    lf("island", "island", size="large", syns=["isle", "islet"], qid="Q23442"),
    lf("archipelago", "island", size="huge", syns=["island-group"], qid="Q33837"),
    lf("atoll", "island", size="medium", syns=["ring-island", "coral-island"], qid="Q42523"),
    lf("cay", "island", size="tiny", syns=["key", "coral-cay"], qid="Q193459"),
    lf("islet", "island", size="tiny", syns=["small-island"], qid="Q193459"),
    lf("peninsula", "peninsula", size="huge", syns=["cape", "point"], qid="Q34763"),
    lf("cape", "peninsula", size="large", syns=["headland", "promontory"], qid="Q185113"),
    lf("headland", "peninsula", size="large", syns=["promontory", "point"], qid="Q193459"),
    lf("isthmus", "isthmus", size="large", syns=["land-bridge", "neck"], qid="Q133056"),
    lf("shore", "plain", size="large", syns=["coast", "coastline"], qid="Q193459"),
    lf("beach", "plain", size="medium", syns=["seashore", "sand-beach"], qid="Q40080"),
    lf("shingle-beach", "plain", size="medium", syns=["pebble-beach"], qid="Q193459"),
    lf("tidal-flat", "plain", size="medium", syns=["mudflat"], qid="Q193459"),
    lf("salt-marsh", "plain", size="medium", syns=["saltmarsh"], qid="Q193459"),
    lf("estuary-land", "plain", size="medium", syns=["tidal-plain"], qid="Q193459"),
    lf("sea-stack", "cliff", size="medium", syns=["stack"], qid="Q193459"),
    lf("arch", "cliff", size="medium", syns=["sea-arch", "natural-arch"], qid="Q193459"),
    lf("madagascar", "island", region="indian-ocean", size="massive", syns=["madagascar-island"], qid="Q193459"),
    lf("borneo", "island", region="southeast-asia", size="massive", syns=["borneo-island"], qid="Q193459"),
    lf("iceland", "island", region="north-atlantic", size="massive", syns=["iceland-island"], qid="Q193459"),
    lf("greenland", "island", region="north-atlantic", size="massive", syns=["greenland-island"], qid="Q193459"),
    lf("great-britain", "island", region="europe", size="massive", syns=["britain"], qid="Q193459"),
    lf("hawaii", "island", region="pacific", size="huge", syns=["hawaiian-islands"], qid="Q193459"),
    lf("galapagos", "island", region="pacific", size="huge", syns=["galapagos-islands"], qid="Q193459"),
    lf("azores", "island", region="atlantic", size="huge", syns=["azores-islands"], qid="Q193459"),
    lf("canary-islands", "island", region="atlantic-off-africa", size="huge", syns=["canaries"], qid="Q193459"),
    lf("faroe-islands", "island", region="north-atlantic", size="large", syns=["faroes"], qid="Q193459"),
    lf("maldives", "island", region="indian-ocean", size="huge", syns=["maldive-islands"], qid="Q193459"),
    lf("seychelles", "island", region="indian-ocean", size="large", syns=["seychelles-islands"], qid="Q193459"),
    lf("azores-plateau", "plateau", region="mid-atlantic", size="huge", syns=["azores"], qid="Q193459"),
]

# Glacial + polar
NODES += [
    lf("glacier", "glacier", size="massive", syns=["ice-river"], qid="Q35666"),
    lf("ice-sheet", "glacier", size="massive", syns=["continental-glacier"], qid="Q193459"),
    lf("ice-cap", "glacier", size="huge", syns=["polar-ice-cap"], qid="Q193459"),
    lf("iceberg", "glacier", size="large", syns=["ice-mountain"], qid="Q41504"),
    lf("moraine", "hill", size="medium", syns=["glacial-moraine"], qid="Q193459"),
    lf("drumlin", "hill", size="medium", syns=["glacial-hill"], qid="Q193459"),
    lf("esker", "ridge", size="medium", syns=["glacial-ridge"], qid="Q193459"),
    lf("kettle-lake", "basin", size="small", syns=["kettle-pond"], qid="Q193459"),
    lf("cirque", "basin", size="medium", syns=["mountain-basin", "corrie", "cwm"], qid="Q193459"),
    lf("fjord-landform", "fjord", size="large", syns=["glacial-fjord"], qid="Q193459"),
    lf("pack-ice", "glacier", region="arctic", size="massive", syns=["sea-ice"], qid="Q193459"),
    lf("nunatak", "peak", size="medium", syns=["glacial-island-peak"], qid="Q193459"),
]

# Caves
NODES += [
    lf("cave", "cave", size="medium", syns=["cavern", "grotto"], qid="Q35509"),
    lf("cavern", "cave", size="large", syns=["large-cave"], qid="Q193459"),
    lf("grotto", "cave", size="small", syns=["small-cave"], qid="Q193459"),
    lf("sea-cave", "cave", size="medium", syns=["marine-cave"], qid="Q193459"),
    lf("ice-cave", "cave", region="glacier", size="medium", syns=["glacial-cave"], qid="Q193459"),
    lf("lava-tube", "cave", size="medium", syns=["volcanic-tube"], qid="Q193459"),
    lf("stalactite", "cave", size="tiny", syns=["dripstone-formation"], qid="Q193459"),
    lf("stalagmite", "cave", size="tiny", syns=["upward-dripstone"], qid="Q193459"),
    lf("mammoth-cave", "cave", region="kentucky", size="huge", syns=["mammoth-cave-system"], qid="Q193459"),
    lf("carlsbad-caverns", "cave", region="new-mexico", size="huge", syns=["carlsbad"], qid="Q193459"),
    lf("waitomo-cave", "cave", region="new-zealand", size="medium", syns=["glowworm-caves"], qid="Q193459"),
]

# Rivers/streams-related landforms
NODES += [
    lf("delta", "plain", size="huge", syns=["river-delta"], qid="Q126065"),
    lf("floodplain", "plain", size="large", syns=["flood-plain"], qid="Q193459"),
    lf("oxbow", "water-body", size="small", syns=["oxbow-lake"], qid="Q193459"),
    lf("meander", "valley", size="medium", syns=["river-meander"], qid="Q193459"),
    lf("gulch-canyon", "canyon", size="small", syns=["gulch"], qid="Q193459"),
    lf("waterfall-cliff", "cliff", size="large", syns=["falls-cliff"], qid="Q193459"),
    lf("cataract", "cliff", size="large", syns=["large-waterfall"], qid="Q193459"),
    lf("rapids-canyon", "canyon", size="medium", syns=["whitewater-canyon"], qid="Q193459"),
]

# Notable landform combos + oceanic
NODES += [
    lf("mariana-trench", "canyon", region="pacific", size="massive",
        syns=["deepest-ocean-point"], qid="Q193459"),
    lf("mid-atlantic-ridge", "ridge", region="atlantic", size="massive", syns=["mid-ocean-ridge"], qid="Q193459"),
    lf("continental-shelf", "plateau", size="massive", syns=["shelf"], qid="Q193459"),
    lf("abyssal-plain", "plain", size="massive", syns=["deep-ocean-floor"], qid="Q193459"),
    lf("seamount", "mountain", size="huge", syns=["underwater-mountain"], qid="Q193459"),
    lf("guyot", "mountain", size="huge", syns=["flat-topped-seamount"], qid="Q193459"),
    lf("coral-reef-atoll", "island", size="medium", syns=["coral-atoll"], qid="Q193459"),
    lf("great-barrier-reef", "island", region="australia", size="massive", syns=["great-barrier"], qid="Q193459"),
    lf("uluru", "hill", region="australia", size="large", syns=["ayers-rock"], qid="Q193459"),
    lf("half-dome", "cliff", region="yosemite", size="large", syns=["half-dome-cliff"], qid="Q193459"),
    lf("el-capitan", "cliff", region="yosemite", size="massive", syns=["el-cap"], qid="Q193459"),
    lf("devils-tower", "hill", region="wyoming", size="large", syns=["devils-tower-monument"], qid="Q193459"),
    lf("ship-rock", "hill", region="new-mexico", size="large", syns=["shiprock"], qid="Q193459"),
]
