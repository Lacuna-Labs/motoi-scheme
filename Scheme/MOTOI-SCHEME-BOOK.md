# The Sakura Scheme Book

*A small Scheme for humans and AI to program together.*

Sakura Scheme is a language. This book is how you learn it. Fifteen chapters, two appendices, one runnable example on every claim.

If you know Scheme already: skip to Chapter 9. That's the REPL, and the REPL is where this dialect earns its keep. If you're new to Scheme: start at Chapter 1, take your time, and don't worry about the parens — the REPL matches them for you.

---

## Chapter 1 — Hello

### What Sakura Scheme is

A small Scheme dialect, written in JavaScript, that runs anywhere Node runs. The engine is under two thousand lines. The language is R7RS-shaped where R7RS is sensible, and a few careful extensions where it isn't. It's meant to be programmed with — by you, by a friend, by an AI collaborator sitting in the same REPL as you.

### What it looks like

```scheme
(define (greet name)
  (string-append "hello, " name))

(greet "world")
;; => "hello, world"

(define fact
  (lambda (n)
    (if (= n 0)
        1
        (* n (fact (- n 1))))))

(fact 10)
;; => 3628800

(map (lambda (n) (* n n)) '(1 2 3 4 5))
;; => (1 4 9 16 25)
```

That's ten lines and there are no surprises. `define` binds a name. `lambda` makes a function. `if` picks a branch. `map` applies a function to a list. If you've seen any Scheme before, this is exactly what you'd expect.

### Install

Three ways in. Pick the one that matches your machine:

**macOS, via Homebrew tap:**

```sh
brew install lacuna-labs/tap/sakura-scheme
```

**Any Unix, via one-line installer:**

```sh
curl -fsSL sakura-scheme.lacunalabs.ai/install.sh | sh
```

**Anywhere Node runs, via npm:**

```sh
npm i -g sakura-scheme
```

All three drop `sakura-scheme` on your `$PATH`. Verify:

```sh
$ sakura-scheme --version
sakura-scheme 1.4.0
```

### First run

```sh
$ sakura-scheme repl
sakura-scheme 1.4.0  —  type ,help <verb> or ,exit
> (define pi 3.14159)
> (* 2 pi)
6.28318
> ,exit
bye
```

That's the whole story. You typed a define, the language remembered it, you multiplied by it, you left. Everything else in this book adds capability to that loop.

---

## Chapter 2 — The Language

### Grammar

A Sakura Scheme program is a sequence of forms. A form is an atom or a list. An atom is a number, a string, a boolean, or a symbol. A list is a sequence of forms wrapped in parentheses. That's the entire grammar.

```scheme
42          ; a number
"hi"        ; a string
#t          ; the boolean true
foo         ; a symbol
(+ 1 2)     ; a list: one symbol, two numbers
```

### Special forms

The core forms — the ones the evaluator recognizes by name rather than treating as a call — are:

**`define`** — bind a name at the top level.

```scheme
(define pi 3.14159)
(define (square x) (* x x))
```

**`let`** — bind names locally.

```scheme
(let ((x 3) (y 4))
  (sqrt (+ (* x x) (* y y))))
;; => 5
```

**`let*`** — bind names sequentially; earlier bindings visible to later ones.

```scheme
(let* ((x 3) (y (* x 2)))
  y)
;; => 6
```

**`letrec`** — mutually recursive local bindings.

```scheme
(letrec ((even? (lambda (n) (if (= n 0) #t (odd?  (- n 1)))))
         (odd?  (lambda (n) (if (= n 0) #f (even? (- n 1))))))
  (even? 10))
;; => #t
```

**`lambda`** — build a function.

```scheme
((lambda (x y) (+ x y)) 3 4)
;; => 7
```

**`cond`** — multiple-clause conditional.

```scheme
(define (sign n)
  (cond ((positive? n) 'positive)
        ((negative? n) 'negative)
        (else 'zero)))
```

**`case`** — dispatch on a value.

```scheme
(define (color-code c)
  (case c
    ((red)   1)
    ((green) 2)
    ((blue)  3)
    (else    0)))
```

**`when` / `unless`** — one-branch conditionals.

```scheme
(when (positive? x) (display "positive"))
(unless (zero? x) (display "not zero"))
```

**`and` / `or`** — short-circuit boolean combinators. Return the last truthy value, not always `#t`.

```scheme
(and 1 2 3)   ;; => 3
(or #f #f 5)  ;; => 5
```

**`begin`** — sequence of expressions, returning the last.

```scheme
(begin
  (display "hi ")
  (display "there")
  42)
;; => 42
```

**`quote` / `quasiquote`** — turn source into data.

```scheme
'(1 2 3)         ;; => (1 2 3)  (a list, not a call)
`(1 ,(+ 1 1) 3)  ;; => (1 2 3)  (unquote inside quasiquote)
```

### Reader syntax

The reader accepts:

- Numbers: `42`, `-3.14`, `1e5`
- Strings: `"hello\n"` — with `\n \t \r \\ \"` escapes
- Booleans: `#t`, `#f`
- Symbols: `foo`, `card/open`, `list?`, `set!`
- Keywords: `:name` — used for named arguments
- Comments: `;` to end of line
- Lists: `(a b c)`
- Quote shorthand: `'x` for `(quote x)`
- Quasiquote shorthand: `` `x `` for `(quasiquote x)`, `,x` for `(unquote x)`

### Comments

```scheme
; single-line comment
(define x 10)  ; trailing comment
```

There's no block-comment syntax. Long comments become several `;` lines. The convention is `;;` for module-level commentary and `;` for inline notes; the reader treats them identically.

### Keywords

`:name` is a keyword — a self-evaluating atom used mostly for named arguments to verbs:

```scheme
(card/open 'welcome :animate #t :duration 200)
```

### Records

Records are the language's way of naming a shape. See Chapter 5.

```scheme
(define-record point (x y))

(define p (make-point 3 4))
(point-x p)  ;; => 3
(point-y p)  ;; => 4
(point? p)   ;; => #t
```

---

## Chapter 3 — Base Library

The base library ships in every environment. About 80 primitives, all pure or tightly scoped. Every primitive has three tiered examples: **novice** (the shape you'd hand a beginner), **intermediate** (the shape you'd write in a small program), **expert** (the shape you'd write in a serious one).

Source: [`src/base.js`](../src/base.js). See it once; you'll understand the rest.

### Arithmetic

**`+`, `-`, `*`, `/`** — variadic; the usual arithmetic.

```scheme
;; novice
(+ 1 2)                   ;; => 3

;; intermediate
(+ 1 2 3 4 5)             ;; => 15

;; expert
(apply + (map square '(1 2 3 4)))   ;; sum of squares
```

**`modulo`, `remainder`, `quotient`** — integer division.

```scheme
(modulo 10 3)   ;; => 1
(quotient 10 3) ;; => 3
```

**`abs`, `min`, `max`, `expt`, `sqrt`, `floor`, `ceiling`, `round`, `truncate`** — the math you expect.

### Comparisons

**`=`, `<`, `>`, `<=`, `>=`** — variadic on numbers. `(< 1 2 3)` means `1 < 2 < 3`.

**`eq?`** — identity. **`eqv?`** — identity for atoms. **`equal?`** — structural equality.

```scheme
(eq? 'a 'a)             ;; => #t
(equal? '(1 2) '(1 2))  ;; => #t
```

### Predicates

`null?`, `pair?`, `list?`, `symbol?`, `string?`, `number?`, `boolean?`, `procedure?`. Ask about the type of a value.

### List operations

**`car`, `cdr`, `cons`** — the classical trio.

```scheme
(car '(1 2 3))  ;; => 1
(cdr '(1 2 3))  ;; => (2 3)
(cons 0 '(1 2)) ;; => (0 1 2)
```

**`list`, `length`, `reverse`, `append`** — build and combine lists.

```scheme
(list 1 2 3)         ;; => (1 2 3)
(length '(a b c))    ;; => 3
(reverse '(1 2 3))   ;; => (3 2 1)
(append '(1 2) '(3)) ;; => (1 2 3)
```

**`map`, `filter`, `for-each`, `fold-left`, `fold-right`** — the higher-order essentials.

```scheme
;; novice
(map square '(1 2 3))              ;; => (1 4 9)

;; intermediate
(filter positive? '(-1 2 -3 4))    ;; => (2 4)

;; expert
(fold-left (lambda (acc x) (+ acc (* x x))) 0 '(1 2 3 4))
;; => 30
```

### String operations

`string-length`, `string-append`, `substring`, `string-upcase`, `string-downcase`, `string->list`, `list->string`, `string->number`, `number->string`, `string-split`, `string-contains?`.

```scheme
(string-append "hello, " (string-upcase "world")) ;; => "hello, WORLD"
(string-split "a,b,c" ",")                        ;; => ("a" "b" "c")
```

### Hash tables

`make-hash-table`, `hash-set!`, `hash-ref`, `hash-has?`, `hash-keys`, `hash-values`, `hash->alist`.

```scheme
(define h (make-hash-table))
(hash-set! h 'name "Sakura")
(hash-ref h 'name)  ;; => "Sakura"
```

### JSON

`json->value`, `value->json`.

```scheme
(json->value "[1,2,3]")   ;; => (1 2 3)
(value->json '((a . 1)))  ;; => "{\"a\":1}"
```

### HTTP (async)

`fetch` — one call, returns a promise-shaped value. See Chapter 7.

```scheme
(await (fetch "https://api.example.com/hello"))
```

### File I/O

`read-file`, `write-file`, `file-exists?`, `list-dir`.

### Regex

`re-match`, `re-find-all`, `re-replace`.

### Time

`now`, `sleep`, `time-format`, `time-parse`.

### Testing

`assert`, `assert-equal`, `test-case`, `run-tests`. The base library carries its own runner.

```scheme
(test-case "arithmetic"
  (assert-equal (+ 2 2) 4))
```

---

## Chapter 4 — Macros

Macros are code that writes code. The reader turns your source into a tree, macros transform that tree, and the evaluator runs the transformed tree. All at the same layer — one syntax, one evaluator.

### `syntax-rules`

The hygienic pattern-matching macro system. Every Scheme has this shape.

```scheme
(define-syntax swap!
  (syntax-rules ()
    ((_ a b)
     (let ((tmp a))
       (set! a b)
       (set! b tmp)))))

(define x 1)
(define y 2)
(swap! x y)
x  ;; => 2
y  ;; => 1
```

### `define-macro`

The unhygienic, procedural form. Rarely what you want; occasionally exactly what you need.

```scheme
(define-macro (when-verbose expr)
  `(if verbose?
       (begin (display "running: ") (display ',expr) (newline) ,expr)
       ,expr))
```

### Teaching yourself with `,expand`

In the REPL, `,expand form` shows you what a macro turns into:

```
> ,expand (swap! x y)
(let ((tmp x)) (set! x y) (set! y tmp))
```

`,expand-1` shows one step. Chapter 9 walks the whole meta-command family.

### Common patterns

**Delay-and-force.** Use macros to defer evaluation:

```scheme
(define-syntax my-if
  (syntax-rules ()
    ((_ test consequent alternative)
     (cond (test consequent) (else alternative)))))
```

**Loops that read like sentences.**

```scheme
(define-syntax while
  (syntax-rules ()
    ((_ cond body ...)
     (let loop ()
       (when cond body ... (loop))))))

(while (< i 10) (display i) (set! i (+ i 1)))
```

**Domain sentences.** In Curator, `(when-mood-is 'happy body ...)` reads like a sentence because a macro made it. Sakura wrote several of these herself.

---

## Chapter 5 — Records and types

Records name a shape. A shape is a bundle of fields with a name you can pattern-match on.

### `define-record`

```scheme
(define-record point (x y))

(define p (make-point 3 4))
(point-x p)   ;; => 3
(point-y p)   ;; => 4
(point? p)    ;; => #t
```

The macro gives you a constructor (`make-<name>`), one accessor per field (`<name>-<field>`), and a predicate (`<name>?`). Records are stored as tagged JavaScript objects, so equality is field-by-field via `equal?`.

### `type-of`

Every value carries a runtime type tag.

```scheme
(type-of 42)          ;; => 'number
(type-of "hi")        ;; => 'string
(type-of '(1 2))      ;; => 'list
(type-of (make-point 1 2))  ;; => 'point
```

### `describe`

Pretty-print a value plus its type and fields.

```scheme
(describe (make-point 3 4))
;; point
;;   x: 3
;;   y: 4
```

### Contracts

A verb's `:contract` field is documentation *and* enforcement. The dispatcher checks it before the impl runs.

```scheme
(card/open 42)  ;; error: contract violation — expected symbol, got number
```

Every error carries source position, expected type, and got type. Chapter 7 walks the rich-error record.

---

## Chapter 6 — Pattern matching

`match` is destructuring's home. It reads a value against a set of patterns; the first match wins.

### The basics

```scheme
(define (describe-shape s)
  (match s
    ((list 'circle r)      (string-append "circle r=" (number->string r)))
    ((list 'square s)      (string-append "square s=" (number->string s)))
    ((list 'rect w h)      (string-append "rect " (number->string w) "x" (number->string h)))
    (_                     "unknown")))

(describe-shape '(circle 5))   ;; => "circle r=5"
(describe-shape '(rect 3 4))   ;; => "rect 3x4"
```

### Destructuring in `let` and `lambda`

```scheme
(let (((x y z) some-list))
  (+ x y z))

(lambda ((:name n :age a))
  (string-append n " is " (number->string a)))
```

### Keyword arguments with defaults

```scheme
(define (card/open :id (:animate #t) (:duration 200))
  ...)
```

`:id` is required. `:animate` defaults to `#t`. `:duration` defaults to `200`.

---

## Chapter 7 — Async, streams, errors

### `await`

Sakura Scheme is single-threaded but async-native. `await` yields to the event loop; the interpreter resumes when the awaited value settles.

```scheme
(define (fetch-title url)
  (let* ((resp (await (fetch url)))
         (body (await (response-body resp))))
    (re-match body "<title>([^<]+)</title>")))
```

### Streams

Lazy sequences. Infinite where you want them.

```scheme
(define (naturals-from n)
  (stream-cons n (naturals-from (+ n 1))))

(stream-take 5 (naturals-from 1))
;; => (1 2 3 4 5)
```

### Rich errors

Errors are values, not signals. Every error is a hash-table with structured fields:

```scheme
{:kind         'contract-violation
 :message      "card/open expected symbol, got number"
 :source-pos   {:file "user.scm" :line 12}
 :did-you-mean '(card/open card/close card/pin)
 :fix          "(card/open 'welcome)"
 :examples     '("(card/open 'welcome)"
                 "(card/open 'shop-main :animate #t)")}
```

Catch an error with `guard`:

```scheme
(guard (e ((eq? (:kind e) 'contract-violation)
           (display "you handed a wrong type")))
  (card/open 42))
```

Or ask Sakura to fix it:

```scheme
(sakura/fix e)  ;; returns a suggested corrected form
```

---

## Chapter 8 — Modules

A module bundles a set of definitions with an explicit export list.

```scheme
(module math-extras
  (export mean median stddev)

  (define (mean xs)
    (/ (apply + xs) (length xs)))

  (define (median xs) ...)

  (define (stddev xs) ...))
```

Import elsewhere:

```scheme
(import math-extras :as m)

(m/mean '(1 2 3 4))
;; => 5/2
```

Or without the alias:

```scheme
(import math-extras)

(mean '(1 2 3 4))
```

Modules are resolved by name — the loader looks under `./modules/`, the project's verb-layer directory, and the base library, in that order.

---

## Chapter 9 — REPL

*The wow layer.*

A REPL is the language's face. This one is meant to be as good as Julia's, IPython's, and Common Lisp's put together, because it has one advantage they don't: it can ask Sakura for help mid-session.

Start it:

```sh
$ sakura-scheme repl
sakura-scheme 1.4.0  —  type ,help <verb> or ,exit
>
```

### Tab-complete

Verbs, namespaces, keyword args, bound symbols, local variables. Fuzzy match, not just prefix.

```
> (car/o<TAB>
card/open        card/on-close    card/on-focus
```

### Inline signature help

As you type `(card/open `, the REPL shows a dim ghost row above the cursor with the arity, arg names, and doc summary. Same source as `,help`.

### Live docstring popup

Press `F1` on any symbol. Doc pops out below.

### Structural editing

Auto-close parens, splurge/slurp for reshaping expressions:

- `Ctrl-→` — slurp: pull the next form into the current one
- `Ctrl-←` — barf: push the last form out
- `Ctrl-Shift-K` — kill the current form
- `Ctrl-Shift-M` — select the current form

Nobody counts parens in 2026.

### Syntax highlighting

Forms, strings, keywords, comments — highlighted as you type. Same theme applies to pretty-printed output.

### Multi-line editing

`Shift-Enter` for a new line inside a form. `Enter` evaluates when balanced. `Ctrl-O` opens an editor buffer for anything bigger than a screen.

### Named results

- `_` — the last result
- `_1` — the previous one
- `_2` — the one before that

`,save foo` binds the last result to `foo` in the session.

### Rich display

Vectors and lists render as tables. Hash-tables as key-value grids. Numbers with a units suffix if they carry a `:unit` field. Images render inline (base64 SVG/PNG blobs); plots as ASCII first, SVG if the terminal supports it.

### Meta-commands

Every meta-command starts with a comma. The dispatch table is authoritative and lives in [`src/repl.js`](../src/repl.js).

**`,help <verb>`** — full help for a verb.

```
> ,help card/open
card/open  —  Opens the card identified by id.
Arity:      [1, 2]
Contract:   (symbol [options]) -> boolean
Namespace:  card
Tier:       operator (perm: state-change)
Since:      sakura-scheme@1.0
Source:     curator-verbs/card/open.js:42

Examples:
  novice          (card/open 'welcome)
  intermediate    (card/open 'shop-main :animate #t)
  expert          (let ((r (card/open 'lyric :on-close (lambda () ...)))) ...)
```

**`,type <verb>`** — the contract.

```
> ,type card/open
(symbol [options]) -> boolean
```

**`,doc <verb>`** — the docstring alone.

**`,arity <verb>`** — arity as scalar or `[min, max]`.

**`,examples <verb>`** — the tiered examples.

**`,source <verb>`** — where the impl lives.

**`,apropos <regex>`** — every symbol matching.

**`,namespace <ns>`** — every verb in a namespace.

**`,time <expr>`** — wall time + fuel used + peak memory.

**`,trace <fn>` / `,untrace <fn>`** — record every call.

**`,watch <expr>`** — re-evaluate on every prompt; show in status bar.

**`,inspect <val>`** — walk into a value with arrow keys.

**`,expand <form>` / `,expand-1 <form>`** — macroexpand.

**`,undo`** — pop the last evaluation.

**`,save <file>` / `,load <file>`** — dump/restore the session. Sessions are slat files.

**`,shell <command>`** — pipe into a shell command.

**`,ask sakura "how do I ..."`** — direct line to the persona. She reads your session's bindings, your last N evaluations, and the verb registry, then answers with runnable code the REPL can eval on `Enter`. This is the "AI is a peer in the REPL" feature nobody else has.

### Ctrl-R history

Fuzzy search across every evaluation, ever. Like every modern shell.

### Live reload

Save a `.scm` file; the REPL notices; re-runs its `define`s in a sandboxed env; asks before overwriting bindings. Opt-in per session.

### Notebook mode

```sh
$ sakura-scheme notebook foo.snb
```

A Jupyter-ish cell UI in the terminal (or in a browser tab with `--web`). Cells are slat records. The notebook itself is `.snb` — slat notebook.

---

## Chapter 10 — Bash CLI

Everything the REPL exposes is also available at the shell.

```
sakura-scheme --help
sakura-scheme 1.4.0 — the language

Usage: sakura-scheme <command> [options]

Commands:
  repl                     Interactive REPL. Loads current dir's verb layer if present.
  eval "<code>"            Evaluate one expression, print result.
  run <file.scm>           Run a program file to completion.
  help <verb>              Print help for a verb.
  docs                     Print MD reference to stdout, or --serve to launch local doc site.
  docs regen               Regenerate reference/ MD from live registry.
  version                  Print version + git sha of the interpreter.
  slat parse <file.slat>   Parse a .slat file; print as JSON.
  slat emit <file.jsonl>   Convert a JSONL log to slat.

Options:
  --verb-layer <path>      Load this verb layer instead of auto-detecting.
  --fuel <n>               Fuel budget (default 200000).
  --seed <n>               PRNG seed (default: process time).
  --no-color               Disable ANSI.
```

### Auto-detection of verb layer

`sakura-scheme` inside `~/code/curator/` loads Curator's verb layer via `curator-web/src/scheme/curator-verbs/index.js`. Inside `~/code/lacuna/` loads Lacuna's. Elsewhere loads only the base language.

Config file at the project root pins the choice:

```toml
# .sakura-scheme.toml
[verb-layer]
path = "./curator-web/src/scheme/curator-verbs"
version = "1.4.x"
```

### Common one-liners

```sh
sakura-scheme eval "(+ 1 2)"                     # 3
sakura-scheme eval "(map (lambda (n) (* n n)) '(1 2 3))"
sakura-scheme run script.scm
sakura-scheme help card/open
sakura-scheme docs regen                          # rebuild reference/ MD
sakura-scheme slat parse ~/.lacuna/events.slat
```

---

## Chapter 11 — Autogen

*Code that writes code.*

This is Sakura's home. The interpreter is a peer to her; every code-writing capability she has is exposed as a verb.

### `(help 'name)`

Returns a hash-table with docstring, examples, contract, source. Same as `,help` in the REPL. Sakura reads it, humans read it, IDEs read it. One source of truth.

```scheme
(help 'card/open)
;; => {:name "card/open"
;;     :doc "Opens the card identified by id."
;;     :contract "(symbol [options]) -> boolean"
;;     :arity (1 . 2)
;;     :examples (...)}
```

### `(new-verb ...)`

Scaffolds a verb: writes a stub file at `<consumer>/verbs/<ns>/<name>.js`, updates `.lacuna/triggers.yaml`, opens a REPL editor buffer with the stub loaded. Ships a doc regen with it.

```scheme
(new-verb 'shop/list-items
  :arity 1
  :doc "List items in a shop by shop-id."
  :contract "(symbol) -> list")
```

### `(new-cart ...)`

Scaffolds a `.sks` cart with the standard headers, opens for editing, indexes on save.

```scheme
(new-cart :topic 'welcome-user)
```

### `(regen-doc 'name)`

Writes the MD for one verb. Same call the trigger uses.

### `(sakura/complete '<partial-expr>)`

Sakura's model completes the expression. Returns a new form; the REPL shows a diff before evaluating.

```scheme
(sakura/complete '(map (lambda (x) ...) '(1 2 3)))
;; => (map (lambda (x) (* x x)) '(1 2 3))
```

### `(sakura/rewrite '<expr> :goal 'goal)`

Sakura suggests a rewrite. Goals: `'more-idiomatic`, `'faster`, `'shorter`, `'safer`, `'more-explicit`. She reads the corpus; she knows the style.

```scheme
(sakura/rewrite '(if (null? xs) '() (cons (f (car xs)) (map f (cdr xs))))
                :goal 'more-idiomatic)
;; => (map f xs)
```

### `(sakura/explain '<expr>)`

Sakura returns a natural-language explanation of what the expression does.

### `(sakura/fix '<error>)`

Pass an error record; Sakura returns a suggested fix. She has the source position, the message, the suggested `did-you-mean`, and the corpus of past fixes.

### `(propose-atom '<idea>)`

Sakura drafts a new atom (a word for reasoning ladders) and slots it into the world-knowledge tree. Author reviews before commit.

### `(macroexpand '<form>)`

The same expansion the interpreter does before evaluation. Available programmatically, not just via `,expand`.

### Reader-time customization

```scheme
#lang sakura-scheme
```

At the top of a file: opt-in reader extensions. Custom literals for units, dates, colors — anything you'd like to type once and read forever.

---

## Chapter 12 — Verb layers

The engine ships with a small base library. Everything else — every `card/*`, every `shop/*`, every `sys/*`, every `net/*` — is a **verb layer** on top.

### How a verb layer plugs in

A consumer registers verbs via `env.define` with a rich metadata blob:

```javascript
import { registerPrimitive } from 'sakura-scheme'

registerPrimitive({
  name: 'card/open',
  arity: [1, 2],
  contract: '(symbol [options]) -> boolean',
  doc: 'Opens the card identified by id.',
  examples: [
    { level: 'novice',       code: "(card/open 'welcome)" },
    { level: 'intermediate', code: "(card/open 'shop-main :animate #t)" },
    { level: 'expert',       code: "(let ((r (card/open 'lyric :on-close (lambda () ...)))) ...)" }
  ],
  atom: 'card.open',
  tier: 'operator',
  perm: 'state-change',
  namespace: 'card',
  since: 'sakura-scheme@1.0',
  source: 'curator-verbs/card/open.js:42',
  impl: (id, opts) => { ... }
})
```

The metadata is the single source of truth. REPL introspection reads it. The CLI reads it. The doc emitter reads it. Sakura reads it. Add a verb — every surface updates.

### Curator's verb layer

Curator ships ~500 verbs across `world/*`, `card/*`, `flower/*`, `shop/*`, `sprite/*`, `sound/*`, `motion/*`, and more. See [`~/code/curator/docs/CURATOR-VERBS.md`](../../curator/docs/CURATOR-VERBS.md) for the catalog.

### Lacuna's verb layer

Lacuna's verb layer covers infrastructure: `sys/*`, `net/*`, `docker/*`, `deploy/*`. Small at first, growing. See [`~/code/lacuna/docs/LACUNA-VERBS.md`](../../lacuna/docs/LACUNA-VERBS.md).

### Promotion

A verb that turns out dialect-neutral (both consumers want it, same signature, same semantics) can be **promoted** into the base library on a minor version bump. Same mechanism that made `filter` and `map` core, not Curator-specific. The promotion checklist lives in [`CONSUMERS.md`](../CONSUMERS.md).

---

## Chapter 13 — Slat

Slat is Sakura Scheme's serialization format: line-delimited S-expressions. One complete `(form ...)` per line. Newlines inside a form are illegal. That constraint is the point — every slat file is `tail`-able, `grep`-able, `diff`-able.

### The wire format

```slat
(event :ts 1751500000 :kind "card.opened" :id 'welcome)
(event :ts 1751500001 :kind "flower.blushed" :level 0.42)
(event :ts 1751500002 :kind "shop.searched" :query "candles")
```

Every line is one form. Keywords fold into a dict. The head symbol becomes the form's `_form` key.

### Programmatic

From Scheme:

```scheme
(define e (slat-loads "(event :ts 42 :kind \"noticed\")"))
(hash-ref e 'ts)     ;; => 42
(hash-ref e 'kind)   ;; => "noticed"

(slat-dumps '((_form . event) (ts . 42) (kind . "noticed")))
;; => "(event :ts 42 :kind \"noticed\")"
```

From JavaScript:

```javascript
import { slatLoads, slatDumps } from 'sakura-scheme'

const e = slatLoads('(event :ts 42 :kind "noticed")')
const back = slatDumps(e)
```

From Python:

```python
from slat import loads, dumps

e = loads('(event :ts 42 :kind "noticed")')
back = dumps(e)
```

The two bindings round-trip identically. Fixture vectors live at [`tests/vectors.slat`](../tests/vectors.slat) and are exercised by both bindings in CI.

### Full spec

See [`docs/slat/SPEC.md`](./slat/SPEC.md), [`docs/slat/GRAMMAR.md`](./slat/GRAMMAR.md), [`docs/slat/EXAMPLES.md`](./slat/EXAMPLES.md).

---

## Appendix A — Solved Scheme pain points

The complaints have been the same for forty years. Here's the shortlist and how we address each.

- **Parens are hard to read.** — Rainbow paren coloring, auto-close, structural editing (`Ctrl-→` slurp, `Ctrl-←` barf, `Ctrl-Shift-K` kill, `Ctrl-Shift-M` mark). Nobody counts parens in 2026.
- **No IDE support.** — LSP shipping in v1.0 (`sakura-scheme lsp`). Plugins for VS Code, Cursor, Vim, Emacs. Format-on-save, hover-for-help, go-to-definition, find-references, live diagnostics.
- **Small stdlib.** — Batteries included. Strings, lists, hashes, JSON, HTTP, file I/O, regex, time, date, path, url, math, stats, testing, logging, event emitter, environment. Every one has a doc page.
- **Fragmented ecosystem.** — There is one Sakura Scheme. R7RS subset for the core; extensions marked as ours.
- **Macros make debugging hard.** — `,expand` and `,expand-1` show what a macro turned into. Source-map through macro expansion, so errors point at the original source, not the expanded form.
- **No modules.** — Modules from day one (Chapter 8).
- **Terrible error messages.** — Rich error records (Chapter 7). Every error carries `:kind`, `:message`, `:source-pos`, `:did-you-mean`, `:fix`, `:examples`. And `sakura/fix` for the hard cases.
- **Slow.** — V8-fast interpreter with tail-call optimization. Not the fastest Scheme ever, but fast enough that it isn't a reason to choose against.
- **Hard to install.** — One-line installers for Mac and Linux. See Chapter 1.

---

## Appendix B — The next Python

Python didn't win because it was the best language. It won because it was immediately usable, generously documented, and friendly. Here's the checklist.

- **Hello in one line.** `sakura-scheme -e '(display "hi")'` prints `hi`. `sakura-scheme repl` → `(display "hi")` → `hi`.
- **Batteries included.** See Chapter 3.
- **Docs that explain, not just describe.** Every verb has three tiered examples, a source link, and a run-in-browser button on the doc site.
- **REPL that isn't hostile.** Inline help, tab-complete, error messages that suggest fixes.
- **Community-friendly.** [CONTRIBUTING](../CONTRIBUTING.md), MIT license, [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md), RFC process for changes.
- **Ecosystem.** Package system for verb layers (`sakura-scheme install lacuna/net-tools`), auto-managed via the same trigger system that regenerates docs.
- **AI is a peer.** Every REPL, every editor, every session has `(sakura/…)` verbs available. Not retrofitted; built in.

That is what "the next Python" means for us. Not the language people are told to learn — the language they find themselves reaching for because it treats them, and their AI collaborators, like adults.
