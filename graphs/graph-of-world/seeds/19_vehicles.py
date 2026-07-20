"""Vehicles — generic types + notable variants. NO brand names. ~120-200 nodes."""

from _helpers import node, wikidata, authored


def v(canonical, vtype, made_of=None, used=None, syns=None, size="medium", qid=None):
    return node(canonical, "vehicle",
                synonyms=syns or [],
                vehicle_type=vtype,
                made_of=made_of or [],
                used_for=used,
                size_scale=size,
                kid_friendly=True,
                provenance=[wikidata(qid)] if qid else [authored()])


NODES = []

# Land — cars, trucks, buses, vans
LAND = [
    ("car", "car", ["steel", "plastic", "glass"], ["personal-transport"], ["automobile", "auto"], "medium", "Q193459"),
    ("sedan", "car", ["steel"], ["family-transport"], None, "medium", "Q193459"),
    ("coupe", "car", ["steel"], ["personal-transport"], ["two-door-car"], "medium", "Q193459"),
    ("convertible", "car", ["steel"], ["personal-transport"], ["cabriolet", "drop-top"], "medium", "Q193459"),
    ("hatchback", "car", ["steel"], ["personal-transport"], None, "medium", "Q193459"),
    ("station-wagon", "car", ["steel"], ["family-transport"], ["estate-car"], "medium", "Q193459"),
    ("suv", "car", ["steel"], ["family-transport"], ["sport-utility-vehicle"], "large", "Q193459"),
    ("crossover", "car", ["steel"], ["family-transport"], None, "medium", "Q193459"),
    ("minivan", "van", ["steel"], ["family-transport"], ["people-mover"], "large", "Q193459"),
    ("van", "van", ["steel"], ["cargo-transport"], None, "large", "Q193459"),
    ("cargo-van", "van", ["steel"], ["cargo"], ["panel-van"], "large", "Q193459"),
    ("passenger-van", "van", ["steel"], ["passenger-transport"], None, "large", "Q193459"),
    ("pickup-truck", "truck", ["steel"], ["cargo-transport"], ["pickup", "ute"], "large", "Q193459"),
    ("truck", "truck", ["steel"], ["cargo-transport"], ["lorry"], "large", "Q193459"),
    ("semi-truck", "truck", ["steel"], ["freight"], ["tractor-trailer", "big-rig", "18-wheeler"], "huge", "Q193459"),
    ("box-truck", "truck", ["steel"], ["cargo"], None, "large", "Q193459"),
    ("dump-truck", "truck", ["steel"], ["construction"], ["tipper"], "huge", "Q193459"),
    ("tow-truck", "truck", ["steel"], ["vehicle-recovery"], ["wrecker"], "large", "Q193459"),
    ("garbage-truck", "truck", ["steel"], ["waste-collection"], ["refuse-truck", "bin-lorry"], "large", "Q193459"),
    ("cement-mixer", "truck", ["steel"], ["construction"], ["concrete-mixer"], "huge", "Q193459"),
    ("tanker-truck", "truck", ["steel"], ["liquid-transport"], ["fuel-tanker"], "huge", "Q193459"),
    ("food-truck", "truck", ["steel"], ["mobile-food-service"], None, "medium", "Q193459"),
    ("ice-cream-truck", "truck", ["steel"], ["ice-cream-vending"], None, "medium", "Q193459"),
    ("armored-car", "truck", ["steel"], ["cash-transport"], None, "large", "Q193459"),
    ("bus", "bus", ["steel"], ["mass-transit"], ["motor-coach"], "huge", "Q193459"),
    ("school-bus", "bus", ["steel"], ["student-transport"], None, "huge", "Q193459"),
    ("double-decker-bus", "bus", ["steel"], ["mass-transit"], None, "huge", "Q193459"),
    ("trolleybus", "bus", ["steel"], ["mass-transit"], ["trackless-trolley"], "huge", "Q193459"),
    ("shuttle", "bus", ["steel"], ["short-run-transport"], None, "large", "Q193459"),
    ("motorhome", "van", ["steel"], ["mobile-dwelling"], ["rv", "recreational-vehicle"], "huge", "Q193459"),
    ("camper-van", "van", ["steel"], ["camping"], ["campervan"], "large", "Q193459"),
    ("caravan", "van", ["steel"], ["mobile-dwelling"], ["travel-trailer"], "large", "Q193459"),
    ("trailer", "van", ["steel"], ["cargo"], None, "large", "Q193459"),
]
for c in LAND:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Emergency + service
EMERG = [
    ("ambulance", "ambulance", ["steel"], ["medical-transport"], None, "large", "Q193459"),
    ("fire-engine", "fire-engine", ["steel"], ["firefighting"], ["fire-truck"], "huge", "Q193459"),
    ("police-car", "car", ["steel"], ["law-enforcement"], ["cop-car", "cruiser"], "medium", "Q193459"),
    ("swat-vehicle", "truck", ["steel"], ["law-enforcement"], ["swat-van"], "large", "Q193459"),
    ("taxi", "taxi", ["steel"], ["hire-transport"], ["cab", "hack"], "medium", "Q193459"),
    ("limousine", "car", ["steel"], ["luxury-transport"], ["limo", "town-car"], "large", "Q193459"),
    ("hearse", "car", ["steel"], ["funeral"], None, "large", "Q193459"),
]
for c in EMERG:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Two-wheeled
TWO = [
    ("bicycle", "bicycle", ["steel", "aluminum"], ["personal-transport", "recreation"], ["bike", "pushbike", "cycle"], "small", "Q193459"),
    ("mountain-bike", "bicycle", ["aluminum"], ["off-road"], ["mtb"], "small", "Q193459"),
    ("road-bike", "bicycle", ["carbon", "aluminum"], ["road-cycling"], None, "small", "Q193459"),
    ("bmx", "bicycle", ["steel"], ["trick-riding"], ["bmx-bike"], "small", "Q193459"),
    ("cruiser-bike", "bicycle", ["steel"], ["casual-cycling"], ["beach-cruiser"], "small", "Q193459"),
    ("tandem-bike", "bicycle", ["steel"], ["two-rider"], ["bicycle-built-for-two"], "medium", "Q193459"),
    ("folding-bike", "bicycle", ["aluminum"], ["commuting"], None, "small", "Q193459"),
    ("recumbent-bike", "bicycle", ["aluminum"], ["ergonomic-cycling"], None, "medium", "Q193459"),
    ("tricycle", "bicycle", ["steel"], ["stability-cycling"], ["trike"], "small", "Q193459"),
    ("unicycle", "bicycle", ["steel"], ["performance-cycling"], None, "small", "Q193459"),
    ("motorcycle", "motorcycle", ["steel"], ["personal-transport"], ["motorbike", "bike"], "small", "Q193459"),
    ("cruiser-motorcycle", "motorcycle", ["steel"], ["long-distance"], ["cruiser"], "medium", "Q193459"),
    ("sportbike", "motorcycle", ["steel"], ["performance"], None, "small", "Q193459"),
    ("dirt-bike", "motorcycle", ["steel"], ["off-road"], ["motocross-bike"], "small", "Q193459"),
    ("chopper", "motorcycle", ["steel"], ["cruising"], None, "medium", "Q193459"),
    ("scooter", "scooter", ["steel", "plastic"], ["personal-transport"], ["moped"], "small", "Q193459"),
    ("moped", "scooter", ["steel"], ["personal-transport"], None, "small", "Q193459"),
    ("electric-scooter", "scooter", ["aluminum"], ["personal-transport"], ["e-scooter"], "small", "Q193459"),
    ("kick-scooter", "scooter", ["aluminum"], ["personal-transport"], ["push-scooter"], "small", "Q193459"),
    ("skateboard", "skateboard", ["wood", "plastic"], ["recreation"], None, "small", "Q193459"),
    ("longboard", "skateboard", ["wood"], ["cruising"], None, "small", "Q193459"),
    ("penny-board", "skateboard", ["plastic"], ["cruising"], None, "small", "Q193459"),
    ("hoverboard", "skateboard", ["plastic"], ["personal-transport"], ["self-balancing-scooter"], "small", "Q193459"),
    ("segway", "skateboard", ["aluminum"], ["personal-transport"], None, "small", "Q193459"),
    ("rollerblades", "skateboard", ["plastic"], ["recreation"], ["inline-skates"], "small", "Q193459"),
    ("roller-skates", "skateboard", ["leather"], ["recreation"], ["quad-skates"], "small", "Q193459"),
]
for c in TWO:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Rail
RAIL = [
    ("train", "train", ["steel"], ["mass-transport"], None, "massive", "Q193459"),
    ("locomotive", "train", ["steel"], ["train-pulling"], ["engine"], "huge", "Q193459"),
    ("steam-locomotive", "train", ["steel"], ["train-pulling"], ["steam-engine"], "huge", "Q193459"),
    ("diesel-locomotive", "train", ["steel"], ["train-pulling"], None, "huge", "Q193459"),
    ("electric-locomotive", "train", ["steel"], ["train-pulling"], None, "huge", "Q193459"),
    ("freight-train", "train", ["steel"], ["cargo-transport"], None, "massive", "Q193459"),
    ("passenger-train", "train", ["steel"], ["passenger-transport"], None, "massive", "Q193459"),
    ("high-speed-train", "train", ["steel"], ["fast-passenger"], None, "massive", "Q193459"),
    ("bullet-train", "train", ["steel"], ["fast-passenger"], ["shinkansen-type"], "massive", "Q193459"),
    ("commuter-train", "train", ["steel"], ["commuting"], None, "massive", "Q193459"),
    ("subway", "subway", ["steel"], ["urban-transit"], ["metro", "underground"], "massive", "Q193459"),
    ("light-rail", "train", ["steel"], ["urban-transit"], None, "large", "Q193459"),
    ("tram", "tram", ["steel"], ["urban-transit"], ["streetcar", "trolley"], "large", "Q193459"),
    ("cable-car", "tram", ["steel"], ["hill-transit"], None, "medium", "Q193459"),
    ("gondola-lift", "tram", ["steel"], ["mountain-transport"], ["cable-gondola"], "small", "Q193459"),
    ("ski-lift", "tram", ["steel"], ["ski-uphill"], None, "small", "Q193459"),
    ("monorail", "train", ["steel"], ["airport-urban"], None, "large", "Q193459"),
    ("funicular", "train", ["steel"], ["cliff-transport"], None, "medium", "Q193459"),
    ("handcar", "train", ["wood", "steel"], ["rail-maintenance"], ["draisine"], "small", "Q193459"),
]
for c in RAIL:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Water
WATER = [
    ("boat", "boat", ["wood", "fiberglass"], ["water-transport"], ["watercraft"], "medium", "Q193459"),
    ("rowboat", "boat", ["wood"], ["rowing"], None, "small", "Q193459"),
    ("sailboat", "sailboat", ["wood", "fiberglass"], ["sailing"], ["sailing-boat"], "medium", "Q193459"),
    ("dinghy", "boat", ["wood"], ["short-run"], None, "small", "Q193459"),
    ("kayak", "kayak", ["plastic", "fiberglass"], ["paddling"], None, "small", "Q193459"),
    ("canoe", "canoe", ["wood", "aluminum"], ["paddling"], None, "small", "Q193459"),
    ("raft", "raft", ["rubber", "wood"], ["floating"], None, "medium", "Q193459"),
    ("inflatable-raft", "raft", ["rubber"], ["whitewater"], None, "medium", "Q193459"),
    ("paddleboat", "boat", ["plastic"], ["recreation"], ["pedal-boat"], "small", "Q193459"),
    ("yacht", "yacht", ["fiberglass"], ["leisure-cruising"], None, "large", "Q193459"),
    ("catamaran", "sailboat", ["fiberglass"], ["sailing"], None, "medium", "Q193459"),
    ("dhow", "sailboat", ["wood"], ["cargo-sailing"], None, "medium", "Q193459"),
    ("junk", "sailboat", ["wood"], ["sailing"], None, "medium", "Q193459"),
    ("gondola", "boat", ["wood"], ["venice-transport"], None, "small", "Q193459"),
    ("motorboat", "boat", ["fiberglass"], ["recreation"], ["speedboat"], "medium", "Q193459"),
    ("fishing-boat", "boat", ["fiberglass"], ["fishing"], ["trawler"], "medium", "Q193459"),
    ("trawler", "boat", ["steel"], ["commercial-fishing"], None, "large", "Q193459"),
    ("ferry", "ferry", ["steel"], ["passenger-crossing"], None, "huge", "Q193459"),
    ("hovercraft", "boat", ["aluminum"], ["amphibious"], None, "large", "Q193459"),
    ("hydrofoil", "boat", ["aluminum"], ["fast-water-transport"], None, "large", "Q193459"),
    ("jetski", "boat", ["fiberglass"], ["recreation"], ["personal-watercraft"], "small", "Q193459"),
    ("ship", "ship", ["steel"], ["ocean-transport"], ["vessel"], "massive", "Q193459"),
    ("cargo-ship", "ship", ["steel"], ["freight"], ["container-ship"], "massive", "Q193459"),
    ("container-ship", "ship", ["steel"], ["container-freight"], None, "massive", "Q193459"),
    ("oil-tanker", "ship", ["steel"], ["oil-transport"], ["tanker"], "massive", "Q193459"),
    ("cruise-ship", "ship", ["steel"], ["passenger-cruise"], ["cruise-liner"], "massive", "Q193459"),
    ("ocean-liner", "ship", ["steel"], ["passenger-transport"], None, "massive", "Q193459"),
    ("battleship", "ship", ["steel"], ["naval-combat"], None, "massive", "Q193459"),
    ("aircraft-carrier", "ship", ["steel"], ["aircraft-platform"], None, "massive", "Q193459"),
    ("destroyer", "ship", ["steel"], ["naval-combat"], None, "massive", "Q193459"),
    ("frigate", "ship", ["steel"], ["naval-combat"], None, "huge", "Q193459"),
    ("submarine", "submarine", ["steel"], ["underwater-transport"], ["sub", "u-boat"], "huge", "Q193459"),
    ("tugboat", "boat", ["steel"], ["ship-assist"], ["tug"], "medium", "Q193459"),
    ("barge", "boat", ["steel"], ["river-cargo"], None, "large", "Q193459"),
    ("houseboat-vessel", "boat", ["wood"], ["dwelling", "recreation"], None, "medium", "Q193459"),
    ("clipper", "sailboat", ["wood"], ["fast-cargo-sailing"], None, "large", "Q193459"),
    ("schooner", "sailboat", ["wood"], ["sailing"], None, "large", "Q193459"),
    ("galleon", "sailboat", ["wood"], ["age-of-sail"], None, "large", "Q193459"),
    ("frigate-sail", "sailboat", ["wood"], ["naval-sail"], None, "large", "Q193459"),
    ("windsurfer", "sailboat", ["fiberglass"], ["windsurfing"], None, "small", "Q193459"),
    ("paddleboard", "raft", ["fiberglass"], ["standing-paddle"], ["sup"], "small", "Q193459"),
    ("surfboard", "raft", ["foam"], ["surfing"], None, "small", "Q193459"),
    ("kiteboard", "raft", ["foam"], ["kiteboarding"], None, "small", "Q193459"),
]
for c in WATER:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Air
AIR = [
    ("aircraft", "aircraft", ["aluminum"], ["flight"], ["airplane", "plane"], "huge", "Q193459"),
    ("airliner", "aircraft", ["aluminum"], ["passenger-flight"], ["jetliner"], "huge", "Q193459"),
    ("jumbo-jet", "aircraft", ["aluminum"], ["passenger-flight"], ["wide-body"], "massive", "Q193459"),
    ("private-jet", "aircraft", ["aluminum"], ["private-flight"], ["business-jet"], "large", "Q193459"),
    ("cargo-plane", "aircraft", ["aluminum"], ["freight"], None, "huge", "Q193459"),
    ("propeller-plane", "aircraft", ["aluminum"], ["short-flight"], ["prop-plane"], "medium", "Q193459"),
    ("seaplane", "aircraft", ["aluminum"], ["water-landing"], ["floatplane"], "large", "Q193459"),
    ("biplane", "aircraft", ["wood", "aluminum"], ["historic-flight"], None, "medium", "Q193459"),
    ("crop-duster", "aircraft", ["aluminum"], ["agricultural-spraying"], None, "medium", "Q193459"),
    ("fighter-jet", "aircraft", ["aluminum"], ["military-combat"], ["combat-jet"], "large", "Q193459"),
    ("bomber", "aircraft", ["aluminum"], ["military"], None, "huge", "Q193459"),
    ("stealth-aircraft", "aircraft", ["composite"], ["military"], None, "large", "Q193459"),
    ("helicopter", "helicopter", ["aluminum"], ["hovering-flight"], ["chopper", "copter"], "large", "Q193459"),
    ("attack-helicopter", "helicopter", ["aluminum"], ["military"], None, "large", "Q193459"),
    ("rescue-helicopter", "helicopter", ["aluminum"], ["rescue"], None, "large", "Q193459"),
    ("gyrocopter", "helicopter", ["aluminum"], ["personal-flight"], ["autogyro"], "small", "Q193459"),
    ("tilt-rotor", "helicopter", ["aluminum"], ["hybrid-flight"], None, "large", "Q193459"),
    ("glider", "glider", ["composite"], ["silent-flight"], ["sailplane"], "medium", "Q193459"),
    ("hang-glider", "glider", ["aluminum", "fabric"], ["personal-flight"], None, "small", "Q193459"),
    ("paraglider", "glider", ["fabric"], ["personal-flight"], None, "small", "Q193459"),
    ("balloon", "balloon", ["fabric"], ["flight"], ["hot-air-balloon"], "large", "Q193459"),
    ("hot-air-balloon", "balloon", ["fabric"], ["recreation"], None, "large", "Q193459"),
    ("blimp", "balloon", ["fabric"], ["flight"], ["dirigible"], "huge", "Q193459"),
    ("airship", "balloon", ["fabric"], ["flight"], ["zeppelin"], "huge", "Q193459"),
    ("drone", "aircraft", ["plastic"], ["remote-flight"], ["uav", "quadcopter"], "small", "Q193459"),
    ("kite", "glider", ["fabric"], ["recreation"], None, "small", "Q193459"),
    ("parachute", "glider", ["fabric"], ["descent"], None, "small", "Q193459"),
    ("wingsuit", "glider", ["fabric"], ["human-flight"], None, "small", "Q193459"),
]
for c in AIR:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Space
SPACE = [
    ("spacecraft", "spacecraft", ["aluminum", "composite"], ["space-flight"], ["spaceship"], "huge", "Q193459"),
    ("rocket", "rocket", ["aluminum"], ["launch"], ["launch-vehicle"], "massive", "Q193459"),
    ("shuttle", "spacecraft", ["aluminum"], ["reusable-space-flight"], ["space-shuttle"], "huge", "Q193459"),
    ("space-capsule", "spacecraft", ["composite"], ["crewed-orbit"], None, "large", "Q193459"),
    ("satellite", "spacecraft", ["aluminum"], ["orbit"], ["artificial-satellite"], "medium", "Q193459"),
    ("space-station", "spacecraft", ["aluminum"], ["orbital-habitat"], None, "massive", "Q193459"),
    ("space-probe", "spacecraft", ["aluminum"], ["exploration"], ["probe"], "medium", "Q193459"),
    ("lunar-lander", "spacecraft", ["aluminum"], ["moon-landing"], ["moon-lander"], "large", "Q193459"),
    ("mars-rover", "spacecraft", ["aluminum"], ["planetary-surface"], ["rover"], "medium", "Q193459"),
]
for c in SPACE:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))

# Construction + agricultural + special
CONSTR = [
    ("tractor", "tractor", ["steel"], ["farming"], None, "large", "Q193459"),
    ("combine-harvester", "tractor", ["steel"], ["grain-harvest"], ["combine"], "huge", "Q193459"),
    ("plow", "tractor", ["steel"], ["soil-tilling"], ["plough"], "medium", "Q193459"),
    ("bulldozer", "bulldozer", ["steel"], ["earth-moving"], None, "huge", "Q193459"),
    ("excavator", "bulldozer", ["steel"], ["digging"], ["digger"], "huge", "Q193459"),
    ("backhoe", "bulldozer", ["steel"], ["digging"], None, "large", "Q193459"),
    ("skid-steer", "bulldozer", ["steel"], ["small-construction"], ["bobcat-type"], "medium", "Q193459"),
    ("crane", "crane", ["steel"], ["lifting"], None, "massive", "Q193459"),
    ("tower-crane", "crane", ["steel"], ["construction-lift"], None, "massive", "Q193459"),
    ("mobile-crane", "crane", ["steel"], ["heavy-lift"], None, "huge", "Q193459"),
    ("forklift", "forklift", ["steel"], ["warehouse-lift"], ["fork-truck"], "medium", "Q193459"),
    ("pallet-jack", "forklift", ["steel"], ["warehouse"], None, "small", "Q193459"),
    ("golf-cart", "golf-cart", ["plastic"], ["golf-course"], None, "small", "Q193459"),
    ("atv", "car", ["steel"], ["off-road-recreation"], ["quad-bike", "four-wheeler"], "small", "Q193459"),
    ("snowmobile", "car", ["steel"], ["snow-travel"], ["ski-doo-type"], "small", "Q193459"),
    ("jet-ski", "boat", ["fiberglass"], ["water-recreation"], None, "small", "Q193459"),
    ("horse-drawn-carriage", "horse-drawn", ["wood"], ["historic-transport"], ["carriage"], "medium", "Q193459"),
    ("wagon", "horse-drawn", ["wood"], ["cargo"], ["cart"], "medium", "Q193459"),
    ("chariot", "horse-drawn", ["wood"], ["ancient-warfare"], None, "small", "Q193459"),
    ("sleigh", "sled", ["wood"], ["snow-transport"], None, "small", "Q193459"),
    ("sled", "sled", ["wood", "plastic"], ["snow-recreation"], ["sledge"], "small", "Q193459"),
    ("dogsled", "sled", ["wood"], ["arctic-transport"], None, "medium", "Q193459"),
    ("toboggan", "sled", ["wood"], ["snow-recreation"], None, "small", "Q193459"),
    ("wheelchair", "wheelchair", ["aluminum"], ["mobility"], None, "small", "Q193459"),
    ("stroller", "wheelchair", ["plastic"], ["baby-transport"], ["pram", "buggy", "pushchair"], "small", "Q193459"),
    ("shopping-cart", "wheelchair", ["steel"], ["retail"], ["trolley"], "small", "Q193459"),
    ("wheelbarrow", "wheelchair", ["steel"], ["cargo-carry"], None, "small", "Q193459"),
    ("rickshaw", "horse-drawn", ["wood"], ["passenger-transport"], None, "small", "Q193459"),
    ("pedicab", "bicycle", ["steel"], ["passenger-transport"], ["bike-taxi"], "small", "Q193459"),
]
for c in CONSTR:
    NODES.append(v(c[0], c[1], made_of=c[2], used=c[3], syns=c[4], size=c[5], qid=c[6]))
