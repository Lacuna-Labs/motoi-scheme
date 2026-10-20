# Motoi Reference — Authoring Rules + Wired-but-Undocumented Verb Gap

Audit date: 2026-07-29. READ-ONLY spec + gap list. No reference chapters authored.
Every claim below is grounded in a command actually run against the live tree at
`/Users/alfred/code/motoi-scheme/`. Unknowns are flagged **needs-alfred**.

Reference root: `scheme/reference/` (chaptered folder-book: `README.slatl` boot record,
`MANIFEST.slat` index, `00*`-`72*` `.slat` chapters). "The reference IS the language."

> NOTE on `.retag-new` files: every chapter has a sibling `NN-*.slat.retag-new`
> (dated 2026-07-29). These are un-promoted retag drafts, NOT canonical. All grep/
> census work below EXCLUDES `*.retag-new`; canonical = the plain `.slat`.

---

## (A) THE EXACT REFERENCE AUTHORING RULES

Source of truth: `scheme/reference/00-intro.slat` (§5, §6, §7, §9, §13, §13a) +
a real verb record read verbatim from `scheme/reference/69-vec.slat` (`vec/+`).

### A.1 The record shape (from 00-intro §5, verified against `vec/+`)

Each verb is a `(verb ...)` s-expression. Fields observed on the real `vec/+`
record (69-vec.slat lines 34-105):

Always-present metadata (00-intro §5 "Fields you will always see"):
`:name :library :signature :summary :examples :impl-status`.

Additional metadata seen on real records (all optional but "strongly encouraged"):
`:std` (e.g. `"Motoi"`, or a standard cite) · `:kind` (`"pure"`/`"mut"`/`"io"`/
`"special-form"`/`"meta"`) · `:impl-file` · `:impl-notes` · `:explanation` (2-6
sentences) · `:caveats (...)` · `:drawbacks (...)` · `:usecases (...)` ·
`:related (...)` · `:learn (:concept ... :prerequisites (...) :progression ...)` ·
`:math (:algebra (...) :total ... :domain ... :codomain ...)` ·
`:cs (:complexity ... :effects (...) :pure ...)` ·
`:ai (:deterministic ... :cacheable ... :cardinality ... :common-mistakes ...)` ·
`:hacker (:primitive ... :kin (...) :history ...)` · `:since`.

Training gate (00-intro §9 RULE 8): `:training-eligible #t` ONLY when all five rows
are three-discipline complete; else `#f` so the fold skips it.

### A.2 The program grid — EXACTLY 15 runnable programs per verb

From 00-intro **§13a "THE KEY"** (the single source of truth for tooling), quoted:

> "Every verb record carries EXACTLY 15 runnable programs:
>     5 rows  ×  3 disciplines (eng · math · cs)  =  15 programs per verb.
>  So a chapter of N verbs holds ~15N runnable programs — not N, not 7N."

The five rows (00-intro §6), each with its OWN job, never bleeding into another:

| Row | Name | Job (philosopher-shape, name stays in intro only) | Discipline weight (§7) |
|-----|------|---------------------------------------------------|------------------------|
| 1 | **HOW** (Composition) | verb written well; 1/3/5 module ladder (sub A=1 module, B=3, C=5). Base Scheme is free, doesn't count as a module. | CS-forward |
| 2 | **WHEN** (Audit) | operator's real problem; which verb, defend under audit vs a sibling | Eng-forward |
| 3 | **WHERE-ELSE** (Dimension) | the same SHAPE in 3 substrates (verb domain / metaphor / math-logic) | CS + math |
| 4 | **WHY** (Proof/Essence) | algebraic invariant; runnable test printing `#t`; ∀-notation; falsifier | Math-forward |
| 5 | **WITH-WHAT-ELSE** (Emergence) | chain this verb with others; name what emerges (cache/sequencer/…) | CS-forward |

### A.3 EXACT slot/key names (00-intro §13 + §13a, confirmed in `vec/+`)

Row-record keyed fields as they appear on disk:

- `:row-1-composition (` sub-examples `(:sub "A" :modules 1 :code "..." :note "...")`,
  `(:sub "B" :modules 3 ...)`, `(:sub "C" :modules 5 ...)` then `(:eng "..." :math "..." :cs "...")`.
  (Legacy `:examples (...)` with `:tier "novice"/"apprentice"/.../"master"` also present on
  `vec/+` as a parallel novice→expert ladder using `:code`.)
- `:row-2-audit (` `(:eng-program "..." :math-program "..." :cs-program "..." :problem "..." :explanation "..." :meta "...")` then `(:eng ... :math ... :cs ...)`.
- `:row-3-dimension (` `(:setup "..." :rungs ((:domain "..." :code "...") x3) :explanation "..." :meta "...")` then `(:eng ... :math ... :cs ...)`.
- `:row-4-proof (` `(:eng-program "..." :math-program "..." :cs-program "..." :claim "..." :program "..." :invariant "∀ ..." :meta "...")` then `(:eng ... :math ... :cs ...)`.
- `:row-5-emergence (` `(:eng-composition "..." :math-composition "..." :cs-composition "..." :base "..." :composition "..." :emergent "..." :meta "...")` then `(:eng ... :math ... :cs ...)`.

**Which keys hold RUNNABLE code** (00-intro §13a, verbatim): a key is runnable
iff it is `:code`, `:program`, `:composition`, or ends in `-program` or
`-composition`. Namely: `:code` `:program` `:composition` `:eng-program`
`:math-program` `:cs-program` `:eng-composition` `:math-composition`
`:cs-composition`. Each holds a WHOLE program that MUST evaluate clean.

**PROSE keys (never fed to the evaluator):** `:setup :note :problem :explanation
:meta :claim :invariant :base :emergent :domain :eng :math :cs :sub :modules`.

### A.4 The runnability rule (00-intro §9 RULE 2, §1 §11)

> "Every code block must RUN. Extract the code, save it, run it through
>  `./bin/motoi`, verify exit 0."

Concretely: `echo '<expr>' | ./bin/motoi run /dev/stdin` must return no error
(no `unbound symbol`), modulo declared broken-examples. "When the reference and
the interpreter disagree, the reference wins" — but a program that does not run is
a bug to fix before commit, not a fact to ship.

### A.5 Honest-null convention

- Per-row three-discipline triplet: if a discipline is truly N/A (rare), say so
  EXPLICITLY (`"no non-trivial math content"`) — **blank = incomplete,
  not-applicable = considered** (00-intro §13, last paragraph).
- MEMORY doctrine (fold-wide): honest-null slots are TRAINING SIGNAL, not data
  absence; a verb at "6 real + 9 null" is AT spec, not under it. Never
  double-null, never demote a real example to null. (Preflight counters are
  honest-null-blind.)

### A.6 Hard authoring rules that gate NEW verbs (00-intro §9)

RULE 1 do not invent verbs (missing verbs are Alfred's call) · RULE 3 every row =
3 disciplines · RULE 9 **NO philosopher names in entries** (shape present, name
absent) · RULE 10 use REAL Motoi domains only, never `card/* shop/* cine/*
flower/*` (downstream) · RULE 13 each row stays in its lane · CLAUDE.md: no
deletes, no fabrication (`:status "needs-alfred"` and stop).

---

## (B) WIRED-BUT-UNDOCUMENTED VERB CENSUS (with run-check evidence)

### B.1 Method (ground truth, not grep)

1. Built the live extended env exactly as the copilot's `RegistryOracle` does:
   `makeExtendedBaseEnv()` from `src/lib-loader.js` → **1,659 total bindings**,
   **1,077 namespaced (slash-bearing) verbs**. (A bare `snapshotRegistry()` returns
   0 until libs install; `installCore` alone gives 96. `makeExtendedBaseEnv` is the
   full surface.)
2. Extracted all `:name "..."` entries from canonical `scheme/reference/*.slat`
   (excluding `.retag-new`) → **1,179 documented names**.
3. Diff → **183 wired-namespaced verbs not documented by name.** Classified below.
4. Spot-confirmed WIRED via `echo '(<verb> ...)' | ./bin/motoi run /dev/stdin`
   (grep is NOT sufficient per the ref/impl-drift doctrine).

### B.2 COPILOT verbs — WIRED and ALREADY DOCUMENTED (no gap)

The `motoi-copilot/src/` 11 files are host-side JS orchestration; they register
**zero** Scheme verbs (they CONSUME the registry via `snapshotRegistry` from
`motoi-scheme/registry`). The Scheme-callable `copilot/*` verbs are wired by the
ENGINE. All 8 run clean AND already have records in `02-ai.slat`:

| verb | run-check (`(verb "x")`) | reference |
|------|--------------------------|-----------|
| copilot/ask | WIRED → `#f` | 02-ai.slat ✓ |
| copilot/complete | WIRED → `#f` | 02-ai.slat ✓ |
| copilot/explain | WIRED → `#f` | 02-ai.slat ✓ |
| copilot/fix | WIRED → `#f` | 02-ai.slat ✓ |
| copilot/pretty-error | WIRED → `"\"x\""` | 02-ai.slat ✓ |
| copilot/rag | WIRED → `((:answer #f)(:sources ()))` | 02-ai.slat ✓ |
| copilot/scaffold | WIRED → path string | 02-ai.slat ✓ |
| copilot/what-is | WIRED → `((:registry-hit #f)...)` | 02-ai.slat ✓ |

**Copilot gap: NONE.**

### B.3 COMPOSER verbs (part/ motion/ note/ synth/) — WIRED and ALREADY DOCUMENTED (no gap)

42 wired verbs in these four namespaces (from the live env):
part/* (19) in 48-part.slat · motion/* (11) in 42-motion.slat · note/* (3) in
43-note.slat · synth/* (9) in 62-synth.slat. **All 42 are documented.**
Spot run-checks all WIRED (part/wave, part/nod, part/grasp, part/twist, motion/halt,
motion/drop, motion/cadence, motion/pocket, note/strike, note/place-at, synth/play,
synth/chord, synth/808, synth/orchestra).
- One grep artifact: `motion/music` appears in `lib/game/composer.js` as a
  namespace comment; it is **UNBOUND** at runtime (`motoi run` → unbound) and
  correctly absent from the reference. Not a gap.

**Composer gap: NONE.**

### B.4 THE ACTUAL GAP — 88 wired verbs in EXISTING chapters, undocumented

These namespaces HAVE a reference chapter, and these wired verbs are missing from
it. All spot-checked WIRED via `./bin/motoi run` (sample evidence in the last col;
some error only for lack of args — bound, not unbound).

| ns (chapter) | count | verbs |
|--------------|-------|-------|
| **alg** (03-alg.slat) | 28 | action alternating centralizer commutator derived-subgroup exponent generate generators homomorphism is-cyclic? is-simple? is-solvable? is-subgroup? isomorphism? left-cosets normalizer perm-cycles perm-fixed-points perm-fixed? permutation-compose permutation-cycles quotient random-element rank right-cosets subgroup subgroups torsion |
| **topo** (67-topo.slat) | 23 | adjacent? boundary chain closed? dimension edges euler-characteristic faces genus homology homotopy interior is-manifold? klein-bottle mobius nodes open? simplex simplicial simply-connected? sphere torus vertices |
| **artifact** (05-artifact.slat) | 10 | apply at-location close compose describe nest on-event read spawn subscribe-cortex |
| **cortex** (19-cortex.slat) | 5 | associate lookup prune record search |
| **entity** (24-entity.slat) | 4 | hp id spawn team |
| **matrix** (41-matrix.slat) | 4 | col matvec row zero |
| **animation** (04-animation.slat) | 3 | budget reflow-policy set-reflow-policy |
| **world** (72-world.slat) | 3 | camera-pan-to knowledge knows? |
| **easing** (22-easing.slat) | 2 | apply ease |
| **text** (64-text.slat) | 2 | overlay overlay-clear |
| **ai** (02-ai.slat) | 1 | embed |
| **sprite** (58-sprite.slat) | 1 | define |
| **floor** (27-floor.slat) | 1 | floor/mark!  (chapter documents only `floor/problem?`) |
| **transport** (68-transport.slat) | 1 | transport/bpm  (chapter documents only `transport/tempo`) |

**Subtotal in-scope gap = 88 verbs** across 14 existing chapters.

Run-check evidence (sample, all WIRED): `topo/sphere`→complex; `topo/euler-characteristic`→`0`;
`alg/generators`→`()`; `alg/is-cyclic?`→`#f`; `artifact/spawn`→`error:[artifact] ... called in`
(bound, needs ctx); `cortex/record`→`#t`; `entity/hp`→`0`; `matrix/row`→bound (arg error);
`animation/budget`→`16`; `easing/ease`→`0`; `text/overlay`→`()`; `world/knows?`→`#f`;
`ai/embed`→`(0.016 ...)`; `sprite/define`→`#t`.

> DRIFT CAUTION (doctrine): a few of these may be documented under a DIFFERENT
> name in-chapter (ref/impl drift). Before authoring, each verb needs a
> per-verb reconcile pass (does the chapter already name the same capability
> under another symbol?). Flagged, not resolved here.

### B.5 STANDARD-CORE names undocumented (R7RS-small) — 5 verbs, **needs-alfred placement**

WIRED, run clean, but no `:name` record found: `/` `call/cc` `floor/` `truncate/`
`hash-table-update!/default`. These are genuine R7RS-small names (`floor/` `truncate/`
are R7RS §6.2.6 division ops; `call/cc` is `call-with-current-continuation`).
Chapter 01-core / the standard-library meta-chapter (00e) are the likely homes.
**needs-alfred:** confirm home chapter + whether these are intentionally undocumented.

### B.6 NO-CHAPTER namespaces — WIRED but no reference chapter exists — **needs-alfred (89 verbs)**

These wired namespaces have NO `:library` chapter in `MANIFEST.slat`. They are
likely host/IDE surfaces, the composer-tooling layer, or downstream-dialect. They
are OUT of the current 74-library reference and require Alfred's decision (new
chapter? host-only, exclude? downstream?). **Do NOT author without a ruling.**

| ns | count | verbs (sample) | likely nature |
|----|-------|----------------|---------------|
| motoi | 32 | say, explain, bookmark!, highlight!, hacker-mode-on!, pair-on!, reading-state, stack, session-log … | IDE/session host surface |
| composer | 26 | save, load, emit, piano-roll, sprite-grid, tile-map, timeline, adsr, cart-emit … | composer-tooling (the #380 authoring UI, not the part/motion/note/synth spec layer) |
| book | 7 | toc, read, search, next, prev, list, example | book-reader host surface |
| completions | 6 | at-point, smart-at-point, body, mode, next-arg, import-suggestions | IDE completion host surface |
| book-of-code | 5 | read, chapter, tutor, run-code-block, table-of-contents | book-reader host surface |
| http | 4 | serve, stop, serve-info, wait-until-ready | net (NON-hermetic — likely NOT base Motoi) |
| color | 3 | named, name-of, palette-html-16 | possibly belongs in a graphics chapter |
| fb | 3 | pixel, rect, dump | framebuffer host/debug surface |
| voice | 2 | mix, compose | audio composer tooling |
| song | 1 | config | audio composer tooling |
| flower | 1 | paint | **DOWNSTREAM dialect — EXCLUDED by 00-intro §3/§9 RULE 10.** Not a gap. |

Subtotal needs-alfred (excluding flower) = **89 verbs**. `flower/paint` is
correctly out of scope.

### B.7 Reconciliation of counts

183 undocumented-by-name = 88 in-scope (existing chapters) + 5 R7RS-core
(needs-alfred placement) + 89 no-chapter (needs-alfred) + 1 downstream (flower,
correctly excluded). Copilot (8) and composer part/motion/note/synth (42) are
fully documented — no gap.

---

## (C) PER-VERB AUTHORING SPEC (for the in-scope 88)

For EACH of the 88 in-scope verbs (§B.4), author ONE `(verb ...)` record in the
named chapter, filling the FULL slot set from (A):

### C.1 Metadata block (always)
`:name` · `:library` (the chapter's library) · `:std` (conformance ladder:
R7RS-small → SRFI → Motoi-own; most of these are `"Motoi"` — cite exactly, do not
guess) · `:kind` (`pure`/`mut`/`io`/`meta`) · `:signature` (verify against real
runtime behavior via `./bin/motoi run`) · `:summary` · `:impl-status "wired"` ·
`:impl-file` (the actual JS file that registers it — see §C.4) · `:explanation`
(2-6 sentences) · `:caveats` · `:drawbacks` · `:usecases` · `:related` · `:learn`
· `:math` · `:cs` · `:ai` · `:hacker` · `:since` · `:training-eligible` (set `#t`
only when all 5 rows are 3-discipline complete).

### C.2 The 15-program grid (mandatory)
- `:row-1-composition` — sub A (1 module), B (3 modules), C (5 modules) + `:eng/:math/:cs`.
- `:row-2-audit` — `:eng-program :math-program :cs-program :problem :explanation :meta` + triplet.
- `:row-3-dimension` — `:setup :rungs (x3 :domain/:code) :explanation :meta` + triplet.
- `:row-4-proof` — `:eng-program :math-program :cs-program :claim :program :invariant :meta` + triplet.
- `:row-5-emergence` — `:eng-composition :math-composition :cs-composition :base :composition :emergent :meta` + triplet.
Every runnable key MUST pass `echo '<code>' | ./bin/motoi run /dev/stdin` clean.
Honest-null any genuinely-N/A discipline explicitly (never blank).

### C.3 Chapter assignments (in-scope 88)
- 03-alg.slat ← 28 alg/* (group theory: cosets, subgroups, homomorphisms, permutations).
  Row-4 math anchors to book-of-math (abelian groups / group theory) per 00-intro §12.
- 67-topo.slat ← 23 topo/* (simplicial complexes, manifolds, Euler char, homology/homotopy).
- 05-artifact.slat ← 10 artifact/* · 19-cortex.slat ← 5 cortex/* · 24-entity.slat ← 4 entity/*
  · 41-matrix.slat ← 4 matrix/* · 04-animation.slat ← 3 animation/* · 72-world.slat ← 3 world/*
  · 22-easing.slat ← 2 easing/* · 64-text.slat ← 2 text/* · 02-ai.slat ← ai/embed
  · 58-sprite.slat ← sprite/define · 27-floor.slat ← floor/mark! · 68-transport.slat ← transport/bpm.
- After authoring: update each chapter's `:verb-count` in `MANIFEST.slat` +
  `README.slatl` `:nav`, and the top-level totals (`:verb-count 1165`, etc.). The
  README nav counts already drift from MANIFEST (e.g. README says ai=35, world=39;
  MANIFEST says ai=57, world=43) — reconcile, flag to Alfred.

### C.4 Implementation-file map (for `:impl-file` + signature ground-truth)
- alg/* topo/* matrix/* : math libs (verify exact file; grep `core/` `lib/`).
- part/* note/* synth/chord/kit/play, motion/{halt,drop,arc,move-to,…} : `core/core-verbs.js`.
- synth/{808,load-score,onset-tap,orch,orchestra,sp1200} : `lib/audio/synth.js`.
- motion/{cadence,pocket}, part/grasp, part/twist : `lib/game/composer.js`.
- motion/{motion,move-to,on-settle} + animation/* : `lib/graphics/animation.js`.
Read the actual registration before writing `:signature` — do not infer.

### C.5 Before authoring — required pre-passes
1. Per-verb DRIFT reconcile (§B.4 note): confirm the capability isn't already
   documented under a different symbol in the same chapter.
2. Get real signatures by running each verb with representative args through
   `./bin/motoi run` and reading the JS registration.
3. Get Alfred's ruling on §B.5 (R7RS-core placement) and §B.6 (89 no-chapter
   verbs) BEFORE touching those — RULE 1: missing/placement decisions are Alfred's.

---

## Appendix — commands run (reproducibility)
- Live env dump: `makeExtendedBaseEnv()` from `src/lib-loader.js`, collect env
  chain → `/tmp/all-wired.txt` (1659), `/tmp/ns-wired.txt` (1077).
- Documented names: regex `:name "([^"]+)"` over `scheme/reference/*.slat`
  (exclude `.retag-new`) → 1179.
- Diff + classify → `/tmp/undoc.txt` (183) → §B classification.
- Run-checks: `echo '(<verb> ...)' | ./bin/motoi run /dev/stdin` for copilot/*,
  part/motion/note/synth/*, and a sample of each in-scope namespace + no-chapter ns.
- Rules: read `00-intro.slat` (§5/§6/§7/§9/§13/§13a), `MANIFEST.slat`,
  `README.slatl`, real record `vec/+` in `69-vec.slat`.
