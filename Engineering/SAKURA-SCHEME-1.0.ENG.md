---
slug: sakura-scheme-1.0-eng
title: Sakura Scheme — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Zain (language) + Jess (docs)
codename: sakura-scheme
supersedes:
  - sakura-scheme/docs/ENGINEERING.md (duplicated by this file)
  - curator/docs/SAKURA-SCHEME-1.0-ENGINEERING.md (2026-07-10 mirror)
  - doc-expansion-staging/scheme-eng-moves.md (MOVES 2/5 honest status folded)
  - lacuna-docs/specs/scheme-runtime-features-plan-2026-07-10.md
theme: sakura-scheme
---
# Sakura Scheme 1.0 — Engineering Manual
<!-- covers-through: 2026-07-11 -->

> **Canonical engineering doc #2 of 12** per `docs-consolidation-plan-2026-07-11.md`. Previously #2 of 8 per
> [`CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`](CANONICAL-DOCS-FRAMEWORK-2026-06-27.md).
> Voice: HelloSurface gold standard. Pairs with the verb catalog
> ([`REFERENCE.md`](REFERENCE.md)) and the
> cart corpus ([`SAKURA-AUTOMATIONS-1.0.md`](SAKURA-AUTOMATIONS-1.0.md)).

> **🔒 ARCH LOCK 2026-06-22** — methodology synthesised at
> `HELLO-SURFACE-1.0-ENGINEERING.md` §95. Read §95 first; it names the
> 6 MOVES (Co-Author / bulk macro sweep / FRP time / unified memory /
> ASK floor / talking+doing bus) and folds §93 (music+animation moat)
> + §94 (SICP/refs/macros measured) into the methodology lock. This
> doc continues as the per-verb engineering surface; semantic shifts
> defer to §95.
>
> **Audience:** Lacuna engineers and any agent (in-editor LLM or future
> on-device Sakura) editing this repo. Not operators. Not marketing.
> **Posture:** Assumes Scheme proficiency. No "what is a lambda."
> No "what is tail-call optimization." If a paragraph reads like a
> primer, it does not belong here.
> **Author:** Soo-Jin (Scheme composition lead) — restructure of 2026-06-15
> (skeleton + section stubs; prose folds in per follow-ups).
>
> **Companion docs:**
> · `docs/REFERENCE.md` (per-verb entries, novice → expert)
> · `docs/SAKURA-AUTOMATIONS-1.0.md` (cart corpus)
> · `docs/TUTORIAL.html` (on-ramp)
> · `docs/HELLO-SURFACE-1.0-ENGINEERING.md` (the surface this engine drives)
> · `curator-web/src/scheme/SPEC.md` (in-code engine spec — the lineage doc)

This is the engineer's read-first. If you are touching the evaluator,
the primitive set, the verb registry, the cart driver-loop, or the
LLM-side cart generation pipeline, the canonical claim about how it
works lives here — and every load-bearing claim is anchored to a real
`file:line` in the tree.

> **RULE:** If the engine breaks, an LLM with this manual + the repo
> must be able to rebuild it without consulting any other doc. Every
> section therefore carries enough detail to re-author the component
> from scratch.

> **GUIDANCE:** No dated snapshots in normative prose. Describe the
> SYSTEM, not its state on a given day. Dates belong in the approval
> block and the change log only.

---

## TABLE OF CONTENTS

- [§0. Mental model + reading guide](#0-mental-model--reading-guide)
- [§1. Why Scheme](#1-why-scheme)
- [§2. The S70 standard — what we picked, what we left out](#2-the-s70-standard)
- [§3. Architecture overview](#3-architecture-overview)
- [§4. Runtime + evaluator](#4-runtime--evaluator)
- [§5. Primitive system](#5-primitive-system)
- [§6. Verb dispatcher](#6-verb-dispatcher)
- [§7. Cart driver-loop](#7-cart-driver-loop)
- [§8. Cart lifecycle](#8-cart-lifecycle)
- [§9. Browser load path](#9-browser-load-path)
- [§10. Sakura's access pattern (the LLM consumer)](#10-sakuras-access-pattern)
- [§11. Browser budgets](#11-browser-budgets)
- [§12. Per-session LLM prompting strategy](#12-per-session-llm-prompting-strategy)
- [§13. The cart-writing procedure](#13-the-cart-writing-procedure)
- [§14. Interactions with other subsystems](#14-interactions-with-other-subsystems)
- [§15. Test discipline](#15-test-discipline)
- [§16. Editor-side rules — how to extend the language](#16-editor-side-rules)
- [§17. Honest gaps](#17-honest-gaps)
- [§18. Glossary](#18-glossary)
- [§19. References](#19-references)
- [§20. Approval](#20-approval)

---

## §0. Mental model + reading guide

This section is the one-paragraph mental model the rest of the manual
expands. If you read nothing else, read this.

Sakura Scheme is a capability-bounded Lisp-1 fantasy console that
doubles as the cart engine for the Curator Arcade and the Shop-Sim
flagship (`curator-web/src/scheme/SPEC.md:1-25`). The interpreter has
**no ambient authority**: an evaluated program can only touch what the
host injected into its environment. Every "do a thing" — paint a dot,
move a card, ask Etsy — is a registered *verb* the dispatcher gates per
caller tier, perm, rate limit, and substrate power tier
(`curator-web/src/scheme/runtime/dispatch.js:65-72`). Carts are
state-machine spines whose state functions return descriptors
(`next` / `done` / `escalate` / `wait` / `after` / `act` /
`interrupted`); a small driver loop dispatches the descriptors and
emits structured audit events. The engine fits in a head: ~7,500 lines
of interpreter + dispatcher + primitive installers + cart driver, all
in JS, no JIT, no `eval`.

### Reading order

- The owner reads §0 and §17.
- The engineer touching the evaluator reads §4.
- The engineer touching a verb reads §5 + §6 + §16.1.
- The engineer touching a cart reads §7 + §8 + §13 + §16.4.
- The engineer touching the load path reads §9 + §11.
- The LLM author (cloud or on-device) reads §10 + §12 + §13.
- The fact-checker resolves every `file:line` cited and either
  affirms or NACKs in §20.

> **RULE:** Every section that makes a normative claim about runtime
> behavior, schema, or contract carries a `file:line` anchor. A claim
> without an anchor is a defect — flag it.

---

## §1. Why Scheme

This section names the four properties that decided the language. Each
one is load-bearing; remove any and the rest of the manual stops being
internally consistent.

### §1.1 Homoiconicity

Code is data. The cart driver, the lint, the index builder, the
visualizer, the LLM cart writer, and the replay tool all walk the same
AST shape — JS arrays of interned `Sym` atoms and primitive values
(`curator-web/src/scheme/reader.js:128-155`). A cart is a `.sks` file
on disk, a string in memory, a parsed array under the dispatcher, a
node in a `(define …)` table at runtime — same shape at every stage.
There is no separate IR.

### §1.2 Training-data shape

The on-device savant (Sakura, L0) and the L2 vendor reasoning service both emit
`.sks` files as their output format. The corpus of shipped carts IS
the training set; the breadcrumbs JSONL IS the intent→slug index. Any
language whose surface form is less LLM-legible (XML, JSON-AST,
visual graph) loses both the corpus advantage and the cheap
"paste-the-output-and-run-it" loop the cart-writer pipeline depends on
(§13).

### §1.3 Deterministic by construction

Every primitive declares a determinism class
(`deterministic | bounded(N) | non-deterministic | unknown`,
`curator-web/src/scheme/registry/VerbRegistry.js:41-50`). The dispatcher
propagates the class through macro expansion. A cart whose body
composes only deterministic primitives is itself deterministic;
replay across sim↔prod is byte-identical given the same seed
(`curator-web/src/scheme/cartDriver.js:88-92`).

### §1.4 Sandboxable

A Scheme program touches the world only through verbs the host
`env.define`d. There is no `eval`, no `call/cc`, no `Function`
constructor, no DOM, no XHR. The substrate `freeze()`
(`curator-web/src/scheme/interp.js:137-164`) locks the verb set after
boot. An attacker who reaches `env.define('publish', …)` to override a
gated verb throws.

> **RULE:** Adding a feature that would break any of §1.1–§1.4
> requires owner sign-off. These are the four properties the rest of
> the engine depends on.

---

## §2. The S70 standard — what we picked, what we left out

This section names the R7RS-small subset Sakura Scheme implements and
the rationale for every omission. The dialect is a *capability-bounded
fantasy console*, not a general-purpose Scheme — the cuts are
deliberate.

### §2.1 What we picked from R7RS-small

- **Lisp-1 namespace.** One slot per name. Functions and values share
  the env chain. (R7RS-small allows either; we picked Lisp-1 for
  prompt-pack simplicity.)
- **`define` / `set!` / `lambda` / `begin`** — bindings, mutation,
  closures, sequencing.
- **`if` / `when` / `unless` / `cond` / `case`** — branching.
- **`let` / `let*` / `letrec` / named-`let`** — block scope. Named-let
  is the cart's iteration idiom.
- **`and` / `or`** — short-circuit logical.
- **`quote` / `quasiquote` / `unquote` / `unquote-splicing`** — data
  templates. Sufficient for cart payloads; full nesting deferred.
- **`syntax-rules` macros (hygienic subset).** Hygiene for binder
  positions; cooperative discipline elsewhere
  (`curator-web/src/scheme/macro.js:14-22`).
- **Tail-call optimization.** Trampolined via `Tail` / `TailCall`
  sentinels (`curator-web/src/scheme/interp.js:9-37`,
  `curator-web/src/scheme/interp.js:226-248`).

### §2.2 What we left out

- **`call/cc` and continuations.** Continuations would break the
  dispatcher's structural gate walk — a continuation could capture
  state before a gate decision and re-enter after.
- **`eval` and `read` from string.** No re-entry with arbitrary new
  source. The `apply()` seam re-enters Scheme with values, not text.
- **Mutable lists.** `cons`/`car`/`cdr` produce immutable JS arrays.
  Mutation is via `set!` on a name. Carts never mutate cons cells.
- **Full R7RS quasiquote nesting.** One-level expansion; nested
  quasiquotes drop a level per nesting. Enough for cart payloads.
- **Hash tables, vectors, records.** Cart payloads use alists +
  symbols; the JS host owns mutable structured state.
- **Ports + file I/O.** I/O is verb-gated. There is no `(open-input-
  file …)`. Every I/O path is a registered verb.
- **Numerical tower.** JS Numbers throughout. No bignums, no exact
  rationals.

> **RULE:** Adding any item in §2.2 back into the dialect requires
> proving the safety properties of §1 still hold. In particular,
> `eval` and `call/cc` are NOT permitted to land.

### §2.3 Hygiene contract

Hygiene is *practical*, not full R7RS. The two capture holes that bite
in practice (binder positions in `let`/`lambda`/`letrec`/`define`) are
closed by alpha-renaming template binders to fresh gensyms
(`curator-web/src/scheme/macro.js:14-22`). A macro that introduces a
free reference to a use-site name is by design *not* renamed — this is
the "cooperative discipline" hatch the dialect macros rely on.

---

## §3. Architecture overview

This section names the three layers, points at their files, and draws
the component graph. Every subsequent section is a deep-dive on one
layer.

### §3.1 Three-layer split

```
Layer 1 — Scheme runtime
  curator-web/src/scheme/reader.js
  curator-web/src/scheme/macro.js
  curator-web/src/scheme/interp.js

Layer 2 — Verb registry + dispatcher
  curator-web/src/scheme/registry/VerbRegistry.js   (signature truth)
  curator-web/src/scheme/runtime/verbRegistry.js    (dispatcher view)
  curator-web/src/scheme/runtime/dispatch.js        (the gate)

Layer 3 — Cart driver-loop
  curator-web/src/scheme/cartDriver.js              (the spine)
  curator-web/src/scheme/cartPrelude.js             (descriptor ctors)
  curator-web/src/scheme/safetyStars.js             (the 8-star wrapper)
  curator-web/src/scheme/cartBus.js                 (pub/sub for narration)
  curator-web/src/scheme/cartInvariants.js          (the invariant checker)
```

The three layers are independent enough that you can swap any one:
the reader could be replaced by JSON without changing the dispatcher;
the dispatcher's gate could move into a worker without touching the
cart-driver. Today everything runs on the main thread; a worker seam
exists but is not the default path
(`curator-web/src/scheme/runtime/workerBridge.js:1-28`).

### §3.2 Component diagram

```
[FLOW CHART: §3.2 — three-layer component graph]

  ┌──────────────────────────────────────────────────────────┐
  │                       Scheme runtime                      │
  │                                                           │
  │   reader.js  ──→  macro.js  ──→  interp.js  ←──┐          │
  │   (parse)        (expand)        (evaluate)    │          │
  │                                                │          │
  │                                                │          │
  └────────────────────────────────────────────────┼──────────┘
                                                   │ apply()
                       ┌───────────────────────────┼──────────┐
                       │   Verb registry + dispatcher          │
                       │                                       │
                       │   VerbRegistry.js  ─→  verbRegistry.js│
                       │   (signature)          (runtime view) │
                       │                              │        │
                       │                              ▼        │
                       │   dispatch.js  ─→  walkVerbCalls      │
                       │                  ─→  gate (5 checks)  │
                       │                  ─→  emit audit       │
                       │                  ─→  runner(source)   │
                       └───────────────────────────────────────┘
                                          │ executeAct
                       ┌──────────────────┼────────────────────┐
                       │           Cart driver-loop             │
                       │                                        │
                       │   cartDriver.js : driveCart()          │
                       │      │                                 │
                       │      ├─→ normalizeDescriptor           │
                       │      ├─→ checkInvariants               │
                       │      ├─→ dispatch on tag               │
                       │      └─→ emit CartBus events           │
                       └────────────────────────────────────────┘
                                          │ window.dispatchEvent
                                          ▼
                       SakuraCartEventBridge · ActivitySheet ·
                       AutomationPulseButton · OrchestrationBinding
```

> **GUIDANCE:** When a section below uses an unqualified component
> name (e.g., "the dispatcher", "the driver"), it refers to the
> file:function pairing above. Be explicit in new prose.

### §3.3 Co-Author + the 6 MOVES (the methodology lock surface)

Per the 2026-06-22 arch lock (`HELLO-SURFACE-1.0-ENGINEERING.md` §95),
the three-layer split above is supplemented by six MOVE-files that
together form the co-authored substrate. Each MOVE has a canonical
path. Status reflects what is on disk today; the architectural shape
is fixed.

```
MOVE 1 — Co-Author (LANDED)
  curator-web/src/lib/sakuraCoauthor.js        coauthor(source) → metrics+suggestions
  curator-web/src/lib/sakuraCoauthor.test.js   behavior lock

MOVE 2 — Macro library (planned)
  curator-web/src/scheme/carts/lib/cart-macros.sks
  + bulk-sweep script over 493 dream/* carts

MOVE 3 — FRP time-calculus (planned)
  curator-web/src/scheme/time/frpGrammar.js   when/during/until/then/across/every

MOVE 4 — Unified memory (planned)
  curator-web/src/lib/memoryUnified.js        (memory/recall|remember|forget)

MOVE 5 — ASK floor (planned)
  curator-web/src/scheme/primitives/askVerbs.js  ~150 read-only ASK verbs

MOVE 6 — Talking + Doing bus (planned)
  curator-web/src/lib/sakuraThreadBus.js     `curator:sakura-thread` events
```

Co-Author IS the engine §95 designates. Every cart authored from
2026-06-22 forward produces three artifacts: production code + ~3
corpus pairs + a GRPO verifier rule (per `coauthor()`'s envelope
return shape). The validator did not disappear — it became a Language
Coach, returning suggestions alongside errors.

#### Canonical install order — the 6 MOVES (Soo-Jin closeout, 2026-06-22)

The four dormant installers must wire into `curator-web/src/scheme/index.js`'s
runners (`run` · `runSurface` · `runWithCards` · `runProgram`) in this exact
order. Each is `skip-if-bound` (per the collision discipline §6 of the
LANGUAGE REPORT), but ORDER still matters because three of them carry
namespaces that the §101.6 motion verbs and the §93 ASK floor both reference:

```
1. installFrpGrammar(env)          ← time/* (when/during/until/then/across/every-ms)
2. installMemoryVerbs(env)         ← memory/* (recall/remember/forget)
3. installSynthVerbs(env)          ← synth/* (orch/808/sp1200/sampler/mixer)
4. installMotionVerbs(env)         ← motion/* (existing — extends with §101 verbs)
5. installPatternVerbs(env)        ← pattern/* + beat/* (§101 timing lane)
6. installAskFloor(env)            ← ask/* (§93 read-only introspection)
7. installSakuraCoauthor(env)      ← LAST: it wraps the others so authored carts
                                       see the full surface when verifiers run
```

The contract: every Co-Author verifier rule may inspect any prior installer's
surface. If `installSakuraCoauthor` runs before the FRP grammar, the
`verifier-can-cite-time-form` check returns a false negative and the corpus
pair is wrongly rejected. The Test+Audit lane gates this order with an
`assertInstallOrder()` snapshot test (planned, §101.8 step (6) extension).

Cold-boot vs HMR-reload vs test-mode (all three must agree):
- **Cold boot** — runners are called for the first time; the order above is
  the order things run; freeze fires after step (7).
- **HMR reload** — Vite hot-reloads a single installer file. The runner is
  re-invoked, which throws on `env.freeze()` calls against an already-frozen
  env. Mitigation: `freeze()` is idempotent at the runner boundary; the
  installers themselves are skip-if-bound. SAFE.
- **Test mode** — vitest creates fresh `Env` instances per test; tests that
  call individual installers (e.g. `installFrpGrammar(env)` directly) bypass
  the order. Their job is unit-level; integration tests must hit
  `runWithCards` to see the canonical order.

The handshake (§95.6): when the operator types, L0 (on-device savant)
may answer locally; L1 (cloud reasoner, round-robin) handles escalation;
when L0 dispatches a cart, the cart announces itself via the shared
`curator:sakura-thread` event bus (MOVE 6). The operator sees one
Sakura, on two handlebars — talking AND doing, simultaneously. No seam.

Vendor naming inside this manual is governed by the 2026-06-22 lock
(see `CLAUDE.md` "Vendor naming"). The capability tier (L0 / L1 / L2)
is the architectural noun; vendor identifiers appear only at the
wire-call boundary, never in cart corpus, system prompts, or
operator-facing copy. Internal tier IDs use the form
`sakura-l0-llm` / `sakura-l1-llm` / `sakura-l2-llm`
(`curator-web/src/components/cards/sys/TiersTab.jsx:51-55`).

---

## §4. Runtime + evaluator

This section covers the reader, the AST shape, the evaluator (TCO +
fuel), the substrate `freeze()`, the macro pass, and the worker
bridge. It is the longest section in the manual because the language
runtime is where every other layer's correctness rests.

### §4.1 Reader / parser

`tokenize(src)` walks the source character-by-character producing
`{ t, line, col }` tokens; `parse(src)` reads tokens into a nested
JS array (`curator-web/src/scheme/reader.js:73-117`,
`curator-web/src/scheme/reader.js:128-155`). Atoms are interned `Sym`
instances, JS numbers, JS booleans, or strings; lists are JS arrays.
`'x` reads as `(quote x)`; backtick / comma / `,@` lower to
`quasiquote` / `unquote` / `unquote-splicing` per R7RS small.

**This reader IS the SLAT reader.** The load-bearing homoiconicity
property (see §SLAT below) is that any legal SLAT record is a legal
Scheme expression, and any Scheme value that isn't a procedure,
port, or continuation writes back as SLAT. Cortex slices, mailbox
messages, incident narratives, atoms — all arrive at the same reader
Sakura's own source arrives at. The reader upgrades a `SlatValue`
symbol to the interned `Sym` on entry so `(eq? sym1 sym2)` returns
`#t` across wire boundaries — a normative property, gated by CI.
See §SLAT.3 for the primitive tower and §SLAT.4 for the slat-record
shape.

Two ratchets matter for hot paths:

- **Source positions** — every *list* form gets a `{line,col}` tag
  recorded on a `WeakMap` (`curator-web/src/scheme/reader.js:45-53`),
  so error messages and the dispatcher's audit lines can point at the
  exact form. Atoms cannot be tagged (they are primitives or shared
  interned `Sym`s); list-level granularity is the smallest reliable
  unit. `ReadError` (parse-time) already carries `{line,col}`.
  Runtime errors flow through `locate(e, form, slug?)` in `index.js`,
  which wraps the error in the format:
  - without slug: `unbound symbol: x (at line 2, col 1)` (legacy)
  - with slug:    `[cart/etsy-listing-draft:2:1] unbound symbol: x`
  The wrapped error carries `.line`, `.col`, `.cart`, `.cause`.
  Only errors pay the position-lookup overhead (zero cost on success).
- **AST cache** — `parse(src)` memoizes by source string with a
  bounded LRU-ish map of size 256
  (`curator-web/src/scheme/reader.js:167-191`). The studio's run-on-
  keystroke loop, the dispatcher's re-entry path, and the replay tool
  all hit this cache on hot text. Cleared via `clearParseCache()`;
  inspected via `parseCacheStats()`.

### §4.2 AST shape

After read+expand, every program is plain JS:

- numbers / strings / booleans — self-evaluating
- `Sym` instances — looked up in the env chain via `env.get(name)`
  (`curator-web/src/scheme/interp.js:65-69`)
- JS arrays — function applications or special forms (the head
  decides)

The evaluator dispatches on `form[0]` if it is a `Sym`
(`curator-web/src/scheme/interp.js:256-411`). Special-form heads
are: `quote`, `if`, `define`, `set!`, `lambda`, `begin`, `let`,
`let*`, `letrec`, `quasiquote`, `when`, `unless`, `and`, `or`,
`cond`, `case`. Anything else is a function application.

### §4.3 Evaluator — call-by-value, tail-call story, fuel

The evaluator is two pieces: an outer `evaluate(form, env, fuel)`
trampoline and an inner `evalStep(form, env, fuel)` that returns
either a real value or a `Tail` / `TailCall` sentinel
(`curator-web/src/scheme/interp.js:238-248`). The trampoline unwraps
sentinels until a value lands. Every Scheme call that lives in tail
position bounces through `Tail` or `TailCall` so the JS stack stays
flat regardless of Scheme call depth
(`curator-web/src/scheme/interp.js:9-37`). Deep `(let loop …)` is
bounded by `fuel`, not the JS engine's stack.

Fuel is a `{n: int}` object; `evalStep` decrements `fuel.n` on entry
and throws `fuel exhausted` when it goes negative
(`curator-web/src/scheme/interp.js:251`). One fuel object covers an
entire program run — including all primitives that call back into
Scheme through the public `apply()` seam — so a runaway map / deep
recursion / mutually-recursive macro fork-bomb is killed, not
allowed to hang the thread.

#### Lambda + closures

`Closure` carries fixed params, an optional `restParam` for variadic
shapes (`(lambda args body)` or the dotted-tail `(lambda (a b . rest)
body)`), the body forms, and a captured env
(`curator-web/src/scheme/interp.js:174-194`). `parseParams` splits
the dotted-tail shape and rejects malformed lambdas
(`curator-web/src/scheme/interp.js:205-221`). Closure application
binds positional args then the rest list, evaluates all but the last
body form inline, and bounces the last through `Tail`
(`curator-web/src/scheme/interp.js:444-470`) — that is where TCO for
user lambdas lives.

#### `Env` — capability authority

`Env(parent)` is a Map of name → value with a parent link
(`curator-web/src/scheme/interp.js:48-64`). `define(name, val, meta)`
is the canonical install site for every primitive — its third
argument is the verb metadata the dispatcher will gate against
(`curator-web/src/scheme/interp.js:105-134`). Function values trigger
a side-call to `registerVerbMeta(name, resolved)` so the dispatcher's
runtime registry stays in lockstep with the Env. A function-valued
bind without an explicit `meta.perm` emits a one-shot console warning
naming the missing perm — the first signal an author has of a forgotten
declaration (`curator-web/src/scheme/interp.js:117-130`).

#### Quasiquote

`quasiExpand(form, env, fuel)` walks the template; `(unquote x)`
evaluates `x` in place; `(unquote-splicing x)` splices a list
(`curator-web/src/scheme/interp.js:479-501`). One-level expansion;
nested quasiquotes drop a level per nesting. Sufficient for
data-template code; full R7RS quasiquote semantics deferred.

### §4.4 Freeze / serialization

`freeze()` locks the substrate
(`curator-web/src/scheme/interp.js:137-164`): every name bound at
freeze-time is captured in `_frozenNames`; subsequent `define` or
`set!` on those names throws. NEW names land freely (the bricklay
cart's `(define BRICKLAY-MARGIN …)`, named-let loops, user lambdas
all keep working). After-freeze, an attacker who reaches
`env.define('eval', …)` to swap out a primitive gets a thrown
exception. `Object.freeze(Env.prototype)` at module load blocks
prototype-pollution of the `Env` class itself
(`curator-web/src/scheme/interp.js:167-172`).

> **RULE:** Every primitive must be installed BEFORE `freeze()`. A
> primitive installed after freeze throws. This is the substrate
> contract.

#### Serialization

Scheme values serialize through the audit-line schema (§6.4): atoms,
lists of atoms, and value tags (`MotionHandle`, `Address`). Closures
and continuations do NOT serialize — they live only in the running
process. Cart state crossing the sim↔prod boundary must be a
plain-data alist (the cart prelude enforces this by giving carts only
data-shape ctors).

**Serialization for external consumers is SLAT.** When a value needs
to leave the process — mailbox message, cortex slice, log line, saved
artifact-state — it serializes to SLAT canonical form (SLAT §6.1) via
`slat/write`. The output is byte-stable across JS and Python bindings,
signable, content-addressable, and readable directly on the other side
by any SLAT reader. See §SLAT below for the wire form and SLAT §9.4
for the cross-binding contract.

### §4.5 Macro expansion

A separate pass before the dispatcher walks for verbs. The order is
load-bearing for safety:

```
[FLOW CHART: §4.5 — macro pass ordering]

  SOURCE ─→ parse ─→ EXPAND (macro.js) ─→ walkVerbCalls (gate) ─→ evaluate
```

If we walked the raw source the gate would see the macro keyword and
miss the destructive verb the macro rewrites into
(`curator-web/src/scheme/macro.js:1-13`). The dispatcher therefore
calls `expandProgram` BEFORE `walkVerbCalls`
(`curator-web/src/scheme/runtime/dispatch.js:37`,
`curator-web/src/scheme/runtime/dispatch.js:606`).

The macro engine implements a `syntax-rules` subset with a practical
hygiene rule: template identifiers the macro introduces as *binders*
(in `let`/`lambda`/`letrec`/`define` positions) are alpha-renamed to
fresh gensyms, so macro temps never capture or get captured by
use-site names (`curator-web/src/scheme/macro.js:14-22`). Not full
R7RS hygiene; the two capture holes that bite in practice are closed.

Expansion is fuel-capped via a shared counter; the dispatcher mints
a fresh fuel object with `MACRO_GATE_FUEL = 100000` for the gate
pass (`curator-web/src/scheme/runtime/dispatch.js:242`). A fork-bomb
macro throws `macro fuel exhausted` and the dispatch is rejected as
a parse-class error before any verb gate runs.

The 36 dialect macros (the motion / note / form / surface / timing
idioms) live in `curator-web/src/scheme/primitives/macros.js:1-39`.
They are loaded as a single text block parsed and expanded via
`buildMacroTable`; each lowers to a composition of the 15 core
primitives, so determinism propagates through expansion
(`curator-web/src/scheme/primitives/macros.js:30-38`).

### §4.6 Worker bridge (async port)

A worker-thread seam exists but is **scaffolded under a feature
flag** (`curator-web/src/scheme/runtime/workerBridge.js:1-28`). Today
it is used only for parser fuzzing — a malformed source can be sent
to the worker and an OOM there does not take down the main thread.
The full async port (sync verb-call resolution via SharedArrayBuffer +
`Atomics.wait`, COOP/COEP headers) is a deliberate follow-up; today
the synchronous default + `act`-descriptor handoff covers every
shipping cart.

> **GUIDANCE:** When the worker port lands, the macro pass, the AST
> cache, and the verb gate ALL move into the worker. The main thread
> only sees post-gate accept/reject events. The cart driver remains
> on the main thread because it owns the `CartBus` window-event
> emission.

---

## §5. Primitive system

A primitive is a JS function bound into a Scheme `Env` via
`env.define(name, fn, meta)`
(`curator-web/src/scheme/interp.js:105-134`). The third argument is
the verb meta the runtime registry stores — the dispatcher reads it
on every call. That coupling is the whole "capability-bounded by
construction" property: a primitive that is not `define`d is not
reachable.

### §5.1 Primitive contract

Every primitive registration carries:

| Field | Type | Required | What it means |
|---|---|---|---|
| `name` | string | yes | The Scheme-side identifier |
| `arity` | `{positional, keywords}` | yes | Min positional + accepted `:key` args |
| `determinism` | enum | yes | `deterministic` / `bounded(N)` / `non-deterministic` / `unknown` |
| `perm` | enum | yes | `read` / `paint` / `animate` / `state-change` / `destructive` / `financial` / `network` / `personal-data` |
| `stateChanging` | boolean | conditional | Required if `perm ∈ {state-change, destructive, financial}` |
| `chip` | string | optional | The side-effect chip kind (auto-emitted on accept) |
| `returns` | string | optional | The return-value tag (`MotionHandle`, `Address`, `Envelope`, etc.) |
| `acceptsAddress` | string[] | optional | Address kinds the verb accepts (`card`, `anchor`, `sprite`, etc.) |
| `acceptsClass` | string[] | optional | Class names the verb accepts |
| `aliasFor` | string | optional | Canonical name if this is a legacy alias |
| `addedIn` | semver | yes | First version that registered this verb |
| `summary` | string | yes | One-sentence description for the reference doc |

The registry validates the shape minimally on register
(`curator-web/src/scheme/registry/VerbRegistry.js:131-146`) and
freezes the entry so consumers can not mutate
(`curator-web/src/scheme/registry/VerbRegistry.js:148-157`).

> **RULE:** A registered verb without an explicit `perm` is a defect.
> The startup validator throws on the first such verb at boot
> (`curator-web/src/scheme/runtime/verbRegistry.js:232-246`).

### §5.2 Capability-first naming convention

Per `CLAUDE.md` (the agent rules) and the W01 wire-lock, no vendor
name reaches an operator-facing surface. The verb namespace is
**capability-first**:

| Capability | Verb |
|---|---|
| LLM call (workhorse-class reasoner) | `(model/workhorse …)` |
| LLM call (deep-class reasoner) | `(model/deep …)` (planned) |
| Web search | `(web/search …)` |
| Web scrape | `(web/scrape …)` |
| Document parse | `(documents/parse …)` |
| Embedding | `(vision/embed …)` |
| Cosine match | `(vision/cosine-match …)` |
| Memory read | `(cortex/recall …)` |
| Memory write | `(cortex/remember …)` |
| Marketplace platforms | `(etsy/…)`, `(ebay/…)`, `(shopify/…)`, `(meta/…)`, `(google/…)` — marketplace names stay literal |
| Sakura support assistant on backend | `(lacuna/ask …)` |
| Operator-state probe | `(loam/operator-state …)` |

The backend keeps real vendor names at the wire-call boundary only
(the Python operations layer's HTTP clients post to the L2 vendor
reasoning service, the web-search service, the Etsy/eBay marketplace
APIs, and so on — vendor identifiers live exclusively in those wire
modules). The capability layer is the seam between Scheme and the
operator-facing surface, and Sakura never speaks vendor names because
she only ever speaks verbs.

#### Naming policy (the bare/slash/`!`/`?` rules)

- Bare names — language primitives, Scheme-base values. `+`,
  `cons`, `lambda`. No namespace.
- Slash names — capability namespaces. `motion/glide`,
  `cortex/recall`, `etsy/listings`.
- Hyphen-suffix `!` — Scheme bang convention for mutators.
- Hyphen-suffix `?` — predicate. `card-visible?`, `input/may-i?`.

The `STATE_CHANGE_PATTERNS` heuristic
(`curator-web/src/scheme/runtime/verbRegistry.js:102-116`) catches
names that *look* like writes — `!` suffix, `card-*`, `shop-*`,
`store-*`, `transfer`, `summon`, `organize`, `move-`, `delete`,
`publish`, `pay-`, `send-`. A registration matching one of these
patterns without an explicit `perm` declaration is flagged
`_needsExplicitPerm`.

### §5.3 Registration + installers

`installAnimationEngine(env)` is the entry point
(`curator-web/src/scheme/primitives/index.js:51-62`). It wires:

| Installer | What it installs | Source |
|---|---|---|
| `installBasePrimitives` | `make-character`, `input/may-i?` (+ legacy aliases) | `curator-web/src/scheme/primitives/base.js:127-164` |
| `installMotionPrimitives` | `motion/move-to`, `motion/idle`, `motion/halt`, `motion/follow-input`, `motion/anchor-to-input` | `curator-web/src/scheme/primitives/motion.js` |
| `installNotePrimitives` | `note/strike`, `note/place-at`, scale + tempo primitives | `curator-web/src/scheme/primitives/note.js` |
| `installSurfacePrimitives` | `surface/show`, `surface/hide`, `surface/fade` family | `curator-web/src/scheme/primitives/surface.js` |
| `installCardPrimitives` | `define-card`, card-lifecycle hooks | `curator-web/src/scheme/primitives/card.js` |
| `installRuntimeVerbs` | `animation/budget`, `animation/reflow-policy` (+ legacy aliases) | `curator-web/src/scheme/primitives/runtime.js:61-105` |
| `installAuditVerbs` | introspection verbs for tests + dev | `curator-web/src/scheme/primitives/audit.js` |

The wrapper enforces **first-installer-wins + skip-not-clobber**: a
second registration for an existing name is silently dropped, the
collision recorded in a per-process log
(`curator-web/src/scheme/primitives/index.js:32-49`). This is the
same discipline the `VerbRegistry` uses
(`curator-web/src/scheme/registry/VerbRegistry.js:124-128`); the two
registries are aligned on the rule deliberately so installer order
across the animation + music + cards lanes does not become a
runtime-ordering hazard.

### §5.4 Registry validation

`validateRegistry({throwOnFail:true})`
(`curator-web/src/scheme/runtime/verbRegistry.js:232-246`) is the
boot-time gate. It scans every registered name, flags any matching
`STATE_CHANGE_PATTERNS` without an explicit perm, and throws naming
every flagged name. The dispatcher calls this once per process via
`ensureValidated` (`curator-web/src/scheme/runtime/dispatch.js:79-95`).

The `READ_VERBS` set is the explicit exception list — getters whose
names look state-changing but actually read
(`curator-web/src/scheme/runtime/verbRegistry.js:121-127`).

#### Side-effect class — chips

A verb's meta may declare a `chip` kind
(`paint.applied` / `motion.applied` / `look.changed`)
(`curator-web/src/scheme/runtime/verbRegistry.js:86-90`). When the
dispatcher accepts the verb, it auto-emits one `chip.v1` envelope to
the chip sink — zero per-verb code
(`curator-web/src/scheme/runtime/dispatch.js:209-223`). The
operator's UI listens to chips to render Sakura's "I just did the
thing" affordance (action glow, the sakura-magic 8px outline — never
a shadow).

---

## §6. Verb dispatcher

The dispatcher is `dispatchScheme(source, caller, runner)` in
`curator-web/src/scheme/runtime/dispatch.js:525-590`. It is the only
gate. Every entry-point that runs Scheme should route through it; the
legacy `runWithCards` path is what the dispatcher calls as its
`runner` after every verb call passes its gate.

### §6.1 Gate flow

```
[FLOW CHART: §6.1 — dispatchScheme gate flow]

  src + caller
    ↓
  ensureValidated()                       ── once per process
    ↓
  parse(src)
    ↓
  expandProgram(parsed, fuel=100000)      ── macro pass (fuel-capped)
    ↓
  walkVerbCalls(ast)                      ── collect Sym-headed calls
    ↓
  for each call:
    ├─ look up meta in runtime verbRegistry
    ├─ if missing → reject 'unknown-verb' (unless name is a local def)
    ├─ check perm against caller.tier
    ├─ check verb.powerTier against canvasPower.getTier()
    ├─ check rate limit (per-verb-per-tier bucket)
    ├─ validate args against schema if present
    ├─ if meta.confirm && !caller.confirmed → reject 'consent-required'
    └─ if perm === 'destructive' && tier === 'sakura' → hard reject
    ↓
  on reject: emit audit line + return {ok:false, reason, verb, args}
  on accept: emit start event, hand to runner(source), emit complete
```

### §6.2 Caller tiers

Six tiers, ranked low → high authority
(`curator-web/src/scheme/runtime/dispatch.js:21-29`):

- `system` — engine-internal carts shipped in the build.
- `operator-gesture` — direct UI tap / drag / keyboard.
- `operator-voice` — wake-word + voice command.
- `sakura` — LLM-emitted Scheme.
- `external` — URL hash / deep link / webhook.
- `untrusted` — chat textarea, free-form input. (Default.)

Tier → permission set lives in `TIER_PERMS`
(`curator-web/src/scheme/runtime/dispatch.js:65-72`). Sakura gets
`read | paint | animate | state-change` but never `destructive`,
`financial`, `network`, or `personal-data` — those require an
operator confirm. The rule "Sakura cannot fire destructive" is
enforced both by the tier-perms set AND a hard rule deeper in the
function (`curator-web/src/scheme/runtime/dispatch.js:650`).

> **RULE:** The hard-reject for `tier === 'sakura' && perm ===
> 'destructive'` is belt-and-suspenders with TIER_PERMS. Both checks
> are load-bearing; do not "simplify" by removing one.

### §6.3 Walking the AST for verb calls

`walkVerbCalls(ast)` is a structural walk
(`curator-web/src/scheme/runtime/dispatch.js:275-339`). It collects
every Sym-headed application form AND every locally-defined name
(carts that author their own helpers via `(define (helper args)
body)`). Quoted data is NOT walked — `'a-name` is data, not code.
Quasiquote IS walked through the `(unquote …)` islands
(`curator-web/src/scheme/runtime/dispatch.js:341-351`).

The dispatcher's unknown-verb rejection skips calls whose name is in
the `locals` set — a user-defined helper. Other gates still fire for
every registry hit, so this does not open a hole: a local helper
that calls a destructive verb inside its body lands in `calls` via
the body walk and gets gated normally
(`curator-web/src/scheme/runtime/dispatch.js:265-274`).

### §6.4 Audit lines

Every accept and reject emits ONE structured audit line through the
emit + `logEvent` paths (`curator-web/src/scheme/runtime/dispatch.js:438-488`).
Schema (`AUDIT_LINE_KEYS`, frozen, `dispatch.js:419-422`):

```
{
  ts:         ISO timestamp
  verb:       string             — one verb per line
  args:       string[]           — previewArg()'d, size-bounded
  caller:     { tier, surface, address }
  perm:       string | null      — from verbRegistry
  result:     { status, value? | code? + reason? }
  durationMs: number             — per-verb time on accept, 0 on reject
  confirmed:  boolean
  traceId:    short tr-xxxxxx id
}
```

Sibling subscribers (`logbus → chipSink → future Cortex mirror`) read
the `detail` payload verbatim. The schema is the
LEGAL-FLOOR-for-disputes audit layer; the events are durable evidence
when a customer alleges something Sakura did
(`curator-web/src/scheme/runtime/eventLog.js:1-15`).

Correlation IDs (`correlationContext.js`) thread one ID across every
verb in a single dispatch, so a grep on `traceId` stitches them back
together (`curator-web/src/scheme/runtime/dispatch.js:540-550`).

### §6.5 Honest-null return — `'service-not-yet-wired`

A primitive whose backend is not yet wired must NEVER fake a success.
The contract is documented in `CLAUDE.md` "Honest nulls, no
fluent-wrong" and enforced by example through the entire shop-verbs
runtime (`curator-web/src/scheme/shopVerbsRuntime.js:53-71`,
`curator-web/src/scheme/shopServiceVerbBodies.js:1-28`). The
canonical envelope shape:

```scheme
(escalate 'service-not-yet-wired
          '(:status not-wired :reason "<honest reason>"))
```

In carts this lands as a cart-driver `escalate` descriptor; the
driver routes through the bus's `ESCALATE` event and emits one
`escalated` outcome. The operator sees a chip; the audit log
records the not-wired cause. We never silent-success a no-op.
We never claim "Ready" / "Done" when the underlying path is not
verified end-to-end.

> **RULE:** A primitive returning a fake-success envelope is the
> single class of defect that is legally sue-able. Every
> not-yet-wired path emits `'service-not-yet-wired`. No exceptions.

### §6.6 Async dispatch path

The dispatcher itself is synchronous: parse → expand → walk → gate.
That work is microseconds for a typical cart and fits comfortably on
the main thread. The gate decision lands before any side-effecting
code runs.

The `runner` the dispatcher hands accepted source to (typically
`runWithCards`) is also synchronous in today's default path. Verbs
that need async work — `(act 'web/search …)`, `(act 'etsy/listings
…)`, `(act 'model/workhorse …)` — do not run inline. They register
their intent through the **cart-driver `act` descriptor** (§7), which
the host's async `executeAct(callId, verb, args)` resolves between
state transitions. That separation is deliberate: the interpreter
stays trampolined and synchronous; the I/O lives in the driver and
the host.

---

## §7. Cart driver-loop

A cart is a `.sks` file: a `(cart 'id …)` header, optional
`(invariants …)`, and a set of `(define (state-name ctx) …)` forms.
The runtime calls `start` first; every state function returns a
*descriptor* (`curator-web/src/scheme/cartDriver.js:10-30`).

### §7.1 The 8-star spine

Every cart state implements the same shape:

```
[FLOW CHART: §7.1 — the eight-star spine]

  precondition_fetch → guard → act → result → on_error{retry|degrade|escalate|ask_human}
```

The driver wraps individual *state transitions* with this spine; the
`withStars` helper wraps individual *verb bodies* with the same
eight phases (`curator-web/src/scheme/safetyStars.js:1-21`,
`curator-web/src/scheme/safetyStars.js:48-150`). A state's
precondition runs `precondition(ctx)`; if it returns anything other
than `true` the state returns an `(escalate 'precondition-failed …)`
descriptor. Same for `guard`. The `act` is the state's actual work —
typically one `(act 'verb args 'next-state)`. `result` is the
envelope returned to the next state via `ctx['last-result']`.
On error, the four branches:

- `retry` — transient errors, up to N times.
- `degrade` — partial-cache / stale-data: return an envelope marked
  partial, continue.
- `escalate` — unrecoverable: raise to Sakura / surface.
- `ask_human` — ambiguous: prompt operator confirmation.

The eight-star wrapper is FOREVER CODE
(`curator-web/src/scheme/safetyStars.js:1-21`); altering its shape
breaks every cart's failure semantics.

#### Descriptor catalog

| Descriptor | Meaning |
|---|---|
| `(next 'name ctx)` | advance to state `name` with new ctx |
| `(done)` | cart finished cleanly |
| `(escalate 'kind detail)` | pause; surface decides (`consent-required`, `transport-error`, `service-not-yet-wired`, etc.) |
| `(wait 'event [deadline-ms])` | block until event fires |
| `(after seconds 'name ctx)` | sleep N seconds, resume at `name` |
| `(act 'verb args 'on-result)` | tool call; on-result is a SYMBOL naming the next state |
| `(interrupted reason new-ctx)` | live-voice mid-speech interruption |

The descriptors are constructed by primitives installed via
`installCartPrelude(env)`
(`curator-web/src/scheme/cartPrelude.js:42-100`). They are pure data
constructors — the descriptor head is an interned symbol, the tail is
the cart's payload. The cart NEVER touches the world directly; every
side effect is wrapped in an `act` descriptor the driver dispatches.

### §7.2 `driveCart` walk

`driveCart(opts)` (`curator-web/src/scheme/cartDriver.js:57-281`)
opens with a `CART_START` event carrying the seed (for byte-identical
replay across tiers per the G2 reconciliation note,
`curator-web/src/scheme/cartDriver.js:88-92`), then loops:

```
[FLOW CHART: §7.2 — driveCart walk]

  loop:
    ├─ env.get(stateName) — bail if undefined
    ├─ apply(fn, [ctx], fuel) — drive the state through interp.apply
    ├─ normalizeDescriptor(d) — uniform {tag, …} shape
    │     malformed → TrapError → halt with structured reason
    ├─ checkInvariants(…) — per-transition invariant gate
    │     violation → halt 'invariant-violation' + name
    └─ dispatch on descriptor.tag:
        done       → CART_END outcome=done; return
        next       → loop with stateName=d.name, ctx=d.ctx
        escalate   → ESCALATE + CART_END(kind); return
        after      → AFTER (host scheduler handles wall-clock)
        wait       → WAIT + CART_END outcome=waiting; return
        act        → if destructive && !operator_confirmed
                       → escalate 'consent-required
                     else: ACT_REQUEST → await executeAct → ACT_RESPONSE
                     transport error → escalate 'transport-error
        interrupted → INTERRUPTED + CART_END outcome=interrupted

  hard cap: maxSteps = 200
  fuel cap: 50,000 steps (independent of maxSteps)
```

### §7.3 Sim / prod boundary

When `ctx['mode'] = 'sim'` and the host passes `executeSim`, the
driver routes `act` descriptors to the sim runner instead of the
prod one (`curator-web/src/scheme/cartDriver.js:97-98`,
`curator-web/src/scheme/cartDriver.js:233-238`). That is the seam
Shop-Sim's "30-day forecast" carts ride: same cart, sim runner
returns synthetic platform responses against a copy of shop state.
The interpreter cannot tell the difference; the authority boundary
holds.

#### Bus + bridges

The `CartBus` is a small pub/sub the driver writes to
(`curator-web/src/scheme/cartBus.js`). Before the first event fires
the driver dispatches a `CART_EVENTS.BUS_ATTACH` window event so
mounted bridges (`SakuraCartEventBridge`, `ActivitySheet`,
`AutomationPulseButton`) can subscribe and narrate the cart as it
runs (`curator-web/src/scheme/cartDriver.js:73-86`). Bridges
self-unsubscribe on `CART_END`. Bus emission is best-effort: a
missing window (tests / SSR) or a throwing listener must NEVER break
the run.

---

## §8. Cart lifecycle

```
[FLOW CHART: §8 — cart lifecycle]

  write → lint → index → ship
```

### §8.1 Write — lint (Star 1 invariants)

Carts are hand-written or LLM-generated. Both paths produce a `.sks`
file dropped at `curator-web/src/scheme/carts/<dir>/<slug>.sks` per
the directory canon. The canonical 4-block shape:

1. Header sled — `;;~ key value` lines: `title`, `author`, `version`,
   `mode`, `flavor`, `id`, `trigger`, `touches`, `summary`. The
   build script reads these
   (`scripts/build_cart_index.mjs:92-100`).
2. Doc block — `;;` comments documenting WHAT / WHY NOW /
   CAPABILITY-FIRST DISPATCH / CORTEX LANDING SHAPE / SCOUT LABEL /
   HONESTY / SPECIFICS / IDEMPOTENCY / ERROR GRAMMAR.
3. `(cart 'slug '((author . "…") (version . 1) (read-only . #t)))`
   — the runtime no-op registration with metadata.
4. State functions — `(define (start ctx) …)`, `(define (state-fn
   ctx) …)`, …, each returning one descriptor.

`cartLint(source)` is Star 1 of the eight safety stars; pre-execution
gate (`curator-web/src/scheme/cartLint.js:1-21`). Runs at cart-save
time, before the driver is started. Catches:

- missing `(cart 'id …)` header
- missing `(define (start ctx) …)` entry state
- `act` forms whose `on-result` is an inline lambda (the architect's
  rule: every on-result is a quoted symbol so the cart is
  serialisable + replayable)
- `(next 'X ctx)` where `X` is never defined
- `(escalate 'kind …)` with no quoted-symbol kind
- dead/unreachable states (defined but never reachable)

The Python mirror `_validate_cart_text` in
`curator_api/sakura_tools.py` re-implements the same checks
server-side so the LLM dispatcher has a deterministic gate at the
HTTP boundary.

### §8.2 Index regeneration (deterministic from disk)

`node scripts/build_cart_index.mjs`
(`scripts/build_cart_index.mjs:1-15`) walks `curator-web/src/scheme/
carts/**/*.sks` and emits:

- `curator-web/src/scheme/carts/index.json` — the global searchable
  index. The browser eagerly loads this.
- `curator-web/src/scheme/carts/sakura-corpus.jsonl` — intent→slug
  training pairs Sakura learns on.
- `curator-web/src/scheme/sakura-cart-breadcrumbs.json` — natural-
  language lookup table.
- `curator-web/src/scheme/carts/<dir>/manifest.js` — per-tier
  manifest. Auto-only for the dirs in `AUTO_DIRS = {imagine, pink,
  magic}` (`scripts/build_cart_index.mjs:28`).

> **RULE:** Regeneration is deterministic — same disk state always
> yields byte-identical outputs (sorted keys, stable tag selection,
> pinned timestamp). A non-deterministic build is a defect.

### §8.3 Manifest split — hand-curated vs auto-generated

Five dirs are hand-curated (`etsy`, `google`, `personal`, `scenes`,
`transfer`); the build script reads each existing `manifest.js` for a
`// hand-curated: do not regenerate` sentinel and skips writing if
present.

> **GUIDANCE:** Do not strip the sentinel without owner sign-off.
> Hand-curated manifests carry editorial ordering and grouping that
> the build script cannot infer from disk.

### §8.4 Pre-commit hook + python wrapper + npm script

Three equivalent entry points run the same Node script:

```bash
npm --prefix curator-web run build:cart-index
node scripts/build_cart_index.mjs
python3 scripts/update_cart_index.py
```

The pre-commit hook (`.githooks/pre-commit`) auto-runs on any
committed `.sks` change. Activate once per clone:
`git config core.hooksPath .githooks`.

---

## §9. Browser load path

`curator-web/src/scheme/cartLoader.js` is the runtime API the studio
uses. This section is the operator-side counterpart to §8.

### §9.1 Eager index

`curator-web/src/scheme/cartLoader.js:16-29`:

```js
import indexData from './carts/index.json'
const INDEX = Object.freeze(indexData)
const BY_SLUG = Object.freeze(Object.fromEntries(INDEX.carts.map((c) => [c.slug, c])))
```

The full index ships in the main bundle. JSON-parse stays in the
single-digit-milliseconds range even at the current corpus size (several
thousand carts — derive the live count from `cart_count` in
`carts/index.json`); the frozen `BY_SLUG` map gives O(1) lookup.

### §9.2 Lazy `.sks` bodies via `import.meta.glob`

`curator-web/src/scheme/cartLoader.js:39-50`:

```js
LAZY_CARTS = import.meta.glob('./carts/**/*.sks', {
  query: '?raw', import: 'default',
})
```

`import.meta.glob` without `eager:true` returns `{path: () =>
Promise<string>}`. Each `.sks` becomes its own Vite chunk; Rollup
code-splits per file. Calling `loadCart(slug)` fetches exactly one
chunk; everything else stays un-fetched
(`curator-web/src/scheme/cartLoader.js:65-79`). A body cache
(`_bodyCache = new Map()`) memoizes resolved sources so re-loading
the same cart is free.

**SC1 (R1) cache seams** — two explicit eviction points:
- `clearBodyCache(slug?)` — evict one slug or all entries (HMR /
  cart reload). In-memory only; no `localStorage`. iOS-safe.
- `clearParseCache()` (from `reader.js`) — wipes the AST cache.
  The two caches are independent layers; clearing one does not
  affect the other. `_stats()` now reports `body_cache_size`.

### §9.3 Code-split chunks

Each `.sks` ships as its own Rollup chunk. The dev-mode Vite server
serves the same shape via HMR. The studio's run-on-keystroke loop
hits the body cache after the first load; the dispatcher's re-entry
path (chat history replay, repeated dispatch on the same chip) hits
the AST cache (§4.1) on top.

### §9.4 O(1) cart loader API

`findBy({tier, verb, surface, category, dir, wired})`,
`byVerb(verb)`, `byTier(tier)`, `bySurface(surface)`, `cartBySlug(slug)`
(`curator-web/src/scheme/cartLoader.js:83-104`). The studio uses
these for filtering; Sakura uses them via the breadcrumbs JSONL.

`_stats()` reports `cart_count`, `generated_at`,
`lazy_chunks_resolved`, `cache_hits`. Useful for the studio's
diagnostic panel.

---

## §10. Sakura's access pattern (the LLM consumer)

Sakura (the on-device LLM persona) does NOT load cart sources to
choose what to do. The path is index-first.

### §10.1 Index-first O(1) lookup

`getCart(slug)` is O(1) over the frozen index Map
(`curator-web/src/scheme/cartLoader.js:27-29`). Sakura sees the
cart's `verbs[]`, `title`, `desc`, `tier`, `category`, `trigger`,
`wired` flag without fetching the body. The body load is deferred
until the dispatch decision is final.

### §10.2 Breadcrumbs — natural-language → slug

`curator-web/src/scheme/sakura-cart-breadcrumbs.json` is the
runtime natural-language lookup. Sakura's intent classifier reads it
without retraining; add a cart → regen → breadcrumb available
immediately.

### §10.3 Sakura corpus JSONL — intent→slug training pairs

`curator-web/src/scheme/carts/sakura-corpus.jsonl` is the training
artifact. One pair per line; format optimized for fine-tuning
Sakura's on-device weights. Trained intent→slug pairs land here so
the model knows "operator says rebrief → cart `daily-trend-radar`".

> **RULE:** The corpus and the breadcrumbs share one source (the
> on-disk `.sks` set, regenerated by the same build script). Drift
> between them is impossible by construction.

### §10.4 Routing pipeline (intent → verb → cart → result)

```
[FLOW CHART: §10.4 — Sakura's routing pipeline]

  intent (voice/chat)
    ↓
  breadcrumbs lookup        ── natural-language → slug
    ↓
  getCart(slug)             ── O(1) on frozen index
    ↓
  verb-perm check           ── caller-tier filter
    ↓
  loadCart(slug)            ── lazy body fetch
    ↓
  dispatchScheme(src, …)    ── the gate (§6)
    ↓
  driveCart → executeAct    ── the spine (§7)
    ↓
  outcome envelope          ── done | escalate | wait | interrupted
```

If no breadcrumb matches and no slug-verb composition can satisfy the
intent, Sakura escalates with `(escalate 'no-cart-for-intent
'(:intent "<request>"))` — she does not improvise a one-shot cart
that bypasses the corpus.

> **RULE:** Sakura is NOT authoring Scheme at runtime on the
> operator's device. The corpus is closed; the verbs are gated; the
> cart bodies are lazy-loaded only when chosen. The cloud-tier path
> (`lacuna/ask`) is the one place Scheme is *generated* fresh — and
> that is what §12's per-session cache pattern is built around.

---

## §11. Browser budgets

This section names the four budgets the runtime enforces in the
browser, the components that own them, and the degradation policy
when each is exceeded. Exact numbers move; the shape of the budget
does not.

### §11.1 Compute budget — per-frame ms cap

The substrate runs in a `requestAnimationFrame` loop with a per-frame
ms ceiling. Cart-driver state transitions, verb dispatches, paint
primitives, and macro expansions share the frame. The
`animation/budget` verb
(`curator-web/src/scheme/primitives/runtime.js:61-105`) reports the
current frame budget; a primitive can query it before kicking off
expensive work.

> **RULE:** A single verb body must NEVER exceed half the frame
> budget. Long work is split across `act` descriptors so the driver
> can interleave with the rAF loop.

### §11.2 Memory budget — heap watermarks

The AST cache is capped at 256 entries (§4.1); the cart body cache is
unbounded but pinned to the lifetime of the dispatch session; the
`CartBus` listener registry is cleaned per cart on `CART_END`.

Sakura's on-device model owns its own heap budget (managed in
`~/code/forge/`); the engine treats the model as an opaque verb
target via `(model/workhorse …)`.

### §11.3 Power tier — animate / quarter / paused

The substrate publishes a power tier via `canvasPower.getTier()` —
`animate` (full), `quarter` (reduced frame rate), `paused` (battery
critical / Reduce Motion). The dispatcher gates verbs whose
`powerTier` requirement is above the current tier
(`curator-web/src/scheme/runtime/dispatch.js`). The cart driver
honors Reduce Motion by skipping the animate-class `act`s while
still progressing the state machine — the operator sees the cart
finish, just without the visible motion.

> **RULE:** Reduce Motion must NEVER silently skip a result-state
> transition. The "iOS Reduce Motion silently skips draw" bug
> (caught only because the bench was screen-recorded) is the
> standing reminder: the visual-golden gate is mandatory for any
> paint primitive.

### §11.4 Cost budget — cloud verb spend per session

Cloud verbs (`(lacuna/ask …)`, `(model/workhorse …)`,
`(web/search …)`, `(documents/parse …)`) cost real dollars per call.
The L1 session pattern (§12) caches the system + tool-defs prefix so
per-turn cost is dominated by output tokens. The ledger in
`.cart-writer-ledger.jsonl` carries the per-call cost; summing it
per-operator gives the per-session spend.

The five color tiers and their per-call cost envelopes:

| Color | Capability verb | Routes to | Per-call cost floor |
|---|---|---|---|
| `white` | (no LLM — atomic tool) | local | $0 |
| `pink` | `(model/local …)` | on-device 8B (Sakura) | $0 |
| `green` | `(model/fast …)`, `(vision/embed …)`, `(web/search …)` | cloud assist (green) | ~$0.0001 |
| `light-purple` | `(model/workhorse …)` | cloud reasoning (light-purple) | ~$0.005 |
| `deep-purple` | `(model/deep …)` | deep reasoning (deep-purple) | ~$0.05 (floor); up to ~$2.00/run for dossier-grade outputs |

`deep-purple` is the strategy-consultant tier — multi-step reasoning,
ensemble orchestration, document grounding with citations, dossier
outputs. The directory `curator-web/src/scheme/carts/magic/` is the
authoritative home for these carts; `scripts/build_cart_index.mjs`
applies a directory-based tier override (see `DIR_TO_TIER` in that
file) so a magic-dir cart's index entry is `deep-purple` regardless
of what its `;;~ flavor` doc-block header claims. Budget envelope:
~$50/month/operator at typical usage.

### §11.5 Cache strategy

Three caches stack:

| Cache | Layer | Lifetime | Hit shape |
|---|---|---|---|
| AST cache | reader.js (256-entry LRU) | process lifetime | source string → parsed AST |
| cloud LLM ephemeral cache | cloud LLM (5-min default, 1-hr extended) | per-session | system+tool-defs prefix |
| Cart body cache | cartLoader.js | process lifetime | slug → source string |
| Breadcrumb cache | sakura-cart-breadcrumbs.json (eager) | process lifetime | intent prefix → slug list |

The cloud LLM ephemeral cache is the load-bearing one for L1 cost. See §12.2.

---

## §12. Per-session LLM prompting strategy

When Sakura (on-device, L0) or the L2 vendor reasoning service generates a `.sks` cart,
the prompt shape and the validator chain are themselves load-bearing.
This section documents the contract used by `scripts/write_carts.py`
and the equivalent in-app Ask-Sakura path.

### §12.1 Four-block prompt (system / cart-corpus / user-intent / output-format)

A cart-writer system prompt is structured as four blocks, three of
them cache-anchored
(`scripts/write_carts.py:85-126`):

1. **Header (uncached)** — the three commitments + output format
   instruction. ~700 tokens. Lives uncached because it occasionally
   changes when we add a new commitment.
2. **Writer prompt pack (cached)** — the grammar.
   `docs/WRITER-PROMPT-PACK-2026-06-15.md` is the canonical writer
   spec: descriptor verbs, header keys, doc-block structure, error
   grammar enum, scout-label canon. ~7k tokens.
3. **Exemplar 1 (cached)** — one full canonical cart
   (`curator-web/src/scheme/carts/cron/daily-trend-radar.sks`). ~5k
   tokens.
4. **Exemplar 2 (cached)** — a second exemplar for shape variance
   (`curator-web/src/scheme/carts/cron/daily-buyer-question-digest.sks`).
   ~5k tokens.

The user message is the spec only — slug, tier, flavor, save_dir,
operator-voice description, optional notes
(`scripts/write_carts.py:129-147`).

### §12.2 Three cached blocks (prompt caching, 5-min TTL)

Every call from Curator's backend to the L2 vendor reasoning service uses
the vendor's prompt caching with `cache_control: {type: 'ephemeral'}` at a stable
breakpoint. The three big static prefixes carry the cache breakpoint;
the header is small enough to leave uncached.

```
[FLOW CHART: §12.2 — session cache flow]

  session.open(operator_id)
    ↓
  cached prefix = operator-id + session-system + cart-bound system + recent-N-turns
                  cache_control = {'type': 'ephemeral'} at breakpoint
                  TTL = 5-min default OR 1-hour extended (Magic tier + ≥2k system tokens)
    ↓
  session.turn(operator_id, delta)
    ↓
  send ONLY the delta (new user message + new tool args)
  cached prefix served from the vendor's cache at 10% of base input
  output paid full
```

The first call pays the 1.25× cache-create premium; calls 2…N within
the TTL window pay 0.10× on the cached prefix. The collapse is
roughly an order of magnitude reduction in per-call input cost after
the first call (see `docs/L1-ORCHESTRATION-DESIGN.md:122-127`).

#### TTL + eviction

Two clocks (`docs/L1-ORCHESTRATION-DESIGN.md:92-96`):

- **Cache TTL** — the vendor's 5-minute default covers most reflex
  turns. 1-hour extended cache only on Magic-tier sessions with
  ≥2k system-prompt tokens.
- **Idle TTL** — 30-minute wall-clock since `last_used`. After that
  the session moves to `paused`; the rolling tool transcript is
  summarized to a single `props.summary` structured blob.
- **Hard TTL** — 7 days. Session → `checkpointed`. Resume re-hydrates
  from the checkpoint summary (not the full transcript —
  deterministic by construction).

### §12.3 Validator chain (lint after egress)

The model's response is NEVER trusted as-is. Every cart passes
through:

1. **Shape check** — `looks_like_cart(text)`
   (`scripts/write_carts.py:156-165`): must start with `;;~ title`,
   must contain `(cart '`, must contain `(define (`. A failure logs
   `status: error, reason: shape-invalid` and the file is NOT written.
2. **Cart lint** — `cartLint(source)`
   (`curator-web/src/scheme/cartLint.js:26-134`). The Star-1
   pre-execution gate (catches the §8.1 shape violations).
3. **Cart-index regen** — `node scripts/build_cart_index.mjs`. Output
   is deterministic.
4. **Execution smoke** — `executeAllCarts.test.js` runs every cart
   against the appropriate runtime path with fixture envs. A throw
   counts as a failure.
5. **Visual-golden gate** — for any cart that paints, a snapshot
   golden lives in `__snapshots__/`. Unit tests + dispatch-returns-ok
   are NOT sufficient evidence of visibility.

### §12.4 Cost ledger discipline

Every API call writes one JSONL row to `.cart-writer-ledger.jsonl`
(`scripts/write_carts.py:168-186`). Schema includes `ts`, `slug`,
`model`, `save_path`, `status`, `in_tokens`, `cache_create`,
`cache_read`, `out_tokens`, `cost_usd`, `duration_ms`, `error`.
Running cost summable via `jq -s 'map(.cost_usd) | add'`.

The first call in a parallel run is forced serial to warm the cache
before the workers fan out
(`scripts/write_carts.py:349-377`). The parallel workers then hit
cache_read on every subsequent call.

> **RULE:** The session cache is part of the architecture, not an
> optimization. There is no "send a one-shot call without caching"
> path. Operator-id is part of the cache key; sessions never
> cross-leak between operators.

---

## §13. The cart-writing procedure

This section is the canonical engineering procedure for adding carts
at scale — for engineers and for future LLM sessions that need to
reproduce the workflow. It is the "if this breaks an LLM can read
that and rebuild it" section the owner directive calls for.

### §13.1 Spec builder pattern (read design docs → dedup → JSONL)

The spec builder reads the architecture/design docs (e.g.,
`docs/L1-ORCHESTRATION-DESIGN.md`, the cart corpus design notes),
extracts cart-spec rows (slug, tier, flavor, save_dir, description,
notes), deduplicates against the on-disk `.sks` set
(`curator-web/src/scheme/carts/**/*.sks`), and emits a JSONL of
specs the writer consumes.

```
[FLOW CHART: §13.1 — spec builder pattern]

  design docs (.md)
    ↓
  extract cart-spec rows  (slug, tier, flavor, save_dir, …)
    ↓
  dedup against on-disk corpus (skip slugs that already exist)
    ↓
  emit JSONL of new specs (.jsonl, one spec per line)
    ↓
  writer reads JSONL → §13.2
```

### §13.2 Writer pattern — `write_carts.py` with caching + concurrency

`scripts/write_carts.py` is the canonical writer. Shape:

1. Load the four-block system prompt (§12.1). Three blocks
   cache-anchored; header uncached.
2. Read the spec JSONL one line at a time.
3. For each spec:
   - Build the user message (slug, tier, flavor, save_dir, intent).
   - Call the LLM with the cached system prompt + user message.
   - Validate the response (`looks_like_cart` → cartLint).
   - On valid: write the `.sks` to disk at `save_dir/<slug>.sks`.
   - Append a ledger row to `.cart-writer-ledger.jsonl`.
4. The first call is forced serial (cache-warm); workers fan out
   after the first row.

> **GUIDANCE:** The cache-warm step is load-bearing. If you parallel-
> fire the first batch, every worker pays the cache-create premium.
> Serial first call + parallel rest is the cost-correct shape.

### §13.3 Lint pattern — `cartLint.js` Star 1 invariants

`cartLint(source)` runs after every cart write (§12.3). The same
Star-1 invariants run pre-commit via the hook and at runtime via the
driver's `checkInvariants` step. The Python mirror in
`sakura_tools.py _validate_cart_text` re-implements the same checks
server-side at the HTTP boundary.

### §13.4 Index regeneration — `build_cart_index.mjs`, deterministic

After a batch write, `node scripts/build_cart_index.mjs` regenerates
the four index artifacts (§8.2). Re-running against unchanged disk
state yields byte-identical files.

### §13.5 Tier manifest pattern — auto vs hand-curated, sentinel comment

The build script reads each tier's `manifest.js` for the sentinel
`// hand-curated: do not regenerate`. Auto-only dirs (`imagine`,
`pink`, `magic`) get regenerated; the five hand-curated dirs
(`etsy`, `google`, `personal`, `scenes`, `transfer`) are preserved.

### §13.6 Reproducibility

The end-to-end property: the same on-disk state always yields the
same outputs across spec-builder → writer → lint → index → manifest.
A LLM session in 2027 with this manual + the repo + an API key
should be able to reproduce the cart corpus byte-for-byte.

> **RULE:** Any procedure step that breaks reproducibility is a
> defect. If the model output is non-deterministic (temperature > 0,
> top-p < 1), the procedure pins the seed and records it. If the
> filesystem walk is order-dependent, the procedure sorts.

---

## §14. Interactions with other subsystems

This section names the boundary contracts with every other major
subsystem in Curator + Lacuna. Each subsection is the seam — the
verbs, primitives, or events that cross. Detailed semantics live in
the partner doc named.

### §14.1 Paint kit — `paint-*` primitives, overlay clock binding

Paint primitives (`paint-arrow`, `paint-heart`, `paint-point-at`, …)
are first-class graphics verbs Sakura speaks without confusion.
Installed via the surface-graphics installer; bound to the overlay
clock so animation timing is deterministic (`fx/easings.js`
twinned-tokens, see HelloSurface §11–§12). Address-aware: accept
`card`, `anchor`, `sprite`, `edge-run` addresses, not raw pixels.

### §14.2 Cards — manifest v2, address-aware verbs

Every card publishes a manifest (kind/address/verbs/data-schema/
accepts/emits/tier); the dispatcher reads the manifest to validate
address kinds against the verb's `acceptsAddress`. Cross-ref
HelloSurface §20 (Manifest Contract v2) and §21 (Inter-Card API).

URL deep-links via `#card/<kind>/<instance>[/verb]` — the external
caller tier (§6.2) reaches the dispatcher through this path; the
hash-router normalizes to a `dispatchScheme` call with `caller =
external`.

### §14.3 Cortex — recall / cosine-topk / walk / write / forget

Cortex verbs:

- `(cortex/recall <query>)` — semantic recall against the operator's
  on-device graph.
- `(cortex/cosine-topk <embedding> <k>)` — direct embedding query.
- `(cortex/walk <node-id> <depth>)` — graph walk from a seed.
- `(cortex/remember <fact>)` — append a fact node.
- `(cortex/forget <node-id>)` — forget-filter; the Rust Cortex
  enforces byte-identical round-trip (memory: "Rust Cortex parity
  achieved 2026-06-14").

**On the wire.** Every Cortex verb reads or writes SLAT records.
`cortex/recall` returns `cortex-slice` slats; `cortex/remember`
canonicalizes the incoming value with `slat/canonical` before write
so content-id is stable. See CORTEX §SLAT for the slice, snapshot,
delta, and signed-envelope shapes; see §SLAT below for how the
runtime hands slats to the reader.

Cross-ref HelloSurface §30 (Cortex), §31 (Cortex Budgets), §32
(Engram).

### §14.4 Marketplace verbs — `etsy/` `ebay/` `shopify/` `meta/` `ig/` `google/`

Marketplace names stay literal (per `CLAUDE.md` "Vendor naming"). The
verbs are gated under `perm: 'state-change'` or `perm: 'financial'`
depending on the operation. The backend (Python operations layer)
holds OAuth tokens and translates verbs to platform API calls. Sakura
never sees the OAuth token; she sees an opaque `:shop-id` address.

Cross-ref HelloSurface §45 (Vendor Bridge).

### §14.5 Sprite engine — body verbs, named clips, magic effects

The sixteen-sprite roster (HelloSurface §15) is addressable from
Scheme. Body verbs (`sprite/move-to`, `sprite/wave`, `sprite/carry`)
compose with named clips (the eight magic reactions, HelloSurface
§17). Clip selection is via the noun-ranker corpus slice
(HelloSurface §15.2).

### §14.6 Sakura on-device LLM — decide / emit-structured / dream

The on-device model exposes three primitives:

- `(sakura/decide <intent>)` — route an intent to a slug.
- `(sakura/emit-structured <schema> <intent>)` — produce a structured
  JSON output against a schema (the in-app equivalent of the cart
  writer's output-format block).
- `(sakura/dream)` — the background loop that picks a recent Cortex
  noun and paints a thought bubble (the NORTH STAR per memory:
  "Sakura dreams from Cortex").

Cross-ref `docs/SAKURA-LLM-CANONICAL.md`.

### §14.7 Lacuna substrate — subAgent.spawn, document.cite, ensemble.run

Held until shipped: the L2 orchestration layer
(`docs/L2-ORCHESTRATION-DESIGN.md`) introduces three verbs that
delegate to Lacuna 14B (the support model):

- `(lacuna/sub-agent <task>)` — spawn a worker that returns a result.
- `(lacuna/document-cite <claim>)` — produce a citation from
  Lacuna's document index.
- `(lacuna/ensemble <verbs>)` — run a verb ensemble for robustness.

These verbs are NOT registered today. They land when L2 ships.

**On the wire.** When these ship, cross-substrate delegations move as
`message` slats through mailboxes (SLAT §5.8) with signed capability
envelopes (SLAT §6.5). See LACUNA-INTEGRATION §SLAT for the
mailbox/message shape.

> **GUIDANCE:** When L2 lands, this section updates with file:line
> anchors. Until then, the contract is forward-looking and any cart
> referencing these verbs lints clean only because they pass the
> "unknown-verb in locals" filter — which is wrong long-term. Add
> the verbs as `service-not-yet-wired` shims before any cart
> references them.

### §14.8 Knowability layer — registry, knowledge broker, world-knowledge resolver

Three interlocking mechanisms let Sakura learn WHAT the world holds
without retraining her weights on the facts themselves. The weights
teach the *pattern* of asking; the data lives in a database, a manifest,
or a live query. This is the "weights teach HOW, registry+cortex teach
WHAT" split (see `[[sakura-capability-registry-2026-06-30]]` and
`[[project_category_knowledge_broker_2026_07_01]]`).

**Layer 1 — capability registry (`system/registry`).** So Sakura is not
retrained for every new game, cart, verb, or studio, she queries
`(system/registry :domain X)` where `X ∈ {games, cards, automations,
verbs, studios, features}`. Companion verb `system/capabilities`.
Wired-state: both are honest-null **stubs** today —
`base.js:712` (`system/registry`) and `base.js:713`
(`system/capabilities`) return `{ kind: 'escalate', reason:
'service-not-yet-wired' }`. Real backing lands with the L1 wire-call.

**Layer 2 — category knowledge broker (`knowledge/of`).** A three-tier
knowability facade:

1. **Ambient** (~500 tok) — her state / session / mood / tier, always
   in the prompt. Built by `ambientContextBuilder.js`
   (`curator-web/src/scheme/knowledge/ambientContextBuilder.js`, 413 lines).
2. **Query-on-demand** (`knowledgeOf(category, params)`,
   `knowledge/knowledgeBroker.js:45`, 344 lines) — caches per-category
   with TTL (`staleAfter`), dispatches to backend on miss, emits
   telemetry (`emitConsulted`), and returns an honest `KnowledgeResult`
   with `{ value, source, confidence, staleAfter, reason }`. Unknown
   categories return `honestNull('unknown-category', …)` — never a
   confabulated value.
3. **Category manifest** (`knowledge/categoryManifest.js`, 1,215 lines) —
   the master list of every knowable category (`sakura-tier`,
   `sakura-model-state`, `world-knowledge`, session/mood/cart slices,
   marketplace state, …). Each entry declares `queryVerb`, `slot`,
   `cadence`, `ambient`, `tokenBudget`, and `tier`. Adding a category
   here makes it queryable the same second, no retrain.

Wired-state (honest): the broker, manifest, and ambient-builder are
**landed but not yet wired into the evaluator** — no `knowledge/of`
verb is registered in `base.js`, and nothing outside
`scheme/knowledge/` imports these three modules yet. They are a complete,
tested-in-isolation subsystem awaiting the dispatch-layer bind (a verb
def that calls `knowledgeOf` + a prompt-builder call to
`buildAmbientContext`). Recorded as landed-unwired so the training
corpus is not misled into treating `knowledge/of` as live.
<!-- LIVING:TODO(2026-07-01): wire the broker — register a `knowledge/of`
     verb in base.js that delegates to knowledgeBroker.knowledgeOf, and
     call ambientContextBuilder from the per-session prompt assembler.
     Until then this is landed-unwired, not live. -->

**Layer 3 — world-knowledge resolver (`world/knowledge`).** The
catch-all for trivia + emerging news Sakura doesn't already hold
("Knicks won. Who are the Knicks? Where is Albania?"). Design (per the
`base.js:408-433` contract block): check the operator's Cortex
world-knowledge slot first → on miss, L1 8B round-robin (world-knowledge
in weights) → fall back to `web/search` + L2 reasoning for time-sensitive
queries → **write the result back** to the Cortex slot so future recall
is close-to-paren (no re-fetch). Companion associative verb
`cortex/associate` (`base.js:714`). Wired-state: `world/knowledge` is a
defined honest-null **stub** at `base.js:425` (returns
`service-not-yet-wired`); the `world` namespace is whitelisted in
`VerbRegistry.js:120` so the stub registers cleanly. Real backing is the
backend `world_knowledge.py` wire-call — the only place a vendor
identifier for this path may appear, per the naming firewall.

> **Why the three-layer split matters for training.** If world facts,
> category values, or capability lists were baked into weights, every
> new cart or headline would need a retrain and every stale fact would
> be a fluent-wrong liability. Instead the weights learn the *shape* of
> the three query verbs; the answers are fetched live and cached in
> Cortex. This is the architectural expression of "honest-null over
> fluent-wrong" at the knowledge layer.

---

### §14.7 Music-ingest lane — score/audio → canonical `.sks` (#512–#517)

An operator hands Sakura a source — a scanned page, a hummed melody, a
MusicXML export, or an already-authored `.sks` — and the lane lowers it
to the *same* canonical `(score (part (phrase …)))` the render substrate
already speaks. Six phases, each additive and default-OFF; a phrase
authored the old way (no new markers) lowers **byte-identical** (the §0
invariant, guarded by `sound.test.js` + the pinned no-marker determinism
case in `orchestraElectric.test.js`).

**P0 — the orchestration seam (#512).** `curator-web/src/scheme/musicSugar.js`
gained additive lowering fields — per-part `instrument`, per-note `vel`,
section size, top-level `tempo-curve`, `reverb`/`hall` — each stamped onto
the lowered spec *only when its marker is present* (default-OFF). The
`{pitch,dur,voice?,at?,instrument?,vel?}` note spec carries them; `at` is
reserved for tempo control points, never a note onset. `curator-web/tools/scoreToVoices.mjs`
is the adapter that turns a lowered score into the offline renderer's
voice list; `render_chopin.mjs` / `render_beethoven7.mjs` are now thin
callers over it. **Rests are omitted from `spec.notes[]`** — `lowerVoice`
advances the time cursor for a rest but never emits it as a note.

**P1 — instrument registry (#514).** `curator-web/src/scheme/instrumentRegistry.js`
adds `(define-instrument)` and `(mod-instrument)`. An instrument is a
named DSP profile (family `struck|bowed|wind`, partial structure, envelope,
formants, pan, optional electric `drive`). A `mod` is a **pure
profile→profile delta over a frozen base** — skip-not-clobber, and the 11
seed profiles cannot be shadowed (`isSeed` guard). `validateProfile()`
rejects a malformed profile; an unknown instrument escalates
`'instrument-not-registered`, a mod that would not render escalates
`'mod-would-not-render` — honest-null, never a silent fallback voice. The
`instrument`/`section`/`define-instrument`/`mod-instrument` verbs are
whitelisted in `dialectConformance.js`.

**P2 — electric render stage (`curator-web/tools/orchestra.mjs`).**
`applyElectricStage(buf, n, sr, drive)` runs only when a profile carries a
`drive` block: an RBJ-cookbook biquad pickup bandpass → one-pole tone tilt
→ `tanh` soft-clip (normalized by `1/tanh(k)`) → cab formant biquads. No
`drive` → exact no-op (the acoustic path is bit-for-bit unchanged, proven
by the drive-less-clone comparison). Two FOSS profiles land params-only
(no embedded samples): `clean-strat` (single-coil) and `les-paul`
(humbucker). **License discipline:** parameters only — SoundFont banks,
DX7 patches, and GPL clones (Dexed, Guitarix) are rejected for embedding.

**P3 — OMR codegen (#515).** `scripts/musicxml_to_scheme.mjs` is a
dependency-free MusicXML→`.sks` scanner (`musicXmlToScheme(xml, opts)`).
Flats fold to sharp enharmonics; `<chord/>` runs collapse; a low-confidence
or unreadable measure becomes a `(rest)` with a `; UNCERTAIN(measure N)`
breadcrumb, **never a guessed pitch**. Unrecognizable input mints no `.sks`
and escalates `'score-not-recognized`. Default engine breadcrumb `oemer`
(MIT). **Audiveris (AGPLv3) is HOLD — never linked.**

**P4 — AMT codegen (#516).** `scripts/amt_events_to_scheme.mjs`
(`amtEventsToScheme(input, opts)`) maps a neutral note-event contract
(`{pitchHz|pitchMidi, onsetSec, durSec, velocity?, confidence?}` + tempo)
to a sequential phrase, inserting gap-filling rests to preserve absolute
onset (no `at` markers). `LOW_CONF=0.5` → a `; LOW-CONF(0.NN)` comment;
`REST_FLOOR=0.25` → a `(rest)` instead of a fluent-wrong pitch. Silence or
all-below-floor mints no `.sks` and escalates `'no-notes-detected`. Tempo
is flagged `; tempo-estimated` so the operator knows it's inferred. Engine
breadcrumbs `basic-pitch` (Apache-2.0) · `librosa` (ISC) · `CREPE` (MIT).

**P5 — the ingest router (#517).** `curator-web/tools/ingest_score.mjs`
(`ingestSource(source, opts)` + `classifyMedia(...)`) classifies media by
extension + content sniff, routes image→OMR, audio→AMT, musicxml→OMR
codegen, events→AMT codegen, and passes an authored `.sks` straight
through — each stamped with provenance breadcrumbs (`; ingest-source:`,
`; ingest-kind:`, `; ingest-confidence:`, `; ingest-date:`). The ML
engines are **not invoked here**: `transcribeImage` / `transcribeAudio`
are injected hooks (integration-pending); with no engine wired a raw
image/audio returns `'transcriber-not-available`. Persistence is an
injected `saveArtifact` callback — **NO artifact is saved on any escalate
path** (spec §C.4/§D.4/§E.1).

**P6 — corpus-prep staging (`scripts/stage_ingest_corpus.mjs`).**
`stageIngest(ingestResult, meta)` returns a staged pair or `null`;
`stageBatch(items)` reports why each was excluded. **PREP ONLY — no
training fires.** The filter is the load-bearing discipline: only
high-confidence (`STAGE_CONF = 0.85`, stricter than the render floors),
**human-verified**, uncertainty-free OMR/AMT ingests enter the corpus.
Excluded (each a named reason): honest-null (`ok:false`), unverified,
below-bar confidence, ANY uncertainty breadcrumb (`hasUncertainty()`
matches `UNCERTAIN(` / `LOW-CONF(` / rest-for-dropped markers), and
authored passthroughs. This guarantees the corpus only ever holds scores
a human confirmed are right, so training on it can never bake in a
transcription error.

> **Integration-pending, stated plainly.** The codegens and router are
> built and unit-tested against fixtures; the OMR/AMT ML engines are not
> installed and are never invoked from this repo. When they land (their
> own lane), the injected `transcribeImage` / `transcribeAudio` hooks fill
> the intermediate and the rest of the flow is unchanged. FOSS attribution
> (oemer · Basic Pitch · librosa · CREPE) belongs in `NOTICE` at
> engine-integration time, not in operator-facing copy.

---

## §15. Test discipline

Five gates, each with a different blast radius.

### §15.1 cartLint — Star 1 invariants

`curator-web/src/scheme/cartLint.js` runs on every save. Catches
shape violations before any code runs. The Python mirror in
`sakura_tools.py _validate_cart_text` runs the same checks
server-side at the HTTP boundary. Fast: ~5ms per cart.

### §15.2 Vitest unit tests

Each module has a `*.test.js` sibling. The cart-driver test
(`cartDriver.test.js`), the dispatcher tests (`dispatch.test.js`,
`dispatch.audit.test.js`, `permAudit.test.js`), and the interp tests
(`interp.tco.test.js`, `interp.freeze.test.js`) are the load-bearing
ones. The interp tests verify TCO is real and the freeze gate blocks
substrate override.

### §15.3 executeAllCarts (sim harness)

`executeAllCarts.test.js` walks every shipped cart and runs it
through the appropriate runtime path (driveCart / runSurface /
runWithCards / run). A throw counts as a failure.

Note on test pool: the file runs with `--pool=forks` because the
shared V8 heap hits the default ceiling on the full sweep. Per-file
process isolation lets V8 GC between batches
(`curator-web/src/scheme/executeAllCarts.test.js:33-44`).

### §15.4 Visual-golden gate (the iOS Reduce Motion lesson)

Any cart that paints a sprite, flower, or Sakura on screen ships
with a snapshot golden under `__snapshots__/`.

> **RULE:** Unit tests + dispatch-returns-ok are NOT sufficient
> evidence of visibility. The "iOS Reduce Motion silently skips
> draw" bug was caught only because the bench was screen-recorded.
> The visual-golden gate is mandatory for paint primitives.

#### Star 1 invariants

Beyond cartLint, every cart can declare structural invariants via
`(invariants …)`. The driver runs `checkInvariants(…)` on every
transition boundary (`curator-web/src/scheme/cartDriver.js:139-153`).
A violation halts with `invariant-violation` + the invariant name in
the audit line. Invariants are enforced (not advisory) — a cart that
fails an invariant in production halts the run cleanly with a
structured reason.

---

## §16. Editor-side rules — how to extend the language

### §16.1 Adding a primitive

Five touch points, all in the same PR:

1. **The primitive body.** Implement the JS function in the right
   installer (`primitives/motion.js`, `primitives/audio.js`, etc.,
   or a new lane file). Match the existing shape: parse keywords
   via `parseKeywords(rest)`, validate args with `ArgShapeError`,
   return a record or handle.
2. **The Env install.** Add an `env.define(name, fn, meta)` call in
   the installer's `installX(env)` function with a complete meta
   block (`perm`, `namespace`, `determinism`, `summary`, and
   `stateChanging` / `chip` / `returns` as appropriate). For
   slash-form verbs also add the legacy hyphen alias if there is one.
3. **The signature in `coreVerbs.js`** (if it's one of the 15
   minimal primitives) or the lane-specific signature registration
   call (for everything else).
4. **The Reference doc entry.** `docs/REFERENCE.md`
   gets one entry per new verb with signature, one-sentence
   description, effects, and Novice / Intermediate / Expert
   examples.
5. **This Engineering doc entry.** If the new verb introduces a new
   dispatcher gate, a new chip kind, a new perm category, or any
   architectural shape — update the relevant section here.

### §16.2 Adding a verb

A "verb" in Curator parlance is a primitive whose perm is above
`read`. The procedure is the same as §16.1 plus:

- Declare the perm explicitly. The startup validator will throw if
  you forget.
- If the verb is destructive/financial, add a `confirm: true` field
  so the dispatcher requires `operator_confirmed`.
- Add an audit-line test covering the accept and reject branches.

### §16.3 Adding a macro

Add to `curator-web/src/scheme/primitives/macros.js` in the dialect
macro block. Each macro lowers to a composition of the 15 core
primitives, so determinism propagates through expansion. The macro
table is rebuilt at boot via `buildMacroTable`.

> **RULE:** A macro that expands to a non-deterministic primitive
> inherits its determinism class. Do NOT silently re-classify in the
> macro body.

### §16.4 Adding a cart — see §13

The full procedure lives in §13 because it is also a Sakura-side
procedure for LLM authoring. The minimal engineer path:

1. Write the `.sks` file under `curator-web/src/scheme/carts/<dir>/`.
2. Run `npm --prefix curator-web run build:cart-index`.
3. Append the entry to `docs/SAKURA-AUTOMATIONS-1.0.md` in the
   right tier section.

### §16.5 Changing the evaluator

If you change the descriptor enum, the cart-driver dispatch shape,
the audit-line schema, the eight-star wrapper, or any of the FOREVER
CODE paths (`safetyStars.js:1-21`, `eventLog.js:1-49`,
`cartDriver.js:1-30`), the rule is:

- Update `AUTOMATIONS-STATE-MACHINE-CHAPTER.md` (the architectural
  chapter) AND this doc's §7 in the same PR.
- Add a regression test for the specific shape change.
- Run `executeAllCarts.test.js` to confirm no cart's failure
  semantics regressed.

> **RULE:** The eight-star wrapper's shape is not safe to change
> without owner sign-off. Every cart's failure semantics depend on it.

---

## §17. Honest gaps

Honest about what is not yet wired or not yet documented in code.

1. **Worker-thread async port** (`runtime/workerBridge.js:1-28`) —
   scaffolded under a feature flag. The full async port (synchronous
   verb-call resolution via SharedArrayBuffer + `Atomics.wait`,
   COOP/COEP headers, the full async interpreter trampoline) is a
   deliberate follow-up. Today the synchronous main-thread default
   covers every shipping cart.

2. **`model/deep` (deep-class) verb** — referenced in the Reference
   doc plan but not yet present as a registered verb in
   `coreVerbs.js`. The `model/workhorse` (workhorse-class) path is
   wired through `lacuna/ask`; the deep-class path lands when the L2
   orchestration design ships.

3. **Cortex-as-cache** — `(cortex/recall …)` is wired for in-memory
   lookups but the persistent Engram backend is documented in the
   L1 design without a corresponding `cortex` primitive installer
   in `primitives/`. The cart-side path uses the `act` descriptor
   through the backend's `executeAct`; the in-process primitive for
   hot Cortex reads is pending.

4. **Macro-table introspection** — `buildMacroTable` is exported
   but there is no runtime path that queries the macro table from a
   cart. Add a `(macros/list)` verb if a use case lands.

5. **Schema validator** — the per-verb `schema` field in the
   dispatcher's runtime registry
   (`curator-web/src/scheme/runtime/verbRegistry.js:179-184`) is
   wired but not heavily used. Most verbs rely on the
   `ArgShapeError` thrown from the JS body; the dispatcher's schema
   gate runs before the body and could catch shape errors earlier.
   Land schemas opportunistically as new verbs ship.

6. **Hand-curated tier manifests** — five dirs are hand-curated
   (`etsy`, `google`, `personal`, `scenes`, `transfer`,
   `scripts/build_cart_index.mjs:28`). The sentinel discipline
   (`// hand-curated: do not regenerate`) works but is fragile to
   accidental strip — there is no test that fails if the sentinel
   is removed. Add one.

7. **Worker fuzz harness** — the worker today is used for parser
   fuzzing per `workerBridge.js:24-28`, but the actual fuzz harness
   is not in the tree. Add when the next worker session lands.

8. **L2 verbs** — `(lacuna/sub-agent …)`, `(lacuna/document-cite
   …)`, `(lacuna/ensemble …)` are not registered (see §14.7). When
   L2 ships, they land as `service-not-yet-wired` shims first, then
   wire through.

---

## §18. Glossary

One sentence each. Every named component referenced in the manual.

- **AST cache** — bounded LRU mapping source-string → parsed array
  (`reader.js:167-191`).
- **Audit line** — frozen-schema structured event emitted on every
  dispatch accept / reject (`dispatch.js:419-422`).
- **Breadcrumbs** — natural-language-to-slug runtime lookup table
  (`sakura-cart-breadcrumbs.json`).
- **Cart** — a `.sks` file: 4-block shape (header / doc / `(cart 'id
  …)` / state functions).
- **Cart body cache** — slug → source-string memoization in
  `cartLoader.js`. Evict one entry: `clearBodyCache(slug)`; evict
  all: `clearBodyCache()`. In-memory only (no localStorage).
- **CartBus** — pub/sub the driver writes to (`cartBus.js`).
- **`checkInvariants`** — per-transition invariant gate
  (`cartDriver.js:139-153`).
- **Chip** — auto-emitted side-effect envelope (`paint.applied`,
  `motion.applied`, `look.changed`).
- **Closure** — `Closure` instance with fixed params + restParam +
  body + env (`interp.js:174-194`).
- **Corpus** — `sakura-corpus.jsonl`, the intent→slug training pairs.
- **Cortex** — the on-device knowledge graph (see HelloSurface §30).
- **Descriptor** — the cart-driver's uniform `{tag, …}` shape:
  `next` / `done` / `escalate` / `wait` / `after` / `act` /
  `interrupted`.
- **Determinism class** — `deterministic | bounded(N) |
  non-deterministic | unknown` (`VerbRegistry.js:41-50`).
- **Dispatcher** — `dispatchScheme(source, caller, runner)`
  (`dispatch.js:525-590`).
- **`driveCart`** — the cart driver-loop (`cartDriver.js:57-281`).
- **Eight-star wrapper** — `withStars`, the per-state safety spine
  (`safetyStars.js:48-150`).
- **Engram** — per-operator encrypted Cortex replica (see
  HelloSurface §32).
- **`Env`** — Map-based env chain with optional verb meta on
  `define` (`interp.js:48-64`).
- **Fuel** — the trampolined evaluator's step budget
  (`interp.js:251`).
- **Honest null** — `(escalate 'service-not-yet-wired …)` envelope
  for any not-yet-wired primitive backend.
- **L1 session** — the cached LLM session shape
  (`L1-ORCHESTRATION-DESIGN.md`).
- **Locals set** — names defined inside the cart, exempt from
  unknown-verb rejection.
- **Macro table** — boot-time-built dialect macro registry
  (`buildMacroTable`).
- **Manifest** — per-card publication of kind/address/verbs/schema
  (HelloSurface §20).
- **Power tier** — `animate` / `quarter` / `paused` substrate state.
- **Reader** — `tokenize` + `parse` (`reader.js`).
- **Reduce Motion** — `prefers-reduced-motion = reduce` browser
  signal; cart driver progresses without animate-class acts.
- **Sakura** — the on-device LLM persona.
- **`service-not-yet-wired`** — the honest-null escalation kind.
- **Sim runner** — `executeSim` path used when `ctx.mode = 'sim'`.
- **Slug** — the cart's identifier (e.g., `daily-trend-radar`).
- **STATE_CHANGE_PATTERNS** — heuristic catching state-changing
  names without explicit perm (`verbRegistry.js:102-116`).
- **`Sym`** — interned symbol type used as the AST atom for
  identifiers.
- **Tier (caller)** — `system` / `operator-gesture` / `operator-
  voice` / `sakura` / `external` / `untrusted`.
- **Tier (pricing)** — Free / Imagine $19.99 / Dream $59.99 / Magic
  $99.99 (locked, see memory).
- **TrapError** — thrown on malformed descriptor shape
  (`cartDriver.js:288-353`).
- **Verb** — a primitive whose perm is above `read`.
- **`walkVerbCalls`** — structural AST walk collecting Sym-headed
  calls (`dispatch.js:275-339`).

---

## §19. References

Standards, papers, and packages the engine builds on.

### Scheme standards

- **R7RS-small.** Andrew Sokorowski et al., 2013. The dialect
  baseline; §2.1 names the subset we implement.
- **Lisp 1.5 Programmers' Manual.** McCarthy et al., 1962. Lisp-1
  ancestor.

### LLM + tooling

- **L2 vendor prompt caching.** See the wire-call module for the
  vendor-specific link. §12.2 implements the ephemeral-cache pattern.
- **L2 vendor API.** Workhorse-class and deep-class reasoners, used
  via `(model/workhorse)` and `(model/deep)` capability verbs.

### Adjacent Curator + Lacuna docs

- `docs/REFERENCE.md` — per-verb reference.
- `docs/SAKURA-AUTOMATIONS-1.0.md` — cart corpus.
- `docs/TUTORIAL.html` — HTML on-ramp.
- `docs/HELLO-SURFACE-1.0-ENGINEERING.md` — the surface this engine
  drives; §86 carries the surface-side cart contract.
<!-- LIVING:TODO(2026-07-02): docs/L1-ORCHESTRATION-DESIGN.md and docs/L2-ORCHESTRATION-DESIGN.md do NOT exist in docs/ (never committed). They are cited 6× in this doc (L1: ~1357,1361,1424,1898,1954,3256 for the "session cache pattern" / "two clocks" / ":100-152") plus the L2 entry below. Candidate current homes: docs/TWO-LLM-ANALYSIS-2026-06-19.md, docs/SWEEP-A-REASONING-LLMS-2026-06-29.md, docs/SAKURA-LLM-CANONICAL.md. Human must confirm the correct target then re-point every citation, OR fold the L1 session-cache spec inline here. Flagged by DOC-ROT-SEAL-2026-07-02 parity sweep. -->
- `docs/CART-INDEX-DESIGN-2026-06-15.md` — full cart index design.
- `docs/SAKURA-LLM-CANONICAL.md` — Sakura on-device LLM canon.
- `docs/AUTOMATIONS-STATE-MACHINE-CHAPTER.md` — driver-loop
  architectural chapter.
- `curator-web/src/scheme/SPEC.md` — in-code engine spec (the
  lineage doc).

### Packages

- **Vite** — `import.meta.glob` is the lazy-load mechanism (§9.2).
- **Rollup** — code-splitting per `.sks` chunk.
- **Vitest** — unit test runner with `--pool=forks` discipline
  (§15.3).

---

## §21. Cortex Knowledge Loop

Sakura's persistent intelligence — how she learns about the operator over time without retraining — is specified in full in:

**`docs/CORTEX-KNOWLEDGE-LOOP.md`** — read this before touching any Cortex write path, the context injection system, or the extraction hook.

Summary of invariants this system imposes on the Scheme runtime:

1. **Extraction hook** runs after each conversation turn. It may emit Cortex writes as a side channel of the inference pass. The Scheme runtime must not block or timeout this hook.
2. **Injection block** is prepended to the system prompt at session start. Format: structured `[WHAT I KNOW ABOUT YOU]` block. The Scheme `(cortex/inject)` verb handles this — do not inline Cortex reads elsewhere.
3. **Gap invariant**: empty Cortex slots must be passed through as `[unknown]` — never omitted, never filled with a guess. The Scheme `(cortex/get key :default :unknown)` pattern enforces this.
4. **World knowledge** (how Etsy works, domain facts) lives in model weights. **Personal knowledge** (this operator's pet, birthday, revenue trend) lives in Cortex. Never conflate these layers.
5. **Privacy hard invariant**: raw Cortex personal facts never leave the device. LOAM services on Fly receive aggregated signals only.

Scheme verbs (registered in VerbRegistry):
- `(cortex/get namespace key)` — read a fact, returns `[unknown]` if missing
- `(cortex/set namespace key value confidence)` — write a fact with versioning
- `(cortex/inject)` — returns the formatted injection block for system prompt
- `(cortex/facts namespace)` — list all current facts in a namespace

---

## §X. Two-mode animation engine (2026-06-21)

The owner's "walk away" refinement (2026-06-21) split the canvas's
motion into **two crisply-separated modes**. The split is load-bearing:
the same primitive that paints whimsy MUST NOT also paint utility
progress, and vice versa. Conflating them re-creates the slot-machine
UX the Jess floor (§AC dependency below) was built to prevent.

### §X.1 Mode A — zen activity bar (utility-only)

The rainbow activity bar paints on a card's CardTemplate chrome strip
while a long action is in flight. No sparkle, no whimsy, no celebration —
just honest "something is happening here, this is its progress."

- **Public API:** `beginActivity / updateActivity / endActivity /
  subscribe / snapshot` — `curator-web/src/lib/cardActivityBus.js:48-205`.
- **Verb bindings:** `card/activity`, `card/activity-progress`,
  `card/activity-done` — `curator-web/src/scheme/cardVerbs.js:1086-1148`.
- **Merge semantics:** multiple concurrent activities on one card MERGE
  — the displayed progress is the MAX of explicit values (so a finishing
  fetch doesn't drag the bar backwards when a new one starts at 0); ANY
  indeterminate leg makes the merged bar indeterminate; the bar stays
  visible until the last activity ends (`cardActivityBus.js:82-104`).
- **React hook:** `useCardActivity(cardId)` reads the merged snapshot via
  `useSyncExternalStore` — zero work when no activity is in flight.

The bar is the visual equivalent of an LLM-download progress strip:
indeterminate by default (most carts can't measure progress honestly),
explicit % only when the caller can prove `Content-Length` or similar.

### §X.2 Mode B — whimsy on EARNED completions, adaptive intensity

Whimsy paints (sparkle, glow, bloom, lift, swing, tilt, hearts on first
sale, etc.) fire ONLY on the 6 earned event types in
`celebrationIntensity.js:44-51`:

```
'first-sale', 'listing-published', 'transfer-completed',
'milestone-reached', 'recovery-from-failed-sync', 'weekly-summary'
```

Every whimsy paint asks `intensityFor(operatorId, eventType, scope) →
0..1` BEFORE painting, then `recordFire` after. The decay curve
(`celebrationIntensity.js:58-63`):

```
count 1..3   → 1.0    (new operator, full bloom)
count 4..10  → 0.8
count 11..25 → 0.5
count 26+    → 0.2    (power seller, tiny ack)
```

`paintWhimsy(cardId, eventType, scope)` (`paintWhimsy.js:104`) is the
canonical Mode-B emit helper. Scheme carts invoke it via the
`card-effect` verb (`cardVerbs.js:799-836`) where the 7 base classes
(`glow / pulse / shimmer / sparkle / echo / ghost / bloom`) plus the
2026-06-21 additions (`tilt / lift / swing`) live in the
`CARD_EFFECT_CLASS` table (`cardVerbs.js:758-770`).

### §X.3 The Jess floor (anti-dark-pattern, hard)

Four invariants the engine enforces regardless of caller:

1. **prefers-reduced-motion → ALWAYS 0** — hard trigger
   (`celebrationIntensity.js:122-132`). Mode B paints nothing; Mode A's
   bar still shows because it's utility, not whimsy.
2. **`recovery-from-failed-sync` floor = 0.5** — Jess §4.3
   (`celebrationIntensity.js:70-73`). The operator was stressed; that
   moment is STRUCTURALLY underweighted in the decay curve so they
   never get "now you don't matter" once the curve bottoms.
3. **Operator override wins** — frozen intensity OR off-per-event-type
   via SYS settings (`celebrationIntensity.js:242-271`).
4. **Monotonically decreasing** — Jess §4.2: NO slot-machine random
   surprises (`DECAY_CURVE` is piecewise constant).

The dot substrate (`flowers.js`) is shared by BOTH modes; the gridDot
buffer (`_pendingDots`, `flowers.js:204`) carries Mode-A activity-bar
cells AND Mode-B whimsy paints AND `imagine` glyph rasters AND
`paintConwayViaDotGrid` cells (`scheme/conway.js:1008`). The rAF handle
the flower engine owns is the single clock for every painter.

---

## §Y. Card personality drift — 4-axis Cortex layer

The card personality lane (Multiplier #6) writes 4 axes of per-card,
per-operator drift values to local Cortex over time. The card responds,
never woos. See `lib/cardPersonality.js:1-399` and
`docs/CARD-PRODUCTIVITY-MULTIPLIERS-2026-06-21.md §6`.

### §Y.1 The four axes

| Axis          | What it tracks                            | Drives                               |
|---------------|-------------------------------------------|--------------------------------------|
| `familiarity` | count_30d of opens                        | walk-on cadence (shortens with use)  |
| `pace_match`  | EWMA of operator gesture velocity (ms)    | `--card-pace-ms` CSS var             |
| `directness`  | confirmation_ratio_30d                    | `--card-overshoot` CSS var           |
| `weight`      | revenue trend (USD/day)                   | walk duration multiplier (§AB §4)    |

Each axis lives in `[0, 1]` with baseline `0.5`. Drift is gated until
`DRIFT_GATE_OPENS=7` daily opens (`cardPersonality.js:57`); the per-open
step is `PER_OPEN_STEP=0.02` — monotonically slow by construction.

### §Y.2 Write points

- `recordOpen(cardId)` — ticks familiarity counter, lazily writes
  `count_30d / opens[]` (`cardPersonality.js:`).
- `recordGesture(cardId, velocityMs)` — `PACE_EWMA_ALPHA=0.1`
  smoothing toward `PACE_REFERENCE_MS=1200`.
- `recordConfirmation(cardId, ok)` — updates 30d ratio.
- `recordRevenue(cardId, deltaUsd)` — normalized against
  `WEIGHT_REFERENCE_USD=100` (full weight at $100/day on the card).

### §Y.3 Consumers

- **`card/walk` verb** reads via `read(cardId)`
  (`cardWalkVerbs.js:229-238`), then stamps `--card-weight`,
  `--card-pace-ms`, `--card-overshoot` on the card DOM element
  (`cardWalkVerbs.js:145-154`). `cards.css` keyframes consume them per
  tick (squash + roll + overshoot phases).
- **SYS panel** reads `read / getRawCounters / reset / getOverride /
  setOverride / resetCounters` for live inspection + per-card reset.

### §Y.4 Jess floor (mirrors §X.3)

- Drift never travels in a manipulative direction (no "dramatic
  recovery on revenue-drop" overshoot).
- `pauseDriftWriting()` flips on distress signals (rapid undo, error
  frequency) — writes silent-no-op while paused; reads still return
  current values (`cardPersonality.js:86-92`).
- `prefers-reduced-motion` → `read()` returns baseline (axis effects
  never express in motion the operator asked to suppress).
- **Privacy hard invariant**: drift NEVER leaves the device. The
  storage layer (`accountStorage.js`) is operator-namespaced local
  storage; aggregated signals do not flow to LOAM.

---

## §Z. Trust ladder + chat-chip trust trio

The operator's relationship to Sakura's actions runs on a 3-rung trust
ladder L1/L2/L3 — the "FOR-me / WITH-me / ASKS-me" naming from the
2026-06-21 trust trio batch. Each rung maps to a class of chat chip
the Mode-B animation engine emits AROUND the dispatcher, NOT inside it.

### §Z.1 The three rungs

- **L1 — FOR-me (read).** Sakura ran a read-only verb; the chip carries
  no cost receipt, no disambig prompt, just an honest log line.
- **L2 — WITH-me (state-change / paint).** Sakura is about to make a
  visible change; a cost-receipt chip pre-flights the tokens spent so
  the operator can veto BEFORE the dispatch. Honoured for every verb
  in `verbCosts.js` that costs ≥ 10 tokens.
- **L3 — ASKS-me (destructive / financial / network).** Sakura asks
  explicit confirmation BEFORE the dispatch fires; the disambig prompt
  resolves ambiguity ("did you mean the Etsy or the eBay shop?") and
  the reasoning drawer surfaces the proposed scheme.

### §Z.2 Wiring

- **Cost-receipt chip** — pre-flight read of `tokenCostForVerb(verb)`
  (`verbCosts.js`) emitted as a chip on the chat bus before the
  dispatcher fires; the chip's confirm/veto resolves a Promise the
  dispatcher awaits.
- **Disambig prompt** — fires when the cart's `(card-find-by-kind …)`
  returns >1 candidate AND the verb's perm is `state-change` or
  higher; chip carries the candidates as buttons.
- **Reasoning drawer** — surfaces the proposed scheme (the cart's
  source) under a "show reasoning" accordion. The drawer is read-only;
  edits route to the studio.

The chat-chip bus is `cardEvents.js` (the `verb:'card-effect'` channel
already declared in `CARD_VERBS:38`). Trust trio chips ride the same
channel with `kind:'cost-receipt' | 'disambig' | 'reasoning'`.

---

## §AA. Fleet-wide action engine

`(fleet-do verb args... [:filter pred] [:parallel bool])` is the
operator-facing "do this across every connected shop" verb (Multiplier
#47, ~180 min/week saved per the owner brief). The composition:

```
fleet-do (verb-name positional args + opts)
   → connectedShops.getAllShops(filter)
       → for each shop:
           cardApi.cardDo(shop.cardId, verbName, args, callerOpts)
   ↓
   per-shop progress event (`curator:fleet-action-progress`)
   ↓
   FleetActionStrip subscribes (per-shop chip + aggregate counter)
```

### §AA.1 Parallel vs sequential

- **Default parallel** — every shop's dispatch fires concurrently
  (`Promise.all` over `runOne`).
- **Destructive verbs (perm:'destructive)** — fall back to SEQUENTIAL
  dispatch so a rate-limit / token-revoke on shop A doesn't race shop B
  (`fleetVerbs.js:307-313`). The cart author may override either way via
  the `:parallel` kwarg.

### §AA.2 Single fleet-confirm (NEVER N modals)

Destructive fleet actions need ONE operator confirm covering the WHOLE
fleet — the spec calls per-shop modals "broken UX" (`fleetVerbs.js:38`).
`requestFleetConfirmation(preview)` dispatches a window CustomEvent
(`curator:fleet-confirm-prompt`) carrying `{verb, shopCount, platforms,
dispatchId}`; the resolver listens on `curator:fleet-confirm-result`.
Timeout = REFUSE.

### §AA.3 Per-shop progress strip

`_emitProgress` fires three event phases per fleet dispatch:

- `phase:'begin'` — strip mounts with N pending shop chips.
- `phase:'shop-done'` (one per shop) — chip flips to ok/error;
  aggregate counters tick.
- `phase:'done'` — final summary; strip arms its auto-dismiss timer.

The cart-event log replays a fleet dispatch as a single action with N
per-shop legs (the `verb:'fleet-do'` chip + N `phase:'shop-done'` chips).

### §AA.4 Honest-null contract

- Zero shops match → `['error', 'service-not-yet-wired',
  {verb, reason:'no-matching-shops', hint}]`. Never silent-success.
- Per-shop failure surfaces in that shop's entry; aggregate still
  completes (every shop is touched; operator can retry from the strip).
- Destructive without confirm → `['error', 'operator-denied', …]`. No
  shop is touched.

`runFleet` is exported for direct JS-side composition
(`fleetVerbs.js:290-435`); the Scheme verb is a thin wrapper that awaits
it (`fleetVerbs.js:480-495`).

---

## §AB. Walk grammar — 8 gaits, 12 easings, weight × distance scaling

The card-walk lane (Zane, 2026-06-21) replaces the old "card slides
linearly" feel with 8 named gait curves that read as a chubby person
going somewhere. The verb is `(card/walk id 'gait tx ty [ms])` plus
the 8 gait-shorthand verbs. Spec at
`docs/CARD-WALK-REALISM-ZANE-2026-06-21.md`.

### §AB.1 The 8 gaits

Defined as `{fn, baseMs, overshootPx}` in
`curator-web/src/paint/primitives/cardWalk.js:185-194`:

| Gait            | baseMs | overshoot | feel                                       |
|-----------------|--------|-----------|--------------------------------------------|
| `amble`         | 1000   | 0         | cubic-in-out + one micro-bob (default)     |
| `skip`          | 800    | 0         | spring + 2 hop apexes + 1.06/0.94 squash   |
| `run-and-slow`  | 700    | 8         | accelerated dash, brief overshoot, sigh    |
| `waddle`        | 1250   | 0         | ±2.5° roll + 3 footfall squashes           |
| `bounce-stride` | 900    | 12        | easeOutBack 10% overshoot + 0.92/1.08 land |
| `prowl`         | 1550   | 0         | deep ease-in-out; arrives in stillness     |
| `stomp`         | 800    | 0         | accelerated arrival + 1.18/0.82 landing    |
| `glide-pause`   | 1450   | 0         | 60% / pause / 40% — the "look around"      |

Each gait function returns `{dx01, sx, sy, rotDeg, yBob}` at unit time
`t01 ∈ [0,1]`. `dx01` MAY briefly exceed 1.0 (overshoot) but MUST return
to exactly 1.0 at `t01 === 1.0` so the card lands at the target
(`cardWalk.js:87-89`). No drift, ever.

### §AB.2 The 12-easing palette

Inlined in `cardWalk.js:47-83` to keep gait curves self-contained:
`cubicOut`, `cubicInOut`, `cubicIn`, `easeOutBack(t, 1.70158)` (Penner
default 10% overshoot), `springApprox(t, stiffness, damping, mass)`,
plus six per-gait helpers (linear-fall for stomp's last 30%,
hop-phase sine for skip, half-sine bob for amble, etc.). The
load-bearing palette is `{cubicOut, cubicInOut, cubicIn, easeOutBack,
springApprox}` — the others compose from them.

### §AB.3 Weight × distance × pace scaling

`scaledDuration` (`cardWalkVerbs.js:156-162`):

```
duration_ms =
  base_ms
  × clamp(0.6, distance_px / 200, 2.0)          // distance scale (§3)
  × (1 + 0.15 × (weight - 1))                   // weight (§4)
  × paceScale                                   // personality.pace_match
```

Where `weight = 0.5 + (personality.weight × 1.5)` (range [0.5, 2.0])
and `paceScale = 1.0 − 0.25 × (personality.pace_match − 0.5) / 0.5`
(fast operator → 0.75× duration; baseline → 1.0×).

### §AB.4 prefers-reduced-motion

`_reducedMotionFn()` (`cardWalkVerbs.js:98-101`) → snap via
`cardMove(id, x, y)` at t=0, return `('ok 'snapped {…})` instead of
registering a handle. The verb still emits + returns the honest
envelope so replay sees the intent.

### §AB.5 Test seams

- `_setOverlay(o)` — overlay clock override.
- `_setReducedMotionFn(fn)` — reduced-motion predicate override.
- `_setPositionReader(fn)` — card position lookup override.
- `_setWalkMoverSeam(fn)` — mover override (test recorder).

The verb installs `cardBridge.cardMove` once at install time; the
primitive's per-tick draw calls `mover(id, x, y)` so the SAME
`positionsRef` the renderer reads sees the per-frame update.

---

## §AC. Veo dream-backgrounds (spec — no code yet)

Spec lane only; no runtime impl as of 2026-06-21. The plan: the
Light-purple-tier dream scenes (`dream-60.sks`, `dream-scene-calm.sks`)
gain an optional Veo-rendered background that paints behind the
substrate dot layer. The cart calls a placeholder verb
`(scene/dream-background prompt [:seconds N])` which today returns
`['escalate', 'service-not-yet-wired', {verb, reason}]`; the impl will
land on Magic (deep-purple) tier when the Veo composer is wired.

### §AC.1 Honesty floor

- Dream backgrounds are OPTIONAL. Every dream cart must work without
  one (the substrate Conway + flower engine carries the scene alone).
- The escalate envelope is the wire today — see CLAUDE.md "Honest
  nulls" rule.
- A `prefers-reduced-motion` operator NEVER sees a Veo background
  (Jess §X.3 generalizes — Veo motion is whimsy, not utility).

### §AC.2 Tier gating

The verb's perm is `network` (the Veo render is a cloud call) AND the
cart's flavor MUST be `light-purple` or `deep-purple` (`magic/`). The
dispatcher rejects a Veo call from a `pink` cart with
`['error', 'tier-too-low', {needed:'light-purple'}]`.

### §AC.3 Out of scope today

- The Veo composer itself (a future commit on the Magic tier).
- Per-scene caching of rendered backgrounds (a future commit).
- The SYS preference for "always off / per-event / always on."

---

## §AD. Card-face contract + bottom-sheet menu (2026-06-23/24 roll-up)

The architect's 2026-06-23 directive collapsed three separate per-card chrome experiments (detach chip, inline settings gear, long-press menu) into ONE shared surface every card opens through a uniform MENU button. The Detach chip is retired ("useless"); the long-press menu is retired (collided with gesture FSM); the inline gear is retired (placement fight). What remains is the CardContextSheet.

### §AD.1 — `CardContextSheet` · the one shared bottom-sheet

- **`curator-web/src/components/cards/CardContextSheet.jsx`** (132 lines) — universal sheet. Slides up from the bottom with a 280ms cubic ease, rounded 20px top corners, scrim with blur, X close in header, ESC + swipe-down close on touch, scrollable when items overflow viewport.
- **Props:** `{ open, onClose, title, items: [{ id, icon (JSX), label, detail?, danger?, onClick }] }`. Items render in order; `danger:true` styles the row red.
- **CSS:** `curator-web/src/components/cards/CardContextSheet.css` (154 lines).
- **Test:** `curator-web/src/components/cards/__tests__/CardContextSheet.test.jsx` — 9/9 (open/close, ESC, scrim tap, item click, danger row, swipe-down, ARIA).

### §AD.2 — `SakuraRadioFace` · the new card-face pattern

The standalone face component pattern: a card's resting view becomes its own React component file under `cards/<kind>/<Kind>Face.jsx`. Owns its VFD + menu/open buttons + dot-matrix faces. Drops into the legacy RadioCard via a one-line render swap when approved.

- **`curator-web/src/components/cards/radio/SakuraRadioFace.jsx:1`** (174 lines) — first new-face implementation. VFD readout · MENU (opens CardContextSheet) · OPEN (focus card).
- **`curator-web/src/components/cards/radio/SakuraRadioFace.css`** (235 lines).
- **Tests:** `radio/__tests__/SakuraRadioFace.test.jsx` (8/8).
- **Mount:** `RadioCard.jsx:523` — SakuraRadioFace renders ABOVE the legacy resting view; full A/B by feature-flagging the render call.

### §AD.3 — Authoring rule for the next card-face

When a card's resting view diverges from the default (`CardFrame` header + body), author a standalone face component under `cards/<kind>/<Kind>Face.jsx` + matching CSS file. The face MUST:

1. Render the per-kind chrome (logo + label) using the same `STRIPE` layer pattern as §127 (sibling of `.card-frame__header`, not inside `.card-frame__body`).
2. Provide a MENU button that opens a `<CardContextSheet>` with the card's actions.
3. Provide an OPEN button that focuses the card (delegates to the existing focus mechanism).
4. Test in isolation FIRST (the SakuraRadioFace test pattern), THEN A/B mount above the legacy face.

### §AD.4 — Honest gaps

- **Wired:** SakuraRadioFace renders above the legacy view on RadioCard but the legacy view still ships behind it for fallback. Hard cut is a follow-on commit.
- **Pending-face for other kinds:** the SakuraRadioFace pattern is documented as canon but only the Radio kind has an implementation. Weather, Calendar, Notepad, Messages, Gallery, etc. still use the default resting view + CardStripe combination. Authoring is per-kind work; the pattern is the standard.

### §AD.5 — The 2026-06-23 tier-override consequence

`getOperatorTier()` (`curator-web/src/lib/operatorTier.js:28`) returns `'magic'` unconditionally while `MAGIC_DEFAULT_ENABLED` is true. Carts that previously branched on tier (e.g., `(if (eq tier 'free) ...)`) still execute the branch, but the runtime always sees `'magic'`. **Cart authors:** read tier via the verb, never inline `(if (eq plan 'free) ...)` — the override is centralized in one place for a clean revert. See HelloSurface §128.3 for the wider substrate context.

---

## §AE. The Parser

This section is the definitive read-first for `curator-web/src/scheme/reader.js`. The reader is the smallest layer in the runtime — under 200 lines, no dependencies — and every other layer depends on the shape it produces. If the reader's output drifts, the macro pass, the verb gate, the evaluator, the audit-line schema, and the replay tool all drift with it. Treat the file as a contract.

> "We shall first define a class of symbolic expressions in terms of ordered pairs and lists. Then we shall define five elementary functions and predicates, and build from them by composition, conditional expressions, and recursive definition an extensive class of functions of which we shall give a number of examples." — John McCarthy, *Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I*, 1960, p.184

McCarthy's framing is the design of this file. The reader produces ordered pairs (JS arrays) of atoms (numbers, strings, booleans, interned `Sym` instances). Every later layer composes over that one shape; there is no intermediate representation.

**How to read this chapter.** §AE.1 is the pipeline overview. §AE.2–§AE.6 are the components (tokenizer · reader macros · positions · quote/quasiquote · `Sym` interning). §AE.7–§AE.9 cover the parser+cache, atom classification, and the honest gaps.

### §AE.1 — Pipeline overview

The reader runs three logical passes over the same character stream:

```
[FLOW CHART: §AE.1 — source text → tokens → AST]
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" width="100%" style="max-width:760px; background:#fdf6f3;" role="img" aria-label="Reader pipeline: source text to tokens to AST">
  <defs>
    <marker id="ae1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#2e2167"/>
    </marker>
  </defs>
  <rect x="20" y="40" width="180" height="140" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.5"/>
  <text x="110" y="62" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">SOURCE STRING</text>
  <text x="110" y="92" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">(define (f x)</text>
  <text x="110" y="108" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">&#160;&#160;(+ x 1))</text>
  <text x="110" y="148" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">reader.js:172</text>
  <text x="110" y="164" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">parse(src)</text>

  <line x1="200" y1="110" x2="290" y2="110" stroke="#2e2167" stroke-width="1.5" marker-end="url(#ae1-arrow)"/>
  <text x="245" y="100" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#2e2167">tokenize</text>

  <rect x="290" y="40" width="200" height="140" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.5"/>
  <text x="390" y="62" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">TOKENS</text>
  <text x="390" y="86" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">{t:"(",  line:1, col:1}</text>
  <text x="390" y="100" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">{t:"define", line:1, col:2}</text>
  <text x="390" y="114" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">{t:"(",  line:1, col:9}</text>
  <text x="390" y="128" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">{t:"f",  line:1, col:10}</text>
  <text x="390" y="158" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">reader.js:73 tokenize()</text>

  <line x1="490" y1="110" x2="580" y2="110" stroke="#2e2167" stroke-width="1.5" marker-end="url(#ae1-arrow)"/>
  <text x="535" y="100" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#2e2167">read</text>

  <rect x="580" y="40" width="200" height="140" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.5"/>
  <text x="680" y="62" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">AST</text>
  <text x="680" y="86" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">[Sym(define),</text>
  <text x="680" y="100" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;[Sym(f), Sym(x)],</text>
  <text x="680" y="114" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;[Sym(+), Sym(x), 1]]</text>
  <text x="680" y="148" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">reader.js:128 parseInner</text>
  <text x="680" y="164" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">+ POS WeakMap tag</text>

  <rect x="290" y="200" width="200" height="28" rx="4" fill="#fdf6f3" stroke="#ffb7c5" stroke-width="1.5"/>
  <text x="390" y="218" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">PARSE_CACHE (256, FIFO)</text>
  <line x1="110" y1="180" x2="290" y2="214" stroke="#5e3c8a" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="490" y1="214" x2="680" y2="180" stroke="#5e3c8a" stroke-width="1" stroke-dasharray="3,3"/>
</svg>

The two solid arrows are the pipeline. The dashed arrow is the AST cache: `parse(src)` consults the cache before tokenizing, and writes the produced AST back on a miss. A cache hit skips both tokenize and read.

### §AE.2 — Tokenizer

`tokenize(src)` at `reader.js:73` walks the source character-by-character with three pieces of mutable state: `i` (byte offset), `line`, and `col`. The local `adv(k)` helper at `reader.js:79-84` advances all three together, incrementing `line` and resetting `col` on every `\n`. Every emitted token is a `{ t, line, col }` object where `t` is either the lexeme (a string) or `{ str: '…' }` for a string literal.

The tokenizer recognises six classes of input, in order:

1. **Comments** — `;` to end-of-line, skipped without emission (`reader.js:88`).
2. **Whitespace** — space / tab / newline / CR, skipped (`reader.js:89`).
3. **Single-char delimiters** — `(`, `)`, `'` each emit one token (`reader.js:90`).
4. **Reader macros** — `` ` ``, `,`, `,@` (`reader.js:94-98`). The two-character `,@` is recognised by one-character lookahead and emitted as a single token before the comma is consumed; the order matters because a naive read would emit `,` then `@` and lose the splice semantics.
5. **String literals** — `"…"` with `\`-escape (`reader.js:99-110`). The raw lexeme is wrapped in `{ str: '…' }` so the `atom()` step can distinguish a string from a same-shaped symbol like `+` or `define`. Unterminated strings throw `ReadError` carrying the opening quote's `{line,col}`. Escapes are literal — `\n` becomes the character `n`, not a newline. No standard C-string escapes.
6. **Atoms** — everything else, terminated by the `DELIM` set at `reader.js:56` (whitespace, parens, semicolon, single-quote, double-quote). The atom text is sliced out of the source and emitted unparsed; classification into number, boolean, or symbol happens later, in `atom()` at `reader.js:119-125`.

`DELIM` is a `Set` literal, not a regex. The hot path is one `Set.has` per character; on a 10,000-cart corpus run during boot the difference between a `Set.has` and a regex test is the difference between sub-millisecond and a perceptible boot pause.

The tokenizer carries no buffer beyond the source string and the output array. It is a single linear pass; tokens are emitted in the order they appear, and the source position on each token is fixed at emission time. Nothing later in the pipeline rewinds the position or recomputes it.

### §AE.3 — Reader macros

The reader recognises four prefix reader-macros, each of which expands into a two-element list at read time:

| Prefix | Expansion | Token (reader.js) | Expansion site (reader.js) |
|---|---|---|---|
| `'expr`  | `(quote expr)`            | `:90`  | `:146` |
| `` `expr `` | `(quasiquote expr)`    | `:94`  | `:147` |
| `,expr`  | `(unquote expr)`           | `:97`  | `:148` |
| `,@expr` | `(unquote-splicing expr)`  | `:96`  | `:149` |

Each expansion is performed inside `read()` (the local recursive descent at `reader.js:131-151`): the prefix token is consumed, a fresh `read()` runs to capture the operand, and the pair is wrapped in a `tagPos`-stamped array carrying the prefix's source position. The resulting list is indistinguishable from a hand-authored `(quote …)` form — by the time `parse()` returns, the prefix is gone and the special-form head is what the evaluator (`interp.js:289`) dispatches on.

Two consequences follow from this expansion-at-read-time discipline:

1. **The evaluator has no quote/quasiquote prefix logic.** It only recognises `quote` and `quasiquote` as special-form symbol heads (`interp.js:275-279`). The lexical prefixes are a reader concern, not an evaluator concern.
2. **The macro pass and the verb gate see the expanded form.** A reader macro cannot smuggle a verb past the gate by hiding behind a quote prefix, because the gate walks the same list shape the evaluator does.

`'(+ 1 2)` and `(quote (+ 1 2))` parse to byte-identical ASTs, and both `posOf()` to the position of the leading character (the `'` or the `(`).

```
[FLOW CHART: §AE.3 — one macro definition → four expanded call sites]
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360" width="100%" style="max-width:780px; background:#fdf6f3;" role="img" aria-label="Macro expansion fanout: one when-macro definition to four expanded if-begin forms">
  <defs>
    <marker id="aef-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#2e2167"/>
    </marker>
  </defs>

  <rect x="240" y="20" width="320" height="80" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="2"/>
  <text x="400" y="42" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">MACRO DEFINITION (source)</text>
  <text x="400" y="62" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">(define-syntax when</text>
  <text x="400" y="76" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">&#160;&#160;(syntax-rules () ((_ t b ...) (if t (begin b ...) #f))))</text>
  <text x="400" y="94" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">macro.js — expandProgram() walks the AST once per parse</text>

  <line x1="400" y1="100" x2="120" y2="160" stroke="#2e2167" stroke-width="1.2" marker-end="url(#aef-arrow)"/>
  <line x1="400" y1="100" x2="320" y2="160" stroke="#2e2167" stroke-width="1.2" marker-end="url(#aef-arrow)"/>
  <line x1="400" y1="100" x2="500" y2="160" stroke="#2e2167" stroke-width="1.2" marker-end="url(#aef-arrow)"/>
  <line x1="400" y1="100" x2="700" y2="160" stroke="#2e2167" stroke-width="1.2" marker-end="url(#aef-arrow)"/>

  <rect x="20" y="160" width="200" height="80" rx="4" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="120" y="178" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a" font-weight="bold">call site #1</text>
  <text x="120" y="196" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(when ready?</text>
  <text x="120" y="210" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(paint-arrow))</text>
  <text x="120" y="232" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#1a1a1a">carts/scene/welcome.sks</text>

  <rect x="240" y="160" width="160" height="80" rx="4" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="320" y="178" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a" font-weight="bold">call site #2</text>
  <text x="320" y="196" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(when (gt? n 0)</text>
  <text x="320" y="210" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(loop (- n 1)))</text>
  <text x="320" y="232" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#1a1a1a">carts/personal/digest.sks</text>

  <rect x="420" y="160" width="160" height="80" rx="4" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="500" y="178" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a" font-weight="bold">call site #3</text>
  <text x="500" y="196" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(when dirty?</text>
  <text x="500" y="210" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(save!) (log!))</text>
  <text x="500" y="232" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#1a1a1a">carts/etsy/sync.sks</text>

  <rect x="600" y="160" width="180" height="80" rx="4" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="690" y="178" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a" font-weight="bold">call site #4</text>
  <text x="690" y="196" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(when (eq? r 'ok)</text>
  <text x="690" y="210" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(advance))</text>
  <text x="690" y="232" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#1a1a1a">carts/magic/orchestrate.sks</text>

  <line x1="120" y1="240" x2="120" y2="280" stroke="#2e2167" marker-end="url(#aef-arrow)"/>
  <line x1="320" y1="240" x2="320" y2="280" stroke="#2e2167" marker-end="url(#aef-arrow)"/>
  <line x1="500" y1="240" x2="500" y2="280" stroke="#2e2167" marker-end="url(#aef-arrow)"/>
  <line x1="690" y1="240" x2="690" y2="280" stroke="#2e2167" marker-end="url(#aef-arrow)"/>

  <rect x="20" y="280" width="200" height="60" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.2"/>
  <text x="120" y="304" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(if ready?</text>
  <text x="120" y="318" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(begin (paint-arrow))</text>
  <text x="120" y="332" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;#f)</text>

  <rect x="240" y="280" width="160" height="60" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.2"/>
  <text x="320" y="304" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(if (gt? n 0)</text>
  <text x="320" y="318" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(begin (loop (- n 1)))</text>
  <text x="320" y="332" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;#f)</text>

  <rect x="420" y="280" width="160" height="60" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.2"/>
  <text x="500" y="304" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(if dirty?</text>
  <text x="500" y="318" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(begin (save!) (log!))</text>
  <text x="500" y="332" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;#f)</text>

  <rect x="600" y="280" width="180" height="60" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.2"/>
  <text x="690" y="304" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">(if (eq? r 'ok)</text>
  <text x="690" y="318" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;(begin (advance))</text>
  <text x="690" y="332" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#5e3c8a">&#160;&#160;#f)</text>
</svg>

*Figure AE.2 — Macro expansion fanout. `expandProgram` (`macro.js`) walks the parsed AST once per cart load; a single `define-syntax` rule rewrites every matching call site into the canonical `(if test (begin body ...))` form before the verb gate or evaluator ever sees it. The reader produces the surface syntax; the macro pass produces the core forms the gate walks. Reader macros (§AE.3 table above) and `define-syntax` macros share this fan-out shape — one declaration, many expanded sites.*

### §AE.4 — Source-position tracking

Source positions are recorded on a side `WeakMap`, `POS`, declared at `reader.js:45`. The map keys list forms (which are JS arrays — objects, eligible to key a WeakMap); the values are `{ line, col }` records. `posOf(form)` at `reader.js:46-49` is the read accessor; `tagPos(form, pos)` at `reader.js:50-53` is the write helper. `posOf()` returns `null` on any non-object input (`reader.js:47-48`); callers must null-check before reading `.line` / `.col`.

The design has three deliberate properties:

- **Atoms are unkeyable.** Numbers, strings, and booleans are JS primitives and cannot key a WeakMap. Interned `Sym` instances (`reader.js:34-39`) are shared — `sym('x')` always returns the same instance — so tagging a `Sym` with a position would put every occurrence of `x` at the same line. Position tracking at the atom level is therefore neither possible nor desirable; list-level granularity is the smallest reliable unit.
- **GC clears the map.** Because `POS` is a `WeakMap`, a form that is dropped from the AST cache and goes out of scope takes its position record with it. The map carries no leak.
- **Positions are tagged at construction.** `parseInner` calls `tagPos` immediately on every `[…]` it builds (`reader.js:143-149`), so the tag is written before any consumer can hold the reference. The cache stores already-tagged forms.

Runtime errors flow through `locate(e, form, slug?)` in `curator-web/src/scheme/index.js` (the dispatcher's error-wrapper), which calls `posOf(form)` and rewrites the error message to embed the position. The behaviour split at §4.1 of this manual — `unbound symbol: x (at line 2, col 1)` without a slug, `[cart/etsy-listing-draft:2:1] unbound symbol: x` with one — is implemented by that wrapper, not by the reader; the reader's job ends at making `posOf` answer correctly.

`ReadError` (`reader.js:61-68`) is the parse-time error class. It already carries `{line, col}` and embeds them in the message for legacy callers that only read `.message`. Three error sites use it: unterminated string (`:106`), unexpected EOF (`:132`), missing closing paren (`:138`), and stray closing paren (`:145`).

### §AE.5 — Quote and quasiquote handling

The reader expands the four prefix macros into lists; the *semantics* of those lists is the evaluator's job. The split is clean:

- `quote` at `interp.js:290-291` returns the literal data sub-form, unevaluated. The returned reference is shared with the AST — quoted data is treated as immutable by every consumer.
- `quasiquote` at `interp.js:375-376` delegates to `quasiExpand(form, env, fuel)` (`interp.js:510-532`), which walks the template once. `(unquote x)` evaluates `x` in place; `(unquote-splicing x)` splices a list into the surrounding list. Nested quasiquotes drop one level per nesting — sufficient for cart data payloads, deferred for full R7RS semantics per §2.2.
- `unquote` and `unquote-splicing` outside a quasiquote context have no special-form handler in `interp.js`. The reader produces the form, but if `quasiExpand` is not the walker, the evaluator's application path tries to apply `unquote` as a function and fails with `unbound symbol: unquote`. This is the intended failure mode — bare `(unquote x)` is meaningless and the error names it.

The reader does NOT enforce that `unquote` and `unquote-splicing` appear only inside `quasiquote`. The check is a runtime concern handled by `quasiExpand`, which throws at `interp.js:517` when `unquote-splicing` appears outside a list position.

### §AE.6 — `Sym` interning

`Sym` (`reader.js:29-32`) is the symbol class. Every symbol with the same name is the same `Sym` instance — the module-level `SYMS` map at `reader.js:34-39` enforces this. `sym(name)` returns the canonical instance, allocating only on first sight.

Interning has three load-bearing consequences:

1. **Identity comparison is name comparison.** The evaluator dispatches on `head.name` (`interp.js:288`); two `Sym` instances with the same name are `===` and the dispatch lands the same case. The macro pass uses the same identity for binder positions; the verb registry uses it for name lookup.
2. **The AST cache can share forms safely.** A cached AST contains references to the global interned `Sym`s; the macro expander and the evaluator never mutate them. A future consumer that wanted to mutate would clone first — and no consumer does.
3. **Memory is bounded by the symbol vocabulary, not by the corpus size.** A 10,000-cart corpus that mentions `paint-arrow` ten thousand times allocates one `Sym('paint-arrow')`. The interpreter, the macro pass, the gate, and the dispatcher all reference the same object.

The `SYMS` map is never cleared. Vocabulary is assumed finite — the verb registry caps at low thousands and the dot-symbol corpus is small. If a future feature lets carts generate fresh symbols at runtime — and it should not, per §1.4 — the cap on `SYMS` becomes a hard requirement.

### §AE.7 — Parser and the AST cache

`parseInner(src)` at `reader.js:128-155` is the actual parser: it calls `tokenize(src)`, advances through the token stream with a local `read()` closure that recurses on `(` and delegates to `atom()` on bare tokens, and accumulates top-level forms into an array. The recursive descent is direct — no parser-generator, no explicit state machine, no separate grammar file. The 27-line `read()` body is the entire grammar.

`parse(src)` at `reader.js:172-191` is the public entry point and the cache layer:

- Non-string inputs bypass the cache entirely (`reader.js:173` — `if (typeof src !== 'string') return parseInner(src)`). Callers passing already-tokenised forms — the macro expander's test seam, the replayer's pre-parsed log entries — pay zero cache cost and zero hash work.
- A `Map` keyed by source string (`PARSE_CACHE`, `reader.js:167`) caches up to `PARSE_CACHE_MAX = 256` ASTs.
- On a hit, the entry is deleted and re-inserted so insertion-order eviction approximates LRU (`reader.js:178-180`).
- On a miss, `parseInner(src)` runs; if the cache is full, the oldest entry is evicted (`reader.js:184-188`).
- `clearParseCache()` and `parseCacheStats()` (`reader.js:194-197`) are the test and diagnostic seams. `parseCacheStats()` returns `{ size, hits, misses, max }`.

The cache is the load-bearing performance affordance for three hot paths named in the SC1 header (`reader.js:11-27`): the studio's run-on-keystroke loop, the dispatcher's re-entry path (when a primitive calls back into Scheme via `apply()`), and the replay tool. Each re-parses the same source many times per run; the cache turns the second and subsequent calls into a `Map.get`.

Cached forms are shared across hits. Sharing is safe because:

- The macro expander builds new arrays via `cloneForm` (`macro.js`, called from `expandProgram`).
- The evaluator never mutates list forms; `quote` returns a sub-form directly, but the consumer treats quoted data as immutable.
- The verb gate's `walkVerbCalls` reads but does not write.

If a future consumer wanted to mutate, it would clone first; the discipline is the same as for any shared immutable reference.

### §AE.8 — `atom()` classification

`atom(tok)` at `reader.js:119-125` classifies a bare token into a JS value:

| Input | Output | Path |
|---|---|---|
| `{ str: '…' }` | the string `'…'` | `:120` |
| `'#t'` | the boolean `true` | `:121` |
| `'#f'` | the boolean `false` | `:122` |
| numeric (matches `NUM_RE`) | a JS number via `parseFloat` | `:123` |
| anything else | the interned `Sym` | `:124` |

`NUM_RE` at `reader.js:55` is `/^[+-]?(\d+\.?\d*|\.\d+)$/` — optional sign, integer / decimal / leading-dot fractional. There is no hex, no exponent, no rational, no bignum. JS Numbers throughout, per §2.2.

The classification is order-sensitive: the string check runs first (because the string-literal tokenizer is the only producer of `{ str }` objects); the boolean check runs before the numeric check (`#t` does not match `NUM_RE` either way, but the dispatch is cheaper); and the symbol fallback catches every non-numeric, non-boolean text including the special-form names and the verb namespace.

The reader cannot tell the difference between a verb call and a special form at classification time. Both arrive at the evaluator as a list with a `Sym` head; the special-form dispatch (`interp.js:275-279`) is what distinguishes them. The reader's job is to produce the uniform list-of-Sym shape; the evaluator's job is to know which Sym names a special form.

### §AE.9 — Honest gaps

- **No `read` from string into Scheme.** The reader is a JS export, not a Scheme primitive. A cart cannot call `(read "…")` and get a form back; the language deliberately omits the seam per §2.2. `parse()` is invoked by the host (the dispatcher, the studio, the replay tool), never by user code.
- **No source-position on atoms.** The `WeakMap` design described in §AE.4 cannot record atom-level positions. An error inside `(+ x 1)` points at the list `(+ x 1)`, not at the symbol `x`. The reference compiler error format ("unbound symbol: x (at line 2, col 1)") locates the *containing list*, which is the smallest reliable unit.
- **No full R7RS quasiquote nesting.** One-level expansion; nested quasiquotes drop a level per nesting (§2.2, §AE.5). Carts that need deeper nesting must restructure the template.
- **No reader-side syntax extensibility.** The four reader macros are hard-coded in `tokenize()` (`reader.js:90-98`). There is no `define-reader-macro`. Adding a new prefix requires editing the tokenizer + parser together.

---

## §AF. The Evaluator

This section is the definitive read-first for `curator-web/src/scheme/interp.js`. The evaluator is the longest single file in the runtime (~530 lines) and the file most likely to be edited by a future engineer. Its design is shaped by three load-bearing constraints: capability-bounded security (`§1.4`), constant-stack tail-call elimination (`§2.1`), and a fuel budget that caps total evaluation steps (`§4.3`).

The evaluator's interface is six exports and one class hierarchy. The file is ~530 lines; in-line comments cite the design references.

**How to read this chapter.** §AF.1 lists the public interface. §AF.2 enumerates the 16 special forms. §AF.3–§AF.4 cover the runtime machinery (TCO trampoline, env chain). §AF.5–§AF.7 are closures, quasiquote, and the fuel bound. §AF.8–§AF.10 are the cache interplay, source-position errors, and honest gaps.

### §AF.1 — Public interface

| Export | Role | Defined at |
|---|---|---|
| `Env`            | The capability-authority object — env-chain frame | `interp.js:48-165` |
| `Closure`        | A user lambda + its captured env                  | `interp.js:174-194` |
| `evaluate`       | The outer trampoline (public entry point)         | `interp.js:238-248` |
| `apply`          | Re-enter the trampoline from a JS primitive       | `interp.js:458-468` |
| `__resetMissingPermWarnings` | Test seam for the perm-audit floor      | `interp.js:46`     |

`Sym` is re-imported from `reader.js`; it is the only external dependency apart from the verb registry's `registerVerbMeta`. The evaluator has no `import` of any DOM, network, file, or worker API. The closure of `evaluate(form, env, fuel)` is exactly what's reachable from `env` — by construction.

`Env.define(name, val, meta)` accepts the third argument as a verb-metadata bag. The shape is `{ perm, confirm, rateLimit, schema, idempotent, chip, cap, ... }` — `perm` is the dispatcher's gate-key, `confirm`/`rateLimit`/`schema`/`idempotent` are the four-field policy bundle the registry normalises (`runtime/verbRegistry.js:176-195`), and `chip`/`cap` are the surface-side accents the dispatcher reads when an act fires. An omitted meta is inferred from the name by `defaultMetaFor` (`runtime/verbRegistry.js:154-169`); the inference is marked with `_inferred: true` so the registry validator can surface verbs that look state-changing but never declared a perm.

### §AF.2 — The 16 special forms

The evaluator recognises 16 special-form heads, frozen into `SPECIAL_FORMS` at `interp.js:275-279`:

```
quote · if · define · set! · lambda · begin
let   · let* · letrec · quasiquote · when · and
or    · unless · cond · case
```

Each is dispatched by a `case` in the switch at `interp.js:289-441`. Anything else — including every verb call — falls through to the application path (`interp.js:447-450`). The dispatch order is:

1. `--fuel.n < 0` → throw `fuel exhausted` (`:282`).
2. `form instanceof Sym` → `env.get(form.name)` (`:283`).
3. `!Array.isArray(form)` → self-evaluating value (`:284`).
4. `form.length === 0` → empty list literal (`:285`).
5. `head instanceof Sym && SPECIAL_FORMS.has(head.name)` → switch (`:288`).
6. Otherwise → function application (`:447-450`).

The `SPECIAL_FORMS` Set is the fast-path guard added in 2026-06-22 (`interp.js:258-274`). Without it, every verb call would walk every `case` label before falling through to `default`. The Set is a one-`Map.has` exit so the common `(verb …)` shape pays a single lookup, not a 16-case cascade. The comment block at `interp.js:258-274` names Chibi-Scheme and Femtolisp as the design references: Chibi pre-rewrites to a closed core-form set at expansion time; Femtolisp avoids the dispatch by compiling to opcodes. The evaluator keeps the AST shape and only short-circuits the no-match exit.

Per-form notes worth carrying in your head when you touch this file:

- **`quote`** (`:290-291`) returns `form[1]` directly. No copy; the consumer must treat quoted data as immutable.
- **`if`** (`:292-296`) evaluates the test inline, returns a `Tail` for the chosen branch. The alternate defaults to `false` when omitted (`form[3] ?? false`).
- **`define`** (`:297-309`) takes two shapes: `(define (f a b) body…)` lowers to a `Closure`; `(define x v)` evaluates `v` and binds. The function-shape path calls `parseParams` to split out a dotted-tail rest parameter.
- **`set!`** (`:310-312`) walks the env chain via `env.set`. Throws `set! on unbound symbol` if no frame holds the name.
- **`lambda`** (`:313-328`) handles both R7RS §4.1.4 shapes: `(lambda args body)` (fully variadic, params=[], restParam=`args`) and `(lambda (a b . rest) body)` (dotted-tail).
- **`begin`** (`:329-334`) evaluates all but the last form inline, returns a `Tail` for the last. The last form is the tail position.
- **`let`** (`:335-354`) handles named-let — `(let loop ((i 0)) …)` — by defining a `Closure` named `loop` and bouncing through `TailCall` with the initial values. This is the iteration idiom carts rely on for loops without `do`.
- **`let*`** (`:355-361`) evaluates each binding in the partially-extended env (`e2`), so each binding sees the prior.
- **`letrec`** (`:362-374`) defines every name as `undefined` first, then evaluates each value in the fully-extended env. Forward references work; mutually recursive lambdas work.
- **`quasiquote`** (`:375-376`) delegates to `quasiExpand` (`:510-532`).
- **`when`** / **`unless`** (`:377-384`, `:401-408`) evaluate the test, run the body if it passes (resp. fails). The last body form is the tail position.
- **`and`** / **`or`** (`:385-400`) short-circuit; the last conjunct/disjunct is the tail position. Empty `(and)` returns `true`, empty `(or)` returns `false`.
- **`cond`** (`:409-422`) iterates clauses, evaluates each test (treating `else` literally as truth), and returns `Tail` on the matched clause's last body form. A clause with no body (e.g. `(cond (x))`) returns the test value.
- **`case`** (`:423-438`) evaluates the key once, scans each clause's data list, matches by JS `===` or `Sym`-name equality. `else` matches literally.

### §AF.3 — Tail-call elimination

The TCO story is a trampoline plus two sentinel classes:

```
class Tail      { constructor(form, env)  { … } }   // :226-228
class TailCall  { constructor(fn, args)   { … } }   // :229-231
```

`Tail` carries a form to re-evaluate in `env`; `TailCall` carries a function plus already-evaluated arguments. `evaluate(form, env, fuel)` at `:238-248` is the outer trampoline:

```
let cur = evalStep(form, env, fuel)
while (cur instanceof Tail || cur instanceof TailCall) {
  if (cur instanceof Tail) cur = evalStep(cur.form, cur.env, fuel)
  else                     cur = applyStep(cur.fn, cur.args, fuel)
}
return cur
```

`evalStep` and `applyStep` return sentinels instead of recursing on the JS stack whenever they reach a tail position. The trampoline unwraps the sentinel until a real value lands. The JS stack stays flat regardless of Scheme call depth; the only depth bound is `fuel`.

Tail positions handled (documented at `interp.js:18-37`):

- `if` consequent and alternate (not the test)
- `begin` last form
- `when` / `unless` last body form
- `cond` / `case` last form of the chosen clause
- `let` / `let*` / `letrec` last body form (including named-let recursion)
- `and` / `or` last conjunct / disjunct
- function application — the call itself, bouncing through `TailCall`

Intentionally NOT tail positions:

- The test of `if` / `cond` / `case`
- All but the last form of any sequence
- Operands to function calls (their order matters)
- Initialiser expressions of `let` / `let*` / `letrec`

The depth-note comment at `interp.js:250-256` is load-bearing: there is no separate `MAX_DEPTH` constant. Recursion depth is bounded by `fuel`. Non-tail calls grow the JS stack — JS engines allow thousands of frames before overflow — so any practical fuel budget (≥50,000) supports non-tail recursion past 100 levels without hitting an engine limit.

`apply(fn, args, fuel)` at `:458-468` is the public re-entry seam. A JS primitive that wants to call back into Scheme — `for-each`, sprite callbacks, the cart driver's `apply(stateFn, [ctx], f)` — calls `apply` and gets a real value back. The trampoline runs locally; the same fuel object covers the inner run. A primitive that re-enters Scheme cannot escape the fuel budget by going through a different door.

### §AF.4 — The `Env` chain

`Env(parent)` at `:48-64` is a `Map<string, value>` with a parent link. Lookup walks the parent chain via `get` (`:65-69`) until it finds the name or runs out of parents; `set` walks the same chain via `set` (`:70-82`); `define` always lands on the current frame (`:105-134`).

The chain forms a tree, not a list — every closure captures the env that was active when the lambda was constructed, and a fresh `Env(parent)` is allocated per call (`applyStep` at `:475-499`). The globals frame is the root; primitives live in it; closures capture sub-frames; recursive calls allocate fresh frames.

```
[FLOW CHART: §AF.4 — env chain at runtime, three frames deep]
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 320" width="100%" style="max-width:720px; background:#fdf6f3;" role="img" aria-label="Env chain: call frame to closure capture to globals">
  <defs>
    <marker id="af4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#2e2167"/>
    </marker>
  </defs>

  <rect x="20" y="20" width="220" height="110" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.5"/>
  <text x="130" y="42" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">CALL FRAME (e)</text>
  <text x="32" y="62" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">vars: Map {</text>
  <text x="50" y="78" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"x" → 10,</text>
  <text x="50" y="94" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"acc" → 4</text>
  <text x="32" y="110" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">}</text>
  <text x="32" y="124" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">interp.js:478 applyStep</text>

  <line x1="240" y1="75" x2="320" y2="75" stroke="#2e2167" stroke-width="1.5" marker-end="url(#af4-arrow)"/>
  <text x="280" y="68" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#2e2167">.parent</text>

  <rect x="320" y="20" width="220" height="110" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="1.5"/>
  <text x="430" y="42" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">CLOSURE CAPTURE</text>
  <text x="332" y="62" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">vars: Map {</text>
  <text x="350" y="78" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"loop" → Closure,</text>
  <text x="350" y="94" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"limit" → 100</text>
  <text x="332" y="110" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">}</text>
  <text x="332" y="124" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">interp.js:174 Closure.env</text>

  <line x1="540" y1="75" x2="620" y2="75" stroke="#2e2167" stroke-width="1.5" marker-end="url(#af4-arrow)"/>
  <text x="580" y="68" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#2e2167">.parent</text>

  <rect x="320" y="170" width="380" height="130" rx="4" fill="#fdf6f3" stroke="#2e2167" stroke-width="2" stroke-dasharray="6,3"/>
  <text x="510" y="192" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">GLOBALS (FROZEN)</text>
  <text x="332" y="214" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">vars: Map {</text>
  <text x="350" y="230" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"+" → fn,  "cons" → fn,</text>
  <text x="350" y="246" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"paint-arrow" → fn,</text>
  <text x="350" y="262" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">"etsy/listings" → fn …</text>
  <text x="332" y="278" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">}</text>
  <text x="332" y="294" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">interp.js:154 freeze()</text>

  <text x="620" y="180" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#ffb7c5">_frozen</text>
  <text x="620" y="194" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#ffb7c5">= true</text>

  <line x1="540" y1="130" x2="430" y2="170" stroke="#2e2167" stroke-width="1.5" marker-end="url(#af4-arrow)"/>
</svg>

The chain is read shallow-to-deep on `get`: the current call frame is consulted first, then each parent in turn, until the globals frame (the root). The globals frame is the one that `freeze()` locks at boot; closure-capture frames are mutable for the life of the cart.

#### `define(name, val, meta)` — the substrate seam

The third argument to `define` (`:105-134`) is the verb metadata the dispatcher gates against. Existing two-arg calls still work; the meta is inferred via `defaultMetaFor(name)` (`runtime/verbRegistry.js`). Function values trigger a side-call to `registerVerbMeta(name, resolved)` so the dispatcher's runtime registry stays in lockstep with the Env.

A function-valued bind without an explicit `meta.perm` emits a one-shot console warning naming the missing perm (`interp.js:117-130`). The warning is best-effort: it never blocks boot or registration. `MISSING_PERM_WARNED` is a process-global `Set` so a hot-mounted installer (test setup re-running `installCardVerbs` per test) does not drown the console with the same name; the audit's test seam `__resetMissingPermWarnings` (`:46`) clears it.

#### `freeze()` — the post-boot lock

`freeze()` at `:154-164` captures every name bound on the env at freeze-time as `_frozenNames`, then `Object.freeze(this)` so the env instance cannot gain new direct properties. The `Map` at `.vars` stays mutable so user code can still `(define new-name …)` — the freeze is a per-binding gate, not a wholesale lock. New names land freely (the bricklay cart's `(define BRICKLAY-MARGIN …)`, named-let loops, user lambdas); existing substrate names throw on redefine or `set!`.

`Object.freeze(Env.prototype)` at `:172` blocks prototype pollution of the `Env` class itself — an attacker who reached `Env.prototype.define = …` could otherwise swap the substrate's authority for every env in the process. The freeze runs once at module load.

### §AF.5 — Closures, parameter shapes, and `parseParams`

`Closure` at `:174-194` carries four fields: fixed `params` (array of strings), `body` (array of forms), captured `env`, and an optional `restParam` (string) for variadic shapes.

`parseParams(symList)` at `:205-221` splits a lambda/define param list into fixed params + an optional rest. The reader keeps `.` as an ordinary symbol inside a list, so `(a b . rest)` arrives at the evaluator as `[Sym(a), Sym(b), Sym('.'), Sym(rest)]`. `parseParams` detects the `.` marker and gathers the single following symbol as the rest param:

| Input | `{ params, restParam }` |
|---|---|
| `(a b)`        | `['a','b']`, `null`   |
| `(a b . rest)` | `['a','b']`, `'rest'` |
| `(. rest)`     | `[]`, `'rest'`        |

It rejects malformed lambdas: a `.` not followed by exactly one identifier, a parameter that is not a `Sym`, and the fully-variadic shape `(lambda args body)` where `args` is a bare `Sym` (handled at `lambda`'s dispatch, `:321-323`, not by `parseParams`).

`applyStep(fn, args, fuel)` at `:475-499` is the closure-application target. For each call it allocates a fresh `Env(fn.env)`, binds the positional args via a fast index loop (`:483-485` — `forEach` was measured to cost a closure-per-call and the iteration-protocol overhead is in the hot path), and gathers any extra args into a rest list. The body's non-last forms run inline; the last form returns as a `Tail` so the trampoline picks up the tail call without growing the stack.

### §AF.6 — `quasiquote` expansion

`quasiExpand(form, env, fuel)` at `:510-532` walks the template once. The recursion handles three cases:

- A non-list form returns itself.
- A list whose head is `(unquote x)` evaluates `x` and returns the value.
- A list whose head is `(unquote-splicing x)` outside list position throws `unquote-splicing not at list position` (`:517`).
- Otherwise the function rebuilds the list element by element: list-headed `unquote-splicing` items get their evaluated result spread into the output via `out.push(...spliced)`; everything else recurses.

Nested quasiquotes are NOT handled: a `(quasiquote (quasiquote …))` template drops one level per nesting, which is sufficient for cart data payloads but does not implement full R7RS semantics. The deferred work is named in §2.2 and again at `interp.js:507-509`.

### §AF.7 — Fuel: the only safety bound

`fuel` is a `{n: int}` object passed through every call. `evalStep` decrements `fuel.n` on entry and throws `fuel exhausted` when it goes negative (`:282`). One fuel object covers an entire program run — including all primitives that call back into Scheme through `apply()` — so a runaway map, deep recursion, or mutually-recursive macro fork-bomb is killed, not allowed to hang the thread.

The fuel object is mutable on purpose. Passing an integer would require every recursive call to thread the new value back up the trampoline; the `{n}` shape lets every step decrement in place with one allocation. The cost is that fuel exhaustion is observable through the object even after the trampoline returns — useful for the dispatcher's accounting, which reads `fuel.n` on completion to record the steps actually used.

A cart that exits cleanly leaves `fuel.n` positive; a cart that throws `fuel exhausted` leaves it at -1 (the decrement that triggered the throw). The dispatcher does not currently use this signal, but the data is available.

### §AF.8 — The AST cache (SC1) interplay

The reader's AST cache (`reader.js:167-191`) is consulted by `parse()` and is invisible to the evaluator. The evaluator walks whatever array shape it receives — cached or freshly parsed, the two are byte-identical references when the source matches. The cache pays off whenever the same source string is evaluated repeatedly: the studio's run-on-keystroke loop, the dispatcher's re-entry, the replay tool.

Cached forms are shared. The evaluator does not mutate list forms (`quote` returns the sub-form directly; quoted data is treated as immutable); the macro pass builds new arrays; the verb gate reads but does not write. A future consumer that wanted to mutate would clone first.

### §AF.9 — Source-position errors

The reader tags every list form with `{line, col}` via `tagPos` (§AE.4). The evaluator does not consult those tags directly — error messages from `evalStep` and `applyStep` carry plain prose (`unbound symbol: x`, `not a function: …`, `fuel exhausted`). The position is added by `locate(e, form, slug?)` in `curator-web/src/scheme/index.js`, which wraps the error after it escapes the evaluator.

The wrapper carries `.line`, `.col`, `.cart`, `.cause` on the thrown error. Only errors pay the position-lookup overhead — successful evaluation pays nothing. The split is deliberate: the evaluator stays cheap; the dispatcher pays the cost only when it has an error to report.

### §AF.10 — Honest gaps

- **No `call/cc`** (§2.2). Adding it would break the dispatcher's structural gate walk — a continuation could capture state before a gate decision and re-enter after.
- **No `eval` from string in Scheme.** The `apply()` seam re-enters with already-evaluated values, not text.
- **Mutable lists are forbidden.** `cons`/`car`/`cdr` produce immutable JS arrays. Mutation is via `set!` on a name. Carts never mutate cons cells.
- **No numerical tower.** JS Numbers throughout; no bignums, no exact rationals.
- **The trampoline allocates per tail call.** `new Tail(…)` and `new TailCall(…)` are cheap but not free. A future pass that pools the sentinels would reduce GC pressure; the current code prioritises clarity.

---

## §AG. The Cart Spine

This section is the definitive read-first for the two-layer cart-execution spine: `runCartLive` in `curator-web/src/scheme/cartHost.js`, `driveCart` in `curator-web/src/scheme/cartDriver.js`, and the `CartBus` event stream in `curator-web/src/scheme/cartBus.js`. Together they are the canonical, replayable, reconcilable runner the rest of the app listens for — the SAME runner the cart replayer uses, so a recorded live run replays byte-identical.

Every operator-visible action — every Etsy sync, every crosspost, every shop scene — lands on this spine. The spine itself is under 1,200 lines of JavaScript across the three files; everything else is verbs the spine dispatches.

**How to read this chapter.** §AG.1 is the two-layer overview. §AG.2 covers the `runCartLive` entry point (defaults, pre-flight, synthetic cart). §AG.3 walks the `driveCart` state-machine loop. §AG.4 documents `CartBus` events. §AG.5–§AG.7 cover determinism, where events go, and the return shape. §AG.8 is the honest gaps.

### §AG.1 — Why two layers

The contradiction the spine closes is documented at `cartHost.js:1-31` and `CART-SPINE-DESIGN.md`: `driveCart` plus the `CartBus` were the "real engine", but the only caller was `cartReplayer`. Live actions ran through `dispatchScheme` directly, with no bus and no terminal `CART_END`, so four merged-but-dead wires never fired in production:

- the orchestration-as-truth integration (G6)
- the answer-card spawn (G18)
- the card-menu service run (G20)
- the untrusted-intent pre-flight (X7)

`runCartLive` is the missing outer runner. Two layers, one spine:

- **OUTER = `driveCart` + `CartBus`.** Owns the lifecycle: `BUS_ATTACH → CART_START{seed} → STATE_ENTER → ACT_REQUEST → ACT_RESPONSE → CART_END{outcome}`. This is the canonical observable stream every bridge listens for (`SakuraCartEventBridge`, `ActivitySheet`, `AutomationPulseButton`, `OrchestrationBinding`).
- **INNER = `dispatchScheme`.** `driveCart`'s `executeAct` callback routes the live source through the existing perm/confirm/rate/power gate. The security boundary does NOT move — `dispatchScheme` is CALLED BY the spine, not replaced.

Single-shot non-cart verb calls — a bare `(layout-bricklay!)`, a one-off `(paint-glow …)` — keep calling `dispatchScheme` directly. They are not multi-step carts and intentionally do not raise a bus, matching the Activity Sheet's `isMultiStep` filter (`cartBus.js:65-71`).

```
[FLOW CHART: §AG.1 — two-layer spine]
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 420" width="100%" style="max-width:760px; background:#fdf6f3;" role="img" aria-label="Cart spine: outer harness loop, inner verb dispatcher">
  <defs>
    <marker id="ag1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#2e2167"/>
    </marker>
  </defs>

  <rect x="20" y="20" width="720" height="180" rx="6" fill="#fdf6f3" stroke="#2e2167" stroke-width="2"/>
  <text x="40" y="44" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">OUTER — driveCart + CartBus (cartDriver.js:67)</text>

  <rect x="40" y="60" width="120" height="50" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="100" y="82" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">BUS_ATTACH</text>
  <text x="100" y="98" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">cartDriver.js:92</text>

  <rect x="180" y="60" width="120" height="50" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="240" y="78" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">CART_START</text>
  <text x="240" y="92" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">{seed}</text>
  <text x="240" y="104" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">cartDriver.js:103</text>

  <rect x="320" y="60" width="120" height="50" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="380" y="78" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">STATE_ENTER</text>
  <text x="380" y="92" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">apply(stateFn,ctx)</text>
  <text x="380" y="104" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">cartDriver.js:122,131</text>

  <rect x="460" y="60" width="120" height="50" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="520" y="78" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">ACT_REQUEST</text>
  <text x="520" y="92" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">→ executeAct</text>
  <text x="520" y="104" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">cartDriver.js:274</text>

  <rect x="600" y="60" width="120" height="50" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="660" y="78" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">CART_END</text>
  <text x="660" y="92" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">{outcome}</text>
  <text x="660" y="104" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">cartDriver.js:510</text>

  <line x1="160" y1="85" x2="180" y2="85" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>
  <line x1="300" y1="85" x2="320" y2="85" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>
  <line x1="440" y1="85" x2="460" y2="85" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>
  <line x1="580" y1="85" x2="600" y2="85" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>

  <text x="40" y="140" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">state-machine loop: descriptor → normalize → checkInvariants → dispatch on tag</text>
  <text x="40" y="156" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">(next · done · escalate · wait · after · act · interrupted)</text>
  <text x="40" y="178" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">cartDriver.js:209-339 — while (steps &lt; maxSteps) { … }</text>

  <line x1="520" y1="200" x2="380" y2="240" stroke="#2e2167" stroke-width="1.5" marker-end="url(#ag1-arrow)"/>
  <text x="540" y="225" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#2e2167">act → executeAct(callId, verb, args)</text>

  <rect x="20" y="240" width="720" height="160" rx="6" fill="#fdf6f3" stroke="#2e2167" stroke-width="2"/>
  <text x="40" y="264" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="13" fill="#1a1a1a" font-weight="bold">INNER — dispatchScheme (runtime/dispatch.js)</text>

  <rect x="40" y="280" width="160" height="44" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="120" y="298" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">expandProgram</text>
  <text x="120" y="312" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">macro pass</text>

  <rect x="220" y="280" width="160" height="44" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="300" y="298" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">walkVerbCalls</text>
  <text x="300" y="312" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">verb extraction</text>

  <rect x="400" y="280" width="160" height="44" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="480" y="298" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">gate (5 checks)</text>
  <text x="480" y="312" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">perm/confirm/rate/power/cost</text>

  <rect x="580" y="280" width="140" height="44" rx="3" fill="#fdf6f3" stroke="#5e3c8a" stroke-width="1.2"/>
  <text x="650" y="298" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#1a1a1a">evaluate(src)</text>
  <text x="650" y="312" text-anchor="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="9" fill="#5e3c8a">trampoline + fuel</text>

  <line x1="200" y1="302" x2="220" y2="302" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>
  <line x1="380" y1="302" x2="400" y2="302" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>
  <line x1="560" y1="302" x2="580" y2="302" stroke="#2e2167" marker-end="url(#ag1-arrow)"/>

  <text x="40" y="350" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#5e3c8a">envelope returned → envelopeToResult → 'ok | 'denied → outer cart advances or escalates</text>
  <text x="40" y="370" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="10" fill="#1a1a1a">cartHost.js:113-119 envelopeToResult · cartHost.js:357-360 executeAct</text>
  <text x="40" y="388" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="11" fill="#ffb7c5">SAME seed threaded into both layers → byte-identical RNG on replay</text>
</svg>

### §AG.2 — `runCartLive` — the entry point

`runCartLive(cartId, src, caller, opts)` at `cartHost.js:205-400` is the public seam every live cart call lands on. It is async because two things in front of the inner dispatch can block on the operator: the cost-receipt pre-flight (`cartHost.js:219-317`) and the server-side ledger deduct (`cartHost.js:275-315`).

Defaults at the top of the function (`cartHost.js:206-209`):

- `seed` — defaults to `DEFAULT_SEED = 0x9e3779b9` (`cartHost.js:62`), the golden-ratio constant the cards/surface runtimes share so an unparameterised live run and a replay agree by construction.
- `fuel` — defaults to `DEFAULT_FUEL = 200000` (`cartHost.js:58`).
- `isMultiStep` — defaults to `true`; one-shot bare-verb dispatches set this `false` to stay off the Activity Sheet.
- `record` — defaults to `true`; the `CartRecorder` captures the bus into a `cart-log/v1` log for replay.

#### Pre-flight gates (in order)

1. **Cost-HMAC validation** (`cartHost.js:229-244`). For any indexed paid cart (`tokens > 0`), refuse to dispatch when the index-supplied HMAC does not match. `hmac-mismatch` and `cost-mismatch` are hard-fail returning `outcome: 'cost-hmac-rejected'`. `unsigned-index` and `unknown-slug` are honest-null: the chip says "cost: unknown" and the run proceeds.
2. **Cost-receipt pre-flight chip** (`cartHost.js:246-264`). `awaitCostPreflight` publishes a `cost-preflight` event on `chatChipBus`; the `CostReceiptChip` subscribes and reveals a Run / Cancel chip. If no subscriber is mounted the function returns immediately (`accepted: true, reason: 'no-listener'`); if no operator decision arrives within `PREFLIGHT_TIMEOUT_MS = 30000` (`cartHost.js:139`), the run proceeds with a logged warning. The "PRE-flight gates only intercept; if no listener accepts within 30s, dispatch proceeds" rule is honored — dispatch cannot be locked by an unmounted UI. White-tier carts bypass the pre-flight entirely (`cartHost.js:246-247` — `const isFreeWhite = tokens === 0 && PREFLIGHT_ZERO_COST_TIERS.has(tier)`, where `PREFLIGHT_ZERO_COST_TIERS = new Set(['white'])` at `cartHost.js:140`). Engineers debugging a missing cost-receipt chip on a white cart should look here first.
3. **Server-side ledger deduct** (`cartHost.js:275-315`). The chip said "Run" — now the ledger reflects it. `deductForCart` posts to the server before `driveCart` so the operator never sees a verb execute on tokens they don't have. Honest-null on every failure path: `cost-receipt` re-publishes with the truth (charged amount + new balance, or error reason) and the function returns `outcome: 'deduct-rejected'`.

#### Synthetic cart construction

`buildLiveCartEnv(verb, fuel)` at `cartHost.js:91-103` constructs a synthetic one-act cart whose single side-effecting state dispatches the live source through the gate. The cart is a real `(start → act → done)` state machine so it drives the bus exactly like a hand-authored `.sks` cart: orchestration recruits on `CART_START`, picks-up + carries on `ACT_REQUEST`, and succeeds or wilts on the terminal `CART_END`. The synthetic source is:

```
(define (start ctx)
  (act 'leadVerb '() 'finish))
(define (finish ctx)
  (let ((r (ctx-result ctx)))
    (if (eq? r 'denied) (escalate 'denied r) (done))))
```

`leadVerb(src)` at `cartHost.js:71-79` extracts the first verb-call from the source so the act has a meaningful name; the choreography (orchestration's sprite-routine picker) reads this. Falls back to `'run'` when the source has no `Sym`-headed application.

#### The inner gate callback

`executeAct` at `cartHost.js:357-360` is the bridge from outer to inner:

```
const executeAct = async () => {
  dispatch = dispatchScheme(src, caller, { fuel, seed })
  return envelopeToResult(dispatch)
}
```

`driveCart` calls this exactly once for the synthetic cart's single act. The same `seed` is threaded into both layers (`cartHost.js:331,374` stamp it onto `CART_START` and pass it to `dispatchScheme`), so `(random)` inside the run is byte-identical to a replay under the same seed. The same fuel object covers both layers, so a runaway program inside the inner dispatch is killed by the outer trampoline.

`envelopeToResult` at `cartHost.js:113-119` maps the dispatch envelope to the Scheme result the cart's result-handler reads via `(ctx-result ctx)`. A rejected verb becomes the symbol `'denied` so the cart escalates and the orchestration wilts — a failed action cannot animate success. The only two outputs are `'ok` and `'denied`.

#### Thread-bus and activity-bar bracketing

Two side-rails run around the inner dispatch:

- **`sakuraThreadBus`** (`cartHost.js:329-332, 383-389`) — best-effort `publishCartStart` before and `publishCartDone` after. The unified `curator:sakura-thread` stream lets any panel see talking + doing on one observable; the call is guarded so the cart never breaks on a bus failure.
- **Card activity bar** (`cartHost.js:341-351, 378`) — `beginCardActivity` / `endCardActivity` bracket the cart's lifetime on its target card so the rainbow paints on that card's chrome while the cart runs. When `opts.targetCardId` is omitted the call is a no-op — no bar shows, no harm done. Honest fall-back.

### §AG.3 — `driveCart` — the state-machine loop

`driveCart(opts)` at `cartDriver.js:67-345` is the outer harness loop. It accepts a cart `env` with the cart's `(define (state-name ctx) …)` forms already bound and drives them through their descriptors, emitting bus events at every transition.

#### Initialisation

Lines `cartDriver.js:80-108`:

- The bus is taken from `opts.bus` or freshly constructed; `setInitialCtx` records the cart's initial context so the recorder can write it into the log envelope.
- `BUS_ATTACH` is dispatched on `window` so mounted bridges (`SakuraCartEventBridge`, `ActivitySheet`, `AutomationPulseButton`) bind to THIS bus BEFORE the first event fires. Best-effort: a missing `window` (tests, SSR) or a throwing listener never breaks the run.
- `CART_START` stamps the run seed. This is the load-bearing field for byte-identical replay across the two tiers (G2 reconciliation): the K7 projection in `cartProjection.js` threads the SAME seed onto every derived action.
- The state cursor is initialised to `'start'`, the ctx to `initialCtx`, and the fuel object to `{n: 50000}` when not supplied (`cartDriver.js:108`). In practice `runCartLive` always supplies `fuel` (`DEFAULT_FUEL = 200000` at `cartHost.js:58`), so the `{n: 50000}` `driveCart` fallback is reached only by callers that bypass `runCartLive` — typically tests.
- `simMode` is derived from `(ctx-mode ctx)`; when `'sim'`, the optional `executeSim` runner takes precedence over `executeAct` for every act in the cart.

#### The loop

`while (steps < maxSteps)` at `cartDriver.js:111` runs until a descriptor terminates the cart or the cap is reached. `maxSteps` defaults to 200 (`cartDriver.js:76`); a cart that loops past the cap emits an error event and ends with `outcome: 'halted', reason: 'max-steps'` (`cartDriver.js:342-344`).

Each iteration:

1. **Look up the state function** (`cartDriver.js:115-120`). A missing state fn emits `ERROR` + `CART_END{halted, reason: 'unknown state'}` and returns.
2. **Emit `STATE_ENTER`** (`cartDriver.js:122-125`) with `ctx_hash` so the replayer can verify the context shape hasn't drifted.
3. **Apply the state fn** (`cartDriver.js:129-174`). `apply(fn, [ctx], f)` re-enters the evaluator's trampoline so deep recursion stays safe. A primitive crash inside the state body lands in the catch at `cartDriver.js:132-174` and emits `PRIMITIVE_CRASH` + `ERROR` + `CART_END{halted, reason: 'primitive-crash'}`.
4. **Normalise the descriptor** (`cartDriver.js:177-185`). `normalizeDescriptor(d)` at `cartDriver.js:352-417` translates the Scheme list — like `(next 'X ctx)` — to a uniform `{tag, …}` shape and throws `TrapError` on a malformed return. A trap emits `ERROR` + `CART_END{halted, reason: 'descriptor-trap'}`.
5. **Check invariants** (`cartDriver.js:187-202`). `checkInvariants` from `cartInvariants.js` runs at every transition boundary; a violation emits `ERROR` + `CART_END{halted, reason: 'invariant-violation'}`.
6. **Emit `STATE_EXIT`** (`cartDriver.js:204-207`) with the descriptor preview.
7. **Dispatch on `d.tag`** (`cartDriver.js:209-339`).

#### Descriptor dispatch

| Tag | Effect | Emitted event | Code |
|---|---|---|---|
| `done`        | terminal success                  | `CART_END{done}`                       | `cartDriver.js:210-212` |
| `next`        | advance to `d.name` with `d.ctx`  | (loop continues)                        | `cartDriver.js:214-217` |
| `escalate`    | paused; `kind` + `detail` carried | `ESCALATE` + `CART_END{escalated}`     | `cartDriver.js:219-226` |
| `interrupted` | live-voice interruption           | `INTERRUPTED` + `CART_END{interrupted}` | `cartDriver.js:228-234` |
| `after`       | nominal sleep; advance now        | `AFTER` (no real sleep)                 | `cartDriver.js:236-245` |
| `wait`        | block until `event` fires         | `WAIT` + `CART_END{waiting}`            | `cartDriver.js:247-254` |
| `act`         | dispatch verb through `executeAct` | `ACT_REQUEST` + `ACT_RESPONSE`         | `cartDriver.js:256-329` |

The `act` path is the most consequential. Lines `cartDriver.js:260-271` apply the destructive-verb gate: if the verb is in the host's `destructiveVerbs` set and the args don't carry `operator_confirmed: true` (checked by `_argsCarryConsent` at `cartDriver.js:493-508`), the cart routes through `(escalate 'consent-required)` so the surface renders a consent chip. The gate sits BEFORE the executor is called — the dispatch path never starts on a destructive verb without confirmation.

Lines `cartDriver.js:273-313` run the executor. The runner is `executeSim` when `simMode && executeSim`, otherwise `executeAct`. The 4th argument is the per-act preamble (PREAMBLE-ENVELOPE-DESIGN-2026-06-15): the base preamble with `state`, `step_index`, and `turn_phase: 'act'` stamped on. Legacy 3-arg executors ignore the extra arg and keep working.

A thrown executor lands in the catch at `cartDriver.js:305-308` as `transportError`; lines `cartDriver.js:314-325` emit `ESCALATE{transport-error}` + `CART_END{escalated}`. The operator sees a clean failure rather than the cart pretending the call succeeded with an error blob.

On success, `stateName = d.onResult` and the ctx is extended with `(last-result <result>)` via `withCtx` (`cartDriver.js:428-432`). The next iteration looks up the new state and runs.

##### The two-brain escalation split (4B → 15B deep-think)

Not every `escalate` is the same thing any more. The 2026-07-02 architecture
introduced two on-device-adjacent models: a **4B** on-device router/composer
that handles the turn, and a **15B** Cortex-resident deep reasoner reached
**asynchronously** through a duration-priced Loam job. When the 4B hits a wall,
it does not block a human synchronously — it self-issues an escalation, and a
pure classifier decides which of two paths that escalation takes:

- **SURFACE** — a human, not the 15B, is the right resolver (consent, a hard
  transport failure, a payment wall, an explicit request for operator input).
  Synchronous; this is the legacy behaviour, unchanged.
- **DEEP-THINK** — the 4B is handing a reasoning problem to the 15B. This
  becomes an async Loam job: enqueued, duration-priced, gated behind a ~15-min
  backoff window (`DEEP_THINK_BACKOFF_MS`). The operator is NOT blocked; the
  answer returns later via the discuss-queue on the ~20-min wake loop.

The classifier is `classifyEscalation(kind, detail)` in
`curator-web/src/scheme/runtime/escalationPolicy.js`. `DEEP_THINK_KINDS`
(`deep-think`, `reasoning-required`, `ambiguous`, `plan-required`,
`research-required`) route to the reasoner; `SURFACE_KINDS` and — critically —
**every unknown kind** default to SURFACE, the safe direction (a human sees
it). In the driver's `case 'escalate'` (`cartDriver.js`), a deep-think route
emits an additive `DEEP_THINK` bus event (`cartBus.js` `EVENT_TYPES.DEEP_THINK`)
carrying the job intent from `buildDeepThinkJob(...)`, then falls through to the
normal `ESCALATE` + `CART_END{escalated}` path. Because the cart still ends
`escalated` and `DEEP_THINK` is excluded from the replay-divergence key
(cartReplayer compares only `STATE_ENTER` + `ACT_REQUEST`), the change is purely
additive — no golden moves, no driver-contract change.

Authors reach this through legible sugar in
`curator-web/src/scheme/escalationVerbs.js`: `(think/deep 'kind detail [tier])`
for the general hand-off and `(ask/reasoner "question" [tier])` for the common
case. Both lower to an ordinary `(escalate 'kind detail)` descriptor — the verbs
only DESCRIBE the hand-off.

**Honesty (no fake success).** No Loam job queue exists yet. `buildDeepThinkJob`
produces only the job INTENT — a fully-formed, deterministic, replayable
descriptor with `enqueued_at: null`. The backend mirror
(`curator-api/curator_api/routes/verb_backings.py` `POST /deep-think/enqueue`)
returns `{ok:true, degraded:true, reason:"deep-think-queue-not-yet-wired",
job:{…}}` — it honest-nulls the enqueue rather than pretending a queued success.
The JS `_DEEP_THINK_TIERS`/`DEEP_THINK_TIERS` tables are kept byte-parallel so
JS and Python size the same job identically. `jobKey` is derived
(`deepthink:${cartId}:${state}:${kind}`), not random, so `withinBackoff(...)`
can dedupe a re-issued escalation onto the in-flight one.

<!-- LIVING:TODO(2026-07-02): flip /deep-think/enqueue from honest-null to a real Loam job enqueue once the duration-priced job queue lands (#463/#474/#477/#478); stamp enqueued_at + wire discuss-queue delivery on the wake loop. -->
<!-- LIVING:RESEARCH(2026-07-02): confirm the 15B wake-loop discuss-queue delivery contract against the two-brain message-passing rewrite (#462/#478) before wiring the real queue. -->
*[needs: live deep-think round-trip latency once the 15B Loam job queue is wired]*

### §AG.4 — `CartBus` — the event stream

`CartBus` at `cartBus.js:64-169` is the message-passing trace spine. Every cart run emits a typed event stream consumed by the live D3 visualisation (`CartFlowChart`), the recorder (writes events to a log buffer for replay), and the replayer (drives a fresh cart, intercepts act calls, returns responses from the log so the same sequence emerges).

Replay is the load-bearing feature — an operator's prod log replays identically on our laptop. The requirements documented at `cartBus.js:9-16` are:

1. Every event carries a sequence number + monotonic timestamp.
2. Every `(state, ctx)` is serialisable (no closures in descriptors).
3. Tool calls are uniquely identified by `(verb, args-hash)` so the replayer can correlate response → request.

#### Event types

The frozen enum at `cartBus.js:28-56`:

```
CART_START · CART_END · STATE_ENTER · STATE_EXIT · ACT_REQUEST
ACT_RESPONSE · ACT_PROGRESS · ESCALATE · WAIT · AFTER · ERROR
INTERRUPTED · PRIMITIVE_CRASH
```

`EVENT_TYPE_SET` at `cartBus.js:62` is the membership set for fast emit-time validation; `emit()` previously called `Object.values(EVENT_TYPES).includes(type)` and rebuilt the array per event — measurable cost on hot cart runs.

Event payload shapes live in `cartEventNames.js` (the constant string names every bridge listens on) and `cartBus.js:28-56` (the type-by-type payload key list). New event types add to both files in the same commit.

`ACT_PROGRESS` (`cartBus.js:35-40`) is optional fine-grained progress for a long-running act. It is DELIBERATELY excluded from the replay-divergence comparison key (`cartReplayer` only compares `STATE_ENTER` + `ACT_REQUEST`), so emitting it — or not — can never make a replay diverge. `bus.emitProgress(p, payload)` at `cartBus.js:165-168` is the convenience wrapper.

`PRIMITIVE_CRASH` (`cartBus.js:46-55`) is distinct from `ERROR` so observers can quarantine the failing verb, persist the breadcrumb, and decide whether to retry, skip, or escalate. The payload shape is `{cartSlug, state, primitive, message, stack, timestamp, ctxKeys}`; `ctxKeys` names ctx slots present at crash time but never their values (a crash should not leak operator data into the log bus). The Priya H1 security fix at `cartDriver.js:478-491` enforces a whitelist regex on those keys — anything that doesn't match `/^[a-z_][\w\-/]*$/i` is elided to `<unsafe-key>`.

#### `emit(type, payload)`

The hot path at `cartBus.js:95-139`:

- Reject unknown event types with a thrown error (`cartBus.js:96-98`). Throwing rather than silently dropping forces the producer to declare every event up-front.
- Capture `nowMs()` once per emit (`cartBus.js:103`). Previously called three times — `startedAt`, `t`, `dt_ms` — each going through a `typeof performance` branch.
- Shallow-clone the payload via `shallowClone` (`cartBus.js:178-183`) so a subscriber can't mutate state shared with the driver.
- Stamp `isMultiStep` onto every event (`cartBus.js:108-109`). Payload-level override wins; otherwise the bus's own `isMultiStep` is used.
- Freeze the event via `Object.freeze` so the canonical event cannot be mutated after dispatch (`cartBus.js:110`).
- Call every subscriber inside `try/catch` (`cartBus.js:120-125`). A subscriber that throws is logged but never breaks the run.
- Mirror multi-step events to the chip sink (`cartBus.js:131-137`) via `_busEventToChip` (`cartBus.js:226-246`). Single-step carts are filtered out — only multi-step workflows become chips, matching the Activity Sheet's surface filter (OAB #11).

#### Event shape

Every event is the frozen object:

```
{ seq, t, dt_ms, cartId, runId, type, …payload, isMultiStep }
```

- `seq` — monotonic per-bus counter starting at 0 (`cartBus.js:73`).
- `t` — `performance.now()` if available, else `Date.now()` (`cartBus.js:173-176`).
- `dt_ms` — `t - startedAt`; the bus stamps `startedAt` on the first emit (`cartBus.js:104`).
- `cartId` / `runId` — the bus's identity; `runId` defaults to `run-${Date.now()}-${random}` (`cartBus.js:75`).
- `type` — one of `EVENT_TYPES`.
- Payload keys spread last; `isMultiStep` re-stamped after the spread so a payload that names it does not lose the bus default.

`ctxHash(v)` at `cartBus.js:197-205` is the 32-bit FNV-1a deterministic fingerprint stamped on every `STATE_ENTER` and `STATE_EXIT`. Replay verifies the recorded hash matches the live hash — if the context shape drifts between record and replay, the comparison fails fast at the next transition.

`canonicalJSON` at `cartBus.js:207-212` is the FNV-1a input: object keys sorted, arrays preserved in order. The hash is therefore stable across JS engine implementations and cart versions that don't change the structural shape of the ctx.

### §AG.5 — Determinism: seed, cost-HMAC, byte-identical replay

The determinism story has three load-bearing pieces, each cited where it lives:

1. **Seed threading.** `runCartLive` chooses `seed` (`cartHost.js:206`), passes it to `driveCart` via `opts.seed`, and inside `executeAct` passes it to `dispatchScheme(src, caller, { fuel, seed })` (`cartHost.js:358`). `driveCart` stamps the seed onto `CART_START.seed` (`cartDriver.js:103`). The K7 projection in `cartProjection.js` threads the SAME seed onto every derived action, so a recorded run replays byte-identical when the seed is the same. The default is `0x9e3779b9` (`cartHost.js:62`), shared with the cards/surface runtimes so an unparameterised live run and a replay agree by construction.

2. **Cost-HMAC validation.** Indexed paid carts carry a build-time HMAC over `(slug, cost_tokens)`. `runCartLive` reads the HMAC from the cart index (`getCostHmacFromIndex` at `cartHost.js:230, 276`), calls `validateCartCost` (`cartHost.js:232`), and refuses to dispatch when `hmac-mismatch` or `cost-mismatch` is returned. The check protects against a tampered bundle: a cart whose `cost_tokens` field has been edited without re-signing the index will hard-fail before any verb runs.

3. **CART_START → drive → CART_END.** Every cart run starts with exactly one `CART_START` and ends with exactly one `CART_END`. `_emitCartEnd` at `cartDriver.js:510-513` is the only `CART_END` producer; every terminal branch in the loop calls it. The bridges (`SakuraCartEventBridge`, `ActivitySheet`, `OrchestrationBinding`) listen for `CART_END` to unsubscribe themselves, so a missing terminal leaks a subscription. The structural invariant the spine maintains is: BUS_ATTACH happens once before CART_START; CART_START happens once before any STATE_ENTER; CART_END happens once after every other event, regardless of outcome.

### §AG.6 — Where events go

Bus events flow to three destinations:

1. **Direct subscribers.** Anything that called `bus.on(handler)` receives every event in order. The handler signature is `(event) => void`; the returned unsubscribe function removes the handler from the Set.

2. **The `window` event bridge** (`cartDriver.js:90-97`). `BUS_ATTACH` is dispatched as a `CustomEvent` on `window` so mounted bridges can self-subscribe. The event name comes from `cartEventNames.js`'s `CART_EVENTS.BUS_ATTACH`. The dispatch is guarded; SSR and tests with no `window` skip it cleanly.

3. **The chip sink** (`cartBus.js:131-137`). `writeChip(_busEventToChip(evt))` converts every multi-step bus event into a `chip.v1` envelope. The mapping at `cartBus.js:215-246` is:

   - `kind` = `cart.${evt.type}` (e.g. `cart.state-enter`, `cart.act-request`)
   - `platform` = `'system'` (carts are the curator runtime, not a marketplace)
   - `payload` = the whole bus event (already cloned + frozen by `emit`)
   - `operator_id` = payload `operator_id` if present, else `cartId`, else `'unknown'`
   - `tags` = `[cart:${cartId}, run:${runId}]` when present
   - `t`, `id`, `signature`, `schema` — filled by the `chipEvent` factory

The chip sink is how operators (and Sakura) drag log entries straight into automations without any marshaling step. The factory throws on a malformed input; the caller guards with `try/catch` (`cartBus.js:132-136`) so a bad chip never breaks the cart run.

### §AG.7 — Return shape

`runCartLive` returns:

```
{
  ok:                  boolean,        // inner dispatch succeeded
  outcome:             string,         // driveCart terminal ('done' | 'escalated' | …)
  dispatch:            object,         // raw dispatchScheme envelope
  value:               any,            // dispatch.value on success
  bus:                 CartBus,        // the live bus
  log:                 object|null,    // cart-log/v1 envelope when record !== false
  cancelledByOperator: boolean,        // set on cost-preflight cancel path
  ledger:              object|null,    // set on deduct-rejected path
}
```

The function never throws — a runtime error inside the inner dispatch is caught and surfaced as a failed run (the cart escalates, orchestration wilts). Callers that want the plain envelope read `.dispatch`. The contract documented at `cartHost.js:192-203` is the canonical shape; any caller that branches on the return must handle all five outcome shapes (success, cost-hmac-rejected, cancelled, deduct-rejected, run-completed-with-failure).

### §AG.8 — Honest gaps

- **`act-progress` is not yet a typical emit.** Most carts call `executeAct` and wait for the response; `bus.emitProgress(p)` is implemented but only a few long-running verbs use it. The spine accepts it cleanly; cart authors should call it for any act expected to take > 2s wall-clock.
- **`wait` descriptors do not actually sleep.** `wait` returns `CART_END{waiting}` and the cart is suspended; resuming on event arrival is the host's job, not the driver's. `after` likewise does not sleep — it stamps `AFTER` on the bus and advances immediately (`cartDriver.js:236-245`).
- **The destructive-verb gate is host-supplied.** `driveCart` accepts `destructiveVerbs: Set<string>` as an option (`cartDriver.js:73`); when omitted, no consent gate runs. The host (`runCartLive`'s caller chain, the studio, the replayer) decides the set. A future centralisation into the verb registry's `perm` field would make this automatic; today it is opt-in per-call.
- **The post-2026-06-22 line numbers may drift.** The SRE pass at §20 documents the practice: structure is load-bearing, line numbers drift ~20-50 lines on the hot files between cuts. Re-run `grep -n "^export\|^function\|^const\|class\|case '\w" <file>` on each cited file when bumping numbers.

---

## §AG-duplex. The duplex session (PUPPET-MASTER SUITE, 2026-07-03)

Until now the runtime was a **one-shot compute**: the host handed a Scheme
program to `runWithCards`, got back a value / sprite list, and the world moved
once. The PUPPET-MASTER SUITE adds the missing half — a **duplex session** so
Sakura drives the live desk over many turns, seeing consequences and pacing
herself. Three channels, all grounded on the existing `sakuraThreadBus` ring
and the ONE `paint/overlay` rAF (no second loop, no second world model).

**COMMAND (LLM → surface).** She emits ONE Scheme program per turn; it composes
any verb in the §11 "max hands" inventory. Commands are STAGED, not fired blind:
`lib/sakuraCommandQueue.js` gives each a TTL (default 1500 ms) and a coalesce
key. A command computed against a 2-second-stale surface is **dropped** before
dispatch — `error.quarantined{command-ttl-expired}` — rather than applied wrong
(Event-Queue "discard stale" pattern). Coalescing is latest-wins: a rapid
camera re-aim supersedes the older pending dolly. Survivors dispatch through the
scheduler as `kind:'work'` intents.

**EVENT (surface → LLM).** Every consequence lands as a typed surface event
through the `lib/surfaceEvents.js` chokepoint — a frozen `SURFACE_EVENTS`
catalog (card/flower/camera/clip/anim/audio + error/illusion), each stamped
`ts`/`corr`/`prio`. An uncatalogued kind is rejected (returns `null` + warn),
never fabricated. `corr` (`lib/corr.js`) ties an event back to the command that
caused it (two-phase: accepted vs arrived); `liveBridge.js` mints a `corr` per
turn and brackets the eval in `runWithCorr` so publishers inherit it.

**STATE (LLM reads).** `surface/digest` (`lib/sakuraDigest.js`) folds the event
ring by `(kind,target)→newest`, ranks `prio desc, ts desc`, caps at
`DIGEST_MAX=24`, and demotes self-caused (`corr`-matched) events one salience
band — so she reads a coalesced, natural-language delta of what changed since
her last turn, not a firehose. `surface/describe` / `system/surface`
(`lib/surfaceSnapshot.js`) return the full current tableau; `system/*`
(`systemIntrospectVerbs.js`) expose the registry, card roster, her own
scheduler tanks, and a best-effort health read. Every slice is honest-null: a
dark subsystem returns `null`/`[]`.

**The pacing spine.** `lib/sakuraScheduler.js` is ONE priority queue with TWO
token buckets — `work` and `speech` — drained weighted-fair with age-based
anti-starvation, a bounded `Q_MAX=64` mailbox (drop-oldest-lowest back-pressure
with an honest notice), TTL sweep, and `PER_TICK_DISPATCH=3`. It rides the
existing overlay rAF via a fixed-timestep accumulator (`FIXED_STEP_MS=16.6`)
registered as a `system:true` handle. **Two fuels stay separate:** the
interpreter's `f.n` safety cap (`DEFAULT_FUEL=200000`) is untouched; the
scheduler fuel is a pacing throttle only.

**Card transitions + the illusions.** `cardTransitions.js` names transitions
(`slide`/`no-slide`/`dematerialize`/`waft`/`chubby-walk`) as pure descriptors
over the existing motion primitives; reduced-motion collapses the LOOK to
`no-slide` without changing dispatch. `dematerialize` carries `teardown:true`
and delegates to `cardIllusions.js` (`index.js` wires the delegate to
`transporterTeardown`). The three memory-leak illusions — Transporter Teardown,
Depth-of-Field Eviction, Scene Change — turn teardown into theater under a
non-negotiable **honesty guard**: persist unsaved operator intent BEFORE
teardown; if persistence fails, **abort** and leave the card live
(`error.quarantined{illusion-aborted-persist-failed}`). Each successful illusion
emits `illusion.applied` so SRE/telemetry see the real teardown behind the
theater.

> **COSMETIC-UNTIL-PROFILED (honest gap).** `cardIllusions.js` builds the
> MECHANISM; it does not prove the teardown frees retained heap — that needs an
> on-device heap-profiler trace. Until that trace confirms the free, Illusion A
> is cosmetic: it plays the theater and fires the event, but the GC is
> UNVERIFIED. Do not sell it as a garbage-collector before the profiler pass.

**Whitelist + parity.** Namespaces `surface`, `system`, `card` are whitelisted
in `registry/VerbRegistry.js`; `registry/maxHands.contract.test.js` asserts
every advertised `[new]` lever resolves in `warmedRegistrySnapshot()` — code↔doc
parity, no phantom hands. The full verb catalog with examples is
[`REFERENCE.md`](REFERENCE.md) §17.

<!-- LIVING:TODO(2026-07-03): confirm on a real heap profiler that per-card
     dematerialize teardown actually frees retained heap; until then Illusion A
     is cosmetic-until-profiled. -->
<!-- LIVING:USE-CHECK(2026-07-03): card/ask live cross-card answer routing —
     the answer bus is wired (resolveAsk), but production surface-side routing
     of a target card's answer is deferred; kill-or-keep after N sessions. -->

---

## §AG-physics. Position-Based Dynamics (MARIONETTE-PHYSICS, 2026-07-03, #610)

Before this, every non-trivial motion was hand-authored keyframes. PBD replaces
the hand-drawing with a **parameter regime**: give a body a mass, a drag, a
bounce, and some links, and the world derives the motion. The design goal
(architect verbatim) was "sickeningly powerful and horrifyingly simple" — the
whole surface is eight verbs (§19.7 of the Reference), and it reuses the
integrator that was already there.

**Predict-then-project.** The world's existing semi-implicit Euler step
(`integrate`, `marionetteWorld.js`) is the *predict* pass — it advances `x/y`
from `vx/vy` and gravity as before. PBD adds a *project* pass in the reconcile
block (`marionetteWorld.js:769-793`): after prediction, `solveConstraints`
(`marionetteWorld.js:887`) runs `_solveIters` Gauss-Seidel sweeps that move each
linked particle back toward its rest length, then velocity is **re-derived** from
the net frame displacement (Verlet-style, `vx = (x − _px)·(1−drag)`), so a
satisfied constraint bleeds off the velocity that violated it. This is the
Jakobsen (GDC 2001) / Müller (PBD 2007) formulation.

**Inverse mass is the weight knob.** `e.data.__im = 1/mass` (`entityMass`,
`:917`); `__im === 0` means pinned/infinite-mass — the particle is skipped in
both integrate (`:729`) and reconcile, so an anchor never drifts. Constraint
corrections distribute by inverse-mass weights (`wa/wsum`, `wb/wsum`), so a heavy
body barely yields to a light one on the same link. **Weight/material feel is
entirely this regime** — mass · drag · link-stiffness · floor-bounce on the
`:embodiment` axis of the motion 5-tuple — never a per-material verb. Heavy brick
= high mass + short bounce + zero drift; floaty petal = low mass + high drag +
soft links.

**Determinism — the sacred spine held with zero hash change.** The prev-position
PBD needs for the Verlet velocity is stored in **per-step transient JS props**
`e._px`/`e._py` (`:725`), written at the top of each integrate and read in
reconcile. They are plain properties, **never enumerated** in `worldSnapshot` or
folded into `worldHash` — because positions and velocities are *already* hashed,
byte-identical replay holds with no change to the hash function. Links solve in
fixed insertion order; distance is `dhypot` (`detMath.js`, fround-shimmed →
IEEE-754 deterministic); no `Math.random`/`Date.now` enters the solver. The
persistent physics state — `_links` (`{a,b,rest,stiff}`), `_solveIters`, `_floor`
(`{y,r}`) — **does** serialize through `worldSnapshot` / `worldRestore`, so a
constrained world survives a restore and continues identically to the ground
truth. Both properties are proven in `marionetteWorld.test.js`: a five-bead rope
on a floor satisfies `run() ≡ run()`, and a snapshot taken mid-fall restores to a
hash-identical continuation.

**Honest-null — no dead knobs.** Every parameter is wired. `world/floor!`'s
optional bounce (`_floor.r`) is read as the **fallback** restitution when the
entity carries no own `entity/bounce!` — the self-caught defect during the build
was a floor bounce arg that stored but never applied; it is now the documented
fallback. Missing ids are no-ops on all mutators; a self-link or a negative rest
length returns a bad-arg envelope rather than corrupting the solver.

> **PHYSICS GOLDEN GATE — PENDING VISUAL.** The eight verbs are green through the
> real interpreter (physics describe block in `marionetteWorld.test.js`), but the
> filmable side-by-side (heavy vs. floaty drop, swinging rope) is **not yet
> rendered on-device**. Flagged pending per the visual-golden-gate discipline.

<!-- LIVING:TODO(2026-07-03): render the heavy-brick-vs-floaty-petal PBD artifact
     (GIF/MP4 through the real interpreter) to clear the physics golden gate. -->

---

## §20. Approval

- **🧠 Soo-Jin** (Scheme composition lead, author): _signed 2026-06-15_
- **🏛️ Architect** (approver): [signed / NACK]

### SRE pass — 2026-06-22 — line-citation drift advisory

A code↔doc parity sweep at 2026-06-22 spot-checked the Architect
verification checklist above against current code. **Structure: still
load-bearing. Line numbers: drifted ~20-50 lines on the hot files.**

| Citation | At 2026-06-15 cut | At 2026-06-22 HEAD | Status |
|---|---|---|---|
| `interp.js · freeze()` | `:137-164` | `:154 · freeze()` | line drift |
| `interp.js · Tail/TailCall sentinels` | `:226-248` | `:9-37` (defs) | partial drift (defs vs trampoline body separated) |
| `interp.js · fuel throw` | `:251` | `:258` (in `evalStep`) | line drift |
| `dispatch.js · TIER_PERMS` | `:65-72` | `:70 · TIER_PERMS` | accurate |
| `dispatch.js · dispatchScheme` | `:525-590` (impl) | `:530 · dispatchScheme` | minor drift |
| `dispatch.js · audit schema` | `:383-422` | `:424 · AUDIT_LINE_KEYS` | drift |
| `cartDriver.js · driveCart` | `:57-281` | `:67 · driveCart` | drift |
| `safetyStars.js · withStars` | `:48-150` | (verify on next pass) | TBD |
| `cartLoader.js · eager+lazy` | `:16-79` | (verify on next pass) | TBD |
| `primitives/index.js · installAnimationEngine` | `:32-62` | `:55 · installAnimationEngine` | drift |

**No structural lies surfaced.** Every cited file still contains the
named export / class / function in the same role. The drift is purely
from intervening commits + comments. Action for the next cut: re-run
`grep -n "^export\|^function\|^const\|class Env\|case '\w" <file>` on
each cited file and bump the numbers.

**Citation format adopted by the SRE pass:** `` `file.ext:Line · functionName()` `` (dot-separator). The existing range-form `file.ext:Line-Line` continues to be honored; new entries should prefer dot-separator for the LLM training corpus's benefit (one-line cite = one parseable token sequence).

**One STALE flag surfaced in the companion REFERENCE doc**, fixed inline there: the §11 entries for `(card-do …)` / `(card-emit …)` / `(card-ask …)` cited `registry/coreVerbs.js:158-192` — those verbs are NOT in coreVerbs.js. They are at `curator-web/src/scheme/primitives/card.js:140-170`. See REFERENCE doc §11 for the patched citations.

### Architect verification checklist

Every architectural claim in this doc maps to actual code in the
repo. Architect: please verify against the cited `file:line` anchors
and either affirm or flag NACK with the file:line you checked.

Key claims to verify:

- §4.3: TCO via `Tail` / `TailCall` sentinels —
  `curator-web/src/scheme/interp.js:226-248`.
- §4.3: Fuel-throw at `evalStep` entry —
  `curator-web/src/scheme/interp.js:251`.
- §4.4: `freeze()` substrate-lock —
  `curator-web/src/scheme/interp.js:137-164`.
- §5.3: Five installers + skip-not-clobber wrapper —
  `curator-web/src/scheme/primitives/index.js:32-62`.
- §5.1: VerbRegistry signature contract —
  `curator-web/src/scheme/registry/VerbRegistry.js:104-163`.
- §6.1: Dispatcher gate-flow —
  `curator-web/src/scheme/runtime/dispatch.js:1-33` (comment) +
  `525-590` (impl).
- §6.2: Tier→perms lookup table —
  `curator-web/src/scheme/runtime/dispatch.js:65-72`.
- §6.4: Audit-line schema —
  `curator-web/src/scheme/runtime/dispatch.js:383-422`.
- §6.5: `'service-not-yet-wired` discipline — example at
  `curator-web/src/scheme/shopVerbsRuntime.js:498-502` +
  `carts/personal/daily-news-brief.sks:121,124`.
- §7.1: Eight-star wrapper —
  `curator-web/src/scheme/safetyStars.js:48-150`.
- §7.2: `driveCart` walk —
  `curator-web/src/scheme/cartDriver.js:57-281`.
- §12.2: Cache pattern in writer —
  `scripts/write_carts.py:85-126`.
- §12.2: Session-cache numbers —
  `docs/L1-ORCHESTRATION-DESIGN.md:100-152`.
- §12.1-12.3: Writer prompt + validator chain —
  `scripts/write_carts.py:85-186` + `cartLint.js`.
- §9.1-9.2: Cart loader eager+lazy —
  `curator-web/src/scheme/cartLoader.js:16-79`.

If any claim above does not check out against the named anchor, the
Architect MUST NACK with the file:line they checked and the
discrepancy they found.

### Change log

- **2026-06-19 (pricing + architecture pivot)** — Pricing ladder
  updated to Free / Imagine $9.99 / Dream $39.99 / Magic $99.99
  (supersedes June 14 $19.99/$59.99/$99.99 lock). LLM architecture
  pivoted: 1.7B = local router/executor only; 8B on Fly (Engram) =
  brain; gRPC pipe for Cortex mirroring. See `SAKURA-LLM-CANONICAL.md`
  Part XI (§39–§42) for the full pivot spec. Tier philosophy locked:
  tiers = bots (LOAM services), not reasoning quality.

- **2026-06-18 (token cost model)** — `verbCosts.js` (68 lines,
  `curator-web/src/scheme/verbCosts.js`) added as the single source
  of truth for per-verb token costs. Multiplier hierarchy LOCKED:
  L0/Scheme=1, L2=10, L3=100, MCMC=1,500, Loam=1,500. Functions:
  `tokenCostForVerb(verb)`, `cartTokenCost(verbs[])`. Verb namespace
  → tier mapping: sakura/*=1; cortex/lacuna/loam/pii/etsy/ebay/
  shopify/meta/instagram/ads/ship/stripe/web=10; model/vision/
  documents/analytics=100; mcmc/* and loam/* (except
  loam/operator-state)=1,500. Cart index now includes
  `cost_tokens`, `cost_hmac`, `cost_breakdown` per entry (HMAC
  signing implementation is a wave-4 blocker; design spec at
  `docs/PRICING-TOKEN-DESIGN-2026-06-18.md`). Full token budget +
  daily-drip model also at that doc.

- **2026-06-17/18 (automations trigger system)** — `matchingEngine.js`
  (175 lines, `curator-web/src/scheme/automations/matchingEngine.js`)
  added — O(log n) cart matching against surface signals. Cart index
  entries now carry `trigger_type`, `trigger_cadence`, `cost_tokens`
  fields (written by `build_cart_index.mjs`). Analysis tab wired:
  chip cost badge reads `cost_tokens`; 26 matching engine tests pass.

- **2026-06-17 (card control verbs)** — Five new verbs registered in
  VerbRegistry under the `card` namespace:
  `card/tiles` (returns tile grid map),
  `card/where` (tile address of named card),
  `card/move` (move to tile; motion modes: `:slide`/`:warp`/`:carry`),
  `card/swap` (swap two cards' tile positions),
  `card/organize` (full layout pass with optional grouping).
  Implementation: `curator-web/src/scheme/primitives/cardControlVerbs.js`
  (226 lines). Training corpus: `corpus/card-control-corpus.jsonl`
  (30 intent→Scheme pairs). Warp animation: `@keyframes card-warp-out/in`
  in `HelloSurface.jsx`. HARD GATE: do not train until "train her now."

- **2026-06-15 (restructure)** — Soo-Jin folded the original 14
  flat sections into the §0–§20 skeleton mirroring HelloSurface
  1.0's structural pattern. New: §1 (Why Scheme), §2 (S70 standard),
  §11 (Browser budgets), §13 (Cart-writing procedure), §14
  (Interactions with other subsystems), §18 (Glossary), §19
  (References). All file:line citations from the prior cut carried
  through; ASCII flow-chart placeholders added at §3.2, §4.5, §6.1,
  §7.1, §7.2, §8, §10.4, §12.2, §13.1.


---

# §87 — 87 Language Features Roundup (added 2026-07-11)

> **Source:** consolidated from `engineering-doc-themes-2026-07-10.md` Appendices 11-15 (Zain 22 + Jess 23 + Marcus 22 + Priya 20). Full list resides in the Engineering-Themes doc during transitional pass; will be inlined here in next revision. Reference-material only.
>
> **Zain 22:** language semantics extensions (tail-position tracking hardening, hygienic-macro escape hatch, macro-write for artifact/*, quasiquote for slat forms, syntax-parameterize, etc.)
> **Jess 23:** doc/test-facing features (self-test carts, doctest lifting, verb-help annotations, printer round-trip, verb-registry export, etc.)
> **Marcus 22:** runtime/SRE (heap-limit prompts, verb-cost meter, cortex-of-loam glue, hot-cache eviction verbs, telemetry probes, etc.)
> **Priya 20:** security (sandboxed eval, capability-scoped perms, taint tracking, signed carts + SBOM, at-rest encryption, secret redaction, hallucination-refuse mode, etc.)

## MOVES 2 + 5 honest status (folded from doc-expansion-staging/scheme-eng-moves.md)

- **MOVE 2 — cart-macros bulk sweep:** landed 2026-06 for `dream/*` carts (493 collapsed via `carts/lib/cart-macros.sks`). Post-macro codesize: measured -60% for the target cluster. Remaining sweep targets: `imagine/`, `magic/` — deferred until R5RS/R7RS compat pass locks (see below).
- **MOVE 5 — R7RS-large subset:** partial. Vector-based number tower + string library subsets landed; `library-declarations` + `define-record-type` are stable. Full R7RS-large is explicitly OUT of scope until Sakura-4B-v2 ships and semantic compat (not stylistic) can be re-evaluated per `r5rs_compat_strategy` memory (2-layer: principled runtime subset + refuse-list + Book C paired corpus for model understanding).

---

# §SLAT — SLAT 1.0 as language substrate (added 2026-07-12)

> **Canonical sources.** The wire-format spec is
> `research/lacuna-docs/specs/SLAT-1.0.SPEC.md` and its walkthrough is
> `research/lacuna-docs/specs/SLAT-1.0.WALKTHROUGH-2026-07-11.md`. This
> section covers the runtime-side integration — how the reader,
> writer, dispatcher, and cart driver see and produce slats. Every
> normative claim about wire bytes defers to the spec; this section
> teaches the SHAPE the language runtime enforces.

## §SLAT.1 — The one-paragraph model

A slat is a Scheme s-expression written to a wire with three
guarantees the language enforces: **homoiconic** (the reader that
reads slats is the reader that reads Sakura source, §4.1),
**round-tripping** (`(equal? v (slat-read (slat-write v)))` for every
in-range value, CI-gated at `tests/slat.test.js`), and **canonical**
(one canonical byte-string per value, so content-addressed hashes and
signatures agree across bindings; canonicalization rules in SLAT SPEC
§6.1). Two framings ship: `.slat` for whole-document records
(hand-authorable, incident narratives, spec pages) and `.slatl` for
line-delimited streams (mailboxes, event logs, corpus files). Same
grammar; framing chosen per file.

SLAT is not a schema language, not a query language, not `eval`. A
form `(if …)` reads as three symbols; the reader executes nothing.
Every safety property of §1 (Sandboxable) still holds.

## §SLAT.2 — Where it plugs into the three layers

Per §3.1's layer cake:

- **Layer 1 (runtime).** The SLAT reader/writer live at
  `bindings/js/slat.js` (JS reference) and `bindings/python/slat/*`
  (Python parity). They ride the same `Sym` interner as §4.1 —
  reading `foo` from a slat produces the same interned `Sym`
  instance you get from reading `foo` in cart source. That identity
  is normative; a reader that breaks it fails CI.
- **Layer 2 (verb registry + dispatcher).** Every verb-registry entry
  is slat-record-shaped: head Sym + `:kw val` metadata + optional
  positional. §5.1's field table (`name`, `arity`, `determinism`,
  `perm`, `chip`, …) IS a slat-record schema — spelled by the
  registry, canonical per SLAT SPEC §3.3. The dispatched datum from
  Vote-1 structured dispatch (`[verb-sym, positional-1, …,
  positional-n, (:kwarg value …)]`) is exactly a slat-record. The
  dispatcher's audit line schema (§6.4) is a slat-record shape and
  writes as a `.slatl` line when the sink asks for it.
- **Layer 3 (cart driver-loop).** Cart state descriptors (`next`,
  `done`, `escalate`, `wait`, `after`, `act`, `interrupted`) are
  slat-record-shaped by construction: head Sym + payload. Cart audit
  events landing on the `CartBus` serialize as `.slatl` lines when a
  subscriber wants them on disk.

The three layers speak the same shape. That is the SLAT dividend: a
single wire format across parse, dispatch, and cart-run, with the
reader's grammar guarantees carried end-to-end.

## §SLAT.3 — The primitive tower the reader supports

SLAT 1.0 extends the reader beyond the base R5RS-small subset (§2)
with ten primitives, each justified by a real consumer. The FULL list
lives in SLAT SPEC §3.1. Runtime-visible summary:

| Kind | Reader syntax | Runtime shape |
|---|---|---|
| bignum | `999999999999999999n` | JS `bigint` / Python `int` |
| bigdecimal | `3.1415M` | `SlatValue('bigdecimal', str)` / `Decimal` |
| rational | `1/3` | `SlatValue('rational', 'n/d')` / `Fraction(n,d)` |
| vector | `#(1 2 3)` | `SlatVector([…])` |
| hash-map | `#{ :a 1 :b 2 }` | `Map` / `dict` |
| set | `#{{ 1 2 3 }}` | `Set` / `set` |
| instant | `#inst "2026-07-11T18:22:00Z"` | `Date` / tz-aware `datetime` |
| duration | `#dur "PT1H30M"` | `SlatDuration` / `timedelta` |
| uuid | `#uuid "…"` | `SlatValue('uuid', str)` / `UUID` |
| uri | `#uri "https://…"` | `URL` / tagged str |
| bytes | `#b64 "…"` | `Uint8Array` / `bytes` |
| tagged | `#tag value` | `SlatTagged(tag, val)` |

**Cart-authoring implication.** These primitives are read-only from
cart source today — a cart may consume a slat that carries `#(…)` or
`#inst`, but the cart-runtime writer does not emit vectors or
instants without an explicit `(slat-write …)` call. §2's cuts hold
(no numeric tower, no ports); the reader accepts the primitives so
consumers can carry them.

**Reader upgrade note.** As of 2026-07-11, the reader supports the
base tower (§4.1); the ten new primitives ship in the SLAT 1.0
migration wave per SLAT SPEC §10.4 — Zain-owned, tracked in Lane 1
of the audit at `research/lacuna-docs/engineering/artifacts-slats-integration-audit-2026-07-11.md`.
Until the wave lands, an unknown reader tag reads as
`SlatTagged("tag", raw)` and preserves on write.

## §SLAT.4 — The slat-record — the workhorse

A slat-record is a list whose head is a symbol, followed by any
interleaving of `:keyword value` pairs and positional values. During
parse the head goes to `_form`, each keyword pair goes to
`_form[keyword]`, positional values go to `_positional`, comments go
to `_comment`. This is the shape §6.4 audit lines already produce and
Vote-1 structured dispatch already ships.

Example (from SLAT SPEC §3.3):

```scheme
(event :ts #inst "2026-07-11T18:22:00Z" :kind "card.opened"
       :id 'welcome :by 'sakura)
```

The head `event` decides the record type. The taxonomy in SLAT SPEC
§4.1 registers fifteen baseline heads (`atom`, `event`, `message`,
`record`, `snapshot`, `delta`, `index`, `log`, `transcript`,
`corpus-pair`, `spec`, `test-vector`, `artifact-state`,
`cortex-slice`, `incident-narrative`). Consumers may register more
via `(define-slat-type …)` per SLAT SPEC §7.4.

**Load-bearing rule.** A form `(a b c)` where `a` is NOT a symbol
reads as a plain list, not a record. This is how the reader
distinguishes tuple-like values from typed records. Cart code that
wants a plain-list argument must not start the list with a bare
symbol.

## §SLAT.5 — Framing: `.slat` vs `.slatl`

**Whole-document `.slat`.** Zero or one top-level record. Newlines
inside the record permitted. Hand-authorable. This is what incident
narratives (200 files under `docs/atoms/incident-narratives/`),
correction-pairs (100 files), and card-insides (~400 files) use
today. The reader entry point is `slat/load-doc`.

**Line-delimited `.slatl`.** One record per line. Newlines inside a
record forbidden. Tail-able, grep-able, appendable. Mailboxes, event
logs, and Loam SYSTEM projections ride this. The reader entry point
is `slat/load` (streaming iterator).

Mixing modes in one file is illegal; a `.slatl` file with a
multi-line form raises `SlatSyntaxError` in strict mode and a
`_bad-line` sentinel in tolerant mode. Consumers may hint via the
shebang `;;;slat 1.0`.

**Autodetect rule.** When the extension isn't visible, the reader
inspects the first form: `(` followed by newline-before-`)` implies
whole-document; balanced-per-line implies line-delimited. Consumers
SHOULD pass the framing explicitly at the API surface.

## §SLAT.6 — The public reader/writer verbs

The two functions `slat/read` and `slat/write` (bound at
`bindings/js/slat.js` and re-exported through the dispatcher's public
surface) are the on-the-wire seam. They are hermetic — no I/O, no
env lookup, no macro expansion. See the Reference (`SAKURA-SCHEME-
1.0.REF.md` §SLAT) for the full verb list including the streaming
API, the canonicalizer, the signer, the hasher, and the Merkle-attest
verb.

Runtime invariants the verbs enforce:

1. **Reader is bounded** (SLAT SPEC §5.3). `max_depth=128`,
   `max_length_per_form=4 MiB`, `max_string_length=1 MiB`,
   `max_symbol_length=256`, `max_container_size=100_000`,
   `max_expansion=10×`, `fuel=10_000_000`. Exceeding any bound is a
   `SlatSyntaxError` in strict mode.
2. **Reader does not execute.** Even `(if (rm -rf) …)` reads as three
   values.
3. **`sym` identity round-trips.** `(eq? sym (slat/read (slat/write
   sym)))` returns `#t`.
4. **Canonical form is byte-stable across bindings.** JS-written
   canonical form == Python-written canonical form. CI-gated.

## §SLAT.7 — Where SLAT lands across the runtime

The four canonical touchpoints:

- **Verb registry.** Every registered verb's metadata dict IS a
  slat-record. The `chip`, `perm`, `arity`, `determinism`,
  `stateChanging`, `acceptsAddress`, `acceptsClass`, `aliasFor`,
  `addedIn`, `summary` fields are keyed pairs. The dispatcher gates
  against them per §6.1.
- **Structured dispatch.** The Vote-1 dispatched datum shape (§14.1
  in this ENG doc — see Card Closeout / Dispatch-Migration Plan) is
  a slat-record: `[Sym, positional..., (:kwarg value ...)]`. The
  dispatcher canonicalizes on entry and audit-logs canonical form.
- **Audit lines.** §6.4's `AUDIT_LINE_KEYS` frozen schema is a
  slat-record schema. Audit lines write as `.slatl` when the sink
  routes them to disk (`~/.lacuna/logs/dispatch-YYYY-MM-DD.slatl`).
- **Cart-side persistence.** A cart calling `(cortex/remember :topic
  X :value Y)` writes a `cortex-slice` slat-record (SLAT SPEC §4.1
  row 14). The read-side `(cortex/recall :topic X)` returns the
  canonicalized value.

## §SLAT.8 — Extending the taxonomy

New consumers register new record heads with one form (SLAT SPEC
§7.4):

```scheme
(define-slat-type my-shape
  (fields
    (id      :type string   :required)
    (ts      :type instant  :required)
    (payload :type record   :optional))
  (positional ())
  (builder (lambda (rec) (make-my-shape rec))))
```

Registration is a runtime effect — no code-gen, no schema file to
check in. The dispatcher can validate a record against a registered
type via `(slat-check :type 'my-shape record)`, which returns a
`(check-result :pass ? :missing (…) :type-errors (…) :extras (…))`
slat-record. Errors are structured, not stringly.

**Curator + Forge extension policy.** Curator adds cart-run event
heads (`cart-fire`, `cart-outcome`) as user-defined types in its
verb-layer namespace. Forge adds `narration` and per-run telemetry
heads. Weave 2.0 adds atom-graph heads. Each registers via
`define-slat-type` at boot; the base runtime does not need to know
the head names.

## §SLAT.9 — What is NOT loaded by default

The reader accepts every SLAT 1.0 primitive. The **rehydrator**
converts each primitive to a native runtime object. Two rehydrators
are OFF by default and consumers must opt in:

- **`slat/eval`** (SLAT SPEC §6.3). Reader-macros permitted; must
  never touch untrusted input. Off by default.
- **`slat-decrypt`** (SLAT SPEC §6.6). At-rest decryption verb; the
  reader does not decrypt automatically. Consumers pass an explicit
  key.

Taint tracking (SLAT SPEC §6.4) is available in JS 1.0; Python
tainted-mode parity ships in 1.0.1 (PF-3). Consumers routing
untrusted input through Python must set `strict=True` in the interim.

## §SLAT.10 — Cross-references

- **SLAT-1.0.SPEC** — the wire-format canonical.
- **SLAT-1.0.WALKTHROUGH-2026-07-11** — the 22k-word narrative
  companion.
- **This doc §5, §6, §7** — the primitive install, dispatcher, and
  cart-driver layers slats plug into.
- **REF §SLAT** — the per-verb reference for the reader/writer verbs.
- **LOAM §26.SLAT** — Loam SYSTEM projections on the SLAT wire.
- **SAKURA-AUTOMATIONS §SLAT** — automation triggers/actions as slat
  records.
- **artifacts-slats-integration-audit-2026-07-11** — the 14-system
  audit that surfaced the follow-on lanes.

