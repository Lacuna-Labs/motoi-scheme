# Two giants, prompt-conditioned by shape, no SFT

2026-08-03. Answer to: *can a 30B coder plus Mistral, primed with our own old
data, finish the code work, fill the gaps, and do the fan-out — locally?*

**Yes.** One correction to the method, one number that has to be measured before
the fan-out is schedulable. Both below.

---

## 1. The correction: you can't feed the manual, and you shouldn't

The reference is **15.2 MB** across 89 chapters. The books are **14.8 MB** across
825 files. Together ≈ 7.5M tokens. The largest single chapter, `39-list.slat`, is
1.0 MB ≈ 260K tokens on its own. No context window on this machine holds any of
that, and renting one is the thing we are not doing.

**Your shape idea is the fix, and it is better than whole-manual anyway.** Feed
it many examples of ONE shape, then hand it the next unit of that same shape.
A model asked to produce a `row-4-proof` after seeing two hundred real
`row-4-proof`s is doing pattern completion, which is the thing these models are
actually good at. A model asked to produce one after reading a 260K-token
chapter is doing comprehension, which is where they drift.

### Why this is nearly free

The exemplar block is **identical for every unit of the same shape**. MLX can
prefill it once and reuse the KV cache for the whole shape's run
(`make_prompt_cache` + `cache_history`). So:

- prefill the shape prefix: **once**, tens of seconds
- per unit: the prefix is already resident, you pay only for the unit + output

That is the whole trick. Priming with hundreds of exemplars costs about the same
per-unit as priming with four, as long as the prefix does not change. Today
`emit_staging_fill.py --shots 4` rebuilds a fresh 4-shot prefix per prompt and
pays for it every time — it is doing the expensive version of the cheap thing.

### The real exemplar ceiling

Not ten thousand. At ~250 tokens per pair:

| model | context | exemplars that fit | KV cache cost |
|---|---:|---:|---:|
| Qwen3-Coder-30B-A3B-4bit | 256K native | ~800 | large |
| Mistral-Small-3.2-24B-4bit | 128K | ~400 | large |

Practical setting, leaving room for the unit and the output: **200–300 exemplars
per shape**, cached. That is 50–75× what it gets today. If 300 doesn't lock the
shape, 10,000 wouldn't either — the failure would be that the shape isn't
learnable from examples, and the answer then is a stricter template, not more
tokens.

### Which old data may be used as exemplars

Exemplars are **read, never emitted**. The quarantine rule governs what enters
MK-ULTRA, not what the model may look at. But pre-lock rows carry old dialect and
old verbs, and a model that sees them will imitate them.

**Rule: exemplars come from the ELIGIBLE 219,162 only.** Specifically the
`haiku-revoice` 3,687 and the clean lanes (`ref-grid`, `book-code`,
`mk-ultra-reversals`) — those came back with zero defects in the full
re-verification, so they are the best voice we have and the safest.

The 5,553 known-bad rows are excluded from the exemplar pool by id. Priming a
model with rows we already proved wrong is how a defect becomes a style.

---

## 2. Who owns what

| | Qwen3-Coder-30B-A3B-4bit (~17 GB) | Mistral-Small-3.2-24B-4bit (12 GB) |
|---|---|---|
| owns | every shape whose output is **Scheme** | every shape whose output is **prose** |
| shapes | buildup ladders, decompose, reversals, run-explain programs, broken-example fixes, the 463 anchor-row grids | kid / layperson / phd re-voice, dialogue explosion, philosopher lenses, book chapter voice |
| gate | **the interpreter** — run it, keep it if it runs and the value matches | none available; gated by the voice pack and by shape conformance |

The reason to buy the coder at all: **today, Scheme is being written by a prose
model.** `emit_staging_fill.py --backend mistral` is a 24B instruct model
generating Motoi programs. It works because every program is run and discarded if
it fails — but the discard rate is what sets wall-clock, and a coder cuts it.

They do **not** fit in memory together. 17 + 12 = 29 GB of weights on 32 GB, with
Metal's wired limit around 21 GB. So:

---

## 3. The alternating daemon

One process. One model resident at a time. Swaps on a shape boundary, not a row
boundary, so a swap costs one load (~40–60 s) amortised over thousands of units.

```
                 ┌─────────────────────────────────────┐
                 │  work queue: (shape, unit) tuples    │
                 │  partitioned by owning model         │
                 └─────────────────────────────────────┘
                     │                          │
              CODE shapes                  PROSE shapes
                     │                          │
   ┌─────────────────▼──────────┐   ┌───────────▼──────────────┐
   │ load coder-30B             │   │ load Mistral-24B         │
   │ for each shape:            │   │ for each shape:          │
   │   prefill 200-300 exemplars│   │   prefill 200-300        │
   │   cache prefix             │   │   cache prefix           │
   │   stream units, batch 16   │   │   stream units, batch 16 │
   │   RUN each output          │   │   shape-conform each     │
   │   keep iff runs & matches  │   │   append to lane         │
   │ unload                     │   │ unload                   │
   └────────────────────────────┘   └──────────────────────────┘
                     └────────────► alternate ◄──────────┘
```

Checkpointed per shape, resumable, append-only. Killing it mid-run loses at most
one shape's tail. It writes into new lane files only, so it can never collide
with the repairs I'm doing by hand.

---

## 4. Can these two do the fan-out?

**Structurally yes** — the fan-out is the same loop with a different queue.
**Schedulably: unknown until measured, and that measurement is the first job.**

The number that decides it is aggregate tokens/sec under batch-16 decode with a
cached prefix, on each model. Everything else follows:

```
pairs/day = (tok/s × 86400) / tokens-per-pair
```

At 300 tokens/pair, 400 tok/s aggregate gives ~115K pairs/day; 800 tok/s gives
~230K. A 3M-pair fan-out is then **13 to 26 days of continuous run**. That is the
crux, and I am not going to pretend to know which end it lands on before
measuring it. If it lands at the slow end, the lever is that most of the fan-out
is **template expansion, not generation** — the model is needed for the variant
lanes, not for every pair. Splitting deterministic expansion from model expansion
is what makes the number tractable, and I'll have the split when the census runs.

**Benchmark: ~15 minutes, tonight, before anything else.**

---

## 5. What runs overnight, unattended

Every script joins `scratch/no-phone-home.py` and imports `offline_guard` first —
`socket.connect` raises on any non-loopback address. No allowlist, no off switch.
Nothing phones anybody.

| # | job | model | needs me? |
|---|---|---|---|
| 0 | throughput benchmark, both models, batched + cached prefix | both | no |
| 1 | shape census: every shape in the eligible set, its exemplar pool, its unit backlog | none | no |
| 2 | exemplar pack build — 200–300 best rows per shape, defect ids excluded | none | no |
| 3 | reference voice backlog: 451 verbs × 3 registers = 1,353 units | Mistral | no |
| 4 | code fills: 463 anchor-row grids + buildup/decompose/run-explain | coder | no |
| 5 | book voice: 752 chapters × 3 = 2,256 units | Mistral | **blocked on my repairs** |

Jobs 0–4 start tonight. Job 5 waits, because voicing prose that is about to be
corrected means voicing it twice.

---

## 6. What I do by hand, starting now

### 6a. The 233 note repairs — measured, not guessed

`scratch/anchor_repairs.py` locates each repair by anchoring on the **pair**
(code → arrow → old value), not the value alone. Result:

| | |
|---|---:|
| anchors uniquely | **197** |
| no anchor | 35 |
| ambiguous (2 sites) | 1 |

The 36 are two known shapes, both fixable:

- **19 reference records** use `:code "…" :note "<value> — explanation"`. There is
  no `; =>` arrow to anchor on. Needs a second anchor form.
- **17 book values** were written **abridged** — `(12.333... 13.666... 15.0)`,
  `... 61 libs in all, ending ...`. The prose deliberately elides. These are not
  wrong claims; they are summaries. Replacing them with a 400-character literal
  makes the book worse. **These get a judgement call, not an automatic splice.**

Also found: my splice had an **escaping bug** — it decided whether to escape the
replacement from whether the *old value* happened to contain a quote, rather than
from whether the span sits inside a `:prose "…"` literal. All 197 spans are
inside a literal (verified by quote-parity scan). The rule is positional. Fixed.

Nothing is applied until all 233 are accounted for. Applying 197 and skipping 36
silently is the exact shape of the failure that put 85 wrong claims in the corpus.

### 6b. The engine conformance divergences

`scratch/R7RS-CONFORMANCE-FINDINGS-2026-08-02.md` — 48 flagged records:
`(= 1 1 2)` → `#t`, `(string=? "a" "a" "b")` → `#t`, `(round 9/10)` → `+nan.0`,
`(eq? '() '())` → `#f`, `exact?`/`inexact?` contradicting each other, `read` and
`set-cdr!` unbound. These are bugs in `src/`, not in the corpus.

**I am not quoting a compliance percentage.** `src/reader.js` has been patched
since that report and the number will have moved. It gets re-measured, and the
gate that reports it is the value gate (`verify-reference-notes.py`), never the
run-only gate that certified us clean twelve times while we were not.

### 6c. The 609 non-deterministic rows

`stats/*`, `cortex/*` memory ids, `random`, `now`. Not repairable — any value
written down is wrong tomorrow. They leave the fold. Sanctioned exception to
only-add, same class as anchor-aware dedup.

---

## 7. After that

1. Repairs land → book voice unblocks → the daemon takes the rest.
2. Freeze and assay: `lane_healthcheck.py`, `readiness_assay.py`, and the three
   standing gates (anchor-aware dedup, template-lock diversify, held-out leak —
   hard blocker).
3. **Then stop.** Wiring to forge, and the fan-out itself, wait for your go.
4. Move over to Curator. Then the cart jobs. Then Friday.

Nothing in stages 1–3 requires a paid call, an agent, or a network socket.
