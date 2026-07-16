# Sakura Scheme 1.0 — Style Guide

> **Canonical engineering doc #9 of 9** per
> [`CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`](CANONICAL-DOCS-FRAMEWORK-2026-06-27.md).
> Joins the framework as the aesthetic + authoring spine. Pairs with the
> runtime ([`ENGINEERING.md`](ENGINEERING.md))
> and the verb catalog ([`REFERENCE.md`](REFERENCE.md)).
>
> **Audience.** Any author of a Sakura cart — human, in-editor agent, or
> on-device savant. Assumes the runtime contract (descriptors, FSM driver,
> capability gate) is known; if not, read the Engineering manual first.
>
> **Posture.** Sakura Scheme is a small, opinionated dialect. This guide
> names the shape we ship in. A cart that follows the guide expands
> simply, lints clean, evaluates determinististically, and reads in one
> sitting. A cart that fights the guide is almost always a cart that
> wants to be two carts, or a cart whose intent the author has not yet
> resolved.
>
> **Voice.** HelloSurface gold standard — dry, structured, data-rich.
> Every normative claim about runtime behavior carries a `file:line`
> anchor; a claim without an anchor is a defect.

---

## TABLE OF CONTENTS

- [§0. The Sakura Scheme aesthetic](#0-the-sakura-scheme-aesthetic)
- [§1. The runtime contract](#1-the-runtime-contract)
- [§2. The cart shape](#2-the-cart-shape)
- [§3. Naming](#3-naming)
- [§4. The state machine](#4-the-state-machine)
- [§5. Macros — Sakura's vocabulary](#5-macros--sakuras-vocabulary)
- [§6. Doc discipline](#6-doc-discipline)
- [§7. The seven sins](#7-the-seven-sins)
- [§8. The seven virtues](#8-the-seven-virtues)
- [§9. Examples](#9-examples)
- [§10. Corrections to existing code](#10-corrections-to-existing-code)
- [§11. The migration path](#11-the-migration-path)
- [§12. What's out (1.1 candidates)](#12-whats-out-11-candidates)
- [§13. Closing](#13-closing)

---

## §0. The Sakura Scheme aesthetic

A Sakura cart is a love letter written from one part of a small business
to another. It is also a finite state machine over a capability bus, a
piece of data the on-device savant will train on tomorrow, an audit
trail for a future regulator, and a program that runs on a phone that
the operator's livelihood depends on. The dialect exists to let all of
those things be true of the same 30 lines.

The Scheme tradition we draw from is not the academic one. It is the
working Scheme of Friedman and Wand's *Essentials of Programming
Languages* — where a small interpreter is made to do honest work by
keeping the calling conventions tight and the value taxonomy
unbearably small. It is the Scheme of Abelson and Sussman, where the
substrate of `cons`/`car`/`cdr` is enough because the *combinators*
above it carry the meaning. It is the Scheme of Felleisen, where
syntax-rules macros are a programmable extension of the language
itself, not a quoting trick. And it is the Scheme of Krishnamurthi's
*PLAI*, which insists the runtime contract is the language — not the
surface syntax.

From those four influences we keep four invariants. **Code is data**
(the cart on disk, the cart in memory, the cart in a `(define …)`
table at runtime — same JS-array-of-`Sym` shape at every stage,
`reader.js:128-155`). **Deterministic by construction** (every
primitive declares a determinism class; the dispatcher propagates,
replay is byte-identical given a seed, `cartDriver.js:88-92`).
**Sandboxable** (no ambient authority, no `eval`, no `call/cc`,
`interp.js:1-7`). **Training-data shape** (the corpus on disk *is*
the on-device model's training set; the surface form is its own
documentation, `ENGINEERING.md` §1.2).

Beauty in this dialect comes from honoring those four. A beautiful
cart is one that:

1. **Looks like its intent.** The macro vocabulary in §5 is calibrated
   so that the surface of a typical cart reads as a sequence of named
   intentions — "gate on operator state, then check cache, then fetch,
   then remember-and-render" — rather than a sequence of state-machine
   plumbing.
2. **Survives translation.** A new author should be able to read a
   shipped cart, name the pattern, and write a near-identical cart for
   a near-identical problem. The on-device savant, doing the same thing
   token-by-token, must reach the same conclusion.
3. **Fails honestly.** Every escalation carries a closed-set kind from
   the six-grammar (§3); every `act` whose backing isn't yet wired
   surfaces `'service-not-yet-wired` with a reason; no cart silent-
   successes a no-op. The honesty is not a defensive posture — it is
   the *primary aesthetic commitment*, because the operator is paying
   for the cart with money and trust.

The architect's framing — *"I'm taking people's money, and they trust
me"* — is the load-bearing constraint behind every style decision in
this document. The guide is precise because the operator does not get
to be the regression test.

> **RULE.** Adding a convention that would violate one of the four
> invariants (homoiconic / deterministic / sandboxable / training-data)
> requires owner sign-off. These are the floor the rest of the style
> guide stands on.

---

## §1. The runtime contract

This section is the bedrock. Every claim here is anchored to runtime
source. If the runtime changes, this section is the first to be
audited; until it does, this section is the truth a cart author can
build on.

### §1.1 The seven descriptors

A state function is a JavaScript-callable closure that takes **one
argument** (`ctx`, an assoc-list) and returns **one descriptor**
(`cartDriver.js:131`, single-arg `apply`). There are seven descriptor
shapes, each constructed by a prelude verb:

| Descriptor | Constructor | Shape | Driver action |
|---|---|---|---|
| `next` | `(next 'name ctx)` | `[next, name, ctx]` | Advance to state `name`, thread ctx |
| `done` | `(done)` | `[done]` | Terminal — emit `CART_END{done}` |
| `escalate` | `(escalate 'kind detail)` | `[escalate, kind, detail]` | Surface decides next; cart pauses |
| `act` | `(act 'verb args 'on-result)` | `[act, verb, args, on-result]` | Driver runs verb, threads result, advances to `on-result` |
| `wait` | `(wait 'event [deadline-ms])` | `[wait, event, deadline]` | Block until event; deadline triggers timeout |
| `after` | `(after seconds 'name ctx)` | `[after, seconds, name, ctx]` | Schedule resume; in live driver the seconds are advisory |
| `interrupted` | `(interrupted reason ctx)` | `[interrupted, reason, ctx]` | Live-voice mid-speech break |

Source: `cartPrelude.js:75-102` (constructors),
`cartDriver.js:209-339` (normalization + action). The descriptors
are interned tag symbols (`cartPrelude.js:27-34`) so `eq?` over the
tag is pointer-fast.

A state function that returns anything other than one of these seven
shapes lands in `cartDriver.js:413-416` → tag `halted` →
`_emitCartEnd(bus, 'halted', { reason: 'unknown descriptor' })`. The
cart stops; no recovery path.

### §1.2 `(act 'verb args 'on-result)` is fire-and-forward

The single most consequential rule in the dialect.

`act` is not a function call. It is the *construction of a request*
the driver later dispatches. `cartPrelude.js:97-102`:

```javascript
env.define('act', (verb, args, onResult) => {
  const r = onResult == null ? null
    : (typeof onResult === 'string' ? sym(onResult) : onResult)
  return [SYM_ACT, verb, args ?? [], r]
})
```

A state function whose body is `(act 'etsy/listings (list ...) 'render)`
returns the descriptor `[act, etsy/listings, (list ...), render]`. The
driver intercepts (`cartDriver.js:256`), runs `executeAct(callId, verb,
args, preamble)` (which routes through the dispatcher's perm + confirm
+ rate gate), stores the result on ctx as `'last-result`
(`cartDriver.js:327`), and calls the state named by `on-result`. The
verb's actual return value is **never** seen by the calling state
function — it lands in the *next* state, via `(ctx-result ctx)`.

The corpus's most common confusion (and the source of the
`ACT-INLINE` bug class, §10) is to write:

```scheme
(let ((r (act 'etsy/listings (list) 'render)))
  (if (pair? r) (render ctx r) (escalate 'sad null)))
```

This **always** takes the true branch — `r` is the four-element
descriptor list, which is `pair?`-truthy. The verb does not fire; the
cart calls `render` inline with the descriptor as if it were a result.
Verified at `SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.1.

> **RULE.** Never `let`-bind the value of `(act …)`. The result of an
> act is delivered to the next state, never to the calling one.

### §1.3 `(next 'name ctx)` takes exactly two arguments

`cartPrelude.js:75`: `env.define('next', (name, ctx) => [SYM_NEXT, name, ctx ?? []])`.

JavaScript silently ignores extra positional arguments. A call like
`(next 'fetch (ctx-set 'a 1 ctx) (ctx-set 'b 2 ctx))` evaluates both
ctx-set forms (they are not lazy), then passes the **first** result as
ctx and **drops** the second. The downstream state sees only `a` set;
`b` is lost.

**Correct shape:** nest the ctx-sets.

```scheme
(next 'fetch (ctx-set 'a 1 (ctx-set 'b 2 ctx)))
```

The nesting reads inside-out: `b` is set first, then `a` is layered on
top. Order of the keys matters only if both names collide; the new
binding shadows the old.

### §1.4 `(done)` is a descriptor, not a redefinable terminal

`(done)` returns `[SYM_DONE]`. The driver pattern-matches the tag at
`cartDriver.js:210` and emits `CART_END{outcome: 'done'}`. The cart
never executes anything after the `(done)`.

The cart's env is **not frozen** before the cart source evaluates
(`cartHost.js:91-103` — `makeBaseEnv` + `installCartPrelude`, no
`freeze()`). So `(define (done) <body>)` in a cart source *successfully
shadows* the prelude's `done`. The corpus pattern `(define (done) (done))`
is the most catastrophic redefinition — it creates a closure that
calls itself in tail position; the TCO trampoline (`interp.js:226-248`)
loops without stack growth until fuel exhausts at 200,000 steps
(`cartHost.js:58`); the evaluator throws `"fuel exhausted"`;
`cartDriver.js:131-174` catches it as `PRIMITIVE_CRASH` and halts.
The cart never emits `CART_END{done}`. Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.3.

> **RULE.** Never define `done`. The prelude's `done` is the only one
> the cart needs.

### §1.5 `(escalate 'kind detail)` takes exactly two arguments

`cartPrelude.js:78`: `env.define('escalate', (kind, detail) => [SYM_ESCALATE, kind, detail ?? null])`.

`kind` is a symbol from the six-grammar (§3.4). `detail` is any
Scheme value — by convention a property list or a single symbol. The
driver emits `ESCALATE` on the bus and ends the cart with outcome
`'escalated'` (`cartDriver.js:219-226`).

The malformed shape `(escalate ctx 'kind payload)` (three args, ctx
first) passes ctx as `kind` and the actual symbol as `detail`. The
driver's `symName(d[1])` (`cartDriver.js:377`) coerces the ctx alist
to a garbled string. Verified at `SCHEME-RUNTIME-TRUTH-2026-06-30.md`
§1.4.

### §1.6 ctx helpers — key first

Two helpers, one rule: the key comes first.

```scheme
(ctx-get 'my-key ctx)         ;; cartPrelude.js:108-115
(ctx-set 'my-key value ctx)   ;; cartPrelude.js:118-122
```

`(ctx-set ctx 'my-key value)` passes the ctx alist as the key, the
symbol `'my-key` as the value, and the value as the ctx. The
`symName` coercion of a JS array yields `'[object Array]'`; the
resulting ctx is a one-pair alist `[Sym('[object Array]'), 'my-key]`
and the actual value is lost. Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.5.

> **RULE.** Key first in every `ctx-*` call. A small number of
> sandbox carts shadow `ctx-set` locally with their own `(ctx, key,
> val)` convention — these are intentional and called out at §10. Do
> not write new ones.

### §1.7 `assq` returns a pair or `#f` — never `#t`

`base.js:327-333`:

```javascript
def('assq', (key, alist) => {
  if (!Array.isArray(alist)) return false
  for (const pair of alist) {
    if (Array.isArray(pair) && _symEq(pair[0], key)) return pair
  }
  return false
})
```

`assq` returns the matching pair (a JS array `[Sym, value]`) when the
key is present, `false` when not. The corpus pattern
`(eq? (assq 'vacation state) #t)` is **always** `#f` because a pair is
never `=== true` and `eq?` is reference equality
(`base.js:244`). The vacation/paused/no-new-data gate that this
pattern guards therefore *never fires* — the cart falls through to
`else` and runs regardless of operator state. This is the largest
single systemic bug in the corpus (3,435 carts, 70.8%) and is
explicitly documented as a known latent bug at
`base.assq.test.js:44-51`. Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.7.

The correct probe is `pair?`:

```scheme
(cond
  ((pair? (assq 'vacation state)) (escalate 'state-blocks-spend 'vacation))
  ...)
```

If the cart also needs the *value* (not just presence), it reads
`(cdr (assq 'vacation state))` after the `pair?` guard succeeds.

### §1.8 State functions take exactly one argument

`cartDriver.js:131`: `descriptor = apply(fn, [ctx], f)`. Every state
function is called with `[ctx]`. A state function signed
`(define (check-gate ctx req loam-response) …)` will receive
`req = undefined` and `loam-response = undefined` when called from the
driver — the extra params silently bind to `undefined`. The corpus
shows 1,431 occurrences of this pattern (`CART-LINT-REPORT-2026-06-30.md`
CART-006); each is a latent bug.

> **RULE.** Every state function: `(define (NAME ctx) …)`. Pass
> anything else via the ctx alist.

### §1.9 What the driver does between states

For each step, the driver
(`cartDriver.js:111-340`):

1. Looks up the state function by name (`env.get(stateName)`,
   line 116). An unbound state → `halted, reason: unknown state`.
2. Emits `STATE_ENTER` with `ctx_hash` (line 122-125).
3. Applies the state function with `[ctx]` (line 131).
4. Normalizes the returned descriptor (line 178); malformed → halted.
5. Runs the invariant check (line 188).
6. Emits `STATE_EXIT` with descriptor preview (line 204).
7. Routes on descriptor tag (line 209-339); for `act`, dispatches the
   verb through `executeAct` (the perm/confirm/rate gate), threads
   the result onto ctx as `'last-result`, and advances.

The driver caps at `maxSteps = 200` (line 76). A cart that needs more
states has a structural problem (a pattern that should be a macro, a
loop that should be `let`-bounded, or a job that should be two carts).

### §1.10 Verb naming convention

Every verb is namespaced. The dispatcher reads the namespace prefix
of the verb name to enforce policy
(`registry/VerbRegistry.js`). The prefix taxonomy:

| Prefix | Owner | Examples |
|---|---|---|
| `cortex/` | Long-term memory | `cortex/recall`, `cortex/remember`, `cortex/forget` |
| `loam/` | Substrate database | `loam/operator-state`, `loam/cron`, `loam/subscribe` |
| `model/` | Reasoning capability tier | `model/fast`, `model/workhorse`, `model/deep-reasoning` |
| `etsy/`, `ebay/`, `shopify/`, `printify/` | Marketplace APIs (visible to operator) | `etsy/listings`, `shopify/orders` |
| `comms/`, `mail/`, `notify/`, `voice/` | Communications | `mail/dispatch`, `voice/synthesize`, `comms/gate-check` |
| `image/`, `audio/`, `video/` | Media composition | `image/compose`, `audio/render` |
| `card-emit`, `envelope-queue`, `table` | Surface primitives (no prefix — they're frame ops) | — |
| `motion/`, `note/`, `surface/`, `form/` | Animation & music | `motion/glide`, `note/strike`, `form/ii-V-I` |
| `web/`, `documents/`, `stats/` | Computed services | `web/search`, `stats/zscore` |

> **RULE.** Vendor names appear only at the literal wire-call boundary
> (the HTTP client method posting to the vendor's API). Verb names are
> *capability-first*. See `CLAUDE.md` "Vendor naming" lock 2026-06-22.

---

## §2. The cart shape

A cart is a `.sks` file. Its shape, in canonical order:

```
1. ;;~ header block         — index builder reads these (build_cart_index.mjs)
2. ;; prose comment block   — WHAT / WHY NOW / CAPABILITY / CORTEX / SCOUT / HONESTY / SPECIFICS / IDEMPOTENCY / ERROR GRAMMAR
3. (cart 'slug '((attrs)))  — runtime metadata sink (cartPrelude.js:55-62)
4. (define-cortex-landsite …)  — [M17 macro] machine-readable Cortex landing shape
5. (define-error-grammar …)    — [M18 macro] machine-readable error kinds
6. ;; ── state functions ──
7. (with-loam-gate ctx 'NEXT)  — [M01] entry + gate
8. … optional argument validation, PII gates, cache check …
9. … business-logic state functions …
10. (remember-and-render ctx …)  — [M04 or M05] terminal cluster
```

A typical pre-macro cart is 200-300 lines of explicit state plumbing.
A typical post-macro cart of the same intent is 30-60 lines. The
shape above is the floor; carts may add states between (8) and (10)
as the work requires. Carts may not omit (1)-(3), (7), or the
terminal in (10).

### §2.1 The `;;~` header

The header is consumed by `scripts/build_cart_index.mjs` at index-
regeneration time. It is *parseable* — a single-line `;;~ key value`
shape per line, no continuation. Nine keys are canonical:

| Key | Required | Example |
|---|---|---|
| `title` | yes | `"Listing-age distribution"` |
| `author` | yes | `"lacuna"` |
| `version` | yes | `1` |
| `mode` | yes | `analysis` · `composer` · `automation` · `tour` |
| `flavor` | yes | `white` · `pink` · `green` · `light-purple` · `deep-purple` |
| `id` | yes | `age-distribution` (must match `(cart 'id …)`) |
| `trigger` | conditional | `cron:daily` · `cron:weekly` · `event:order_paid` · `manual` |
| `touches` | yes | `()` · `(cortex)` · `(cortex etsy)` |
| `summary` | yes | one sentence, ≤120 chars |

`trigger` is required for non-`manual` carts; analysis-mode and
composer-mode carts may omit it.

> **RULE.** The header `id` must equal the symbol in `(cart 'id …)`.
> Mismatch is a lint error.

### §2.2 The prose block

The prose block sits between the `;;~` header and the `(cart …)`
form. It is a sequence of named paragraphs, each starting with a
capital-letter label followed by a colon. The named sections, in
order:

| Section | Purpose |
|---|---|
| `WHAT` | One paragraph: what this cart does, in operator language. |
| `WHY NOW` | One paragraph: why this cart is worth running. The business case. |
| `CAPABILITY-FIRST DISPATCH` | Bulleted list of verbs used, namespaced (no vendor names). |
| `CORTEX INPUT SHAPE` | If the cart reads operator config, the shape. |
| `CORTEX LANDING SHAPE` | If the cart writes to Cortex, the shape of what lands. |
| `SCOUT LABEL` | The operator-facing name for the scout. See §3.5. |
| `HONESTY` | One paragraph citing `feedback_no_false_product_claims`; names every honest-null surface. |
| `SPECIFICS` | Bulleted list of constraints (windows, sample sizes, tier caps). |
| `IDEMPOTENCY` | One paragraph: what makes re-running safe; what the dedupe key is. |
| `PII HANDLING` | Required if `pii != NONE`; cites Lane B5 §6. |
| `ERROR GRAMMAR` | A list of every escalation kind, one per line, with a one-sentence why. |

The prose block is duplicated as a machine-readable form by the M17
and M18 macros (`define-cortex-landsite` and `define-error-grammar`).
Both forms are kept; the prose block reads in context, the macro
forms are linter- and tool-parseable.

### §2.3 The `(cart …)` form

```scheme
(cart 'slug
  '((author    . "lacuna-engineering")
    (version   . 1)
    (cadence   . daily)
    (tier      . pink)
    (model     . model/fast)
    (seeded_by . "Lacuna Engineering")
    (pii       . NONE)
    (read-only . #f)))
```

Backed by `cartPrelude.js:55-62` — a no-op at runtime that stashes
`{id, attrs}` on the meta side-channel for the studio + lint. The
shape is canonical: `'slug` first, then an assoc-list of
`(key . value)` pairs. Required attrs: `author`, `version`,
`read-only`. Carts of `mode composer` or `mode automation` add
`cadence`, `tier`, `model`, `pii`.

> **RULE.** The slug in `(cart 'slug …)` must equal the `;;~ id`
> header. Both must equal the basename of the file (without `.sks`).

### §2.4 State function ordering

After the cart form and the M17/M18 macros, state functions appear
in **execution order** — the order the operator's run would encounter
them, top-to-bottom. The canonical sequence:

```
gate → cache → fetch → reason → write → render
```

`with-loam-gate` first (the precondition for every spending act).
Then optionally an argument validator, a PII gate, a cache check.
Then the fetch/reason chain. Then the terminal write+render cluster.

This is not a runtime requirement — the driver finds states by name,
not by file position. It is a *reader* requirement. A cart that reads
in execution order can be understood in a single pass; a cart whose
states are alphabetized or grouped by type forces the reader to
maintain a mental call graph.

> **RULE.** State functions appear in execution order. The `start`
> state is always the first state function in the file (or, post-
> macro, the first call to `with-loam-gate`).

---

## §3. Naming

Names are the single largest aesthetic surface of the dialect. The
corpus has on the order of 100,000 named entities — state functions,
verbs, ctx keys, error kinds, scout labels. The rules below are the
ones the corpus consistently observes; deviations are tracked at §10.

### §3.1 Symbols are kebab-case, lowercase

Every Scheme symbol — state function name, verb suffix, ctx key,
error kind — is **lowercase kebab-case**:

```
check-state   load-config   fetch-abandoned-carts
:window_hours :gif_character           ← exceptions, see §3.3
```

Never camelCase. Never `snake_case` in *state* names (snake_case is
reserved for *data field* keys; see §3.3). The reader interns symbols
case-sensitively, so `'CheckState` and `'check-state` are distinct
keys and a typo here is a state-not-found halt at runtime.

### §3.2 Verbs — capability first

A verb name has two parts joined by `/`: the **namespace** (the
capability tier) and the **operation** (lowercase kebab-case):

```
etsy/listings       cortex/recall      loam/operator-state
model/workhorse     image/compose      voice/synthesize
```

The namespace names the *capability* the verb provides, not the
vendor that backs it. `model/workhorse` is the same name whether the
backing wire is one cloud vendor or another; the dispatcher routes
behind the namespace. This is the lock at `CLAUDE.md` §"Vendor
naming" 2026-06-22.

> **RULE.** When you add a new verb, name it after what an operator
> would say. *"I need to find similar items"* → `etsy/similar-items`.
> Not `etsy/similarSearchV3`. Not `claude/search`.

### §3.3 Data field keys — colon-prefixed, snake_case

The convention for *data field* keys inside payloads is colon-prefix,
snake_case. This matches the Cortex storage schema and the API
shapes most marketplaces use:

```scheme
'(:topic     abandoned_cart_config
  :window_hours 24
  :gif_character "sprite"
  :gif_style    "walking")
```

The leading colon is a reading aid — it signals "this is a key, not a
value" to a human scanning the source. snake_case under the colon
matches the wire shape so cart authors can paste API docs as keys
without translating.

> **RULE.** Symbols that name *control flow* (state functions, error
> kinds) are kebab-case. Symbols that name *data* (payload keys,
> Cortex topics) are colon-prefixed snake_case. The two never mix in
> a single context.

### §3.4 The six-grammar of error kinds

A cart escalates with a `'kind` symbol. The six canonical kinds cover
every *structural* failure mode. Domain-specific kinds (like
`'no-qualifying-carts` or `'abc-insufficient-particles`) are allowed
where the structural six don't fit, but the six below are the
first-line vocabulary:

| Kind | Use |
|---|---|
| `'state-blocks-spend` | Loam returned vacation / paused / no-new-data. Detail is the symbol of the blocked flag. |
| `'cortex-not-ready` | Loam or Cortex returned null on boot. Detail is `null`. |
| `'service-not-yet-wired` | External service returned null, quota-exhausted, or is offline. Detail is a property list with `:status not-wired :reason "<verb>-<reason>"`. |
| `'service-garbled` | Service returned an unexpected shape (non-pair, wrong type). Detail uses the same property-list shape. |
| `'pii-gate-closed` | PII gate not open for the required class. Detail names the class. |
| `'comms-gate-closed` | A send-type verb was blocked by the comms compliance gate. Detail names the reason. |

A few earlier corpus carts use `'sakura-garbled` or `'cloud-garbled`
for model failures; these are aliases of `'service-garbled` and
should migrate. <!-- LIVING:RESEARCH(2026-06-30): full audit of all
alias spellings of the six kinds across the corpus. -->

The detail's reason-string format is `"<verb>-<condition>"`:
all-lowercase, hyphen-delimited, the verb namespaced. Examples:
`"etsy/orders-returned-null"`, `"model/fast-quota-exhausted"`,
`"comms/gate-check-blocked"`. Never capitalize; never use spaces;
never embed the tier name.

### §3.5 Scout labels — the poetic surface

The **scout label** is the operator-facing name for what the cart
does. It appears in chips, in the activity sheet, in the envelope
header. It is the *only* string in the cart that the operator reads,
and the only place we earn the right to use English warmly.

The rules:

1. **Domain-neutral.** A scout label names a *role*, not a verb. *"the
   anomaly watcher"*, not *"the cart that runs the anomaly query"*.
2. **Slightly poetic.** It should read as a small character — *"the
   overnight scout"*, *"the analyst"*, *"the recovery scout"*, *"the
   horizon watcher"*. Never *"the system"*, never *"the AI"*, never
   *"the agent"*.
3. **Never the backend.** Never name the verb (*"the cortex-recall
   process"*), never name the vendor (banned by `CLAUDE.md`), never
   name the model tier (*"the model/fast scout"*).
4. **One per cart.** The cart's `;;~ summary`, its prose `SCOUT LABEL`
   line, its envelope `:scout` field, and any operator-facing copy all
   use the same label.

The scout label is the closest thing Sakura Scheme has to a *named
character*. It is how a cart introduces itself to the operator when
its work surfaces. The corpus's best ones — *the analyst*, *the
recovery scout*, *the horizon watcher*, *the bedtime engine* — read
like a small cast of helpers. Sakura is the conductor; the scouts are
the orchestra.

> **RULE.** Every cart with operator-visible output has a scout
> label. The label is decided once and used everywhere. It is the
> only string the cart author is encouraged to be *charmed* by.

### §3.6 Ctx keys

Ctx keys are kebab-case symbols, used unprefixed:

```scheme
(ctx-set 'loam-state state ctx)
(ctx-set 'qualifying-carts qualifying ctx)
(ctx-set 'batch-id (uuid) ctx)
```

Two reserved keys:

- `'last-result` — set by the driver after every `act`
  (`cartDriver.js:327`). Read via `(ctx-result ctx)`. Cart code never
  writes to it.
- `'mode` — read by the driver to route sim vs prod
  (`cartDriver.js:109`).

> **RULE.** Don't `(ctx-set 'last-result …)` from cart code. It is the
> driver's slot.

### §3.7 State function names

State function names follow a small set of patterns. The pattern
names the *role* of the state:

| Pattern | Examples | Role |
|---|---|---|
| `start` | (only) | The entry point. Always called `start`. |
| `check-NOUN` | `check-state`, `check-orders`, `check-cart-details` | A result validator after an `act`. |
| `load-NOUN` | `load-config`, `load-recipient` | A Cortex/storage read. |
| `fetch-NOUN` | `fetch-abandoned-carts`, `fetch-listings` | An external API read. |
| `compose-NOUN` | `compose-email`, `compose-one-liner` | A local construction step. |
| `filter-NOUN`, `analyse-NOUN` | `filter-carts`, `analyse-findings` | A pure-compute transformation. |
| `remember`, `render`, `render-cached`, `finalize` | (canonical names) | Terminal cluster. |
| `skip-NOUN`, `defer-NOUN` | `skip-cart`, `defer-send` | A graceful-skip branch. |
| `wind-down`, `restore`, `finish` | (terminal idioms) | Clean-up before `done`. |

The names are *verb-noun present-tense*. Never past-tense
(`fetched-orders`). Never noun-only (`orders`). Never abbreviated
(`ck-st`).

> **RULE.** A state function's name reads aloud as an action. Read
> the cart top-to-bottom and the names should narrate it.

---

## §4. The state machine

### §4.1 The canonical pipeline

A typical cart's state machine has six phases. They appear in the
same order in nearly every cart that does meaningful work:

```
  ┌─ gate ──┐    ┌─ cache ──┐    ┌─ fetch ──┐    ┌─ reason ─┐    ┌─ write ──┐    ┌─ render ─┐
  │ start   │ →  │ recall   │ →  │ etsy/    │ →  │ model/   │ →  │ cortex/  │ →  │ envelope │
  │ check-  │    │ check-   │    │ verb     │    │ workhorse│    │ remember │    │ -queue + │
  │ state   │    │ cache    │    │ check-   │    │ check-   │    │          │    │ done     │
  └─────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   M01 covers     M02 covers      M03 covers      M08 covers      M04 covers      M04/M05 cover
```

Not every cart has all six phases. A pure-analysis cart skips the
write. A pure-broadcast cart skips the reason. A scheduled cron with
no operator config skips the cache. But the *order* is preserved.

> **RULE.** Cache-check before any spending act. Cortex-write before
> render (so the operator's next view reflects the truth). If your
> cart's phases run in a different order, write the reason in a
> `;; SHAPE NOTE` comment above the first state.

### §4.2 One act per state

A state function should contain **at most one `(act …)` call**. The
reasons are structural:

1. The driver runs a state, gets one descriptor, and dispatches. A
   `cond` whose branches each return their own descriptor is fine; a
   `begin` whose first form is `(act 'A …)` and whose second is `(act
   'B …)` returns only the *second* descriptor (the first is
   discarded — `begin` returns its last value).
2. Result threading is single: the driver puts *one* `'last-result`
   on ctx. A state that wanted to issue two acts and read both
   results would need to split into two states anyway.
3. Read order from the bus is one act per `STATE_ENTER` →
   `ACT_REQUEST` → `ACT_RESPONSE` → `STATE_ENTER` cycle. Two acts in
   one state would show as one bus entry, misleading the activity
   sheet.

> **RULE.** One act per state. If a state needs two acts, it is two
> states.

### §4.3 Pure logic combines freely

The above rule applies to `act`, not to pure Scheme. A state may
freely `let`, `cond`, `let*`, `letrec`, `map`, `filter`, `string-
append`, build payloads, walk lists — all the substrate combinators
combine without issue, because they don't allocate driver steps. A
state's job is to *prepare one descriptor*; the work to compute the
descriptor's parts is unbounded.

### §4.4 When to combine, when to split

| Should be one state | Should be two states |
|---|---|
| Validate input → branch to escalate or next | `(act …)` + result check |
| `let` over computed values feeding one descriptor | Two acts in sequence |
| `cond` whose branches are all `(next …)` / `(escalate …)` | A reason call + a write call |
| `map` over a list to build a single payload | An iteration over carts (one cart per state) |

The "one cart per state" idiom (e.g., `compose-batch` →
`compose-one-cart` → `check-cart-details` → ... → back to
`compose-batch`) is the canonical way to iterate over a list of work
items that each requires an act. The driver bounds the loop by
`maxSteps=200`; lists longer than ~30 items should be paginated
across multiple cart runs.

### §4.5 done vs escalate

The two terminals carry different meanings:

- `(done)` — the cart **completed its work**. The operator sees a
  success outcome. The bus emits `CART_END{outcome: 'done'}`.
  Reserved for the happy path only.
- `(escalate 'kind detail)` — the cart **could not complete** for a
  reason the operator can act on. The surface decides next (offer a
  fix chip, surface an error, queue for retry). The bus emits
  `CART_END{outcome: 'escalated', kind}`.

A cart that has nothing useful to render (e.g., `'no-qualifying-
carts`) escalates with the domain-specific kind, **not** `(done)`.
The distinction is honest: *no work* and *work done* are different
outcomes.

> **RULE.** `(done)` only when the cart did the thing. Otherwise
> escalate.

### §4.6 The `after` retry pattern

`(after seconds 'state ctx)` is the canonical rate-limit retry. The
driver advances immediately in live mode (the seconds are advisory),
but the bus emits an `AFTER` event with the seconds so the runner can
schedule the resumption.

The canonical use:

```scheme
((eq? result 'rate-limited)
  (after 60 'fetch-orders ctx))
```

Always retry the *fetching* state, not the *checking* state. The
checking state is pure logic over `ctx-result`; re-running it would
just see the same rate-limit signal.

### §4.7 Idempotency

A cart that writes to Cortex or sends a side-effect (mail, push,
SMS) must be idempotent within its scheduling window. Two patterns
suffice:

1. **Cron-window dedupe** — the runner deduplicates by `(operator,
   slug, schedule_window)`. Re-firing within the same window is a
   no-op at the runner level. Cite this in the prose `IDEMPOTENCY`
   block as: *"The cron runner dedupes by (operator, slug,
   schedule_window). See `curator_api/cron/runner.py` — `_window_key`."*
2. **Cortex-flag dedupe** — the cart reads a Cortex record at start;
   if a `:sent` or `:done` flag is set, it escalates with
   `'already-done` (or a domain-specific equivalent). Covered by M12
   (`define-idempotency-gate`).

> **RULE.** Every cart with side effects names its idempotency
> mechanism in the prose `IDEMPOTENCY` block. A cart that cannot
> articulate the mechanism is a cart that will double-send.

---

## §5. Macros — Sakura's vocabulary

The dialect ships with two macro layers:

- The **dialect floor** — 36 macros at `macros/expand.js` covering
  motion, music, timing, and atmosphere. These are the substrate
  Sakura uses for animation and choreography.
- The **cart layer** — 18 macros (M01-M18) covering the cart state-
  machine domain. Specified at `PASS-2-MACROS-2026-06-30.md`. These
  are the substrate Sakura uses for *automation* — the work side of
  the substrate.

The cart layer macros are the load-bearing ones for this style guide.
They are why a Sakura cart can be 30 lines instead of 250.

### §5.1 Why macros, not functions

The patterns in §4 — loam gate, cache check, result validation,
remember-and-render — repeat across thousands of carts. A function
would have to take the next-state name as a runtime symbol and call
back into the cart's `define` table. A macro *generates* the named
state functions at expansion time, so the driver's name-lookup finds
them statically.

There is a deeper reason. The cart corpus is the training set for
the on-device savant (Sakura). A macro call is *one token sequence*
the model can learn; a 14-line state-machine pattern is *fourteen
chances to drop a paren*. The model that learns `with-loam-gate` as a
single named intention emits correct gates; the model that learns to
type out the pattern by hand emits the gates with the ASSQ-dead-gate
bug, 3,435 times. The macros are not just compression — they are the
*shape* the dialect should be learned in.

### §5.2 The 18 cart-layer macros

Full specifications, expansions, and "when to use / when not to use"
clauses are at [`PASS-2-MACROS-2026-06-30.md`](PASS-2-MACROS-2026-06-30.md).
Summary table:

| # | Name | Replaces | Lines saved |
|---|---|---|---|
| M01 | `with-loam-gate` | The `start` + `check-state` loam gate pair | 14 → 1 |
| M02 | `with-cortex-cache` | The `check-cortex-cache` + `check-cache-result` pair | 14 → 3 |
| M03 | `check-act-result` | Standard 4-branch result validator (null/rate/quota/non-pair/ok) | 13 → 4 |
| M04 | `remember-and-render` | The `remember` + `render` + `render-cached` cluster | 31 → 5 |
| M05 | `remember-and-render-table` | M04 + a `(table …)` display | 38 → 6 |
| M06 | `with-comms-compliance` | Gate wrap for any send-type verb | (existing, now bound) |
| M07 | `check-act-result/null-ok` | Cache-check variant where `null` is valid | 14 → 4 |
| M08 | `with-model-call` | Model `act` + immediate result validation | 24 → 6 |
| M09 | `emit-envelope` | `envelope-queue` + `done` shorthand | 7 → 4 |
| M10 | `emit-envelope/cached` | M09 with `:from-cache #t` | 7 → 4 |
| M11 | `cortex-recall/checked` | Recall + null-check + shape-check | 12 → 4 |
| M12 | `define-idempotency-gate` | Cortex-flag dedupe gate | 14 → 3 |
| M13 | `with-pii-gate` | PII gate check on loam-state | 10 → 1 |
| M14 | `rate-limit-retry` | Inline `after` in retry branch (semantic clarity) | 1 → 1 |
| M15 | `validate-arg` | Single-argument input guard | 8 → 4 |
| M16 | `with-input-guard` | Multi-field event validation | 18 → 6 |
| M17 | `define-cortex-landsite` | Cortex landing shape (machine-readable, no-op at runtime) | comment → form |
| M18 | `define-error-grammar` | Error kind catalog (machine-readable, no-op at runtime) | comment → form |

The total reduction across the corpus is on the order of **375,000
lines** of avoidable boilerplate, with no loss of expressivity — every
cart that needs to step outside a macro still can, by writing the
explicit state function instead.

### §5.3 Hygiene

The expander at `macros/expand.js` provides *hygienic* `syntax-rules`
macros via the `MacroTable` and `expandTop` infrastructure
(`macro.js`). Hygiene means: identifiers introduced by a macro
expansion are renamed (gensymed) so they cannot collide with names in
the cart's lexical scope. A macro that introduces `check-state__` will
not shadow a cart's user-defined `check-state` — the macro's
identifier is renamed to a fresh gensym.

The practical consequence: the M01 macro's *expansion* generates
`(define (start ctx) …)` and `(define (check-state__ ctx) …)`, but
the cart can still write its own `(define (check-state-after-fetch
ctx) …)` and the names don't collide. The expander handles the gensym
mapping.

<!-- LIVING:RESEARCH(2026-06-30): the M01 expansion generates a
`(define (start ctx) …)` — the cart's own `start` is shadowed, which
is intended. But the macro generates `check-state__` via hygiene,
which means the cart can't `(next 'check-state ctx)` to reach it. The
M01 macro is designed assuming the cart never names a state
`check-state` explicitly. Verify this is the contract; document
alternatives. -->

### §5.4 The rule of three

When to coin a new macro: when the same pattern shows up in **three or
more carts** and the variation between them is parameterizable. Less
than three, write the pattern explicitly; the cost of a macro (one
more thing to know, one more thing to maintain) outweighs the saving.

When to *not* coin a macro: when the pattern is a happy local
abstraction within one cart (use `define` for that), or when the
variation isn't cleanly parameterizable (different control flow,
different escalation kinds, different result shape — these belong as
explicit states, possibly in three explicit carts).

### §5.5 Doc-block macros

M17 (`define-cortex-landsite`) and M18 (`define-error-grammar`) are
unusual: they expand to `(begin)` at runtime — pure no-ops. Their
purpose is to make the cart's *metadata* parseable by the linter and
the studio without requiring comment parsing. The form is a Scheme
expression; the linter walks the AST.

```scheme
(define-cortex-landsite
  :topic 'abandoned_cart_recovery
  :shape '(:batch_id      string
           :sent_count    int
           :skipped_count int
           :sent_at       timestamp))

(define-error-grammar
  ('state-blocks-spend   "loam said vacation / paused / no-new-data")
  ('cortex-not-ready     "Cortex hasn't booted")
  ('service-not-yet-wired "external service offline or null"))
```

These do not replace the prose `CORTEX LANDING SHAPE` and `ERROR
GRAMMAR` blocks — the prose remains for the human reader. The macro
forms are the *machine-readable* sidecar, so the studio's "In Detail"
tab can render the landing shape as a table, and the linter can
warn on any `(escalate 'undocumented-kind …)`.

> **RULE.** Every cart that writes to Cortex declares its landing
> shape with M17. Every cart with escalations declares its kinds with
> M18.

---

## §6. Doc discipline

### §6.1 The four-line state comment

Every explicit state function (one written by the author, not
generated by a macro) carries a four-line comment block immediately
above its `(define …)`:

```scheme
;; WHAT: <one sentence — the operation>
;; TECHNIQUE: <one sentence — how, in dialect terms>
;; WHY: <one sentence — the load-bearing reason>
;; CONSTRAINT: <one sentence — what this state will not do>
```

The four lines are not redundant. They serve four different readers:

- **WHAT** answers *"what does this state do?"* for a stranger.
- **TECHNIQUE** answers *"why this shape?"* for a maintainer.
- **WHY** answers *"can I delete this?"* for the future refactorer.
- **CONSTRAINT** answers *"can I add to this?"* for the extender.

States generated by a macro (M01-M16) do **not** need the block — the
macro's name and parameters are the documentation. States that remain
explicit (the business-logic ones the macro can't cover) must keep
the block. The block is what distinguishes "I wrote this on purpose"
from "the macro generated it."

### §6.2 The honest-null discipline

The corpus rule: when a service is not yet wired, surface it. Never
silent-success a no-op.

```scheme
((null? listings)
  (escalate 'service-not-yet-wired
            '(:status not-wired :reason "etsy/listings-returned-null")))
```

Three reasons:

1. **The operator sees the truth.** Their cart said "queue 12 emails
   for review" and only 3 came through; an honest cart says "9
   skipped because etsy/cart-details was offline."
2. **The training corpus learns the truth.** A cart that silent-
   successes a no-op trains the model to think the verb returned
   nothing meaningful. A cart that escalates trains the model to
   distinguish *real* nothing from *broken* nothing.
3. **The audit can trust the bus.** A `CART_END{done}` means *the
   work was done*. If carts emit `done` for no-ops, the bus loses its
   meaning.

Cited at `CLAUDE.md` §"Honest nulls, no fluent-wrong" and at
`feedback_no_false_product_claims`.

> **RULE.** No silent-success no-ops. Either the cart did the work and
> emits `(done)`, or it escalates with `'service-not-yet-wired` and a
> reason. There is no third option.

### §6.3 The SCOUT LABEL line

Every cart with operator-visible output has a `SCOUT LABEL` line in
its prose block. The label appears in:

- The prose block (canonical declaration).
- The envelope's `:scout` field (operator-facing).
- The chip's display text (if the cart spawns a chip).

The same string in all three places. See §3.5 for the naming rules.

### §6.4 The HONESTY block

Every cart's prose includes an `HONESTY` block. The block cites
`feedback_no_false_product_claims` and names every place the cart
makes an honest-null surface. Example, abridged from
`abandoned-cart-gentle-gif.sks`:

```
;; HONESTY (per [[feedback_no_false_product_claims]]):
;;   This cart NEVER sends an email without explicit operator review.
;;   If etsy/abandoned-carts returns null or image/compose returns null,
;;   the cart escalates with ':status not-wired and an honest reason.
;;   If a buyer is unsubscribed from recovery-mail, no email is sent
;;   (the comms-compliance gate handles this).
```

The HONESTY block is a *contract* — it names the boundary the cart
won't cross. A code review for a cart starts here.

### §6.5 The IDEMPOTENCY block

Every cart with side effects names its dedupe mechanism in an
`IDEMPOTENCY` block. See §4.7 for the two canonical patterns. A cart
that cannot articulate idempotency in one paragraph is a cart that
will double-send.

### §6.6 The ERROR GRAMMAR block

Every escalation kind a cart can emit appears in the prose `ERROR
GRAMMAR` block, with a one-sentence why:

```
;; ERROR GRAMMAR:
;;   'state-blocks-spend     loam said vacation / paused / no-new-data.
;;   'cortex-not-ready       Cortex hasn't booted.
;;   'service-not-yet-wired  etsy/abandoned-carts offline or null.
;;   'pii-gate-closed        BUYER pii gate not open (Lane B5 §6).
;;   'no-qualifying-carts    all carts filtered out by value/age bounds.
```

This block is then *duplicated* (not replaced) by the M18 macro form
for the linter. Both stay.

### §6.7 The `;;~ language` header (G5 — sealing protocol §3.5)

Every cart shipped against Sakura Scheme 1.0 must declare its language
version in the doc-block header:

```scheme
;;~ language  sakura-scheme-1.0
```

The key MUST be the first or near-first entry in the `;;~` block. It
identifies which sealed version the cart's source contracts against.
A cart declaring `sakura-scheme-1.0` is guaranteed to run unchanged on
every 1.x runtime by the sealing protocol's §3.2 compatibility rule.
A cart declaring `sakura-scheme-2.0` opts into the (future) 2.0 break.

**Recognised values:**

| Value | Status |
|---|---|
| `sakura-scheme-1.0` | Current shipping seal (2026-Q3) |
| `sakura-scheme-1.1` | Reserved — additive release |
| `sakura-scheme-2.0` | Reserved — first allowed-to-break release |

Any other value is a hard audit failure (`CART-LANGUAGE-UNKNOWN`). A
missing header is a WARN during the transition window — the lint emits
`CART-DOC-004-missing-language-header` and the build index treats the
cart as `sakura-scheme-1.0` for back-compat. The WARN becomes an ERROR
in Sakura Scheme 1.1.

The check lives in three places, all in lockstep:

| Tool | Behavior on missing header | Behavior on unknown header |
|---|---|---|
| `scripts/build_cart_index.mjs` | Defaults `language` to `sakura-scheme-1.0`; counts in summary | Preserves value; audit script will fail it |
| `scripts/audit_carts.py` | Warns in distribution summary (transition window) | Hard fail — adds to BROKEN with `language-unknown` reason |
| `scripts/cart_lint.py` | `CART-DOC-004` WARN | Falls outside lint regex; audit catches it |

Authors writing 1.1-targeting carts during the 1.0 shipping window
declare `;;~ language sakura-scheme-1.1` and accept that the cart
will surface a transition warning until the 1.1 runtime ships.

### §6.8 LIVING markers

Per `CLAUDE.md` §"LIVING marker discipline" — when you write a
section you can't verify, leave a marked stub rather than asserting.

```
<!-- LIVING:TODO(2026-06-30): cite the actual test that covers this -->
<!-- LIVING:RESEARCH(2026-06-30): does the macro expander handle … -->
*[needs: confirmation from runtime test that this branch fires]*
```

The hidden markers are greppable and invisible in the HTML render. The
visible inline markers (in italics) render in the HTML as an honest
gap. Both serve the same purpose: a doc that *is honest about what
is not yet checked* is more trustworthy than a doc that asserts
without verification.

---

## §7. The seven sins

These are the patterns that have broken the most carts. Each is
named so authors and reviewers can spot it and refuse it.

### §7.1 The infinite loop — `(define (done) (done))`

The cart redefines the prelude's `done` to a self-recursive closure.
The TCO trampoline loops without stack growth until fuel exhausts;
the cart halts with `PRIMITIVE_CRASH`. **662 carts in the corpus
have this bug.** Verified at `SCHEME-RUNTIME-TRUTH-2026-06-30.md`
§1.3.

```scheme
;; SIN
(define (done) (done))
```

```scheme
;; (no virtue — just remove the line; the prelude's done is the one)
```

### §7.2 The dead gate — `(eq? (assq 'X state) #t)`

`assq` returns a pair or `#f`. The pair is never `=== true`. The
gate **always** falls through to `else`, defeating the entire
purpose of the gate. **3,435 carts in the corpus have this bug**
(70.8% of the corpus). Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.7.

```scheme
;; SIN
((eq? (assq 'vacation state) #t) (escalate 'state-blocks-spend 'vacation))
```

```scheme
;; VIRTUE — probe presence with pair?
((pair? (assq 'vacation state)) (escalate 'state-blocks-spend 'vacation))
```

### §7.3 Value-binding a descriptor — `(let ((r (act …))) …)`

`act` returns a descriptor, not a result. The descriptor is `pair?`-
truthy. The cart that binds it and tests it always takes the truthy
branch; the verb never actually fires; the cart computes against
mock data. **~15 carts in the corpus have this bug.** Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.1.

```scheme
;; SIN
(define (fetch ctx)
  (let ((r (act 'etsy/orders (list) 'check-orders)))
    (if (pair? r) (process r) (escalate 'sad null))))
```

```scheme
;; VIRTUE — return the descriptor, read the result in the next state
(define (fetch ctx)
  (act 'etsy/orders (list) 'check-orders))

(define (check-orders ctx)
  (let ((r (ctx-result ctx)))
    (cond
      ((null? r) (escalate 'service-not-yet-wired '(...)))
      (else (next 'process (ctx-set 'orders r ctx))))))
```

### §7.4 Multi-arg next — `(next 'state (ctx-set …) (ctx-set …))`

JavaScript silently drops the third argument. The downstream state
sees only the first ctx-set; the second is lost. ~10 instances in
the corpus across ~8 carts. Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.2.

```scheme
;; SIN
(next 'fetch (ctx-set 'a 1 ctx) (ctx-set 'b 2 ctx))
```

```scheme
;; VIRTUE — nest the ctx-sets
(next 'fetch (ctx-set 'a 1 (ctx-set 'b 2 ctx)))
```

### §7.5 Multi-arg state function — `(define (check-gate ctx req) …)`

The driver calls every state function with `[ctx]` — exactly one
argument. Extra parameters bind to `undefined`. The cart computes
against undefined and produces a garbled descriptor or a crash. 1,431
occurrences across 421 files. Verified at
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` §1.8.

```scheme
;; SIN
(define (check-gate ctx loam-response)
  (if (eq? loam-response 'ok) (next 'fetch ctx) (escalate 'sad null)))
```

```scheme
;; VIRTUE — read the previous act's result from ctx, never from a parameter
(define (check-gate ctx)
  (let ((loam-response (ctx-result ctx)))
    (if (eq? loam-response 'ok) (next 'fetch ctx) (escalate 'sad null))))
```

### §7.6 Tier-bloat — Magic for a sticker sheet

A cart that uses `model/deep-reasoning` (the deep-purple Magic tier)
when `model/fast` (white) would do is *spending the operator's tokens
on the cart author's lack of taste*. The tier is the operator's
money. Use the smallest tier that gets the answer right.

The architect's framing at `feedback_tiers_are_pricing_not_gates`:
"Magic is not a capability gate; Magic is a price differential." A
sticker-sheet cart that calls Magic is a cart that costs the operator
$0.40 per run when it should cost $0.004.

> **RULE.** Pick the tier by the *minimum* reasoning needed. Sticker
> sheets, copy edits, format conversions → `model/fast` (white). Multi-
> step reasoning over context → `model/workhorse` (light-purple).
> Deep multi-document synthesis, multi-tool sessions → `model/deep-
> reasoning` (deep-purple). When in doubt, pick smaller; the cart
> escalates with `'service-not-yet-wired` if the smaller model can't
> handle it, and the cart author rewrites.

### §7.7 Substrate-eating-itself — carts that showcase the engine

A cart whose purpose is to demonstrate that the engine works is a
cart that wastes the operator's slot count, attention, and trust.
The four-question ship check (`CLAUDE.md` §"The four-question ship
check") fails: there is no *real user* (only the cart author), no
*real path* (only a demo path), no *real test* (the engine's own
tests), no *real doc section* (only meta-doc about the engine).

The corpus has historically suffered from this in burst-generated
batches — a cart whose entire purpose was *to test that the cart
generator works*. Those carts are dead weight. The four-question
ship check is the boundary.

> **RULE.** Every cart serves a named operator outcome. Engine-
> demonstration carts live in the test suite, not the corpus.

---

## §8. The seven virtues

Pair-for-pair with the seven sins, the patterns to write instead.

| Sin | Virtue |
|---|---|
| §7.1 `(define (done) (done))` | **Use the prelude's `done`.** Never define `done`. |
| §7.2 `(eq? (assq 'X s) #t)` | **Probe presence with `pair?`.** Read value via `(cdr (assq …))` after the guard. |
| §7.3 `(let ((r (act …))) …)` | **Return the descriptor; read the result in the next state.** Result lives in `(ctx-result ctx)`. |
| §7.4 Multi-arg `next` | **Nest ctx-sets.** `(next 'state (ctx-set 'a a (ctx-set 'b b ctx)))`. |
| §7.5 Multi-arg state fn | **Single-arg state fn.** Thread extra data via ctx, read with `ctx-get`. |
| §7.6 Tier-bloat | **Minimum sufficient tier.** Escalate up only when the smaller model demonstrably can't. |
| §7.7 Engine-showcase | **Named operator outcome.** Every cart names an operator it serves and a goal it advances. |

The virtues are not a list to be memorized; they are the shape that
emerges when the author has internalized §1 (the contract), §2 (the
cart shape), and §4 (the state machine). A reviewer who reads a cart
and finds none of the seven sins, but cannot articulate which virtues
the cart embodies, has reviewed too quickly.

---

## §9. Examples

### §9.1 Minimal correct cart (10 lines + headers)

A pure-analysis cart, no side effects, no Cortex write. The minimum
viable shape:

```scheme
;;~ title    "Listing-age distribution"
;;~ author   "lacuna"
;;~ version  1
;;~ mode     analysis
;;~ flavor   white
;;~ id       age-distribution
;;~ touches  ()
;;~ summary  "How old your inventory is."

(cart 'age-distribution
  '((author    . "lacuna")
    (version   . 1)
    (read-only . #t)))

(define (start ctx)
  (cond
    ((not (ctx-get 'shop-connected ctx)) (escalate 'shop-not-connected null))
    (else (next 'fetch ctx))))

(define (fetch ctx)
  (act 'etsy/listings (list 'age-distribution) 'render))

(define (render ctx)
  (let ((rows (ctx-result ctx)))
    (cond
      ((null? rows)             (escalate 'no-data null))
      ((eq? rows 'rate-limited) (after 30 'fetch ctx))
      (else (begin
              (table rows '(listing-id title metric value))
              (done))))))
```

Three state functions, one act, one terminal cluster. Reads in one
glance. Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks`.

### §9.2 Medium cart with macros (40 lines)

A cart with the loam gate, cache check, model call, write, and
render — the canonical pipeline. With macros, the whole thing fits
in 40 lines:

```scheme
;;~ title    "Anomaly watcher — daily"
;;~ author   "lacuna-engineering"
;;~ version  1
;;~ mode     composer
;;~ flavor   pink
;;~ id       anomaly-watcher-daily
;;~ trigger  cron:daily
;;~ touches  (cortex)
;;~ summary  "Surface listings that broke their own pattern overnight."

;; WHAT: detect listings whose 24-hour metrics are >2σ from their 30-day baseline.
;; WHY NOW: catching anomalies fast = catching the problem fast.
;; CAPABILITY: (etsy/listings) (stats/zscore) (model/fast) (cortex/recall) (cortex/remember)
;; SCOUT LABEL: "the anomaly watcher"
;; HONESTY (per [[feedback_no_false_product_claims]]):
;;   This cart NEVER suggests a fix without showing the metric movement.
;;   If etsy/listings returns null the cart escalates honestly.
;; IDEMPOTENCY: cron-window dedupe (operator, slug, schedule_window).
;; ERROR GRAMMAR: state-blocks-spend, cortex-not-ready, service-not-yet-wired, service-garbled.

(cart 'anomaly-watcher-daily
  '((author . "lacuna-engineering") (version . 1) (cadence . daily)
    (tier . pink) (model . model/fast) (pii . NONE) (read-only . #f)))

(define-cortex-landsite
  :topic 'anomaly-watcher
  :shape '(:scanned int :flagged int :anomalies list :scanned_at timestamp))

(define-error-grammar
  ('state-blocks-spend     "loam blocked the spend")
  ('cortex-not-ready       "Cortex hasn't booted")
  ('service-not-yet-wired  "etsy/listings offline or null")
  ('service-garbled        "service returned a non-list"))

(with-loam-gate ctx 'check-cache)

(with-cortex-cache ctx
  :topic 'anomaly-watcher :window 'now
  :on-hit 'render-cached :on-miss 'fetch-listings)

(define (fetch-listings ctx)
  (act 'etsy/listings (list ':window '24h) 'check-listings))

(check-act-result ctx
  :from 'etsy/listings :retry-at 'fetch-listings :retry-after 60
  :store-as 'listings :on-ok 'analyse :kind 'service-garbled)

(define (analyse ctx)
  (let ((listings (ctx-get 'listings ctx)))
    (next 'remember (ctx-set 'finding (flag-anomalies listings) ctx))))

(remember-and-render ctx
  :topic 'anomaly-watcher :slug 'anomaly-watcher-daily
  :scout "the anomaly watcher"
  :one-liner "Overnight scan complete — anomalies flagged for review."
  :finding-key 'finding :card-event 'anomaly-watcher-ready)
```

The cart reads top-to-bottom in execution order. Each macro call is
a named intention. The only state function the author had to write
is `analyse`, which is the actual domain logic. The rest is generated
by the dialect.

### §9.3 A Magic-tier cart (with deep-reasoning + Loam COHORT)

```scheme
;;~ title    "Quarterly strategy brief — Loam COHORT synthesis"
;;~ author   "lacuna-engineering"
;;~ version  1
;;~ mode     composer
;;~ flavor   deep-purple
;;~ id       quarterly-strategy-magic
;;~ trigger  cron:quarterly
;;~ touches  (cortex loam)
;;~ summary  "Synthesise 90 days of operator history into a strategic brief."

;; WHAT: read 90 days of Cortex, loam-COHORT-compare against similar shops,
;;       synthesize a 1-page strategic brief with deep-reasoning.
;; WHY NOW: Magic tier — the operator pays for synthesis they couldn't do alone.
;; CAPABILITY: (loam/cohort) (cortex/recall-window) (model/deep-reasoning)
;;             (cortex/remember) (envelope/queue)
;; SCOUT LABEL: "the strategist"
;; HONESTY: every claim cites a Cortex record id; the brief lists its sources.
;;          If loam/cohort returns null (no comparable shops) the cart degrades
;;          to single-shop synthesis with an honest caveat in the brief.
;; IDEMPOTENCY: cron-window dedupe (operator, slug, schedule_window=quarter).
;; ERROR GRAMMAR: state-blocks-spend, cortex-not-ready, service-not-yet-wired, sparse-cohort.

(cart 'quarterly-strategy-magic
  '((author . "lacuna-engineering") (version . 1) (cadence . quarterly)
    (tier . magic) (model . model/deep-reasoning) (pii . NONE) (read-only . #f)))

(define-cortex-landsite
  :topic 'quarterly-strategy
  :shape '(:quarter string :brief string :sources list :cohort-size int :written_at timestamp))

(define-error-grammar
  ('state-blocks-spend    "loam blocked the spend")
  ('cortex-not-ready      "Cortex hasn't booted")
  ('service-not-yet-wired "deep-reasoning session offline")
  ('sparse-cohort         "fewer than 5 comparable shops in COHORT — degrading to single-shop"))

(with-loam-gate ctx 'load-window)

(define (load-window ctx)
  (act 'cortex/recall-window (list ':days 90) 'check-window))

(check-act-result ctx
  :from 'cortex/recall-window :retry-at 'load-window :retry-after 30
  :store-as 'history :on-ok 'load-cohort :kind 'service-garbled)

(define (load-cohort ctx)
  (let ((history (ctx-get 'history ctx)))
    (act 'loam/cohort
         (list ':axis 'category ':window 90 ':sample-size 25)
         'check-cohort)))

(define (check-cohort ctx)
  (let ((cohort (ctx-result ctx)))
    (cond
      ((null? cohort)
        (next 'synthesise-solo (ctx-set 'cohort 'sparse ctx)))
      ((< (length cohort) 5)
        (next 'synthesise-solo (ctx-set 'cohort cohort ctx)))
      (else
        (next 'synthesise (ctx-set 'cohort cohort ctx))))))

(with-model-call ctx
  :verb 'model/deep-reasoning
  :prompt (build-strategy-prompt
            (ctx-get 'history ctx)
            (ctx-get 'cohort ctx))
  :budget 'deep
  :store-as 'brief :on-ok 'remember
  :retry-at 'synthesise :retry-after 60)

(remember-and-render ctx
  :topic 'quarterly-strategy :slug 'quarterly-strategy-magic
  :scout "the strategist"
  :one-liner "Quarterly strategy brief ready — synthesised from your history and 25 comparable shops."
  :finding-key 'brief :card-event 'quarterly-strategy-ready)
```

The Magic-tier shape is the same as the pink-tier shape — same
phases, same macros, same naming — except the verb is `model/deep-
reasoning` and the prompt builder is heavier. The *tier is pricing,
not capability*: Sakura's character is constant across tiers
(`feedback_tiers_are_pricing_not_gates`, project notes 2026-06-19).
What changes is the size of the model the operator's money pays for.

### §9.4 A side-by-side rewrite

A real shallow cart from the corpus and its deepened form. The
original (abridged from a representative `imagine/` tier cart):

```scheme
;; BEFORE — 38 lines, 1 sin (ASSQ-DEAD-GATE)
(define (start ctx)
  (act 'loam/operator-state (list) 'check-state))

(define (check-state ctx)
  (let ((state (ctx-result ctx)))
    (cond
      ((null? state) (escalate 'cortex-not-ready null))
      ((eq? (assq 'vacation state) #t)                    ;; ← SIN §7.2
        (escalate 'state-blocks-spend 'vacation))
      ((eq? (assq 'paused state) #t)                      ;; ← SIN §7.2
        (escalate 'state-blocks-spend 'paused))
      ((eq? (assq 'no-new-data state) #t)                 ;; ← SIN §7.2
        (escalate 'state-blocks-spend 'no-new-data))
      (else (next 'fetch ctx)))))

(define (fetch ctx)
  (act 'etsy/listings (list) 'check-listings))

(define (check-listings ctx)
  (let ((listings (ctx-result ctx)))
    (cond
      ((null? listings)
        (escalate 'service-not-yet-wired
                  '(:status not-wired :reason "etsy/listings-returned-null")))
      ((eq? listings 'rate-limited) (after 60 'fetch ctx))
      ((not (pair? listings))
        (escalate 'service-garbled '(:status not-wired :reason "non-list")))
      (else (next 'render (ctx-set 'listings listings ctx))))))

(define (render ctx)
  (let ((listings (ctx-get 'listings ctx)))
    (table listings '(listing-id title price))
    (done)))
```

After (10 lines of state code; the macros do the rest):

```scheme
;; AFTER — 10 lines of state code, 0 sins
(define-error-grammar
  ('state-blocks-spend    "loam blocked the spend")
  ('cortex-not-ready      "Cortex hasn't booted")
  ('service-not-yet-wired "etsy/listings offline or null")
  ('service-garbled       "etsy/listings returned non-list"))

(with-loam-gate ctx 'fetch)

(define (fetch ctx)
  (act 'etsy/listings (list) 'check-listings))

(check-act-result ctx
  :from 'etsy/listings :retry-at 'fetch :retry-after 60
  :store-as 'listings :on-ok 'render :kind 'service-garbled)

(define (render ctx)
  (let ((listings (ctx-get 'listings ctx)))
    (table listings '(listing-id title price))
    (done)))
```

The macros eliminate the dead-gate bug *by construction* — M01's
expansion uses `pair?`, not `eq? … #t`. The rewrite is not just
shorter; it is correct in a way the original could never be without
the author noticing.

---

## §10. Corrections to existing code

This section names specific code corrections that bring the existing
runtime, macros, and corpus into alignment with the style guide. Each
correction cites `file:line` and is marked **mechanical** (a sed-style
auto-fix) or **judgment** (requires human review).

### §10.1 Runtime corrections

**R-1. `cartHost.js:91-103` — freeze the env before cart evaluation.**
**Judgment.** The env is currently unfrozen at cart-eval time
(`buildLiveCartEnv` calls `makeBaseEnv` + `installCartPrelude` but
not `env.freeze()`). This is the root enabler of the §7.1 sin
(`(define (done) (done))` shadows the prelude). Adding a `freeze()`
call after `installCartPrelude` would make 662 carts crash on parse
instead of crashing on run — a strict improvement.

```diff
  for (const form of parse(cartSrc)) evaluate(form, env, fuel)
+ env.freeze()
  return env
```

The trade-off: a frozen env throws on `(define done …)` rather than
silently shadowing. The thrown error is clearer than a fuel-exhaust
halt 200,000 steps later. The 662 affected carts would all need
the `(define (done) …)` line removed before they could run; this is
exactly the migration §11 phases.

**R-2. `cartPrelude.js:91` — `interrupted` default reason.** **Judgment.**
The current default of `sym('user')` is opaque. A future caller
inspecting the bus sees `'user` and has no idea whether the operator
spoke, the network dropped, or the device timed out. Either define
canonical reasons (`'speech` / `'silence` / `'timeout` / `'cancel`)
and require one explicitly, or rename the default to `'unspecified`
so the bus reader knows the cart didn't supply one. Low impact (the
interrupted descriptor is rarely used).

**R-3. `cartDriver.js:73-78` — `destructiveVerbs` is opt-in.** **Judgment.**
The consent gate is only applied when the host passes a
`destructiveVerbs` set. The default `runCartLive` path
(`cartHost.js:205-401`) does not pass one. Every destructive verb in
the corpus currently relies on the dispatcher's own gate, not the
driver's. The driver's gate exists but is dead code in production.
Either remove it (one less moving part) or wire it from
`runCartLive` with the registered destructive set (audit consistency).

### §10.2 Macro corrections

**M-1. `macros/expand.js:1-335` — add the 18 cart-layer macros.**
**Mechanical** (defined fully in `PASS-2-MACROS-2026-06-30.md`). The
file currently has 36 macros covering motion/note/form/timing/mode/
atmosphere. None cover the cart state-machine domain. Append a
`CART_MACROS` array containing M01-M18, add it to `ALL_MACROS` at
line 297, and update `MACRO_COUNT` at line 327.

**M-2. `macros/expand.js` — `with-comms-compliance` is referenced
but unbound.** **Mechanical.** The macro is called by 30+ carts but
not defined in `expand.js`. Each cart that uses it currently errors
with "unbound symbol: with-comms-compliance" at expansion. M06 of
PASS-2 defines it; landing M-1 above fixes this.

**M-3. Hygiene resolution for M01-M16.** **Judgment + research.** The
M01 macro generates `check-state__` via hygiene; the cart cannot
reach it via `(next 'check-state …)`. The contract is: the cart never
defines a state literally named `check-state` when using M01. This
should be enforced by the linter and documented in the macro's
docstring.

<!-- LIVING:RESEARCH(2026-06-30): the M03 (`check-act-result`)
generates a `define` form. The cart driver looks states up by name.
Resolution required: either (a) the cart wraps the macro in
`(define (check-orders ctx) (check-act-result ctx …))`, keeping the
public name explicit, or (b) M03 generates a wrapper under the name
passed as a macro argument. Current proposal in PASS-2 is (a); verify
with the expander team. -->

### §10.3 Corpus corrections

**C-1. Auto-fix CART-003 (ASSQ-DEAD-GATE) across 3,435 carts.**
**Mechanical.** Replace `(eq? (assq 'X s) #t)` with `(pair? (assq 'X s))`
across the corpus. Sed-equivalent script available at
`scripts/cart_lint.py --fix --rule CART-003-eq-assq-dead-comparison`.
This is the single highest-leverage fix in the corpus history.

**C-2. Auto-fix CART-001 + CART-002 (DONE-REDEF) across 662 carts.**
**Mechanical.** Remove every `(define (done) <body>)` line. The
prelude's `done` is the canonical one. Sed-equivalent script
available at `scripts/cart_lint.py --fix --rule CART-001`.

**C-3. Manual-fix CART-005 (MULTI-NEXT) across 10 instances.**
**Judgment.** Nest the ctx-sets. Too few instances for automation;
~8 carts to hand-fix, each ~2 lines of edit.

**C-4. Manual-fix CART-007 (CTX-SET-WRONG-ORDER) across 39 carts.**
**Judgment.** Six carts (the locally-shadowed ones) are intentional;
flag them by adding `;; uses local ctx-set shadow with (ctx, key, val)
convention` above the local define so the linter and future readers
can tell. The other 39 carts mechanical-fix from
`(ctx-set ctx 'k v)` to `(ctx-set 'k v ctx)`.

**C-5. Add M17/M18 to all carts that escalate or write to Cortex.**
**Judgment.** The bulk of the corpus today documents these in prose
only. M17/M18 are no-op macros whose value is linter-parseability. A
batch sweep can generate the M18 form from the existing prose
`ERROR GRAMMAR` block (the corpus has consistent formatting); M17
requires more care since the landing shape is per-cart.

### §10.4 Documentation corrections

**D-1. `ENGINEERING.md` §7 — name the seven
descriptors with their exact signatures.** **Judgment.** The current
section describes the cart driver loop but does not lay out the
seven descriptors as a single canonical table. This style guide's
§1.1 is the canonical table; the Engineering doc should reference it.

**D-2. `REFERENCE.md` — annotate every verb with
its return shape.** **Judgment.** A verb's return shape determines
the `check-act-result` it pairs with. Today the reference catalog
gives the verb's purpose but not the *shape* of what it returns.
Adding a `Returns:` line per verb (one of: `pair · symbol ·
'rate-limited · null`) unlocks the linter's ability to validate that
the check-state matches the verb.

---

## §11. The migration path

The corpus is ~4,849 carts. ~84% have at least one of the seven
sins. Migrating the corpus to the style guide is a multi-phase
process; each phase has its own success criterion and gate.

### §11.1 Phase 1 — Mechanical sed fixes (DONE for ASSQ; pending for DONE-REDEF)

| Bug | Approach | Status |
|---|---|---|
| ASSQ-DEAD-GATE (3,435 carts) | `scripts/cart_lint.py --fix --rule CART-003` | DONE per `CART-LINT-REPORT-2026-06-30.md` |
| DONE-REDEF (662 carts) | Remove `(define (done) …)` lines | Pending |
| CTX-SET-WRONG-ORDER (39 carts, unshadowed) | Per-file edit; review the 6 shadowed carts | Pending |

The mechanical phase has zero impact on cart behavior beyond *fixing
the bug*. No new tests need to pass; the cart that was wrong becomes
right.

### §11.2 Phase 2 — Macro retrofit (sweep script over the corpus)

Once M01-M18 land in `macros/expand.js`, a sweep script can detect
the canonical 14-line Pattern A (loam-gate) shape and replace it
with `(with-loam-gate ctx 'NEXT)`. Similarly for Patterns C
(check-act-result), D (remember-and-render), B (with-cortex-cache),
and H (cortex-recall/checked).

Estimated reach (from `PASS-2-MACROS-2026-06-30.md`):

| Pattern | Carts | Lines saved |
|---|---:|---:|
| A — `with-loam-gate` | 4,471 | 58,000 |
| C — `check-act-result` | 10,500 (occurrences) | 94,500 |
| D — `remember-and-render` | 2,064 (clusters) | 53,664 |
| B — `with-cortex-cache` | 4,449 | 48,900 |
| H — `cortex-recall/checked` | ~3,000 | ~24,000 |

Total: ~280,000 lines of avoidable boilerplate removed across ~10,000
cart files. The sweep is per-file, deterministic, and reversible (a
git checkout brings the original back).

The acceptance test for the sweep: every swept cart still produces
byte-identical `CART_END` events under replay, against a seed corpus
of 50 manually-validated carts.

### §11.3 Phase 3 — Deepen the shallow carts

A *shallow* cart is one that runs the canonical pipeline but never
delivers a meaningfully unique answer — every output reads similarly
because every input is processed identically (no domain logic, no
honest reasoning, no operator-specific tailoring). The
`PASS-2-SHALLOW-TO-DEEP-2026-06-30.md` audit identifies these.

Phase 3 is hand-work: each shallow cart gets rewritten with a
meaningful `analyse` or `synthesise` state — the one place the
macros cannot help. The output is judged by an operator review (does
this cart say something the operator didn't already know?).

This is the slowest phase. Budget ~50 carts/week with one author.
The 1,000-or-so shallow carts represent ~6 months of deepening at
that rate. Acceptance: every deepened cart passes the four-question
ship check (`CLAUDE.md` §"The four-question ship check").

### §11.4 Phase 4 — Style review in every PR

Once phases 1-3 are complete (or in flight), every PR that touches a
cart runs the linter at `scripts/cart_lint.py`. The pre-commit hook
(set up via `git config core.hooksPath .githooks`) runs the linter
on changed `.sks` files and rejects the commit on any error-severity
finding. Warnings are reported but don't block.

The linter rules are the executable form of this style guide. When
the guide updates (new sin discovered, new virtue named), the linter
gets the rule the same day.

> **RULE.** A PR that lands a new cart and the linter passes is a PR
> that lands a cart conforming to the style guide. A PR whose cart
> doesn't pass the linter is rejected.

---

## §12. What's out (1.1 candidates)

The 1.0 style guide intentionally leaves the following out. Each is a
real desire; each is also a real cost. Naming them as deferrals is
the honest move; rushing them into 1.0 would lock in shapes we'd
regret.

### §12.1 Full hygienic macro system (syntax-case)

The `syntax-rules` system at `macro.js` handles the 18 cart-layer
macros and 36 dialect-floor macros. It is not full `syntax-case` —
it does not let macro authors pattern-match on syntax objects, write
recursive expanders in Scheme, or introduce identifiers under
controlled hygiene. A future need will surface; for 1.0, the
existing system is enough.

### §12.2 Quasi-quotation patterns beyond one level

The reader (`reader.js`) parses `` ` ``, `,`, and `,@` but the
expander does one level of unquoting. Nested quasiquotes drop a level
per nesting. Carts have not needed deeper than one level; deferring
the full nesting saves the cost of either a new reader path or a
runtime check that nesting depth is 1.

### §12.3 Continuations (call/cc)

The runtime explicitly forbids `call/cc` and `dynamic-wind` (`SAKURA-
SCHEME-1.0-ENGINEERING.md` §2.2). A continuation could capture state
before a gate decision and re-enter after — defeating the capability
boundary. The cost of supporting `call/cc` is the entire security
model. Not a 1.0 candidate; never a candidate without the architect's
sign-off on a new security model.

### §12.4 `define-cart` — implicit ctx threading

A **1.1 candidate** worth proposing. The current `(cart 'slug
'((attrs)))` form is a metadata sink — it stashes the cart's id and
attrs and returns null (`cartPrelude.js:55-62`). A `define-cart`
macro could subsume the prose `;;~` header, the M17 landing shape,
the M18 error grammar, and the `(cart 'slug …)` form into one
declaration:

```scheme
(define-cart anomaly-watcher-daily
  :title    "Anomaly watcher — daily"
  :author   "lacuna-engineering"
  :tier     pink
  :model    model/fast
  :cadence  daily
  :pii      NONE
  :scout    "the anomaly watcher"
  :landsite '(:scanned int :flagged int :anomalies list)
  :errors   '((state-blocks-spend "loam blocked")
              (service-not-yet-wired "etsy/listings offline"))
  …)
```

The cost is two: every cart in the corpus would need to migrate, and
the `;;~` header consumed by `build_cart_index.mjs` would need a
parallel reader. The gain is significant: one source of truth for
all cart metadata. **Proposed for 1.1** after the Phase 2 macro
retrofit lands and the corpus has been audited for header drift.

### §12.5 `loam/watch` — event-driven Magic carts

The architect's mention 2026-06-29: an event-driven primitive that
fires a cart when a Cortex/Loam value changes, rather than on a cron
schedule. This unlocks a class of Magic carts that today require
expensive 5-minute polling (e.g., *"watch this listing; tell me
when its conversion rate drops"*).

**Proposed for 1.0 promotion** if the runtime work is small. Risk:
the watch primitive needs a careful idempotency story (a watch that
fires twice for one event is worse than no watch at all). Defer
unless the runtime team can land it without compromising
idempotency. <!-- LIVING:RESEARCH(2026-06-30): scope the runtime cost
of `loam/watch`; if <2 weeks of engineering and idempotency is
provable, promote to 1.0. -->

### §12.6 Multi-act states (`act-parallel`)

A cart that needs to fire two independent acts and gather both
results currently does so as two sequential states. An `act-parallel`
primitive — `(act-parallel ((:a 'verb-a args) (:b 'verb-b args))
'collect)` — would let one state issue both. The runtime
implementation is non-trivial (the bus expects one act per state;
result threading needs to be a multi-key map instead of a single
`'last-result`). The complexity isn't worth it until the corpus has
demonstrated need. Today, no cart needs it.

### §12.7 First-class scout objects

The scout label (§3.5) is today a string in the envelope. A
first-class scout *object* (with an identity, a portrait, a voice,
a history of cart runs) is a Sakura roadmap item — it ties to the
sprite system at HelloSurface §10. Not a Scheme dialect change;
deferring to the substrate.

---

## §13. Closing

A style guide for a tiny dialect is, on its face, a strange thing to
spend a thousand lines on. The justification, if there is one, is
that the dialect is the *only* surface between the operator and the
work. A bug in the cart is a bug the operator feels — their cart was
supposed to fire, didn't, and they lost a sale. A clever pattern in
the cart is a pattern the on-device savant will train on tomorrow,
and write a thousand copies of next week. The corpus is the product,
the corpus is the training data, and the corpus is the operator's
trust ledger.

This guide is a love letter to the Scheme tradition — the small,
honest, capability-bounded interpreter that does so much when its
combinators are right — and to the operators who pay for the work in
real money and real attention. The 18 macros, the seven sins, the
seven virtues, the six-grammar of error kinds, the scout labels: each
is a small choice made so that the next cart can be a little more
beautiful than the last, and so that the operator never has to read
the source to know they can trust it.

The bar the architect set: *"I'm taking people's money, and they
trust me. And I really want to do them better than they expect. I
really don't want to hurt them in any way."* This guide exists for
that bar. If a future author reads it and writes a cart that honors
that trust, the guide has done its job.

---

## Approval

| Role | Name | Status | Date |
|---|---|---|---|
| Author | Soo-Jin (Scheme composition lead) | drafted | 2026-06-30 |
| Architect | (operator) | pending review | — |
| Fact-checker | (next session) | every `file:line` to be re-resolved | — |

---

*Source: `docs/STYLE-GUIDE.md`. Pairs with
`ENGINEERING.md` (runtime), `SAKURA-SCHEME-1.0-
REFERENCE.md` (verb catalog), `SAKURA-AUTOMATIONS-1.0.md` (cart
corpus), `PASS-2-MACROS-2026-06-30.md` (macro specifications),
`SCHEME-RUNTIME-TRUTH-2026-06-30.md` (calling-convention ground
truth).*
