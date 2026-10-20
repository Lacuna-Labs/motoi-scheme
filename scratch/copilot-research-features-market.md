# Motoi-Copilot — Features / Market state-of-the-art brief (2026-07-26)

Source: background research agent (a55837515ec1d5b7a). Feeds copilot design.

## Market in one line
84% of devs use/plan AI tools BUT trust low: 46% distrust accuracy vs 33% trust (~3% "highly trust").
#1 frustration (45%) = "almost right, but not quite" — makes debugging SLOWER. Experienced devs
most skeptical. => TRUST + CORRECTNESS IS THE PRODUCT, not a feature. (Stack Overflow 2025 Survey.)

## Leading tools — loved/hated (condensed)
- GitHub Copilot: most adopted, lowest friction, everywhere. Next Edit Suggestions (NES) = separate
  low-latency model predicting WHERE+WHAT you edit next. Hated: jack-of-all-trades, hallucinates
  vs instructions, sycophantic, forgetful, credit billing.
- Cursor: pro benchmark. Tab predicts next EDIT across file ("writes 5-10 lines before you think").
  Hated: bill-shock, degrades on big repos, high-confidence-wrong autocomplete.
- Claude Code: terminal agent, loved for autonomous multi-step (explore→plan→edit→run→self-fix).
  CLAUDE.md, skills, subagents, slash cmds, hooks, MCP, 9000+ plugins. Hated: credit burn, needs review.
- Windsurf (Cascade): high autonomy, auto codebase indexing, fewer approvals. Hated: no persistent
  project instructions.
- Aider: OSS terminal pair. Git-atomic (1 commit/change), tree-sitter repo map. Hated: NO visual diff.
- Warp: best AI terminal. Zed: ms latency in huge repos. Cody: codebase context but slow index.
  Continue: OSS bring-any-model. Replit Agent: BEST for beginners/education, explains in plain English.
- Best-dev pattern: pair TWO tools (inline IDE + terminal agent). We own all 3 surfaces → must be
  good at both modes.

## What matters most (ranked)
1. Correctness / avoid "almost right" (#1 frustration). Our locked R7RS+registry = structural win.
2. Next-edit prediction (not next-token) — Cursor Tab / Copilot NES most-praised.
3. Codebase-aware RAG — biggest lever vs hallucination; syntax-aware (tree-sitter/AST) chunking.
4. Low latency inline: <100ms ideal, >150ms feels "broken", 200ms satisfies ~85%.
5. Agentic multi-file edits w/ REVIEWABLE diffs.
6. Apply-diff + git-atomic commits (audit/bisect).
7. Persistent project instructions (CLAUDE.md — "game changer"; absence = Windsurf's top knock).
8. Inline error explanation + self-healing fix loop.
9. Code-to-explanation ("explain in plain English") — top feature for LEARNERS.
10. Grounded chat with citations. 11. Extensibility (slash/skills/subagents/hooks/MCP/plugins).
12. Test generation + auto-run.

## Per-surface design
- Terminal/TUI: streaming color-coded roles (blue user/green assistant/yellow system); markdown +
  tool cards + collapsible reasoning; modes first-class (Normal/Plan/Apply/auto); granular permission
  engine (per-edit/per-command + auto-approve escape); leader-key + optional vim binds; IN-TERMINAL
  diff previews (don't repeat Aider's no-diff gap); slash/meta cmds for structural actions (run cart,
  render music, spawn sprite).
- Web GUI: ghost-text + next-edit + tab-to-accept (partial accept); inline diff widgets + hover cards;
  side-panel grounded chat; **LIVE PREVIEW PANE (sprite/animation/music plays as code changes)** =
  our killer differentiator; notebook cells for music/animation experiments.
- In-repo/batch: PR-style whole-diff review; 1 atomic commit/logical change; plan→checklist→execute→
  self-verify; show which files it READ; persistent project-memory file (our CLAUDE.md equiv).

## Trust / failure modes to avoid
- Hallucinated APIs (5-20% invent names; "HalluSquatting" supply-chain attack). FIX: RAG-ground in
  reference manual; hard-validate every emitted verb vs parts-registry before showing. WE CAN REFUSE
  TO EMIT AN UNBOUND SYMBOL.
- "Almost right" — prefer fewer verified suggestions; say-so + cite when unsure.
- Ignoring instructions / forgetting context — persist + honor; show what context was used.
- Over-eager/high-confidence-wrong — calibrate; suppress low-confidence ghost text.
- Sycophancy — models capitulate ~88% even when user wrong. Dangerous for a trusting kid. Neutral;
  don't agree to please; internal "case for/against" on debatable calls.
- Unasked-for changes — never touch files outside stated task; scope + show diff first.
- Slowness — 90s spin-ups kill flow. Cache; small fast LOCAL model for inline, escalate to big model
  for agentic (local-cloud cascade).

## What makes OURS best-in-class / novel
1. STRUCTURAL non-hallucination guarantee — closed R7RS-subset + locked parts-registry → validate
   every verb before it reaches user. "The copilot that can't invent a function that doesn't exist."
2. LIVE audiovisual feedback loop — every edit plays (sprite/tune/animation). Correctness mechanism
   + delight for an 11yo. No mainstream copilot has real-time multimodal output as verification.
3. Dual-persona explanation depth — same fix, two registers (plain-English "why" for kid, terse diff
   for dev), driven by the corpus/books we authored. Teaches while it codes.
4. Reference-grounded chat with citations back into manual/books (native RAG — we wrote the manual).
5. Plan-first, permission-granular agent across all 3 surfaces with ONE mental model. Owning all
   three coherently is itself the differentiator.
6. Atomic, reviewable, undoable edits — a kid can always "undo the robot" safely → more experimentation.

## Design numbers to hold
<100ms inline latency (>150ms broken; 200ms satisfies 85%). Small fast local model for ghost-text,
escalate to big model for agentic work.
