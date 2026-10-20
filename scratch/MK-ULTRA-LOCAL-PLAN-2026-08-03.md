# Finishing the reference and the books — locally, up to but not into the explosion

2026-08-03. Every stage below runs on this machine. No paid API, no agent, no
network. `scratch/no-phone-home.py` is the proof and every new script joins it.

The finish line for this plan is **prep complete**: the reference documents every
bound verb, the books are correct and voiced, and every anchor row exists for the
verbs that were added after the fold was built. **The explosion rounds are
deliberately not run.** They are the last thing, they run over frozen prep, and
firing them early is how you get a fold you have to rebuild.

---

## Where it actually stands (measured today, not remembered)

| | count |
|---|---:|
| verbs bound in the engine | 1,763 |
| verbs documented in the reference | 1,679 |
| **undocumented** | **108** — 10 plain, 98 namespaced |
| documented verbs with a `ref-grid` anchor row | 1,216 |
| **documented verbs with NO anchor row** | **463** |
| documented verbs re-voiced (kid/layperson/phd) | 1,229 |
| **documented verbs never voiced** | **451** |
| books on disk | 34 (895 chapters) |
| books voiced in all three registers | **3** (Challenges, Arcade Games, Animation) |
| books with zero voice rows | **24** |
| book chapters never voiced | **752** |
| finalized note repairs waiting to be applied | 233 |

The 463 with no anchor row are overwhelmingly the R7RS core primitives authored
after the fold was generated — `*`, `+`, `-`, `<`, `<=`, `=`, `abs`, … This is
the **gap**, and it confirms the read: the fold is not poisoned, it is *behind*.

---

## Stage 0 — mechanical fixes (me, foreground, no model)

The 233 finalized note repairs in `scratch/repair-final.jsonl` — 79 carry a
model-written explaining clause that a local judge cleared, 154 are the bare
corrected value. 214 land in books, 19 in the reference.

The blocker is anchoring, not authoring: book code lives inside escaped
`:prose "…"` string literals, so nothing is byte-identical to the file and only
74 of 214 currently locate. `audit-books-v2.py` now emits `literal_span` for each
block; the apply step decodes the literal, patches inside the decoded text, and
re-escapes. **Nothing is applied partially.** Applying 74 and silently skipping
140 is the exact shape of the failure that put 85 wrong claims in the corpus.

Also in Stage 0: the stale-broken and wrong-value rows that
`scratch/verify-fold.py` is finding across the 8 `corpus-reversal` shards. Two
different remedies —

- **stale-broken** and **wrong-value, deterministic** → repair the stated value
  from the interpreter's actual output. The harness already ran the block, so the
  right answer is in hand and a model is never asked for a value.
- **non-deterministic** (`stats/*`, `now`, `random`, `cortex/*` memory ids) →
  **delete the row.** `(cadr (assoc :total-calls (stats/summary)))` recorded as
  `895065` is not repairable; any value written down is wrong by tomorrow. These
  rows teach a false constant and must leave the fold. This is the sanctioned
  exception to only-add, same class as anchor-aware dedup.

## Stage 1 — close the reference (me, no model)

Document the remaining **108** verbs. They are not one job:

- **6 record internals** — `_make-record`, `_make-record-type`, `_record-of-type?`,
  `_record-ref`, `_record-set!`, `_record?`. Underscore-prefixed, not user-facing.
  Decision needed: document as internals or mark deliberately-undocumented. Either
  way they stop showing up as a gap.
- **4 genuine R7RS-small names** — `call-with-port`, `exit`, `floor/`, `truncate/`,
  plus `call/cc`. These are standard and must be authored properly, cited to their
  R7RS section, per the conformance ladder.
- **2 odd plain names** — `margin`, `motion`. Investigate what binds them before
  writing anything.
- **98 namespaced** — `motoi/*` (34), `composer/*` (26), `artifact/*` (10),
  `book/*` (7), `completions/*` (6), `book-of-code/*` (5), `animation/*` (3), tail.
  Per doctrine, dialect verbs live in their consumer repo — so the first question
  for each prefix is *does this belong in Motoi at all*, not *write a record*.

Core primitives go in the existing topical chapters (39-list, 33-higher-order,
40-math, 52-predicate, 60-string, 12-char, 70-vector, 35-io), **not** 08-base.
That was settled; it is not reopened here.

Gate: `verify-reference-notes.py` (the value gate), not
`verify-reference-records.py` (the run-only gate that failed us).

## Stage 2 — anchor rows for the new verbs (local, deterministic, no model)

`emit_ref_grid.py` generates the 5-row grid straight from the reference source —
`provenance: reference-source-deterministic`, no model in the loop, so there is
nothing to hallucinate. Run it over the **463** verbs with no anchor, plus the
108 from Stage 1 once authored, into a new lane file. Add-only; existing rows are
not regenerated.

Then the three staging fills — `emit_staging_fill.py` already has
`--backend mistral` — for buildup, decompose and run-explain over the same set.
Every emitted program is run by the interpreter and kept only if it runs.

## Stage 3 — the voice work (local model, background daemon)

This is the job that runs unattended overnight, and it is safe to run beside
Stage 0 because **it only writes new rows into new files.** It never edits
existing text, so it cannot collide with the repairs.

- **451 reference verbs × 3 registers = 1,353 units** — `revoice_graph.py`
- **752 book chapters × 3 registers = 2,256 units** — `revoice_book.py`

Configuration change required: both `revoice_book.py:371` and
`revoice_batched.py:143` still default to `ExplodeConfig(backend="claude-cli",
model="claude-haiku-4-5")`. The local replacement already exists and is already
batched — `local_llm.py`, resident Mistral-Small-3.2-24B, `generate_batch()` with
true parallel sequences. The work is flipping the default and adding
`--backend local`, not writing anything new.

Order matters: **voice the books after Stage 0 repairs land**, or the model
re-speaks prose that is about to change. The reference verbs have no such
dependency and can start immediately.

## Stage 4 — freeze and assay

`lane_healthcheck.py` and `readiness_assay.py` over the whole prep set, plus the
three standing hygiene gates: anchor-aware dedup, template-lock diversify,
held-out leak (hard blocker — `heldout*` / `held-out` lanes excluded, per-record
`held_out: true` excluded, emit-time backstop).

Then stop. **Do not explode.** The explosion runs on frozen prep, once, when
Alfred says go.

---

## Two tracks, and why they don't collide

| | who | touches | can run unattended |
|---|---|---|---|
| Voice backlog (Stage 3) | local Mistral, daemon | writes NEW files only | yes |
| Repairs + authoring (Stages 0–2) | me | edits EXISTING text | no |

That is the answer to "do I need to put Mistral in the background." Yes, and the
reference half of it can start before anything else is finished.

The third pass — one uniform voice over the whole corpus so it reads as though
one voice wrote it — comes after Stage 0, not before. Running it first means
voicing text that is about to be corrected.

---

## Model assignment

Verified on disk today, in the forge venv (`~/code/forge/.venv`, **mlx-lm 0.31.3**):

| job | model | status |
|---|---|---|
| voice / prose | `mlx-community/Mistral-Small-3.2-24B-Instruct-2506-4bit` | on disk, 12G, won the Jul-31 bake-off |
| judging / screening | `mlx-community/Qwen2.5-7B-Instruct-4bit` | on disk, 4.0G |
| the student | `Qwen/Qwen2.5-Coder-1.5B-Instruct` | on disk, 2.9G |
| **code generation** | — | **the one real gap** |

Marcus's scan (2026-08-03, 10-minute budget) returned one download worth making:
`mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit`, ~17GB, MoE with 3.3B active
params — 30B-class quality at roughly 7B speed, which is what a run-or-discard
generate loop wants. Backup `mlx-community/Devstral-Small-2-24B-Instruct-2512-4bit`.

**Correction to his report:** he flagged mlx-lm as too old to load Qwen3.5-class
architectures. He checked the system Python. The forge venv is **0.31.3** and
does ship `qwen3_5`, `qwen3_5_moe`, `qwen3_moe` and `mistral3`. No upgrade is
needed and the newer repos are not blocked.

He also found **no community benchmark data on Lisp or Scheme at all** — every
coding benchmark he could reach omits it. So the only real measurement is ours:
a 200-row bake-off between Qwen2.5-7B and the new coder on raw
**interpreter-pass rate**, before committing to either. That is one afternoon and
it is cheap.
