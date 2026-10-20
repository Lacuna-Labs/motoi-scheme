# The Graph as SFT Substrate — Deep Design
**Motoi four-axis Jung graphs → maximal, non-fabricated conversation pairs**
2026-07-27 · design-only · MOTOI ONLY · grounded in the real on-disk schema

---

## 0. The thesis (read this first)

A graph node is **not a fact card**. It is a **junction in a relation manifold**. Every field on
a node is an *edge to a different kind of meaning* — a different question the world can ask about
that word. We do not generate SFT pairs by *reciting fields* ("What is X? X is Y"). That is the
declarative trap that phrase-locks the model ([[project_sft_must_be_abductive_2026_07_21]]).

We generate pairs by **traversing edges** and narrating the traversal in a **register**, through a
**philosophical lens**. Three orthogonal dials:

```
   PAIR  =  (edge-traversal)  ×  (register / audience-tone)  ×  (philosophical lens)
            ── WHAT relation ──   ── HOW it's voiced ──────      ── WHY it's true, what kind of thing it is ──
```

Every one of the ~60 keys is either a **node** in this manifold or an **edge**. The philosopher is
not a topic we teach *about*; the philosopher is the **operator that decides which edge to walk and
what shape the answer takes**. Wittgenstein's objects are the floor: the Sensation axis is the
ground of nameable things; everything else stacks on it.

The whole point of Alfred's ask: **one node, many teachings.** A single word like `thinking/exact`
should mint pairs about its meaning, its opposite, its home in the books, its use in real code, its
sibling concepts in other axes, the tone Motoi uses to explain it, and the honest gaps in what we
know — each of those in a child's voice, a layperson's voice, and a PhD's voice. That is not
inflation. Every one is grounded in a field that is really on disk.

---

## 1. The real schema — every key, what it is, what it teaches

Counts below are live from the four `.slat` files (2026-07-27). Coverage tells you the **pair
budget** for each edge type.

### Family A — Identity & sense-anchor (the node itself)
| key | what it is | teaches |
|---|---|---|
| `:id`, `:canonical` | the signifier (`thinking/exact` / `"exact"`) | the *reference* (Frege's *Bedeutung*) — the bare handle |
| `:axis` | which Jung function owns it | the *mode of being*: thing / pattern / principle / register |
| `:tier` | 1 crown / 2 stub / 3 long-tail | how much signified this signifier has earned; **governs pair budget** |

Identity fields are never a pair *answer*. They are the **subject** every other pair hangs off.

### Family B — Definitional core (what kind of thing it is)
| key | coverage | teaches | lens it invites |
|---|---|---|---|
| `:definition` | sensation 2500 · intuition 5827 · thinking 965 · feeling 675 | plain-word meaning | Aristotle (genus+differentia), Peirce (best explanation) |
| `:definition-technical` | intuition 300 | precise, stats-anchored meaning | Frege (sense), PhD register |
| `:category` / `:subchar` / `:principle-kind` / `:register-kind` | 300 / many / 300 / 62 | the *sort* of thing (`:everyday-object`, `:correctness`, `:calm`) | Aristotle (categories), Kant (conditions) |

### Family C — Grounding-in-use (Wittgenstein-late: meaning IS use)
| key | coverage | teaches |
|---|---|---|
| `:used-in-programs-as` | ~300/axis | the word's *job* in code — 3 concrete roles each |
| `:examples` | broad | worked appearances in real prose |
| `:example-in-scheme` / `:example-in-world` | intuition 300 (mostly honest-null) | code grounding / real-world analogy |
| `:example-dialogue` | sensation 300 · intuition 300 · thinking 300 · feeling 65 (~**962 authored**) | **the kid-voice seed floor** — cannot be fabricated ([[kid-seed-domain-extrapolate-asymmetry]]) |

### Family D — Corpus location (the "where it lives" web — books & code)
| key | coverage | teaches |
|---|---|---|
| `:appears-in-corpus` | now filled ~11.5k (2026-07-27 closure) | factual presence: *this word really occurs in this file* |
| `:cross-refs-books` / `:related-books` / `:appears-in-books` | 300/axis | which **books** own this concept |
| `:related-verbs` | thinking 300 | which **reference verbs** enact this principle (`assert/check-with`) |
| `:first-appears-in-book-count` | intuition 2754 | where in the reading order it debuts |

### Family E — Lexical-semantic relations (the word-web)
| key | coverage | teaches | lens |
|---|---|---|---|
| `:oppositions` | 300/axis, many honest-null | the *opposite* (or honest "none") | Saussure/Derrida (value by difference) |
| `:synonyms` | mostly honest-null (WordNet rejected — sense-blind) | near-meanings *when sense-safe* | Frege (same reference, diff sense) |
| `:associations` (PPMI + weight) | sensation 300 · intuition 12,152 edges | statistically co-firing words | Hume (association/custom) |
| `:distributional-neighbors` | 300/axis | words that live in the same contexts | Quine (meaning holism) |
| `:surrounding-words` | sensation 16,403 · honest-null where boilerplate | local co-text | Wittgenstein-late (use-context) |
| `:contrast-register` | feeling 62 | the tone this one is *not* (`:calm` vs `:urgency`) | Saussure on the tonal plane |

### Family F — Statistical signal (the "how central" dial — decides audience)
| key | teaches / **routing use** |
|---|---|
| `:freq`, `:doc-freq` | how often / how widely → centrality → **depth budget** |
| `:tf-idf`, `:idf`, `:peak-weight` | axis-salience → is this a crown concept? |
| `:context-entropy` | how many contexts it lives in → **high entropy = PhD-worthy** (many facets to interrogate) |
| `:cross-axis-bridge-score` | how much it reaches into *other* axes → **the stacking dial** |
| `:tf-idf-per-axis` | its weight in each axis → where it *primarily* lives + secondary homes |

These are **not** pair content. They are the **router**: which node gets a 6-level PhD seminar and
which gets one terse lookup line. (Details in §3.)

### Family G — Sensory / world facets (Sensation only — Husserl's world-as-experienced)
`:sensory-description`, `:where-found`, `:size-scale`, `:kid-familiarity`, `:everyday-object`,
`:common`, `:sometimes-seen`, `:body`. These are the **outside-the-books** grounding: the word tied
to the lived world, not to a corpus file. Source of every *layperson analogy* pair.

### Family H — Behavioral / normative (Thinking only — the ethics/rules of code)
`:invariant`, `:precondition`, `:motoi-behavior`, `:short-scenario`, `:antipattern-scenario`,
`:principle-kind`. The **right-way / wrong-way** engine. `:short-scenario` = the positive path;
`:antipattern-scenario` = the failure path. These mint contrastive do/don't pairs directly.

### Family I — Register / tone (Feeling only — Grice + Levinas, the STYLE CONTROLLER)
`:register-kind` (`:calm`), `:motoi-uses-when`, `:contrast-register`, `:register-carrier`. **This is
the most under-exploited family.** Feeling nodes don't just add content — they are the **tone
palette for the entire corpus.** `feeling/calm.motoi-uses-when = "error explanations, child is
frustrated"` is a *directive* for how to voice every Thinking-axis error pair. Feeling is the axis
that tells the other three axes *how to speak*.

### Family J — Pedagogy / prerequisite
`:prerequisites` (mostly honest-null), `:context-of-use`, `:classify-reason`. The learning-order web
(Kant: conditions of possibility — what you must grasp *first*).

### Family K — Governance / label (the training-discipline sidecar)
`:kid-friendly`, `:training-eligible`, `:audience`, `:content-rating`, `:provenance`, `:dialect`.
Never pair content — they are **filters and provenance stamps.** `:training-eligible #f` → skip.
`:content-rating` gates register. `:provenance` is our anti-fabrication audit trail.

---

## 2. The six relationship webs (Alfred's explicit target)

Alfred named the mission: *"a host of relationships within the graphs, relationships with books,
relationships outside the books, relationships with words, their opposites, and tying all that
together in the corpus."* Here is each web, the fields that carry it, and the pair-shape it mints.

### Web 1 — WITHIN a graph (intra-axis siblings)
Fields: `:oppositions`, `:synonyms`, `:associations`, `:distributional-neighbors`, `:prerequisites`.
Pair-shapes:
- **Contrast:** "How is `exact` different from `approximate`?" (from `:oppositions`)
- **Neighborhood:** "`row` shows up next to *regressions, nearness, stochasticity* — why do those
  travel together?" (from `:associations` with real PPMI weights)
- **Ladder:** "What do I need to understand before `X`?" (from `:prerequisites`; honest-null → "no
  prerequisite chain — it's foundational")

### Web 2 — ACROSS graphs (inter-axis stacking — the connective tissue)
Fields: `:cross-refs-graph`, `:cross-axis-bridge-score`, `:tf-idf-per-axis`, feeling's
`:related-principles`. **This is the spine of the whole design.** Nodes literally point across axes:
`thinking/exact → intuition/property`; `feeling/calm → thinking/patience`. Pair-shape:
- **Stack:** "The *object* on the screen (sensation) follows a *pattern* (intuition), and the pattern
  keeps a *promise* (thinking), and Motoi explains it *calmly* (feeling)." One pair can climb all
  four rungs — **this is Wittgenstein's world assembling itself upward from objects** (§6).
- **Bridge interrogation:** high `:cross-axis-bridge-score` (e.g. `intuition/row` = 9) → "This idea
  lives in more than one place at once. Where else, and why?"

### Web 3 — GRAPH ↔ BOOKS (the corpus-home web)
Fields: `:appears-in-corpus`, `:cross-refs-books`, `:related-books`, `:first-appears-in-book-count`.
Pair-shapes:
- **Locate:** "Where in the books would I *read* about `exact`?" → real file list.
- **Concept-in-context:** pull the actual `:excerpt` (thinking nodes carry excerpts) and ask the
  model to explain the word *from that passage* — grounds the word in real authored prose.

### Web 4 — GRAPH ↔ WORLD (outside the books)
Fields (Sensation): `:sensory-description`, `:where-found`, `:size-scale`, `:kid-familiarity`,
`:everyday-object`; (Intuition) `:example-in-world`. Pair-shape:
- **Analogy-first:** "`X` is like [everyday thing you'd find in homes, schools, classrooms]." This is
  the **layperson bridge** — meaning tied to lived experience, not to a `.slat` file.

### Web 5 — GRAPH ↔ WORDS (the lexicon web + opposites)
Fields: `:synonyms`, `:oppositions`, `:contrast-register`, `:surrounding-words`. This is the pure
word-relationship layer Alfred called out ("relationships with words, their opposites"). Opposites
are load-bearing: they teach *boundaries of a concept*. Where honest-null, the "no opposite" pair is
itself a teaching (§5).

### Web 6 — GRAPH ↔ CODE (the verb web)
Fields: `:related-verbs`, `:used-in-programs-as`, `:example-in-scheme`, `:motoi-behavior`. Pair-shape:
- **Enactment:** "Show me `exact` *in real Scheme*." → `assert/check-with` in
  `Scheme/reference/06-assert.slat`. Ties the noun-graph back to the runnable verb surface —
  the bridge from Motoi's *noun-world* (CPT) to its *code-world* (SFT).

**Tying it together:** a single node participates in all six webs at once. The graph is the **join
table** that lets one word's pair-set reach into books, code, world, lexicon, siblings, and other
axes simultaneously. That simultaneity is the coverage multiplier.

---

## 3. Register & audience — kid / layperson / PhD, and the tone palette

Three audience bands, each an *extrapolation rule*, plus a **tone dial** driven by the Feeling axis.

### 3a. The three bands (who gets how much)
- **KID** — *seeded, deterministic, capped.* Bounded by the ~962 authored `:example-dialogue` seeds.
  We do **not** fabricate a child's voice. We paraphrase and re-tone the seeds we have, and reuse the
  child-register structure, but we never invent new kid turns beyond what the seeds and their safe
  paraphrases support ([[kid-seed-domain-extrapolate-asymmetry]], [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]]).
- **LAYPERSON** — *extrapolated by everyday-signal.* Routing: `:category :everyday-object` +
  `:kid-familiarity :common` + non-null `:where-found`/`:sensory-description`. These say "this can be
  explained by analogy to lived life." Layperson pairs lead with Web 4 (world) and Web 5 (plain
  synonyms), never with statistics.
- **PhD** — *extrapolated by topic-signal.* Routing: high `:tf-idf` + high `:context-entropy` + high
  `:cross-axis-bridge-score` + presence of `:definition-technical`/`:related-verbs`/`:invariant`.
  These say "this word has enough facets to sustain a seminar." PhD pairs lead with Web 2 (cross-axis
  stacking), Web 6 (formal code), and the statistical fields *as content* ("its context-entropy is
  9.06 across 204 documents — what does that distribution imply about its role?").

**The signal literally picks the audience.** A tier-3 long-tail word with entropy 0 gets one
layperson lookup line. `intuition/row` (freq 7534, entropy 9.06, bridge 9) earns the full PhD
treatment. No arbitrary caps — the node's own richness sets its depth.

### 3b. The tone palette (Feeling axis as style controller)
Alfred asked for kid variety — *terse, normal, explanatory, calming, excited, humorous* — and "others
that make our model smart." The Feeling axis's `:register-kind` values ARE that palette, already
authored and grounded. Proposed tone set (each is a real or register-derived voice, not a costume):

| tone | trigger / source | when Motoi uses it |
|---|---|---|
| **terse** | default compression | quick lookups, confident facts |
| **normal** | baseline | most explanations |
| **explanatory** | high `:context-entropy` nodes | multi-facet concepts |
| **calming** | `feeling/calm.motoi-uses-when` = errors, frustration | after a crash, when a child is stuck |
| **excited** | `feeling/*` joy/delight registers | a program first works, a discovery |
| **humorous** | light registers, safe content-rating | play, low-stakes exploration |
| **curious / wondering** | open questions, honest-null fields | "we don't actually know — want to find out?" |
| **reassuring-after-error** | Levinas/care + `:antipattern-scenario` | the wrong-way path, without shame |
| **story-mode** | `:example-in-world`, narrative books | grounding an abstract idea in a small scene |
| **precise/formal** | PhD routing | seminar register |

Crucially: **tone is not random decoration.** `feeling/calm` *tells us* calm is for error
explanations. So the Thinking-axis pair "you forgot to re-run the invariant check"
(`:antipattern-scenario`) should be voiced in the **calm** register the Feeling axis prescribes. The
axes compose: Thinking supplies *what is true*, Feeling supplies *how to say it*. That composition is
what makes the model feel like one coherent teacher instead of a fact hose.

---

## 4. The 16 philosophers as LENSES (not lessons)

Alfred: *"get me my philosophers. Not as a lesson but as a way of teaching and layering the graphs.
The lens. Is this about the world? the mind? belief? what?"*

A lens is a **traversal operator + answer-shape**. Each philosopher reads specific fields and emits a
specific *kind* of pair. The right-hand column answers Alfred's question directly: **what is this
lens about?**

| Lens | reads (fields) | pair-shape it emits | ABOUT |
|---|---|---|---|
| **Wittgenstein-early** | `:id`, `:oppositions`, `:appears-in-corpus` | "Is `X` a real thing in this world? Here are the facts that say so." | **WORLD** (facts about objects) — the ground floor |
| **Wittgenstein-late** | `:used-in-programs-as`, `:context-of-use`, `:example-dialogue` | "What does `X` *mean here*? — watch how it's used." | **MEANING** (use) |
| **Peirce (abduction)** | `:examples` → `:definition` | observation → best explanation. **Wraps every other lens.** | **METHOD** (inference) |
| **Frege** | `:canonical` vs `:definition`/`:definition-technical` | "Same word, two senses — which do we mean?" | **MEANING** (sense vs reference) |
| **Saussure / Derrida** | `:oppositions`, `:contrast-register`, `:distributional-neighbors` | "`X` means what it means *by contrast* with `Y`." | **MEANING** (value by difference) |
| **Aristotle** | `:category`, `:definition` | "`X` is a *kind of* ___ that differs by ___." | **WORLD** (the structure of things) |
| **Kant** | `:prerequisites`, `:precondition` | "What must be true *before* `X` is even possible?" | **MIND** (conditions of possibility) |
| **Hume** | `:associations` (PPMI) | "`X` and `Y` fire together — is that habit or law?" | **MIND** (association / custom) |
| **Quine** | `:cross-refs-graph`, `:surrounding-words` | "Touch `X` and the web trembles — what else moves?" | **BELIEF** (holism) |
| **Husserl** | `:sensory-description`, `:where-found` | "How does `X` *show up* to us before we theorize it?" | **WORLD-as-experienced** |
| **Ryle** | `:cross-axis-bridge-score`, cross-axis `:oppositions` | "Don't mistake a *pattern* (intuition) for a *thing* (sensation) — that's a category mistake." | **MIND** (avoiding confusion) |
| **Rawls** | `:motoi-behavior`, safety fields | "Would this rule be fair from behind the veil?" | **ETHICS** (fairness) |
| **Grice** | `:register-kind`, `:motoi-uses-when` | "Say enough, truly, relevantly, clearly — in the right tone." | **COMMUNICATION** |
| **Levinas** | feeling registers + child-frustration `:example-dialogue` | "The child is stuck; respond to *them* first, then the bug." | **ETHICS** (care / the face) |
| **Sartre** | `:used-in-programs-as` (many possible uses) | "`X` could be used these ways — you *choose*; own the choice." | **EXISTENCE** (freedom) |
| **Searle / Dennett** | `:definition` vs `:appears-in-corpus`; `:motoi-behavior` | "Presence in text ≠ understanding" / "read the code's *intent*." | **MIND** (intentionality) |

**How the lens layers the graph:** the same node, read through different lenses, yields *different
non-redundant pairs*, because each lens interrogates a different field-family. `thinking/exact` under
Aristotle asks its *category*; under Saussure asks its *opposite* (`approximate`); under Kant asks its
*precondition*; under Levinas asks *how to comfort the child who broke the invariant*; under
Wittgenstein-late asks *where it lives in real code*. Six lenses → six genuinely different teachings,
all from one node, none fabricated. **That is the layering.** The philosopher is the reason we get
diversity instead of six paraphrases of one sentence.

**The grounding stack (answering "is it world / mind / belief?"):**
```
   ETHICS / COMMUNICATION   (Rawls, Levinas, Grice)      ← how to act & speak         [Feeling]
   BELIEF                   (Quine)                       ← the web that can revise    [cross-axis]
   MIND                     (Kant, Hume, Ryle, Dennett)   ← the structure that knows   [Thinking/Intuition]
   MEANING                  (Frege, Saussure, W-late)     ← how signs get sense        [all axes]
   WORLD                    (Wittgenstein-early, Aristotle, Husserl)  ← things that are  [Sensation]
   ── grounded on OBJECTS (Sensation axis) ──  Wittgenstein: the limits of its world are the graph.
   (Peirce/abduction is the vertical girder — every layer is reached by inference-to-best-explanation.)
```
This is the literal reading of Alfred's instruction: objects ground a Wittgenstein world; meaning,
mind, belief, and ethics **stack from there**, and each philosopher is the lens that lets us *voice*
one layer of that stack from the graph's fields.

---

## 5. Honest-null is a positive teaching — the Wittgensteinian limit made trainable

> *"The limits of my language mean the limits of my world."* — Tractatus 5.6
> *"Whereof one cannot speak, thereof one must be silent."* — Tractatus 7

**This is the richest seam in the whole graph.** A `:honest-null-<field> #t` flag is not a missing
value — it is a **recorded boundary of Motoi's world.** It marks the exact place where the corpus
stops, where the signifier has no signified, where speech must turn into honest silence. Wittgenstein
draws that line as the point of philosophy; we have it *pre-computed, per-field, with a reason
attached* on thousands of nodes. That is a training signal almost nobody else has, because almost
nobody builds the corpus they train on ([[project_isb_sft_novelty_composition_2026_07_21]]).

A null is not one pair. It is a **family of limit-pairs**, each teaching a different competence at the
edge of the world:

| null-pair type | shape | what it teaches | lens |
|---|---|---|---|
| **The honest "no"** | "What's the opposite of `row`?" → "It doesn't have one — it's foundational." | refusal-with-reason, not confabulation | Wittgenstein-early (a fact can be *negative*) |
| **The drawn boundary** | "Is there a synonym for `X`?" → "Not one I can give safely." | knowing the edge of one's own knowledge | Tractatus 7 (silence as integrity) |
| **The named absence** | "Why no real-world example for `X`?" → "It's an abstract pattern; it lives in code, not the yard." | distinguishing *kinds* of unsayable | Ryle (category boundary) |
| **The deferred gap** | "…no verified example *yet* — it awaits the miner." | epistemic humility *with a horizon* (not-yet ≠ never) | Peirce (inquiry is ongoing) |
| **The structural silence** | a foundational node with no prerequisite chain | some things are floor, not derived | Kant (the unconditioned) |
| **The apophatic definition** | define `X` by what it is *not* and what it lacks | meaning carved by its limits | Saussure/Derrida (value by absence/*différance*) |

**Why the limit *teaches meaning*, not just caution:** in a difference-based semantics (Saussure), a
word is defined as much by what surrounds and opposes it as by what it is. An honest-null opposition
is therefore *positive information*: it says this concept is **not** one pole of a duality — it stands
alone. `intuition/row` having no opposite tells the model something true about `row`'s place in the
world that no filled field could. The absence **is** the content. Derrida's *différance* — meaning
deferred, present through what is absent — is not a metaphor here; it is literally how the null field
carries signal.

**The Book of Limits connection:** these null-pairs are the graph-side of Motoi's Book of Limits
([[project_broken_code_as_runtime_signal]] — the "honest-miss" discipline). Broken code teaches the
limit of *correctness*; honest-null teaches the limit of *knowledge*. Together they train a model
whose most valuable habit is knowing — and *saying* — where its world ends. For a child-facing
teacher that is not a weakness to paper over; it is the single most trust-building thing Motoi can do.
A model that says "I don't know, and here's the shape of why" is safer and smarter than one that
always answers. **The nulls are how we train that.**

**Yield note:** because every null carries a *typed reason*, the limit-pairs are as varied as the
positive ones — six shapes above × the tone palette (§3b: a limit voiced *calmly* vs *curiously* —
"we don't know yet, want to find out?" is a different, better teaching than a flat "unknown") ×
kid/layperson/PhD. The map's edges are as generative as its interior. *It's all right there.*

---

### 5b. Honest-null base cases (the concrete reasons already on disk)

**Live census (2026-07-27): 5,871 honest-null boundaries already flagged**, each with a typed reason —
so the limit-pair floor is 5,871 *before* tone/audience/lens multiplication:

| field | nulls | the limit it marks |
|---|---:|---|
| `surrounding-words` | 1597 | no reliable co-text (boilerplate-polluted) — awaits windowed miner |
| `appears-in-corpus` | 1312 | word not found in any real corpus file |
| `synonyms` | 776 | no *sense-safe* synonym (WordNet rejected — the `g→GHB` failure) |
| `definition` | 613 | tier-bare stub, no authored meaning yet |
| `relations` | 338 | no relation signal |
| `context-of-use` | 338 | no usage context mined |
| `oppositions` | 267 | **no true opposite — stands alone (positive info!)** |
| `prerequisites` | 212 | foundational — nothing precedes it |
| `example-in-world` | 177 | abstract; lives in code, not the yard |
| `example-in-scheme` | 177 | no verified code example *yet* |
| `cross-refs-books` | 62 | not yet cross-linked to a book |
| distributional / associations | 2 | isolated node |

Each row is a **different kind of unsayable**, and the reason column is what turns "empty" into a
teaching. Every `:honest-null-*` flag carries a **reason** (we wrote them 2026-07-27). Base cases:
- `intuition/row :oppositions → honest-null "no corpus opposition signal"` →
  **Q:** "What's the opposite of `row`?" **A:** "In Motoi's world, `row` doesn't have a clean
  opposite — it's a foundational structure, not one side of a pair. When a word has no true opposite,
  the honest answer is to say so." → teaches **epistemic humility + refusal-shape**
  ([[project_honest_null_is_training_signal_2026_07_22]]).
- `:synonyms → honest-null` (WordNet rejected — sense-blind; the `g → GHB drug-slang` failure in a
  child corpus is why): mints "I won't guess a synonym that might mean the wrong thing" — teaches
  **safe abstention**.
- `:example-in-scheme/world → honest-null "awaits miner"`: teaches "I don't have a verified example
  yet" rather than a fabricated one.

Honest-null pairs are the **negative space** that makes the positive pairs trustworthy. A model that
only ever asserts is a confabulator; the null pairs teach it *where the map ends*.

---

## 6. Worked example — one node, the full fan-out

Take the real node `thinking/exact` (all values below are on disk):
`:definition "Free of rounding…"`, `:oppositions ("approximate")`, `:principle-kind :correctness`,
`:related-verbs assert/check-with · assert/invariant · predicate/of · compare/equal?`,
`:cross-refs-graph → thinking/invariant, thinking/proof, intuition/property`,
`:short-scenario "…what always stays true about exact…"`,
`:antipattern-scenario "…forgot to re-run the exact check…"`,
`:cross-refs-books → book-of-scheme-one ch13, book-of-composition ch05`.

Non-fabricated pairs it yields (abbreviated — each also × tone × paraphrase-M):

1. *(Aristotle / def)* "What kind of principle is `exact`?" → "A correctness principle: free of
   rounding — a value is what it says, not almost-that."
2. *(Saussure / opposition)* "How does `exact` differ from `approximate`?" → contrast pair.
3. *(Wittgenstein-late / verbs)* "Show me `exact` in real Scheme." → `assert/check-with` in
   `06-assert.slat`.
4. *(Kant / precondition)* "What has to hold before an `exact` check means anything?" → its invariant.
5. *(Thinking H-family / short-scenario)* the positive do-this path, voiced **normal**.
6. *(Levinas + Feeling / antipattern)* the "you forgot the check, a friend got a wrong answer" path,
   voiced **calm** (Feeling prescribes calm for error moments) — *not* scolding.
7. *(Web 2 stack)* "`exact` (a promise/thinking) guards a `property` (a pattern/intuition)." →
   cross-axis pair, the connective tissue.
8. *(Web 3 books)* "Where do I read about keeping code `exact`?" → book-of-scheme-one ch13-invariants.
9. *(Quine / holism)* "If I stop checking `exact`, what else in the web stops being trustworthy?"
10. *(honest-null / synonyms)* "Give me a synonym for `exact`." → "I'll avoid guessing — the safe
    answer is its definition and its opposite, `approximate`."
11–13. Same content re-toned for **kid** (bounded to its authored `:example-dialogue` seed:
    *child: "Where does exact show up in real code?"*), **layperson** (analogy: "exact is like a
    recipe that says *exactly* 2 cups, not *about* 2 cups"), **PhD** (entropy/idf as content).

**One node → ~13 distinct teachings × ~10 tones × M paraphrases, all grounded.** Multiply across
tiers with the router in §3, cap kid-voice at the seed floor, honest-null the gaps, and the yield is
"thousands from the crown nodes, one clean line from the long tail" — which is exactly the corpus
*shape* the seed/extrapolate asymmetry predicts.

---

## 7. Pair-budget model (maximize coverage without inflating)

Per node, upper-bound pairs ≈

```
  Σ_over(non-null fields)  ×  applicable-lenses(field)  ×  audience-bands(routed)  ×  tone-variants  ×  M_paraphrase
     └ webs 1–6 ─────┘        └ §4 table ──────┘          └ §3a router ──┘          └ §3b palette ┘   └ Lacan kit ┘
```
with three hard governors so this never becomes fabrication:
- **Honest-null governor:** null field → exactly *one* "no-X" pair (its reason), never a guessed fill.
- **Kid governor:** kid-band pairs ≤ authored `:example-dialogue` seeds (+ safe paraphrase), never new
  invented child turns.
- **Tier governor:** tier-3 nodes get the layperson-lookup slice only; depth concentrates on the
  ~top-few-hundred crown nodes whose statistical fields justify it.

Coverage is maximized **across the corpus** (every word ≥ doc-freq threshold appears at least once,
so nothing is un-taught) while **depth** is spent where the signal is richest. That is the "maximum
coverage, maximum pairs, zero fabrication" target stated three ways.

---

## 8. Data-quality gates to run before generation (found while studying)

Real issues seen in the live data — must gate, or they poison pairs:
1. **Category-mislabel pollution:** `sensation/explanation` is tagged `:category :everyday-object`
   with `:sensory-description "an ordinary thing that turns up in daily life"` and a *"Should I make
   an explanation pickable?"* dialogue — a template artifact. Abstract nouns wrongly cast as physical
   objects will mint nonsense Husserl/world pairs. **Gate:** validate `:category` against a
   concrete-noun check before emitting Web-4 (world) pairs; route mislabels to honest handling.
2. **Template phrase-lock in `:example-dialogue`** ("Should I make a `X` pickable?" repeated across
   nodes) — the exact parallel-template failure Alfred banned. **Gate:** dedupe seed templates;
   prefer authored-varied seeds; treat lock-shaped seeds as *reference-only*, not paraphrase stock.
3. **`:distributional-neighbors (settledness steadiness) pending`** literal `pending` tokens in some
   feeling nodes. **Gate:** treat `pending`/malformed as honest-null, don't emit as content.

These are pre-existing authoring residue, not blockers — but pair-generation must **read the label
and the honest-null flag first**, exactly as [[feedback_check_preexisting_honest_null_before_authoring_2026_07_23]] requires.

---

## 9. One-paragraph summary

The four Jung graphs are a **join table over Motoi's whole corpus**: each node a signifier, each field
an edge into a different meaning-web (siblings, cross-axis, books, code, world, lexicon). We mint SFT
pairs by **walking edges**, voicing each walk in one of ~10 Feeling-derived **tones**, routed to
**kid/layperson/PhD** by the node's own statistical signal, and shaped by one of **16 philosophical
lenses** that each interrogate a different field-family — so one node yields a dozen *non-redundant*
teachings instead of a dozen paraphrases. Objects (Sensation) are the Wittgenstein floor; meaning,
mind, belief, and ethics **stack upward**, and `:cross-refs-graph` is the literal ladder. Honest-null
fields become "here's where the map ends" pairs. Kid-voice is capped at the ~962 authored seeds;
everything else extrapolates from real tag data. Maximum coverage, maximum depth where earned, zero
fabrication.
