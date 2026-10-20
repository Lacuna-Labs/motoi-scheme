# Alfred context dump — 2026-07-26 (running capture)

Alfred is giving a multi-part context download. Capturing live; consolidate load-bearing
pieces to memory when the thread completes.

## Part 1 — last week's arc
- Ran several tests last week.
- Started with **SFTs** → concluded we needed **CPT**. That conclusion WAS the test result
  (SFT alone insufficient; CPT is the missing layer).
- Established we **can run CPT on the 1.5B on the Mac mini** (feasible on that hardware).
- Payoff of the 1.5B CPT is not the 1.5B itself — it's the **SHAPE/recipe we use for Sakura**.
  1.5B on Mac mini = proving ground; output = the procedure Sakura inherits.

## Part 2 — "what are we doing right now" / the final touches
- The SHAPE of the notes: we learned that dispatching agents *en masse* to write => some
  would "die" (phrase-lock / failure). Bulk of work was done; remaining = final touches =
  the "power steps." Those final touches are now DONE. They were:
  1. **Reference manual pass** — verbs were uneven: some at 7 snippets, some 10, some 3,
     some with nothing, some documented somewhere odd. Got those right (15-fill).
  2. **Language was scattered** — made decisions, consolidated, got it right.
  3. **Various other parts of the language** — got those right.
  4. **Interpreter conformance** — verified full **SRFI + R7RS-small** compliance. Done.
- Now that those are finished, the next set:
  - **Book of Motoi** — a fantasy console needs its book. (DONE — 17 ch + appendices A–I,
    all gated green.)
  - **Qwen tag correctness for the data** — all training data must be properly tagged for
    Qwen. Qwen ships a host of tags (before/after = FIM, plus other code tags). I exploded
    those and put them into the **weave test**.
    - Tags I hold (memory: qwen-native-cpt-tokens): `<|repo_name|>`, `<|file_sep|>`,
      `<|fim_prefix|>` / `<|fim_middle|>` / `<|fim_suffix|>`. FIM = prefix (before) +
      suffix (after) → middle (fill). Wrap CPT docs w/ repo_name+file_sep; emit FIM
      variants of extracted code blocks. Chat template untouched (SFT-side).
    - Alfred: "it's kinda on you to remember" the full tag set. → my responsibility.

## Meta-point (Alfred, load-bearing framing)
- This whole procedure **only works because AI exists**. Not something one human at his
  cell phone could have done two years ago. "This is only possible because you exist...
  you have to take that carefully." Handle the responsibility with care.

## Part 3 — the closeout picture + Sakura strategy
- **Immediate:** finalize the data → FIRE CPT in ~30 min. "We're done. I'm done with these books."
- **After CPT → Sakura.** Sakura is a **variant / dialect / derivative** of Motoi (NOT a fork).
  - Because it's a variant, we do NOT re-solve anything in Sakura. We **copy Motoi's behavior over.**
  - Mechanism: **from Motoi, call a FLAG + give the dialect a name** → the **Curator dialect**.
  - Curator dialect = **core Motoi** (all fantasy-console goofballery) + a **layer on top**: shop
    verbs + our own AI + our own stuff — the layer the carts/our-stuff never used.
  - Proves: open-source mini-lisp → bigger project. And it's **BACKWARDS COMPATIBLE.** Win-win-win.
- **Why build copilot next:** same core serves both. Build once here in Motoi → Curator/Sakura
  inherit the base layer. Cortex is better over there → write improvement layers above it, base is
  already there.

## Part 3b — closeout rules for books/library before the fold (Alfred, sharp)
- **Honest-nulls in the LIBRARY/REFERENCE: implement the verb OR cut it.** "I don't want any honest
  nulls in my lib." A documented-but-unimplemented / coming-soon verb = implement or remove.
- **Cruft copied over with no purpose in the library → cut.**
- **Books that don't match the real library → gut the mismatched parts, OR make them additive to
  what we're actually doing.** "Let's close out."
- ⚠️ DISTINCTION I MUST HOLD: this is about the **reference/library** (unimplemented verbs). It is
  NOT the **graph honest-nulls** (empty semantic fields from genuine no-corpus-signal) — those STAY,
  they're training signal (memory: honest-null-is-training-signal). Different objects. Do not conflate.
- ⚠️ NO-DELETE RECONCILIATION (CLAUDE.md "No deletes. Ever."): when go is given, remove from the
  canonical/wired surface by parking in a dated `_archive/` (satisfies "out of my face" from the lib
  while honoring no-delete). Confirm hard-delete vs archive at act-time — Alfred earlier said "none
  should do that" then re-opened removal here, so get explicit go on the mode before acting.

## Directive right now
- **Don't start anything.** Continue work in flight, keep the notes. Alfred is going to read my
  research responses so we're on the same page. CPT-bound (~30 min).

<!-- more parts incoming -->


