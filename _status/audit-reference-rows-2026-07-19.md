# Motoi Reference Row 2-5 Coverage Audit

Generated: 2026-07-19
Files scanned: 75
Total verbs: 1079

## Overall row coverage

| Row | Present | 3-Discipline | Coverage % |
|---|---|---|---|
| row-2-audit | 1079 | 1079 | 100.0% / 100.0% |
| row-3-dimension | 1079 | 967 | 100.0% / 89.6% |
| row-4-proof | 1079 | 1079 | 100.0% / 100.0% |
| row-5-emergence | 1079 | 965 | 100.0% / 89.4% |

**Verbs with FULL 4-row + 3-discipline coverage: 964 / 1079** (89.3%)

## Per-library coverage

| Library | Total | Full | Partial | Missing |
|---|---|---|---|---|
| ai | 35 | 35 | 0 | 0 |
| alg | 59 | 59 | 0 | 0 |
| animation | 3 | 3 | 0 | 0 |
| artifact | 4 | 4 | 0 | 0 |
| assert | 3 | 3 | 0 | 0 |
| audio | 13 | 13 | 0 | 0 |
| base | 1 | 1 | 0 | 0 |
| beat | 1 | 1 | 0 | 0 |
| bytevector | 9 | 9 | 0 | 0 |
| calc | 30 | 30 | 0 | 0 |
| char | 2 | 2 | 0 | 0 |
| chem | 5 | 5 | 0 | 0 |
| collision | 1 | 1 | 0 | 0 |
| comb | 1 | 1 | 0 | 0 |
| compare | 2 | 2 | 0 | 0 |
| complex | 18 | 18 | 0 | 0 |
| const | 8 | 8 | 0 | 0 |
| core | 97 | 97 | 0 | 0 |
| cortex | 9 | 9 | 0 | 0 |
| curve | 37 | 37 | 0 | 0 |
| domain | 1 | 1 | 0 | 0 |
| easing | 12 | 12 | 0 | 0 |
| eng | 6 | 6 | 0 | 0 |
| entity | 47 | 47 | 0 | 0 |
| exact | 19 | 19 | 0 | 0 |
| exception | 5 | 5 | 0 | 0 |
| floor | 1 | 1 | 0 | 0 |
| game | 32 | 32 | 0 | 0 |
| geom | 57 | 57 | 0 | 0 |
| grid | 12 | 12 | 0 | 0 |
| group | 3 | 3 | 0 | 0 |
| hash | 17 | 17 | 0 | 0 |
| higher-order | 9 | 9 | 0 | 0 |
| input | 5 | 5 | 0 | 0 |
| io | 15 | 15 | 0 | 0 |
| juggle | 6 | 6 | 0 | 0 |
| lazy | 2 | 2 | 0 | 0 |
| linalg | 25 | 25 | 0 | 0 |
| list | 15 | 15 | 0 | 0 |
| math | 49 | 49 | 0 | 0 |
| matrix | 20 | 20 | 0 | 0 |
| motion | 14 | 14 | 0 | 0 |
| note | 3 | 3 | 0 | 0 |
| nt | 29 | 29 | 0 | 0 |
| num | 2 | 2 | 0 | 0 |
| object | 2 | 2 | 0 | 0 |
| ops | 35 | 35 | 0 | 0 |
| part | 19 | 19 | 0 | 0 |
| pattern | 1 | 1 | 0 | 0 |
| phys | 19 | 19 | 0 | 0 |
| plot | 14 | 14 | 0 | 0 |
| predicate | 21 | 21 | 0 | 0 |
| prefab | 2 | 2 | 0 | 0 |
| route | 1 | 1 | 0 | 0 |
| scene | 5 | 5 | 0 | 0 |
| seq | 12 | 12 | 0 | 0 |
| solve | 13 | 13 | 0 | 0 |
| sprite | 3 | 3 | 0 | 0 |
| stat | 18 | 18 | 0 | 0 |
| string | 30 | 30 | 0 | 0 |
| sym | 1 | 1 | 0 | 0 |
| synth | 9 | 9 | 0 | 0 |
| system | 5 | 5 | 0 | 0 |
| text | 9 | 9 | 0 | 0 |
| tick | 9 | 9 | 0 | 0 |
| time | 11 | 11 | 0 | 0 |
| topo | 27 | 27 | 0 | 0 |
| transport | 1 | 1 | 0 | 0 |
| vec | 18 | 18 | 0 | 0 |
| vector | 10 | 10 | 0 | 0 |
| weather | 1 | 1 | 0 | 0 |
| world | 39 | 39 | 0 | 0 |

## Rule 9 violations (philosopher names in entries)

None found. ✓

## Rule 10 violations (Sakura verbs in Motoi entries)

- audio/audio/master-volume: mentions ['radio/']
- audio/audio/tempo: mentions ['radio/']
- audio/audio/transcribe-with-cloud-help: mentions ['card/']
- beat/beat/on: mentions ['radio/']
- core/across-beats: mentions ['card/']
- core/after: mentions ['net/']
- core/after-frame: mentions ['card/']
- core/audio-playing?: mentions ['card/']
- core/cancel-tick: mentions ['card/']
- core/display: mentions ['card/']
- core/land-on-downbeat: mentions ['card/']
- core/on-tick: mentions ['card/']
- core/sprites: mentions ['card/']
- domain/domain/of: mentions ['ask/']
- entity/entity/goto!: mentions ['card/']
- entity/entity/state: mentions ['card/']
- game/game/state: mentions ['card/']
- grid/grid/card-center: mentions ['card/']
- grid/grid/flower-go-to!: mentions ['card/']
- input/input/set!: mentions ['sys/']
- math/math/area-model: mentions ['card/']
- motion/motion/move-to: mentions ['card/']
- motion/motion/with-feel: mentions ['card/']
- part/part/bow: mentions ['card/']
- part/part/lower: mentions ['net/']
- part/part/reach: mentions ['net/']
- part/part/shake: mentions ['net/']
- part/part/shrug: mentions ['net/']
- part/part/sway: mentions ['sys/']
- part/part/tilt: mentions ['card/']
- part/part/turn: mentions ['net/']
- part/part/twist: mentions ['card/']
- part/part/wave: mentions ['card/']
- plot/plot/render-svg: mentions ['card/']
- synth/synth/orchestra: mentions ['cine/']
- system/system/cards: mentions ['card/']
- system/system/registry: mentions ['ask/']
- text/text/draw: mentions ['card/']
- tick/tick/phase: mentions ['card/']
- tick/tick/triangle: mentions ['card/']
- world/world/after: mentions ['cine/']
- world/world/camera: mentions ['cine/']
- world/world/camera-follow!: mentions ['cine/']

## Verdict

✗ INCOMPLETE (89.3%). More authoring needed before fold.
