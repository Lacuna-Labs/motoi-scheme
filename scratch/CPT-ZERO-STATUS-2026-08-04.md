# CPT ZERO — where it stands, 2026-08-04 (overnight)

## Gates

| gate | before tonight | now |
|---|---|---|
| test suite | 859 pass / 0 fail | **859 / 0** |
| reference gate | 969 MATCH / 0 / 0 | **969 MATCH / 0 / 0** |
| book gate — mismatches | 349 | **235** (in flight, agents working) |
| book gate — pass | 1149 | **1255** |

Book gate blocks: 8419. `run_errors: []` — nothing in the books crashes.

## What moved

**60 deterministic splices.** 53 mechanical (exactness/whitespace/number), then 7
more once two classes were decided. Every value came from RUNNING the block, not
from judgment. Backups written as `.bak-<timestamp>` beside each file.

**Three gate blind spots closed** — each with a selftest that FAILS on a lie:
- *elision*: `(1 2 3 ...)` passes only when the real value genuinely extends the
  stated prefix. A bare `(...)` is rejected, so it can't rubber-stamp anything.
- *placeholder*: `<count>` is a template slot, not a claim.
- *quoted datum*: a book writing `'nan` matches an engine printing `nan`. This
  alone cleared 32 false mismatches in the honest-null chapter.

Selftest is 11/11 including 3 cases that must fail.

**A defect class named: the book's CALL is wrong, not its claim.** The book
states the right answer but invokes the verb with the wrong argument order or
arity, so the engine returns an answer-shaped nothing. Four fixed by hand in the
OR chapter:
- `ops/markov-step` is `(pi P k)`; the book had `(P pi)` → `(0 0)`.
- `ops/johnson` wants `((id . ((m1 . _) (m2 . _))) ...)`, not flat alists.
- `ops/spt` sorts on a task's FIRST element; the book fed it a malformed
  `(define jobs 'a 'b 'c 'd)` — four separate args — and got one job back.
- `ops/sequence-metrics` takes one argument and returns
  `(makespan total-flow max-lateness)`.

In every case the book's stated value was mathematically correct. The code
around it had rotted.

## Two real engine bugs, found and fixed

`(entity/make 'bullseye 320 240 40 40)` then reading it back gave
`((0 0) #f ([object Object]))` — position wrong, alive? wrong, and a raw JS
object reaching Scheme output. `(entity/remove! 'p1)` left the entity in place.
Root cause: two divergent resolvers, one accepting objects only, the other
objects-or-numeric-ids but never symbols. Now one resolver; `((320 240) #t
("bullseye"))` and remove gives 0. Blast radius was real — `pong.scm` and
`dance-party-visualizer.scm` were both dying on it.

## Needs your call

**1. `[object Object]` is RATIFIED by the reference.** `32-hash:749`,
`01-core:3580/3588`, three in `35-io`, `07-audio:971` all document it as the
expected output. It is a JavaScript artifact, not a Scheme representation — R7RS
says such objects print implementation-specifically, conventionally `#<...>`. I
have this being fixed at both ends (engine prints `#<hash-table>`, reference
notes updated to match) rather than preserved. Say if you want it left alone.

**2. Exact rationals in the stats chapters.** `(/ 10 3)` is now `10/3`, and
`stats-summary` gives `(mean . 232/9)` where the book showed `25.777`. That is
R7RS-correct for exact inputs. It is also harder to read for a beginner. I
spliced the books to match the engine. The alternative is making the stats verbs
return inexact, which would be a language decision, not a book fix.

**3. `[qwen-native:true]` is emitted into training text at 73 sites** by
`_qwen_header()`. It is load-bearing, not decorative — `preflight.py:315` reads
it back. Deliberate 2026-07-21 doctrine. Left untouched; flagging because it is
a vendor token going into CPT ZERO.

## Reference coverage — the honest number

1,865 verbs wired. 1,678 documented in `scheme/reference/`, 299 more specified
in `spec/*.slatl`.

**218 undocumented.** 92 of those are covered by a spec file, which satisfies the
library gate. **126 are in neither** — the true gap:

- **28 plain names.** 6 are internal record primitives (`_make-record`,
  `_record-ref` …) and should be marked internal rather than documented as public
  API. 22 are R7RS-standard file/port/environment verbs — `open-input-file`,
  `with-output-to-file`, `read-bytevector`, `file-exists?`, `exit`, `load`,
  `environment`. Those are transcription from R7RS §6.13/§6.14, not authorship,
  and every example is gradeable.
- **Four core names missing that shouldn't be:** `/` (division — `+`, `-`, `*`
  are all documented), `call/cc` (the long form is documented, the standard
  abbreviation isn't), and R7RS §6.2.6's `floor/` and `truncate/`.
- **98 namespaced Motoi-own:** `motoi/*` 34 (IDE/tutor surface), `composer/*` 26,
  `artifact/*` 10, `book/*` + `book-of-code/*` 12, `completions/*` 6,
  `animation/*` 3, `world/*` 2. These need the implementation read to document
  honestly — real authoring, highest fabrication risk of anything here.
- Two unclassified: `margin`, `motion`.

## The interlock — the important one

The emitter lifts fenced code blocks out of the books **verbatim, `;; =>` claims
included** (`extractors/book.py:extract_code_blocks` → every S0x shape). So every
book claim the gate still calls wrong would have been emitted as training text
asserting a value the interpreter does not produce. That is precisely the
mechanism that put 85 wrong claims into the last corpus source.

There is now a gate-derived quarantine between the books and the emitter:

- `scratch/build_cpt_quarantine.py` turns the gate's verdicts into
  `scratch/cpt-quarantine-blocks.json` — 222 forms across 51 chapters.
- `book.py` drops any block containing a quarantined form. Measured:
  **198 blocks dropped of 11,101 — 1.8%.**

**Correction, found later the same night: that alone did not protect CPT.**
`emit_cpt_v5.py` imports `book.py` for chapter iteration but then threw away
the filtered `ch["code_blocks"]` and ran its *own* `CODE_FENCE_RE.findall(prose)`
at line 714 — so the CPT emit was reading straight past the quarantine. It now
consumes the filtered list. Proved by diffing the emitted book records with the
quarantine on and off; the check that would have caught a cosmetic fix is that
every record present only in the OFF run carries a quarantined form.

Two adjacent defects fell out of chasing that one:

- **`book-of-slat` halted the entire emit.** It was the only book with no
  `MANIFEST.slat`, so the boot-record generator had no `:book-type` to copy and
  `emit_book_shapes` raised `HALT (defect #8)`. The earlier `--limit 500` smoke
  test stopped before book shapes, which is why it looked clean. Manifest
  authored from the chapter records; `:book-type "learning"`. **A full dry-run
  emit now completes: 187,415 records.**
- **The lib smoke tests were a second unverified claim channel.** 17 lib files
  export `TESTS`, `emit_cpt_v5` prints each as a verbatim `; =>` assertion, and
  *nothing in the suite ever ran them*. Two extraction bugs on top: the regex
  stopped at the first `]` (1 test per file instead of all of them) and could
  not read `\'` escapes, so `chem.js` emitted the non-form
  `(chem/atomic-weight \`. Fixed both, then gated the lot —
  `scratch/build_lib_tests_gate.py` runs every assertion and writes only those
  the engine confirms. **151 of 153 verified; the 2 that fail are not emitted.**

It fails safe in both directions. A block whose truth can't be established is
dropped, never rewritten. And because the gate reports the individual *form*
that was wrong, a block is dropped if it merely *contains* one — which
over-quarantines slightly, on purpose. Losing a good block costs a little
volume; emitting a bad one teaches a false answer.

The list is derived, so it shrinks to nothing as the books get repaired.
**Rebuild it after the final gate run, before emitting** — otherwise it
quarantines blocks that have since been fixed.

If `cpt-quarantine-blocks.json` is missing, `book.py` warns loudly to stderr
rather than silently emitting everything unchecked.

## The emit

`emit_cpt_v5.py` smoke-tested clean. Zero model calls — pure deterministic
expansion from the books, word books, `lib/`, and the reference.

**`--skip-mk2-fold` is mandatory.** Line 1769 folds a prior emit into the output
if `~/.forge/data/motoi-mk2-cpt` exists. It does not exist right now, so the
fold is already a no-op, but CPT ZERO supersedes and must never mix.

One latent path: `emit_cpt_v5.py:1399` reads
`/tmp/motoi-audit/miner-nulls-2026-07-22.jsonl`, a pre-repair July-22 artifact.
Guarded by `.exists()` and the file is absent, so it cannot fire tonight. Left in
place rather than editing the emitter unsupervised hours before the run.
