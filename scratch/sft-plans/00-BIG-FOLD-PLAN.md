# 00 — THE BIG FOLD PLAN (Motoi SFT)

**Author:** Lacuna engineering
**Date:** 2026-07-29
**Repo:** `/Users/alfred/code/motoi-scheme` (`Lacuna-Labs/motoi-scheme`)
**Status:** DESIGN + FOLD-PREP. No fold fired. Task #418.
**Scope:** MOTOI ONLY. (Sakura mirrors later; Curator automations OUT of scope.)

---

## 0. THE DOCTRINE THAT GOVERNS THIS WHOLE DOCUMENT

> **WE ONLY ADD. WE NEVER PRUNE.** (Alfred, 2026-07-29, emphatic.)

The fold is in the MILLIONS. On context-loss the instinct is to fall back to
"standard SFT" = a small curated LoRa sample and to quietly SHRINK millions to
"~1.2M." That is the failure mode this document exists to prevent. Every sizing
here is **read from the walk docs + `fold-sizing-record.md`**, never derived from
memory. Balance = **ADD to the thin side, never trim the thick side.** Remove a
cap only when the science says we were too conservative; never to "right-size
down." Target expectation: **~5M**, and the honest grounded floor today is
**~3.0M** with several flagged multipliers (word-book span census, graph
governor, per-layer book explosion) still pointing UP toward 5M.

Companion memory: `feedback_only_add_never_prune_the_fold.md`.

---

## 1. EXECUTIVE SUMMARY — where the numbers stand

Grounded yield model = `forge/forge/corpus/motoi_sft/assess.py` (canonical) and
`scratch/fold-sizing-record.md` (per-lane, every base traced to a disk command).
Both now agree.

| # | Lane | Base (on disk) | Yield (grounded HIGH) | ≥1M? |
|---|------|----------------|------------------------|------|
| 1 | Reference manual (+ copilot depth R10) | 19,326 runnable seeds | **~1.32M** | ✅ |
| 3 | Graphs (4 Jung axes) | 25,222 nodes | **~1.14M** | ✅ |
| 4a | Scheme books — narrative prose | 918–1,097 units | ~0.24M | |
| 4b | Scheme books — FENCED RUNNABLE CODE | 9,156 blocks | ~0.19M | |
| 5 | Word books (world-substrate) | 50 ch (→ per-SPAN, NEEDS-ALFRED) | ~0.10M+ | |
| 2 | Broken code | 3,024 artifacts | ~0.035M | |
| 8 | Music composer (M1–M10) | 72 units | ~0.012M | |
| 9 | Animation composer (A1–A10) | 77 units | ~0.012M | |
| 6 | Engineering / self-knowledge | 19 files + 32 introspection | ~0.002M | |
| 7 | Native carts (DEFERRED) | 25 carts | ~0.002M | |
| | **HEADLINE (grounded HIGH)** | | **~3.04M** | |

**Two lanes each exceed 1M** (Reference, Graphs) — exactly as Alfred said.

**The path from 3.0M → ~5M is NOT invented volume; it is three flagged, honest
multipliers that raise the BASE, not the density:**
1. **Word-books per-SPAN base** (§7.1) — true yield-bearing unit is the lensable
   span (~48/chapter), not the 50 chapters. Grounds a ~40–50× base lift.
2. **Graph governor curve** (§6) — HIGH swings 0.7M–1.5M on the tone×paraphrase
   tail governor, which is not yet numerically fixed.
3. **Per-layer scheme-book explosion** (§7.2) — some books have 4–5 layers per
   section; each layer is its own pass. The 4a/4b lane is currently single-layer.

None of these are prunable. All three are additive once grounded.

---

## 2. THE LANES — what each teaches (pointers, not re-derivation)

Each lane has an authoritative walk doc in `scratch/sft-plans/`. This plan does
NOT restate them; it points and sizes.

- **01 Reference** — `01-reference-manual/01-reference-walk.md`. R1–R9 + **R10
  copilot depth**. The body of the work. 19,326 runnable seeds × the disciplined
  overlay (eng/cs/math proper-lens, NOT 6×16 which phrase-locks) + the module
  Q&A NEST (R8 ~380K) + feeling (R9 ~120K).
- **02 Broken code** — `02-broken-code-errors/02-broken-code-walk.md`. 15
  families A–O; a DEBUGGER, not a lookup table.
- **03 Graphs** — `03-graphs-deep-design.md`. Edge-traversal × tone × philosopher
  lens × honest-null. See §6 for the KEY set.
- **04 Scheme books** — `04-scheme-books/`. 4a prose + **4b fenced runnable code**
  (was measured-but-never-multiplied). Per-layer, section-by-section (§7.2).
- **05 Word books** — world-substrate. Lane A verbal-correlation / Lane B
  bridge-to-code / Lane C draw-from-math. Per-SPAN, not per-chapter (§7.1).
- **06 Engineering / self-knowledge** — `06-engineering-self-knowledge-walk.md`.
  SELECTIVE, shallow-by-design + Book of Introspection volume family.
- **07 Native carts** — `07-native-carts-walk.md`. Game composer; DEFERRED.
- **08 Music / 09 Animation** — `08-music-composer/`, `09-animation-composer/`.
  Full lane-#7 machinery domain-swapped (M1–M10 / A1–A10), dialogue-heavy.
- **R10 Copilot** — folded INTO Reference depth (not standalone). Module on disk:
  `motoi-copilot/src/` (11 files). 4 edit shapes × {positive, gate-caught
  negative}. NOTE: the verb-gap census found copilot & composer have **NO
  undocumented verbs** — the 8 `copilot/*` + 42 composer verbs are already in the
  manual. The real doc gap is 88 OTHER wired verbs (§7.5).

---

## 3. CPT — THE MISSING TRAINING STEP (do NOT skip)

Alfred: *"You mentioned the CPT, and we're missing that."* The full pipeline is
**CPT → SFT**, and this plan owns BOTH. SFT dialogue teaches situated behavior;
CPT is where the **nouns and facts ground** (Mk3 probe proved facts attach across
all 4 Jung axes during CPT even when greedy generation misleads —
`project_motoi_mk3_cpt_v2_ready.md`).

**The problem:** Mk3 CPT (best val 0.338@8000) predates the AUGMENTED substrate
this plan produces:
- new reference verbs (copilot + composer, §5 of the verb-gap doc),
- the **shapes-teaching material** (§4 — must be in the CPT substrate too),
- fully-authored word books + composer books,
- the 9,156 fenced book-code blocks as first-class runnable ground.

**Recommendation (needs-alfred to pick the variant):**
- **CPT top-up (Mk3.5):** continue from the Mk3 adapter over ONLY the new/changed
  substrate. Cheaper, preserves the good Mk3 val curve. Risk: substrate skew.
- **Fresh Mk4 CPT:** re-CPT from base over the full augmented corpus. Cleaner
  fact-grounding; more compute. Recommended if the augmentation is large (it is).

**CPT invariants (carry from Mk3):**
- MLX BPE-packing gotchas (`reference_mlx_bpe_packing_gotchas.md`): true-BPE
  packer sized to max_seq; dedicated `train.jsonl` filename; no `-packed` suffix.
- Checkpoint hygiene: `save_steps=2000, save_total_limit=3, save_only_model=true`
  (disk pressure).
- MeCo-prefixed CPT data from graphs (the Mk3 method) still applies.
- Probe with the loss-based fact probe, NOT greedy keyword-hit.

**CPT ⟂ SFT boundary:** the shapes material goes in BOTH — CPT gets the
*declarative* "what a decompose-shape IS" (noun-ground); SFT gets the
*performed* shape (situated pair). Without the CPT half, the SFT shapes have no
grounded referent; without the SFT half, "it won't know how to DO shapes."

---

## 4. SHAPES-TRAINING — teach the model the SHAPES themselves

> Alfred: *"we also need to do some training on shapes… you're gonna add this
> stuff to the reference, and you're gonna add the material to the books. Please
> don't forget. Also, motherfucker won't know how to do shapes, and all this work
> I did will be for naught."*

The pair-SHAPES (R1 identity-grid, R2 run-explain, R3 decompose-label, R4
build-up-ladder, R5 reversal, R6 comp-vocab, … the copilot edit shapes, the
graph edge-traversal shapes, the composer M/A families) are not just an authoring
convention — they must be **explicitly taught to the model as first-class
content**, or the model can't reproduce them at inference.

**Two placements (task #438):**
1. **Into the REFERENCE** — a "Shapes" chapter (or appendix) in
   `scheme/reference/` that NAMES each shape, shows a worked instance, and states
   when to use it. This makes shapes part of "the reference IS the language."
2. **Into the BOOKS** — a shapes-pedagogy pass woven into the scheme books (esp.
   the CS-curriculum book) that teaches shape-recognition and shape-production as
   a skill (observe → which shape → produce it), abductively.

Both land in the CPT substrate (declarative) AND seed SFT pairs (performed).
This is a hard dependency for the fold to be worth anything — flagged as a
**Step-1 fold-certainty check** (§11).

**OWNER + SCOPE (satisfies the Step-1e gate = "scheduled with an owner"):**
- **Owner:** a dedicated full-context authoring lane (NOT a parallel-template
  batch — shapes pedagogy is judgment-heavy; phrase-lock doctrine applies).
- **Shape roster the material MUST name and teach** (the union across lanes):
  Reference R1–R9 (identity-grid · run-explain · decompose-label · build-up-ladder
  · reversal · comp-vocab · Bloom×philosopher · module-Q&A · feeling); Debugger
  A–O (15 families); Copilot 4 edit shapes × {offerable, rejected}; Graph
  edge-traversal shapes (24-key × register × philosopher-lens, honest-null
  included); Native-cart C1–C10; Composer M1–M10 / A1–A10; Word-book lens 0/1/2.
- **Reference deliverable:** `scheme/reference/` gains a "Shapes" chapter/appendix
  — each shape NAMED, one worked runnable instance (`./bin/motoi run` clean),
  a when-to-use line. Authored to the same 15-grid runnability rule where code.
- **Books deliverable:** a shapes-recognition→production pass woven into the
  CS-curriculum book (§14) primarily, abductive (observe → which shape → produce).
- **Sequencing:** this authoring runs in the EXECUTION phase (after Alfred blesses
  this plan); it is the #1 execution item, gating the fold. Tracked as task #438.

---

## 5. THE VARIETY ENGINE — anti phrase-lock

**Risk:** parallel-template authoring with a swapped variable = deterministic
phrase-lock = "nonsense" (`feedback_parallel_templates_cause_phrase_lock`).

**Verdict (research → `research-variety-phraselock.md`): there is NO purely
deterministic path to real variety at millions-scale.** Deterministic tricks
(template banks, synonym swap, syntactic-control paraphrase, back-translation)
buy cheap reproducible *surface* variety but plateau fast and still read
machine-stamped. Genuine framing/register variety — what "proper lens" demands —
needs a generative model in the loop.

**Recommended hybrid variety engine:**
- **~70% offline open-weights LLM rewrite lane** (MLX-local, runs on the Mac)
  using **Verbalized Sampling** (arXiv:2510.01171 — ask for k rewrites with
  probabilities, sample from that; 2–3× diversity, counters the alignment
  typicality bias that CAUSES phrase-lock).
- **~20% deterministic structural scatter** layered underneath (sentence-order,
  connective, framing-slot permutation).
- **~10% full-context Claude "high cool" lanes** reserved for load-bearing
  authoring: R4 build-ladders, C9 keystone dialogues, §31 contrastive lemmas,
  identity/safety pairs.
- **Avoid persona-engineering** — the study (arXiv:2505.17390) found personas
  gave negligible diversity gains; word-count constraints beat them. Don't waste
  budget there.

**HARD diversity GATE (measured, never assumed), computed PER FACT-CLUSTER (not
corpus-wide):** Self-BLEU ≤ 0.30–0.35 · Distinct-2 ≥ 0.6 · gzip compression
ratio ≤ 0.65 · BERTScore self-similarity ≤ ~0.75 (0.79 was the documented
phrase-lock failure watermark). Tooling: the `diversity` PyPI package
(arXiv:2403.00553). Any cluster over threshold is hard-failed and re-authored.
This gate is §11 Step 5.

---

## 6. GRAPH KEYS — the complete traversal set

The perennially-missed graph keys are the single most-repeated data gap. The
graph SFT generator must traverse the COMPLETE key set, treating empty fields as
honest-null signal (not absence). Grounded census in `graph-keys-audit.md`
(read-only, cross-validated against the 17,150-record fill-closure log).

### 6.1 Where the graph nodes live (source of truth)
`graphs/*.slat` — one graph per Jung axis: `graph-of-sensation.slat` (17,203
nodes) · `graph-of-intuition.slat` (6,244) · `graph-of-thinking.slat` (1,100) ·
`graph-of-feeling.slat` (675). **Total 25,222 nodes**, tiered per `MANIFEST.slat`:
Tier-1 full-facet 961 · Tier-2 lightweight 4,092 · Tier-3 stub 20,169. NOT under
`words/` (empty). `.forge/corpus/` holds DERIVED substrates, not source nodes.

### 6.2 The complete 24-key relation set (what the generator traverses)
`synonyms · oppositions · associations · distributional-neighbors ·
cross-refs-graph · cross-refs-books · related-books · related-verbs ·
related-principles · appears-in-corpus · surrounding-words · relations ·
context-of-use · prerequisites · example-dialogue · examples ·
used-in-programs-as · example-in-world · example-in-scheme · short-scenario ·
antipattern-scenario · sensory-description · contrast-register · tf-idf-per-axis`
(+ scalar/nested keys the generator must DESCEND into: `:neighbor/:ppmi`,
`:speaker/:line/:child/:motoi`, `:ref-graph/:ref-id/:ref-file/:ref-verb`,
`:book/:chapter/:excerpt`, `:axis/:peak-weight/:secondary`). Tier governs which
keys a node is EXPECTED to carry — rich-key absence on a Tier-3 stub is by design.

### 6.3 THE PERENNIALLY-MISSED KEYS = the honest-null HALF (the actual finding)
The keys that keep getting overlooked are not missing FIELDS — they are missing
the **honest-null half of the three-state contract**. Only **13 of 24 relation
keys** have any `:honest-null-*` companion on disk. The generator can learn
presence for the other 11 but was **never taught their absence**. Ranked:

- **RANK 1 — `associations` + `distributional-neighbors`: 960 populated, only 1
  honest-null each.** Richest PMI edge sets, filled in one early pass, never
  null-audited. A node with genuinely-thin PPMI signal is silently populated with
  weak neighbors instead of flagged null. **Pair-gen action:** treat sub-threshold
  PPMI as candidate honest-null; do NOT mint "X associates with Y" from noise edges.
- **RANK 2 — 427 sensation Tier-2 nodes have `:definition` fully ABSENT** (no
  key, no null flag). Sensation T2 = 500 nodes, only 73 carry a definition; every
  other axis' T2 is 100% covered. These fall through BOTH populated and honest-null
  paths — the classic invisible gap. **Action:** author or emit
  `:honest-null-definition #t` so the three-state contract holds.
- **RANK 3 — 11 Tier-1 edges with NO honest-null companion at all**
  (`cross-refs-graph`, `related-books/verbs/principles`, `short-scenario`,
  `antipattern-scenario`, `sensory-description`, `contrast-register`,
  `definition-technical`, `example-dialogue`, `examples`, `used-in-programs-as`,
  `tf-idf-per-axis`): all-or-nothing, no "no X applies" signal.
- **RANK 4 — `prerequisites` / `example-in-world` / `example-in-scheme`:** majority
  honest-null (intuition-T1), correctly flagged "awaits example-miner" — a KNOWN
  pending gap, not silent. Route the ~123 populated, emit the ~176 nulls.
- **RANK 5 — `cross-refs-books` absent on ALL of sensation (0/17,203).** The
  largest axis (68% of nodes) carries zero book-linkage edges.

### 6.4 Honest-null companions that DO exist (13 keys, the working half)
`surrounding-words` (1597) · `appears-in-corpus` (1312) · `synonyms` (776) ·
`definition` (613) · `relations` (338) · `context-of-use` (338) ·
`oppositions` (267) · `prerequisites` (212) · `example-in-world` (177) ·
`example-in-scheme` (177) · `cross-refs-books` (62) · `distributional-neighbors`
(1) · `associations` (1). These are the model for the missing 11.

**Fold requirement:** the graph pair-generator MUST (a) traverse all 24 keys,
(b) emit honest-null "I-don't-know / no-X-exists" pairs from populated null
companions, (c) treat RANK-1 sub-threshold PPMI as candidate-null, (d) NOT invent
data for the RANK-2/3 silent gaps — author the null flag or skip, never fabricate.
Authoring the missing nulls (Ranks 1–3) is ADD-only follow-up work, out of scope
for the read-only census but IN scope for the fold's honest-null completeness.

---

## 7. MISSING DATA + WHERE TO SOURCE IT

### 7.1 Word-books per-SPAN base (biggest additive lever)
True yield unit = the lensable SPAN within a chapter (~48/chapter observed), not
the 50 chapters. A span census multiplies the BASE ~40–50×. **Source:** count
spans on disk in `word-books/book-of-words/*.book.slatl` (deferred to a grounded
census, not fabricated). Until counted, density carries the breadth; flagged
NEEDS-ALFRED in `assess.py`.

### 7.2 Per-layer scheme-book explosion
Books are NOT one flat pass — some have 4–5 layers per section (section × layer),
each its own authoring pass, delegated per-book/per-layer to the local
engineering team. **Source:** a layer census per book (`scheme-books/**`). The
4a/4b lane is currently single-layer; per-layer raises it.

### 7.3 Drawing-primitives object catalog (Lane 5 / 05b)
EMERGENT, not enumerated. ~50–150 objects seeded × draw-pairs. **Source:** the
drawing-primitives research doc + the SD 320×240 primitive contract; author the
object seeds, render-grade each. Un-grounded until the catalog is authored.

### 7.4 `carts/spacewar.sks` flagship
NAMED in the walk doc, not on disk. **Source:** author it; must `./bin/motoi run`.
Value is flagship-quality, not volume.

### 7.5 Verb gap — the REAL gap is 88 verbs, NOT copilot/composer
Grounded against the LIVE env (`makeExtendedBaseEnv()`, the copilot oracle's own
path) in `reference-rules-and-verb-gap.md`: **1,659 bindings / 1,077 namespaced
verbs**; reference documents **1,179 names**; **183 wired-but-undocumented**.
- **Copilot: NO gap.** `motoi-copilot/src` registers ZERO Scheme verbs (it
  consumes the registry). The 8 engine-wired `copilot/*` verbs all run clean and
  are already in `02-ai.slat`. My earlier premise was wrong — corrected here.
- **Composer: NO gap.** All 42 wired `part/motion/note/synth` verbs are documented
  (48/42/43/62). (`motion/music` is a grep artifact — unbound, correctly absent.)
- **REAL gap = 88 verbs in 14 EXISTING chapters** (alg 28 · topo 23 · artifact 10
  · cortex 5 · entity 4 · matrix 4 · animation 3 · world 3 · easing 2 · text 2 ·
  ai 1 · sprite 1 · floor 1 · transport 1) — each spot-run-checked WIRED. These
  need the full 15-program grid authored (§4 reference rules).
- **NEEDS-ALFRED:** 5 R7RS-core names (`/`, `call/cc`, `floor/`, `truncate/`,
  `hash-table-update!/default`) need a chapter-placement ruling; **89 verbs in
  no-chapter namespaces** (motoi/composer/book/completions/http/fb/color/voice/
  song…) are host/IDE/tooling surfaces needing a scope decision. `flower/paint` is
  downstream — correctly excluded. → §13 decisions.

**Reference rules (the authoring contract, from `00-intro.slat` §13a):** every
verb carries EXACTLY **15 runnable programs = 5 rows × 3 disciplines**. Rows:
1 HOW (1/3/5 module ladder) · 2 WHEN (audit) · 3 WHERE-ELSE (dimension) ·
4 WHY (proof) · 5 WITH-WHAT-ELSE (emergence). Slot keys `:row-1-composition` …
`:row-5-emergence`; runnable keys = `:code`/`:program`/`:composition`/
`*-program`/`*-composition`; honest-null convention (blank = incomplete,
not-applicable = considered); every block `echo '<expr>' | ./bin/motoi run
/dev/stdin` clean. Feeds R1/R2 seeds AND the shapes material.

### 7.6 Reference honest-null seeds (114)
`REF_HONEST_NULL=114` program-key nulls — mint "I-don't-know" pairs. Tiny but a
real un-consumed substrate; give it a yield line.

---

## 8. BALANCE PLAN — ADD to thin, never trim thick

Balance is audited (task #440, balance agent) across: per-lane, per-Bloom-level
(remember→create, target each 13–19% as the Mk2 ISB fold achieved),
per-philosopher (all 16 active), per-register (kid-seed / layperson / PhD), and
per-axis (the 4 Jung axes; Feeling + Sensation are the ones that REGRESSED in Mk2
CPT — over-weight them). **Rule:** any imbalance is corrected by AUTHORING MORE on
the thin side. No lane's yield is ever reduced to "balance." Over-include first,
measure, scale back only post-fold.

---

## 9. WHERE THE FOLD GOES — output, format, tagging

- **Output corpus:** `~/.forge/corpus/motoi-sft-v3/` (train.jsonl / valid.jsonl),
  mirroring the Mk2 ISB layout (`project_isb_sft_pipeline_ready`).
- **Record format:** every fold record carries the full tag set —
  `:doc :section :audience :dialect :provenance :training-eligible
  :confidentiality` + shape tag + Bloom tag + philosopher tag + graph keys where
  applicable. Tag audit = task #437 → `tag-audit.md`.
- **Grading:** every Scheme code block is interpreter-graded via
  `./bin/motoi run /dev/stdin` at author time AND at fold-verify time. Blocks that
  must error (R5 broken↔fixed) are marked expected-error.
- **Secret-sauce holdback:** the SFT/weave method + training recipe stay OUT of
  Motoi's own corpus (`project_sft_overinclude_and_secret_sauce_holdback`).
- **Scrub wall:** only surviving name = "Built by Alfred Borden."

---

## 10. HOW THE FOLD RUNS — pipeline

1. Author per-lane pairs (full-context lanes for judgment; grab-don't-generate;
   proper-lens; variety-gated).
2. Interpreter-grade every code block; route failures to `broken-examples/`
   (they become teaching signal — `feedback_keep_broken_lane_output`).
3. Tag every record (§9); validate tags (task #437).
4. Variety-gate every lane (§5 metric threshold).
5. Balance-audit + top-up thin lanes (§8).
6. Merge lanes → shuffle → BPE-pack (MLX gotchas) → train/valid split.
7. CPT top-up/Mk4 over augmented substrate (§3), THEN fire SFT.
8. Probe with loss-based fact probe + human sift (50–100 items).

### 10.1 Grader requirements (proven by the shapes-0–5 prototype, 29/29 PASS)
The prototype (`prototype-shapes-0-5-report.md`) surfaced 5 things the fold's
grader MUST handle — "exit 0 = pass" is NOT sufficient:
1. **Expected-error blocks are load-bearing.** R5 broken↔fixed + error-card pairs
   MUST carry a per-block `expected-outcome` flag (ok | error | error-matching
   `<pattern>`); the grader checks against it, not against exit code.
2. **Value blocks must end in `display` + newline.** A bare `(define …)` prints
   nothing — the grader can't see the value. Author every value-demonstrating
   block to emit its result.
3. **Code carries quotes/newlines.** The harness base64-passes each block to
   `./bin/motoi run` so quoting/escaping can't corrupt it.
4. **Standard-name discipline is free-enforced.** `fold-left`/`foldl`/`foldr` are
   genuinely unbound — a block using them errors, which is correct teaching signal.
5. **SRFI-1 `fold` order surprises** (`(f elem acc)`, not acc-first). Add a
   trace-vs-output lint so fold-order pairs are authored correctly.

---

## 11. THE BIG TEST PLAN — enumerated steps (Step 1 = fold-certainty checks)

> Records for every step land in `scratch/sft-plans/`. This is the execution
> spine. Each step has an EXIT GATE; do not proceed until it's green.

**STEP 1 — FOLD-CERTAINTY CHECKS (do these FIRST).**
- 1a. `assess.py` runs and prints a headline in the MILLIONS (≥3.0M). ✅ (3.04M).
- 1b. Every base count in `fold-sizing-record.md` re-traces to its recorded
  disk command. ✅ Spot-checked live 2026-07-29: graph nodes
  675+1,100+6,244+17,203 = **25,222** (matches graph-keys audit); BOOK_CODE
  fenced ```scheme/```lisp = **9,258**; reference `:code` keys = **7,268**.
- 1c. Prototype shapes 0–5 exist and **100% of their code blocks
  `./bin/motoi run` clean — DONE: 29/29 blocks PASS** (verbs fold/filter/iota
  grabbed from `scheme/reference/39-list.slat`; task #436 →
  `prototype-shapes-0-5-report.md`). The 5 grader gotchas it surfaced are now
  hard requirements in §10.1.
- 1d. The interpreter itself is healthy: `echo '(+ 1 2)' | ./bin/motoi run
  /dev/stdin` → `3`. ✅ Confirmed live 2026-07-29.
- 1e. Shapes-training material exists in BOTH reference and books (§4) — or is
  explicitly scheduled with an owner. **Hard gate: the fold is "for naught"
  without it.**
- **EXIT GATE:** all of 1a–1e green.

**STEP 2 — SUBSTRATE COMPLETENESS.**
- 2a. Graph keys audit complete; the complete key set enumerated; the generator
  wired to traverse ALL keys incl. the perennially-missed ones (`graph-keys-audit.md`).
- 2b. The **88 real wired-but-undocumented verbs** (14 existing chapters; NOT
  copilot/composer — those have no gap) authored to the 15-program grid per the
  reference rules (`reference-rules-and-verb-gap.md`); each new example
  `./bin/motoi run` clean. Alfred rulings on the 5 R7RS-core names + 89
  no-chapter host/IDE verbs precede authoring (§13).
- 2c. `BOOK_CODE` 9,156 blocks confirmed enumerable and runnable-sampled.
- 2d. Word-book span census done (or explicitly deferred with owner).
- **EXIT GATE:** no substrate falls through (cross-check §7 list = all owned).

**STEP 3 — TAGGING INTEGRITY.**
- 3a. Tag audit (`tag-audit.md`): every record type carries the full tag set.
- 3b. Sample 200 records across lanes; 100% tag-complete.
- **EXIT GATE:** tag schema validated, zero untagged fields.

**STEP 4 — RUNNABILITY (interpreter-graded).**
- 4a. Fold-verify harness runs EVERY code block in the fold through
  `./bin/motoi run`; expected-errors marked; PASS tally = 100% of
  must-run blocks.
- **EXIT GATE:** zero unexpected runtime failures in the fold.

**STEP 5 — VARIETY (anti phrase-lock).**
- 5a. Each lane's text passes the chosen diversity metric ≥ threshold
  (`research-variety-phraselock.md`).
- 5b. Spot human-read 50 pairs/lane for phrase-lock.
- **EXIT GATE:** all lanes above threshold.

**STEP 6 — BALANCE.**
- 6a. Balance audit across lane/Bloom/philosopher/register/axis (§8).
- 6b. Thin lanes topped up (ADD-only).
- **EXIT GATE:** distributions within target bands; no lane trimmed.

**STEP 7 — PACK + SPLIT.**
- 7a. BPE-pack with the true-BPE packer (MLX gotchas verified: filename, no
  `-packed` suffix, max_seq sizing).
- 7b. Train/valid split; leakage check (held-out carts/scenes never in train).
- **EXIT GATE:** pack token-count sane; no train/valid leakage.

**STEP 8 — CPT.**
- 8a. CPT top-up/Mk4 over augmented substrate (§3); probe loss-based.
- **EXIT GATE:** fact probe shows grounding on new substrate; val healthy.

**STEP 9 — SFT FIRE.**
- 9a. Fire the SFT fold on the CPT'd adapter.
- 9b. Probe + human sift (50–100 items).
- **EXIT GATE:** ship-gate metrics + Alfred sign-off.

**STEP 10 — AUDIT.**
- 10a. A SEPARATE audit instance audits ALL of the above (assess.py edits, plan,
  prototypes, tests, tag audit, reference authoring, balance).
- 10b. Ping Alfred.

---

## 12. RECORDS INDEX (this directory)

- `00-BIG-FOLD-PLAN.md` — THIS FILE (master).
- `fold-sizing-record.md` — per-lane grounded sizing (every base = a disk command).
- `research-variety-phraselock.md` — variety engine research [agent].
- `graph-keys-audit.md` — complete graph key set + census [agent].
- `reference-rules-and-verb-gap.md` — reference rules + wired-but-undocumented verbs [agent].
- `prototype-shapes-0-5.jsonl` + `test-shapes-0-5.sh` + `prototype-shapes-0-5-report.md` — shape prototype + run tests [agent].
- `tag-audit.md` — slat tag completeness [task #437].
- `01..09-*/` — the nine lane walk docs (authoritative per-lane design).
- `forge/forge/corpus/motoi_sft/assess.py` — canonical yield model (headline ~3.04M).

---

## 13. NEEDS-ALFRED (decisions, not fabricated)

1. **CPT variant:** top-up (Mk3.5) vs fresh Mk4 over augmented substrate (§3).
2. **Word-book span census:** confirm per-SPAN base lift (~40–50×) — the biggest
   lever toward ~5M (§7.1).
3. **Graph governor curve:** fix the tone×paraphrase tail governor numerically
   (HIGH swings 0.7M–1.5M) (§6).
4. **Per-layer book explosion:** confirm 4–5-layer books get per-layer passes (§7.2).
5. **Copilot fold vs standalone Lane #10:** currently folded into Reference depth;
   standalone would be materially larger.
6. **Variety verdict:** deterministic metric-gate vs full-context Claude lanes (§5).
7. **5 R7RS-core name placements:** `/`, `call/cc`, `floor/`, `truncate/`,
   `hash-table-update!/default` — which reference chapter each lands in (§7.5).
8. **89 no-chapter host/IDE/tooling verbs** (motoi/composer/book/completions/http/
   fb/color/voice/song…): in-scope for the reference-manual 15-grid, or documented
   as a separate host-surface appendix, or out-of-scope for Motoi SFT? (§7.5).
