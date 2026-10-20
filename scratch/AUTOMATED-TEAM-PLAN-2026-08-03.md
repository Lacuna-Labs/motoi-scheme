# The automated team: two giants, shape-scheduled, plus the fixes I do by hand

2026-08-03. How the coder and Mistral get driven, what each is preloaded with,
what each emits, and where my own repair work sits in the sequence.

---

## 0. One thing I need from you

You ran a full-parameter CPT on the 1.5B that ended around Jul 30. **I cannot
find the checkpoint on this disk.** I searched `~/.forge/runs`, `~/.forge/projects`,
`~/code/forge`, every `*.safetensors` modified Jul 24 – Aug 1, and every directory
matching `*cpt*`. What is here is eight LoRA **SFT** runs (`motoi-0.75` … `5.0`,
Jul 17–19), all naming stock `Qwen/Qwen2.5-Coder-1.5B-Instruct` as base, plus
`forge-fire-cpt.sh` which would write to `$RUNS_DIR/$RUN_NAME` — a directory that
does not exist here.

So either it ran on rented compute, or the checkpoint lives somewhere I haven't
looked. **Tell me the path and everything below points at it.** Nothing in the
plan blocks on it — the SFT base is a parameter, not an assumption — but I am not
going to quietly plan around a checkpoint I never verified.

Correction to my earlier read, which was wrong: I said the CPT couldn't be dated.
You were there and it ran. What I can still say from the corpus itself is that
**CPT ULTRA's stream is 88% word-axis vocabulary** (78,195 of 89,000 rows), with
~10,800 book-text and code-FIM chunks and only 9,563 rows containing Scheme at
all. Its reference lane is 78 records. That shapes what the SFT has to carry:
the substrate is nouns, so the verbs are the SFT's whole job.

---

## 1. The shape is the unit

Every lane in the eligible set is a **shape** — a fixed prompt contract with a
fixed output contract. That is what makes it schedulable, and what makes the
priming cheap: the exemplar block is identical for every unit of a shape, so MLX
prefills it **once** and reuses the KV cache for the entire run.

### The divvy

| shape | owner | preloaded with (exemplars) | emits | gate |
|---|---|---|---|---|
| `ref-grid` rows 1–5 | coder | 12,432 `reference-source-deterministic` rows | 5-row grid per verb | interpreter |
| `buildup` ladder | coder | staging fills, clean subset | program ladder to 60–80 lines | interpreter |
| `decompose` | coder | staging fills, clean subset | labelled part-by-part breakdown | interpreter |
| `run-explain` | coder | staging fills, clean subset | program + what it prints | interpreter |
| `reversal` | coder | 10,000 `mk-ultra-reversals` (zero defects) | code ⇄ description both ways | interpreter |
| `book-code` | coder | 3,749 `book-code-verified` | runnable block per chapter concept | interpreter |
| `broken-example` | coder | `scheme/reference/broken-examples/` | broken → why → fix → lesson | interpreter |
| `revoice kid` | Mistral | haiku-revoice, kid register | chapter/verb in kid voice | shape-conform |
| `revoice layperson` | Mistral | haiku-revoice, layperson register | same, layperson | shape-conform |
| `revoice phd` | Mistral | haiku-revoice, phd register | same, phd | shape-conform |
| `module-qa` | Mistral | 1,220 `module-qa-claude-sonnet-4-6` | R8 module Q&A | shape-conform |
| `wordbook-dialogue` | Mistral | 601 `wordbook-dialogue-*` | philosopher dialogue | shape-conform |

**Exemplar pool rule:** eligible lanes only, and the 5,553 known-bad row ids are
excluded by id. Priming a model with rows we already proved wrong turns a defect
into a house style. The `mk-ultra-reversals`, `ref-grid`, `book-code` and staging
lanes came back with **zero** defects in the full re-verification — those are the
pool.

**Exemplar count: 200–300 per shape.** Not ten thousand — at ~250 tokens a pair
that is 50–75K tokens of prefix, which is the practical ceiling once you leave
room for the unit and the output. Today `--shots 4` rebuilds a fresh 4-shot
prefix on every single prompt; this pays once per shape and gets 50–75× the
priming for roughly the same per-unit cost.

**The asymmetry that matters:** every code shape has a real gate — run it, keep
it only if it runs and the value matches. No prose shape has one. So the coder
can be trusted to be wrong often and cheaply, and Mistral cannot. That is why
Mistral gets the richer exemplar pool and the tighter shape contract.

---

## 2. The daemon, declared in SLAT

The shape record carries everything the scheduler needs, so **adding a shape is
authoring a record, not writing Python**:

```scheme
(shape
  :name "ref-grid-row-4-proof"
  :owner "coder"
  :exemplars (:lanes ("ref-grid") :count 240 :exclude-defects #t)
  :queue (:source "verbs-without-anchor-row" :count 463)
  :gate (:kind "interpreter" :keep-if "runs-and-value-matches")
  :out "lanes/ref-grid-fill.jsonl"
  :batch 16 :max-tokens 1024)
```

The daemon is one process, one model resident at a time, swapping **on a shape
boundary** — ~50 s amortised over thousands of units, not per row. It is
checkpointed per shape, resumable, and **append-only into new lane files**, so it
can never collide with the repairs I am doing by hand.

```
  queue ──► partition by :owner
              │                    │
         CODE shapes          PROSE shapes
              ▼                    ▼
      load coder-30B         load Mistral-24B
      per shape:             per shape:
        prefill exemplars ◄── ONCE, cached
        stream units, batch 16
        gate every output
        append survivors
      unload  ◄──── alternate ────►  unload
```

**What I think of the SLAT part:** it is the right abstraction and worth building.
The shape is already the real unit of this work; writing it down as a record makes
it schedulable, auditable, and attachable to forge as a job spec. One honest
limit — **SLAT declares, Python executes.** MLX is a Python library; making Scheme
drive the actual inference would be theatre. The record is the contract, not the
runtime.

---

## 3. Throughput — the number that decides the fan-out

Structurally the fan-out is the same loop with a different queue. Whether it is
*schedulable* depends on one measured number: aggregate tokens/sec under batch-16
decode with a cached prefix, per model.

```
pairs/day = (tok/s × 86400) / tokens-per-pair
```

At 300 tokens/pair: 400 tok/s → ~115K pairs/day. 800 tok/s → ~230K. A 3M-pair
fan-out is then **13–26 days continuous**. I am not guessing which end. If it
lands slow, the lever is that most of the fan-out is **template expansion, not
generation** — the model is needed for the variant lanes only. The shape census
produces that split.

**Benchmark: ~15 minutes, job #0.**

---

## 4. Tonight, unattended

Every script imports `offline_guard` first — `socket.connect` raises on any
non-loopback address, no allowlist, no off switch — and joins
`scratch/no-phone-home.py`, which is now 11 files and PASSes. The only outbound
call in this whole plan is the model download, which is already done by hand.

| # | job | model | blocked on |
|---|---|---|---|
| 0 | throughput benchmark, both models, cached prefix | both | coder download |
| 1 | shape census — every shape, its exemplar pool, its unit backlog, its template/model split | none | — |
| 2 | exemplar pack build — 200–300 per shape, defect ids excluded | none | job 1 |
| 3 | reference voice: 451 verbs × 3 registers = 1,353 units | Mistral | job 2 |
| 4 | code fills: 463 anchor grids + buildup/decompose/run-explain | coder | jobs 0, 2 |
| 5 | book voice: 752 chapters × 3 = 2,256 units | Mistral | **my repairs** |

Jobs 1–3 can start before the download finishes. Job 5 waits, because voicing
prose that is about to be corrected means voicing it twice.

---

## 5. The fixes I do by hand, in order

### 5a. The 233 note repairs

`scratch/anchor_repairs.py` anchors on the **pair** — code → arrow → old value —
not the value alone, which is why the old attempt found only 74 of 214.

| | |
|---|---:|
| anchors uniquely | **197** |
| no anchor | 35 |
| ambiguous (2 sites) | 1 |

The 36 are two shapes:

- **19 reference records** use `:code "…" :note "<value> — explanation"`. No `; =>`
  to anchor on. Needs a second anchor form — mechanical, I write it.
- **17 book values were written abridged on purpose** — `(12.333... 13.666...)`,
  `... 61 libs in all, ending ...`. These are not wrong claims, they are
  summaries. Splicing a 400-character literal over a readable summary makes the
  book worse. **These 17 get your call, not an automatic edit.** I'll hand you
  the list with both forms side by side.

Also fixed before it wrote anything: my splice decided whether to escape from
whether the *old value* contained a quote, rather than from whether the span sits
inside a `:prose "…"` literal. All 197 spans are inside one — verified by
quote-parity scan. The rule is positional.

**Nothing is applied until all 233 are accounted for.** Applying 197 and skipping
36 silently is the exact failure that put 85 wrong claims in the corpus.

### 5b. The 609 non-deterministic rows

`stats/*`, `cortex/*` memory ids, `random`, `now`. Not repairable — any value
written down is wrong tomorrow. They leave the fold. Sanctioned exception to
only-add, same class as anchor-aware dedup.

### 5c. The 4,944 repairable defect rows

3,768 wrong-value + 1,176 stale-broken, all in the eight reversal shards, from
only 1,627 distinct blocks. The harness already ran every block, so the correct
value is in hand and no model is ever asked for one.

### 5d. Engine conformance

`scratch/R7RS-CONFORMANCE-FINDINGS-2026-08-02.md` — 48 flagged records:
`(= 1 1 2)` → `#t`, `(string=? "a" "a" "b")` → `#t`, `(round 9/10)` → `+nan.0`,
`(eq? '() '())` → `#f`, `read` and `set-cdr!` unbound. Bugs in `src/`, not in the
corpus. **I am not quoting a compliance percentage** — `src/reader.js` was patched
since that report and the number has moved. It gets re-measured with the value
gate (`verify-reference-notes.py`), never the run-only gate that certified us
clean twelve times while we were not.

---

## 6. Then

1. Repairs land → book voice unblocks → daemon takes the rest.
2. Freeze and assay: `lane_healthcheck.py`, `readiness_assay.py`, and the three
   standing gates — anchor-aware dedup, template-lock diversify, held-out leak
   (hard blocker).
3. Re-emit the CPT from live sources once the books are correct. Supersede, don't
   mix.
4. **Stop.** Wiring to forge and firing the fan-out wait for your go.
5. Curator. Then the cart jobs. Then Friday.
