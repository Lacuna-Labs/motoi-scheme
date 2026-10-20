# The plan to a re-runnable CPT — measured, ordered, local-only

2026-08-03. Everything below is a counted number from a gate I ran twice, not an
estimate. The order is the load-bearing part.

---

## 0. DONE — nothing can call out any more

`python3 scratch/no-phone-home.py` → **PASS**, 21 files scanned clean, including
the six forge emitters that used to shell out to a metered CLI once per call.

- `offline_guard.py` gained a **third layer**. It guarded `socket` only, which
  guards *this* process — a script that spawns a billing CLI walked straight
  past it, and that is exactly how all six emitters were built. It now also
  wraps `subprocess.Popen`, so spawning a metered binary raises and names it.
- The two paid backends in `forge/synthesis/explode.py` are **retired to a
  hard raise** — bodies removed, so there is no `import anthropic` and no API
  key reference left in the file. `git log` has them. A new `local` backend
  runs the resident in-process MLX model (the `mlx` backend spawned a CLI per
  call, reloading 12 GB of weights every time; `local` loads once).
- All five emitters (`revoice_book`, `revoice_batched`, `revoice_graph`,
  `module_qa_batched`, `wordbook_dialogue_batched`) now default to `local`.

The guard's selftest proves all three layers *and* proves it does not
over-block: `passthrough OK — non-metered binaries still run`.

---

## 1. THE SEQUENCING POINT — language first, corpus second

The books state what the engine prints. **Every reader fix changes what the
engine prints.** If I repair the corpus now and then fix the reader, I repair
the same rows twice and the second pass invalidates the first.

`READ-RADIX` alone is 95 failures: the reader does not implement `#x #o #b #d
#e #i`. Fixing it changes the value of every example that touches a radix
literal. So:

> **Language fixes land BEFORE corpus repairs. No exceptions.**

This is also why the previous CPT is worth re-running rather than mourning: it
trained on book code blocks holding values that were already wrong.

---

## 2. Where the language actually stands

Independent measurement, two third-party suites (Chibi `r7rs-tests.scm`,
Larceny `test/R7RS/`), neither written here:
**2,534 pass / 380 in-scope fail = 86.9%.**

425 total failures, classified into 38 buckets, **0 unclassified**. Ranked:

| bucket | n | root cause |
|---|---:|---|
| READ-RADIX | 95 | no `#x #o #b #d #e #i` prefixes |
| MUTABLE-STR | 49 | strings are immutable; no `string-set!` |
| TOWER-COMPLEX | 42 | no complex numbers |
| READ-BARSYM | 26 | no `\|bar quoted\|` symbols |
| PORT | 22 | port model gaps |
| UNICODE | 14 | |
| NUM-EXACTNESS | 14 | `exact?`/`inexact?` contradict each other |
| MACRO-HYGIENE | 13 | |
| TOWER-RATIO | 11 | exact rationals |
| …29 more buckets | 139 | |

**The concentration is the good news.** Eleven of those buckets are all one
file — `src/reader.js`:

```
READ-RADIX 95 · READ-BARSYM 26 · READ-STRESC 9 · READ-DCOMM 9 · BV-READER 8
READ-EXPMARK 8 · READ-LABEL 6 · READ-BOOL 5 · READ-INFNAN 3 · READ-BCOMM 3
READ-FOLD 2                                                    = 174 failures
```

**174 of 425 failures are reader lexemes.** They are the cheapest, most
mechanical fixes in the set and they are all in one file.

### What 100% honestly means

I am not going to tell you 100% and then quietly count `TOWER-COMPLEX` as
out-of-scope to get there. Two numbers, both stated:

- **Reachable by mechanical work: ~86.9% → ~96%.** Reader (174) + NUM-EXACTNESS
  (14) + the n-ary comparison bug + RANGE-ARG + the small buckets.
- **The remaining ~4% is three real features**, not fixes: complex numbers (42),
  mutable strings (49), full ports (22). Each is a design decision about what
  Motoi *is*, and each is your call, not mine. MUTABLE-STR in particular is a
  deliberate immutability choice as far as I can tell — reversing it is a
  language change, not a bug fix.

So: **I can get the mechanical part to 100%. I cannot get the suite to 100%
without you deciding on complex numbers, mutable strings, and ports.** Ask me
after the reader lands and the number will be re-measured, not guessed.

---

## 3. Where the corpus actually stands

Every number below is from running the **value-aware** gate twice and diffing
per claim — never the run-only gate that certified us clean twelve times while
we were not.

### Books — `audit-books-values.py`, 8,417 blocks

| | |
|---|---:|
| claims that pass | 1,058 |
| **claims that MISMATCH** | **372** |
| prose-claim (unreadable as a value) | 91 |
| inner-claims | 41 |
| blocks that error | 118 |

Two identical runs: **same 372 both times**, 0 appearing in only one run.
**12 of the 372 differ between the two runs** — those are non-deterministic and
cannot be repaired at all:

```
uuid-1785742810266-2 vs uuid-1785742839111-2   (uuid mint)
(time 1785742806348 …) vs (time 1785742835174 …)  (timestamp)
31 vs 84 · (9 3) vs (0 3) · 17.2497… vs 19.3798…  (random)
(:evidence 12 …) vs (:evidence 3 …)               (cortex counters)
```

> **360 book claims are deterministic and mechanically repairable.
> 12 are unrepairable by construction and must leave, not be rewritten.**

### Reference — `verify-reference-notes.py`

**24 bad claims. 0 non-deterministic** across two runs. All mechanical.

### The old 233-row repair list is superseded

It was assembled before the `reader.js` patches and it carries *model-written*
explaining clauses. The gate output carries `code`, `claim` and the engine's own
`printed`/`value` — everything a splice needs, with **no model anywhere in the
loop**. I am building the repair from the gate, not from the old list.

Anchoring is already solved and proven: `scratch/anchor_repairs.py` anchors on
the **pair** (code → arrow → value), handles both spellings (`; =>` inline, and
`:code "…" :note "<value> — …"` for reference records), and gets **216 of 233**.
It also had a real bug I found and fixed before it wrote anything: it chose
whether to escape from whether the *old value* contained a quote, instead of
from whether the span sits inside a `:prose "…"` literal. **Escaping is
positional.** Verified: all 216 planned spans re-read byte-identical from disk.

### Fold

**5,553 bad rows** of 125,920 code-bearing (4.4%), all in the eight
`corpus-reversal` shards, from only **1,627 distinct blocks**.
4,944 repairable from interpreter output · **609 non-deterministic → deleted**
(same class as the 12 above; sanctioned exception to only-add).

---

## 4. The order of work

| # | step | gate that says it's done | model? |
|---|---|---|---|
| 1 | ✅ cut every paid path | `no-phone-home.py` PASS | — |
| 2 | **`src/reader.js` — the 11 lexeme buckets, 174 failures** | conformance re-run | none |
| 3 | NUM-EXACTNESS, n-ary compare, RANGE-ARG, small buckets | conformance re-run | none |
| 4 | re-measure conformance, hand you the complex/mutable-string/port call | the two suites | none |
| 5 | re-run both value gates twice — the repair list is regenerated *after* the engine settles | — | none |
| 6 | apply 360 book + 24 reference splices, positional escaping, backup first | gates go to 0 | none |
| 7 | quarantine the 12 + 609 non-deterministic rows | — | none |
| 8 | repair 4,944 fold rows from interpreter output | `verify-fold.py` | none |
| 9 | full repo suite must still be green | `node --test --test-reporter=tap …` | none |
| 10 | re-emit CPT — `emit_cpt_v5.py`, supersede not mix | — | none |
| 11 | re-fire CPT locally overnight | — | — |

**Steps 2–10 use no model at all.** Every value comes from the interpreter. The
only thing a model is ever needed for is the *voice* backlog (451 reference
verbs + 752 book chapters), which is SFT work and is not on the CPT path.

**Not touching the carts. That's tomorrow.**

---

## 5. The SLAT daemon

Still the right abstraction, and it is where the voice backlog goes — but it is
**not on the critical path to the CPT**, because the CPT needs correct values,
and correct values come from the interpreter, not from a model. Building it
first would be building the thing that isn't blocking.

It gets built at step 10, while the CPT is running and the machine would
otherwise be doing nothing but training. Shape record and divvy are already
written: `scratch/AUTOMATED-TEAM-PLAN-2026-08-03.md`.
