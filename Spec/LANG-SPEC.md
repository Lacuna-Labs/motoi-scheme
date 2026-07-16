# Sakura Scheme — Language Specification (Draft 1)

> **Status:** Draft 1 — 2026-07-13. Light spec, meant to give shape.
> Not a full standard. It answers "what is Sakura Scheme?" clearly
> enough that you can write programs and know why a verb turned red.
>
> **Audience:** anyone writing a cart, forking the language, or auditing
> the runtime. If you want to know what a specific verb does, read
> `docs/SAKURA-SCHEME-REFERENCE.slat`. This document tells you how the
> *language* around those verbs is shaped.
>
> **Companion docs:**
> · `docs/ENGINEERING.md` — Lang section indexes every runtime subsystem
> · `docs/SAKURA-SCHEME-REFERENCE.slat` — the 1,157-verb + 70-form catalogue
> · `docs/TUTORIAL.html` — hands-on on-ramp
> · `docs/REPL.md` — full REPL feature set + key bindings

---

## §0. In a paragraph

Sakura Scheme is a small, capability-bounded Lisp-1 that runs anywhere
Node runs and in the browser. It is R7RS-small-shaped, with hygienic
`syntax-rules` macros, tail-call optimization, and a curated set of
extensions for drawing, sound, animation, games, AI, and commerce. Its
distinguishing feature is that **the reference SLAT is the language**:
every verb declared in `SAKURA-SCHEME-REFERENCE.slat` becomes a bound
name in every REPL, either as a real implementation or as a
contract-quoted stub that errors cleanly. Nothing is silently unbound.

---

## §1. Lexical structure

### §1.1 Character set

UTF-8 throughout. Source files are text; strings and symbols may
contain any UTF-8 codepoint.

### §1.2 Tokens

The reader recognises:

| Token           | Shape                                        | Example                       |
|-----------------|----------------------------------------------|-------------------------------|
| Left paren      | `(` `[`                                      | `(`                           |
| Right paren     | `)` `]`                                      | `)`                           |
| Quote           | `'`                                          | `'foo`                        |
| Quasiquote      | `` ` ``                                      | `` `(1 ,x) ``                 |
| Unquote         | `,`                                          | `,x`                          |
| Unquote-splice  | `,@`                                         | `,@xs`                        |
| Number          | integer, decimal, or signed thereof          | `42`, `-3.14`, `+0`           |
| String          | `"..."` with R7RS §6.7 escapes               | `"hi\n"`, `"tab\there"`       |
| Character       | `#\a`, `#\space`, `#\newline`, `#\tab`       | `#\A`                         |
| Boolean         | `#t`, `#f`, `#true`, `#false`                | `#t`                          |
| Symbol          | anything else that isn't whitespace or delim | `car`, `card/edit`, `+`, `=?` |
| Line comment    | `;` to end of line                           | `; comment`                   |
| Datum comment   | `#;` — skip the next form                    | `#;(dead code)`               |

### §1.3 Whitespace and delimiters

Whitespace: space, tab, CR, LF. Delimiters: whitespace and any of
`()[];"'`` ` ``,`. Symbols end at the first delimiter.

### §1.4 String escapes

Per R7RS §6.7: `\n` `\r` `\t` `\\` `\"`. Unknown escapes surface as
the literal two characters (backslash + char) — the reader's tolerance
lets a beginner paste code from other Schemes without a shape shock.

### §1.5 Keywords

Names beginning with `:` (e.g. `:name`, `:tier`) are ordinary symbols
but are read into SLAT keyword-tagged property bags as JS object keys.
This is why the reference file reads as executable Scheme.

### §1.6 Comments

Two forms:

- `;` line comment — everything to end of line.
- `#;` datum comment — skips the next datum, including nested lists.

Both cost nothing at runtime.

---

## §2. Values

Every value is one of:

| Type       | JS representation      | Reader syntax              | Notes                         |
|------------|------------------------|----------------------------|-------------------------------|
| Number     | JS `Number`            | `42`, `3.14`, `-0.5`       | IEEE 754 double throughout    |
| Boolean    | `true` / `false`       | `#t` / `#f`                | Only `#f` is falsy            |
| String     | JS `String`            | `"hello"`                  | Immutable                     |
| Character  | 1-char string          | `#\a`                      | Compact — same as strings     |
| Symbol     | `Sym` instance         | `foo`, `card/edit`         | Interned by `sym()` helper    |
| List       | JS `Array`             | `(1 2 3)`, `'(a b c)`      | `pair?` iff length > 0        |
| Empty list | `[]`                   | `'()`                      | `null?` iff empty             |
| Procedure  | JS function OR Closure | (result of `lambda`)       | `procedure?` = true           |
| Undefined  | `undefined`            | (no reader syntax)         | Prints as `()` or `nil`       |

### §2.1 Numbers

One numeric type: JS `Number` (IEEE 754 double). No bignums, no exact
rationals, no complex. `integer?`, `rational?`, `real?`, `number?`,
`nan?`, `infinite?`, `finite?` all return the intuitive answer; the
tower is flat.

### §2.2 Strings and characters

Strings are immutable UTF-16 sequences. Characters are one-code-unit
strings; the language treats them uniformly so `(string-ref s i)` and
`(substring s i (+ i 1))` return the same shape. This is deliberately
different from R7RS's separate char type — see §11 for the rationale.

### §2.3 Symbols

`Sym` instances are interned by the reader. `(eq? 'foo 'foo)` is `#t`;
`(symbol? 'foo)` is `#t`. Symbols have a `.name` (a JS string) accessible
via `(symbol->string s)`.

### §2.4 Lists

Lists are JS arrays. `cons`, `car`, `cdr` work as expected. A proper
list ends in `'()`; there are no improper lists in this dialect (the
tradeoff is documented in §11 and doesn't lose anything for cart authors).

### §2.5 Procedures

Two shapes, both `procedure?`:

- **Primitive** — a JS function installed via `env.define`.
- **Closure** — an instance of `Closure`, created by `lambda`.

The evaluator handles them uniformly; `apply` re-enters the same fuel
budget.

### §2.6 Hash tables, vectors, records

Reserved for the module system (§12.1). For now, use association lists
(alists) — `(assoc key alist)` — and lists of lists. The performance
loss is small at cart scale; the API surface stays smaller.

---

## §3. Special forms

The evaluator recognises **~70 core forms** — roughly the R7RS-small
set plus a handful of Sakura additions. Full definitions live in the
reference SLAT; this section names each and gives a one-line semantics.

### §3.1 Definition and binding

| Form                                  | Meaning                                                     |
|---------------------------------------|-------------------------------------------------------------|
| `(define name value)`                 | Bind name in the current env                                |
| `(define (name . args) body …)`       | Shorthand for `(define name (lambda args body …))`          |
| `(set! name value)`                   | Mutate an existing binding (throws if unbound or frozen)    |
| `(let ((n v) …) body …)`              | Local bindings, evaluated in the enclosing env              |
| `(let* ((n v) …) body …)`             | Sequential bindings — each sees the ones before             |
| `(letrec ((n v) …) body …)`           | Recursive bindings — every `n` is visible in every `v`      |
| `(letrec* ((n v) …) body …)`          | Recursive + sequential                                      |
| `(let name ((n v) …) body …)`         | Named let — `name` is a self-callable that re-enters body   |

### §3.2 Abstraction

| Form                                  | Meaning                                                     |
|---------------------------------------|-------------------------------------------------------------|
| `(lambda (a b c) body …)`             | Make a fixed-arity procedure                                |
| `(lambda args body …)`                | Rest-arg procedure — `args` binds to the argument list      |
| `(lambda (a . rest) body …)`          | Fixed + rest                                                |

### §3.3 Conditionals

| Form                                                          | Meaning                                    |
|---------------------------------------------------------------|--------------------------------------------|
| `(if test then else?)`                                        | Two-branch conditional                     |
| `(cond (test body …) … (else body …))`                        | Multi-way                                  |
| `(case key (val body …) … (else body …))`                     | Value dispatch                             |
| `(when test body …)`                                          | Run body only when true                    |
| `(unless test body …)`                                        | Run body only when false                   |
| `(and expr …)`                                                | Short-circuit conjunction                  |
| `(or expr …)`                                                 | Short-circuit disjunction                  |

### §3.4 Sequence and quoting

| Form                              | Meaning                                     |
|-----------------------------------|---------------------------------------------|
| `(begin expr …)`                  | Evaluate in sequence, return last           |
| `(quote datum)` / `'datum`        | Datum literal                               |
| `(quasiquote t)` / `` `t ``       | Template — see §3.5                         |

### §3.5 Quasiquote

One-level quasiquote:

```scheme
`(1 2 ,x)          ; (1 2 <value of x>)
`(a ,@xs b)        ; (a x0 x1 x2 b) where xs = '(x0 x1 x2)
```

Nested quasiquotes drop a level per nesting — enough for cart payloads
but not the full R7RS story. If you need deep template metaprogramming
(see §12.1), file a ticket.

### §3.6 Macros

| Form                                                      | Meaning                                     |
|-----------------------------------------------------------|---------------------------------------------|
| `(define-syntax name (syntax-rules () (pat body) …))`     | Hygienic macro definition                   |
| `(let-syntax ((n rules)) body)`                           | Local macro binding                         |
| `(letrec-syntax ((n rules)) body)`                        | Recursive local macro binding               |

Hygiene: bindings introduced by a macro are renamed so they don't
capture the callsite's environment. Free references inside the macro
body see the *macro definition site* env — the standard R7RS behaviour.

The `syntax-rules` pattern language supports:

- Literal identifiers (via the `(literals …)` clause)
- Ellipsis patterns (`x …` → repetition)
- Nested templates

Not supported: `syntax-case`, `syntax-quotation`, `define-syntax-rule`,
`er-macro-transformer`. These are the extension areas listed in §12.

### §3.7 Sakura additions

Small extensions the base spec never got around to; each is documented
verbatim in the reference SLAT.

| Form                                | Meaning                                                                                                                                            |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `(define-stub 'name "message?")`    | Register a placeholder verb that throws when called. Shows blue (user-stub) in the IDE. See §8.                                                    |
| `(=? a b)`                          | Smart equality — numbers by value, strings by value, lists structurally, symbols by name. The one comparison operator beginners actually want.     |
| `(cart 'name '(prop . val) …)`      | Cart registration form. Present at the top of every cart.                                                                                          |

---

## §4. Base library

The base library ships **~563 implemented verbs** at the R7RS shape,
grouped as follows. Every verb has an entry in the reference SLAT with
a signature, summary, three-tier examples, caveats, and drawbacks.
Names in *italics* are the small handful of Sakura-specific additions.

### §4.1 Arithmetic and math

`+ - * / modulo quotient remainder max min abs expt sqrt exp log
sin cos tan asin acos atan atan2 floor ceiling round truncate
gcd lcm number? integer? real? rational? nan? infinite? finite?
zero? positive? negative? odd? even? pi`

### §4.2 Comparison

`= < > <= >= not eq? eqv? equal? =?`

### §4.3 Lists

`list cons car cdr cadr caddr null? pair? length range map filter
reduce fold fold-left fold-right foldl foldr for-each apply append
reverse sort first last take drop nth member assoc zip any every count
sum mean`

### §4.4 Strings

`string? string-append string-length string-ref substring string->number
number->string string->symbol symbol->string string-upcase string-downcase
string-split string-join string-contains string-starts-with? string-ends-with?
string-replace string-trim string=?`

### §4.5 Predicates

`number? string? boolean? symbol? procedure? list? pair? null?
char? empty?`

### §4.6 I/O — for display, not for the world

`display newline write inspect`

There is no `read`, no `open-input-file`, no `open-output-file`.
I/O against the world is a gated verb (§7) — the base library only
sees the console.

### §4.7 Structural

`quote quasiquote unquote unquote-splicing`  (these are the reader
syntaxes; the entries exist so `,help` finds them)

### §4.8 JSON and regex

`json-parse json-stringify json? regex regex? regex-match regex-match-all
regex-replace regex-replace-all regex-split regex-test?`

### §4.9 Date / time

`now now-iso today year month day weekday hour minute second parse-date
format-iso date-string time-string days-between hours-between minutes-between
seconds-between add-days add-hours add-minutes add-seconds
is-before? is-after? is-same-day?`

### §4.10 Introspection and stubs

`inspect define-stub`

---

## §5. The Layer model — 0 through 4

Sakura Scheme is layered. Every REPL loads L0 unconditionally; higher
layers are additive. The `sakura-scheme` binary loads all five layers;
the `scheme-lang` launcher loads L0 + L1 only. A fork can pick and
choose.

### §5.1 L0 — Core (~250 verbs)

R7RS-small subset + Sakura additions. Everything in §4. Pure math,
lists, strings, JSON, dates, predicates. No side effects on the world.

**Loads:** `src/base.js` via `makeBaseEnv(fuel)`.

### §5.2 L1 — Media (~80 verbs)

The framebuffer, drawing primitives, sound synthesis, animation loop,
input handlers. Enough to write a game.

Key verbs: `set-mode set-color clear circle disc line rect rect-fill
pset pget plot render frame frame-rate set-frame-rate tone note sfx
music silence stop-sound on-frame on-key on-mouse on-gamepad sync
sleep stop tick-frame fire-key fire-mouse save-cart load-cart`

**Loads:** `src/media.js` — invoked inside `makeBaseEnv`.

### §5.3 L2 — AI (~40 verbs)

The Cortex (persistent per-user memory) and LLM interface. In this
build, the Cortex is a plain in-memory dictionary and the LLM verbs
error cleanly with an "unwired provider" message.

Key verbs: `cortex/remember cortex/recall cortex/forget cortex/keys
cortex/cosine-topk llm/complete llm/embed llm/chat ai/align ai/cohere
ai/separate ai/flock ai/seek ai/pursue ai/arrive ai/wander ai/bb-set!
ai/bb-get ai/bb-del! ai/bb-has?`

**Loads:** `src/ai.js` via `installAi(env)`.

### §5.4 L3 — Game (~100 verbs)

Entities, physics, sprites, tilemaps. Verlet integration, AABB
collisions, tile-grid queries. Written for a fantasy console feel.

Key verbs: `entity/make entity/get entity/pos entity/vel entity/pin!
entity/collides? physics/step physics/gravity! sprite sprites tilemap/set!
tilemap/get tilemap/rows tilemap/cols`

**Loads:** `src/game.js` via `installGame(env, state)`.

### §5.5 L4 — Commercial (~60 verbs)

Shop integrations: Etsy, eBay, Shopify, Meta (Instagram), Google
Analytics. Every verb is registered; every verb errors with
"sign in to use `X`" until the user runs `sakura-scheme login`.

Key verbs: `etsy/list-products etsy/create-listing etsy/update-listing
ebay/list-items ebay/best-offer shopify/list-products shopify/create-product
meta/post meta/dm google/analytics`

**Loads:** `src/commercial.js` via `installCommercial(env)`.

### §5.6 What layer am I in?

`,layers` (planned) will print each layer with its verb count and status.
For now: run the REPL and type `,verbs` to see the tallies.

---

## §6. Reference-driven language

The reference SLAT — `docs/SAKURA-SCHEME-REFERENCE.slat` — is the source
of truth for the language. Every verb has:

```
(verb
  :name         "geom/distance"
  :library      "geom"
  :kind         "pure"
  :signature    "(geom/distance x1 y1 x2 y2) -> number"
  :summary      "Euclidean distance between two points."
  :explanation  "..."
  :examples     (
    (:tier "novice"       :code "..." :note "...")
    (:tier "intermediate" :code "..." :note "...")
    (:tier "expert"       :code "..." :note "...")
  )
  :caveats      (...)
  :drawbacks    (...)
  :usecases     (...)
  :related      (...)
  :learn        (:concept "..." :prerequisites (...) :progression "..."))
```

### §6.1 The reference IS the language

At REPL boot:

1. `makeBaseEnv` binds every L0 primitive.
2. Optional layers bind L1 / L2 / L3 / L4 impls.
3. `registerReferenceVerbs` walks every verb in the SLAT:
   - If the env already binds it, **implemented**.
   - Otherwise, install a clean-error stub that carries the contract in
     its message. **Stubbed** in the registry.

The consequence: **every documented verb is at least a bound name**.
No verb in the reference throws "unbound symbol" — it either runs or
errors with its contract quoted at you.

### §6.2 Reverse check

The reverse also runs: every JS binding that is NOT in the reference is
listed by `findJsImplsMissingFromReference(env)`. These are candidates
for (a) adding to the reference, (b) documenting as "extra" builtins,
or (c) removing. The test suite runs this reverse-check on every CI.

---

## §7. Verb status semantics

Every bound name in Sakura Scheme has one of five statuses. The
terminal IDE color-codes each. See `,verbs` and `,help <verb>` for the
live view.

| Status                 | Color   | Meaning                                                                         |
|------------------------|---------|---------------------------------------------------------------------------------|
| `implemented`          | Green   | Real body. Contract met. Works as documented.                                   |
| `stubbed`              | Yellow  | Registered from the SLAT reference; throws a contract-quoted error on call.     |
| `platform-unsupported` | Orange  | Impl exists, this platform lacks a dep (Web Audio in Node, iTerm2 in xterm, …). |
| `user-stub`            | Blue    | Placeholder the user declared with `(define-stub …)`.                           |
| *(missing)*            | Red     | Not registered anywhere. Typo, or a name no dialect provides.                   |

The registry field is `:status`. It's set by `registerVerbMeta` when a
verb is bound and can be overridden by `setVerbStatus(name, status,
extras)`. A verb NOT in the registry has no meta entry; the REPL
synthesises `missing` at look-up time.

### §7.1 How to detect status

Programmatically:

```scheme
;; Not yet exposed as a Scheme verb; use JS import from the runtime:
;;   const { classifyVerb } = require('scheme-lang/src/repl/verbStatus')
;;   classifyVerb(env, 'card/edit')  // → { status: 'stubbed', ... }
```

Interactively:

```
sakura> ,help card/edit
   card/edit  · primitive · ○ stubbed
      (card/edit …)
      stubbed — contract known, no implementation yet
      not yet implemented — contract: (card/edit id patch) -> id
```

The bullet (`●`, `○`, `◐`, `◇`, `×`) is a redundant marker for
when color is off (piped output, NO_COLOR=1). See `statusMarker` in
`src/repl/verbStatus.js`.

### §7.2 User-defined stubs

Any cart author can create a placeholder:

```scheme
(define-stub 'my-verb "coming Tuesday")
```

The stub appears blue in `,help` and `,apropos`. Calling it throws a
clean error that quotes the message. This is the "stubs so you can
make stubs" affordance Alfred called for (2026-07-13).

---

## §8. The 5-tier verb system — permissions and gates

Every verb declares a `perm` — the permission floor. The dispatcher
checks the caller's tier before every verb call.

### §8.1 Perms (closed set)

```
read           — pure observation
paint          — visual side-effects only (dots, glyphs)
animate        — motion / tween / camera-fly (no state mutation)
state-change   — moves cards, focuses, opens / closes UI
destructive    — deletes data, publishes, transfers
financial      — money moves
network        — outbound network call
personal-data  — reads / writes operator PII
```

### §8.2 Caller tiers (closed set)

```
system            — engine-internal carts (shipped in build)
operator-gesture  — direct UI tap / drag / keyboard
operator-voice    — wake-word + voice command
sakura            — LLM-emitted Scheme
external          — URL hash / deep link / webhook
untrusted         — chat textarea, free-form input (default)
```

### §8.3 The tier→perm matrix

| Tier               | Perms allowed                                          |
|--------------------|--------------------------------------------------------|
| `system`           | all                                                    |
| `operator-gesture` | all                                                    |
| `operator-voice`   | all                                                    |
| `sakura`           | read, paint, animate, state-change (NOT destructive)   |
| `external`         | read, animate                                          |
| `untrusted`        | read, animate                                          |

The dispatcher walks every verb call in the parsed program. Any call
with a perm above the caller's ceiling is rejected before the runner
runs. Sakura cannot fire destructive; external / untrusted cannot fire
state-change. Belt and suspenders.

### §8.4 Platform-restricted verbs

Some verbs only work on specific platforms:

- Certain drawing adapters (e.g. Kitty graphics protocol) need a
  compatible terminal.
- Certain sound verbs need Web Audio in the browser or `node-speaker`
  in Node.
- Certain shop verbs need a signed-in operator (via `sakura-scheme login`).

When the runtime detects the platform doesn't support a verb, it marks
`:status 'platform-unsupported'`. The IDE shows orange; the verb throws
with a helpful "this platform lacks X" message.

### §8.5 The five gates

Every verb call passes through five gates in order:

1. **Registry lookup** — is the name known?
2. **Perm gate** — does the caller's tier allow this perm?
3. **Confirm gate** — does the verb need `caller.confirmed`?
4. **Schema gate** — does the shape of args pass the schema?
5. **Rate limit gate** — over/under the per-tier bucket?

Rejection returns an envelope; the runner never sees the call.

---

## §9. The cart system

A cart is a Scheme file with a header (parsed for metadata) and a body
(a state machine over `next` / `done` / `escalate` / `wait` /
`after` / `act` / `interrupted` descriptors). The cart directory tree
IS the corpus.

### §9.1 Cart file shape

```scheme
;;~ title    "Title"
;;~ author   "you"
;;~ version  1
;;~ mode     analysis
;;~ id       my-cart
;;~ touches  ()
;;~ summary  "One-line summary."

(cart 'my-cart
  '((author    . "you")
    (version   . 1)
    (read-only . #t)))

(define (start ctx)
  (card-emit 'engine 'hello "hi")
  (done))
```

### §9.2 Cart directory tree (Sakura tiers)

```
carts/
  pink/      free tier
  imagine/   $9.99
  dream/     $39.99
  magic/     $99.99
  etsy/      curator marketplace verbs
  ...
```

### §9.3 Config

`scheme-lang.config.slat` declares where carts live and slug pairing
rules. See the config file for the format.

---

## §10. Extension mechanisms — how to grow the language

### §10.1 Adding a verb

1. Write the JS impl. Place it near siblings in `src/base.js` (core),
   `src/media.js` (drawing/sound), or a new file for a new area.
2. Register with `env.define(name, fn, meta)` — the `meta` argument is
   the perm declaration:
   ```js
   env.define('my-verb', (a, b) => a + b, { perm: 'read' })
   ```
3. Add the SLAT entry in `docs/SAKURA-SCHEME-REFERENCE.slat`.
4. Add the tests.

The registry sees the binding, the dispatcher gates it, the IDE
color-codes it green.

### §10.2 Adding a whole layer

Layers 0-4 are additive. To add L5:

1. Write `src/mylayer.js` exporting `installMyLayer(env, fuel)`.
2. Call it from `src/sakuraEnv.js` after existing layers.
3. Extend the reference SLAT with the new verbs (or ship a satellite
   SLAT and load it via `loadReference({ path })`).

### §10.3 Writing a fork ("Jesse Scheme" pattern)

`TEMPLATE-FOR-FORKS.md` walks through it. The short story:

1. Fork the repo.
2. Replace the banner in `src/repl/banner.js`.
3. Point `makeYourEnv(fuel)` at the layer subset you want.
4. Optionally: add or remove verbs, restrict some perms, add new gates.
5. Publish. Your fork is now a separate dialect.

The language shape stays the same. The verb set is yours.

### §10.4 Adapter pattern

Every subsystem that touches the outside world (chip bus, canvas power,
event log, correlation ID, image rendering) reads from `src/adapters.js`.
The base ships no-op stubs; a dialect overrides with `setAdapters({...})`.
This is why the same interpreter can run in Node, in the browser, or
inside the Curator arcade — the platform binding is one file.

---

## §11. Rationale — the small stack of decisions

### §11.1 One numeric type

JS Number is IEEE 754 double. Cart authors are not writing physics
engines that need exact rationals. The bignum-less tower is a
performance win and one fewer thing to explain.

### §11.2 Character = 1-char string

R7RS's separate char type surprises beginners who paste code from JS.
The unified representation costs nothing performance-wise and removes
one class of "why doesn't this work" question.

### §11.3 No mutable cons cells

`(set! (car x) 'new)` would let a cart mutate shared list literals.
`cons` returns a fresh JS array. Mutation is via `set!` on a name.
The 1970s optimisation isn't worth the correctness cliff.

### §11.4 No `call/cc`

Continuations would break the dispatcher's structural walk. A verb
inside a continuation could be captured, hoisted past a permission
gate, and re-entered. The gate can only be sound if the AST is what
runs. `call/cc` is a candidate for a later ratchet; not in scope now.

### §11.5 No `eval`, no runtime `read`

Ambient authority via `eval` is the classic Lisp security foot-gun.
The `apply` seam re-enters Scheme with values, not text — enough for
every cart pattern we've encountered.

---

## §12. What's Reserved / Not Yet Spec

These are the intentional gaps. If you hit one, file a ticket; the
answer might be "we picked the current shape on purpose" or "yes,
let's fix that."

### §12.1 The module system

Not yet designed. `require`, `import`, `use-module`, `library` are all
reserved names. Present shape: everything lives in the base env.

### §12.2 Full hygienic macros edge cases

`syntax-rules` works for the patterns in the reference SLAT and the
carts we've written. Deeply nested ellipses + fender expressions have
been observed to trip; we haven't nailed the failure taxonomy.

### §12.3 Continuation depth and tail-call semantics

TCO is trampolined via `Tail` / `TailCall` sentinels. The tail
positions we handle are enumerated in `src/interp.js:9-37`. Corner
cases (`(and (foo) …)` where `foo` returns a tail-thunk) are not fully
audited.

### §12.4 Error taxonomy

Every runtime error goes through `throw new Error(...)`. There's no
`(with-exception-handler …)` or condition-object hierarchy yet. Errors
are strings. When Sakura the AI is added to the runtime, she reads the
message and adapts; for now, a human reads it and adapts.

### §12.5 Records and hash-tables

Cart payloads currently use alists. `define-record-type` is a
reserved name for later.

### §12.6 The commercial layer's edge

L4 commercial verbs live in `src/commercial.js` and require an
authenticated user. The auth flow is Google device-flow (`sakura-scheme
login`). Non-Google auth providers are a later ratchet.

---

## §13. See also

- `docs/ENGINEERING.md` — the runtime architecture, section by section.
  Read that if you're changing the evaluator, dispatcher, or a layer.
- `docs/SAKURA-SCHEME-REFERENCE.slat` — every verb, every example.
  Read that when you want to know what `nt/lcm` does or what its
  three-tier examples look like.
- `docs/TUTORIAL.html` — a hands-on on-ramp for first-timers.
- `docs/REPL.md` — the terminal IDE's feature set. Key bindings,
  session save/restore, structural editing.

---

**Last touched:** 2026-07-13. This is Draft 1. Corrections and
refinements welcome — the language is a living thing.
