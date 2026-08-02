# Motoi Reference Row 2-5 Coverage Audit

Generated: 2026-07-19
Files scanned: 87
Total verbs: 1379

## Overall row coverage

| Row | Present | 3-Discipline | Coverage % |
|---|---|---|---|
| row-2-audit | 1379 | 1379 | 100.0% / 100.0% |
| row-3-dimension | 1379 | 1259 | 100.0% / 91.3% |
| row-4-proof | 1379 | 1379 | 100.0% / 100.0% |
| row-5-emergence | 1379 | 1378 | 100.0% / 99.9% |

**Verbs with FULL 4-row + 3-discipline coverage: 1259 / 1379** (91.3%)

## Per-library coverage

| Library | Total | Full | Partial | Missing |
|---|---|---|---|---|
| ai | 58 | 58 | 0 | 0 |
| alg | 83 | 83 | 0 | 0 |
| animation | 3 | 3 | 0 | 0 |
| artifact | 4 | 4 | 0 | 0 |
| assert | 3 | 3 | 0 | 0 |
| audio | 13 | 13 | 0 | 0 |
| base | 1 | 1 | 0 | 0 |
| beat | 1 | 1 | 0 | 0 |
| bytevector | 10 | 10 | 0 | 0 |
| calc | 30 | 30 | 0 | 0 |
| char | 17 | 17 | 0 | 0 |
| chem | 5 | 5 | 0 | 0 |
| collision | 1 | 1 | 0 | 0 |
| comb | 1 | 1 | 0 | 0 |
| compare | 2 | 2 | 0 | 0 |
| complex | 18 | 18 | 0 | 0 |
| const | 8 | 8 | 0 | 0 |
| core | 101 | 101 | 0 | 0 |
| cortex | 14 | 14 | 0 | 0 |
| cpu | 12 | 12 | 0 | 0 |
| curve | 37 | 37 | 0 | 0 |
| domain | 1 | 1 | 0 | 0 |
| draw | 14 | 14 | 0 | 0 |
| easing | 13 | 13 | 0 | 0 |
| eng | 6 | 6 | 0 | 0 |
| entity | 54 | 54 | 0 | 0 |
| exact | 19 | 19 | 0 | 0 |
| exception | 5 | 5 | 0 | 0 |
| floor | 2 | 2 | 0 | 0 |
| game | 22 | 22 | 0 | 0 |
| geom | 57 | 57 | 0 | 0 |
| grid | 12 | 12 | 0 | 0 |
| hash | 26 | 26 | 0 | 0 |
| higher-order | 21 | 21 | 0 | 0 |
| image | 9 | 9 | 0 | 0 |
| image-compose | 15 | 15 | 0 | 0 |
| input | 5 | 5 | 0 | 0 |
| introspection | 16 | 16 | 0 | 0 |
| io | 15 | 15 | 0 | 0 |
| juggle | 6 | 6 | 0 | 0 |
| lazy | 2 | 2 | 0 | 0 |
| linalg | 23 | 23 | 0 | 0 |
| list | 54 | 54 | 0 | 0 |
| math | 80 | 80 | 0 | 0 |
| matrix | 21 | 21 | 0 | 0 |
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
| predicate | 37 | 37 | 0 | 0 |
| prefab | 2 | 2 | 0 | 0 |
| route | 1 | 1 | 0 | 0 |
| scene | 5 | 5 | 0 | 0 |
| sdf | 9 | 9 | 0 | 0 |
| seq | 12 | 12 | 0 | 0 |
| solve | 13 | 13 | 0 | 0 |
| sprite | 4 | 4 | 0 | 0 |
| stat | 18 | 18 | 0 | 0 |
| string | 52 | 52 | 0 | 0 |
| superformula | 3 | 3 | 0 | 0 |
| svg-path | 3 | 3 | 0 | 0 |
| sym | 1 | 1 | 0 | 0 |
| synth | 9 | 9 | 0 | 0 |
| system | 5 | 5 | 0 | 0 |
| text | 11 | 11 | 0 | 0 |
| tick | 9 | 9 | 0 | 0 |
| time | 11 | 11 | 0 | 0 |
| topo | 28 | 28 | 0 | 0 |
| transport | 2 | 2 | 0 | 0 |
| vec | 18 | 18 | 0 | 0 |
| vector | 15 | 15 | 0 | 0 |
| weather | 1 | 1 | 0 | 0 |
| world | 52 | 52 | 0 | 0 |

## Rule 9 violations (philosopher names in entries)

None found. ✓

## Rule 10 violations (Sakura verbs in Motoi entries)

- audio/audio/master-volume: mentions ['radio/']
- audio/audio/tempo: mentions ['radio/']
- audio/audio/transcribe-with-cloud-help: mentions ['afford/']
- cpu/cpu/load-program!: mentions ['deploy/']
- grid/grid/flower-go-to!: mentions ['card/']
- image-compose/empty-scene: mentions ['card/']
- synth/synth/orchestra: mentions ['cine/']
- system/system/registry: mentions ['ask/']
- world/world/after: mentions ['cine/']
- world/world/camera: mentions ['cine/']
- world/world/camera-follow!: mentions ['cine/']

## Verdict

✗ INCOMPLETE (91.3%). More authoring needed before fold.
