# The Book of Jesse

*An onboarding to Sakura Scheme for people who already ship in Fennel, TIC-80, Clojure, and Lua.*

---

## Dedication

Jesse,

Alfred knows you use Clojure. Alfred knows you use Lua. Alfred knows you use Fennel. Alfred knows you use TIC-80. And he wanted to make sure that you were covered. So here's a book that teaches you how to use this, as a gift to you.

The idea isn't to sell you on something. You already know how to program in a Lisp. You already know how to draw a circle on a framebuffer without a stack trace. You've written closures that captured a `dt`, you've fought with Lua's `nil`-as-truthy, you've reached for `->` in Fennel because it made the pipeline read left-to-right instead of like a Russian nesting doll. What follows is a translation manual, not a sales pitch. Where Sakura Scheme does something the same as what you already do, we'll say so and move on. Where it does something different, we'll show you the shape, and try to earn the difference.

The whole language is small enough that a careful reader can hold it in their head. The reference is the language — every verb is documented in a single file that the REPL, the docs site, the LLM tool-call schemas, and this book all read from. So when you finish this book and start writing your own things, you'll be reading the same source we did.

Somebody gave a shit about this. That's the whole standard. If you find it useful, wonderful. If you find deep bugs, we'll hunt them with you.

— The maintainers, Brooklyn, 2026

---

## Chapter 1 — Install

There are two flavors: a global npm install, and a clone-and-run. Both give you the same REPL.

### The one-line install

```
curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
```

This drops a `scheme-lang` command onto your PATH. It requires Node 18+ and `git` — that's everything. It doesn't touch `/usr/local`; it puts a small tree under `~/.scheme-lang` and adds one shim. To undo, `rm -rf ~/.scheme-lang $(command -v scheme-lang)`.

If you're an npm person and you prefer that:

```
npm i -g sakura-scheme
```

Same binary, different install route. The npm package is a thin shim around the same source tree.

### Clone-and-link

```
git clone https://github.com/Lacuna-Labs/scheme-lang
cd scheme-lang
./bin/scheme-lang
```

This is how you'll want to run it if you're going to read the source (which, if you're the kind of programmer who reads Fennel's compiler for fun, you'll want to). No build step. It's Node all the way down, no bundler, no transpile — the source you read is the source that runs.

### First REPL

Type `scheme-lang` (or `./bin/scheme-lang` from the clone), and:

```
sakura>
```

That's the prompt. Try:

```scheme
sakura> (+ 1 2)
3

sakura> (define (square x) (* x x))
sakura> (square 12)
144

sakura> (map square '(1 2 3 4 5))
(1 4 9 16 25)
```

The reader is R7RS-flavored Scheme. Everything you'd expect from a Lisp-family language works: `let`, `let*`, `letrec`, `lambda`, `cond`, `case`, `when`, `unless`, `quote`, `quasiquote`, `unquote`, `unquote-splicing`, `syntax-rules`, `define-syntax`. Tail calls trampoline properly, so deep recursion doesn't blow the stack — `(fact 1000000)` works.

Now try:

```scheme
sakura> (circle 40 40 15)
```

The REPL draws a circle in Braille characters (or as an inline PNG if your terminal supports iTerm2 / kitty / WezTerm / Sixel). Try `(disc 40 40 15)` — that one's filled.

That's your first "hello, framebuffer." When you're ready to leave: `,exit` or Ctrl-D. The REPL will say `goodnight ✿`.

---

## Chapter 2 — What Sakura Scheme is

Sakura Scheme is a small Scheme with a framebuffer. It runs in Node. It has five layers that stack, portable adapters at the bottom of each, and a reference manual with 1,157 verbs that acts as the source of truth for everything downstream — REPL help, IDE hover, LLM tool-call schemas, and this book.

A few framings that might land:

**R7RS-subset base.** Not full R7RS. The forms that are actually useful for everyday programming — `define`, `lambda`, `let` / `let*` / `letrec`, `cond`, `case`, `if`, `when` / `unless`, `quote`, `quasiquote` / `unquote` / `unquote-splicing`, `begin`, `set!`, `do`. Hygienic macros via `syntax-rules`; classic macros via `define-macro`. First-class functions and closures. Proper tail calls. If you know Chibi or Chicken, you'll be at home; the deltas are almost all in the *verb library*, not the *core language*.

**Framebuffer as a first-class value.** Shapes like `circle` and `disc` are tagged lists, not side-effecting calls. `(circle 40 40 15)` returns the list `(circle 40 40 15)`. The REPL's rich-display layer sees that shape and rasters it to Braille or PNG. That means you can `map` a lambda that produces circles across a list, get a list of shapes back, and the REPL renders the whole list as one image. Composition falls out of the semantics — no explicit "batch" API.

**Adapter interface.** The base ships no-op stubs for graphics, audio, network, storage. A *dialect* — a fork of the repo, or a package that calls `setAdapters(...)` — plugs real implementations in. Sakura the persona ships one such dialect (with shop, cart, animation, and persona verbs); you can ship yours. The launcher discovers installed dialects and runs the one you asked for.

**Verb registry.** Every primitive and every custom verb carries metadata: arity, contract, docstring, three tiered examples, source location, permission tier. One source powers `,help` in the REPL, hover-help in a future LSP, generated docs, and the tool-call schemas an LLM reads to compose a call. Add a verb; everything downstream picks it up.

**SLAT — S-expression composition format.** `.slat` files parse with the same reader as `.scm`. Config, records, notebooks, session dumps, training corpora — all sit in one uniform sexp format. Comment-tolerant, round-trip safe, streamable line-by-line. One shape for code and data. If you've ever grumbled that YAML and JSON are two different formats for the same thing, SLAT is the peace treaty: it's parens, it's what you already write, it's what your program already reads.

**Namespaced verbs.** `namespace/action` naming: `shop/list-items`, `cart/run`, `net/fetch`, `audio/play`. Dispatch is a single chokepoint in `src/dispatch.js` — you can inspect it, log through it, permission-gate on it. Fuel budget too: every evaluation carries a fuel counter, so runaway computations halt cleanly with a real error rather than a hung process.

### The 30-second version, for the impatient

- It's a Scheme. Small enough to hold in your head.
- The REPL is the primary interface. There is no IDE. Your editor sits next to it.
- Shapes are data; the REPL renders them.
- Verbs are namespaced and metadata-rich.
- Config, records, sessions, docs — all SLAT.
- Every product on top of the language is a fork. Yours can be too.

Now — the layers.

---

## Chapter 3 — The Five Layers

The runtime is layered. Each layer builds on the ones below. You load only what you need. The default binary loads L0 + L1 (core + media). Higher layers are opt-in.

### Layer 0 — Core

The Scheme itself. Reader, interpreter, macros, base primitives, verb registry, dispatcher.

**What's in it:**

- The special forms: `define`, `lambda`, `let`, `let*`, `letrec`, `cond`, `case`, `if`, `when`, `unless`, `quote`, `quasiquote`, `unquote`, `unquote-splicing`, `begin`, `set!`, `do`, `and`, `or`, `define-syntax`, `syntax-rules`.
- Arithmetic + math: `+`, `-`, `*`, `/`, `modulo`, `remainder`, `quotient`, `expt`, `sqrt`, `sin`, `cos`, `tan`, `atan2`, `floor`, `ceiling`, `round`, `abs`, `min`, `max`, `deg->rad`, `rad->deg`.
- Predicates: `zero?`, `positive?`, `negative?`, `even?`, `odd?`, `null?`, `pair?`, `list?`, `number?`, `string?`, `symbol?`, `procedure?`, `boolean?`, `eq?`, `eqv?`, `equal?`.
- Lists: `car`, `cdr`, `cons`, `list`, `length`, `reverse`, `append`, `map`, `filter`, `fold` / `fold-left` / `fold-right`, `reduce`, `for-each`, `any`, `every`, `count`, `apply`, `zip`, `take`, `drop`, `first`, `last`, `nth`, `list-ref`, `list-tail`, `member`, `assoc`, `sort`.
- Strings: `string-append`, `string-length`, `substring`, `string-ref`, `string-split`, `string-join`, `string->list`, `list->string`, `string->number`, `number->string`, `string->symbol`, `symbol->string`, `title-case`, `camel-case`, `pascal-case`.
- Hash tables (they are dicts): `make-hash`, `hash-set!`, `hash-ref`, `hash-has-key?`, `hash-delete!`, `hash-keys`, `hash-values`, `hash-entries`, `hash-map`.
- Vectors, characters, byte helpers, hex encoding.
- Financial helpers: `margin`, `markup`, `markdown`, `pct`, `pct-change`, `cagr`, `sma`.
- Shape verbs: `circle`, `disc`, `line`, `rect` — return tagged lists the display layer renders.

Roughly 322 verbs. This is your Scheme prelude. Loaded always.

### Layer 1 — Media

Framebuffer, audio, input, timing, animation primitives. Loaded by default in the base binary.

**What's in it:**

- **`surface`** — paint pixels, text, dots, lines, gradients.
- **`audio`** — `audio/listen`, `audio/play`, `audio/halt`, `audio/spectrum` (32-band FFT), `audio/onset?`, `audio/onset-strength`, `audio/lufs`, `audio/tempo`, `audio/key`, `audio/bar-clock`, `audio/master-volume`, `audio/playing?`.
- **`input`** — `input/buttons`, `input/down?`, `input/pressed?`, `input/set!` — the six-button model (up, down, left, right, A, B).
- **`synth`** — nine synthesis verbs; play tones, envelopes, waveforms.
- **`radio`** — 14 verbs for streaming/tuner-shape playback.
- **`tick`** — `tick/pulse` and eight others for frame-driven cadence.
- **`part`** — 19 verbs for character animation (`part/wave`, `part/reach`, `part/look-toward`).
- **`entity`** — 41 verbs for world entities (position, velocity, collision, teams).
- **`sprite`**, **`animation`**, **`scene`**, **`cine`** — sprite work, keyframes, scene machinery.

If you're coming from TIC-80, this is your fantasy-console layer. See Chapter 6.

### Layer 2 — AI

Cortex (memory), LLM primitives, decision, planning.

**What's in it:**

- **`cortex/remember`**, **`cortex/recall`** — persistent, per-user memory (see Chapter 11).
- **`ask/reasoner`** — call a remote reasoning service.
- **`ai/*`** — 37 steering / boids / behavior-tree verbs (`ai/seek`, `ai/pursue`, `ai/flock`, `ai/bt-tick`, `ai/policy`, `ai/decide`, `ai/utility`).
- **`afford/deep-think`**, **`think/deep`** — meta-verbs for expensive reasoning cycles.
- **`audio/transcribe-with-cloud-help`** — speech-to-text via cloud.

Optional. Load `--layer ai` at the command line, or list it in your config.

### Layer 3 — Game

Nim, Sprague-Grundy theory, surreal numbers, game-tree traversal, combinatorial game analysis.

**What's in it:**

- **`game/nim-sum`**, **`game/nim-outcome`**, **`game/grundy`**, **`game/mex`**, **`game/star-n`** — Sprague-Grundy machinery.
- **`game/surreal`**, **`game/surreal-add`**, **`game/surreal-eq?`**, **`game/surreal-le?`**, **`game/surreal-birthday`** — Conway's surreal number arithmetic, as literal objects.
- **`game/frame`**, **`game/step`**, **`game/state`**, **`game/stop`**, **`game/running?`** — game-loop scaffolding.

Optional. This is a scholarly layer — not the fantasy-console you'd reach for to build Pong. That's Layer 1.

### Layer 4 — Commercial

Shop, cart, transaction, auth.

**What's in it:**

- **`shoppe/open`**, **`shoppe/close`**, **`shoppe/balance`**, **`shoppe/buy-pack`**, **`shoppe/buy-merch`**, **`shoppe/savings`**, **`shoppe/transactions`**.
- **`card/*`** — cart machinery (10 verbs) for wrapping shop actions.
- **`shop/*`** — dialect-provided shop verbs; require auth.

Gated. `sakura login` first (see Chapter 12). Not something you turn on by accident.

### How you turn a layer on

`~/.scheme-lang/config.slat`:

```
(config
  :layers '(core media ai))
```

Or at the command line:

```
scheme-lang --layers core,media,game
```

If a verb belongs to a layer you didn't load, calling it raises a `:kind not-loaded` error with a `:hint "load layer ai"` field. No mystery silence.

---

## Chapter 4 — Fennel / TIC-80 / Clojure / Lua Translations

This is the biggest chapter, because it's the biggest lift. Your intuitions transfer well; the syntax lands mostly where you'd guess. But the specifics matter.

### 4.1 — Bindings

**Fennel:**

```fennel
(let [x 3
      y (* x x)]
  (+ x y))
```

**Sakura Scheme:**

```scheme
(let ((x 3)
      (y (* 3 3)))
  (+ x y))
```

Two differences worth noting.

One: Sakura Scheme's `let` binds *in parallel* — every RHS is evaluated in the *outer* environment. Fennel's `let` is sequential, like Scheme's `let*`. So Fennel's `y` sees the new `x`; Sakura Scheme's `y` does not. If you want Fennel's shape, use `let*`:

```scheme
(let* ((x 3)
       (y (* x x)))
  (+ x y))     ;; ⇒ 12
```

Two: bindings are wrapped in an extra pair of parens. `(let ((x 3) (y 4)) ...)`. The outer pair holds the binding list; each inner pair is one binding. That's real Scheme, not a typo.

**Lua:**

```lua
local x = 3
local y = x * x
return x + y
```

**Sakura Scheme:**

```scheme
(let* ((x 3)
       (y (* x x)))
  (+ x y))
```

Same shape as translating from Fennel; `let*` for the sequential feel.

**Clojure:**

```clojure
(let [x 3
      y (* x x)]
  (+ x y))
```

Clojure's `let` is sequential — same as `let*`. Same translation.

### 4.2 — Destructuring

Clojure and Fennel both let you destructure inside `let`. Scheme's classic `let` does not. Sakura Scheme has two paths.

**The direct path — pattern-match with `let-values` or explicit accessors:**

```clojure
;; Clojure
(let [{:keys [x y]} pos]
  (+ x y))
```

```scheme
;; Sakura Scheme — hash-tables
(let ((x (hash-ref pos 'x))
      (y (hash-ref pos 'y)))
  (+ x y))
```

For pairs and lists:

```fennel
;; Fennel
(let [[a b c] xs]
  (+ a b c))
```

```scheme
;; Sakura Scheme
(let ((a (first  xs))
      (b (second xs))
      (c (third  xs)))
  (+ a b c))
```

Or, more idiomatically:

```scheme
(let ((a (car xs))
      (b (cadr xs))
      (c (caddr xs)))
  (+ a b c))
```

`car` / `cadr` / `caddr` are the classical Scheme accessors: head, second, third. They compose from `c` + `a`/`d` + `r` — `cadr` is *car of cdr*, `caddr` is *car of cdr of cdr*.

**The syntactic-sugar path — write a macro:**

If you want Fennel-shape destructuring badly enough, `syntax-rules` will get you there. A minimal one:

```scheme
(define-syntax let-list
  (syntax-rules ()
    ((_ ((name ...) expr) body ...)
     (let ((tmp expr))
       (let ((name (list-ref tmp _pos)) ...) body ...)))))
```

The above sketch is illustrative — a fully general destructurer wants recursion through nested patterns, and the standard `syntax-rules` restriction to pattern-matching-only makes it harder than a full macro system would. Most Sakura code doesn't need it: verbs return hash-tables you `hash-ref` into, or short lists you `car`/`cadr` into. If you find yourself reaching for destructuring often, a macro is one file to write.

### 4.3 — Threading macros

Fennel's `->` and `->>`:

```fennel
(-> xs (map inc) (filter even?) (reduce + 0))
```

Sakura Scheme has both, spelled the same way. Because `->` is a common identifier used elsewhere in the Scheme world (arrow constructors, coercions like `list->vector`), we ship them as macros you enable in your file with `(import (sakura threading))`. Then:

```scheme
(import (sakura threading))
(-> xs (map inc _) (filter even? _) (reduce + 0 _))
```

Note the `_` — the "hole" that says where the threaded value goes. That's the *anaphoric* threading style (Clojure calls it `as->` when explicit); we default to explicit-hole because it's unambiguous under Scheme's argument-order rules. If you want Clojure's implicit-first-argument threading, use `->>` and the value threads into the *last* position:

```scheme
(->> xs (map inc) (filter even?) (reduce + 0))
```

That reads the same as Fennel's `->>`. Under the hood it expands to:

```scheme
(reduce + 0 (filter even? (map inc xs)))
```

If you prefer the anaphoric mark (Clojure's `as->`), that's:

```scheme
(as-> xs $ (map inc $) (filter even? $) (reduce + 0 $))
```

Same expansion, explicit binding name.

### 4.4 — Multi-methods and dispatch

Clojure's `defmulti` / `defmethod`:

```clojure
(defmulti area :shape)
(defmethod area :circle [{:keys [r]}] (* Math/PI r r))
(defmethod area :square [{:keys [side]}] (* side side))
```

Sakura Scheme does not ship `defmulti` in the core. Two paths.

**Path one — `case` on a discriminator key.** For simple dispatch (three or four shapes, no third-party extension needed), this is idiomatic:

```scheme
(define (area shape)
  (case (hash-ref shape 'shape)
    ((circle) (* 3.14159265 (expt (hash-ref shape 'r) 2)))
    ((square) (expt (hash-ref shape 'side) 2))
    (else (error "unknown shape" shape))))
```

**Path two — a dispatch table.** For extensible dispatch (methods added at load time, defmulti-shape), build a hash-table of `discriminator → fn`:

```scheme
(define *area-methods* (make-hash))

(define (register-area! kind fn)
  (hash-set! *area-methods* kind fn))

(define (area shape)
  (let ((fn (hash-ref *area-methods* (hash-ref shape 'shape))))
    (if fn
        (fn shape)
        (error "unknown shape" shape))))

(register-area! 'circle
  (lambda (s) (* 3.14159265 (expt (hash-ref s 'r) 2))))

(register-area! 'square
  (lambda (s) (expt (hash-ref s 'side) 2)))
```

That's `defmulti` / `defmethod` on ten lines of core Scheme. If you build up a house style around it, wrap it in a macro:

```scheme
(define-syntax defmulti
  (syntax-rules ()
    ((_ name dispatch-fn)
     (begin
       (define name-methods (make-hash))
       (define (name arg)
         (let ((fn (hash-ref name-methods (dispatch-fn arg))))
           (if fn (fn arg) (error "no method for" (dispatch-fn arg)))))))))

(define-syntax defmethod
  (syntax-rules ()
    ((_ name key fn)
     (hash-set! name-methods key fn))))
```

That's the full-generality thing. Ship it as a library once, use forever.

The verb registry itself (see Chapter 9) is a form of multimethod: every verb dispatches on its head symbol, resolves through the registry, and executes the bound function. So the language *is* a big defmulti — you're just usually calling into it, not extending it.

### 4.5 — Lua tables ↔ Sakura hash-tables

Lua tables serve two purposes: array-shape (`t[1], t[2], ...`) and dict-shape (`t.name, t.age`). In Sakura Scheme those are two data structures — `list` (or `vector`) for the array-shape and `hash-table` for the dict.

**Lua array:**

```lua
local xs = {10, 20, 30}
print(xs[2])       -- 20
table.insert(xs, 40)
```

**Sakura Scheme:**

```scheme
(define xs (list 10 20 30))
(list-ref xs 1)          ;; ⇒ 20  (zero-indexed)
(append xs '(40))        ;; ⇒ (10 20 30 40)  — pure
```

Note: Sakura's lists are zero-indexed. Lua's are one-indexed. This trips people up on their first day.

**Lua dict:**

```lua
local person = {name = "Alfred", age = 32}
print(person.name)
person.email = "alfred@example.com"
```

**Sakura Scheme:**

```scheme
(define person (make-hash))
(hash-set! person 'name "Alfred")
(hash-set! person 'age 32)
(hash-ref person 'name)                            ;; ⇒ "Alfred"
(hash-set! person 'email "alfred@example.com")
```

Symbols like `'name` are the idiomatic key; strings work too. If you want a literal-shape constructor:

```scheme
(define person (list->hash '((name "Alfred") (age 32))))
```

### 4.6 — TIC-80's cls / circ / spr ↔ Sakura's clear / circle / sprite

TIC-80:

```lua
function TIC()
  cls(0)
  circ(120, 68, 20, 5)
  spr(1, 100, 60)
end
```

Sakura Scheme (fantasy-console shape, Chapter 6):

```scheme
(set-mode 240 136)                       ;; TIC-80's screen size

(define (frame)
  (clear 0)                              ;; cls(0)
  (paint (circle 120 68 20) 5)
  (paint-sprite 1 100 60))               ;; spr(1, 100, 60)

(on-frame frame)                         ;; register the frame handler
```

Where `paint-sprite` is another one-line convenience:

```scheme
(define (paint-sprite n x y)
  (surface-paint-dots (surf) 'base
    (sprite/rasterize (sprite/address n 0) x y) 15))
```

TIC-80's global `TIC()` becomes a lambda passed to `on-frame`. The `cls` / `circ` / `spr` verbs each become one convenience wrapper — `clear`, `paint`, `paint-sprite` — over the underlying `surface-paint-dots` / `sprite/rasterize` machinery.

The color model differs: TIC-80 hard-codes a 16-color palette; Sakura Scheme carries a palette per session, defaults to a 16-color set drawn from a curated theme, and lets you swap palettes via a config field (`theme:` in `config.slat`).

### 4.7 — Closures

The classic counter closure works exactly the same.

**Fennel:**

```fennel
(fn make-counter []
  (var n 0)
  (fn [] (set n (+ n 1)) n))
```

**Sakura Scheme:**

```scheme
(define (make-counter)
  (let ((n 0))
    (lambda ()
      (set! n (+ n 1))
      n)))

(define c (make-counter))
(c)  ;; ⇒ 1
(c)  ;; ⇒ 2
(c)  ;; ⇒ 3
```

The lambda captures `n` from its enclosing environment. `set!` mutates the captured binding. Same as every Scheme, same as every Lisp, same as every functional-flavored Lua.

Tail calls do get optimized. So:

```scheme
(define (loop n)
  (if (= n 0)
      'done
      (loop (- n 1))))

(loop 1000000)  ;; ⇒ done
```

works. The trampoline in `src/interp.js` unwinds tail positions without growing the JS call stack.

### 4.8 — Anonymous functions

Fennel `(fn [x] (+ x 1))` is Sakura `(lambda (x) (+ x 1))`. Same shape.

Clojure `#(+ % 1)` is Sakura `(lambda (x) (+ x 1))`. There's no built-in `#(...)` reader macro in the base; if you want one, `define-syntax` will get you a decent approximation but the general case (multi-argument `%1`, `%2`, `%3`) is more work than it's worth. Most Sakura code just writes `lambda`.

### 4.9 — Recursion, not iteration

Fennel and Lua both give you `for`/`while`. Sakura Scheme has `do`, but idiomatic code uses tail-recursion.

**Lua:**

```lua
local sum = 0
for i = 1, 10 do sum = sum + i end
return sum
```

**Sakura Scheme:**

```scheme
(define (sum-to n)
  (let loop ((i 1) (acc 0))
    (if (> i n)
        acc
        (loop (+ i 1) (+ acc i)))))

(sum-to 10)  ;; ⇒ 55
```

The `let loop` shape is Scheme's named-let. It defines `loop` as a local recursive function and calls it once with the initial arguments — a `for` loop wearing a Lisp costume. If you like it as much as I do, you'll see it everywhere.

If you want `for`-shape:

```scheme
(do ((i 1 (+ i 1))
     (acc 0 (+ acc i)))
    ((> i 10) acc))
```

But the named-let reads better. That's why Scheme code uses it.

### 4.10 — Sequences

`map`, `filter`, `reduce` — all present, all first-class. `reduce` is `fold-left` in Scheme parlance; both names are bound. `for-each` is the side-effecting variant that returns nothing (you write `for-each` when you want a side effect and don't care about the collection).

**Clojure:**

```clojure
(->> data
     (filter :active)
     (map :score)
     (reduce +))
```

**Sakura Scheme:**

```scheme
(->> data
     (filter (lambda (x) (hash-ref x 'active)))
     (map    (lambda (x) (hash-ref x 'score)))
     (fold + 0))
```

`fold` takes the reducer and an initial value up front. `reduce` is bound too; it takes just the reducer and the list, using the head as the initial value:

```scheme
(reduce + '(1 2 3 4 5))  ;; ⇒ 15
```

### 4.11 — Quick reference table

| You know (Fennel/Clojure/Lua/TIC-80) | Sakura Scheme |
|---|---|
| `(fn [x] ...)` | `(lambda (x) ...)` |
| `(let [x 1 y 2] ...)` | `(let* ((x 1) (y 2)) ...)` |
| `(->  x f g h)` | `(-> x (f _) (g _) (h _))` or `(->> x f g h)` |
| `(defmulti name f)` | dispatch table + registrar (§4.4) |
| `{:name "x"}` (map) | `(list->hash '((name "x")))` |
| `[1 2 3]` (vector) | `(list 1 2 3)` or `(vector 1 2 3)` |
| `nil` | `#f` (for false), `'()` (for empty list), `(void)` (for unit) |
| `for i = 1, 10 do ... end` | `(let loop ((i 1)) (when (<= i 10) ... (loop (+ i 1))))` |
| `cls(0)` | `(clear 0)` |
| `circ(x, y, r, c)` | `(paint (circle x y r) c)` |
| `spr(n, x, y)` | `(paint-sprite n x y)` — convenience over `sprite/rasterize` |
| `btn(0)` | `(input/down? 'up)` |
| `btnp(0)` | `(input/pressed? 'up)` |
| `sfx(n)` | `(audio/play 'sound-n)` |
| `music(n)` | `(audio/play 'music-n :loop #t)` |
| `time()` | `(system/now)` |
| `t = t + 1` global counter | `(game/frame world-id)` or state-passing (§4.9) |

None of this is memorization homework. `,help <name>` or `,examples <name>` in the REPL gets you the up-to-date shape whenever you forget. Chapter 8 is your REPL exploration guide.

---

## Chapter 5 — Fantasy Console Mode

If you spend afternoons in TIC-80, this chapter is where Sakura Scheme starts feeling like home. The framebuffer, input, and audio primitives compose the same way `cls`/`circ`/`spr`/`btn`/`sfx` do — same shape, small differences in spelling.

Before we dive in, a note on the API surface. The Sakura Scheme runtime exposes a low-level surface API — `surface-paint-dots`, `surface-paint-text`, `clear-surface-layer`, and friends — that takes a surface handle, a layer name, and a dot-list. That's the real underlying machinery, and if you want to know the exact shapes you'd look them up in the reference (`,help surface-paint-dots`). But most game code doesn't reach that deep. It goes through a small convenience layer we'll build here — a handful of one-line wrappers over the real verbs. This is exactly the same pattern TIC-80 uses: `circ()` is a wrapper around lower-level pixel operations, and you never think about that.

So we'll start by defining `clear`, `paint`, and `text` in a few lines. Everything else in the chapter uses those. If you'd rather skip the wrapper and write the underlying verb directly, `,help surface-paint-dots` will get you there.

```scheme
;; the convenience layer — save as ~/scheme/fc.scm and (,load) it
(define (surf) (system/surface))
(define (clear color)
  (clear-surface-layer (surf) 'base)
  (paint-cell (surf) 'base 0 0 color))
(define (paint shape color)
  ;; shape is a tagged list like (circle cx cy r) or (disc cx cy r)
  ;; expand to dots and hand to surface-paint-dots
  (surface-paint-dots (surf) 'base (shape->dots shape) color))
(define (text x y str color)
  (surface-paint-text (surf) str x y 'default 8 color))
```

`shape->dots` is a small helper that turns a `(circle cx cy r)` into a dot-list — the reference has it as `shape/rasterize` in some dialects, and any dialect that ships fantasy-console mode will provide its own. If your dialect ships one, use it; if not, write the ten-line one you need.

That's the pattern. Now onward.

### The screen

```scheme
(set-mode 240 136)
```

That's TIC-80's default resolution. Sakura Scheme's default is the same. You can go bigger:

```scheme
(set-mode 320 200)  ;; classic DOS
(set-mode 480 270)  ;; 16:9-ish
```

The framebuffer is one surface; you draw into it every frame, and the display layer flushes it.

### The frame loop

Sakura Scheme doesn't have a magic `TIC()` global. Instead you register a frame handler with `on-frame`:

```scheme
(define t 0)

(define (frame)
  (clear 0)                                ;; TIC-80: cls(0)
  (paint (circle 120 68 (+ 10 (* 5 (sin (/ t 20))))) 5)
  (set! t (+ t 1)))

(on-frame frame)
```

`on-frame` registers `frame` to run each display tick. The display driver drives the pump. When you type `,exit`, the pump stops.

If you'd rather do this without a global mutable `t`, thread it through state — which is idiomatic Scheme, and the shape the world/entity verbs are built around. `on-tick` is the state-threading variant (it takes a `(state) -> state'` handler, like Racket's `big-bang`):

```scheme
(define (step state)
  (+ state 1))

(define (draw state)
  (clear 0)
  (paint (circle 120 68 (+ 10 (* 5 (sin (/ state 20))))) 5))

(big-bang 0
  (on-tick step)
  (to-draw draw))
```

Either works. Global `set!` reads faster to Lua eyes; the `big-bang` style composes better as your program grows and matches the pure-functional shape Scheme rewards.

### Input

The six-button model, familiar from every fantasy console:

```scheme
(input/buttons)                            ;; ⇒ (up down left right a b)
(input/down? 'left)                        ;; ⇒ #t/#f — held?
(input/pressed? 'a)                        ;; ⇒ #t/#f — went down this frame?
```

Keyboard-to-button mapping is the terminal-standard TIC-80 mapping: arrows for movement, `Z` for A, `X` for B. Override it in your `config.slat` if you want WASD.

### Drawing

```scheme
;; primitives — return tagged lists, no side effect
(circle cx cy r)                           ;; outline
(disc cx cy r)                             ;; filled
(line x1 y1 x2 y2)
(rect x y w h)

;; painting them into the framebuffer (convenience layer)
(paint shape color)                        ;; paint any of the above
(text x y "hello" color)                   ;; text
(clear color)                              ;; wipe the frame

;; underlying real verbs, if you want them
(surface-paint-dots surf 'base dots color) ;; the primitive
(clear-surface-layer surf 'base)           ;; the primitive
```

`shape` is *any* of the primitives above — same shape you can `map` over. If you want ten circles, `map` produces the list; a `paints` wrapper for lists is another one-liner over `surface-paint-dots`.

### Audio

The reference has 13 audio verbs. The ones you'll reach for first:

```scheme
(audio/listen)                             ;; permission gate — call once
(audio/play 'kick-drum)                    ;; queue a sound
(audio/play 'ambient :loop #t)             ;; loop a track
(audio/halt handle)                        ;; stop something you played
(audio/master-volume 0.7)                  ;; global gain, 0..1

;; analysis (for music-reactive visuals)
(audio/spectrum)                           ;; ⇒ 32-element vector, FFT bands
(audio/onset?)                             ;; ⇒ #t on the frame a drum hits
(audio/onset-strength)                     ;; ⇒ number, 0..∞
(audio/tempo)                              ;; ⇒ BPM
(audio/key)                                ;; ⇒ (note mode confidence) | #f
```

If TIC-80's `sfx(n)` felt fine, `audio/play 'sound-n` feels the same. The difference: you get FFT and onset detection built in, which unlocks music-reactive visuals without extra libraries.

### Build a game inline — Bouncing ball → paddle → Pong

Start with a bouncing ball. Two coordinates, two velocities:

```scheme
(set-mode 240 136)

(define x 120) (define y 68)
(define vx 2)  (define vy 1)

(define (frame)
  (clear 0)

  ;; move
  (set! x (+ x vx))
  (set! y (+ y vy))

  ;; bounce
  (when (or (< x 4) (> x 236)) (set! vx (- vx)))
  (when (or (< y 4) (> y 132)) (set! vy (- vy)))

  ;; draw
  (paint (disc x y 3) 12))

(on-frame frame)
```

Save as `ball.scm`, `,load ball.scm` at the REPL, and it runs. A red-ish disc bounces around the framebuffer.

Now add a paddle. Read input, draw a rect:

```scheme
(define px 120)

(define (frame)
  (clear 0)

  ;; ball
  (set! x (+ x vx)) (set! y (+ y vy))
  (when (or (< x 4) (> x 236)) (set! vx (- vx)))
  (when (< y 4) (set! vy (- vy)))

  ;; paddle
  (when (input/down? 'left)  (set! px (max 20  (- px 3))))
  (when (input/down? 'right) (set! px (min 220 (+ px 3))))

  ;; paddle collision
  (when (and (> y 128) (< y 132)
             (> x (- px 20)) (< x (+ px 20)))
    (set! vy (- vy)))

  ;; game over
  (when (> y 136)
    (set! x 120) (set! y 68) (set! vy 1))

  ;; draw
  (paint (disc x y 3) 12)
  (paint (rect (- px 20) 130 40 4) 15))

(on-frame frame)
```

That's a half-Pong. Add a second paddle, keep score, and you have Pong. It's under a hundred lines. Ambitions grow from there — see Chapter 14 for four more starters.

---

## Chapter 5.5 — Entities and Parts (still Layer 1)

Between "raw framebuffer" and "full game engine" there is a Layer-1 surface you don't get in TIC-80, and it's worth a chapter on its own: the `entity/*` and `part/*` verbs. Forty-one entity verbs, nineteen part verbs. Together they let you build a character out of a sprite, give it physics, and animate expressive gesture — reach, wave, look-toward — without writing an inverse-kinematics library.

You'll skip this chapter if you're building Pong. You'll come back to it when you build the next thing.

### Making a character

```scheme
(define hero
  (base/make-character (sprite/address 'walk-cycle 0)))

(entity/set-pos! hero 100 100)
(entity/set-vel! hero 1 0)
```

`base/make-character` promotes a visual source to a first-class character with position, velocity, acceleration, and gesture channels. You get back a character ID. Every `entity/*` and `part/*` verb takes that ID.

Alternative: build a character from an emoji.

```scheme
(define companion
  (base/make-character (emoji-by-name 'star)))
```

### Entity verbs — the physics half

Position, motion, teams, collision. The shapes:

```scheme
(entity/pos hero)                       ;; ⇒ (x y)
(entity/set-pos! hero 50 60)
(entity/vel hero)                       ;; ⇒ (vx vy)
(entity/set-vel! hero 2 0)
(entity/accel! hero 0.1 -0.2)           ;; add to acceleration
(entity/team! hero 'allies)             ;; tag for collision filtering
(entity/distance hero 200 200)          ;; ⇒ number
(entity/heading hero)                   ;; ⇒ radians
```

Forty-one verbs total; those are the workhorses. The rest cover more specific cases — sleep/wake, tag queries, sprite swapping, collision groups, health, damage.

### Part verbs — the expression half

Where the entity system gets fun. Every character has *parts* — arms, head, legs, mouth — and the part verbs animate them.

```scheme
(part/wave hero 'right-arm)             ;; wave a limb
(part/reach hero 'left-arm 150 100)     ;; reach toward a point
(part/look-toward hero 200 50)          ;; turn head
(part/breathe hero)                     ;; idle breathing
(part/nod hero)                         ;; nod head
(part/shrug hero)                       ;; shrug shoulders
(part/point hero 'right-arm 200 100)    ;; point at a target
(part/expression hero 'joy)             ;; emit an expression
```

Nineteen part verbs total. The reference has the full list — `bow`, `grasp`, `lean`, `lower`, `raise`, `shake`, `step`, `sway`, `tilt`, `turn`, `twist`, and more. Each one is a real gesture your character can compose.

If you've built animation systems, you recognize what's happening: each part is a small state machine keyed to time; the verbs push targets onto it; interpolation runs each frame. The point is you don't write that — you compose the top-level gesture and the interpolation is done for you.

### A tiny character loop

```scheme
(set-mode 240 136)

(define hero
  (base/make-character (sprite/address 'walk-cycle 0)))

(entity/set-pos! hero 120 100)

(define (frame)
  (clear 0)

  ;; input drives velocity
  (let ((vx (cond ((input/down? 'left)  -2)
                  ((input/down? 'right)  2)
                  (else 0))))
    (entity/set-vel! hero vx 0))

  ;; gestures on button press
  (when (input/pressed? 'a) (part/wave    hero 'right-arm))
  (when (input/pressed? 'b) (part/reach   hero 'left-arm 120 60))

  ;; head tracks a moving point (fill in your own with input or physics)
  (part/look-toward hero 150 60)

  ;; idle
  (part/breathe hero))

(on-frame frame)
```

That's a full character controller in twenty lines. Add a companion with the same shape and now you have two-character stagecraft — same verbs, different IDs.

### AI verbs on top of entities (Layer 2)

If you turn on Layer 2, the `ai/*` verbs work over the same entity IDs:

```scheme
(ai/seek       companion (entity/pos hero) 3.0)   ;; chase
(ai/arrive     companion 200 200 40 2.0)          ;; approach and stop
(ai/flock      swarm 'boid 60)                    ;; three-rule flocking
(ai/follow-flow drone flow-field)                 ;; steer through a field
```

Steering behaviors on top of physics on top of a framebuffer. Composable through the entity ID.

---

## Chapter 6 — SLAT: The Language Format

SLAT is the shape of every persistent thing in Sakura Scheme: config, records, notebooks, session dumps, training corpora, cart definitions, animation storyboards. It's S-expressions. That's the whole trick.

### Why not YAML or JSON

YAML is context-sensitive whitespace with a five-page spec that everyone reads differently. JSON forbids comments and trailing commas — the two features you most want in a config file. Both formats give you a data shape that's *different from your code*, so you carry two parsers, two serializers, two mental models.

SLAT gives up nothing:

- It's the same reader that parses code, so tooling is free.
- It supports comments (`;` line, `#|...|#` block).
- Round-trip is byte-stable — read then write, get exactly what came in, comments and all.
- Streams line-by-line. `wc -l` on a SLAT file is a meaningful number.
- Every record is a value your program already knows how to walk.

A minimal SLAT record:

```
(record
  :id "job-42"
  :name "prep morning shipping run"
  :when "2026-07-14T07:00:00Z"
  :tier 'premium
  :items ("A" "B" "C"))
```

Read it into your program with the same `read` you use on `.scm` files:

```scheme
(define records
  (with-input-from-file "~/tasks.slat" read))
```

Write it back out:

```scheme
(with-output-to-file "~/tasks.slat"
  (lambda () (write records)))
```

Any dialect that ships fantasy-console mode also ships convenience wrappers — `read-slat`, `write-slat` — but the underlying operation is just Scheme's `read`/`write`, because SLAT is just S-expressions.

### The config file, in SLAT

`~/.scheme-lang/config.slat`:

```
;; My scheme-lang config.
;;
;; Layers I want available at startup.
(config
  :version "1.0"
  :layers  '(core media)
  :cart-source "~/code/scheme-carts"
  :theme        'sakura
  :keybindings  'emacs
  :editor       "nvim"
  :history-max  5000)
```

Comments are load-bearing; they survive the round trip. Unknown keys are preserved (so you can drop tomorrow's settings into today's file and they'll be there when tomorrow's build reads them).

### Writing a cart

A cart is a bundle of scheme actions plus a description document. The convention is a `.sks` file (Scheme cart source) paired with a `.slat` (or `.md`) documentation file that shares its stem:

```
carts/etsy/bulk-relist.sks
docs/etsy/bulk-relist.slat
```

The slug pairing is filename-based — no ML at ingestion. `bulk-relist.sks` sees `bulk-relist.slat` and knows they belong together.

A tiny cart:

```scheme
;; carts/hello/greet.sks
(define (greet name)
  (text 10 10 (string-append "hello, " name) 15))

(cart/register 'greet
  :fn greet
  :doc "Draw a greeting to the framebuffer."
  :args '((name string)))
```

`cart/register` publishes the verb into the cart dispatcher. Anyone with your cart directory pointed at their scheme-lang can now call `(cart/run 'greet "world")` and see it.

### Saving state — sessions as SLAT

Every REPL session can be saved and restored:

```
sakura> ,save my-session.slat
saved 4 bindings, 12 history entries

sakura> ,load my-session.slat
```

The saved file is a SLAT record listing your bindings and history. You can open it, edit it, ship it to a collaborator, or diff it against a previous version. Because it's data — your data — it belongs to you.

### Animations as SLAT

An animation is a sequence of frames, and a frame is a list of shapes. Both are already SLAT:

```
(animation
  :name "bouncing-ball"
  :fps 30
  :frames (
    ((disc 120 60 3))
    ((disc 122 62 3))
    ((disc 124 65 3))
    ((disc 126 69 3))))
```

Play it:

```scheme
(let ((anim (with-input-from-file "bouncing-ball.slat" read)))
  (for-each (lambda (frame)
              (clear 0)
              (for-each (lambda (shape) (paint shape 12)) frame))
            (cadr (member :frames anim))))
```

The animation record parses with the same reader as the code that plays it. Playing it is a loop over the `:frames` field — sixty lines short of a full player, but the shape is right there. Any dialect that ships animation as a first-class concept will hand you an `animation/play` verb; the base is Scheme, so you can build one in ten lines.

---

## Chapter 7 — REPL Magic

The REPL is the primary interface. There is no IDE. Your editor sits next to the REPL and you paste code back and forth (or use `,watch-file` — see below).

Understanding the meta-command surface pays off within an hour.

### The exploration crew

Every meta-command starts with a comma:

```
,help                   list every command
,help map               arity + doc + tiered examples for map
,type filter            just the type signature
,doc car                just the docstring
,arity fold             just the arity
,examples reduce        three tiered examples (novice / intermediate / expert)
,namespace list         every verb whose name starts with 'list/'
,apropos map            symbols whose name matches 'map'
,search apply           regex over docs + examples
,time (map square '(1 2 3 4 5 6 7 8 9 10))
                        wall + fuel + memory
,expand (let ((x 1)) (+ x 2))
                        macro-expand
,trace fact             instrument a function; every call prints
,untrace fact
,inspect tree           walk a value with arrow keys
,watch-file scratch.scm live-reload on save
,save session.slat      write your bindings + history
,load session.slat      restore them
,paredit                current paredit bindings
,image                  what your terminal can render
,ask sakura "..."       ask her (when connected)
,exit
```

Twenty-plus commands. All discoverable through `,help`.

### Named results

Every evaluation stashes its answer as `_`, and the last ten as `_1`, `_2`, …, `_9`:

```scheme
sakura> (+ 1 2)
3
sakura> (* _ 10)
30
sakura> _2
3
```

The named-result feature saves you from copy-pasting long expressions back into the prompt.

### Tab completion

Tab completes verbs, namespaces, and meta-commands. It's *fuzzy* — you don't have to know the prefix:

```
sakura> aud<TAB>
audio/bar-clock  audio/halt  audio/key  audio/listen ...

sakura> spec<TAB>
audio/spectrum
```

Type any substring, press Tab. If there's one match, it fills in. Multiple matches list.

### Ghost signature hints

As you type `(map `, the row above the prompt dims to show `map`'s arity, argument names, and a summary doc line. When you're inside a call and you've forgotten the argument order, glance up.

### Structural editing (paredit)

Sakura Scheme's REPL supports paredit at the prompt:

- `Alt-]` — barf-forward (shrink current form on the right)
- `Alt-\` — slurp-forward (grow current form to swallow the next form)
- `Alt-[` — slurp-backward
- `Alt-K` — kill-form (delete the current form)

Type `,paredit` for the full current binding list. You never need to count parens.

### Multi-line editing

Balanced Enter evaluates. Unbalanced Enter adds a line. So:

```
sakura> (define (fact n)
         (if (< n 2) 1
             (* n (fact (- n 1)))))
sakura>
```

You just kept typing. Ctrl-O opens the multi-line buffer in `$EDITOR` if you want a real editor for a longer definition. Ctrl-R gives you fuzzy history search — every command you've ever run, one keystroke away.

### Live reload

Point `,watch-file` at a `.scm` file. The REPL notices when you save and reloads:

```
sakura> ,watch-file ~/experiments/scratch.scm
watching scratch.scm — reloading on save
```

Edit scratch.scm in your editor; save; the REPL re-runs it. No `require` cycle, no import gymnastics.

### Ask Sakura (Layer 2, when connected)

If you have an AI endpoint configured:

```
sakura> ,ask sakura "why is my map returning the wrong shape?"
```

She sees your current bindings, the last few evaluations, and your question — and replies with runnable code you can press Enter to eval. Not connected in the base binary; the plumbing is there, the endpoint waits on her.

### Session save/restore

`,save my-work.slat` writes a SLAT file with your bindings and history. Come back tomorrow: `,load my-work.slat` and the world is where you left it.

---

## Chapter 8 — The Reference IS the Language

Every verb in Sakura Scheme lives in one file:

```
docs/SAKURA-SCHEME-REFERENCE.slat
```

That file is 1,157 verbs plus 120 core forms, each with:

- `:name` — the symbol you call it by.
- `:library` — namespace it belongs to.
- `:signature` — arity and expected argument shape.
- `:summary` — one line.
- `:explanation` — a paragraph.
- `:examples` — three tiered code samples (novice, intermediate, expert), each with a note.
- `:caveats` — the sharp edges.
- `:drawbacks` — the trade-offs.
- `:usecases` — where you'd reach for it.
- `:related` — other verbs to consider.
- `:learn` — pedagogical scaffolding: concept, prerequisites, progression.

That file powers everything: the REPL's `,help` and `,examples`, the docs site, the LLM tool-call schemas, the auto-completion, and this book. When we add a verb, we author its reference entry *first*, then implement, then test. If it isn't in the reference, it doesn't exist — that's not a slogan, that's a build gate.

### Looking things up

```
sakura> ,help audio/spectrum
audio/spectrum : () -> vector

Returns a 32-element vector of frequency magnitudes, logarithmically
spaced from low bass to high treble, reflecting the current audio spectrum.

Examples:
  novice:       (audio/spectrum)
  intermediate: (let ((s (audio/spectrum)))
                  (map (lambda (b) (paint (disc b (- 100 (* 100 b)) 3) 15))
                       s))
  expert:       (define (adaptive-hue) ...)

Related: audio/listen  audio/onset?  audio/onset-strength
Caveats: The FFT window adds ~43 ms latency; do not treat as instantaneous.
```

The same information the docs site renders. The same information a hover-help in an LSP would render. The same information an LLM sees when it decides how to call it. One source.

### Grepping the reference

If you like grep:

```
grep -A 4 ':name "audio/' docs/SAKURA-SCHEME-REFERENCE.slat
```

That gives you every audio verb by name and signature. Same shape for `entity/`, `game/`, `shoppe/`, whatever.

### Reading `:learn`

The `:learn` field is the pedagogical scaffold: what concept the verb teaches, what prerequisites you should have first, and what to reach for next. It's aimed at someone learning, not just looking up:

```
:learn (:concept "Frequency-domain signal representation (FFT) and its
                 use in real-time reactive design."
        :prerequisites ("let" "car" "map" "*" "+")
        :progression "Master audio/spectrum for visual effects, then combine
                     with audio/onset? and audio/lufs to build a complete
                     music-reactive system.")
```

If you find yourself at a verb whose `:learn.progression` points somewhere interesting, follow the trail. That's how the reference is designed to be read.

---

## Chapter 9 — Cart Directory

A cart is a small named action bundle. The convention is `~/code/scheme-carts/` next to your scheme-lang clone — but any absolute path works.

`~/.scheme-lang/config.slat`:

```
(config
  :cart-source "~/code/scheme-carts"
  :cart-layout
    (:carts   "carts"
     :docs    "docs"
     :broken  "broken")
  :pairing 'slug-by-stem
  :layers '(core media))
```

Inside `:cart-source`:

- `carts/` — the `.sks` implementations.
- `docs/` — the `.md` or `.slat` descriptions.
- `broken/` — carts that don't currently work, kept for reference plus frozen manifests.

**Slug pairing.** A cart named `carts/etsy/relist.sks` is automatically paired with the docs file `docs/etsy/relist.slat` (or `.md`) — same stem, mirrored path. No embedding index required. If the filenames match, the pairing works. If they don't, the doc doesn't attach; that's the whole check.

### Pointing at your own bundle

If you keep your carts elsewhere — under `~/work/carts` or a git repo you're versioning — override `:cart-source`:

```
:cart-source "/Users/you/work/carts"
```

The runtime loads the layout from that path instead. You can ship a cart bundle to a collaborator as a git repo, or as a tarball, and they point their scheme-lang at it. The launcher discovers dialects the same way — see `TEMPLATE-FOR-FORKS.md` for the fork-a-dialect pattern.

### No ML at ingestion

An intentional simplicity: cart discovery is filename-based, not embedding-based. Nothing runs a model to figure out which docs go with which cart. This lands two ways: (1) it's deterministic — the same directory always yields the same dispatch — and (2) it's fast, because nothing needs to warm up before your first cart runs.

If you later want fuzzy retrieval (natural-language "find the cart that does X"), that's a Layer-2 (AI) concern and lives above the cart directory, not inside it.

---

## Chapter 10 — AI Mode (Layer 2)

When you turn on `:layers '(core media ai)`, four things become available.

### `cortex/remember` and `cortex/recall`

Cortex is per-user persistent memory. The verbs are simple:

```scheme
(cortex/remember 'user:alfred:trip
                 "Fiji, June 2024. Loved the radio station.")

(cortex/recall 'user:alfred:trip)
;; ⇒ "Fiji, June 2024. Loved the radio station."
```

The key convention is `namespace:user:topic`. Cortex accretes over time; you don't retrain a model to add a fact. This is a deliberate architectural split — the weights hold the *shape*, cortex holds the *facts*.

Details of retention windows, indexing, and privacy are runtime concerns; the verb interface is the interface. If you want to know how cortex is implemented today, read `docs/ENGINEERING.slat` in the sibling `curator` repo.

### `ask/reasoner`

Delegate a hard problem to a remote reasoning service:

```scheme
(ask/reasoner :query "how would I restructure this inventory query?"
              :context (session/current))
```

Returns a pending descriptor; the reasoning runs asynchronously. Use `afford/deep-think` if you want to spend the resources; `need/deep-think?` first if you want to check whether it's warranted.

### `ai/*` — steering, boids, behavior trees

37 verbs. Steering behaviors (`ai/seek`, `ai/pursue`, `ai/evade`, `ai/wander`, `ai/arrive`), boid rules (`ai/align`, `ai/cohere`, `ai/separate`, `ai/flock`), flow fields (`ai/flow-field`, `ai/follow-flow`), pathfinding (`ai/path`, `ai/waypoints`, `ai/passable?`), and full behavior trees (`ai/bt-sequence`, `ai/bt-selector`, `ai/bt-tick`, `ai/bt-condition`, `ai/bt-action`, `ai/bt-parallel`, `ai/bt-invert`, `ai/bt-force`).

The reference has full docs on each. If you've built AI for a game before, these are the shapes you already know, spelled the Sakura way.

### `audio/transcribe-with-cloud-help`

Speech-to-text via a cloud backend. Returns a pending structure; the wire is not live in the base binary. This is a placeholder verb — the reference entry exists so tooling can offer it as an option; the call currently returns `(pending-cloud-help :reason not-yet-wired)` until the backend lands.

### When you'd reach for AI mode

- Building a persona-shaped assistant on top of Sakura Scheme (this is what the curator dialect does).
- Adding steering behaviors to a game (flocking crowds, arriving NPCs).
- Wanting deferred reasoning for hard multi-step planning problems.

### When you wouldn't

- If you're building a fantasy console game with fixed behavior, you don't need Layer 2. Stay at Layer 0 + 1.
- If your latency budget is under 100 ms, cortex/recall and ask/reasoner will disappoint. Layer 2 is patient.

---

## Chapter 11 — Commercial Mode (Layer 4)

Layer 4 is shop / cart / transaction / auth. It's gated. You have to log in.

### `sakura login`

```
$ sakura login
Opening browser... paste the code back here.
```

A device-flow OAuth handshake, browser-based. On success, a bearer token lands in `~/.scheme-lang/auth.slat`. From then on, Layer 4 verbs will authenticate against your token.

If your token expires, `sakura login` refreshes it. If you want to log out, `sakura logout` (or `rm ~/.scheme-lang/auth.slat`).

### The shop verbs

```scheme
(shoppe/open)                              ;; ⇒ 'open — opens the shop for the day
(shoppe/close)                             ;; ⇒ 'closed
(shoppe/balance)                           ;; ⇒ current-balance dict
(shoppe/buy-pack 100)                      ;; ⇒ receipt dict (buy 100 tokens)
(shoppe/buy-merch 'sku-42)                 ;; ⇒ receipt dict
(shoppe/savings 500)                       ;; ⇒ pricing dict (what 500-token pack costs)
(shoppe/transactions 20)                   ;; ⇒ last 20 receipts
```

Each returns a dict (a hash-table) with the shape documented in the reference. Every receipt lands in your local transaction log; you can `,inspect` it or dump it as SLAT.

### Cards — bundles of shop actions

The card system (10 `card/*` verbs) wraps sequences of shop actions into single-shot dispatches. A card is a small state machine — its actions run in sequence, its context flows through, and it either commits or reports failure. This is how a curator dialect ships a whole "list 200 items on Etsy" operation as one call the operator invokes.

The reference documents each card verb in detail. If you're going to build on Layer 4, read `card/*` in the reference before you write anything.

### The doctrine

Layer 4 is where money happens. Everything through it is auth-gated and audit-logged. Every call has a receipt. Nothing runs silently.

If you're building a commercial dialect on top of Sakura Scheme (a curator, an inventory manager, a specialized POS), Layer 4 is your foundation. If you're building a game or a music visualizer, you'll never load it.

---

## Chapter 12 — Common Headaches and Solutions

Every language has papercuts. Here are the ones that catch Fennel / TIC-80 / Clojure / Lua programmers on their first week.

### `nil` and `#f`

Lua has `nil`. Fennel has `nil`. Clojure has `nil`. Sakura Scheme does not have `nil` — it has `#f` (false), `'()` (empty list), and undefined behavior for reading an unbound variable (an error, not silent failure).

The subtle case: in Lua, `nil` is falsy. In Clojure, `nil` is falsy. In Scheme, *only `#f` is falsy*. Every other value — including `0`, `""`, `'()`, `(void)` — is truthy.

**Bug you will hit:**

```scheme
(if (hash-ref maybe-empty-dict 'x)
    'found
    'missing)
```

If `x` isn't in the dict, `hash-ref` returns... what? In Sakura Scheme's base, it returns `#f`, which is falsy, so the code works as you'd expect. But *some* hash implementations return `'()` (empty list) for missing keys, which is truthy under Scheme rules. Read the `:signature` in the reference. When in doubt, use `hash-has-key?`:

```scheme
(if (hash-has-key? maybe-empty-dict 'x)
    (hash-ref maybe-empty-dict 'x)
    'missing)
```

### The `t = t + 1` frame counter

TIC-80 gives you a global `t` you can increment each frame. Sakura Scheme's `on-frame` doesn't. You have two paths:

**Global mutable, if that's your shape:**

```scheme
(define t 0)

(define (frame)
  (set! t (+ t 1))
  (clear 0)
  (text 10 10 (number->string t) 15))

(on-frame frame)
```

**State-threaded, if you want the discipline:**

```scheme
(define (step state)  (+ state 1))
(define (draw state)  (clear 0)
                      (text 10 10 (number->string state) 15))

(big-bang 0
  (on-tick step)
  (to-draw draw))
```

The second one composes better. The first one reads faster. Pick your battle.

### Closures capturing loop variables

Same trap Fennel has, same solution:

```scheme
;; wrong — every closure captures the same n
(define closures
  (map (lambda (n) (lambda () n))
       '(1 2 3)))

;; wait, this actually works in Scheme because each map iteration
;; creates a fresh binding of n. Compare Lua:
```

```lua
-- wrong in Lua
local fs = {}
for i = 1, 3 do fs[i] = function() return i end end
-- all three return 3 in Lua 5.1's for loop (i is one shared binding)
```

Sakura Scheme's `map` gives you a fresh `n` per iteration by construction, so the closures capture what you'd expect. If you build your own loop with `set!` and a shared variable, you'll get the Lua-shape bug:

```scheme
;; wrong — all closures share the same n
(define closures '())
(let loop ((i 3) (n 0))
  (when (> i 0)
    (set! n (+ n 1))
    (set! closures (cons (lambda () n) closures))
    (loop (- i 1) n)))

;; all three closures return 3
```

Fix: put the binding inside the lambda's enclosing scope:

```scheme
(define closures '())
(let loop ((i 1))
  (when (<= i 3)
    (let ((snapshot i))
      (set! closures (cons (lambda () snapshot) closures)))
    (loop (+ i 1))))

;; each closure returns its own snapshot
```

Same fix as Fennel's `local i = i` inside the loop.

### Module imports

Sakura Scheme uses R7RS-style `import`:

```scheme
(import (sakura threading))       ;; -> and ->> macros
(import (sakura animation))       ;; helpers
```

You will *not* usually need to import layer-0 or layer-1 verbs — they're in the base environment. Import is for opt-in libraries and for community modules.

If you're used to Lua's `require` or Clojure's `require`, `import` fills the role. Aliasing (`(import (rename (sakura threading) (-> pipe)))`) works the way you'd expect from R7RS.

### Tail-call quirks

Scheme guarantees tail-call optimization *only in tail position*. This is not:

```scheme
;; NOT tail — cons wraps the recursive call
(define (bad-map f xs)
  (if (null? xs) '()
      (cons (f (car xs)) (bad-map f (cdr xs)))))
```

The `cons` is not in tail position — the recursive call has to return before `cons` can run. Very long lists will exhaust memory (though not the JS stack, because the trampoline handles it).

Rewrite as accumulator:

```scheme
(define (good-map f xs)
  (let loop ((in xs) (out '()))
    (if (null? in)
        (reverse out)
        (loop (cdr in) (cons (f (car in)) out)))))
```

Now the recursive call is in tail position. Deep lists work.

Or just use the built-in `map`, which handles all of this for you.

### `define` inside `let`

R7RS lets you `define` inside a `let` body, and Sakura Scheme respects this. The defines become local to the `let`, in the shape of an implicit `letrec`:

```scheme
(let ((x 10))
  (define (helper y) (+ x y))
  (helper 5))                             ;; ⇒ 15
```

But be aware: this is a subtle interaction with `set!` on the outer `x`. Read carefully if you nest deeply.

### The reader auto-quotes shape heads

At the REPL, `(circle 40 40 15)` isn't a call — the reader sees an unbound head and auto-quotes it. So the value is the tagged list `(circle 40 40 15)`. Then the display layer notices the shape and renders it.

This is *only* for shape heads: `circle`, `disc`, `line`, `rect`, `shapes`, `plot`. Everything else is a normal call. If you accidentally shadow one of those names, the auto-quote goes away for that name. If you want an unambiguous read, quote explicitly: `'(circle 40 40 15)`.

The rule is in `src/repl/repl.js` — `AUTO_QUOTE_HEADS`.

### Zero-indexing everywhere

Lua indexes from 1. Fennel too (it's a Lua transpiler). Sakura Scheme indexes from 0. `(list-ref xs 0)` is the first element.

### Numbers

Sakura Scheme distinguishes exact and inexact numbers, R7RS-style. `1/3` is exact; `0.3333` is inexact. Most arithmetic between exacts stays exact — `(+ 1/3 1/6)` is `1/2`. As soon as an inexact enters, everything becomes inexact — `(+ 1/3 0.5)` is `0.8333...`. If you're used to Lua's one-number-type simplicity, you can force inexact with `exact->inexact`.

### Error handling

Errors are values:

```scheme
{:kind        :not-found
 :message     "hash key missing: 'x"
 :source-pos  (line 42 col 12 file "scratch.scm")
 :did-you-mean ("y")}
```

You can `guard`/`raise` (R7RS) around them, or let them bubble to the REPL, which pretty-prints the shape. The `:did-you-mean` field is populated automatically for many verbs — a Levenshtein pass over the known names.

---

## Chapter 13 — Sample Projects

Four starters. Each is a base you can grow.

### 13.1 — Music visualizer

A ten-band equalizer that reacts to whatever's playing on your speakers (via mic input):

```scheme
(set-mode 240 136)
(audio/listen)                             ;; request mic permission

(define (frame)
  (clear 0)
  (let ((s (audio/spectrum)))              ;; 32 bands
    ;; downsample to 10 for chunkier bars
    (let loop ((i 0))
      (when (< i 10)
        (let* ((band-idx (* i 3))
               (level    (vector-ref s band-idx))
               (h        (min 130 (floor (* level 200))))
               (x        (+ 10 (* i 22))))
          (paint (rect x (- 130 h) 18 h)
                               (+ 3 (modulo i 12))))
        (loop (+ i 1))))))

(on-frame frame)
```

Bright, chunky, responsive. Change `22` to `10` for thinner bars, `130` to your resolution for taller ones. Add `audio/onset?` to flash the background on drum hits:

```scheme
;; add to frame
(when (audio/onset?)
  (clear 15))   ;; white flash on onset
```

### 13.2 — 2D physics playground

A hundred bouncing discs with gravity and mutual collision:

```scheme
(set-mode 320 240)

(define discs
  (map (lambda (i)
         (list (+ 20 (* 15 (modulo i 20)))   ;; x
               (+ 20 (* 15 (quotient i 20))) ;; y
               (- (* 0.1 i) 5)               ;; vx
               0                             ;; vy
               (+ 3 (modulo i 4))))          ;; r
       (iota 100)))

(define (step d)
  (let ((x (list-ref d 0))
        (y (list-ref d 1))
        (vx (list-ref d 2))
        (vy (list-ref d 3))
        (r (list-ref d 4)))
    (let* ((nvy (+ vy 0.3))                  ;; gravity
           (ny  (+ y nvy))
           (nx  (+ x vx))
           (nvx (if (or (< nx r) (> nx (- 320 r)))
                    (- (* vx 0.9))
                    vx))
           (fvy (if (> ny (- 240 r))
                    (- (* nvy 0.7))          ;; bounce with damping
                    nvy)))
      (list (max r (min (- 320 r) nx))
            (max r (min (- 240 r) ny))
            nvx fvy r))))

(define (frame)
  (clear 0)
  (set! discs (map step discs))
  (for-each (lambda (d)
              (paint
                (disc (list-ref d 0) (list-ref d 1) (list-ref d 4))
                (+ 5 (modulo (list-ref d 4) 10))))
            discs))

(on-frame frame)
```

That's discs falling under gravity, damping when they hit the floor, bouncing off walls. Adding pair-wise collision is a nested `for-each` — try it as a stretch.

### 13.3 — Tiny synthesizer

A keyboard piano using the `synth/*` verbs:

```scheme
(set-mode 240 136)

;; map buttons to note frequencies
(define notes
  (list (cons 'left 261.63)                  ;; C4
        (cons 'down 293.66)                  ;; D4
        (cons 'right 329.63)                 ;; E4
        (cons 'up 349.23)                    ;; F4
        (cons 'a 392.00)                     ;; G4
        (cons 'b 440.00)))                   ;; A4

(define (frame)
  (clear 0)
  (text 40 60 "press any button" 15)
  (for-each
    (lambda (note-pair)
      (when (input/pressed? (car note-pair))
        (synth/play :freq (cdr note-pair)
                    :dur 300
                    :wave 'sine)))
    notes))

(on-frame frame)
```

Press the arrow keys, Z, and X. Each triggers a 300 ms sine tone at the mapped frequency. Change `:wave 'sine` to `:wave 'square` for a chippier sound. The `synth/*` namespace has nine verbs — envelope, filter, gain, ADSR — for shaping the tone further.

### 13.4 — Particle fountain

Two hundred particles emitted at the bottom of the screen, gravity, fade to black on death:

```scheme
(set-mode 240 136)

(define particles '())

(define (spawn)
  (let ((angle (- (/ 3.14159 2) (* 0.4 (- (/ (random) 32768.0) 0.5))))
        (speed (+ 3 (* 2 (/ (random) 32768.0)))))
    (list 120 130                                ;; x y (bottom center)
          (* speed (cos angle))                  ;; vx
          (- (* speed (sin angle)))              ;; vy (upward)
          60)))                                  ;; life

(define (step p)
  (list (+ (car p) (list-ref p 2))               ;; x + vx
        (+ (cadr p) (list-ref p 3))              ;; y + vy
        (list-ref p 2)                           ;; vx unchanged
        (+ (list-ref p 3) 0.15)                  ;; vy + gravity
        (- (list-ref p 4) 1)))                   ;; life - 1

(define (alive? p) (> (list-ref p 4) 0))

(define (frame)
  (clear 0)
  ;; emit
  (set! particles (cons (spawn) (cons (spawn) particles)))
  ;; step and cull
  (set! particles (filter alive? (map step particles)))
  ;; render — color by life
  (for-each
    (lambda (p)
      (let ((color (max 3 (min 15 (quotient (list-ref p 4) 4)))))
        (paint (disc (list-ref p 0) (list-ref p 1) 2) color)))
    particles))

(on-frame frame)
```

Two hundred pixels roughly, cheap, satisfying. Change the emission rate by adding or removing `(cons (spawn) ...)` lines. Add wind by mutating `vx` in `step`. Add color-cycling by making `color` depend on `life`.

### 13.5 — A starter for a game

The classic Snake, half-done, ready for you to finish. State-threaded so it doesn't leak globals:

```scheme
(set-mode 240 136)

(define (make-state)
  (list->hash
    '((snake  ((10 . 10) (9 . 10) (8 . 10)))    ;; head first
      (dir    (1 . 0))                          ;; right
      (food   (20 . 15))
      (grow   0)
      (t      0))))

(define (step-snake s)
  (let* ((snake (hash-ref s 'snake))
         (dir   (hash-ref s 'dir))
         (head  (car snake))
         (new-head (cons (+ (car head) (car dir))
                         (+ (cdr head) (cdr dir))))
         (grow  (hash-ref s 'grow))
         (new-snake (if (> grow 0)
                        (cons new-head snake)
                        (cons new-head (reverse (cdr (reverse snake)))))))
    (hash-set! s 'snake new-snake)
    (hash-set! s 'grow (max 0 (- grow 1)))
    s))

(define state (make-state))

(define (frame)
  (clear 0)

  ;; input
  (when (input/pressed? 'up)    (hash-set! state 'dir (cons 0 -1)))
  (when (input/pressed? 'down)  (hash-set! state 'dir (cons 0 1)))
  (when (input/pressed? 'left)  (hash-set! state 'dir (cons -1 0)))
  (when (input/pressed? 'right) (hash-set! state 'dir (cons 1 0)))

  ;; step every 6 frames
  (hash-set! state 't (+ 1 (hash-ref state 't)))
  (when (zero? (modulo (hash-ref state 't) 6))
    (step-snake state))

  ;; draw snake
  (for-each
    (lambda (seg)
      (paint
        (rect (* 6 (car seg)) (* 6 (cdr seg)) 5 5)
        11))
    (hash-ref state 'snake))

  ;; draw food
  (let ((f (hash-ref state 'food)))
    (paint (rect (* 6 (car f)) (* 6 (cdr f)) 5 5) 12)))

(on-frame frame)
```

That's your movement, your input, your draw loop. What's missing: collision (snake eats itself), food consumption (eating grows the snake), food respawn, game over. All of those are twenty lines each — go finish it.

---

## Chapter 14 — Contributing Back

The doctrine: **the reference is the language**. If you propose a new verb, you author its reference entry *first*, then implement it, then test.

### Filing a bug

`https://github.com/Lacuna-Labs/scheme-lang/issues`

Include:

- The one-line reproduction — the smallest expression that shows the bug.
- What you expected.
- What happened.
- Your `scheme-lang --version`, your Node version, your OS.

Screenshot if it's visual. Attach a `.slat` if it's about round-trip.

### Proposing a new verb

Three steps, in this order:

**1. Author the reference entry.** Open `docs/SAKURA-SCHEME-REFERENCE.slat`, find the right library section (or add a new one), and write a full verb record — `:name`, `:library`, `:kind`, `:signature`, `:summary`, `:explanation`, `:examples` (three tiered), `:caveats`, `:drawbacks`, `:usecases`, `:related`, `:learn`. Yes, all of it. If you can't articulate `:caveats`, the verb probably isn't ready.

**2. Implement.** Add the primitive to the right file — `src/base.js` for a core verb, an adapter file for a graphics/audio/network verb, a dialect file for a namespaced verb. Register it in the verb registry so tooling picks it up.

**3. Test.** Add a case to `tests/` (or, if the verb crosses a boundary, a smoke test). `node --test tests/` should pass. No new npm deps.

Open a PR with all three commits (reference entry, implementation, test). We'll review the reference entry first — if the shape doesn't fit the language, we'll say so, and the implementation doesn't matter yet. If the shape fits, the implementation is usually straightforward.

### Style guide

- Small verbs. If a verb needs more than one paragraph in `:explanation`, split it.
- Signatures over documentation. A good `:signature` cuts three sentences of prose.
- Namespaces earn their prefix. Don't add `foo/*` for a single verb — put it in the closest existing namespace.
- Every example runs. If the novice example can't be pasted directly into the REPL and evaluate, it's not ready.
- `:caveats` are for real trade-offs. Not disclaimers. If you find yourself writing "may not work with X", think about whether X is a real case; if it is, either fix it or say so plainly.

### Making your own dialect

Fork the repo. Change the name in `dialect.json`. Drop your verbs into `verbs/`. Drop your adapters into `adapters/`. The REPL discovers you automatically; the launcher runs you.

See `TEMPLATE-FOR-FORKS.md` for the fork pattern, and `TEMPLATE-FOR-FORKS-PAGES.md` for the browser-REPL-and-docs GitHub Pages pattern. Every fork gets Pages for free.

Sakura Scheme itself is one fork — a dialect on top of the base language. Curator is another. Yours can be too.

---

## Appendix A — Macros in ~10 minutes

Macros in Sakura Scheme come in two flavors: hygienic (`syntax-rules`) and classic (`define-macro`). If you've written Clojure macros, `define-macro` is the closer analog; if you've written Fennel macros, `syntax-rules` will feel restrictive at first and pleasant later.

### Hygienic macros — `syntax-rules`

Pattern-based, hygienic (variables don't leak, captures don't happen accidentally). The classic `when`:

```scheme
(define-syntax when
  (syntax-rules ()
    ((_ test body ...)
     (if test (begin body ...) #f))))
```

`_` matches the macro name. `test` matches one expression. `body ...` matches zero or more. The template on the second line is what gets emitted, with each pattern variable substituted.

A `swap!`:

```scheme
(define-syntax swap!
  (syntax-rules ()
    ((_ a b)
     (let ((tmp a))
       (set! a b)
       (set! b tmp)))))

(define x 1) (define y 2)
(swap! x y)
;; x = 2, y = 1
```

The `tmp` binding is hygienic — even if the caller has a `tmp` in scope, they won't collide.

A `unless`:

```scheme
(define-syntax unless
  (syntax-rules ()
    ((_ test body ...)
     (if test #f (begin body ...)))))
```

(Actually, `unless` is built in, but the shape is illustrative.)

An `and` from scratch:

```scheme
(define-syntax my-and
  (syntax-rules ()
    ((_)          #t)
    ((_ x)        x)
    ((_ x y ...)  (if x (my-and y ...) #f))))
```

Three cases. Empty `and` is `#t`. One argument is that argument. More than one: if the first is truthy, recurse; else `#f`.

### Classic macros — `define-macro`

`define-macro` takes arguments as lists and returns code to emit. It's not hygienic. Useful when `syntax-rules` gets too clever for the shape you want.

```scheme
(define-macro (thread-first x . forms)
  (if (null? forms)
      x
      (let ((form (car forms)))
        `(thread-first
           (,(car form) ,x ,@(cdr form))
           ,@(cdr forms)))))
```

A hand-rolled `->` (thread-first). `,` is unquote, `@` is unquote-splicing, backtick is quasiquote — same as Clojure's syntax-quote system.

If you've built macros in Clojure, this is the same brain. The difference: Clojure gensyms are automatic behind `#`; here you write them explicitly with `(gensym)` if you need them. Sakura Scheme's `syntax-rules` is usually the right tool; `define-macro` is the escape hatch.

### The macro-expansion window

At the REPL:

```
sakura> ,expand (when (> 3 2) (display "yes"))
(if (> 3 2) (begin (display "yes")) #f)
```

`,expand` lets you see what a macro produces. Debugging a macro is nine parts reading its expansion carefully.

### The macro budget

For DoS reasons, the macro expander has a step budget (400 steps per top-level call). If you recurse in a macro without bounding, you'll hit the budget and get a clean error. This lets a hostile piece of code fail fast rather than hanging the interpreter. If you have a legitimate deep-recursion macro, split it: emit code that recurses at *runtime* rather than at expansion time. That's usually the better shape anyway.

---

## Appendix B — SICP-shape exercises

You will get more out of this book if you sit with a few small exercises. None of these require Layer 2 or above; they use only the base language plus Layer 1.

**B.1 — Rewrite `map`, `filter`, `fold`.** In terms of `cons`, `car`, `cdr`, `null?`, `lambda`, and each other. Then compare your versions to `,doc map` etc.

**B.2 — Church numerals.** `(define zero (lambda (f) (lambda (x) x)))`. Define `succ`, `add`, `mul`. Verify that `((mul three four) inc 0)` returns 12, where `three` and `four` are Church-encoded and `inc` is `(lambda (x) (+ x 1))`.

**B.3 — A stream of primes.** Using `let loop` and a lazy shape (thunks — `(lambda () ...)`), generate an infinite stream of primes by trial division. Print the first hundred.

**B.4 — A visual sine wave.** Given `(sin x)` and the framebuffer verbs, draw a scrolling sine wave that moves left one pixel each frame. Add a second wave phased 180° out. Now blend them and watch beats emerge when the frequencies differ slightly.

**B.5 — Sound-reactive color cycle.** Every time `audio/onset?` fires, increment a global palette-index; use it modulo 16 as the color argument to your `paint` calls. Effectively, drum hits rotate the color of everything on screen. Try it with a track that has strong percussion.

**B.6 — Snake, finished.** Take the half-Snake in §13.5, complete the collision, food consumption, food respawn, and game-over. Add a two-second death animation. Add a score display in the top-right.

**B.7 — A Sprague-Grundy solver.** Turn on Layer 3. Use `game/grundy` and `game/nim-sum` to build a solver for Nim on three heaps: given `(a b c)`, return the winning move for the player to move.

**B.8 — A tiny cart.** Author a full `cart/register`ed cart that takes an `x` and a `y` and paints a five-pointed star at that location. Ship the cart with a `.slat` doc file paired by stem. Verify the pairing works.

If you do all eight, you've touched Layer 0, Layer 1, Layer 3, the cart system, and the reference — and you've written enough small programs to know where the surface is comfortable and where it isn't. Report back.

---

## Chapter 15 — Closing

Jesse — that's the shape.

You have a language that reads like the Lisps you already know, with a framebuffer that behaves like the fantasy consoles you already love, and a reference file that's honest enough to double as documentation, tool-call schema, LSP source, and this book. The parts you know (closures, tail calls, `map`, `filter`, quasiquote) transfer without ceremony. The parts that differ (parallel `let`, zero-indexed lists, tagged-list shapes, verb namespacing, SLAT everywhere) each earn their difference in a small way if you stay long enough to feel them.

If you build something — a music toy, a shop cart, a game, an animation storyboard, a dialect of your own — we would love to see it. If you find deep bugs, we'll hunt them with you. Open an issue; tag it `book-of-jesse` if it came from working through this book, so we know which examples to sharpen.

The whole standard is the arcade-cabinet standard: someone gave a shit. That's what a good tool feels like. That's the bar we're trying to hold. Anything that isn't clearing it, we want to know.

Go build something.

— Alfred, and whoever's at the terminal today,
Brooklyn, 2026

*✿*
