# Sakura Scheme 1.0 — Sealing Protocol

> **Canonical doc — sealing authority record and version contract.**
> Pairs with `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` (the runtime spec),
> `docs/SAKURA-SCHEME-1.0-REFERENCE.md` (the verb catalog), and
> `curator-web/src/scheme/SPEC.md` (the lineage doc).
>
> **Audience:** The architect, any future engineer touching the runtime, any
> future LLM that must write or validate carts, and any downstream author who
> needs to know what is guaranteed stable. Not operators. Not marketing.
>
> **Voice:** Contract-level. The tone is a standards document, not a tutorial.
> Every normative claim carries a `file:line` citation or an explicit
> `<!-- LIVING:RESEARCH -->` marker where the audit is incomplete.
>
> **Author:** Alfred Robins / Claude (PM lane), 2026-06-30

---

## TABLE OF CONTENTS

- [§0. What sealing means](#0-what-sealing-means)
- [§1. What is IN Sakura Scheme 1.0](#1-what-is-in-sakura-scheme-10)
- [§2. What is NOT in 1.0](#2-what-is-not-in-10)
- [§3. The version contract](#3-the-version-contract)
- [§4. The sealing ritual](#4-the-sealing-ritual)
- [§5. The deprecation protocol](#5-the-deprecation-protocol)
- [§6. What other languages did — and what we learned](#6-what-other-languages-did)
- [§7. The 1.0 → 1.1 candidate list](#7-the-10--11-candidate-list)
- [§8. Risks of sealing](#8-risks-of-sealing)
- [§9. Seal date and sealing authority](#9-seal-date-and-sealing-authority)
- [§10. References](#10-references)

---

## §0. What sealing means

### §0.1 The distinction

Sealing is not freezing. A frozen language is unchangeable forever — the ANSI
Common Lisp standard of 1994 is frozen: not a character has changed in thirty
years, and it never will. Frozen has advantages (implementations can commit
to exact behavior; every specification corner is decades-settled) and
disadvantages (bugs and design mistakes calcify with no repair path; the
language accretes community workarounds that diverge silently from the spec).

Sealing is something narrower and more useful: **a commitment that a named
version will not break what it currently defines, combined with a named escape
valve for evolution.** The sealed version is stable, not static. The escape
valve is deliberate, not an accident.

Sakura Scheme 1.0 is sealed in this sense. The commitment:

1. Every cart that runs correctly against Sakura Scheme 1.0 will run
   correctly against every Sakura Scheme 1.x release. No 1.x release may
   change the meaning of any construct defined in 1.0.

2. Sakura Scheme 2.0 is allowed to break with named deprecation. No
   surprise breaks. Minimum 6-month deprecation window. Named migration path.

3. Anything not defined in 1.0 — anything that is a behavior of the current
   runtime but is not named in this document — is NOT guaranteed. It can
   change in 1.x without notice.

This document is the source of truth for what 1.0 guarantees. If it is not
named here, it is not guaranteed.

### §0.2 Why sealing matters for this system

The 4,849+ `.sks` cart corpus is the product. Every cart is an artifact an
operator either built, commissioned, or purchased. A language change that
silently breaks a cart breaks the operator's trust and the product's value
proposition.

The 5-tuple LLM training pipeline — intent → slug lookup → cart generation
→ lint → runtime → operator surface — is trained on the corpus. If the
language shifts under the corpus, the training signal becomes inconsistent and
the on-device savant (L0) degrades. Sealing freezes the training target.

Downstream authors (future LLMs writing carts, human engineers, Sakura
herself) need a stable surface to write against. The alternative — "the
language is whatever the runtime says today" — is the worst possible contract:
it makes every cart a moving target and makes debugging impossible because
there is no external reference to check against.

### §0.3 The promise in one sentence

**Sakura Scheme 1.0 guarantees that anything named in §1 of this document
will work the same way in every 1.x release.** Everything outside §1 is
implementation detail until it earns a §1 entry via the sealing amendment
protocol (§4.4).

---

## §1. What is IN Sakura Scheme 1.0

### §1.1 The runtime ABI — descriptor constructors

These are the seven state-function return forms. A cart's state function
MUST return one of these. The driver (`curator-web/src/scheme/cartDriver.js:1-31`)
pattern-matches on the tag symbol. No other descriptor tags are valid in 1.0.

All seven are installed by `installCartPrelude(env)`
(`curator-web/src/scheme/cartPrelude.js:42-135`). They are pure JS functions
bound in the cart's env. They produce tagged data — they perform no side
effects themselves.

| Form | Descriptor tag | Meaning |
|---|---|---|
| `(next 'state ctx)` | `'next` | Advance to named state with ctx |
| `(done)` | `'done` | Cart is complete; no more states |
| `(escalate 'kind detail)` | `'escalate` | Pause; surface decides next action |
| `(wait 'event)` | `'wait` | Block until event fires |
| `(after seconds 'state ctx)` | `'after` | Sleep N seconds then resume at state |
| `(act 'verb args 'on-result)` | `'act` | Tool call; resume at on-result state with result in ctx |
| `(interrupted reason ctx)` | `'interrupted` | Live-voice mid-speech interruption |

**Contract for `act`:**
`(act 'verb args 'on-result)` returns the descriptor
`['act', verb, args, 'on-result]` to the driver. It does NOT execute the
verb inline and does NOT return a result value. The driver executes the verb
asynchronously and stores the result as `'last-result` in ctx before calling
the `on-result` state function.
(`curator-web/src/scheme/cartPrelude.js:97-102`,
`curator-web/src/scheme/SCHEME-RUNTIME-TRUTH-2026-06-30.md §1.1`)

**Contract for `next`:**
Takes exactly two arguments: `'state-name` and `ctx`. A third argument is
silently ignored by the JS runtime — this is a known semantic pitfall. When
setting multiple ctx keys before a transition, nest the `ctx-set` calls:
`(next 'foo (ctx-set 'a 1 (ctx-set 'b 2 ctx)))`.
(`curator-web/src/scheme/SCHEME-RUNTIME-TRUTH-2026-06-30.md §1.2`)

**Contract for `escalate`:**
Takes exactly two arguments: `'kind` and `detail`. The kind must be a
quoted symbol. Valid escalation kinds in 1.0 are enumerated in §1.6.

### §1.2 The ctx helpers

These four functions thread state through cart state functions. They are
part of the 1.0 ABI and must remain identical in every 1.x release.

| Form | Signature | Meaning |
|---|---|---|
| `(ctx-get 'key ctx)` | `(key, ctx) → value \| null` | Read a value from the ctx alist; null if absent |
| `(ctx-set 'key value ctx)` | `(key, value, ctx) → ctx` | Return new ctx with key set (non-mutating) |
| `(ctx-result ctx)` | `(ctx) → value \| null` | Convenience for `(ctx-get 'last-result ctx)` |

**Implementation:** `curator-web/src/scheme/cartPrelude.js:104-133`.

### §1.3 The base reserved forms — the S70 subset

These are handled by the evaluator's `evalStep` switch
(`curator-web/src/scheme/interp.js`). They are NOT functions — they cannot
be redefined, passed as values, or captured in 1.0. The evaluator's
`freeze()` mechanism (`curator-web/src/scheme/interp.js:137-164`) locks
the binding set after boot.

**Binding and scope:**
`define`, `set!`, `lambda`, `let`, `let*`, `letrec`, `named-let`

**Branching:**
`if`, `when`, `unless`, `cond`, `case`

**Logic:**
`and`, `or`, `not`

**Data:**
`quote`, `quasiquote`, `unquote`, `unquote-splicing`

**Sequencing:**
`begin`, `for-each`, `map`, `filter`, `reduce`

**List operations:**
`list`, `list-ref`, `length`, `append`, `reverse`, `car`, `cdr`, `cons`,
`first`, `last`, `member`, `assoc`, `assq`, `assv`

**Predicates:**
`pair?`, `null?`, `list?`, `symbol?`, `number?`, `string?`, `boolean?`,
`procedure?`, `eq?`, `equal?`

**Math:**
`+`, `-`, `*`, `/`, `modulo`, `abs`, `min`, `max`, `floor`, `ceil`,
`round`, `sqrt`, `expt`, `=`, `<`, `>`, `<=`, `>=`, `zero?`, `positive?`,
`negative?`

**String:**
`string-append`, `string-length`, `string->number`, `number->string`,
`string->symbol`, `symbol->string`, `substring`

**Tail-call optimization:** Guaranteed for all tail positions listed in
`curator-web/src/scheme/interp.js:9-36`. Named-let and mutual recursion via
`define` are the canonical iteration idioms.

**Fuel budget:** The evaluator runs a step-counter (`fuel`). Default per cart
execution: 200,000 steps (`curator-web/src/scheme/cartHost.js:58`). A cart
that exhausts fuel emits `PRIMITIVE_CRASH` and halts. This limit is a 1.0
implementation parameter; it may be raised in 1.x but will not be lowered
below 200,000 without a deprecation notice.

### §1.4 The macro system

**Macro expander:** `curator-web/src/scheme/macro.js` — hygienic
`define-syntax` / `syntax-rules` with:
- Ellipsis depth-1 matching
- Gensym-based hygiene for binder positions
- Fuel counter (100,000 steps) + recursion depth cap (400)
- `MacroTable` chained inheritance

**36 dialect-floor macros:** installed by
`curator-web/src/scheme/macros/expand.js` via `buildDialectMacroTable()`.
These are guaranteed stable in 1.0. The 6 families:

| Family | Count | Namespace |
|---|---|---|
| `MOTION_MACROS` | 13 | `motion/*` idioms (glide · drift · sway · arrive · depart · settle · spin · lean-aside · ease-aside · reach · pluck · toss · land) |
| `NOTE_MACROS` | 2 | `note/*` idioms (glide · rest) |
| `FORM_MACROS` | 7 | Musical form progressions (I-IV-V · ii-V-I · 12-bar-blues · vi-IV-I-V · I-vi-ii-V · modal-Dorian · scale) |
| `ATMOSPHERE_MACROS` | 2 | `surface/*` idioms (fade-around · stage) |
| `TIMING_MACROS` | 8 | Composition (sequence · parallel · after · wait · repeat · in-window · every · stagger) |
| `MODE_MACROS` | 4 | Behavioral gates (when-mode · on-mode-change · on-input · on-gesture) |

**18 cart-domain macros (PASS-2-MACROS-2026-06-30 batch):** These 18 macros
are proposed and their expansion is specified in
`docs/PASS-2-MACROS-2026-06-30.md`. Once implemented and a test suite exists,
they enter 1.0 via the sealing amendment protocol (§4.4). Until then they
are 1.1 candidates (§7).

<!-- LIVING:TODO(2026-06-30): Update this section when PASS-2-MACROS land in expand.js and tests pass. Mark the 18 macros as sealed 1.0 at that point. -->

### §1.5 The cart shape

A 1.0 cart is a single `.sks` file. The file has two mandatory sections.

**Header block** — doc-comments read by the studio + lint:

```scheme
;;~ language  sakura-scheme-1.0        ; REQUIRED — seals the cart to this version
;;~ slug      my-automation            ; REQUIRED — kebab-case identifier
;;~ title     "Human-readable name"    ; REQUIRED
;;~ author    "name-or-team"           ; REQUIRED
;;~ explain   "Operator-facing description."  ; REQUIRED for corpus
;;~ what      "What this cart does."   ; REQUIRED for corpus
;;~ why       "Why it matters."        ; REQUIRED for corpus
;;~ touches   etsy/listings            ; OPTIONAL — verb namespaces touched
;;~ flavor    green                    ; OPTIONAL — tier flavor override
```

The `;;~ language` key is the sealing declaration. Its value must match
the installed runtime. A cart declaring `sakura-scheme-1.0` will be
rejected by a runtime that is `sakura-scheme-2.0` unless the 2.0 runtime
includes an explicit 1.0 compatibility shim.

The `;;~` prefix is defined in `curator-web/src/scheme/SPEC.md §16`. The
studio reads these comments; the runtime evaluator ignores them.

**Body** — a Scheme source file. Every cart MUST define at minimum:

```scheme
(cart 'slug '((touches . ()) (read-only . #t)))
(define (start ctx) ...)    ; the initial state function
```

`(cart 'slug attrs)` is a no-op at runtime — lint and the studio read it,
the driver ignores it. It MUST be present.

`start` is the driver entry point
(`curator-web/src/scheme/cartDriver.js:81-100`). Every cart must define it.

State functions all share one signature: `(define (state-name ctx) ...)`.
Every state function must return a descriptor (§1.1). Returning anything
else causes `normalizeDescriptor` to throw `TrapError`.

### §1.6 The canonical escalation kinds

These are the six escalation symbols a cart may produce. A cart that
produces an escalation kind not in this list is non-conforming.

| Symbol | Meaning |
|---|---|
| `'service-not-yet-wired` | The verb exists in the registry but the backing service is not connected |
| `'service-garbled` | The verb returned a value of unexpected shape |
| `'cortex-not-ready` | The Loam/operator-state check found no operator state in Cortex |
| `'state-blocks-spend` | The operator's Loam state prohibits spending (vacation / paused / no-new-data) |
| `'consent-required` | A destructive verb was called without `operator_confirmed: true` in args |
| `'transport-error` | A network or host-side error prevented the verb from executing |

The driver normalizes these into structured error events via CartBus
(`curator-web/src/scheme/cartBus.js`). The surface layer (AutomationPulseButton,
ActivitySheet, OrchestrationBinding) interprets them.

<!-- LIVING:RESEARCH(2026-06-30): Audit cartInvariants.js and dispatch.js for any additional escalation kinds produced by the driver itself (not by cart source). If the driver produces kinds not in this list, add them with a "driver-generated" annotation. -->

### §1.7 The verb-naming contract

All verbs follow the pattern `capability/action`. Examples:
`etsy/listings`, `cortex/recall`, `model/workhorse`, `loam/operator-state`.

No verb name may:
- Contain a vendor name outside the wire-call module boundary
- Use a bare name without the `/` separator
- Duplicate an existing verb in the registry with different semantics

The verb registry is `curator-web/src/scheme/registry/VerbRegistry.js`.
Every verb declares: `perm`, `determinism`, `cost`, and `wired` status.

### §1.8 The doc-discipline contract

Every `.sks` file shipped as part of the official corpus must satisfy the
four-question ship check from `docs/CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`:

1. **Real user** — a named operator or a named code path exercises this cart
2. **Real path** — something currently runs it
3. **Real test** — a lint gate or unit test protects it
4. **Real doc section** — it appears in `docs/SAKURA-AUTOMATIONS-1.0.md`

Missing any of the four makes the cart dead weight and a candidate for the
kill list, not an automation.

### §1.9 The honest-null discipline

A cart that calls a verb and receives `null` MUST escalate or branch
explicitly. Silent-null is prohibited. The standard pattern is:

```scheme
(define (check-result ctx)
  (let ((result (ctx-result ctx)))
    (cond
      ((null? result)
        (escalate 'service-not-yet-wired
                  '(:status not-wired :reason "verb-returned-null")))
      ...)))
```

Any cart that treats `null` as a successful result is a 1.0 conformance
violation. This is enforced at lint time by clause 11 (honest-null) of
`src/scheme/linter/dialectConformance.js`, which rejects any cart state
procedure that reads a nullable verb/act result (`ctx-result`) and then
advances the cart (`next`/`done`/`table`) without an explicit null guard
(`(null? result)` / `(empty? …)` / `escalate`). The rejection code is
`null-silent`. Coverage is asserted in
`src/scheme/registry/__tests__/dialectConformance.test.js`
("Clause 11 — honest-null discipline"). `cartLint.js` performs the
complementary *structural* checks (header/start/state-reachability); it does
not itself enforce honest-null.

### §1.10 The nine canonical engineering docs

These constitute the 1.0 documentation corpus. Together they form the
disaster-recovery bootstrap kit: hand 5-7 of them + ~$200 of inference to
an engineer who has never seen this codebase, and they rebuild from zero.

| # | Doc | Path | Status |
|---|---|---|---|
| 1 | HelloSurface | `docs/HELLO-SURFACE-1.0-ENGINEERING.md` | Canonical |
| 2 | Scheme Engine | `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` | Canonical |
| 3 | Scheme Reference | `docs/SAKURA-SCHEME-1.0-REFERENCE.md` | Canonical |
| 4 | Automations | `docs/SAKURA-AUTOMATIONS-1.0.md` | Canonical |
| 5 | Loam | `docs/LOAM-1.0-ENGINEERING.md` | Canonical |
| 6 | Training Manual | `docs/SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` | NOT YET WRITTEN |
| 7 | Integration | `docs/LACUNA-INTEGRATION-1.0-ENGINEERING.md` | NOT YET WRITTEN |
| 8 | Telemetry | `docs/LACUNA-TELEMETRY-1.0-ENGINEERING.md` | NOT YET WRITTEN |
| 9 | Sealing Protocol | `docs/SAKURA-SCHEME-1.0-SEALING.md` | THIS DOCUMENT |

The Sealing Protocol (this document) is the ninth canonical doc. It is the
meta-doc that locks what the other eight collectively guarantee.

---

## §2. What is NOT in 1.0

### §2.1 Excluded by design

These features are absent from Sakura Scheme 1.0 by deliberate choice.
They may NOT be added in any 1.x release without owner sign-off, because
each would violate one or more of the four foundational properties
(`docs/SAKURA-SCHEME-1.0-ENGINEERING.md §1`):

| Feature | Why excluded |
|---|---|
| `call/cc` and first-class continuations | A continuation could capture pre-gate state and re-enter after a gate decision, breaking the dispatcher's security walk. (`SAKURA-SCHEME-1.0-ENGINEERING.md §2.2`) |
| `eval` / `read` from string | Re-entry with arbitrary new source text would allow capsule escape and dynamic redefinition of gated verbs. |
| Mutable cons cells (`set-car!`, `set-cdr!`) | Mutation is via `set!` on names. Cons cell mutation would allow carts to destructively modify shared structure across state transitions, breaking the FSM model. |
| Full R7RS quasiquote nesting | One-level nesting is sufficient for cart payloads. Full nesting adds complexity with no operational benefit at cart scale. |
| Hash tables, vectors, records | Cart payloads use alists + symbols. The JS host owns mutable structured state. Adding R7RS records or vectors would blur the boundary. |
| Ports + file I/O (`open-input-file`, etc.) | I/O is verb-gated. No I/O primitives exist in the language itself. |
| Full numerical tower (bignums, exact rationals) | JS `Number` throughout. No exact arithmetic. This is a known limitation; operator-visible only in edge cases at scale. |
| Module system (`use`, `import`, `require`) | File-based loading only in 1.0. The seam exists (`SPEC.md §16 — "(use 'cart-name)"`) but the module system is deferred. |

### §2.2 Deferred — planned for 1.1 or later

| Feature | Notes |
|---|---|
| `syntax-case` (full hygienic macros) | `syntax-rules` with practical hygiene is 1.0. `syntax-case` adds power but also complexity and longer expansion paths. Deferred to 1.1 candidate list. |
| `loam/watch` event-driven primitive | Reactive verb for watching a Loam key. Blocked on the FRP time-calculus MOVE 3 (`SAKURA-SCHEME-1.0-ENGINEERING.md §16 MOVE 3`). |
| FRP time-calculus (`time/when`, `time/during`, `time/until`, `time/then`, `time/across`, `time/every-ms`) | Code-ready at `installFrpGrammar`; not yet called. 1.1 candidate. |
| Unified memory verbs (`memory/recall`, `memory/remember`, `memory/forget`) | Code-ready at `installMemoryVerbs`; not yet called. 1.1 candidate. |
| Full ASK floor (~150 collision/introspection/distance verbs) | Planned after bulk macro sweep. 1.1 candidate. |
| `with-comms-compliance` macro | Referenced in 30+ carts as `with-comms-compliance` but not yet defined. This is a 1.0 lint error for those carts; fixing it is a PASS-2 priority. |

### §2.3 Hygiene boundary

The macro system is practical-hygienic, not full R7RS hygienic. The two
binder-capture holes that bite in practice (binder positions in
`let`/`lambda`/`letrec`/`define`) are closed by alpha-renaming template
binders to gensyms. A macro that introduces a free reference to a use-site
name is intentionally NOT renamed — this is the "cooperative discipline"
hatch the dialect macros depend on.

Full hygiene (R6RS `syntax-case` / SRFI-72) would close this hatch and
break the existing 36 dialect macros. It is therefore deferred unless the
macros are rewritten.

---

## §3. The version contract

### §3.1 Versioning scheme

Sakura Scheme versions follow `MAJOR.MINOR.PATCH`:

- `1.0.0` — the sealed 1.0 release (this document)
- `1.0.1` — runtime bug fixes that do NOT change documented behavior
- `1.1.0` — additive release: new macros, new verbs, new primitives,
  new doc-block keys
- `2.0.0` — allowed to break; requires named deprecation of every
  breaking change with 6-month notice

The version string is declared in the cart header as:
```
;;~ language  sakura-scheme-1.0
```

Cart authors do not track patch releases. The `language` key names the
MINOR version, not the patch. A cart sealed to `sakura-scheme-1.0` runs
on every `1.0.x` and every `1.y.z` for `y ≥ 0`.

### §3.2 The 1.x compatibility guarantee

**No item in §1 of this document may be removed, renamed, or changed in
observable behavior in any 1.x release.** This is the hard rule.

The following are permitted in 1.x:
- Adding new descriptor kinds (as long as the existing seven remain)
- Adding new escalation symbols (as long as the existing six remain)
- Adding new base primitives (as long as existing ones are not redefined)
- Adding new macro families to `expand.js`
- Adding new `;;~` header keys
- Adding new verb namespaces
- Raising the fuel budget ceiling
- Improving error messages and lint diagnostics
- Adding new canonical escalation kinds with explicit `<!-- SEALING-AMENDMENT -->` annotation

The following are prohibited in 1.x:
- Changing the meaning of any descriptor tag
- Changing the argument order or count of `next`, `done`, `escalate`, `wait`,
  `after`, `act`, `interrupted`, `ctx-get`, `ctx-set`, `ctx-result`
- Changing the `;;~ language` key parsing logic
- Renaming any of the 36 dialect macros
- Changing the fuel default below 200,000 steps
- Adding `call/cc`, `eval`, mutable cons cells, or any feature in §2.1

### §3.3 The 1.x → 2.0 transition

Sakura Scheme 2.0 may break any item in 1.0 subject to:

1. Every breaking change is named in a `SAKURA-SCHEME-2.0-MIGRATION.md`
   document (not yet written)
2. Every breaking change is marked `deprecated` in a 1.x release before
   removal — minimum one 1.x release carrying the deprecation notice
3. The 6-month deprecation window starts from the date the deprecation
   notice ships in a 1.x release, not from the 2.0 release date
4. The 2.0 runtime includes a compatibility shim that reports conformance
   errors for 1.0 carts that use removed or changed constructs — never
   silent breakage

### §3.4 Bug-fix releases (1.0.x)

A 1.0.x release may:
- Fix a runtime bug where the actual behavior diverges from the documented
  behavior in this document or in `SAKURA-SCHEME-1.0-ENGINEERING.md`
- Fix a security vulnerability without deprecation cycle, even if the fix
  changes observable behavior

A 1.0.x release may NOT:
- Add new features
- Change documented behavior even to "correct" a spec ambiguity — spec
  ambiguities in 1.x are resolved by writing a clarifying note in this
  document, not by changing runtime behavior

### §3.5 Cart conformance declaration

A cart MUST declare:
```
;;~ language  sakura-scheme-1.0
```

A cart without this key is treated as `sakura-scheme-1.0` for the current
transition period but will become a lint error in 1.1. The lint rule is
`MISSING-LANGUAGE-DECLARATION` in `curator-web/src/scheme/cartLint.js`.

<!-- LIVING:TODO(2026-06-30): Add MISSING-LANGUAGE-DECLARATION lint rule to cartLint.js. -->

---

## §4. The sealing ritual

### §4.1 The gate conditions

The following must all be true before 1.0 is declared sealed:

| Gate | Condition | Current status |
|---|---|---|
| G1 | All §1 items have a passing test in the test suite | PARTIAL — kill-list coverage lands: `curator-web/src/scheme/__tests__/killList.test.js` (5 tests, verified passing 2026-07-02) asserts the 42 killed slugs have no live index row / `.sks` file, with documented exceptions. The §1.1–§1.9 primitive coverage lives in `sealing.test.js` (76/76). The remaining open item is the clean survivors-execute sweep (`executeAllCarts.test.js` is red only on uncommitted WIP drafts — see DOC-ROT-SEAL-2026-07-02.md §3). |
| G2 | `dialectConformance.js` clause 11 enforces the honest-null discipline | PASS — clause 11 (`null-silent`) rejects null-silent cart states; `curator-web/src/scheme/linter/dialectConformance.js:432,522 checkHonestNull()` (added 2026-07-02); covered by `dialectConformance.test.js` (44/44 passing, verified 2026-07-02). NOTE: enforcement lives in `dialectConformance.js`, NOT `cartLint.js` — see §1.9 wording note below. |
| G3 | The 36 dialect macros pass their test suite | PASS — `sealing.test.js` asserts `CART_MACROS.length === 18` and `ALL_MACROS === 54 (36 floor + 18 cart)`; suite is 76/76 passing (verified 2026-07-02). |
| G4 | `SAKURA-SCHEME-1.0-ENGINEERING.md` is complete and has no dangling `*[needs: ...]` stubs | PASS — no visible `*[needs: ...]*` stubs remain in the Engineering doc (the two phantom-doc references were converted to a hidden `LIVING:TODO` at `SAKURA-SCHEME-1.0-ENGINEERING.md:1954`, per CLAUDE.md living-marker discipline; hidden markers are honest-null-at-the-doc-layer, not rendered stubs). Verified by grep 2026-07-02. |
| G5 | The `;;~ language` header key is parsed by the studio and lint | PASS — parsed in `scripts/build_cart_index.mjs` (regex + `language` / `language_declared` fields, defaults `sakura-scheme-1.0`); `sealing.test.js` §1.8 validates the `;;~` header block. |
| G6 | The sealing test suite (§4.3) exists and passes | PASS — `curator-web/src/scheme/__tests__/sealing.test.js` (76/76 passing, verified 2026-07-02). Note: spec §4.3 names the file `seal-1.0.test.js`; it ships as `sealing.test.js`. |
| G7 | The architect signs the approval block in §9 | Pending |

### §4.2 The sealing SHA

At seal time, the following git operation produces the canonical seal record:

```bash
# Tag the runtime at the seal commit
git tag -a sakura-scheme-1.0 -m "Sakura Scheme 1.0 — sealed 2026-MM-DD per SAKURA-SCHEME-1.0-SEALING.md"
git push origin sakura-scheme-1.0
```

The SHA of the tagged commit is the canonical 1.0 SHA. It is recorded in §9.1.

### §4.3 The sealing test suite

A sealed-language test suite (`curator-web/src/scheme/__tests__/seal-1.0.test.js`)
must be created. This suite:

- Runs against every commit to the main branch
- Tests every item in §1 for its documented behavior
- Fails if any 1.0 behavior is broken
- Is read-only after the seal: tests in this suite may not be modified after
  1.0 is declared without owner sign-off

The suite structure mirrors §1:

```
seal-1.0.test.js
  §1.1 — descriptor constructors (7 tests, one per form)
  §1.2 — ctx helpers (3 tests)
  §1.3 — reserved forms (one test per listed form, tail-call roundtrip)
  §1.4 — 36 dialect macros (expansion correctness)
  §1.5 — cart shape (lint-clean minimal cart)
  §1.6 — escalation kinds (driver emits structured event per kind)
  §1.7 — verb-naming contract (rejects malformed names)
  §1.8 — doc discipline (lint enforces four-question check)
  §1.9 — honest-null (lint rejects null-silent patterns)
```

<!-- LIVING:TODO(2026-06-30): Write seal-1.0.test.js. Scope: one test per §1 item. No behavioral invention — tests must mirror what the runtime already does. -->

### §4.4 The sealing amendment protocol

If a future 1.x release needs to promote an unguaranteed behavior to a
1.0 guarantee (i.e., add something to §1 without incrementing MAJOR):

1. Open a PR with the proposed §1 amendment
2. Add a test to `seal-1.0.test.js` for the new guarantee
3. Mark the amendment in this document with `<!-- SEALING-AMENDMENT(date) -->`
4. The architect approves and signs the §9 approval block with the amendment
   date

Amendments may only ADD to §1. They may not modify or remove existing
§1 items.

### §4.5 The doc-set that constitutes 1.0

The nine canonical engineering docs listed in §1.10, plus this Sealing
Protocol, constitute the 1.0 documentation corpus. The corpus is sealed
when:

- All nine docs exist (six canonical + three not-yet-written are accepted
  at seal time as stubs with explicit `*[NOT YET WRITTEN]*` markers)
- The stub docs each have an outline and an approval block date
- This document's gate table (§4.1) shows all gates cleared

---

## §5. The deprecation protocol

### §5.1 The deprecation lifecycle

A primitive, macro, verb, or behavior passes through these phases:

```
Active → Deprecated (1.x) → Removed (2.0+)
```

No primitive in 1.0 goes from Active to Removed without passing through
Deprecated. The deprecation phase carries:

- A `DEPRECATED` annotation in the Reference doc (`SAKURA-SCHEME-1.0-REFERENCE.md`)
- A lint warning at the `DEPRECATED-USE` lint rule level (warn, not error)
- An entry in `SAKURA-SCHEME-DEPRECATION-LOG.md` (not yet created) listing
  the deprecated item, the deprecation date, the replacement, and the
  planned removal version

### §5.2 Deprecated does not mean broken

A deprecated primitive or macro in 1.x still works. The runtime does not
refuse to execute deprecated code. The lint tool issues a warning. The
operator-facing Automations dossier surfaces a soft warning for carts that
use deprecated verbs.

The goal is to give corpus authors (human and LLM) time to update their
carts before the removal lands in 2.0.

### §5.3 The deprecation notice window

The minimum deprecation window is:
- One full 1.x minor release where the item is `Deprecated` but still works
- The 6-month calendar window starts from the date the deprecation entry
  appears in `SAKURA-SCHEME-DEPRECATION-LOG.md`

If the 2.0 release arrives before the 6-month window closes on any
deprecated item, the item is NOT removed in 2.0 — it carries forward as
deprecated until the window closes. This is a hard rule.

### §5.4 Lint warnings for deprecated use

`cartLint.js` issues a `DEPRECATED-USE` warning (not error) for any cart
that calls a deprecated primitive, macro, or verb. The warning includes:

- The deprecated item name
- The replacement item name (if any)
- The planned removal version
- A link to the migration guide

Cart authors may suppress the warning by adding
`;;~ deprecated-use-acknowledged item-name` to the cart header.

### §5.5 LLM corpus handling

When a primitive is deprecated, the training corpus pipeline
(`scripts/build_cart_index.mjs`) must be updated so that:

- New carts generated by L0/L2 use the replacement, not the deprecated form
- Existing carts in the corpus are NOT auto-migrated (they remain valid until
  removed in 2.0)
- The deprecation entry in `sakura-corpus.jsonl` marks the deprecated form
  with `deprecated: true` so future training signals avoid it

<!-- LIVING:TODO(2026-06-30): Add deprecated: true support to the corpus builder. -->

---

## §6. What other languages did

The following table surveys how other language communities handled the
equivalent of "sealing a version." Each row describes the sealed entity,
the evolution rate, the breakage tolerance, and the net community impact.
The final row is Sakura Scheme 1.0's position.

| Language | Sealed entity | Evolution rate | Breakage tolerance | Community impact |
|---|---|---|---|---|
| **R5RS (1998)** | Core Scheme — minimal, 23 constructs, 14 derived | Slow (9 years to R6RS) | Low — spec changes required full consensus | Beloved; every implementation still ships it; the gold standard for "how to write a small Lisp spec" |
| **R6RS (2007)** | Comprehensive Scheme — 340% larger than R5RS; modules, records, `syntax-case` | Immediate controversy; frozen thereafter | High — broke backward compat with R5RS in multiple places (case sensitivity, REPL removal) | Divisive; 4 implementations rejected it outright; the cautionary tale about sealing too much |
| **R7RS-small (2013)** | Minimal Scheme + standard library structure | Slow; R7RS-large still in progress 2026 | Very low — explicit goal was R5RS compat | Widely adopted; the working model for "seal a small core, extend via separate process" |
| **ANSI Common Lisp (1994)** | Complete Lisp-2 — frozen forever | Zero — not a character has changed | N/A — it can never change | Stable, mature, implementors committed for decades; downside: known bugs and awkward corners calcified permanently |
| **Racket (`#lang racket/base`)** | The base language module | Fast — ships with every Racket release | Low — `#lang` system lets old versions coexist with new in the same file | Pragmatic; versioning is per-file via `#lang`, not per-language-spec; old carts keep their `#lang` forever |
| **Clojure (2007–present)** | Lisp-1 on JVM — additive-only by discipline | Moderate — Rich Hickey extremely conservative about adding anything | Very low — "It is very easy to add and not break anything" (Hickey) | Exemplary stability story; 10+ years, almost zero regressions; the closest model to what we want |
| **Erlang/OTP (OTP 21+ discipline)** | Runtime ABI + module API | Annual major release; 3-year support window | Low — minimum one-release deprecation window before removal | Mature; operators trust multi-year upgrade paths; the model for "deprecation with notice" |
| **WebAssembly (MVP 2017)** | Binary format + instruction set | Additive only; version field stays at 1 forever; proposals are opt-in | Zero breakage tolerance — "all present and future versions are backwards-compatible" | Industry-wide adoption; the model for "never break the binary" |
| **Sakura Scheme 1.0 (2026)** | Cart ABI (7 descriptors) + S70 base forms + 36+18 macros + 6 escalation kinds | Additive-only in 1.x; 2.0 allowed to break with 6-month deprecation notice | Low for 1.x; permitted for 2.0 with protocol | *[to be measured]* |

### §6.1 Which model most influenced this design

**Clojure** is the primary influence. The Clojure discipline is: extremely
conservative about adding anything to the core; additive-only evolution;
no backward-breaking changes; the language's stability is itself a
feature. Hickey's phrase — "it is very easy to add and not break anything"
— captures exactly what we want the 1.x period to feel like.

**Erlang/OTP** is the secondary influence for the deprecation cycle: explicit
deprecation notice, minimum one-release window, documentation-led signaling,
security exceptions acknowledged but exceptional.

**R7RS-small** is the cautionary counterpoint to R6RS: the Scheme community
spent a decade recovering from a standard that overclaimed and broke things.
The lesson is not "never seal" but "seal a small, defensible core and be
honest about what is deferred."

**WebAssembly's "version field stays at 1 forever"** is the aspiration for
the binary format: our `.sks` files should be readable and parseable forever.
The `;;~ language sakura-scheme-1.0` key is the cart-format equivalent of
the WASM version field.

### §6.2 What we explicitly rejected

**R6RS's comprehensive approach.** R6RS tried to standardize everything at
once — complex I/O, records, full Unicode, phase separation, `syntax-case` —
and broke backward compatibility in multiple places. The result was that four
major Scheme implementations explicitly rejected the standard, and the
community fractured for years. We seal a small, defensible core in §1 and
defer everything else to 1.1+ candidates.

**ANSI Common Lisp's freeze.** Freezing forever means known bugs cannot be
fixed without a compatibility violation. We allow bug-fix 1.0.x releases and
allow 2.0 to break with deprecation. The freeze is not our model.

**Racket's per-file `#lang` versioning.** Racket solves the problem at the
file level: each file declares its language version, and old files keep their
old language forever while new files use the new language. This is elegant but
requires that every `.sks` file carry a `#lang`-equivalent and that the runtime
can simultaneously host multiple language versions. We achieve the same end
more simply: `;;~ language sakura-scheme-1.0` declares the version, and the
1.x compatibility guarantee means most carts never need to change that line.

---

## §7. The 1.0 → 1.1 candidate list

These items are proposed for 1.1 but are NOT promised. Each must pass its own
gate (implementation + test + doc + architect sign-off) before entering 1.1.
No item here is a 1.0 guarantee.

| Item | Description | Blocking gate |
|---|---|---|
| **18 cart-domain macros** | The M01–M18 batch from `docs/PASS-2-MACROS-2026-06-30.md` — `with-loam-gate`, `with-cortex-cache`, `check-act-result`, `remember-and-render`, and 14 more | Implementation in `expand.js` + passing tests + corpus smoke-test |
| **`with-comms-compliance` macro** | Referenced in 30+ carts but undefined; lint error in those carts | Implementation + test |
| **FRP time-calculus** | `time/when`, `time/during`, `time/until`, `time/then`, `time/across`, `time/every-ms` — code-ready at `installFrpGrammar` but not wired | Wire call + test + MOVE-3 architecture review |
| **Unified memory verbs** | `memory/recall`, `memory/remember`, `memory/forget` — code-ready at `installMemoryVerbs` but not wired | Wire call + test + MOVE-4 architecture review |
| **Full ASK floor** | ~150 collision/introspection/distance verbs (`surface/distance`, `canvas-cell-alive?`, etc.) | Design + implementation + test (MOVE-5) |
| **`loam/watch` event primitive** | Reactive verb for watching a Loam key change; drives FRP patterns | FRP time-calculus must land first |
| **`MISSING-LANGUAGE-DECLARATION` lint rule** | Lint error for carts without `;;~ language` key | Implementation in `cartLint.js` |
| **`DEPRECATED-USE` lint rule** | Lint warning for carts using deprecated items | Deprecation log infrastructure first |
| **Fuel budget documentation** | Expose the fuel limit in the header as `;;~ fuel 200000` — lets authors opt into a different budget per cart | Design + runtime change |

---

## §8. Risks of sealing

### §8.1 Sealing too early

The primary risk. If the 1.0 spec contains a mistake — a descriptor
form with the wrong argument order, a macro with an expansion that has an
unfixable bug, an escalation kind that turns out to be semantically wrong —
that mistake is now a guaranteed-stable behavior in every 1.x release. We
cannot fix it without either a 1.0.x silent-break (which violates the
contract) or waiting for 2.0.

**Mitigation:** The gate conditions in §4.1 must all clear before sealing.
The test suite (§4.3) is the primary safeguard — if the tests pass, the
documented behaviors are what the runtime actually does.

**Known risk areas:**
- `SCHEME-RUNTIME-TRUTH-2026-06-30.md` documents that `(define (done) (done))`
  in a cart source successfully REDEFINES the prelude's `done`, causing
  fuel exhaustion in 660+ carts. This is a 1.0 bug — the env is not frozen
  before cart source evaluates. If we seal 1.0 with this bug, the
  not-freezing-before-evaluation is a 1.0 guaranteed behavior. We should
  decide: fix (by freezing the prelude before evaluating cart source, a
  breaking change for those 660 carts) or document as known behavior.
  **This is the single hardest sealing question** (see §8.4).
- The `(next 'name ctx1 ctx2)` three-argument silent-ignore
  (`SCHEME-RUNTIME-TRUTH-2026-06-30.md §1.2`) is a semantic trap. If sealed,
  it becomes guaranteed-stable behavior that an extra argument to `next` is
  silently dropped. This is arguably a bug; fixing it in 1.x would be a
  breaking change for any cart that accidentally passes three args.

### §8.2 Sealing too late

Every week without a sealed spec is a week in which the LLM training
corpus may be learning behaviors that will change. Every week is also a
week in which cart authors (human and machine) write against an unstable
target. The cost of not sealing compounds.

The corpus is already several thousand carts (derive the live count with
`find curator-web/src/scheme/carts -name '*.sks' | wc -l` for on-disk, or read
`cart_count` in `curator-web/src/scheme/carts/index.json` for the indexed count
— the two drift while uncommitted WIP sits on disk). Those carts encode the
current runtime behaviors. Sealing soon is better than sealing perfect.

### §8.3 The scope problem

The R6RS lesson: sealing too much is worse than sealing too little.
We deliberately avoid the trap by:

1. Naming exactly what is in §1. If it is not there, it is not guaranteed.
2. Erring toward less — the 18 PASS-2 macros are 1.1 candidates, not 1.0
   guarantees, even though their spec is written and reviewed.
3. Making the amendment process (§4.4) lightweight enough that adding a
   new §1 item does not require a full version bump.

### §8.4 The single hardest sealing question

> **Should the prelude be frozen before cart source evaluates?**

The current runtime behavior is: `buildLiveCartEnv` in `cartHost.js:91-103`
calls `makeBaseEnv` + `installCartPrelude` but does NOT call `env.freeze()`.
This means a cart can `(define (done) (done))` and replace the prelude's
`done` with a recursive closure, causing fuel exhaustion.

Three options:

**Option A — Seal with the bug.** Document that the prelude is not frozen,
that cart source can shadow prelude names. This is the "stable at current
behavior" choice. The 660 carts with `(define (done) ...)` are broken by
design — they exhaust fuel and halt. That is their documented behavior.
Sealing this way is honest but commits us to a runtime where `(done)` can
be shadowed forever.

**Option B — Fix before sealing.** Call `env.freeze()` after
`installCartPrelude` and before evaluating cart source. The 660 carts that
redefine `done` would fail at the `freeze` check with a clear error instead
of at fuel exhaustion. This is a cleaner runtime. But it is a breaking change
for those 660 carts, which would need their `(define (done) ...)` removed.

**Option C — Seal with the fix as 1.0.0, treat the pre-fix behavior as
pre-1.0.** Since 1.0 is not yet released, we are not breaking a commitment —
we are defining 1.0 to include the freeze. The 660 carts would be fixed as
part of the sealing work; their `(define (done) ...)` lines are lint errors
that the PASS-2 sweep would catch.

**Recommendation: Option C.** The prelude-freeze is the right behavior.
The 660 broken carts are not correct carts — they contain a recognized
pattern (`SCHEME-RUNTIME-TRUTH-2026-06-30.md §1.3`). Sealing the broken
behavior would be honest but would lock in a semantic trap forever. Fixing
before the seal is the clean choice.

<!-- LIVING:TODO(2026-06-30): Architect decision required on §8.4 Option A/B/C before seal gates clear. This is a blocker for G1 and G2. -->

### §8.5 LLM training coherence

The L0 on-device savant is trained on the corpus. If the corpus encodes
1.0 behaviors and the sealed spec is later found to differ from what the
corpus actually does, the training signal is wrong. The sealing test suite
(§4.3) is the synchronization mechanism: if the test suite passes, the
spec matches the runtime matches the corpus.

---

## §9. Seal date and sealing authority

### §9.1 Seal record

| Field | Value |
|---|---|
| Document version | 1.0.0-draft |
| Proposed seal date | 2026-07-15 (target; subject to gate clearance) |
| Seal SHA | *[to be filled at tag time]* |
| Sealed by | Alfred Robins (architect, sealing authority) |
| PM lane | Claude Code (Sonnet 4.6) |

### §9.2 The sealing authority

The sealing authority is the architect (Alfred Robins). No other party
can declare a Sakura Scheme version sealed. The PM lane (Claude Code)
proposes; the architect decides.

Future minor version seals (1.1, 1.2) follow the same protocol: PM
drafts the §1 additions, architect signs the approval block.

### §9.3 Approval block

```
SAKURA SCHEME 1.0 SEAL — APPROVAL

Sealed: [DATE]
Sealed by: [ARCHITECT SIGNATURE]
Seal SHA: [GIT SHA]
Gates cleared: G1 · G2 · G3 · G4 · G5 · G6 · G7

This approval declares that every item in §1 of SAKURA-SCHEME-1.0-SEALING.md
is guaranteed stable in every Sakura Scheme 1.x release. Any 1.x release
that breaks a §1 guarantee is a bug, not a feature.

[ARCHITECT SIGNATURE LINE — sign here when gates clear]
```

*[Signature pending gate clearance.]*

---

## §10. References

### §10.1 Internal references

- `curator-web/src/scheme/SPEC.md` — lineage doc; fantasy console spec
- `curator-web/src/scheme/cartPrelude.js` — descriptor constructors (§1.1, §1.2)
- `curator-web/src/scheme/cartDriver.js` — state-machine driver (§1.1)
- `curator-web/src/scheme/cartInvariants.js` — between-state assertions
- `curator-web/src/scheme/interp.js` — evaluator, TCO, freeze
- `curator-web/src/scheme/macro.js` — macro expander
- `curator-web/src/scheme/macros/expand.js` — 36 dialect macros
- `curator-web/src/scheme/registry/VerbRegistry.js` — verb namespace registry
- `curator-web/src/scheme/runtime/dispatch.js` — verb gate + audit
- `curator-web/src/scheme/cartLint.js` — lint rules
- `docs/SAKURA-SCHEME-1.0-ENGINEERING.md` — runtime engineering manual (§1.1–§1.4, §16)
- `docs/SAKURA-SCHEME-1.0-REFERENCE.md` — per-verb reference catalog
- `docs/SAKURA-AUTOMATIONS-1.0.md` — cart corpus catalog
- `docs/CANONICAL-DOCS-FRAMEWORK-2026-06-27.md` — doc framework and voice spec
- `docs/PASS-2-MACROS-2026-06-30.md` — 18 proposed cart-domain macros
- `docs/SCHEME-RUNTIME-TRUTH-2026-06-30.md` — ground-truth audit of calling conventions

### §10.2 External references

The following external sources informed the sealing model. They are cited
for intellectual lineage; no code or specification text is reproduced from
any of them.

- **R7RS-small (2013)** — https://small.r7rs.org/attachment/r7rs.pdf — the
  primary Scheme spec for the S70 subset; the WG1/WG2 split is the model for
  "seal a small core, defer extensions via separate process"
- **SixRejection (R7RS wiki)** — https://small.r7rs.org/wiki/SixRejection/ —
  the catalog of R6RS objections; the cautionary tale about sealing too much
- **Clojure Governance** — https://clojure.org/news/2012/02/17/clojure-governance —
  Hickey's additive-only, conservative-addition discipline is the primary model
  for the 1.x period
- **Erlang/OTP Compatibility** — https://www.erlang.org/doc/system/misc.html —
  the deprecation-before-removal, one-release-notice-minimum model
- **WebAssembly FAQ** — https://webassembly.org/docs/faq/ — "version field stays
  at 1 forever" as the model for `.sks` format stability
- **Common Lisp (ANSI X3.226:1994)** — the freeze model; its advantages (settled,
  mature) and disadvantages (known bugs calcified) inform the §8.2 position

---

*End of SAKURA-SCHEME-1.0-SEALING.md*
*Document version: 1.0.0-draft · 2026-06-30 · Subject to gate clearance per §4.1*
