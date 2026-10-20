# Straggler sweep — all 800 book chapters — 2026-07-29

Ran `verify-book.mjs` (runnable-code check) over every `*.book.slatl` in
`scheme-books/`. **567 pass, 233 FAIL.** These are NOT 233 loose bugs like the
6 I fixed — they cluster into 4 structural buckets. Cumulative whole-book reruns
(`scratch/verify-book-cumulative.mjs`) confirm most are real missing-API gaps,
not verifier-isolation false positives.

## Bucket A — books written against host/dialect APIs that were ripped out or never wired (~150 ch)

Surgery #370 ripped Curator game-object + audio-client stubs; these books still
teach against them. Overlaps **#371 (rebuild motion/animation), #374 (rewrite 8
surgery-broken books), #380/#379 (composer/audio layer)**.

| Book | ~ch fail | Missing API |
|---|---|---|
| book-of-simulation-games | 22 | `world/link-stiffness!` `world/wall!` `world/integrator!` `phys/nbody-spawn` `define-card` |
| book-of-sound | 16 | `wave` `adsr` `noise` `partials` `pluck` `add-formant` `spectrum-of` `transcribe` `schedule` `pattern` `define-instrument` (bare, not `synth/*`) |
| book-of-narrative-games | 11 | `define-card` |
| book-of-composition | 9 | `canvas`, `save: path` |
| book-of-values | 9 | `money<` `result/ok` `result/collect` `optional/none` `decimal-add` `percent` `validate-money` `record` — a values library never wired |
| book-of-slat | 6 | `poem-form` `record` `with-slat-stream` |
| book-of-systems (copilot) | 5 | `sys/exec` `motoi/data-dir`, escalation `read-user-photo` |
| book-of-instruments | 5 | `synth/select` |
| book-of-animation | 4 | animation host verbs |

Fix = a scoping decision: **wire these APIs** (but CLAUDE.md says dialect verbs
don't live in base Motoi) **or rewrite the books onto real primitives** (#374).
Not something to mass-edit autonomously.

## Bucket B — `module` / `import` language feature not implemented (~30 ch)

- **book-of-modules** (22 ch) teaches `(module …)` / `(import …)` — base Motoi
  has neither (`echo '(import motoi/time :as t)' | ./bin/motoi run` → unbound).
- Leaks into book-of-values, book-of-jesse (`import`).

Fix = a language-feature decision (implement modules, or rewrite the book).

## Bucket C — genuine self-contained bugs, SAME class as the 6 I fixed (fixable now)

Biggest cluster is **book-of-math (~24 ch)** — mostly `plot/*` signature misuse
+ reader/coercion bugs, exactly like ch14/15/16:

- `plot/line`/`plot/bar` parallel-list length mismatch — ch02, ch03, ch05, adv-15, adv-16
- `plot/function`/`plot/nice-domain` domain must be `(lo hi)` — ch08, ch09, ch12, ch13, adv-08
- `banker's` identifier with apostrophe (reader) — ch04-long-division → rename
- `missing )` paren-balance — adv-13
- `exact: cannot coerce to bigint` — ch06, ch07
- `matrix/sub` shape mismatch / `.map`/`.slice is not a function` — adv-05, adv-07, adv-09, adv-12
- `comb/multinomial`/`seq/recurrence` expected list — adv-02, adv-03
- genuinely-unbound verbs: `nt/pythagorean-triple?` (adv-01), `complex/log` (adv-11)

Also self-contained tails in book-of-scheme (`motoi>` prompt leaking into code),
book-of-introspection (`introspect: expected symbol`), book-of-challenges
(`text/normalize`), book-of-one-shot (`surface` `clock/now` `fetch` — some host).

## Bucket D — verifier-isolation false positives (small)

A few chapters fail isolated but pass cumulatively (book-of-values MAIN chapters:
isolated 9 fail → cumulative 36/45 clean). Minor contributor; most fails survive
the cumulative rerun, so isolation is NOT the main inflator.

## Recommended fix order

1. **Bucket C book-of-math** (~24 ch) — in-scope, low-risk, same class as the 6.
   Can start immediately.
2. **Bucket A** — needs Alfred's scope call (wire vs rewrite); overlaps #371/#374.
3. **Bucket B** — needs a modules language decision.
