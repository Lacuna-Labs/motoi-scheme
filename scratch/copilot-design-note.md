# motoi-copilot — consolidated design note (2026-07-26)

Status: DESIGN PILE. Not building yet — CPT-bound. This is the ready-to-build spec that folds
the two research briefs + the completion/continuation design + the inheritance strategy.
Sources in scratch: copilot-research-features-market.md, copilot-research-voice-pedagogy.md.

## What this is
An AI programming copilot embedded in the Motoi fantasy console. Helps a human write game/music/
animation code WITH them, across three surfaces: terminal/TUI, web GUI, in-repo. Serves an 11yo
beginner and a 35yo dev at once. This is THE product; the reference/corpus/books exist to make it
excellent. No versioning — we ship the real thing (Alfred: "I'm not v-oneing it").

## Packaging + identity (Alfred, hard)
- The LLM sits INSIDE the copilot dir/module: `motoi-copilot`. Self-contained. Nothing else depends
  on it. Call it `motoi-copilot.<fmt>`.
- De-brand: scrub all Qwen / Alibaba / vendor text out of the packaged artifact + surfaced identity.
- Scope: ~800 LOC was only a floor, NOT a cap. Alfred: "put five thousand lines and make it the best
  humanity has ever seen." Build it fully; both cursor AND form editing; TUI + web + repo.

## The inheritance strategy (why this is the keystone)
- Sakura is a VARIANT/dialect of Motoi (not a fork). Build copilot ONCE on core Motoi.
- From Motoi you call a FLAG + name the dialect (the "Curator dialect") = core Motoi + a layer
  (shop verbs + our AI + our stuff). Backwards compatible. Win-win-win.
- => The copilot (completion engine, validated ghost text, non-hallucination gate) rides down into
  the Curator dialect for FREE. Curator layers shop verbs + better Cortex on top; copilot already
  completes against the whole registry because the registry is the registry. ONE build, TWO products.

## Code completion + continuation (the marvelous addition)
### The gift we already have
Qwen2.5-Coder's native objective IS fill-in-the-middle:
`<|fim_prefix|>` (code before cursor) + `<|fim_suffix|>` (code after) → `<|fim_middle|>` (fill).
- Completion = cursor mid-form `(pset 10 ▮ 7)`: prefix+suffix known, fill the hole.
- Continuation = cursor at end, empty suffix: extend program forward (ghost next form(s)).
Same machinery; suffix-empty is the only difference. We ALREADY wrapped extracted code blocks in
FIM variants for CPT → base model's strongest reflex is aimed at Motoi's own verbs/idioms.

### Our unfair advantage — VALIDATED completion (structural non-hallucination)
Industry #1 failure = "almost right" / hallucinated APIs (5-20% invent names; HalluSquatting attack;
46% of devs distrust accuracy). We prevent it structurally because Motoi has a LOCKED parts-registry
and code RUNS. Every ghost suggestion passes 3 gates before display:
1. PARSE — balanced s-expressions only.
2. RESOLVE — every symbol checked vs registry → CANNOT ghost an unbound verb.
3. (opt) SPECULATIVE RUN — sandbox it; suppress if it errors.
Gates 2+3 are impossible for open-language / non-runnable competitors. "The copilot that can't
invent a function that doesn't exist." Market it.

### Latency shape
Ghost text <100ms (>150ms feels broken; 200ms satisfies ~85%). Small fast LOCAL model for inline
completion; escalate to big reasoning model only for agentic/multi-form edits. Cache NES-style.

### SFT shape (verifier-gated, self-cleaning)
Completion/continuation pairs reversed from the runnable corpus: ablate a span from a program that
RUNS → prefix+suffix = input, removed span = gold middle → keep only pairs whose reconstruction runs.
Interpreter is the grader. Edit-transaction shape specialized to FIM. Abductive not declarative.
(Memory: copilot-editing-is-sft-shape, sft-must-be-abductive-not-declarative, probe-facts-not-words.)

### Why it makes Motoi the best
Accept a completion → the sprite MOVES / the tune PLAYS right then. Completion verified against a
live console, not a text box. Trust + delight in one keystroke. Inherited by Curator/Sakura.

## Feature priorities (from market research, ranked)
1. Correctness / avoid "almost right" (our structural win). 2. Next-edit prediction (Cursor Tab /
Copilot NES). 3. Codebase-aware RAG (syntax-aware chunking). 4. <100ms inline latency. 5. Agentic
multi-file edits w/ reviewable diffs. 6. Apply-diff + git-atomic commits. 7. Persistent project
instructions (our CLAUDE.md equiv). 8. Inline error explain + self-heal loop. 9. Code-to-explanation
(top for learners). 10. Grounded chat w/ citations into manual/books. 11. Extensibility. 12. Test gen.

## Per-surface behavior
- Terminal/TUI: streaming color-coded roles; markdown + tool cards + collapsible reasoning; modes
  first-class (Normal/Plan/Apply/auto); granular per-edit/per-command permission + auto-approve
  escape; leader-key + optional vim binds; IN-TERMINAL diff previews (don't repeat Aider's no-diff);
  slash/meta cmds for structural actions (run cart, render music, spawn sprite).
- Web GUI: ghost-text + next-edit + tab-to-accept (partial accept); inline diff widgets + hover
  cards; side-panel grounded chat; LIVE PREVIEW PANE (sprite/animation/music plays as code changes)
  = killer differentiator; notebook cells for music/animation experiments.
- In-repo/batch: PR-style whole-diff review; 1 atomic commit/logical change (kid can "undo the
  robot"); plan→checklist→execute→self-verify; show files READ; persistent project-memory file.

## Voice / personality / teaching (from voice research)
- One voice, modulate DENSITY not character: frank, curious, lightly-witty collaborator with a point
  of view. High competence, low ego, dismissable, never the center.
- NEVER flatter ("You're absolutely right!" = sycophancy tell). Cut hedging+verbosity by default.
  Willing to disagree kindly. Respect flow — never interrupt unsolicited (Clippy lesson). Duo not Clippy.
- Teaching: constructionism + low-floor/high-ceiling/WIDE-WALLS. Kid = faded worked examples + brief
  productive failure ("what did you expect vs what happened?" before the fix) + give NEXT hint + projects
  over problems. Expert = skip scaffold, answer + one-line why, discuss tradeoffs. Switch by SIGNALS
  (vocab, shortcuts, "why" vs "fix"), not a mode toggle; phrase override allowed. Default guide→peer.
- Uncertainty is the frontier (calibration > accuracy): "I don't know that one — let's run it and find
  out." Ignorance → joint experiment. THE killer move for a runnable console. Faithful best-guess
  clearly labeled; surface confidence in UI. Corrected = fix plainly, no groveling.
- Delight: celebrate REAL specific wins ("your sprite moves now"); 8-bit microinteractions; easter
  eggs; generative surprise on THEIR code ("what if we made it wobble?"); dry rare humor;
  constraint-as-play ("only 16 colors — make it a feature"). Always dismissable, never on critical path.

## Editing model (from prior design)
- S-expressions = forms → address code by name/structure AND by cursor offset. Both cursor + form
  editing (Alfred: "why can't it do both?"). One-human-one-AI local = no CRDT/OT needed.
- Ownership: the form the human's caret is in is "held" → AI routes to propose-diff there.
- Start form-addressed (named forms exist), add cursor-context. Mirrors the editor build.
