---
slug: forge-1.0-eng
title: Forge — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Marcus (SRE) + Jess (RelEng testing)
codename: forge
supersedes:
  - lacuna-docs/specs/forge-panels-categories-2026-07-10.md (FOLDED — §PANELS)
  - lacuna-docs/specs/forge-redesign-2026-07-10.md (FOLDED — §REDESIGN)
  - lacuna-docs/specs/forge-views-and-narration.md (FOLDED — §VIEWS)
theme: forge
cross-references:
  - WEAVE-TRAINING-1.0.ENG.md — Forge is the operator TUI for Weave training
---

<!-- covers-through: 2026-07-11 -->

# Forge 1.0 — Engineering

> **Canonical engineering doc #12 of 12** per `docs-consolidation-plan-2026-07-11.md`. Previously a 175-line stub; expanded 2026-07-11.

## §OVERVIEW — Forge is the operator TUI for Weave training

Forge is the terminal-first operator surface for training and operating small open-weight LLMs. It is the human-facing side of Weave (see `WEAVE-TRAINING-1.0.ENG.md`) — the panel view an operator watches while Sakura trains.

# Forge — LLM training, from a terminal

`Forge` is a Textual TUI for training and operating small open-weight LLMs. Two panes: a tail-follow log view on the left, an agentic chat on the right. A small tool catalog lets the agent peek at corpora, generate training examples, start training runs, and surface the box's state.

```
┌─ FORGE · v0.1.0 ──────────────────────────── Lacuna Labs ─┐
│  ╭─ LOGS ──────────────╮  ╭─ CHAT · agentic chat ───────╮  │
│  │ trainable params:   │  │ you   train a scheme adapt  │  │
│  │  100M (rank 32)     │  │ agt.  starting on the open base-30  │  │
│  │ iter 010/600 loss   │  │ [start_training] {pid 8431} │  │
│  │  2.481              │  │ agt.  pid 8431, log:        │  │
│  │ iter 020/600 loss   │  │       ~/.forge/runs/run     │  │
│  │  2.211              │  │                             │  │
│  │ iter 030/600 loss   │  │ > ___________________       │  │
│  │  1.987              │  ╰─────────────────────────────╯  │
│  ╰─────────────────────╯                                   │
│  cpu 18% · mem 41% (32G) · disk 12% · forge 02:48:11       │
└───────────────────────────────────────────────────────────┘
```

**Forge ships from Lacuna Labs. MIT-licensed. Vendor-neutral.** The chat agent in the right pane is whatever LLM you point it at — local Ollama by default, but anything that speaks the `/api/chat` contract works. Lacuna (the agent product) is one integration. Your own model is another. Forge doesn't care.

## What it does

- **Logs pane** — tail-follow any log file. Default: `~/.forge/runs/latest/train.log` (the most recent run). Re-renders highlights, scrolls live.
- **Chat pane** — type plain English. The agent understands a small tool catalog:
    - `list_jsonl(path)` — peek at a training corpus
    - `add_to_corpus(path, lines)` — append validated JSONL
    - `generate_examples(prompt, n)` — bulk-generate via the deep reasoning API (set `ANTHROPIC_API_KEY`)
    - `start_training(base, data, name, iters, …)` — launch `mlx_lm.lora` in the background
    - `tail_log(path, lines)` — read the last N lines of any file
    - `system_status()` — cpu / mem / disk / available Ollama models
- **Resource bar** — live CPU, memory, and disk gauges, colored cool / warm / hot.

## Install

One command:

```bash
git clone https://github.com/Lacuna-Labs/forge ~/code/forge
cd ~/code/forge
bash install.sh
```

The script makes a `.venv/`, installs Forge, and adds `mlx-lm` if it sees Apple Silicon. Idempotent — safe to re-run.

Manual install if you'd rather:

```bash
python3 -m venv .venv && source .venv/bin/activate
python3 -m pip install -e .
python3 -m pip install mlx-lm    # Apple Silicon only; for LoRA training
```

For agent chat: start Ollama with a chat-capable model. The default points at the open base-Coder-30B-A3B (preferred) with the base model as automatic fallback:

```bash
ollama pull the open base-coder:30b-a3b-instruct-q4_K_M
# or, smaller:
ollama pull the base model:14b-instruct-q4_K_M
```

For corpus generation via deep reasoning (optional), either export the key:

```bash
export ANTHROPIC_API_KEY="sk-ant-…"
```

… or drop it into the canonical Lacuna secrets store and Forge will find it automatically:

```bash
mkdir -p ~/.curator/secrets
echo "sk-ant-…" > ~/.curator/secrets/anthropic_api_key
chmod 600  ~/.curator/secrets/anthropic_api_key
```

The key stays local. Forge sends it only to `api.anthropic.com` when the `generate_examples` tool fires. Nothing is uploaded to a Lacuna server.

## Run

```bash
forge           # or: python -m forge
# or:
lacuna-train    # same binary, the friendly name when Lacuna is your agent
```

## Bring your own LLM

Forge's chat pane is vendor-neutral. Point it at anything that speaks the Ollama-compatible `/api/chat` contract:

```bash
# env vars (quick setup)
export FORGE_LLM_ENDPOINT="http://your-host:11434"
export FORGE_LLM_MODEL="your-model:tag"
export FORGE_AGENT_NAME="Your Agent's Name"
```

Or write `~/.forge/config.toml` for full control:

```toml
[agent]
endpoint    = "http://localhost:11434"
model       = "qwen3-coder:30b-a3b-instruct-q4_K_M"
fallback    = "qwen2.5-coder:14b-instruct-q4_K_M"
name        = "Lacuna"            # display name in the chat pane
temperature = 0.3
system      = """You are my agent inside Forge — train small LLMs, run tools, answer plainly.

Tool calls go through `<tool name="…">{…}</tool>` syntax. Available:
list_jsonl, add_to_corpus, generate_examples, start_training, tail_log, system_status."""

[training]
base_model   = "~/mlx-models/the open base-coder-30b-a3b-instruct-mlx"
runs_root    = "~/.forge/runs"
iters        = 600
rank         = 32
num_layers   = 16
learning_rate = 1.0e-4

# Optional — needed for the generate_examples tool.
anthropic_api_key = "sk-ant-…"
claude_model      = "claude-sonnet-4-5"
```

## Keys

- `Tab` — cycle focus between Logs and Chat (focused pane has a coral border)
- `Enter` — submit a chat message
- `Ctrl-L` — clear the chat view (the agent still remembers; this is screen-only)
- `Ctrl-C` — quit

## Train multiple LLMs at the same time

Call `start_training` with a different `name` for each run. Each run gets its own dir under `~/.forge/runs/<name>/` with its own log, PID file, and adapter. Concurrent is supported — at the limit of your RAM. Two examples:

```
you   train sakura-l1 on the open base-coder-30b-a3b with the curator corpus, 600 iters
agt.  [start_training] {name: "sakura-l1", pid 8431, log: ~/.forge/runs/sakura-l1/train.log}

you   also start unix-l0 on the open base-1.7b with my unix-companion corpus, 800 iters
agt.  [start_training] {name: "unix-l0", pid 8552, log: ~/.forge/runs/unix-l0/train.log}

you   how are both going?
agt.  [list_runs]
       sakura-l1  running  iter 240/600  loss 1.84  (37 min)
       unix-l0    running  iter 320/800  loss 2.11  (28 min)
```

The Logs pane follows `~/.forge/runs/latest` (a symlink updated by every `start_training` call). To switch which run streams in the pane, ask the agent: *"focus the log on unix-l0"* — it'll call `set_log_focus(name="unix-l0")` and the pane re-points.

## Why a TUI?

Training LLMs is a long-tail job — corpora to assemble, runs to launch, logs to babysit, adapters to compare. Doing it in a notebook means losing focus every time you reach for another tab. A TUI puts every signal in one place — logs, agent, resources — and lets you stay in the terminal where `mlx_lm` / `ollama` / `flyctl` already live. Forge is the seam between an agent that understands your work and the tools that do it.

## Pair with Lacuna (optional)

[Lacuna](https://github.com/Lacuna-Labs/lacuna) is the agent half of the same team. When the two are paired:

- Lacuna becomes Forge's chat agent (set `agent.name = "Lacuna"` and point `endpoint` at her serving box)
- Forge becomes one of Lacuna's surfaces (`lacuna train` launches Forge)
- The tool catalog gains Lacuna-specific verbs (deploy, observe, follow)

Neither needs the other. They work best together.

## License

MIT. See `LICENSE`. Use it, ship it, fork it.

— Lacuna Labs


---

# §PANELS — Forge Panel Categories (folded)

---
slug: forge-panels-categories-2026-07-10
title: Forge Panel Categories + Introspection Requirements
category: engineering
canonical: true
owner: docs-team
status: active
last-reviewed: 2026-07-10
---

# Forge Panel Categories + Introspection

Alfred (2026-07-10 ~02:00): **"Introspection. Into the running thing. Categories of graphs."**

## The 8 categories

Panels aren't a flat list of 64. They're grouped by what question they answer.

1. **Trajectory** — Are we heading in the right direction? Loss curves (train + val), stitched lineage across segments, projection cone, regression detection, val subgroup breakdown, epoch progress, tokens-vs-corpus.
2. **Optimizer health** — Is Adam warm? Warmup sanity, adam-moment health (‖m‖ / ‖v^0.5‖), grad-norm distribution + clip engagement rate, LR-actual-vs-plan, layer-lr-effective-ratio, resume latency to first good eval.
3. **Runtime / hardware** — Is the box happy? GPU contention timeline, throughput + memory band saturation, peak-mem creep, thermal state, disk write cost + fill projection, ips vs expected.
4. **Data** — What is the trainer eating? Family distribution + shape drift, batch fingerprint, token-length distribution + 99th percentile, banned-token watchlist, corpus-coverage rings.
5. **Model state** — What did the weights just do? Adapter delta heat (Frobenius Δ per key × A/B), layer-lr-effective-ratio, weight-histogram per key, optim-state-integrity round-trip check.
6. **Persona / voice** — Does she still sound like her? Voice-lock (banned + hedge + FROZEN-pass), driftwall (canonical prompts × checkpoints matrix), frozen-pass-rate trend.
7. **Segments / lineage** — What happened before now? Segment timeline with checkpoints + incidents, ckpt-recovery-cost estimate, seed sensitivity (per-resume first-500 val curves), stage indicator, stage-diag confidence breakdown.
8. **Introspection (live)** — What is happening RIGHT NOW inside the running process? Live batch peek (current input, current target), live grad-norm ring buffer, live LR value, live optimizer state hash, live tokens/sec, live memory pressure, live-conversation mirror (sakura-chat), live optimizer momentum flip detection.

## Introspection = the new category

Every other category shows *derived* signals — loss numbers, saved checkpoints, log traces. **Introspection reads the running process directly.**

Deliverables (backend):
- `/api/introspect/{run}/batch` — the current batch's content (first 200 chars per message, family tag, token count)
- `/api/introspect/{run}/grad-ring` — the ring buffer of recent grad norms from `_clipped_update`'s ring
- `/api/introspect/{run}/optim-state` — hash + ‖m‖ + ‖v‖ + ratio (no full tensor dump — just the aggregates)
- `/api/introspect/{run}/live-lr` — current LR value from the schedule
- `/api/introspect/{run}/probe` — a "peek at the trainer" — reads the running pid's cwd, cmdline, elapsed time, cpu%, rss
- `/api/introspect/{run}/last-atom` — for corpus that carries atom slugs, which atom the last batch pulled from

None of these touch the trainer process. All are *observation* reads from files the trainer writes to as a side effect.

## Access system

- **Segmented control at top of insights section:** `Trajectory · Optimizer · Runtime · Data · Model · Persona · Segments · Introspection`
- **Search** — fuzzy match across panel titles
- **Compare mode** — every panel has a "compare" affordance: original-vs-latest (this session vs its baseline), this-run-vs-prior-run
- **Lists carry visuals** — banned-token list rows have a bar showing hit-count, family-distribution rows have a stacked bar showing share, ledger entries have a spark showing segment shape

## Coordination

The insight-panel worker (running as `ae9df006e6e3e8c89`) is building panels + palette. This doc adds the category grouping + the introspection-live category. If the worker completes without categorizing, dispatch a follow-up lane to (a) group existing panels into these 8 buckets, (b) add the 6 `/api/introspect/*` endpoints, (c) wire the live-panel category on top.

Related: [[the-big-forge-plan]] Part I, [[forge-1-0-engineering]] §12.

---

# §REDESIGN — Forge Redesign (folded)

---
slug: forge-redesign-2026-07-10
title: Forge run-detail redesign — mobile-first SRE console
category: spec
kind: design
version: 0.1.0
canonical: true
owner: forge-lane
status: draft
last-reviewed: 2026-07-10
extends: sexy-stops-and-continues.md, forge-views-and-narration.md
---

# Forge run-detail redesign — mobile-first SRE console

## Purpose

The run-detail page is Alfred's 2am SRE console. At 390 px on an iPhone,
sitting on the sofa, he should be able to answer three questions in three
seconds: is the run healthy, where are we in the schedule, and what
changed. The page shipped on `forge/live-views-2026-07-10` answered none
of those cleanly at phone width — segment labels stacked as digit soup,
the ambient chip stayed on "no run" even while pid 96914 was training,
progress read a false 100.0%, the narrator mixed train-loss thresholds
with val-loss values, and the autopsy view clipped its own title off the
left edge.

This spec captures the redesign that lands with that PR: a mobile-first
layout, an honest SRE surface for every panel, and five specific bug
fixes to the underlying data path.

## Scope

Covers layout, typography, spacing, breakpoints, and honesty rules for
run-detail. Does not change the palette (the terminal-purple + canvas
tokens carry through). Does not touch backend endpoints beyond
additive wrappers that the sexy-stops-and-continues spec already
called for.

## Non-goals

- Redesign of the runs list, overview, models, or system pages.
- New brand colours. The palette in `~/code/lacuna-docs/brand/assets/canvas-palette.css`
  stays load-bearing.
- New view identifiers. The seven views (effect/timeline/ledger/autopsy/
  compare/ops/bird's-eye) stay exactly as spec'd.
- A rewrite of the insights panel grid — the 32 panels stay where the
  Big Forge Plan Part I put them; only the enclosing shell changes.

## The five bugs from the operator's screenshots

Each bug has a hard link to its fix in the PR.

1. **Timeline digit-soup on phone.** `sxc-timeline` rendered "0 1 2 3 4
   5 025400" as loose text because segment bar labels and axis text
   line-wrapped inside a squeezed flex row. Fix: single-line compact mode
   under 600 px (colored chips only, no numeric labels), with an
   `expand` control to render the full bars view when the operator
   wants the detail. Both modes share the same header line
   ("6 segments · true-iter 0 to 26k") so the read is always the
   same at a glance. `js/stops-continues.js pullSegments()`,
   `styles.css .sxc-timeline*`.

2. **Ambient chip stuck on "no run".** `stops-continues.js` polled
   `/api/watch/live/{RUN}` which did not exist in `server.py` — the
   endpoint 404'd on every 5 s tick and the JS silently kept the
   initial "no run" label. Fix: add the endpoint as a thin projection
   of `parse_train_log`, and also fix the JS to honour a `phase`
   field so the mapping lives in one place. `server.py
   api_watch_live()`, `js/stops-continues.js phaseFromLive()`.

3. **False 100.0% progress on the ITER card.** `parse_train_log`
   defaulted `target_iters=4000`, so once cur_iter passed 4000 the JS
   clamped `Math.min(100, ...)` to 100.0 for the rest of the run.
   Real target is `iters: 68520` in `~/.forge/runs/sakura-4b-v2/train.cfg`.
   Fix: add a small YAML-lite reader for the run's own cfg, use it as
   the default. Also update the JS to render "37.4% of 68,520" and to
   surface "past target" honestly instead of clamping to 100 — a
   completed run should say so, not lie about it.
   `server.py _read_target_iters_from_cfg()`, `static/forgeweb.js
   run-block card`.

4. **Narrator mixed train-loss thresholds with val-loss values.** The
   template rendered "landmine at iter 350 passed at 0.814 (threshold
   4.876)". Threshold 4.876 was correct — it is the iter-350 train-loss
   landmine. Value 0.814 was wrong — it was that segment's val loss at
   the same tick (val is always well below the train threshold, so
   the crossing is trivial and the "passed at" number reads
   nonsensical). Fix: landmine detection reads the train series, not
   the val series; the template labels the "at" as `train X.XXX` so
   both numbers share a unit. Also suppress landmine detection on
   resumed segments (`local_offset > 0`) — the landmarks are anchored
   to the ORIGINAL run's true-iter path, and firing them on a
   post-resume segment produces the trivial-crossing bug the operator
   caught. `narrator.py _detect_landmine()`, `_effect_landmine()`,
   `_timeline_landmine()`.

5. **Autopsy text clipped off the left edge on phone.** The autopsy
   view's `<section>` had no left padding and its `<h2>` inherited a
   negative-margin adjustment that pushed the first letters into the
   viewport gutter. Screenshot read "ENT, UP CLOSE" instead of
   "INCIDENT, UP CLOSE". Fix: `padding: 4px` on the view root,
   explicit `padding: 0 4px` on the h2/h3, and `overflow-wrap:
   anywhere; word-break: break-word` on the body. `views/autopsy.html`,
   `styles.css .rd-view--autopsy`.

## SRE polish rules (applied to every panel)

- **Every number has a unit.** "0.79" → "val 0.79 · at iter 25,000".
  "0.18" → "0.18 it/s". Never a naked scalar.
- **Every progress bar answers "of what."** Never "100%"; always
  "iter 25,650 of 68,520 · 37.4%". Past target = "past target"
  in words, not clamped.
- **Every "connected" indicator reflects ground truth.** The ambient
  chip has six honest phases (running / stopping / paused / resuming
  / dead / idle) that come from a server-side classifier, not
  JS-guessed. Log-mtime staleness threshold is 600 s (six report
  cycles) instead of 60 s, so a slow-reporting healthy trainer no
  longer reads as "stopped".
- **Every data source declares its age.** The throughput card sub
  reads "peak 22.9 GB · log 45s ago" so the operator can tell at a
  glance whether they're looking at a fresh number.
- **Every action button says what it changes.** Pause reads "Pause"
  and its confirm modal reads "Stop the trainer? Sends SIGTERM. Up
  to 30 s for graceful exit. Last saved checkpoint stays put." No
  bare "Are you sure?".
- **Insight panels without data say why, not "—".** Timeline empty:
  "No segments yet." Narration empty on view switch: "(narration
  unavailable)" instead of silence.

## Breakpoints (mobile-first)

| Range | Stand-in for | Grid |
|---|---|---|
| 0 – 599 px | iPhone SE → 14 Pro | 1-column stat cards, compact segment chips, horizontal-scroll viewbar |
| 600 – 959 px | iPad portrait, small laptop | 2-column stat cards, full segment bars |
| 960+ px | laptop, desktop | 3-column stat cards, full bars, run header lays out row-wise |

All widths obey the 3-viewport ship-lock (iPhone 393 × 852, iPad
820 × 1180, Desktop 1440 × 900) — no ancestor overflow, no clipped
text without ellipsis.

## Component inventory

Every existing element on the page — kept, redesigned, or hidden.

| Element | Fate | Notes |
|---|---|---|
| Topbar (`_topbar.html`) | Kept | Palette and content unchanged. |
| Back link | Redesigned | Moved into the run-header row instead of its own `<p class="lead">`. |
| Run title (h1) | Redesigned | Word-break: anywhere. New rd-run-header wrapper for spacing. |
| Pause/Resume buttons | Kept | Moved into the run-header row's right side; hidden state driven by ambient chip data. |
| Ambient chip | Kept + redesigned | Six honest phases via CSS; ::before dot pulses when live. |
| Suggested-fix banner | Kept | `[hidden]` attribute now beats `display: flex` (was a pre-existing bug that showed an empty banner). |
| Segment timeline | Redesigned | Compact chip-strip on phone with `expand` control; full-bar mode on desktop; overflow-clipped checkpoint diamonds. |
| Diff modal `<dialog>` | Kept | Unchanged. |
| Old duplicate `<section id="run-block">` | Removed | Effect view partial owns the single canonical instance. |
| Viewbar (segmented control) | Redesigned | Horizontal scroll, hidden scrollbar; buttons flex-none so labels never wrap. |
| Seven-view partials | Kept | Autopsy view partial gets padding + word-wrap fix. |
| Loss curve | Kept | Inside effect view, unchanged. |
| Log tail | Kept | Inside effect view, unchanged. |
| Restart lineage | Kept | Unchanged. |
| Actions card (Stop, Fuse+publish) | Kept | Unchanged. |
| Lacuna narration strip | Kept + redesigned | Bottom-safe (`env(safe-area-inset-bottom)`), confidence chip color-coded (green/amber/mute). |

## Wireframes

### Phone (390 × 844)

```
+---------------------------------------------+
| ForgeWeb. phone console        • connecting |
+---------------------------------------------+
| overview  forge  models  RUNS  system  dl   |  <- topbar
+---------------------------------------------+
| ← back to runs                    [ Pause ] |  <- rd-run-header
| sakura-4b-v2                                |
| ● training · iter 25,600 · val 0.79         |  <- ambient chip
+---------------------------------------------+
| 6 segments · true-iter 0 to 26k    [expand] |  <- timeline head
| [R][R][R][R][R][B]                          |  <- compact chips
+---------------------------------------------+
| effect | timeline | ledger | autopsy | ..   |  <- viewbar (h-scroll)
+---------------------------------------------+
| ITER                                        |
| 25,650                                      |
| 37.4% of 68,520 · running · pid 96914       |
| seg-local 3,650 + offset 22,000             |
| ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░  <- progress    |
+---------------------------------------------+
| TRAIN LOSS                                  |
| 0.65                                        |
| val 0.79 · at iter 25,000                   |
+---------------------------------------------+
| THROUGHPUT                                  |
| 0.21 it/s                                   |
| peak 22.9 GB · log 45s ago                  |
+---------------------------------------------+
| LOSS CURVE — stitched across restarts       |
| [ chart ]                                   |
| [ log tail ]                                |
| RESTART LINEAGE                             |
| ACTIONS                                     |
+---------------------------------------------+
| LACUNA  Segment 6, warming up at iter 25600.| <- narration strip
|         Val is 0.790. First eval will tell. | (bottom-safe-area)
+---------------------------------------------+
```

### Desktop (1440 × 900)

```
+---------------------------------------------------------------------------------+
| ForgeWeb. desktop     overview  forge  models  RUNS  system  download    ●conn |
+---------------------------------------------------------------------------------+
| ← back to runs                                              [ Pause ] [ Resume ] |
| sakura-4b-v2                                                                     |
| ● training · iter 25,600 · val 0.79                                              |
+---------------------------------------------------------------------------------+
| 6 segments · true-iter 0 to 26k                                                  |
| [====seg 0 red====][==seg 1 red==][seg 2 red][==seg 3 red==][seg 4 red][seg 5]  |
|   ◇      ◇      ◇   ◇     ◇      ·      ◇      ◇      ◇      ◇                  |
| iter 0                                                                iter 25,600|
+---------------------------------------------------------------------------------+
| [ effect ] timeline  ledger  autopsy  compare  ops  bird's-eye                   |
+---------------------------------------------------------------------------------+
| +------------ ITER -----------+ +------ TRAIN LOSS ------+ +--- THROUGHPUT ---+ |
| | 25,650                       | | 0.65                   | | 0.21 it/s        | |
| | 37.4% of 68,520 · running    | | val 0.79 · at 25,000   | | peak 22.9 GB     | |
| | seg-local 3,650 + 22,000     | |                        | | log 45s ago      | |
| | ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░ | |                        | |                  | |
| +------------------------------+ +------------------------+ +------------------+ |
|                                                                                  |
| Loss curve — stitched across restarts                          [ log tail ]      |
| [ D3 chart ]                                                                     |
| Restart lineage                                                                  |
| Actions                                                                          |
+---------------------------------------------------------------------------------+
| LACUNA  Segment 6, warming up at iter 25600. Val is 0.790. First eval will tell. |
+---------------------------------------------------------------------------------+
```

## Information hierarchy (above the fold)

Phone (390 × 844) — the first ~500 px of the page carry:
1. Ambient chip (**"is it healthy right now?"**)
2. Iter card with progress + status + pid (**"where are we?"**)
3. Segment timeline head (**"how many rollbacks so far?"**)

That's the SRE triangle. Everything else is either below the fold or
reachable via the viewbar. Lacuna narration lives at the bottom of the
viewport (fixed) and is always the answer to **"what changed?"** in
plain English.

Desktop (1440 × 900) — the first ~450 px carry the run-header (title +
chip + buttons), the segment timeline (visual "run so far"), and the
three stat cards side by side. Loss curve and log tail sit below the
fold — reachable in one scroll.

## Typography and density

- Body font: `var(--mono)` — ui-monospace / SF Mono / JetBrains Mono.
- Big numbers: tabular figures (`font-feature-settings: "tnum"`) so
  a changing iter never causes the following text to jitter.
- Labels: 10 px, uppercase, letter-spacing 0.16 em. Small enough to
  fade to secondary attention, wide enough to still read on a phone.
- Card padding: 10 px on phone, 14 px on desktop. The desktop grid
  gets a wider gutter (14 px vs 10 px) because the extra width can
  absorb the breathing room without pushing content below the fold.

## Accessibility

- Viewbar is `role="tablist"` with `aria-selected` on the active
  button. Each view partial is a `<section>` toggled via `[hidden]`
  and a `data-view` attribute for CSS hooks.
- Narration strip is `aria-live="polite"` — screen readers announce
  message changes without stealing focus.
- Focus outlines: default browser outlines kept (removed nowhere).
- Colour contrast: all body text on all background surfaces sits at
  or above WCAG AA (verified visually; the palette tokens carry the
  brand's contrast guarantees).

## Rollout

- Feature branch: `feat/forge-redesign-2026-07-10`.
- PR target: `Lacuna-Labs/forge` base `main` (after merging up
  through `forge/live-views-2026-07-10`).
- After PR merges, the running server (pid 91843) is restarted by
  the operator when they authorise it — not by the CI, not by this
  PR.

## See also

- `sexy-stops-and-continues.md` — Pause/Resume UI, timeline, chip.
- `forge-views-and-narration.md` — seven views + narration strip.
- `~/code/lacuna-labs/CLAUDE.md` — 3-viewport ship-lock ritual.
- `~/code/lacuna-docs/brand/assets/canvas-palette.css` — palette tokens.

---

# §VIEWS — Forge Views + Narration (folded)

---
slug: forge-views-and-narration
title: Forge views and Lacuna narration panel
category: spec
kind: interface
version: 1.0.0
canonical: true
owner: forge-lane
status: draft
last-reviewed: 2026-07-09
extracted-from: THE-BIG-FORGE-PLAN.md Part I (view model)
---

# Forge views and Lacuna narration panel

## Purpose

The forge run page today is a single vertical scroll of 32 insight panels. That is the *right-now* lens and nothing else — you can see the current iter, the current adam moment, the current banned-list. You cannot see the *shape of the run*: how segments stitched, where an incident bit, which config change killed the val curve, how two attempts compare, how the whole fleet is doing. This spec defines a **seven-view model** that keeps the right-now lens but adds six more lenses that share the same data, plus a persistent **Lacuna narration strip** that speaks plain English about whatever view you are on.

The frame is: views are *how you look at the run*. Panels are *what you see through that lens*. The narration strip is *Lacuna, standing next to you, telling you what she sees*.

## Scope

**Covers.**
- The seven view identifiers, their content, their URL routing, their deep-linking behaviour.
- Eight backend endpoints (seven view payloads plus one narration payload).
- The Lacuna narration strip: shape, placement, refresh cadence, message composition, template registry.
- The rule-based narration engine (server-side, deterministic this pass).
- Wireframes for Effect, Timeline, and Autopsy views.

**Does not cover.**
- Real-time WebSocket streaming (30 s poll is sufficient).
- Multi-user collab or shared cursors.
- Customisable view layout — the seven views are the seven views, in a fixed order.
- The sexy stops-and-continues Pause/Resume UI itself: it lives *inside* the Effect view but is spec'd separately in `sexy-stops-and-continues.md`.
- The segment timeline SVG component itself: it lives *inside* the Timeline view but is spec'd + built by the sexy stops-and-continues worker and reused here.
- Model-authored narration. This pass is rule-based; the template registry is the hook the future local Lacuna model will plug into.

## Definitions

- **View** — one of seven named lenses on a training run.
- **Panel** — one of the ~32 insight cards inside a view; the atomic unit of what the operator sees.
- **Segment** — a contiguous span of true-iters between two rollback points (or between start and now); the run's ledger records them in order.
- **Incident** — a categorised event (C1-C9 class) that ended a segment; recorded in the ledger with root cause + fix + resume-from iter.
- **True-iter** — the ledger-corrected global iter count; distinct from a segment's raw local iter.
- **Narration slat** — the wire form the narration endpoint returns; see `slat-format.md`.
- **Narration engine** — the server-side composer that renders a narration slat from context (last-N insights, ledger, current view).

## Normative content

### 1. The seven views

Fixed order, fixed identifiers, fixed URL keys. Default view is `effect`.

| # | Slug | One-line intent |
|---|------|-----------------|
| 1 | `effect` | The run right now. |
| 2 | `timeline` | The run across time, segment by segment. |
| 3 | `ledger` | The resume-offset ledger, rendered pretty. |
| 4 | `autopsy` | Deep dive on one incident. |
| 5 | `compare` | Two segments (or ranges) side by side. |
| 6 | `ops` | All active runs on the machine. |
| 7 | `birds-eye` | The whole run from start to now, on one screen. |

The seven appear as a segmented control at the top of the run page, in that order. The control never scrolls off; it is sticky under the topbar. Clicking a segment updates the URL to `?view=<slug>` and swaps the main content region without reloading. Deep-linked query parameters (`segment`, `iter`, `incident_id`, `a`, `b`) survive view switches when they still apply, and are silently dropped when they do not.

### 2. What each view shows and does not show

**2.1 Effect.** The current run panel, minimally restructured. All 32 insight panels stay exactly as they are. The additions from `sexy-stops-and-continues.md` — Pause/Resume buttons, ambient status chip, suggested-fix banner, diff modal — live at the top of this view. **Does not show**: any cross-segment view. If you want history, go to Timeline.

**2.2 Timeline.** Horizontal chronological chart across the top of the view. **Swim lanes** — one horizontal band per segment, stacked vertically, most-recent segment on top. Time axis is true-iter. **Checkpoints** are diamond markers on the band at the iter they were written. **Incidents** are red X markers at the incident iter, with a C1-C9 class chip floating above. **Config-edit events** are pin markers. Hover any marker → tooltip with iter, val at that point, one-line config summary, incident category if applicable. Click a checkpoint → drill-in modal with checkpoint contents. Click an incident → jump to Autopsy view for that incident. Below the swim-lane chart: a per-segment strip of scorecard tiles (one tile per scorecard captured in that segment, showing frozen%, banned-hits, hedge). **Reuses** the segment-timeline SVG component built by sexy-stops-and-continues; this spec does not redefine it.

**2.3 Ledger.** The `resume-offset.json` rendered pretty. Two-column layout. Left column: every **segment** as a card with iter range (true-iter start → true-iter end), config JSON at that segment (pretty-printed), log path, adapter directory, one-line note. Right column: every **incident** as a card with root cause paragraph, C-class chip, fix applied, resumed-from iter. Between adjacent segment cards, a **diff strip** shows what changed in the config: green added, red removed, yellow changed. Copy-to-clipboard button on every card yields YAML of that segment's config.

**2.4 Autopsy (per incident).** Single-incident deep dive. Layout:
- Header: incident id, C-class chip, one-line root cause.
- Left column: root cause paragraph (from ledger). Config-at-time-of-spike, pretty YAML. Related incidents in the same C-class (linked, jumps to their Autopsy).
- Right column: val curve zoomed to the spike window (± 500 iters). Train-loss curve same window. Grad-norm distribution over the spike window. Adam moment ratio at spike, if Part V data available.
- Footer: "Would have been caught by panel N" — reference the panel-to-C-class mapping in `THE-BIG-FORGE-PLAN.md` Part I.

**2.5 Compare.** Two-picker header: segment A, segment B. Or two iter ranges. Grid below:
- Row 1: overlaid val curves (A blue, B orange). Overlaid train-loss curves.
- Row 2: side-by-side config diff. Same green/red/yellow rules as Ledger.
- Row 3: side-by-side adam-moment-health charts.
- Row 4: side-by-side grad-norm distributions.
- Footer: **delta table** — one row per metric, three columns: A, B, delta. Highlights meaningful deltas (>10%).

**2.6 Ops.** All active runs on the machine. Table view.
Columns: run name, current segment, pid, uptime, iter, val, cpu%, memory, next-checkpoint ETA, next-val ETA, status chip (healthy/watch/incident). One row per run. Clicking the row jumps to that run's Effect view. Row background tints the status: green healthy, amber watch, red incident. Refresh cadence: 30 s.

**2.7 Bird's-eye.** The whole training history for one run on one screen. Val curve stitched across all segments. Every checkpoint marked. Every incident marked with a C-class chip. Every config change marked with a pin. Zoom + pan (D3 zoom behaviour). This is the *"hand a stranger the run and they get the story in 10 seconds"* view.

### 3. Lacuna narration strip

**Placement.** Persistent horizontal strip at the **bottom** of the viewport, above the browser chrome, spanning the width of the main content region. Not a floating side panel — it is meant to feel like Lacuna is standing next to you at the operator's shoulder, and a bottom strip reads as narration; a side panel reads as a widget. Height: ~64 px on desktop, ~80 px on mobile (message wraps to two lines).

Reasoning for bottom-strip over floating side panel:
- Never occludes a chart.
- Naturally left-to-right readable.
- Consistent with the operator's chat sidebar (which is right-anchored) — the two together mean the operator has *Lacuna's voice* along the bottom and *the chat with Lacuna* along the right, with no overlap.

**Persistence.** The strip stays visible when views switch. The message fades out and back in on view change (200 ms). Never jarring.

**Refresh.** Polls `/api/watch/narration/{run_name}?view=<current-view>` every 30 s. Also refetches immediately on view switch. Also refetches immediately when a `focus` event fires on the window (operator came back to the tab).

**Content.** Plain-language commentary written for the human operator. Warm, honest, brief. Not `iter 1234, val 0.814`. Instead:

> *"Segment 5, warmup ramping cleanly, adam warm, landmine at iter 350 passed at 4.876. Holding at 0.814. Watch iter-2000."*

Compact rules for what a good message covers:
- **Baseline reference** — where val started vs where it is now.
- **Trend direction** — rising / falling / holding.
- **Notable event** — landmine passed, checkpoint just saved, incident cleared.
- **Watch item** — next val eval, next checkpoint, upcoming milestone.

**View-adaptive.** What Lacuna narrates changes with the view:

| View | Narration angle |
|------|-----------------|
| effect | The right-now. Current iter, current trend, next watch item. |
| timeline | The segment history. "You have five segments; segment 3 was the worst; segment 5 is looking clean." |
| ledger | The story of the run. "Two rollbacks so far; both C1 infra." |
| autopsy | The incident's root cause + how it was fixed. |
| compare | The delta. "Segment 3 held; segment 5 is 12% better at the same iter." |
| ops | Fleet health. "Two runs healthy, one watch. Sakura-4b-v2 is your live one." |
| birds-eye | The full arc. "Started at 6.2, currently 0.814, well under baseline 0.889." |

### 4. Endpoints

All eight endpoints return JSON. All eight are read-only. All eight are safe to call on a live run.

| Method + path | Purpose |
|---|---|
| `GET /api/watch/narration/{run}?view=X` | The narration slat. See §5 for slat shape. |
| `GET /api/watch/views/effect/{run}` | Alias of `/api/watch/insights/{run}` — for API consistency. |
| `GET /api/watch/views/timeline/{run}` | Reuses `/api/watch/segments` (sexy-stops-continues). Adds view-scoped metadata. |
| `GET /api/watch/views/ledger/{run}` | The pretty ledger: segments + incidents + diffs. |
| `GET /api/watch/views/autopsy/{run}/{incident_id}` | One incident's deep-data payload. |
| `GET /api/watch/views/compare/{run}?a=<seg>&b=<seg>` | Two-segment comparison payload. |
| `GET /api/watch/views/ops` | All active runs on the machine. |
| `GET /api/watch/views/birds-eye/{run}` | The whole stitched history. |

Every payload includes a `narration_hint` field with the same shape as the narration slat — so a client that wants to render the narration inline (without a second HTTP round trip) can. The dedicated narration endpoint stays canonical.

### 5. Narration slat shape

```
(narration
  :run "sakura-4b-v2"
  :segment 5
  :iter 1234
  :view effect
  :message "Segment 5, warmup ramping cleanly, adam warm. Landmine at iter 350 passed at 4.876. Holding at 0.814, well under baseline 0.889. Watch iter-2000 val at ~22:14."
  :confidence high
  :ts "2026-07-09T22:45:00Z"
  :links ((iter-2000-watch . "/api/watch/segments#500")
          (baseline-context . "/api/watch/insights/sakura-4b-v2#baseline")))
```

Fields:
- `:run` (string, required) — the run slug.
- `:segment` (integer, required) — current segment ordinal (1-based).
- `:iter` (integer, required) — current true-iter.
- `:view` (symbol, required) — one of the seven view slugs.
- `:message` (string, required) — real sentences, one paragraph, no label soup, no emoji.
- `:confidence` (`high` | `medium` | `low`) — the engine's own read on how sure it is.
- `:ts` (ISO 8601, required) — when the message was composed.
- `:links` (alist, optional) — anchor links back into the app or API for "what she just referenced".

### 6. The narration engine

Server-side, mostly rule-based this pass. Lives at `web/narrator.py`.

**Inputs read on every call:**
- The last ~50 points of the insights timeseries for this run.
- The resume-offset ledger.
- The last incident (if any).
- The current view slug.
- The last scorecard.

**Composition.** A **template registry** keyed by `(view, situation)`. Six situation templates per view is enough to feel real:

| Situation | Trigger |
|---|---|
| `warming` | iter < first-eval and slope negative |
| `holding` | slope ≈ 0 over last 200 iters |
| `climbing` | slope positive (loss rising) — flag it |
| `just-checkpointed` | last scorecard within 60 s |
| `landmine-passed` | landmark iter reached below its threshold |
| `incident-open` | current segment ended in incident, awaiting resume |

Template example (Effect view, `holding` situation):

```
Segment {segment}, {trend_desc}. {milestone_desc}. Holding at {current_val}, {vs_baseline_desc}. Watch {next_watch}.
```

Renders to:

> *"Segment 5, warmup ramping cleanly. Landmine at iter 350 passed at 4.876. Holding at 0.814, well under baseline 0.889. Watch iter-2000 val at ~22:14."*

**Confidence.** `high` when trend and event signals agree; `medium` when trend is ambiguous; `low` when data is thin (<20 points) or a fresh segment just started.

**Extensibility.** The template registry is a dict of `(view, situation) → callable(context) → str`. Adding a template is one PR; swapping the whole engine for a model-authored one is a single flag flip at the endpoint.

### 7. URL routing + deep linking

The view slug is a query param, not a path segment, so the base URL stays `/runs/{name}`. Deep-link examples:

- `?view=timeline&segment=3` — Timeline view, segment 3 highlighted.
- `?view=autopsy&incident_id=C1-2026-07-09-01` — direct to one autopsy.
- `?view=compare&a=3&b=5` — Compare view, pre-picked A and B.
- `?view=birds-eye&iter=22350` — Bird's-eye view, marker on iter 22350.

Back-history is preserved: drilling from Timeline into Autopsy uses `history.pushState`, so the browser back button returns to Timeline with the same scroll position.

### 8. Wireframes (ASCII, 1280 × 720)

**8.1 Effect view.**

```
+============================================================================+
| topbar: forgeweb · sakura-4b-v2 · pid 96914 · [chat]                       |
+============================================================================+
| [ effect ] timeline  ledger  autopsy  compare  ops  birds-eye              |
+============================================================================+
| status chip: HEALTHY  |  segment 5  |  iter 1234  |  [Pause] [Resume]      |
| suggested fix banner (only shown if a fix is being suggested)              |
+============================================================================+
|                                                                            |
|  +------------------------+  +------------------------------------------+  |
|  |  panel 1: live-signs   |  |  panel 2: chat-mirror                    |  |
|  |  (iter · val · lr)     |  |  read-only chat feed                     |  |
|  +------------------------+  +------------------------------------------+  |
|                                                                            |
|  +------------------------+  +------------------------------------------+  |
|  |  panel 3: scorecards   |  |  panel 4: canonical drift wall           |  |
|  +------------------------+  +------------------------------------------+  |
|                                                                            |
|  ... 28 more panels, unchanged from today ...                             |
|                                                                            |
+============================================================================+
| Lacuna: "Segment 5, warmup ramping cleanly. Landmine at 350 passed at      |
|          4.876. Holding at 0.814, well under baseline 0.889. Watch         |
|          iter-2000 val around 22:14."                                      |
+============================================================================+
```

**8.2 Timeline view.**

```
+============================================================================+
| topbar                                                                     |
+============================================================================+
|   effect  [ timeline ]  ledger  autopsy  compare  ops  birds-eye           |
+============================================================================+
|                                                                            |
|   swim lanes (true-iter along X, segments stacked along Y):                |
|                                                                            |
|   seg 5 |=====================================>  (live, no incident)       |
|         |    ^cpt              ^cpt                                        |
|   seg 4 |==========X (C2 config)                                           |
|         |    ^cpt                                                          |
|   seg 3 |==================X (C1 infra)                                    |
|         |         ^cpt   ^cpt                                              |
|   seg 2 |=================X (C1 infra)                                     |
|   seg 1 |=====================X (C4 data+config)                           |
|         +----+----+----+----+----+----+----+----+----+----> true-iter      |
|         0   200  400  600  800  1000 1200 1400 1600 1800                   |
|                                                                            |
|   per-segment scorecard strip:                                             |
|   seg 5: [sc-100] [sc-500] [sc-1000] [sc-1500]                             |
|   seg 4: [sc-100] [sc-500] [sc-1000]                                       |
|   ...                                                                      |
|                                                                            |
+============================================================================+
| Lacuna: "Five segments so far. Segment 3 was the worst, took a C1 infra    |
|          rollback at iter 720. Segment 5 is looking clean, live at 1234."  |
+============================================================================+
```

**8.3 Autopsy view.**

```
+============================================================================+
| topbar                                                                     |
+============================================================================+
|   effect  timeline  ledger  [ autopsy ]  compare  ops  birds-eye           |
+============================================================================+
| incident id: C1-2026-07-09-01  |  class: C1 infra                          |
| root cause: OOM on iter 720; grad-norm spike at 719 preceded the crash     |
+============================================================================+
|                                                                            |
|  +-------- root cause + config ---------+  +----- charts around spike ---+ |
|  | Paragraph: at iter 720 the process   |  |   val curve:                | |
|  | crashed after a 3-step grad-norm     |  |     zoomed to [220..1220]   | |
|  | spike from 0.4 to 9.2. adam moment   |  |                             | |
|  | ratio was 12x for two iters before   |  |   train loss:               | |
|  | the crash. classified C1 infra;      |  |     same window             | |
|  | resumed from iter 600 with clip 1.0. |  |                             | |
|  |                                      |  |   grad-norm distribution:   | |
|  | config-at-spike:                     |  |     histogram over window   | |
|  |   lr: 3e-5                           |  |                             | |
|  |   clip: 3.0                          |  |   adam moment ratio:        | |
|  |   batch_size: 8                      |  |     (if Part V data)        | |
|  |                                      |  |                             | |
|  | related C1 incidents:                |  |                             | |
|  |   - C1-2026-07-08-02                 |  |                             | |
|  |   - C1-2026-07-06-01                 |  |                             | |
|  +--------------------------------------+  +-----------------------------+ |
|                                                                            |
|  would have been caught by: panel 14 (adam-moment-ratio) at iter 719       |
|                                                                            |
+============================================================================+
| Lacuna: "This one was the classic C1: adam moment ratio spiked to 12x for  |
|          two iters, grad-norm followed, process crashed. Fix was clip 3.0  |
|          to 1.0; that held."                                               |
+============================================================================+
```

### 9. Non-goals

- Real-time WebSocket streaming for narration — 30 s poll is fine.
- Multi-user collab.
- Customisable view layout.
- Any change to the 32 insight panels themselves in this pass. Their content stays exactly as it is inside Effect view.
- Model-authored narration in this pass. The rule-based engine is the deliverable; the model hook is a future PR.

## Non-normative examples

**Sample narration message, Timeline view, mid-run, two incidents so far:**

> *"Five segments live. Segment 3 was the ugly one — C1 infra rollback at iter 720. Segment 5 is 12% better at the same iter and holding. Next checkpoint at 22:15."*

**Sample narration message, Ops view, three runs on the machine:**

> *"Two runs healthy, one watch. Sakura-4b-v2 is your live one at iter 1234, val 0.814. Sakura-coder-4b is idle since 21:00 — expected. Sakura-v1-ship-candidate is done."*

**Sample deep-link:**

`/runs/sakura-4b-v2?view=autopsy&incident_id=C1-2026-07-09-01` — jumps straight to the autopsy for the iter-720 crash.

## Compatibility and versioning

- Endpoint paths are versioned by their prefix `/api/watch/views/`. Adding a new view is additive; renaming one is a major bump.
- The narration slat shape is stable; adding a new field is additive; removing or retyping a field is a major bump.
- The template registry is a **private surface** — templates can change freely without a version bump. The message string is not machine-parsed.
- The seven view slugs are stable identifiers. A future eighth view would be additive; reordering the segmented control is not a breaking change.

## See also

- [`sexy-stops-and-continues.md`](./sexy-stops-and-continues.md) — the timeline SVG component + Pause/Resume UI that live inside Timeline and Effect views.
- [`slat-format.md`](./slat-format.md) — historical (superseded by SLAT 1.0).
- [`~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`](../../../../lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md) — the canonical wire form the narration endpoint uses; the `narration` record fits SLAT §4.1 record taxonomy.
- [`../engineering/THE-BIG-FORGE-PLAN.md`](../engineering/THE-BIG-FORGE-PLAN.md) — Part I, panel enumeration and C-class mapping.
- [`../engineering/straggler-burndown-report.md`](../engineering/straggler-burndown-report.md) — the Part V soft-degrade work that Autopsy's adam-moment section reads from.

---

# §VALIDATION — Caliper + Playwright validation (added 2026-07-11)

Forge ships with Caliper (perf regression) + Playwright (TUI + browser) validation lanes. Every Forge release runs both against the last three known-good weave-training runs before deploy. Marcus owns the gate.

# §WEAVE-INTEGRATION — Forge as operator TUI for Weave training

Forge is the operator surface that runs the Weave 2.0 procedure (`WEAVE-TRAINING-1.0.ENG.md` §PROCEDURE). The typical operator flow:
1. Forge opens on the training box.
2. Operator picks a stage (Stage-0 / Saturate / Rebalance / Diversify / Anneal).
3. Weave procedure fires; Forge tails the log + narrates.
4. Ship-gate lands via Forge; operator signs off.

Forge's panel categories (§PANELS) map to Weave stages; Forge redesign (§REDESIGN) covers the 2026-07-10 UI refresh; Forge views + narration (§VIEWS) covers Sakura-narrated commentary during training.

---

# §SLAT — Corpus, run manifests, narration on the SLAT wire (added 2026-07-12)

> Cross-refs: `~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`, `SAKURA-SCHEME-1.0.ENG.md §SLAT`, `CORTEX-1.0.ENG.md §SLAT`, `LOAM-1.0.ENG.md §SLAT`. Task #62 landed the surface pass; this section threads SLAT through Forge's corpus atoms, run manifests, iter tick events, and narration payloads. Additive to §VIEWS §5 above and every existing Forge section.

## §SLAT.1 — Doctrine

Forge trains models on corpora and reports what happened. Both the training input (the corpus) and the training report (the narration + insights + incidents) are records with heads, keys, and positional data. SLAT is the wire form for those records.

The load-bearing property: the corpus atoms Forge streams in during training are the SAME shape that Sakura reads at inference. She wrote them with `slat/write`; Forge reads them with `slat/read`; the training loop dispatches on the head symbol; the model that emerges knows the shape natively because the shape is Scheme.

## §SLAT.2 — Corpus atoms as `atom` slats

`~/.forge/corpus/sakura/train.jsonl` is being migrated to `~/.forge/corpus/sakura/train.slatl` per SLAT §5.8. Every line is one atom:

```slat
(atom
  :id     "atm-scheme-lambda-001"
  :type   'code
  :domain 'scheme
  :weight 1.0M
  :body   (lambda (x) (* x x))
  :meta   (:tags ('language 'lambda 'basics)
           :author 'sakura
           :audited-by 'zain))
```

Reader points:

- Weight is `bigdecimal` (`M`-suffix). Exact through the wire. SLAT §3.3 rationale.
- Body is a nested slat — a code slat within an atom slat. Homoiconicity means the trainer can hand `:body` directly to the reader for evaluation-during-teaching (Book of Reason Ch 3 pattern).
- Meta is a `record` slat carrying arbitrary provenance.

Backward-compat during migration: Forge reads SLAT first, JSON second, and emits a deprecation warning on the JSON path (SLAT §10.4 timeline).

## §SLAT.3 — Run manifests as `snapshot` slats

Every training run pins its parameters, seed, adapter config, dataset hash, and dependency versions in a manifest. That manifest is a snapshot:

```slat
(snapshot
  :ts      #inst "2026-07-12T04:22:00Z"
  :subject 'training-run/sakura-4b-v2
  :body    (training-run
             :seed      4137
             :adapters  "adapters.safetensors"
             :max-iter  68520
             :stage     'saturate
             :corpus-cid #b64 "…"           ; SHA-256 of the .slatl corpus
             :model-base "sakura-4b-base"
             :model-out  "sakura-4b-v2"))
```

Content-id (SLAT §5.4) on the corpus root gives Forge a stable name for the training material — same bytes in, same cid out. Two runs with the same manifest cid trained on the same corpus produce the same trained model modulo any nondeterminism the operator introduced. Reproducibility becomes a byte comparison.

## §SLAT.4 — Iter ticks as `event` slats

Every iteration produces a tick event on the Loam wire:

```slat
(event
  :ts    #inst "2026-07-12T04:22:00Z"
  :kind  "forge.iter.tick"
  :run   'sakura-4b-v2
  :iter  22350
  :loss  0.814M
  :segment 5
  :grad-norm 0.42M
  :lr    3e-5)
```

Loam ingests to `SAKURA/training-runs` projection (LOAM §SLAT.2 authoring pattern). Every incident, checkpoint, and landmine pass emits its own event on the same wire.

## §SLAT.5 — Narration slats already ship

§VIEWS §5 above shows the `narration` record. That IS a slat record. SLAT §4.1 registry table lists `narration` as consumer-registered; Forge is the consumer. Wire form unchanged from §VIEWS §5; canonical form per SLAT §6.1.

Fields already present in §5 map to SLAT primitives:

| Field | §5 says | SLAT primitive |
|-------|---------|----------------|
| `:run` | string | string |
| `:segment` | integer | integer |
| `:iter` | integer | integer (bignum after 2^53) |
| `:view` | symbol | symbol |
| `:message` | string | string |
| `:confidence` | `high` \| `medium` \| `low` | symbol |
| `:ts` | ISO 8601 | `#inst` — see SLAT §3.8 |
| `:links` | alist | `list` of `pair`s |

Migrating `:ts` from string to `#inst` closes the epoch/ISO-string ambiguity SLAT §3.8 was designed to fix. Existing consumers keep parsing; new consumers read a canonical instant.

## §SLAT.6 — Provenance chains as signed slats

Forge's training runs are signed. Each iter tick, each checkpoint save, each narration payload is wrapped:

```slat
(signed
  :body      (event :ts #inst "…" :kind "forge.iter.tick" :run 'sakura-4b-v2 :iter 22350)
  :signed-by "forge@lacuna"
  :signature-algo "ed25519"
  :signature #b64 "…"
  :cid       #b64 "…"
  :nonce     #b64 "…"
  :ts-signed #inst "…")
```

Downstream — Loam ingest, dashboard queries, ship-gate audits — verify the signature before trusting the tick. Rogue training runs (corrupted, injected, replay-attacked) get rejected at the verifier. See SLAT §6.7 for the Merkle attestation shape used on ship-gate corpus-manifest verification.

## §SLAT.7 — Cross-references

- SLAT primitives — `SLAT-1.0.SPEC.md §3`
- Atom slat — `SLAT-1.0.SPEC.md §4.1` (registry row 1)
- Snapshot + delta — `SLAT-1.0.SPEC.md §4.1` (rows 5, 6)
- Signing envelope — `SLAT-1.0.SPEC.md §6.2`
- Merkle attestation — `SLAT-1.0.SPEC.md §6.7`
- train.jsonl → train.slatl migration — `SLAT-1.0.SPEC.md §5.8, §10.4`
- Loam ingest of Forge events — `LOAM-1.0.ENG.md §SLAT`
- Language reader Forge uses — `SAKURA-SCHEME-1.0.ENG.md §SLAT`

