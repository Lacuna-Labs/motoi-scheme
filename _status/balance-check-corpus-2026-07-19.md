# Motoi Mk 1 Corpus Balance Check

Corpus: `/Users/alfred/code/motoi-scheme/training-data/motoi-mk1-corpus-2026-07-19.jsonl`
Total pairs: 6046

## Distribution by kind

| Kind | Count | % |
|---|---|---|
| row-1-composition | 1079 | 17.8% |
| row-2-audit | 1079 | 17.8% |
| row-4-proof | 1079 | 17.8% |
| row-5-emergence | 1079 | 17.8% |
| row-3-dimension | 1078 | 17.8% |
| book-chapter | 651 | 10.8% |
| reference-intro | 1 | 0.0% |

## Row-2/3/4/5 balance

- row-1-composition: 1079
- row-2-audit: 1079
- row-3-dimension: 1078
- row-4-proof: 1079
- row-5-emergence: 1079

Min/Max row count: 1078 / 1079. Imbalance ratio: 1.00

✓ Balanced within tolerance.

## Per-library distribution (reference chapters)

| Library | Row-1 | Row-2 | Row-3 | Row-4 | Row-5 |
|---|---|---|---|---|---|
| ai | 35 | 35 | 35 | 35 | 35 |
| alg | 59 | 59 | 59 | 59 | 59 |
| animation | 3 | 3 | 3 | 3 | 3 |
| artifact | 4 | 4 | 4 | 4 | 4 |
| assert | 3 | 3 | 3 | 3 | 3 |
| audio | 13 | 13 | 13 | 13 | 13 |
| base | 1 | 1 | 1 | 1 | 1 |
| beat | 1 | 1 | 1 | 1 | 1 |
| bytevector | 9 | 9 | 9 | 9 | 9 |
| calc | 30 | 30 | 30 | 30 | 30 |
| char | 2 | 2 | 1 | 2 | 2 |
| chem | 5 | 5 | 5 | 5 | 5 |
| collision | 1 | 1 | 1 | 1 | 1 |
| comb | 1 | 1 | 1 | 1 | 1 |
| compare | 2 | 2 | 2 | 2 | 2 |
| complex | 18 | 18 | 18 | 18 | 18 |
| const | 8 | 8 | 8 | 8 | 8 |
| core | 97 | 97 | 97 | 97 | 97 |
| cortex | 9 | 9 | 9 | 9 | 9 |
| curve | 37 | 37 | 37 | 37 | 37 |
| domain | 1 | 1 | 1 | 1 | 1 |
| easing | 12 | 12 | 12 | 12 | 12 |
| eng | 6 | 6 | 6 | 6 | 6 |
| entity | 47 | 47 | 47 | 47 | 47 |
| exact | 19 | 19 | 19 | 19 | 19 |
| exception | 5 | 5 | 5 | 5 | 5 |
| floor | 1 | 1 | 1 | 1 | 1 |
| game | 32 | 32 | 32 | 32 | 32 |
| geom | 57 | 57 | 57 | 57 | 57 |
| grid | 12 | 12 | 12 | 12 | 12 |
| group | 3 | 3 | 3 | 3 | 3 |
| hash | 17 | 17 | 17 | 17 | 17 |
| higher-order | 9 | 9 | 9 | 9 | 9 |
| input | 5 | 5 | 5 | 5 | 5 |
| intro | 0 | 0 | 0 | 0 | 0 |
| io | 15 | 15 | 15 | 15 | 15 |
| juggle | 6 | 6 | 6 | 6 | 6 |
| lazy | 2 | 2 | 2 | 2 | 2 |
| linalg | 25 | 25 | 25 | 25 | 25 |
| list | 15 | 15 | 15 | 15 | 15 |
| math | 49 | 49 | 49 | 49 | 49 |
| matrix | 20 | 20 | 20 | 20 | 20 |
| motion | 14 | 14 | 14 | 14 | 14 |
| note | 3 | 3 | 3 | 3 | 3 |
| nt | 29 | 29 | 29 | 29 | 29 |
| num | 2 | 2 | 2 | 2 | 2 |
| object | 2 | 2 | 2 | 2 | 2 |
| ops | 35 | 35 | 35 | 35 | 35 |
| part | 19 | 19 | 19 | 19 | 19 |
| pattern | 1 | 1 | 1 | 1 | 1 |
| phys | 19 | 19 | 19 | 19 | 19 |
| plot | 14 | 14 | 14 | 14 | 14 |
| predicate | 21 | 21 | 21 | 21 | 21 |
| prefab | 2 | 2 | 2 | 2 | 2 |
| route | 1 | 1 | 1 | 1 | 1 |
| scene | 5 | 5 | 5 | 5 | 5 |
| seq | 12 | 12 | 12 | 12 | 12 |
| solve | 13 | 13 | 13 | 13 | 13 |
| sprite | 3 | 3 | 3 | 3 | 3 |
| stat | 18 | 18 | 18 | 18 | 18 |
| string | 30 | 30 | 30 | 30 | 30 |
| sym | 1 | 1 | 1 | 1 | 1 |
| synth | 9 | 9 | 9 | 9 | 9 |
| system | 5 | 5 | 5 | 5 | 5 |
| text | 9 | 9 | 9 | 9 | 9 |
| tick | 9 | 9 | 9 | 9 | 9 |
| time | 11 | 11 | 11 | 11 | 11 |
| topo | 27 | 27 | 27 | 27 | 27 |
| transport | 1 | 1 | 1 | 1 | 1 |
| vec | 18 | 18 | 18 | 18 | 18 |
| vector | 10 | 10 | 10 | 10 | 10 |
| weather | 1 | 1 | 1 | 1 | 1 |
| world | 39 | 39 | 39 | 39 | 39 |

## Token length (approximate, chars/4)

| Kind | Q1 | Median | Q3 |
|---|---|---|---|
| reference-intro | 11272 | 11272 | 11272 |
| row-1-composition | 1046 | 1052 | 1059 |
| row-2-audit | 181 | 219 | 273 |
| row-3-dimension | 167 | 226 | 285 |
| row-4-proof | 159 | 194 | 233 |
| row-5-emergence | 172 | 215 | 255 |
| book-chapter | 1668 | 2586 | 4479 |

## Verdict

✓ CORPUS BALANCED. Ready for Alfred go-signal.
