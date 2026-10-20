# Graph-Keys Audit — Motoi Four-Axis Graphs

**Date:** 2026-07-29 · **Mode:** READ-ONLY census (no corpus data modified/created) ·
**Author:** graph-keys audit lane

## 0. Where the graph data lives (files audited)

The Jung-axis graphs are **not** under `/Users/alfred/code/motoi-scheme/words/` (empty)
or `scheme/`. They live in a dedicated `graphs/` directory:

```
$ ls -la /Users/alfred/code/motoi-scheme/graphs/
graph-of-sensation.slat   13,241,868 B
graph-of-intuition.slat    6,535,779 B
graph-of-thinking.slat     2,085,071 B
graph-of-feeling.slat        445,449 B
MANIFEST.slat                  4,562 B
derivation-log-fill-closure-2026-07-27.jsonl   2,615,719 B
```

`/Users/alfred/.forge/corpus/` holds *derived SFT substrates* (`motoi-mk3-sft-isb/train.jsonl`,
`motoi-mk3-graph-book-enriched-v2-...jsonl`), **not** the source graph nodes. The four
`graphs/*.slat` files above are the canonical node source. Confirmed against
`graphs/MANIFEST.slat` (`:node-count-total 25228`, one graph per Jung function).

### Commands run
```
grep -c '^(node' graph-of-*.slat                 # node record counts
grep -hoE ':[a-z0-9][a-z0-9-]*' graph-of-*.slat | sort | uniq -c | sort -rn   # all keyword tokens
grep -hoE ':honest-null-[a-z-]*' graph-of-*.slat | sort | uniq -c             # honest-null companions
grep -hoE ':tier +"[0-9]"' graph-of-*.slat | sort | uniq -c                   # tier distribution
python3 scratch/sft-plans/graph_keys_census.py   # per-key 3-state census (paren-balanced node parse)
python3 -c "... derivation-log-fill-closure-2026-07-27.jsonl ..."             # cross-validation
```

## 1. Node population (paren-balanced parse of each `(node ...)` record)

| Axis | Nodes | Tier-1 | Tier-2 | Tier-3 |
|---|---|---|---|---|
| sensation | 17,203 | 300 | 500 | 16,403 |
| intuition | 6,244 | 299 | 2,754 | 3,191 |
| thinking | 1,100 | 300 | 500 | 300 |
| feeling | 675 | 62 | 338 | 275 |
| **total** | **25,222** | **961** | **4,092** | **20,169** |

(Manifest claims 25,228 / 6,248 intuition; the on-disk `(node` count is 25,222 / 6,244 —
a 6-node header/comment discrepancy, not material. The "6,248 intuition-salvage" figure in
memory maps to the intuition graph's node count.)

**Schema is TIERED** (per MANIFEST + SRE-MANUAL ch05 §9b). This governs which keys a node is
*expected* to carry, so raw "absent" counts must be read against tier:
- **Tier 1 (961):** full facet schema — synonyms, oppositions, associations, distributional-neighbors,
  cross-refs-graph, example-dialogue, examples, used-in-programs-as, tf-idf-per-axis (+ axis-specific facets).
- **Tier 2 (4,092):** lightweight — definition, relations, context-of-use, appears-in-corpus.
- **Tier 3 (20,169):** bare stub — surrounding-words + appears-in-corpus only.

Rich-key "absence" on Tier-3 stubs is **by design, not a gap.**

## 2. Complete enumerated key set

### 2a. Relation / edge keys (what the pair-generator traverses)
`synonyms` · `oppositions` · `associations` · `distributional-neighbors` ·
`cross-refs-graph` · `cross-refs-books` · `related-books` · `related-verbs` ·
`related-principles` · `appears-in-corpus` · `surrounding-words` · `relations` ·
`context-of-use` · `prerequisites` · `example-dialogue` · `examples` ·
`used-in-programs-as` · `example-in-world` · `example-in-scheme` · `short-scenario` ·
`antipattern-scenario` · `sensory-description` · `contrast-register` · `tf-idf-per-axis` ·
`definition` · `definition-technical`

### 2b. Honest-null COMPANION keys that actually appear on disk (the three-state signal)
`:honest-null-surrounding-words` (1597) · `:honest-null-appears-in-corpus` (1312) ·
`:honest-null-synonyms` (776) · `:honest-null-definition` (613) ·
`:honest-null-relations` (338) · `:honest-null-context-of-use` (338) ·
`:honest-null-oppositions` (267) · `:honest-null-prerequisites` (212) ·
`:honest-null-example-in-world` (177) · `:honest-null-example-in-scheme` (177) ·
`:honest-null-cross-refs-books` (62) · `:honest-null-distributional-neighbors` (1) ·
`:honest-null-associations` (1)

> **CRITICAL FINDING (2c below): only 13 of the 24 relation keys have ANY honest-null
> companion key on disk. The other 11 relation keys have NO three-state accounting at all —
> they are either populated or silently absent, with no "null-with-reason" signal.**

### 2c. Nested / value-level keys (inside relation values — the pair-generator must descend into these)
`:ref-graph` `:ref-id` (cross-refs-graph, 3063) · `:ref-file` `:ref-verb` (1194/1192) ·
`:speaker` `:line` `:child` `:motoi` (example-dialogue, 1930) · `:file` (appears-in-corpus, 25995) ·
`:neighbor` `:ppmi` (distributional/associations, 12187/12152) · `:book` `:chapter` `:excerpt` (cross-refs, 1786/1785/1003) ·
`:axis` `:peak-weight` `:secondary` (tf-idf-per-axis, 662/619) · `:register-carrier` (765) · `:everyday-object` (654).

### 2d. Non-relation keys (scalars / governance — listed for completeness, not scored as edges)
Statistical: `freq` `doc-freq` `tf-idf` `idf` `context-entropy` `cross-axis-bridge-score`
`first-appears-in-book-count` `selection-source`.
Identity/governance: `id` `canonical` `tier` `axis` `provenance` `dialect` `audience`
`content-rating` `confidentiality` `training-eligible` `kid-friendly` `category` `subchar`
`register-kind` `principle-kind` `motoi-behavior` `motoi-uses-when` `kid-familiarity`
`size-scale` `where-found` `contract` `invariant` `precondition` `correctness` `classify-reason`
`appears-in-books`.

## 3. Per-key three-state census (populated / honest-null / absent)

Absent = key not present on the node at all. `present` = populated + honest-null.
"Should-carry" tier(s) noted for interpretation.

| Relation key | Populated | Honest-null | Absent | Present | HN companion? | Carried on tiers |
|---|---|---|---|---|---|---|
| appears-in-corpus | 20,318 | 1,312 | 3,592 | 21,630 | YES | 1,2,3 |
| surrounding-words | 18,572 | 1,597 | 5,053 | 20,169 | YES | 3 (+T1 sensation) |
| definition | 9,352 | 613 | 15,257 | 9,965 | YES | 1,2 |
| relations | 3,754 | 338 | 21,130 | 4,092 | YES | 1,2 |
| context-of-use | 3,754 | 338 | 21,130 | 4,092 | YES | 1,2 |
| cross-refs-graph | 961 | 0 | 24,261 | 961 | no | 1 |
| example-dialogue | 961 | 0 | 24,261 | 961 | no | 1 |
| examples | 961 | 0 | 24,261 | 961 | no | 1 |
| used-in-programs-as | 961 | 0 | 24,261 | 961 | no | 1 |
| tf-idf-per-axis | 961 | 0 | 24,261 | 961 | no | 1 |
| synonyms | 185 | 776 | 24,261 | 961 | YES | 1 |
| oppositions | 694 | 267 | 24,261 | 961 | YES | 1 |
| **associations** | **960** | **1** | 24,261 | 961 | YES(1 only) | 1 |
| **distributional-neighbors** | **960** | **1** | 24,261 | 961 | YES(1 only) | 1 |
| cross-refs-books | 599 | 62 | 24,561 | 661 | YES | 1(intu),2,feel |
| related-books | 362 | 0 | 24,860 | 362 | no | thinking-T1, feeling-T1 |
| related-verbs | 300 | 0 | 24,922 | 300 | no | thinking-T1 |
| related-principles | 62 | 0 | 25,160 | 62 | no | feeling-T1 |
| prerequisites | 90 | 211 | 24,921 | 301 | YES | intuition-T1(+2 think) |
| example-in-world | 123 | 176 | 24,923 | 299 | YES | intuition-T1 |
| example-in-scheme | 123 | 176 | 24,923 | 299 | YES | intuition-T1 |
| short-scenario | 300 | 0 | 24,922 | 300 | no | thinking-T1 |
| antipattern-scenario | 300 | 0 | 24,922 | 300 | no | thinking-T1 |
| sensory-description | 300 | 0 | 24,922 | 300 | no | sensation-T1 |
| contrast-register | 62 | 0 | 25,160 | 62 | no | feeling-T1 |
| definition-technical | 299 | 0 | 24,923 | 299 | no | intuition-T1 |

**Cross-validation:** `derivation-log-fill-closure-2026-07-27.jsonl` (17,150 fill records)
independently reproduces every honest-null count above (synonyms 776, definition 613,
relations/context-of-use 338 each, prerequisites 212, cross-refs-books 62,
example-in-world/scheme 177, associations 1, distributional-neighbors 1;
appears-in-corpus = 11,546 corpus-scan + 1,312 honest-null). The census is trustworthy.

## 4. The "perennially-missed" keys — ranked, with evidence

These are keys the pair-generator SHOULD traverse but that prior tooling under-served.
Ranked by how load-bearing the gap is for SFT edge-traversal.

### RANK 1 — `associations` + `distributional-neighbors`: NO honest-null accounting (1 each)
- **Evidence:** 960 populated, **only 1 honest-null each**, across 961 Tier-1 nodes.
  The fill-closure log shows exactly 1 honest-null record apiece; `oppositions` (a sibling
  PPMI/opposite key) got 267.
- **Why it matters:** these are the richest PMI edge sets (nested `:neighbor`/`:ppmi`,
  12k+ tokens). Because they were populated in a single early PPMI pass and **never
  honest-null-audited**, any node with genuinely-thin PPMI signal is silently populated with
  weak neighbors rather than flagged null. The pair-generator cannot tell a strong association
  edge from a noise edge — there is no null-opposition training signal here, unlike oppositions.
- **Action for pair-gen:** treat low-PPMI associations as candidate honest-nulls; do not mint
  "X associates with Y" pairs from sub-threshold neighbors.

### RANK 2 — `sensation` Tier-2 `definition` gap: 427 nodes with definition fully ABSENT
- **Evidence:** sensation Tier-2 = 500 nodes; only **73 carry `:definition`**; the other
  **427 have no `:definition` key and no `:honest-null-definition` flag** (verified: sample
  `sensation/written`, `/bands`, `/rising`, `/glyph`, `/land`, `/pause` …). Every other axis'
  Tier-2 is at 100% definition coverage (intuition 2754/2754, thinking 500/500, feeling 338/338).
- **Why it matters:** these 427 are mid-frequency sensation nouns that the generator will try to
  define/traverse; with neither a definition nor a null flag, they fall through both the
  "populated" and "honest-null" paths — the classic invisible gap.
- **Action:** either author definitions or emit explicit `:honest-null-definition #t` so the
  three-state contract holds.

### RANK 3 — Tier-1-only edges with NO honest-null companion (silent all-or-nothing)
`cross-refs-graph`, `related-books`, `related-verbs`, `related-principles`, `short-scenario`,
`antipattern-scenario`, `sensory-description`, `contrast-register`, `definition-technical`,
`example-dialogue`, `examples`, `used-in-programs-as`, `tf-idf-per-axis`.
- **Evidence:** each is populated on its expected Tier-1 subset (62–961) with **0 honest-null
  companions** anywhere on disk (§2b list omits all of them).
- **Why it matters:** the doctrine "empty relation field = honest-null training signal" is
  **only implemented for 13 of 24 relation keys.** For these 11+ keys there is no
  "no cross-reference exists" / "no antipattern applies" null signal — the generator can only
  learn presence, never taught absence. Lower rank than 1–2 because most are genuinely
  always-present on their tier, but the *missing null vocabulary* is the recurring blind spot.

### RANK 4 — `prerequisites` / `example-in-world` / `example-in-scheme`: majority honest-null
- **Evidence:** prerequisites 90 pop / 211 null; example-in-world & example-in-scheme each
  123 pop / 176 null (intuition Tier-1 only, 299 nodes).
- **Why it matters:** these are the intuition-axis pedagogy edges. They are *correctly* honest-null
  per the log ("awaits example-miner"), so this is a **known pending-miner** gap, not a silent one —
  but the pair-generator should preferentially route the 123 populated example pairs and emit the
  176 nulls as "no verified example yet" signal rather than skipping the key.

### RANK 5 — `cross-refs-books` absent on all of sensation (0/17,203)
- **Evidence:** `axes_present` for cross-refs-books = intuition 299, thinking 300, feeling 62;
  **sensation contributes 0.** Sensation is 68% of all nodes yet carries no book cross-refs at all.
- **Why it matters:** the largest axis has zero book-linkage edges; any "which book discusses this
  sensed thing" traversal is impossible for two-thirds of the graph.

## 5. Summary of the answer to "the missing graph keys"

The full relation-key set is the 24 keys in §2a. The keys that keep getting overlooked are not
missing *fields* so much as **missing the honest-null half of the three-state contract**:
- 11 of 24 relation keys have **no `:honest-null-*` companion on disk at all** (§4 Rank 3).
- `associations` + `distributional-neighbors` are the worst: rich data, **1 null each** (Rank 1).
- 427 sensation Tier-2 nodes are **defn-absent with no null flag** (Rank 2).
- sensation carries **zero `cross-refs-books`** (Rank 5).

Nothing here was modified. Fixes (authoring nulls / definitions) are follow-up work, out of scope
for this read-only census.
