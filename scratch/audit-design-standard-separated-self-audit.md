# The Standard-Separated Self-Audit — design

Design for the combined audit Alfred asked for: **"All the top 3 once the lang
has been separated and properly audited itself."** Working file (scratch/,
ephemeral). Not a fold. Nothing here runs a training extraction.

Date: 2026-07-24.

---

## The gate: what "separated and properly audited itself" means

The audit does not run on a language that hasn't first done two things. Both are
checkable, cheaply, before any of the three sub-audits fire.

**Separated** — the standard library is separated by provenance. Every wired
verb carries a `std:` tag drawn from exactly one bucket:
`r7rs-small | srfi-1 | srfi-13 | srfi-125 | srfi-27 | motoi`. The parts live in
`core/parts-registry.js`, each with its own spec `spec/<part>.slatl`. This was
LOCKED + BUILT 2026-07-24.

**Properly audited itself** — the parts system's own five-point gate is green on
every part, with `3-verbs` and `5-runs` run live (not honest-skipped):

    $ node bin/motoi lib validate      # all 5 parts PASS, 3-verbs+5-runs live

Status 2026-07-24: **GREEN** — R7RS-small (116) · SRFI-1 (25) · SRFI-13 (15) ·
SRFI-125 (19) · SRFI-27 (4), all five checks pass on each.

### Gate 0 — preconditions the audit checks before it starts

- **G0.1** `lib validate` is green on all parts, 3-verbs+5-runs not skipped.
- **G0.2** Every wired verb (`echo <v> | ./bin/motoi run` resolves) has exactly
  one `std:` provenance tag. Zero untagged wired verbs.
- **G0.3** The provenance manifest agrees with the BUILT registry. **Known
  failure today:** `scratch/std-tag-map.json` still labels 17 verbs `srfi-69`;
  the registry ships `SRFI-125`. The manifest is stale relative to the parts it
  is supposed to describe. Regenerate the manifest from the registry (single
  source of truth = `core/parts-registry.js`) and re-run the classifier, then
  G0.3 passes. Until then the "separated" half is only nominal.
- **G0.4** `scratch/std-tag-map.json` `motoi_ext_generic_needs_review` (121
  verbs today) is triaged to zero — each either confirmed `motoi` or reclassed
  to the SRFI it actually implements. This is the hand-off point into Audit 1.

Gate 0 is not one of the "top 3." It is the entry condition. If G0.1–G0.4 do not
all hold, the audit stops here and reports the gate failures — it does not run
Audits 1–3 on an un-separated language.

---

## Audit 1 — Conformance-ladder

**Question:** is every verb conformant to the *highest* standard it corresponds
to, in ladder order R7RS-small → SRFI → motoi?

**Method.** For each of the 1134 distinct verbs, walk the ladder:

1. Does a verb of this name exist in R7RS-small? If yes, the verb MUST match the
   R7RS name + arity + signature + semantics. R7RS is the semantic authority; a
   standard name may never be redefined to mean something non-standard.
2. Else, does it exist in an adopted SRFI (1/13/125/27)? If yes, MUST match that
   SRFI's spec.
3. Else it is `motoi` — must be labelled honestly as such.

**Classify each verb into one bucket:**

| Verdict | Meaning | Action |
|---|---|---|
| `conform` | name+arity+sig+semantics match the cited standard | keep, tag confirmed |
| `divergent-name` | duplicates a standard verb under a non-standard name (R6RS/Racket `fold-left`/`foldl`/`foldr`, MIT aliases) | NOT wired; the *sites* using it become broken-examples |
| `divergent-sig` | right name, wrong signature/order vs spec | conform to spec, OR relabel `std: motoi` honestly if it is genuinely a different verb |
| `missing-srfi` | spec names it, we don't wire it (e.g. `last-pair`) | wire it to spec |
| `motoi-honest` | matches nothing standard | keep, `std: motoi` |

**Known inputs already on disk (from the classifier):**
- `motoi_ext_generic_needs_review`: 121 — Audit 1's primary worklist.
- `srfi-69` label (17): must resolve to `srfi-125` conform-check (SRFI-125
  supersedes 69; verbs are the intermediate hash-table surface).
- `reduce` is accumulator-first `(f acc elem)` — NOT SRFI-1's elem-first
  `(f elem acc)`. Verdict `divergent-sig`: either conform or label `std: motoi`.
- fold family: `fold-left` (R6RS), `foldl`/`foldr` (Racket) are `divergent-name`
  → excluded, sites → broken-examples. Do NOT wire.

**Pass criterion:** every verb lands in `conform`, `motoi-honest`, or an actioned
bucket with the action taken. Zero verbs left in `needs-review`. Every
`divergent-name` has a matching broken-example. Every `missing-srfi` is wired and
`lib validate` still green.

**Never-delete rule:** divergent forms are preserved as broken-examples with
their lesson, not deleted (composes with keep-broken-lane doctrine).

---

## Audit 2 — Reference-code-runs

**Question:** does every code example in the reference actually run under motoi
with no unbound symbol?

**Method.** Extract every runnable snippet from `scheme/reference/**` (the
per-verb example rows, the intro chapters, 00e). Pipe each through
`./bin/motoi run /dev/stdin`. A snippet "runs" iff it produces no "unbound
symbol" and no reader/eval error (except examples explicitly marked as
error-demonstrations).

**Classify each failing snippet:**

| Verdict | Meaning | Action |
|---|---|---|
| `runs` | evaluates clean | none |
| `genuine-gap` | example uses a verb the reference legitimately names but nothing wires | wire the verb (this is the honest-null-aware surface: 519 unwired verbs per the drift memo) |
| `useful-broken` | example is *meant* to show a mistake / a dialect difference | move to broken-examples with lesson; do not "fix" |
| `stale` | example uses an excluded name (fold-left etc.) or old signature | rewrite to the conformant standard (SRFI-1 `fold`/`fold-right`) |

**Interaction with Audit 1:** run Audit 1 first. Audit 1 decides which names are
legitimate; Audit 2 then holds every example to that decision. A `fold-left`
example is `stale` in Audit 2 *because* Audit 1 ruled `fold-left` divergent-name.

**Pass criterion:** every reference snippet either `runs`, is a catalogued
`useful-broken`, or has been rewritten/wired. No silent failures. `lib validate`
still green afterward. Composes with "reference IS the language" — when an
example and the code disagree, the example wins and the gap gets wired, unless
the example is itself the bug (then it's useful-broken or stale).

---

## Audit 3 — Three-book coverage

**Question:** is all language behavior covered across the three books, in the
right book, with no gaps and no contradictions between them?

**The audience routing rule (already written into all three books 2026-07-24):**
- "what does this verb do?" → **Reference** (programmers, 11 to 111)
- "how is the interpreter built / how do I rebuild it?" → **Scheme Engineering**
  (lang-eng + CS perspective)
- "how do I run/operate/train it safely?" → **SRE Manual** (operators)

**Method.** Build a behavior × book matrix. Rows = every language behavior
(each verb surface, each special form, the reader, macros, the error model, the
parts system, the conformance ladder, loading eager/lazy, the 5-point gate,
fuel, TCO). Columns = {Reference, Scheme Eng, SRE}. Each row must be present in
its correct book(s) per the routing rule.

**Classify each row:**

| Verdict | Meaning | Action |
|---|---|---|
| `covered` | present in the right book | none |
| `gap` | a behavior no book documents | author the section in the correct book |
| `mis-placed` | documented, but in the wrong book for its audience | move to the correct book |
| `contradiction` | two books describe the same behavior inconsistently | reconcile; reference wins on *what*, Scheme Eng on *how-built*, SRE on *how-operated* |

**Known-covered (verify, don't re-author):** parts system is in Reference 00e +
Scheme Eng §5A + SRE ch06; audience sections in Reference intro, Scheme Eng §0.1,
SRE ch00. Audit 3 confirms these three descriptions of the *same* five-point gate
do not contradict each other.

**Pass criterion:** every behavior row `covered` in its correct book; zero
`gap`, zero `contradiction`; `mis-placed` rows moved.

---

## Sequencing

    Gate 0  (preconditions: separated + self-audited)
       │  G0.1 lib validate green
       │  G0.2 every wired verb has one std: tag
       │  G0.3 manifest agrees with registry  ← FAILS today (srfi-69 vs 125)
       │  G0.4 needs-review triaged to zero    ← 121 today
       ▼
    Audit 1  Conformance-ladder      (decides which names/sigs are legitimate)
       ▼
    Audit 2  Reference-code-runs     (holds every example to Audit 1's decisions)
       ▼
    Audit 3  Three-book coverage     (confirms the docs describe the audited lang)
       ▼
    Green:  language separated, self-audited, conformant, examples run, books agree.

Each stage gates the next. Audit 1 before 2 (names must be settled before
examples are held to them). Audit 2 before 3 (a book can't be judged complete
against behavior the examples haven't proven runs).

## Constraints carried through the whole audit

- No deletes — divergent verbs and broken examples are preserved with lessons.
- No fabrication — an unknown verdict is `needs-alfred`, not a guess.
- No training fold — this audit produces verdicts + wiring + docs, not corpus.
- Reference wins on *what*; the code gets conformed/wired to match it, unless the
  reference example is itself the teaching-bug.

## Blocked-until

Audits 1–3 are runnable the moment Gate 0 is green. Gate 0 is NOT green today:
G0.3 (manifest stale: srfi-69 vs SRFI-125) and G0.4 (121 needs-review) both fail.
The cheapest unblock is: regenerate `std-tag-map.json` from the live registry,
then triage the 121. That is the first executable step whenever Alfred says go.
