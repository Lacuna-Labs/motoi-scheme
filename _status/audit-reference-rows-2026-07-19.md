# Motoi Reference Row 2-5 Coverage Audit

Generated: 2026-07-19
Files scanned: 77
Total verbs: 1133

## Overall row coverage

| Row | Present | 3-Discipline | Coverage % |
|---|---|---|---|
| row-2-audit | 1133 | 1133 | 100.0% / 100.0% |
| row-3-dimension | 1133 | 1025 | 100.0% / 90.5% |
| row-4-proof | 1133 | 1133 | 100.0% / 100.0% |
| row-5-emergence | 1133 | 1132 | 100.0% / 99.9% |

**Verbs with FULL 4-row + 3-discipline coverage: 1025 / 1133** (90.5%)

## Per-library coverage

| Library | Total | Full | Partial | Missing |
|---|---|---|---|---|
| ai | 57 | 57 | 0 | 0 |
| alg | 59 | 59 | 0 | 0 |
| animation | 3 | 3 | 0 | 0 |
| artifact | 4 | 4 | 0 | 0 |
| assert | 3 | 3 | 0 | 0 |
| audio | 13 | 13 | 0 | 0 |
| base | 1 | 1 | 0 | 0 |
| beat | 1 | 1 | 0 | 0 |
| bytevector | 9 | 9 | 0 | 0 |
| calc | 30 | 30 | 0 | 0 |
| char | 17 | 17 | 0 | 0 |
| chem | 5 | 5 | 0 | 0 |
| collision | 1 | 1 | 0 | 0 |
| comb | 1 | 1 | 0 | 0 |
| compare | 2 | 2 | 0 | 0 |
| complex | 18 | 18 | 0 | 0 |
| const | 8 | 8 | 0 | 0 |
| core | 97 | 97 | 0 | 0 |
| cortex | 9 | 9 | 0 | 0 |
| cpu | 12 | 12 | 0 | 0 |
| curve | 37 | 37 | 0 | 0 |
| domain | 1 | 1 | 0 | 0 |
| easing | 12 | 12 | 0 | 0 |
| eng | 6 | 6 | 0 | 0 |
| entity | 46 | 46 | 0 | 0 |
| exact | 19 | 19 | 0 | 0 |
| exception | 5 | 5 | 0 | 0 |
| floor | 1 | 1 | 0 | 0 |
| game | 22 | 22 | 0 | 0 |
| geom | 57 | 57 | 0 | 0 |
| grid | 12 | 12 | 0 | 0 |
| hash | 14 | 14 | 0 | 0 |
| higher-order | 9 | 9 | 0 | 0 |
| input | 5 | 5 | 0 | 0 |
| introspection | 16 | 16 | 0 | 0 |
| io | 15 | 15 | 0 | 0 |
| juggle | 6 | 6 | 0 | 0 |
| lazy | 2 | 2 | 0 | 0 |
| linalg | 23 | 23 | 0 | 0 |
| list | 15 | 15 | 0 | 0 |
| math | 56 | 56 | 0 | 0 |
| matrix | 17 | 17 | 0 | 0 |
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
| world | 43 | 43 | 0 | 0 |

## Rule 9 violations (philosopher names in entries)

None found. ✓

## Rule 10 violations (Sakura verbs in Motoi entries)

- audio/audio/master-volume: mentions ['radio/']
- audio/audio/tempo: mentions ['radio/']
- audio/audio/transcribe-with-cloud-help: mentions ['afford/']
- cpu/cpu/load-program!: mentions ['deploy/']
- grid/grid/flower-go-to!: mentions ['card/']
- synth/synth/orchestra: mentions ['cine/']
- system/system/registry: mentions ['ask/']
- world/world/after: mentions ['cine/']
- world/world/camera: mentions ['cine/']
- world/world/camera-follow!: mentions ['cine/']

## Verdict

✗ INCOMPLETE (90.5%). More authoring needed before fold.
