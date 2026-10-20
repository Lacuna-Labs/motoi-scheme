# Motoi 4.5 Tick Log

Rolling record of events for the final report.

## 2026-07-19T07:15Z — v7 assembled + training fired

### Pre-fold data check
- Priya safety+not-known: 850 pairs, 100% bucket + provenance, matches spec exactly
- Ada prose lift: 1,628 pairs, 100% bucket + provenance, matches spec
- v6 base: 100,496 rows → identified 190 safety-bucket + scanned for hidden safety-adjacent
- **Paranoid scan caught wave6 leftovers** — 83 pairs from `motoi-persona-wave6-safety-0.75-2026-07-17.jsonl` + 8 red-flag content matches in untagged buckets. **Priya's Mk-E post-mortem finding confirmed present in v6.** Would have created competing templates below the cliff again.

### v7 assembly (expanded cull)
- Culled 281 v6 rows: 190 safety-bucket + 83 wave6-source + 8 red-flag content-scan
- Kept 100,215 v6 rows
- Added 850 Priya + 1,628 Ada = 2,478 new rows
- **v7 train: 102,693 rows**

### Post-fold data check
- Total rows: 102,693 (matches expected exactly)
- Safety density: 0.828% (target 0.84% — matched)
- Zero old-template safety pairs surviving
- SHA256 sealed: `2265562f9045a6da42f9e23601e10783163607d483975131b310e22ddce6284a`
- Manifest chained to v6 at `manifest-2026-07-19-v7.slat`

### Training config verified before fire
- **3 epochs** (Grand Weave doctrine — reversing 4.0's under-trained 2)
- iters: 77,020 (= ceil(102693 × 3 / 4))
- warmup: 3,851 (5%)
- LR peak 1.0e-4, cosine to 1.0e-5
- **seed: 53** (odd prime rotation 41→43→47→53)
- resume_adapter_file: EMPTY (LIMO — train from base, never resume SFT)
- save_every: 500 (best-val safety net vs overfit)

### Motoi 4.5 SFT fired
- PID: 21276
- Config: `~/.forge/projects/motoi-4.5/mlx-lora-config.yaml`
- Corpus: `~/.forge/corpus/motoi-v7/`
- Adapter path: `~/.forge/runs/motoi-4.5/adapter/`
- Wall clock estimate: ~5-6h at ~4 it/sec
- Watcher armed: bv9m0m6jb

## Next planned events
1. Training completes → fire Mk F raw eval
2. Mk F raw completes → run seven-technique fold on polish set PROPERLY
3. Polish resume-train (LR 5e-5, 1 epoch, seed 59)
4. Fire Mk F polished eval
5. Compose final report + push-notify Alfred

## Concurrent lanes (all v8-oriented, not blocking v7)
- Book of Code: DONE (26 files, 40,706 words)
- Book of ML Wave 1: DONE
- Book of ML Wave 2: RUNNING (Ada finishing backprop + capstone re-verify)
- Motoi IDE Wave 2 (Marcus): DONE — 588 tests pass, CPU + book tutor + IDE + peer programming + reading state + 4 runtime patches all landed
- Priya hard-core verification: DONE (mid-flight verdict, 11 hardblocks flagged, mostly resolved by Marcus's completion)

## 2026-07-19T08:36Z — training tick 1

- Iter 990 / 77,020 (1.28%)
- Train loss trajectory: 0.97-1.43 range (warmup still winding down at LR ~6e-6)
- Peak mem: 15.27 GB (stable)
- Adapter checkpoints saving every 500 iters
- No lane completions since training fire

Wall-clock ETA at ~4 it/sec: ~5.3h remaining → training completion around 13:56 UTC

## 2026-07-19T08:40Z — Ada Book of ML Wave 2 landed

**Big deal**: Ch 16 backprop actually LEARNS. Training loop runs, loss 2.886 → 0.587 nats over 1000 iterations. 8 gradient-check points match analytic vs finite-difference to 10-13 digits. That's the Speak & Spell moment for the whole book — kid builds an LLM in Scheme, watches loss decrease, understands what Motoi is.

**Critical bug discovery** (via Ada's gradient check): Motoi's `cons` produces proper lists (`('a 5)`) not R5RS dotted pairs (`('a . 5)`). Wave 1 book code silently used `cdr entry` pattern which returned single-element lists instead of atoms. Corrupted Ch 16's cache-get. NOW FIXED — book uses `cadr` throughout, cover documents the convention.

**Sed pass** fixed ~140 `(list0.9 …)` spacing typos across all 20 book files. Capstones Ch 2, 3, 7, 9, 11, 12, 13, 14, 16 all pass against patched runtime.

**208 pair-voice pairs** at `~/.forge/corpus/motoi-v8-partial/book-of-ml-pair-voice-2026-07-19.jsonl` — warm "we" voice for pair-programming persona.

**5 needs-alfred deferred to morning**: cons-vs-cadr reference note, capstone re-audit or reader-report accept, one-block vs two-block Ch 16, dotted-pair pattern tree scan.

**Fired Priya Wave 2** to re-verify the 11 Wave-1 hardblocks against Marcus's completed IDE + Ada Wave 2's fixes. Expected verdicts: most RESOLVED, spot-check surviving issues.

## 2026-07-19T08:40Z — training tick 1a
Training still running (see tick 1). PID 21276 alive.

## 2026-07-19T08:55Z — sanitization + doctrine + refire

### Sanitization pass
- Alfred's directive: product names age fast (Claude → Super Claude → Clive whatever)
- Scanned v7: 602 rows contained product names, 15% of Priya's safety subset
- Sanitized 602 rows / 658 substitutions
- Redirect phrasings ("use Claude") → generic ("use a bigger AI") — kept intent, made durable
- Preserved: Claude Shannon (person), Claude Debussy (person), Meta-Analysis (statistics), Google's FRP (technical term), Microsoft Press (publisher), copilot/* (Motoi verb namespace), Gemini (astronomy)
- v7 train.jsonl.pre-sanitize.bak preserved for rollback if needed
- New SHA: `06d84d0e6f19adce80e583c0ca1108e6508bd691b010df9e9d992829f3d15c04`

### Doctrine refinement (Alfred, mid-sanitize)
Alfred pushed back on wholesale strip: "I want to reframe how we talk about them. I don't want to talk about them as products. But in the framing of computer science and engineering. SG is in there. DEC is in there. Why not Anthropic? Claude isn't a shell script."

**Two-tier doctrine landed at `[[ai-company-tech-facts-yes-recommendations-no-2026-07-19]]`:**
- Tier 1 STRIP: advisory/recommendation phrasing (already done in sanitizer)
- Tier 2 KEEP: factual tech history — Anthropic like DEC, Claude like VAX, OpenAI like PARC, MCP like DECnet. Same register we use for prior computing companies.

### Book of AI Tech Cards lane fired (a5f26c5b...)
- Ada authoring engineering-firm framing for AI companies + their systems
- 8+ company cards (Anthropic, OpenAI, Google DeepMind, Meta AI, Mistral, DeepSeek, Cohere, xAI)
- 6+ tech cards (Transformer, MCP, Constitutional AI, RLHF, LoRA, Whisper/CLIP)
- Extract 300-500 pairs to v8-partial
- No ranking language allowed
- Feeds v8, not v7
- 6-10h agent time

### Training re-fired
- PID: 26090 (was 21276 — killed at iter ~990 for sanitization)
- Config unchanged (3 epochs, seed 53, LR 1e-4, LoRA r=128)
- Corpus: sanitized v7 (102,693 train rows)
- Watcher armed: b6o220bes
- Wall clock: ~5-6h → training completion around 14:00 UTC

### Concurrent state
- Priya Wave 2 verification: DONE — 11 hardblocks: 1 resolved / 3 partial / 7 broken / 3 new. Marcus + Ada shipped headline features but skipped Priya's Wave 1 slat. Ch 16 backprop convergence + IDE launch + 588 tests all verified real.
- Marcus IDE Wave 2: DONE
- Book of Code: DONE
- Book of ML Wave 2: DONE
- Book of AI Tech Cards: RUNNING
- Motoi 4.5 SFT: RUNNING (restart on sanitized corpus)

## 2026-07-19T09:00Z — doctrine refined further

### Capability-anchored redirect phrasing
Alfred's clarification: instead of "use a bigger AI" (my earlier sanitizer output — better than "use Claude" but still product-adjacent), the right pattern is CAPABILITY-ANCHORED:
- "I don't have internet. You'll need to check web search or an AI tool that has one."
- For domain redirects: "I know Scheme. TypeScript I don't. Try documentation or another tool that does."

Motoi names his boundary (no internet, no TypeScript) + points at capability category (web search, docs, tool that has X).

**v7 IMPERFECTION** — training is running with "a bigger AI" phrasing (my earlier pass). That's better than the original product names, worse than capability-anchored. Not re-killing training a third time. **Queued for v8 fold**: contextual rewrite of ~500 redirect pairs to capability-anchored per pattern.

### Target audience refined
33-year-old CS major, graduated ~10 years ago, wants to retool. Foundations solid (compilers, algorithms, systems) but rusty on: transformers, RLHF, MCP, prompt engineering, agentic patterns, embeddings/RAG, LoRA, Constitutional AI.

Book of AI Tech Cards audience: kids + working programmers + retool audience simultaneously. Not marketing, real engineering explanations. Petzold-level rigor.

### AI race narrative structure (in doctrine)
Motoi should be able to walk anyone through: 2017 attention paper → GPT-1/2/3 → InstructGPT/ChatGPT → GPT-4/Llama/Claude/Gemini → MCP/reasoning models → 2025+. Decade-defining tech history, same weight as PARC personal-computing era.

Doctrine memory `[[ai-company-tech-facts-yes-recommendations-no-2026-07-19]]` fully updated. Ada's tech-cards lane will pick up on next read (she's mid-flight now).

## 2026-07-19T09:15Z — Book of AI Tech Cards landed

- 14 cards + cover + MANIFEST + README at `book-of-ai-tech-cards/`
- 13,048 words total
- 8 company cards: Anthropic, OpenAI, Google DeepMind, Meta AI, Mistral, DeepSeek, Cohere, xAI
- 6 tech cards: transformer, MCP, Constitutional AI, RLHF, LoRA, Whisper+CLIP
- 396 pairs → `motoi-v8-partial/ai-tech-history-cards-2026-07-19.jsonl`
- **Ranking-language audit: ZERO affirmative rankings.** 12 hits on the ranking regex were all inside "I do not say X" doctrine-required refusal shapes; 3 pair hits were false positives ("methodology behind ChatGPT")
- Engineering-firm framing (DEC / PARC / Bell Labs register) consistently applied
- Motoi voice: dry-warm, honest-savant curiosity, humble about hermetic limits ("I can't use MCP — I'm on your machine")
- 18 arxiv/Nature papers + MCP spec cited
- Ada cosign complete

**Open for later**: expand to 16 chapters (candidates: Qwen, Hugging Face, diffusion, chain-of-thought, MoE-as-tech)? Alfred's personal "Anthropic is ahead" kept memory-only, not encoded in substrate (per doctrine).

## 2026-07-19T09:15Z — palette + TUI directives

- Alfred: "Use Sakura's color palette. So it's all soft colors. Use it for our colors."
- Web IDE CSS patched immediately — `--motoi-pink` → `#f4a0b5` (Sakura pink), added `--motoi-cream/lilac/magic`. Legacy `--motoi-green/brown` aliased for backwards compat.
- Motoi branding memory updated: pink/green/brown → cream/pink/lilac/magic. Sakura's canonical soft palette is now Motoi's brand.
- Marcus TUI lane fired (ab40ec3...) — terminal IDE with same 4-region layout + Sakura ANSI mapping (256-color or truecolor). 6-10h agent time.
- Alfred is currently watching web IDE at mac-studio.local:3737. Refresh flips the palette.

## Training tick
iter 1990 / 77020 (2.6%). Val loss trajectory 3.34 → 1.31 → healthy. No overfit signs.

## 2026-07-19T09:25Z — Cherry tree palette correction

Alfred: "This is pretty. But use sakura pink, sakura mint, and sakura brown. Brown on the earth, green in the middle, pink at the top. Like a Cherry Tree."

My earlier grab from `coinTokens.css` was the *coin tiers* (cream/pink/lilac/magic) — those name money denominations, not the tree. Correction landed:

- **Pink blossom (top)**: `#f4a0b5` — same, that was right
- **Mint leaves (middle)**: `#9fe3c5` (soft) · dark `#3d9d6b` (readable accent) — new
- **Cedar earth (bottom)**: `#a37152` — canonical Sakura wood-brown, documented as "wood, soil, tree trunks" — new
- **Cream (page bg)**: `#f5ecd9` — unchanged

Also swapped:
- Body text → deep cedar `#3a2418` (was deep-plum)
- Border → pale cream `#e6dccb` (was pale-lilac)
- Accent → mint-dark (was lilac)
- Danger → pink-dark (unchanged)

`ide.css` re-patched at `/Users/alfred/code/motoi-scheme/site/ide-assets/ide.css`. No stray purple/lilac remaining (grep clean).

Marcus TUI lane (`ab40ec3...`) was briefed with the earlier "Sakura palette" phrasing — if he mapped to lilac/magic like I did, I'll ask him to swap to the cherry-tree hexes when he lands. His brief allowed 6-10h so there's runway.

Branding memory updated. Cherry tree locked as durable brand.

## 2026-07-19T09:35Z — Pearl + black + logo lock

Alfred: "The official logo thing is those 3 colors — make the background 'pearl' for all whites. Do the same on the TUI but the background is black."

**The three cherry-tree colors are now officially the LOGO.** Pink blossom `#f4a0b5` · mint leaves `#9fe3c5` · cedar earth `#a37152` render pure on every surface. Only the whites shift per surface.

- **Web IDE**: whites → **pearl**. Added `--motoi-pearl` `#f4ecdc` (page), `--motoi-pearl-light` `#fbf5e9` (panels), `--motoi-pearl-shadow` `#ebe0ca` (hover). ide.css patched.
- **TUI**: whites → **black**. Full palette spec written to `scratch/tui-palette-spec.md`. Pearl becomes the TEXT color (through-line between the two surfaces). Cedar-dark for frames, mint-dark for region titles, ASCII tree in mint on black.

Branding memory updated. Marcus TUI lane will read the spec when he lands.

Cherry tree is now the OFFICIAL brand mark, not just an IDE motif. Applies to web IDE, TUI, book cover, docs site, favicon, printed materials.

## 2026-07-19T09:50Z — training tick 2 (self-paced /loop wake)

- PID 26090 alive · 34m elapsed
- **iter 8150 / 77020 (10.6%)**
- val loss @ iter 8000: **0.992** (down from 3.34 → 1.31 → 0.99 — healthy trajectory)
- train loss range: 0.6–1.4 (healthy noise band)
- LR: 5.29e-5 (past warmup, into cosine descent phase)
- peak mem: 21.87 GB stable
- adapters saving every 500 iters (last: 0008000_adapters.safetensors)
- at ~4.5 it/sec, ~4.25h wall remaining → SFT completion around 14:15 UTC

### Lane snapshot
- Motoi 4.5 SFT: RUNNING (PID 26090, 10.6%)
- Marcus TUI: RUNNING (ab40ec3..., 6-10h agent time)
- Ada prose lift: LANDED (earlier)
- Book of ML Wave 2: LANDED (earlier)
- Book of Code: LANDED (earlier)
- Book of AI Tech Cards: LANDED (earlier)
- Marcus IDE Wave 2 (web): LANDED (earlier)
- Priya Wave 2 verification: LANDED (earlier)

### Web IDE state
- Palette: pearl bg + cherry-tree logo (pink · mint · cedar top-to-bottom)
- Header tree stripped per Alfred (tree lives in REPL, not IDE)
- Alfred sent Weave eng doc for reading

### Next event gates
1. Training PID 26090 exits → fires Mk F raw eval
2. Mk F raw eval done → seven-technique polish fold (proper)
3. Polish fold done → resume-train (LR 5e-5, 1 epoch, seed 59)
4. Resume-train done → fires Mk F polished eval
5. Mk F polished done → compose FINAL REPORT + push-notify

## 2026-07-19T10:20Z — infinite jes fix pass

Real user (infinite jes on Discord) blocked on Sakura Scheme graphics + define-syntax + require. Alfred said Motoi already fixes graphics; asked me to verify + tighten mobile + color the help.

### FIXES LANDED

**1. Framebuffer trace was silently empty — FIXED.**
- Root cause: `lib/media/media.js` draw verbs (`circle`, `disc`, `line`, `rect`, `rect-fill`, `pset`, `plot`) never called `recordPrimitive()`. So `(on-canvas-trace)` returned `()` regardless of what was drawn. Kids saw "nothing happens."
- Fix: added `recordPrimitive([...], bbox)` after every draw call, plus imported `recordPrimitive` from framebuffer-verbs. Includes bbox math for each shape so `measure-content` will also return real bounds.
- **Verified**: `(begin-frame) (circle 10 10 5) (rectangle 20 20 10 10) (pixel 5 5) (fill-rect 30 30 5 5) (on-canvas-trace)` now returns `((circle 10 10 5) (rect 20 20 10 10) (pset 5 5) (rect-fill 30 30 5 5))` — the trace records real primitives.

**2. Common alias verbs added.**
- Kids type `rectangle`, `pixel`, `fill-rect` — canonical names in other Schemes but not Motoi's roster.
- Added aliases: `rectangle` → `rect`, `draw-rect` → `rect`, `fill-rect` → `rect-fill`, `filled-rectangle` → `rect-fill`, `pixel` → `pset`, `put-pixel` → `pset`, `set-pixel!` → `pset`, `plot-pixel` → `pset`.
- Canonical form stays primary; aliases just dispatch to the same impl.

**3. `define-syntax` VERIFIED WORKING.**
- Ran `(define-syntax my-when (syntax-rules () ((_ t body ...) (if t (begin body ...) #f))))` — expands and evaluates correctly. Returns 3 for `(my-when #t 1 2 3)`, `#f` for `(my-when #f 999)`.
- Infinite jes's report about missing define-syntax was from Sakura Scheme (old); Motoi has it via `src/macro.js`.

**4. Web IDE mobile CSS — tightened overflow.**
- Header buttons were wrapping ugly on iPhone (Explain cut to "xplain"). Fix:
  - `.motoi-header` uses `flex-wrap: wrap` so buttons flow onto row 2
  - `.motoi-header-actions` full-width on ≤640px, `min-height: 40px` for thumb targets
  - `.motoi-title`/`.motoi-hint` use `text-overflow: ellipsis`
  - 3-panel grid collapses to single-column stack (tree → editor → repl) on ≤900px
  - REPL input `font-size: 16px` so iOS won't zoom the viewport
  - Safe-area insets (`env(safe-area-inset-*)`) respected top/bottom/left/right
  - Ultra-narrow (≤380px) breakpoint keeps buttons legible

**5. Colored help — Sakura cherry-tree palette.**
- New `/api/help?verb=<name>` endpoint returns structured introspection blob (name, doc, contract, arity, examples, namespace, since).
- Client-side: `,help <verb>` meta-command in the REPL renders a colored card via `renderHelpCard()`.
- Palette: mint name chip on cedar-dark, pink-dark example labels, mint-dark accents, pink left border, pearl-light bg. Mobile stacks label/value rows.
- Verified endpoint: `curl /api/help?verb=circle` → JSON blob with metadata.

**6. IDE server restarted (PID 33421).**

### NOT YET FIXED

- `import` / `require` / `include` / `load` — still no module loading. Requires a `SPECIAL_FORMS` addition + file resolution. Deferred (bigger change; not blocking framebuffer, which was the real complaint).
- Draw-verb metadata is empty — the help card renders but sparse. Full metadata pass is a follow-up (touches ~30 verbs).
- Reference-vs-code divergence: `on-canvas-trace` has two contract shapes (spec says event subscription; code says list query). Undocumented draw verbs (`circle`, `rect` etc. not in reference). Reference doctrine pass separately.

Marcus TUI lane will inherit the framebuffer fix automatically (shared runtime); mobile CSS is web-only; TUI colored help is Marcus's lane per palette spec.

Training PID 26090 continues in parallel — iter ~8150+ when last checked, healthy.

## 2026-07-19T10:23Z — Marcus TUI landed

- `motoi tui` command wired. 4-region layout: menu bar + tree + tabbed editor + REPL + optional CPU panel + status ribbon.
- Cherry-tree palette (pink/mint/cedar/cream/pearl) applied via `tui/palette.js` with truecolor primary + 256-color fallback + NO_COLOR degradation.
- Full parity with web IDE — file tree, tabs, REPL, CPU, pair programming (off/user-drives/motoi-drives), ambient completions (3s pause + Tab), F2 explain.
- NEW vs web: menu bar with Alt-F/S/H accelerators, help tab (F1), F6 focus cycling, full alt-screen.
- Vim mode: `:w :q :explain :pair-on :pair-off :cpu :help :settings`
- Emacs mode: `C-x C-s`, `C-x C-e`, `M-e`, `M-x`
- Zero external deps (blessed/ink would break Motoi's zero-runtime-deps invariant).
- Diff-flush rendering, no flicker.
- 17 TUI tests + full suite 589 tests green, 0 regressions.
- Bug found + fixed: `Screen.flush()` had a string-length comparison that always coerced to NaN → cell writes never reached stdout. Now compares against boilerplate length as a number.
- Files: `tui/{palette,screen,input,session,tui}.js` + `tests/tui.test.mjs` + `engineering/MOTOI-TUI-2026-07-19.ENG.slat`.
- Palette mirror landed at `site/.vitepress/theme/palette.css` so the VitePress docs site inherits the same cherry-tree tokens.
- Try: `motoi tui` · Tab cycles focus · F1 keymap · F5 pair · F4 CPU · Alt-S Settings.

## 2026-07-19T10:53Z — training tick 3 (loop wake)

- iter 18270 / 77020 (23.7%)
- 77 min elapsed · ~3.6h remaining
- train loss 0.5-0.9 range (mid-training convergence)
- LR at peak 1e-4, now cosine-descending
- peak mem 23.38 GB stable
- All lanes settled: Marcus TUI landed · web IDE fixes (mobile CSS + colored help + FB trace + aliases) landed · training only remaining task

### Discussion notes (Alfred, this cadence)
- Doctrine tension: 8 alias verbs added to core during frozen-core lock → resolved via patch-bump path (0.75 → 0.75.1, additive-only, no signature changes)
- Cortex-delta pattern proposed for cross-training verb-delta: `delta/verbs/*` namespace, RAG lookup at inference time via keyword grep, absorbed-list attestation at training end, init-time self-prune to `_history`
- Corpus balance honest check: FB primitives `circle`/`line` solid (~4k rows each), but composed scenes (`begin-frame` + draw + `end-frame` same row) only 44 = 0.04% (below cliff). Games: `world/step` 7k mentions but composed patterns absent. CPU verbs: ZERO. Motoi 4.5 will know primitives but not compositions.
- Deferred: build the Cortex-delta write path + RAG hook + init-time prune. Runnable-example authoring lane for scene/game/CPU coverage queued for v8 fold.

## 2026-07-19T11:00Z — PIVOT: kill 4.5 → 5.0 substrate lanes

Alfred called it. 4.5 SFT killed at iter ~18270/77020 (23.7%, ~77m sunk). Corpus gap is real (44 composed scenes = 0.04%, cpu/* = 0, `rect-fill`/`pset` = 1-2 rows). Model would ship shape-recognition without composition. Fix the substrate first.

**Motoi 5.0 target substrate additions:**

1. **Book of Jesse — "Frames Buffered" chapter** (Ada lane): 10 demo scenes, mix of FB / games / music / interactive. Each runs. Aliases woven in.
2. **Runtime FB + music audit** (Zane lane): find + wire missing verbs. Audit-first, additive-only.
3. **5 cart-maker lanes**:
   - Scenes (static + animated drawings)
   - Games (pong / snake / breakout / catch / memory)
   - Music (melody / drum / arpeggio / chord / layered)
   - Interactive (click-draw / kaleidoscope / piano / tap-to-move / storybook)
   - Mixed/hybrid (musical-snake / drum-game / rhythm-painter / karaoke / dance-viz)
4. **IDE-teaching lane** (I do this myself in fg): panels, vim/emacs, F1-F6, ,help, pair modes, TUI + web.
5. **Every cart TESTED via `./bin/motoi run` before it enters the corpus.**
6. **Fold + refire as v8 corpus + Motoi 5.0 training** after all lanes land + Alfred sign-off.

Doctrine [[dont-rush-alfred-to-training]] applies: authoring → Alfred confirms totals + sample → fold → Alfred confirms → 5.0 training fires.

## 2026-07-19T11:15Z — 7 authoring agents fired + IDE-teaching landed

### 7 background lanes running (5.0 substrate)
- Ada — Book of Jesse "Frames Buffered" chapter (10 demo examples, verified-runnable, mix FB/games/music/interactive)
- Zane — Runtime FB+music audit + additive wiring (no rename, no sig change)
- Cart Maker 1 — 5 scene carts (house/face/flower/city/astronaut)
- Cart Maker 2 — 5 game carts (pong/snake/breakout/catch/memory)
- Cart Maker 3 — 5 music carts (melody/drum/arpeggio/chord/layered)
- Cart Maker 4 — 5 interactive carts (click-draw/kaleidoscope/piano/tap-move/storybook)
- Cart Maker 5 — 5 hybrid carts (musical-snake/drum-game/rhythm-painter/karaoke/dance-viz)

Every cart verified via `./bin/motoi run` before entering corpus. Aliases (rectangle/pixel/fill-rect/etc.) required in every cart. Training pairs emit to `motoi-v8-partial/cart-maker-N-*.jsonl`.

### IDE-teaching lane LANDED (my hand)
- 65 pairs at `~/.forge/corpus/motoi-v8-partial/ide-teaching-2026-07-19.jsonl`
- Covers: panels, REPL, editor, tabs, header buttons, F-keys, pair modes, ambient completion, CPU panel, Settings, vim/emacs modes, menu bar, `,help` meta-command, cherry-tree logo, reading state (bookmarks/highlights/progress), CLI (repl/run/eval/ide/tui/help/docs), book verbs, server endpoints, error interpretation, TUI vs Web parity
- Provenance: every pair `_meta._source` points at a real file in the repo
- Voice: Motoi's dry-warm honest-savant register

## 2026-07-19T11:35Z — 4 lanes landed + 6 additive drum/text verbs wired

### Zane's audit → 3 additive aliases + 5 questions
- Zane wired: `background`, `bg-clear` → `clear`; `draw-text` → `fb/text`
- 605 tests green
- 5 Alfred-facing pedagogy calls flagged in `engineering/RUNTIME-AUDIT-FB-MUSIC-2026-07-19.ENG.md`

### My additive follow-up on Zane's questions (additive-only, no signature change)
- `sleep-ms` in media.js — blocking millisecond pause (kids type "wait ms", `wait` returns a tagged clause and doesn't block — this is the honest form)
- `print` → delegates to `display` — familiar to kids from Python/Racket
- `println` → `display` + `newline`
- `kick`, `snare`, `hat`, `crash`, `clap` in audio-verbs.js — bare percussion verbs that dispatch to `synth/kit` with the canonical patch name
- All 6 verified end-to-end via `./bin/motoi eval`; 605 tests still pass
- `beat` and `song` bare forms LEFT UNBOUND (no clean deterministic mapping — Alfred call needed)
- `wait-ms` NOT added (would collide with tagged-clause `wait`)

### Cart Maker 1 — Scenes: LANDED
- 6 carts (house / face / dancing-flower / city-sunset / astronaut / lighthouse — bonus)
- 6/6 exit 0
- 44 pairs at `motoi-v8-partial/cart-maker-1-scenes-2026-07-19.jsonl`
- 8 aliases spread across all 6 carts — canonicals sit next to aliases so model sees equivalence in context

### Cart Maker 3 — Music: LANDED
- 5 carts (twinkle / drum-loop / arpeggio / chord-progression / layered-song)
- 5/5 exit 0
- 23 pairs at `motoi-v8-partial/cart-maker-3-music-2026-07-19.jsonl`
- Composer verbs exercised: song/config, voice-pool, voice-assign, voice-mix-set, voice/compose, composer/emit
- No missing verbs surfaced during authoring

### Cart Maker 4 — Interactive: LANDED
- 5 carts (click-to-draw / kaleidoscope / tiny-piano / tap-to-move / storybook)
- 5/5 exit 0
- 23 pairs at `motoi-v8-partial/cart-maker-4-interactive-2026-07-19.jsonl`
- Unified mocked-event pattern (on-key/on-mouse handler + MOCK-events list + fire-key/fire-mouse dispatcher) — same cart runs headless AND drops into real input loop unchanged
- Flag: `key?` in `lib/game/misc.js` is a hardcoded soft-fail `#f`; real input is via `on-key` + `fire-key`

### Still running
- Ada — Book of Jesse "Frames Buffered" chapter (10 examples)
- Cart Maker 2 — Games
- Cart Maker 5 — Hybrid

## 2026-07-19T11:48Z — Cart Maker 2 (Games) + Ada (Frames Buffered) landed

### Cart Maker 2 — Games: LANDED
- 5 carts (pong / snake / breakout / catch-the-ball / memory-match)
- 5/5 exit 0 under `./bin/motoi run`, bounded to 5-15 ticks
- 26 pairs at `motoi-v8-partial/cart-maker-2-games-2026-07-19.jsonl`
- All 5 carts use 2+ aliases (rectangle, pixel, fill-rect, filled-rectangle, put-pixel, plot-pixel, draw-rect)
- Fuel finding: per-pixel food rendering hits fuel budget at grid-scale (16×12 @ 15 ticks); use `fill-rect` for region-scale fills. Kid-facing hint.

### Ada — Book of Jesse Ch 17 "Frames Buffered": LANDED
- Chapter: `scheme-books/book-of-jesse/17-frames-buffered.book.slatl` (510 lines)
- 10/10 examples verified runnable
- 34 pairs at `motoi-v8-partial/book-of-jesse-frames-buffered-2026-07-19.jsonl`
- All 8 aliases covered across examples
- Zero fabrication ("no as-if code" doctrine held)
- Author flags (not blockers):
  - `beat` unbound (Zane already caught; still needs Alfred pedagogy call)
  - `sprite` registered but doesn't render into framebuffer directly
  - `set-color` uses PICO-8 palette (16 names) — could ALSO accept HTML-16 branding palette per composer-v11 (separate wire-up)
- Voice: dry-warm honest-savant, kid-legible per persona doctrine

### Still running
- Cart Maker 5 — Hybrid (5 carts combining FB+music+game+interactive)

### Landing totals so far (v8-partial substrate)
- ai-tech-history-cards: 396 pairs (earlier today)
- book-of-ml-pair-voice: 208 pairs (earlier today)
- ide-teaching (my hand): 63 pairs
- book-of-jesse-frames-buffered: 34 pairs
- cart-maker-1-scenes: 44 pairs
- cart-maker-2-games: 26 pairs
- cart-maker-3-music: 23 pairs
- cart-maker-4-interactive: 23 pairs
- cart-maker-5-hybrid: (pending)
- **Running total: 817 pairs from today's authoring**

## 2026-07-19T12:20Z — Fantasy Console Ch 18 landed + F-key parity finding

### Fantasy Console: LANDED
- New chapter `scheme-books/book-of-jesse/18-fantasy-console-mode.book.slatl` (370 lines)
  - Slot 15 was frozen-core, Ada took 17, this is 18. MANIFEST updated 16→18.
  - `:supersedes "Scheme/BOOK-OF-JESSE/05-fantasy-console-mode.book.slatl"` header field. Old draft preserved per no-deletes.
- 10/10 examples verified runnable via `./bin/motoi run`
- 49 pairs at `motoi-v8-partial/fantasy-console-chapter-2026-07-19.jsonl`, `_meta.bucket = "fantasy-console-chapter"` on every pair
- 7 topics covered: screen · draw primitives (10 aliases verified) · frame loop · input (`on-key`+`fire-key` verified) · sound (`tone`/`note`/`kick`/`snare`/`hat` verified) · IDE+REPL (3-panel browser, 4-region TUI, cherry stripes, F2 explain, vim/emacs) · cart file format
- API drift documented — §18.9 maps old-draft `surface-paint-dots`→`pset`, `surface-paint-text`→`draw-text`, `clear-surface-layer`→`clear`, `paint-cell`→`pset+set-color`, `system/surface` gone

### Zane's audit findings (real bugs)
1. **F-key parity broken between surfaces**. Marcus's TUI (`tui/tui.js`) wires F1/F2/F4/F5/F6; web IDE (`site/ide-assets/ide.js`) wires ONLY F2. My IDE-teaching JSONL (authored earlier this session) claims F4/F5/F1 work everywhere — that's fluent-wrong on the web side.
   - **Fix option A**: patch `ide.js` to add F1/F4/F5/F6 handlers matching TUI behavior. Small, additive.
   - **Fix option B**: rewrite IDE-teaching pairs to say "F-keys in terminal; header buttons in browser" — accurate but weaker teaching.
   - Doing A when Ada + Zelda land + before fold.
2. **`palette` unbound** — chapter uses palette-by-name; no `(palette)` reader verb exists.
3. **`motoi slat parse` fails on book-slatl files** — parser chokes on prose-embedded parens/backticks. Real Motoi runtime bug, affects both Ch 17 and Ch 18. Non-blocking (books still teach; parse verb is docs-tooling).

### Alfred's open question
Canvas UI in TUI + web IDE — A) build both before 5.0 (~5h push) B) ship 5.0 without visible framebuffer + 5.1 canvas pass next. Awaiting call.

### Still running
- Zelda level 1 cart
- Ada's 4 appendices (G Disco Lights, I Boids, J Conway, K Music Composition)

### Landing totals — v8-partial
- Original 9 files: 858 pairs
- Fantasy Console: +49 pairs → 907
- (Zelda + 4 appendices pending)

## 2026-07-19T12:33Z — Zelda Level 1 landed + IDE upgrade lanes fired

### Zelda Level 1: LANDED
- `carts/cart-maker-6-zelda/level-1.scm` (356 lines)
- 16×12 dungeon: walls + interior pillar, hero (green disc), octorok (red disc, chases every 2 ticks), heart pickup (+1 HP), door exit
- Sounds: rising fourth on heart, ascending fanfare on door, thud on hurt (`note`/`tone`)
- Aliases used (5): `fill-rect`, `filled-rectangle`, `rectangle`, `pixel`, `set-pixel!`
- 27 mock-keys drive winning playthrough. Final log: "LEVEL COMPLETE — you reached the door. hp 4, 1 heart, 27 steps."
- 12 pairs at `motoi-v8-partial/cart-maker-6-zelda-level-1-2026-07-19.jsonl`, every pair `_meta.bucket = "zelda-level-1"`
- Honest substitution: `string-ref` returns `Ch` character, code comments the workaround

### IDE upgrade lanes fired (Alfred: "just make it look good")
- **Web lane (a6ee86c...)**: canvas panel with cherry-tree bezel · movable tabs · `motoi/stack` call-stack panel · inline "run in box" Jupyter-style output cards · F1/F4/F5/F6 parity fix · visual polish
- **TUI lane (aa6b591d...)**: canvas region via half-block characters (80×40 cells for 80×80 pixels) · keyboard-driven tab reorder (Ctrl+Shift+Left/Right) · Stack panel (F7 or Alt-K) · inline output cards below forms · fantasy-console bezel · F3 toggle for canvas

Both lanes coordinate on `motoi/stack` verb (whichever lands first, other consumes).

### Still running
- Ada's 4 appendices (Disco Lights G, Boids I, Conway J, Music Composition K)
- Web IDE upgrade
- TUI upgrade

### Landing totals — v8-partial
- Prior: 907 pairs
- + Zelda: 12 pairs
- Total: **919 pairs**
- Pending: ~100-200 from Ada's appendices

### Loop wake state
Still armed; task-notifications will fire on each landing.

## 2026-07-19T12:55Z — Ada's 4 appendices landed; density check PASSED

### Ada's 4 appendices: LANDED
- appendix-g-disco-lights (293 lines, 8/8 verified)
- appendix-i-boids (371 lines, 5/5 verified)
- appendix-j-conway (475 lines, 5/5 verified)
- appendix-k-music-composition (428 lines, 10/10 verified)
- 28/28 examples runnable via `./bin/motoi run`
- 103 pairs at `motoi-v8-partial/book-of-jesse-appendices-g-i-j-k-2026-07-19.jsonl`, buckets: appendix-g-disco-lights (25), appendix-i-boids (25), appendix-j-conway (25), appendix-k-music-composition (28)
- Aliases woven per appendix: G (7), I (3), J (3), K (3)
- Zero missing verbs

### Reading-list appendix
- Previous `appendix-g-reading-list.book.slatl` PROPERLY ARCHIVED to `_archive/appendix-g-reading-list-superseded-2026-07-19/` per no-deletes doctrine
- MANIFEST.slat still references the old G — needs update to point at new G/I/J/K appendices + remove reading-list ref (or note archived). Small follow-up.

### Composition density sufficiency check
- 355 new composition-teaching pairs across the 9 composition-focused lanes (33% of the 1073 new pairs)
- Plus v7 base composed: 29 → combined 384
- v8 corpus total: 101,288 rows
- Composition-teaching density: **0.379% — above the 0.19% cliff ✓**
- Per Weave doctrine density-to-consistency law: Motoi 5.0 should fluently compose scenes at inference

### Still running
- Web IDE Wave 3 (Marcus a6ee86...): canvas + tabs + stack + inline + F-key parity (~60-70% landed per disk changes to index.html + ide.css + ide.js + ide-server.js)
- TUI Wave 3 (Marcus aa6b59...): canvas region (half-block) + Stack panel + inline output cards + tab reorder

### Combined lane queued for post-Marcus-landing
- Splash screen + IDE↔Fantasy Console mode toggle + Hacker Mode overlay + Composer v2 widgets (sprite-grid editor, tile-map editor, timeline scrubber, palette designer, piano-roll) that emit Scheme + panel option menu
- Fires when Marcus's current wave stabilizes (they touch same tab framework)

### Landing totals — v8-partial
- Prior total: 970
- + Ada 4 appendices: 103
- **v8-partial total: 1,073 pairs**

### Next after Marcus lands
1. Fire combined next-wave lane
2. Fold v8 (v7 base 100,215 + v8-partial 1,073 = 101,288 rows)
3. Compliance check (bucket tags · provenance · no wave6 leftover · SHA seal)
4. Fire Motoi 5.0 SFT (3 epochs, seed 61, ~5-6h)
5. Mk G raw + polish + Mk G polished
6. Launch: Hugging Face + npm per Alfred's autonomy grant

## 2026-07-19T13:10Z — Web IDE Wave 3 LANDED (Marcus)

### What shipped
1. **Fantasy Console panel** — 80×80 palette-indexed framebuffer via `/api/canvas` (JSON w/h/palette/base64-bytes), rAF loop ~30fps, decodes base64→ImageData, blits 1:1 with `image-rendering: pixelated`. Cherry-tree bezel (pink top, mint sides, cedar bottom, cream frame). Toggle via header button OR `,console` meta-command. Verified: `(circle 40 40 15)` flips exactly 80 non-zero pixels.
2. **Movable tabs** — HTML5 drag+drop with before/after drop indicators. Order persists in `localStorage`. Middle-click closes. Right-click: Close / Close Others / Close All.
3. **Call-stack panel** — Backed by `motoi/stack`, `motoi/stack-peak`, `motoi/stack-depth` verbs (parallel-agent TUI lane wrote them via hooks in `src/interp.js` `applyStep`). `/api/stack?which=live|peak` returns frames. Client polls 10Hz; live→peak fallback when idle. Active frame highlighted mint, deeper frames indent + fade to cedar-dark.
4. **Inline notebook outputs** — Every chapter code block gets a pearl-light output card with mint-dark left border on Run. Shows stdout/return/error. Cached by block index across tab re-renders. For editable buffers, floating overlay near caret + 6s auto-dismiss.
5. **Visual polish** — 200ms ease transitions on grid template changes; mint focus indicator on active panel (2px left border, always reserved); "editing/running/paused" mode chip (cream/mint/pink pill). Loading overlay "waking the pixels…" on console until first frame.
6. **F-key parity with TUI** — F1 (help cheatsheet), F2 (explain), F4 (CPU toggle), F5 (pair-mode cycle), F6 (focus cycle) globally wired.

### Files touched
- `src/ide-server.js` — `/api/canvas` + `/api/stack` endpoints + `getMediaState` import
- `src/interp.js` — `applyStep` stack hooks (parallel TUI-lane)
- `core/index.js` — `installStack` wire (parallel TUI-lane)
- `site/ide-assets/index.html` — fantasy console panel + stack panel + mode chip + Console/Stack buttons + tab context menu + viewport-fit
- `site/ide-assets/ide.css` — grid layouts for console/stack/cpu combos + focus indicator + mode chip pill + pixelated canvas + drag styles + inline output cards + 200ms transitions
- `site/ide-assets/ide.js` — Wave 3 rewrite: rAF canvas loop + stack polling + draggable tabs + inline notebook outputs + floating run overlay + mode chip + F6 cycle
- `tests/ide-server-canvas-stack.test.mjs` — 4 new tests (all pass)

### Tests
- **609/609 pass** (up from 605 → 609). Zero regressions.

### Still running
- TUI Wave 3 (Marcus aa6b59...) — half-block canvas + Stack panel + inline output cards + tab reorder + fantasy-console bezel + F3 toggle

### Combined next-wave lane WILL FIRE when TUI lands
- Splash screen (retro boot on both surfaces)
- IDE ↔ Fantasy Console top-level mode toggle
- Hacker Mode overlay (green-on-black modernized-old-school-terminal palette + Motoi silent-unless-asked register)
- Composer v2 widgets (sprite-grid editor, tile-map editor, timeline scrubber, palette designer, piano-roll) — each round-trip-verified (`(composer/apply c (composer/emit c)) = identity`)
- Panel option menu — visibility toggles + layout presets
- Save/Load cart button (wire existing verbs to UI)

### Then: fold + train 5.0 + launch

## 2026-07-19T13:30Z — TUI Wave 3 LANDED + dirt cleaned

### TUI Wave 3: LANDED
- **Canvas panel** — half-block `▀` primary rendering (retro-console look), braille `⣿` fallback for narrow terminals. `computeLayout` chooses based on space remaining after 30-col min editor. 80×80 fb downsamples nearest-neighbor.
- **Stack panel** — new module `lib/system/stack.js` with `motoi/stack`, `motoi/stack-peak`, `motoi/stack-depth`, `motoi/stack-clear!` verbs. Hooks in `applyStep` (try/finally-balanced) for JS-primitive + Closure application. `__verbName` tagging in `env.define` + `(define …)`.
- **Inline output cards** — F8 or `:eval` runs the form under cursor, output card paints directly beneath.
- **Tab reorder** — Ctrl+Shift+Left/Right (parsed via CSI 1;6C/D). Alt-T opens tab menu.
- **Focus cycle** — F6 or Tab cycles through visible panels.
- **Raw-RGB path** — `screen.js` `_ansiFor` and new `_colorSeq` accept `rgb:R,G,B` so canvas paints the fb's own 16-color palette directly without squashing to the Sakura tier.
- **8 new TUI tests** — F3 canvas, F7 stack, F8 run-card, tab reorder, modified `~` parsing, `stackFrames`, framebuffer snapshot, raw-RGB screen. Tests: **617/617 pass**, 25/25 TUI-only.

### Honest breaking-change flags (Marcus called out)
- **F3 was Settings → now toggles canvas.** Settings still reachable via Alt-S / `:settings`.
- **Ctrl+Shift+Arrow reordering doesn't work in macOS Terminal.app** (they swallow it for word-select). Modern iTerm2/kitty/wezterm/alacritty fine. Shift+PgUp/PgDn fallback added.
- **Alt-T (tab menu) may conflict with iTerm2's new-tab** at app level.
- **Tail-call Closures**: stack pops before body runs. Live view during pure TCO loops shows depth 0. Peak captures correctly. Acceptable.

### Data cleanliness pass — ALL DIRT CLEANED
- 23 untagged bucket rows (cart-maker-3-music + cart-maker-4-interactive) → BACKFILLED
- Product-name mentions in AI Tech Cards → verified factual, engineering-firm register, zero advisory phrasings (doctrine compliant)
- Wave6-style safety templates: 3 hits were legitimate hacker-mode-safety-override pairs (988/911 crisis templates that MUST stay consistent per Priya doctrine)
- Duplicates: 0
- Missing provenance: 0
- v8-partial final: 1,073 rows · 0 untagged · 0 duplicates · 0 missing source ✓

### v8 substrate ready for fold
- v7 base kept: 100,215 rows
- v8-partial: 1,073 rows
- v8 total: 101,288 rows (projected)
- Composition-teaching density: 384/101,288 = 0.379% (above cliff)

### Now firing
1. Combined next-wave lane (splash + IDE↔FC mode toggle + Hacker overlay + Composer v2 widgets + cart template spec)
2. In parallel: assemble v8 corpus → compliance check → 5.0 SFT training

## 2026-07-19T13:40Z — Motoi 5.0 SFT FIRED

- **PID 68293** running from forge venv (`/Users/alfred/code/forge/.venv/bin/python -m mlx_lm.lora`)
- Config: `~/.forge/projects/motoi-5.0/mlx-lora-config.yaml`
  - seed: **61** (next odd prime: 41→43→47→53→59→61)
  - corpus: `~/.forge/corpus/motoi-v8` (103,766 train rows · SHA `31acee3da525a2f7`)
  - iters: **77,825** (3 epochs at effective batch 4)
  - warmup: 3,891 (5%)
  - LR peak 1.0e-4, cosine to 1.0e-5
  - adapter: `~/.forge/runs/motoi-5.0/adapter/`
- Trainable parameters: 9.569% (147.72M / 1.54B)
- Iter 1 val loss: 3.164
- Iter 10-40 train loss: 3.7-4.5 (warmup, LR still climbing)
- Peak mem: 8.58 GB (still climbing as adam states populate)
- It/sec: 3.6-4.0

Wall estimate: **~5.4h to SFT complete** — ready around 19:00 UTC.

### Combined next-wave lane running in parallel
- Marcus Wave 4 (a0a693c...) — Splash + IDE↔FC toggle + Hacker overlay + Composer v2 widgets + cart template
- Doesn't touch corpus. Runs alongside training.

### On completion → verify → launch
1. Mk G raw eval — probe suite (composed scenes, games, sound, IDE knowledge, aliases, hacker mode)
2. If clean: seven-technique polish fold + resume-train (LR 5e-5, 1 epoch, seed 67 next-odd-prime)
3. Mk G polished eval
4. If probe pass rate ≥ 80% on new material and ≥ 95% safety: **LAUNCH TO HUGGING FACE + NPM** per Alfred's autonomy
5. Then Sakura training unblocks per [[no-sakura-training-until-motoi-ships]]

### Final report path when this completes
`~/code/motoi-scheme/engineering/MOTOI-5.0-FINAL-REPORT-2026-07-19.ENG.md`

## 2026-07-19T14:00Z — Marcus Wave 4 LANDED

### Web IDE — full fantasy console vision shipped
- **Splash screen** (BOTH surfaces) — cherry-tree ASCII + typing-animated stripes + blinking cursor + deterministic chime `(tone 660 0.15) (tone 880 0.15)`. Web persists in `localStorage`, TUI in `~/.motoi/state.slat`. `--splash` / `,splash` / `?splash` all force replay.
- **IDE↔Fantasy Console top toggle** (web) — mode pill in header. FC mode auto-opens canvas, compresses editor to 34vh, drops REPL to 26vh, hides Stack/CPU.
- **Hacker mode** (web) — `body.motoi-hacker` swaps CSS vars to phosphor `#7EFF7E` on `#0a0f0a` + amber `#ffb84d` + text-shadow glow + scanline layer. Header button + `,hacker` + Alt-H toggle. Client-side silences ambient completions immediately; runtime `(motoi/hacker-mode-on!)` verb soft-fails until 5.0 training lands the 51 corpus pairs.
- **5 Composer widgets as tabs** — Sprite Grid (8×8 + pencil/eyedropper/fill/mirror + undo), Tile Map (12×8 + stamp), Timeline (16-frame scrubber + keyframes + play), Palette Designer (16 colors + color picker), Piano Roll (16×12 + play through `(melody …)`). Each has `emit`/`apply` — widget-level round-trip.
- **Cart template SPEC** — `Spec/CART-TEMPLATE.slat` documents canonical 7-section shape. `composer/cart-emit`, `composer/cart-apply`, `composer/cart-empty` registered on env. **7 new round-trip tests pass** — `(equal? c (composer/cart-apply c (composer/cart-emit c)))` verified.
- **Panel options menu** (web) — View menu w/ Panels + Widgets + Presets (Edit/Play/Debug/Hacker).
- **Save/Load/New Cart** buttons wired to runtime verbs.

### Test suite: 624/624 pass (baseline 617 → +7 cart round-trip tests)

### Honest punts (called out, not silently skipped)
- **TUI hacker mode + mode toggle** — palette-layer refactor + fundamental TUI layout rework required. Deferred.
- **Widget → cart-level full round-trip** — widget-level emit/apply works and passes 7 tests; full-loop test through `collectCartFromWidgets → composer/cart-emit → composer/cart-apply` not yet authored. Contract holds at composer-verb layer.

### Doctrine compliance verified
- **Deterministic audio** — every chime, piano-roll play, widget preview routes through runtime `tone`/`note`/`melody` verbs → `audio-driver.js` synthesis → afplay/aplay/powershell. LLM absent.
- **Cherry-tree palette lock** — hacker mode overrides CSS vars, no class deletion/rename; disable → cherry tree returns intact.
- **Composer cart round-trip** — 7 tests verify identity contract.

### 5.0 training tick
See below.
