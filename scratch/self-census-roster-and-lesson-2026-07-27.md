# The Self-Census: Roster + Reasoning Lesson

*Canonical design, 2026-07-27. Source for the four doc placements
(reference intro, book-of-introspection, LANG-ENGINEERING, SRE manual).*

This is the tie-together. The console keeps counters. The counters are read
live at inference time. Weights teach the *pattern* — read a count, reason
about it — and the *numbers* come from the running machine, never from memory.
That single move is what closes the loop: the console can tell whether
something ran, whether an error is new, whether a fix held, because it can
count, and it knows how to think about what it counted.

Doctrine line under everything below: **Weights ≠ facts. The counter is where
the facts live.**

---

## Part 1 — The roster (the right set of stats)

Seven families. ~52 metrics. Each metric is a *thing the console can count
about itself*, keyed so the whole census sits in one place — the **stats
section of the cortex** (`~/motoi/copilot/cortex.slatl`), under the same
error-key that the error-cards use, so a count and its card are neighbours.

Honest state tagging on every family:
- **WIRED** — the counter exists and runs today (`verb-stats.js`, Ch15 verbs).
- **SPEC** — designed, not yet wired; the reasoning is taught now so the
  machinery has a mind waiting for it when it lands.
- **DERIVED** — computed from other counters, not stored.

### Family A — Verb usage / call census  (WIRED)

The spine. One BigInt per primitive verb, bumped on every dispatch. 64-bit
BigInt never overflows in practice — trillions of calls are fine.

| key | what it counts | state |
|---|---|---|
| `verb-calls/<name>` | lifetime calls to one verb | WIRED |
| `verb-calls/total` | all primitive dispatches | WIRED |
| `verb-calls/top-n` | the n most-called verbs | WIRED |
| `verb-calls/distinct` | how many distinct verbs ever ran | WIRED |
| `verb-calls/idle` | verbs registered but never called | WIRED (derived from Map) |
| `verb-calls/first-seen/<name>` | when a verb was first dispatched | SPEC |
| `verb-calls/last-seen/<name>` | when a verb was last dispatched | SPEC |
| `verb-calls/session` | calls since this process started | SPEC |
| `verb-calls/session-delta/<name>` | this-session calls for one verb | SPEC |
| `verb-calls/namespace/<ns>` | calls rolled up by namespace | SPEC |
| `verb-calls/by-tier/<tier>` | calls rolled up by dispatch tier | SPEC |
| `verb-calls/rank/<name>` | a verb's rank in the top-n | DERIVED |

Live verbs today: `stats/verb-calls`, `stats/verb-calls-of`, `stats/summary`,
`stats/flush!`, `stats/path`.

### Family B — Error census  (SPEC — the missing half)

The mirror of A. A `setErrorHook` fires on every throw; the thrown thing is
normalized to an **error-key** and counted. This is the wrong-sink's ledger.

| key | what it counts | state |
|---|---|---|
| `error-count/<key>` | lifetime occurrences of one error | SPEC |
| `error-count/total` | all errors ever thrown | SPEC |
| `error-count/top-n` | the most frequent errors | SPEC |
| `error-count/distinct` | how many distinct error-keys seen | SPEC |
| `error-count/session/<key>` | this-session occurrences | SPEC |
| `error-first-seen/<key>` | when an error-key first appeared | SPEC |
| `error-last-seen/<key>` | when it last appeared | SPEC |
| `error-by-verb/<name>` | errors thrown from within a verb | SPEC |
| `error-by-family/<family>` | rollup by language-family (unbound, fuel, sandbox…) | SPEC |
| `error-provisional/<key>` | seen but not yet minted into a card | SPEC |
| `error-recurrence/<key>` | count that promotes provisional → real | SPEC |
| `error-novel/session` | error-keys first seen this session | SPEC |
| `error-rate` | errors ÷ total dispatches | DERIVED |
| `error-throwsite/<key>` | which source throw-site produced it | SPEC |

### Family C — Fix / card lifecycle census  (SPEC)

Did the fix hold? Does the card work? The grade is the interpreter itself:
`:motoi-run-passes`.

| key | what it counts | state |
|---|---|---|
| `card-count/total` | error-cards that exist | SPEC |
| `card-coverage` | error-keys with a card ÷ distinct error-keys | DERIVED |
| `fix-attempts/<key>` | fixes tried for one error | SPEC |
| `fix-passes/<key>` | fixes that ran clean under the interpreter | SPEC |
| `fix-pass-rate/<key>` | passes ÷ attempts | DERIVED |
| `card-minted/session` | cards created this session | SPEC |
| `card-staleness/<key>` | dispatches since the card last verified | SPEC |

### Family D — Suggestion / copilot 3-gate census  (SPEC)

Every suggestion runs the parse → resolve → run gauntlet. Count what each gate
rejects; that is the copilot grading its own aim.

| key | what it counts | state |
|---|---|---|
| `suggest/offered` | suggestions shown to the user | SPEC |
| `suggest/accepted` | suggestions the user kept | SPEC |
| `suggest/accept-rate` | accepted ÷ offered | DERIVED |
| `gate/parse-reject` | candidates dropped at the parse gate | SPEC |
| `gate/resolve-reject` | candidates naming an unknown verb | SPEC |
| `gate/run-reject` | candidates that crashed/looped in the sandbox | SPEC |
| `gate/pass-rate` | offered ÷ generated | DERIVED |

### Family E — Cortex / memory census  (SPEC)

The memory counting itself. How much does it hold, how much does it recall,
how much did it compress away.

| key | what it counts | state |
|---|---|---|
| `cortex/records` | records in the cortex | SPEC |
| `cortex/recall-hits` | recalls that found a record | SPEC |
| `cortex/recall-miss` | recalls that found nothing (honest floor) | SPEC |
| `cortex/recall-rate` | hits ÷ (hits + miss) | DERIVED |
| `cortex/compressed` | records compressed under negative salience | SPEC |

### Family F — Performance triad  (WIRED, Ch15)

Already documented in book-of-introspection Ch15.

| key | what it counts | state |
|---|---|---|
| `perf/fuel-used` | fuel spent by the last / a given run | WIRED |
| `perf/wall-ms` | wall time of a run | WIRED |
| `perf/peak-mem` | peak memory of a run | WIRED |
| `perf/fuel-per-call` | fuel ÷ dispatches | DERIVED |

### Family G — Coverage / health rollups  (DERIVED)

The one-line health read. All computed from the families above.

| key | what it counts | state |
|---|---|---|
| `health/verb-coverage` | distinct verbs used ÷ verbs registered | DERIVED |
| `health/error-coverage` | error-keys carded ÷ error-keys seen | DERIVED |
| `health/loop-closed` | every seen error has a card + a passing fix | DERIVED |

---

## Part 2 — The lesson (how to think about the stats)

You do not write this once. You teach it as a way of reasoning, from several
angles, until the shape is unmistakable. Seven patterns. Each is a *move*, not
a fact.

### Pattern 1 — A metric is looked up, never known

You do not know how many times `map` was called. You cannot. The number lives
on disk, in the running machine, and it changes every second. What you know is
*how to find it*: emit `(stats/verb-calls-of 'map)` and read what comes back.
If you ever state a count from memory, you are guessing — and a guessed count
is a lie with a number on it. Ask the machine. Every time.

> Weights taught you the reflex — *reach for the counter*. The counter tells
> you the fact.

### Pattern 2 — The delta carries the meaning, not the absolute

"`map` has been called 4,000,102 times" tells you almost nothing. "`map` was
called 6 times more than a second ago" tells you your loop is running. Read a
count, do a thing, read it again: the *difference* is the signal. A raw total
is a resting number; a delta is a heartbeat.

### Pattern 3 — A count answers "did it happen?"

This is the seed of the whole idea. You wrote a new verb. Did it ever run? You
cannot see the CPU. But you can check the call count:

```motoi
(if (> (stats/verb-calls-of 'my-new-verb) 0) 'used 'idle)
```

If the count went up, something ran. If it stayed at zero, nothing did — no
matter what you believe happened. The counter is how the console *knows*
instead of *assumes*. "Did something run? Check the call count."

### Pattern 4 — An error is a negative signal; its frequency is selection pressure

An error is not noise to be silenced. It is the console learning what *not* to
do. Count how often each error fires: a frequent error is a strong pressure —
something the language keeps getting wrong, worth a card and a fix. A rare one
is a whisper. You are not ranking right answers; you are draining wrongs into
the sink. The error census is the drain, and its counts tell you which wrong
is loudest.

### Pattern 5 — A new error is a provisional fact to watch, not a truth to trust

The first time an error-key appears, you do not yet know if it matters. It is
*provisional*. You mark it, you start counting it, and you watch. If it
recurs — crosses the recurrence threshold — it earns promotion to a real,
carded fact. If it never comes back, it fades. This is how the console mints
new knowledge honestly: seen-once is a hypothesis, seen-often is a fact.

### Pattern 6 — Reason in ratios, not raw counts

10 errors is meaningless. 10 errors in 20 dispatches is a fire; 10 in
20 million is a healthy machine. Always divide by the base: `error-rate`,
`accept-rate`, `fix-pass-rate`, `verb-coverage`. A ratio survives scale; a raw
count drowns in it. When you report health, report a ratio.

### Pattern 7 — The census is a mirror, not an oracle

The counters tell you what *did* happen on *this* machine. They do not tell you
what is right, what will happen, or what is true elsewhere. A verb with zero
calls is not a bad verb — it is an unused one here. An error never seen is not
impossible — just unmet. The census reflects; it does not judge. Read it for
what it is: this console's honest account of its own life so far, and nothing
more.

---

## Part 3 — How the seven patterns close the loop

Put the two halves together and the loop shuts:

1. **Right stats** (Family A) say what ran. (Pattern 3)
2. **Error census** (Family B) says what broke, and how often. (Patterns 4, 6)
3. **Enumeration** — every distinct error-key rostered, none ad-hoc. (Family B)
4. **Mint-new** — a new throw normalizes to a key; provisional until it
   recurs, then promoted. (Pattern 5)
5. **Read + deduce** — read the counts, reason in deltas and ratios, decide
   which wrong is worth carding. (Patterns 1, 2, 6)
6. **Create the card** — the model abduces the cause; the interpreter grades
   the fix with `:motoi-run-passes`; the card joins the census under the same
   key. (Family C)

Six mechanisms, one key space, one store (the cortex stats-section). The
console counts its own life, knows how to think about the count, drains its
wrongs into the sink, and keeps a diverse population of rights for its native
intelligence to choose among. That is the whole machine, and it is glorious
because nothing in it is faked: every number is looked up, every wrong is a
signal, every fix is graded by running it.
