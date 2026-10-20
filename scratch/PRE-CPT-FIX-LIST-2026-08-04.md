# Pre-CPT fix list — graphs + reference

Measured 2026-08-04 from disk. Every number below is re-runnable; commands included.

---

## 1. Reference — is the 15-program grid done?

**Essentially yes — 97.2%.** Only 45 verbs are short.

Authority is `node scratch/certify-reference.mjs`, which counts with Motoi's own
`src/reader.js`. **Do not use a regex for this** — see the warning below.

| | |
|---|---|
| verb records | 1,629 |
| program slots | 27,140 (real 26,928 + honest-null 212) |
| mean per verb | 16.66 |
| at spec (≥15) | **1,584 (97.2%)** |
| under 15 | **45** |
| **deficit to a strict 15/verb** | **344 programs** |

The distribution is over-filled, not under: 605 verbs at exactly 15, 560 at 18,
232 at 17. Two outliers at 123 and 189 slots.

### The 45, in two very different groups

**Group A — 24 verbs, deterministic and safely machine-gradable.**
`alg/permutation-cycles`, `alg/permutation-compose`, `topo/euler-characteristic`
(1 slot each); `real-part`, `imag-part`, `magnitude`, `angle`,
`make-rectangular`, `make-polar` (3 each); `pi`, `ceil`, `sign`, `clamp`,
`round2`, `lerp`, `dist`, `atan2`, `exp2`, `log2`, `log10`, `argmin`,
`exact-rational?`, `=?`, `rng-uniform` (3 each).

**Group B — 21 verbs that are NOT safely machine-gradable.** They need a live
world, frames, or input, so "it ran" does not mean "it is right" — the exact
proxy that produced the silent-wrong class before:
`on-collision`, `input/buttons`, `input/down?`, `input/may-i?`,
`input/pressed?`, `input/set!`, `time/across`, `time/now`, `time/every-ms`,
`time/when`, `time/from-ms`, `time/to-ms`, `world/tape-lcamera`,
`world/running?`, `world/stop`, `world/start`, `world/state`, `stop`,
`to-draw`, `escalate`, `with-input-from-string`.

### Two counters disagree — trust the reader one

- `scratch/certify-reference.mjs` (reader-based) — **authoritative**: mean 16.66,
  45 under. It walks the parsed form recursively and counts `composition` keys.
- `scratch/count-verb-programs.py` (regex) — **broken, do not quote**: its slot
  pattern `:([a-z][a-z0-9-]*?(?:code|program))` requires a letter before `code`,
  so plain `:code` never matches. Prints mean 5.5, "0 at spec".
- A hand-written flat regex also under-reports (mean 13.0, "3,396 deficit") because
  it misses nested and `composition` slots. Same trap.

3 duplicate record names: `jiffies-per-second`, `current-jiffy`, `current-second`.

---

## 2. Reference — is every verb documented?

**No — 212 bound verbs have no record.**

| | |
|---|---|
| bound in the live engine | 1,867 |
| documented | 1,657 |
| **undocumented** | **212** (108 plain, 98 namespaced, 6 internal `_`) |
| **documented but NOT bound** | **2** |

### 2a. The 2 dead records — fix before fold

`sprite` and `sprites` have full records in `scheme/reference/01-core.slat:2818`
and `:2857`, but the engine does not bind them:

```
$ printf '(display (procedure? sprite))' > /tmp/spr.scm
$ MOTOI_HOME=/tmp/mx ./bin/motoi run /tmp/spr.scm
error: unbound symbol: sprite
```

These teach a verb that does not exist. Either bind them or archive the records.

### 2b. The 108 plain undocumented

Includes the two known cart gaps (`assoc-ref`, `format`). Bulk is SRFI-1
destructive variants (`append!`, `filter!`, `reverse!`, `lset-*!`), SRFI-133
vector ops (`vector-fold`, `vector-index`, `vector-unfold`, …), R7RS file ports
(`open-input-file`, `with-output-to-file`, `call-with-port`, …), and
`environment` / `scheme-report-environment` / `load` / `exit`.

Full list: `python3 -c` diff of `/tmp/bound.txt` vs `/tmp/documented.txt`
(regenerate both — see §4).

---

## 3. Graphs — do they need fixes before the fold?

**Two real defects, both worth fixing. The rest is thin-but-honest.**

25,218 nodes parse cleanly via `scripts/sft-prep/isb-sft/extractors/graph.py`:

| axis | nodes | share |
|---|---|---|
| sensation | 17,215 | 68.3% |
| intuition | 6,227 | 24.7% |
| thinking | 1,101 | 4.4% |
| **feeling** | **675** | **2.7%** |

### 3a. DEFECT — template-locked slots asserting false claims

Enrichment is capped at ~300 nodes per axis (~964 total, 3.8% of nodes). Of the
slots that *are* filled, most are one template with the word swapped in:

| axis | slot | filled | distinct | top template covers |
|---|---|---|---|---|
| sensation | oppositions | 305 | 29 | **226 (74.1%)** |
| sensation | used-in-programs-as | 312 | 27 | **227 (72.8%)** |
| sensation | example-dialogue | 312 | 40 | **225 (72.1%)** |
| intuition | used-in-programs-as | 285 | 13 | 180 (63.2%) |
| thinking | used-in-programs-as | 301 | 7 | **294 (97.7%)** |
| thinking | example-dialogue | 301 | 11 | **276 (91.7%)** |
| feeling | all three | 62 | 62 | 1 (1.6%) — clean, hand-authored |

The sensation template is not merely repetitive, it is **wrong**. All 227 nodes
claim the same three uses:

```
used-in-programs-as = ("an item the player can pick up and use"
                       "a symbol on the tile-palette"
                       "an entity registered in the world with (reg...")
oppositions         = ("absence" "empty-space" "no-thing")
example-dialogue    = child: "Should I make a <WORD> pickable?"
```

Applied verbatim to `sensation/synth`, `sensation/pad`, `sensation/instrument`.
A synth is not a pickable item. This is the fabrication class landing in the
largest substrate in the CPT.

Also 49 nodes carry an a/an templating bug — "Should I make a instrument
pickable?".

### 3b. DEFECT — the Feeling axis is starved

675 nodes, of which only 62 (9.2%) carry *any* content — including definitions.
613 feeling nodes are bare tokens. Feeling yields ~304 CPT records = **0.17% of
the corpus**, against sensation's ~49,379.

Feeling is the axis the previous generation regressed on. Shipping it at 0.17%
repeats that. The 62 authored feeling nodes are the *highest-quality* material
in the whole graph (100% distinct, no templates) — the problem is volume, not
craft.

### 3c. Not a defect — noted so nobody re-raises it

- 62 feeling nodes have a stray bare token `pending` after
  `:distributional-neighbors (...)` in the source. The extractor is regex-based
  and ignores it; it never reaches emitted text. Cosmetic only.
- 14,703 sensation nodes (85%) have no `:definition`. They still carry freq /
  tf-idf / associations / cross-refs, which is what the N-shapes emit from.
  Thin, but not false.
- Graphs are nearly code-free — 27 `:code`/`:program` slots in 25,218 nodes. So
  the stale-wrong risk that hit the carts does **not** apply here.

---

## 3.5. Local-model fill — pilot result (Qwen3-Coder-30B, $0)

Driver: `scratch/fill-reference-slots.py`. Model proposes, `./bin/motoi run`
grades, every program run **twice** for determinism, and the `:note` is written
from captured stdout — never from the model's claim. Writes to a staging JSONL;
nothing touches `scheme/reference/`.

**Pilot 1 (3 verbs, correctness gate only): 12 kept, 0 dropped.** I hand-checked
all 12 — the maths is right. But a 100% pass rate was the tell: three
`permutation-compose` examples all printed `(2 1 0)` (two were trivial identity
compositions), `real-part 7` and `real-part 10` taught the same thing twice, and
one printed an empty `()`. **A run-only gate cannot see redundancy.** This is the
same proxy failure as before, in miniature.

**Pilot 2 (quality gate added — reject degenerate + duplicate outputs): 9 kept,
6 dropped.** Yield collapses on simple verbs: `real-part` produced only 2 usable
distinct programs out of 5 attempts.

### The finding that matters — I was generating the wrong shape

The missing slots are **not one-liners**. Looking at a complete record
(`sqrt` in `40-math.slat`), each of rows 2–5 is:

```
:row-N-... ( :eng-program   <multi-line program>
             :math-program  <multi-line program>
             :cs-program    <multi-line program>
             :problem       <paragraph weighing 2-3 candidate approaches
                             and saying which is right and WHY>
             :explanation   <per-domain gloss> )
```

So the real unit of work is a row, not a program.

**Where the local model can and cannot go:**

- **CAN**: the three domain programs per row. The interpreter grades them
  end-to-end, so a wrong one dies.
- **CANNOT, unsupervised**: the `:problem` paragraphs. They are comparative
  judgement — "squaring the limit is the sharper tool when only the comparison
  matters." Nothing in the toolchain can falsify that sentence. A local model
  will produce fluent, plausible, and occasionally wrong tradeoff claims, and
  they will read as authoritative. For a manual being sold, this is the part
  carrying the value.

**Recommendation:** let Qwen fill programs behind the interpreter gate; hold the
`:problem` prose for Alfred or a paid authoring pass. Decision is Alfred's.

---

## 4. Re-run commands

```sh
cd ~/code/motoi-scheme

# bound verbs
node --input-type=module -e '
import { makeExtendedBaseEnv } from "./src/lib-loader.js"; import fs from "node:fs"
const env = await makeExtendedBaseEnv()
const n = env.vars?.keys ? [...env.vars.keys()] : [...env.keys()]
fs.writeFileSync("/tmp/bound.txt", n.sort().join("\n")+"\n")'

# graph census
PYTHONPATH=scripts/sft-prep/isb-sft/extractors python3 -c '
import graph as g, collections
print(collections.Counter(n["axis"] for n in g.iter_all_nodes()))'
```

Note: `comm` on these two lists produced garbage (items appearing in *both*
directions). Use Python sets, not `comm`.

---

## 5. Ordered fix list before re-emit

1. Bind or archive `sprite` / `sprites` — 2 dead reference records.
2. De-template the 227 sensation nodes, or drop those three slots for the
   templated set. Dropping is safe; keeping is fabrication.
3. Fix the 49 a/an dialogue strings.
4. Decide Feeling: author more nodes, or accept 0.17% and say so out loud.
5. Dedupe the 3 duplicate verb records.
6. 344 programs across 45 verbs (Group A safe to generate, Group B is not).
7. (The big one) 212 undocumented verbs — ~15 slots each, ~3,180 programs.
