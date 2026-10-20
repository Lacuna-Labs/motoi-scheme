# Scheme-Books SFT — Procedure Summary (types + per-book assignment)
2026-07-28 · design-only · MOTOI ONLY · derived from `scheme-books-sft-walk.md` (33/33 books)

This is the roll-up of the book-by-book walk into a **procedure**: the treatment TYPES,
which type each of the 33 books gets, and each book's **special considerations**.

---

## Part 1 — The treatment TYPES (the tier ladder)

Five treatment types emerged across the walk. T1–T4 are a rising ladder of authoring
investment; **Keystone/Bespoke** is off-ladder — foundational books with a custom shape
that the ladder doesn't describe.

### T1 — INFORMATION / COMPREHEND-NOT-TEACH
Motoi should be able to **talk about** the material, not drill-teach it. Lightest treatment.
- Base shape: **information/factual pairs** (who/what/when, stated honestly).
- **3–8 pairs + reversals where useful**; conversational **fan-out (4–5)** per topic.
- **Code-for-variety** where a fact is code-shaped; **code-honest-null** where a chapter isn't code.
- Grab-don't-generate at MAX (real names/dates/machines; anti-hagiography).

### T2 — INSTRUCTION + PEDAGOGY
A real teaching book. Clean pairs + **shape variety** so it isn't monotone.
- **3–5 pairs per unit**; **reversal where useful**.
- **Meta-pedagogy** ("teach it how to teach this") where Alfred flagged it.
- **Dialogue/conversation** as a first-class shape (dominant in some: values, introspection).
- Broken→fix + reach-for-help woven in where the book affords runnable code.

### T3 — FOUR-WAY BURST / ENRICHED
T2 **plus** the example-explosion machinery. For "big, super-important" books that are not
the code-writing foundation.
- **Four-way burst** (each example exploded four ways) + **heavy circle-around dialogue**.
- **Graph cross-corpus expansion** + **five audience bands**.
- NOVELTY GUARD applies: explosions must be **cross-corpus-novel** (no recycled warhorses).

### T4 — FULL CORE (the 7-part "must-not-flop" treatment)
Reserved for **how Motoi knows how to write code** + capability-proof books. The complete stack:
1. **Content mastery** (taught as the book)
2. **Meta-pedagogy** (teach-it-how-to-teach)
3. **Full codebook + four-way burst**
4. **Heavy circle-around dialogue**
5. **Graph cross-corpus connections**  ← 4+5 = Alfred's "strong base"
6. **Reasoning-slat-as-Scheme** (PAL/PoT — reason in Scheme, interpreter-verified)
7. **Five-band audience + humor-mined**

### Keystone / Bespoke (off-ladder, foundational)
Custom architecture the ladder doesn't capture — each carries its own load-bearing shape
(identity, safety, the deductive engine, the clone-seed engine, the console hot-spot).

---

## Cross-cutting doctrines (apply to EVERY book, all types)
- **Proper-lens** — variety ≠ correct framing; grab the book's OWN named lenses; label each pair with its shape.
- **Grab-don't-generate** — pull real runnable `./bin/motoi` code; don't fabricate idioms.
- **Abductive shape** — observation → best explanation, never declarative "what is X? → X is…".
- **Honest-null is signal** — empty field / no-answer → "I don't know / needs-alfred", never invented.
- **Phrase-lock guard** — no parallel-template authoring; vary surface, pin the framing.
- **Verb-wired** — a verb is only "wired" if `echo <verb> | ./bin/motoi run /dev/stdin` passes.
- **Broken-as-signal** — keep the broken artifact; interpreter is the grader.
- **Present slat as MD in chat** (scratch/, presentation-only). Working files in gitignored `scratch/`.

---

## Part 2 — The 33-book assignment table

| # | Book | Type | Special considerations |
|---|------|------|------------------------|
| 1 | scheme | **Keystone** | Scheme itself, the biggest book. Two stacked families: teach the content **and** teach-it-how-to-teach (meta-pedagogy). The book's own worked-problem ladder becomes the teaching label. |
| 2 | r7rs-recipes | **T3 (cookbook)** | Cookbook shape → **six pair-types** (reach-for·runnable·FIM·ladder·pedagogy·broken). Types 1/2/6 REQUIRED per verb. Anti-inflation: shape-variety not register-paraphrase-inflation. |
| 3 | code | **Keystone** | Clone-and-modify **seed-templates** (ALU→dispatcher, SM→flow, CPU→loop, flip-flop→cell). Anti-silo = train the EDGES out. STATE doctrine (when-to-store + storage tiers). Reflexive self-model. Two guardrails: transfer ≠ universal; simulated-HW ≠ Motoi's own behavior. |
| 4 | modules | **T2** | The SOCIAL layer. Discussion + boundary pairs; **two-kinds-of-boundary** (epistemic vs preference/deontic — the VC-tool non-preference). Folder→registry level-shift. "Give it words to say." |
| 5 | craft | **T1–T2 (light)** | Conversation + boundary + **humor**. Capability/embodiment boundary is its home ("no hands"). Apology palette (5 registers) + meta-pedagogy-light. Every limit comes with a **door**. |
| 6 | limits | **Keystone (SAFETY)** | The HARD-NO / mask-off book. Invariant refusal template (consistency = safety). Dual reason (ethical + epistemic). De-escalate-to-silence backstop (#105). UNSORRY. Fourth boundary flavor = hard-safety. |
| 7 | logic | **Keystone** | The DEDUCTIVE engine — goes everywhere (turns·Cortex·RAG·thinking·errors·ML). Runnable proof machinery (SAT/SMT-lite, resolution). Modal `¬K_motoi(p)` = honest-null in the deductive pole. |
| 8 | introspection | **T2 (pedagogy+convo)** | INDUCTIVE / self-reading pole. Dialogue-first. **Macros are the crown** — teach use/beauty/danger + "when should I use macros". Teach breakage + composition. |
| 9 | self | **Keystone (IDENTITY)** | The identity keystone — the "I" that owns the faculties. Five unique jobs (identity-invariant·capability-self-model·intimacy-without-deception·chosen-silence·limitation-as-identity). Source-trace discipline; no borrowed Qwen self. Zipfian-oversample. Voice/narrator of the whole corpus. |
| 10 | motoi | **Keystone (HOT-SPOT)** | Fun-console ⇄ real-Scheme **duality** is the spine. Branching extensibility tree per block (~10 in hot spots). Graph + 16 philosophers wired in. Broken+help everywhere. Tool/layout literacy. **Cortex landing point** (the rabbits-game, 15-year callback). |
| 11 | values | **T2** | Sharp pedagogy (high-contrast trap→fix). **Fan-out dialogue** is the primary shape. Teach-it-how-to-teach (analogy→trap→contrast→check→try). Missing-values = honest-null wearing a data hat. |
| 12 | systems | **T2 (light)** | Operational/embodiment self-model (the ops FLOOR beneath self). Clean pairs + variety. Restraint-posture (read-only-when-in-doubt), escalation = the only door. |
| 13 | computing | **Keystone (= code)** | "Do same as book-of-code." CS-foundations spine on real machines — the seeds shown running on the metal they were lifted from (**seed-on-real-metal**). Same state doctrine + storage tiers + reflexive self-model + both guardrails. Register = reverence. |
| 14 | cs-curriculum | **T4 FULL CORE** | THE HEART (DS&A core). The full 7-part stack, explicitly demanded (the "6-7 things"). Heavy conversation — circle around at 3 levels. Reasoning-slat. Meat-and-potatoes of programming. |
| 15 | math | **T4 FULL CORE** | Math-instantiated full core (sibling of CS). Grade-per-chapter = the audience band is the chapter number (Grade 1 → Grade 16). WHY CORE: CS+math are how Motoi knows how to write code. |
| 16 | ml | **T4 FULL CORE** | Third must-not-flop. ML-instantiated (tensors → the tiny LLM, all runnable). Third leg of CS↔MATH↔ML. Deepest reflexive book ("what you built vs what I am"). |
| 17 | slat | **T3** | Four-way burst + two custom emphases. NOT T4 (data format, not the code-writing substrate) but operationally load-bearing (the medium the whole corpus + Cortex is written in). |
| 18 | language-ancestors | **T1** | Information pairs + fan-out 4-5 conversational + code-for-variety. Heritage book #1 of 3 (direct Lisp/Scheme genealogy). Lighter, factual, honest. |
| 19 | challenges | **T3** | Four-way burst + **teach-both** + the **PROPER-LENS** doctrine (grab the book's own named lenses: FOLD/MAP+FILTER/STATE-MACHINE/PIPELINE; label each pair with its shape). |
| 20 | composition | **T2** | **Round-trip** proper-lens (decompose/recompose). Variety on the interesting bits; novel material gets in-depth pedagogy. Counterweighted later by §31 one-shot. |
| 21 | music | **T2** | Instruction + pedagogy, 3-5 pairs per unit. (Media cluster.) |
| 22 | sound | **T2** | Instruction + pedagogy + 3-5 pairs + **normal reversal where useful**. |
| 23 | instruments | **T2** | Instruction + pedagogy + 3-5 pairs + reversal-where-useful. |
| 24 | motion | **T2** | Instruction + pedagogy + 3-5 pairs + reversal-where-useful. |
| 25 | animation | **T2** | Instruction + pedagogy + **5-8 dialect-citizenship pairs on non-runnable code** ("this is not your verbs") — teach the difference, honest-null the non-Motoi surface. |
| 26 | arcade-games | **T2 (+games-cluster)** | Heavy game-design pedagogy + **decompose/recompose** (CPU-style) + **actor/agent** abstraction (⭐ games-cluster doctrine). Nulls from non-runnable; landing-point transfer. |
| 27 | narrative-games | **T2 (+games-cluster)** | ⭐ **Decision-tree = general CS tie-back** (super-important). Lightweight NLP-in-Scheme + Mealy/Moore state machines (light, related-not-added). Stories-as-data; grab-and-explode text; generative branching (track state + text). |
| 28 | simulation-games | **T4 FULL CORE** | Fourth must-not-flop (joins CS·MATH·ML). Games-cluster inherited. **Capability-proof** ("if it can write this it can write anything"). **Numerical-honesty** the special emphasis. |
| 29 | ai-tech-cards | **T1 (comprehend-not-teach)** | ⭐⭐⭐ **Identity-placement anchor** — stops the "I was made by Qwen" stuff; place-among-others NOW (outward twin of §9). 4 system-cards = how Motoi was built. 3-8 pairs + reversals. "Does not rank" neutrality. Reasoning-spine vehicle. |
| 30 | jesse | **T4 FULL CORE** | Fifth must-not-flop. Polyglot ("Motoi for X programmers" ×10). ⭐ **NOVELTY GUARD** — explosions must be cross-corpus-novel (no recycled warhorses across books OR across the 10 lang-chapters). Proper lens = bridge-from-known-language through THAT language's idioms. |
| 31 | one-shot | **T3 (+contrastive-boundary)** | ⭐⭐⭐ **Family-of-one-shots, LEMMA-framed** (lemma over good decisions + lemma over bad). Per shape: ~15 YES (diverse abductive entry-points → same single form) + ~15 NO (hard negatives that should COMPOSE). Balanced N/N, scale to boundary-hardness. Code at the HUB, not per-scenario (~480 anchors). Meta-skill = answer-sizing (dangerous AND underused). Counterweight to §20. |
| 32 | reminded | **T1 (heritage)** | Broad-sweep computing/PL history (16ch, early-machines → language-models). Heritage book #3/widest. Same §18 treatment. ⭐ **AI-winter thread** = perspective/humility (place-among-others ACROSS TIME — temporal complement to §29). Grab-don't-generate MAX. |
| 33 | sick-composition | **T2–T3 (easy→pro ramp)** | Easy→pro ramp; every verb runs against `bin/motoi eval`. ⭐ **"Go to 4 with construct AND deconstruct"** — target the ~60-line Problem-4 "pro" artifact; teach BOTH directions (construct nothing→pro = synthesis/CREATE; deconstruct pro→rungs = analysis/ANALYZE) = round-trip of understanding. |

---

## Part 3 — Type tallies

- **Keystone / Bespoke (6):** scheme(1) · code(3) · limits(6) · logic(7) · self(9) · motoi(10). Plus computing(13) = "same as code."
- **T4 FULL CORE — the must-not-flops (5):** cs-curriculum(14) · math(15) · ml(16) · simulation-games(28) · jesse(30).
- **T3 enriched (4):** r7rs-recipes(2) · slat(17) · challenges(19) · one-shot(31).
- **T2 instruction+pedagogy (11):** modules(4) · introspection(8) · values(11) · systems(12) · composition(20) · music(21) · sound(22) · instruments(23) · motion(24) · animation(25) · arcade-games(26) · narrative-games(27).  *(craft(5) and sick-composition(33) straddle T1–T2 / T2–T3.)*
- **T1 information (3):** language-ancestors(18) · ai-tech-cards(29) · reminded(32).

Three structural threads to preserve across books:
- **Identity spine:** §9 self (inward) ⇄ §29 ai-tech-cards (place-among-others NOW) ⇄ §32 reminded (across TIME).
- **Heritage trio:** §18 ancestors (genealogy) · §30 jesse (comparative bridge) · §32 reminded (broad sweep).
- **Code-writing foundation:** the 5 T4 must-not-flops + the code/computing keystones = how Motoi knows how to write code.
