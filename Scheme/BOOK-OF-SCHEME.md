# The Book of Scheme

*A ramp-up for programmers new to Scheme, using scheme-lang.*

---

## Foreword

You've written code before. Maybe Python, JavaScript, C, Go, Rust, Java, Ruby — the details don't matter for this book. What matters is that you know what a function is, what a loop is, what a data structure is. You want to add Scheme to the list.

This is a short book. It aims to leave you *pretty good* at Scheme — able to build small useful programs, read most Scheme code you encounter, and write your own macros when the moment calls for it. Not a Scheme wizard. A working Scheme programmer.

We'll use `scheme-lang` — a small, self-contained Scheme that runs on Node and boots in a hundred milliseconds. Every example in this book runs in the REPL you get when you type `sakura-scheme`. Copy any block, paste it, hit Enter, watch what happens. That's the whole method.

Somebody gave a shit about writing this. That's the whole standard. If it's useful, wonderful. If there are bugs, we'll fix them with you.

— The maintainers, Brooklyn, 2026

---

## Chapter 1 — Welcome

Scheme is a small, careful language in the Lisp family. It's been around since 1975. Guy Steele and Gerald Sussman designed the first version to explore a specific idea — the *actor model* of computation — and ended up publishing a series of papers, the "Lambda Papers," that shaped a generation of programming-language design.

You've probably heard some of the folklore. Scheme has parentheses. Scheme has macros. Scheme is what MIT taught freshmen with, in a book called *Structure and Interpretation of Computer Programs* (SICP). Some of that is history now — MIT dropped SICP as its intro course in 2009 — but the book is still in print because the ideas are still the ideas.

Here is what you actually need to know to start:

- **Scheme is a Lisp.** That means the syntax is uniform. Everything is either an *atom* (a number, a string, a symbol) or a *list* — a parenthesized sequence. Code is written as lists. Data is written as lists. They are the same shape, and this is called *homoiconicity*.
- **Scheme is small.** The core language fits on a couple of pages. The R7RS-small standard is 88 pages, most of that reference material. The core has around fifteen special forms.
- **Scheme has first-class functions and proper tail calls.** You can pass a function around like a number. You can recurse forever without blowing the stack, if the recursion is in *tail position*.
- **Scheme has hygienic macros.** These let you extend the language itself. Not "define a new function." Extend the language. That's the superpower.

By the end of this book you'll be able to write recursive functions comfortably, know when to reach for a macro, understand what makes Scheme fast and what makes it slow, and read most Scheme code you encounter without lookup.

Ready? Type `sakura-scheme` at your shell, hit Enter, and let's go.

---

## Chapter 2 — What Scheme Is

There are three families of languages I'll assume you've touched:

- **The C family.** C, C++, Java, C#. Statically typed, curly braces, statements ending in semicolons, mutable state everywhere.
- **The scripting family.** Python, JavaScript, Ruby. Dynamic typing, block-structured, functions as values, garbage-collected.
- **The ML family.** OCaml, Haskell, Rust (partly). Pattern matching, expressive type systems, immutable data by default, algebraic data types.

Scheme sits somewhere near the scripting family — dynamic typing, garbage-collected, functions as values — but with two big differences:

**First: the syntax is parentheses.** In C you write `f(x, y)`. In Python you write `f(x, y)`. In Scheme you write `(f x y)`. The function-name goes *inside* the parens. This looks strange for about a day. Then you stop noticing it. Every text editor with any Lisp support handles the parens for you.

**Second: code is data.** In Python, `[1, 2, 3]` is a list. `def f(x): return x + 1` is a function. Those are two different things. In Scheme, both are lists:

```scheme
'(1 2 3)                                    ;; a list of numbers
'(define (f x) (+ x 1))                     ;; a list that describes a function
```

The single quote says "don't evaluate this — leave it as data." Drop the quote from the second one and Scheme evaluates it: `f` is now a real function. This is the deepest thing about Lisp. Programs are lists. You can generate a program with a program. You can transform a program with a program. That is what a *macro* is.

**Compared to what you know:**

- Where Python has `if x > 0:` with an indented block, Scheme has `(when (> x 0) ...)` with matching parens.
- Where JavaScript has `const f = (x) => x + 1`, Scheme has `(lambda (x) (+ x 1))`.
- Where Ruby has `[1, 2, 3].map { |x| x * 2 }`, Scheme has `(map (lambda (x) (* x 2)) '(1 2 3))`.
- Where you use for-loops or list comprehensions, Scheme uses recursion or higher-order functions.

The whole language is small enough that a careful reader can hold it in their head. That's rare and it's why Scheme is worth learning.

### The thirty-second version

- Every program is a list. Every list is either data or code.
- The first element of a code list is the function or special form; the rest are the arguments.
- `'` in front means "data, don't evaluate."
- Function bodies are expressions, not statements. Everything returns a value.
- Names bind to values via `define`. Local bindings via `let`.

If that's clicking, you're ready for Chapter 3.

---

## Chapter 3 — Install and First REPL

Two paths. Either one works.

### The one-line install

```
curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
```

That drops a `sakura-scheme` command onto your PATH. It requires Node 18+ and `git`. It doesn't touch `/usr/local`; it puts a small tree under `~/.scheme-lang` and adds one shim.

### Clone and run

```
git clone https://github.com/Lacuna-Labs/scheme-lang
cd scheme-lang
./bin/sakura-scheme
```

Handy if you want to read the source. Everything under `src/` is plain Node — no build step, no transpile, no bundler. The source you read is the source that runs.

### First REPL

```
sakura>
```

Type an expression, hit Enter, see the answer.

```scheme
sakura> (+ 1 2)
3

sakura> (* 21 2)
42
```

That's your first Scheme program. `+` is a function; `1` and `2` are its arguments; `(+ 1 2)` is the whole expression.

Now define something:

```scheme
sakura> (define greeting "hello")
sakura> greeting
"hello"
```

The first line binds the name `greeting` to the string `"hello"`. The second line evaluates the name and prints its value.

Now a function:

```scheme
sakura> (define (square x) (* x x))
sakura> (square 12)
144
```

`define` with a parenthesized first argument creates a function. `(square x)` says "the function's name is `square` and it takes one parameter, `x`." The body is `(* x x)`.

Try higher-order:

```scheme
sakura> (map square '(1 2 3 4 5))
(1 4 9 16 25)
```

`map` takes a function and a list, and applies the function to each element. Same as Python's `list(map(f, xs))` or JavaScript's `xs.map(f)`.

When you're done for now: `,exit` or press Ctrl-D. She'll say `goodnight ✿`.

### The exploration crew

Meta-commands start with a comma. A short list you'll use often:

```
,help                       list every command
,help map                   arity, doc, examples for map
,doc car                    just the doc string
,arity fold                 just the arity
,examples reduce            three tiered examples
,namespace list             every verb whose name starts with 'list'
,apropos square             symbols whose name matches 'square'
,time (map square '(1 2 3 4 5))
                            wall time + fuel + memory
,expand (let ((x 1)) (+ x 2))
                            macroexpand
```

`,help <verb>` is your best friend. Any time this book mentions a verb, you can dig into it with `,help`.

Now onward.

---

## Chapter 4 — Values

Every value in Scheme belongs to a *type*. There are no compile-time type declarations; you just make values and use them. Types are checked at runtime and errors come with real messages.

The types you'll meet in the first hour:

### Numbers

Scheme has one number type from your perspective — call it "number" — that covers integers and floats. Arithmetic just works.

```scheme
sakura> (+ 3 4)
7

sakura> (* 3.14 2)
6.28

sakura> (- 10 3)
7

sakura> (/ 10 3)
3.3333333333333335
```

`quotient` gives integer division; `remainder` and `modulo` give what you'd expect:

```scheme
sakura> (quotient 10 3)
3
sakura> (remainder 10 3)
1
sakura> (modulo -1 4)
3
```

`modulo` always returns a non-negative result when the divisor is positive; `remainder` follows the dividend's sign. The distinction matters exactly when your inputs are negative.

Predicates: `zero?`, `positive?`, `negative?`, `even?`, `odd?`, `number?`.

```scheme
sakura> (zero? 0)
#t
sakura> (even? 6)
#t
sakura> (number? "hello")
#f
```

`#t` and `#f` are true and false. Everything except `#f` counts as true in a boolean position, which matters for `if` and `and`/`or`.

Math functions: `abs`, `sqrt`, `expt`, `sin`, `cos`, `tan`, `atan2`, `floor`, `ceiling`, `round`, `min`, `max`. All present, all first-class values you can pass around.

```scheme
sakura> (sqrt 16)
4
sakura> (expt 2 10)
1024
sakura> (min 3 1 4 1 5 9 2 6)
1
```

### Strings

Double-quoted, standard escapes work (`\n`, `\t`, `\"`, `\\`).

```scheme
sakura> "hello"
"hello"
sakura> (string-length "scheme")
6
sakura> (string-append "hello" " " "world")
"hello world"
sakura> (substring "hello world" 6 11)
"world"
sakura> (string->number "42")
42
sakura> (number->string 3.14)
"3.14"
```

Notable string verbs: `string-length`, `string-append`, `substring`, `string-ref`, `string-split`, `string-join`, `string->list`, `list->string`, `string->number`, `number->string`, `string->symbol`, `symbol->string`, `title-case`, `camel-case`, `pascal-case`.

### Symbols

Symbols look like variable names, but they're *values* — atoms with an identity. Think of them as internal enums or as keys.

```scheme
sakura> 'hello
hello
sakura> (symbol? 'hello)
#t
sakura> (symbol->string 'hello)
"hello"
sakura> (eq? 'red 'red)
#t
```

You'll see symbols used everywhere for keys in association lists, discriminators in `case`, and tags in tagged data. Anywhere Python would use a string as an enum-like value, Scheme uses a symbol.

The quote is essential. `hello` (no quote) would try to look up a variable named `hello`; `'hello` is the symbol itself.

### Booleans

`#t` and `#f`. That's it. Everything else counts as true in a boolean position — including `0`, the empty string, and the empty list.

```scheme
sakura> (if 0 'yes 'no)
yes
sakura> (if "" 'yes 'no)
yes
sakura> (if '() 'yes 'no)
yes
sakura> (if #f 'yes 'no)
no
```

This surprises Python programmers (where `0`, `""`, `[]`, `None` are all falsy) and JavaScript programmers (where `0`, `""`, `null`, `undefined`, `NaN` are all falsy). Only `#f` is false in Scheme. It's simpler once you get used to it.

### Lists

Lists are the workhorse. Written with parentheses; the empty list is `'()`.

```scheme
sakura> '(1 2 3 4)
(1 2 3 4)
sakura> (list 1 2 3 4)
(1 2 3 4)
sakura> (length '(a b c))
3
sakura> (car '(1 2 3))
1
sakura> (cdr '(1 2 3))
(2 3)
sakura> (cons 0 '(1 2 3))
(0 1 2 3)
```

`car` is the head (first element). `cdr` is the tail (everything after the first element). `cons` builds a new list by prepending. Those three verbs and their compositions (`cadr` = "car of cdr" = second, `caddr` = "car of cdr of cdr" = third) are the classical Lisp primitives.

We'll spend all of Chapter 7 on lists.

### Hash tables

For key-value maps. Created empty, mutated in place.

```scheme
sakura> (define person (make-hash))
sakura> (hash-set! person 'name "Alfred")
sakura> (hash-set! person 'age 32)
sakura> (hash-ref person 'name)
"Alfred"
sakura> (hash-keys person)
(name age)
```

The `!` at the end of `hash-set!` is a Scheme convention: functions that mutate their arguments end in `!`. Functions that don't mutate anything (like `car`, `cdr`, `map`) don't have it.

### Characters

Single characters, written `#\a`, `#\space`, `#\newline`.

```scheme
sakura> (string-ref "hello" 0)
#\h
sakura> (char->integer #\A)
65
```

You'll use these less often than the other types. They matter when you're pulling strings apart character by character.

### The type test

Every type has a predicate that answers "are you one of these?":

```
number?    string?    symbol?    boolean?
char?      pair?      null?      list?
procedure? hash?
```

`pair?` is subtly different from `list?`: a pair is any two-element cons cell; a list is a properly-terminated chain of pairs. In practice you'll reach for `null?` (empty list?) and `pair?` (non-empty?) more than `list?`.

That's the value set. Now the special forms that let you name things and choose paths.

---

## Chapter 5 — Special Forms

Most things in Scheme are functions: they evaluate all their arguments, then apply an operation. A handful of things are *special forms*: they don't evaluate all their arguments the usual way. Understanding which ones and why is a big part of learning the language.

The complete list of special forms in scheme-lang:

```
quote  if  define  set!  lambda  begin
let  let*  letrec  cond  case
when  unless  and  or  quasiquote
define-syntax  syntax-rules
```

Fifteen forms. That's the whole language's grammar. Everything else is a function.

### `define` — bind a name

```scheme
(define name value)                         ;; bind name to value
(define (name arg1 arg2 ...) body ...)      ;; bind name to a function
```

Two shapes, same idea:

```scheme
sakura> (define pi 3.14159)
sakura> pi
3.14159

sakura> (define (double x) (* 2 x))
sakura> (double 21)
42
```

The second shape is sugar for `(define double (lambda (x) (* 2 x)))`. Same result either way.

### `set!` — mutate an existing binding

```scheme
sakura> (define counter 0)
sakura> (set! counter (+ counter 1))
sakura> counter
1
```

Two rules:
1. The name must already exist. `set!` mutates, it doesn't create.
2. Convention: `set!` is uncommon in idiomatic Scheme. Most programs pass values through, rather than mutating state. When you do reach for `set!`, ask if there's a purer shape available.

### `if` — two-arm conditional

```scheme
(if test then-branch else-branch)
```

`test` is evaluated. If it's not `#f`, `then-branch` is evaluated; otherwise `else-branch`.

```scheme
sakura> (if (> 3 2) 'bigger 'smaller)
bigger
sakura> (if (< 3 2) 'never 'yes)
yes
```

`if` is a special form because only *one* of the two branches runs. If both ran, you couldn't write recursion — `(if base-case answer (recurse ...))` would always recurse.

### `cond` — multi-arm conditional

For more than two branches, `cond` reads better:

```scheme
(cond
  (test1 result1)
  (test2 result2)
  ...
  (else result-else))
```

Each clause is checked in order. The first `test` that isn't `#f` wins; that clause's body runs, and cond returns the result.

```scheme
sakura> (define (sign n)
          (cond
            ((positive? n) 'positive)
            ((negative? n) 'negative)
            (else 'zero)))

sakura> (sign 5)
positive
sakura> (sign -3)
negative
sakura> (sign 0)
zero
```

Prefer `cond` when you have three or more branches. It reads better than nested `if`s.

### `when` and `unless` — single-arm conditionals

`when` runs a body if the test is true; `unless` runs a body if the test is false. Both return `undefined` in the other case. Use when the "false" branch is genuinely a no-op:

```scheme
sakura> (when (> 3 2) (display "yes") (newline))
yes

sakura> (unless (= 1 2) (display "different") (newline))
different
```

### `case` — dispatch on a value

`case` compares one value against a list of literal values in each clause. Faster to read than a long `cond` when your branches all test equality of the same thing.

```scheme
sakura> (define (color-hex c)
          (case c
            ((red)   "#ff0000")
            ((green) "#00ff00")
            ((blue)  "#0000ff")
            (else    "#000000")))

sakura> (color-hex 'red)
"#ff0000"
sakura> (color-hex 'purple)
"#000000"
```

Each clause's first element is a list of literal candidates. Symbols are the typical case-key.

### `and`, `or` — short-circuit logic

`and` returns `#f` at the first false expression; otherwise the last truthy value. `or` returns the first truthy value; otherwise `#f`. Both short-circuit.

```scheme
sakura> (and (> 3 2) (< 5 10) 'winner)
winner
sakura> (and #t #f 'never)
#f

sakura> (or #f #f 'found)
found
sakura> (or #f 0 'first-truthy)
0
```

That last one is a classic Lisp idiom: `(or maybe-value default)` gives you a fallback.

### `let` — local bindings

Local variables live inside a `let` form:

```scheme
(let ((name1 expr1)
      (name2 expr2)
      ...)
  body ...)
```

Each name is bound to the value of its expression; then the body runs with those bindings visible.

```scheme
sakura> (let ((x 3)
              (y 4))
          (+ (* x x) (* y y)))
25
```

Pythagoras.

An important detail: in `let`, the right-hand-side expressions are evaluated in the *outer* environment. `x` and `y` cannot see each other. If you want sequential binding — each new one able to see the previous — use `let*`:

```scheme
sakura> (let* ((x 3)
               (y (* x x)))
          (+ x y))
12
```

`let*` is like `let` but reads bindings left-to-right, one at a time.

`letrec` is a third variant for defining locally-visible recursive functions. Use it when a helper function needs to call itself inside a `let`.

```scheme
sakura> (letrec ((even? (lambda (n) (if (= n 0) #t (odd? (- n 1)))))
                 (odd?  (lambda (n) (if (= n 0) #f (even? (- n 1))))))
          (even? 10))
#t
```

`even?` and `odd?` both call the other; `letrec` makes them mutually visible.

### `begin` — sequential composition

`begin` runs a series of expressions in order and returns the value of the last one. You need it when you want side effects (like `display`) between a bunch of expressions.

```scheme
sakura> (begin
          (display "hello")
          (newline)
          (display "world")
          (newline)
          42)
hello
world
42
```

Inside `when`, `unless`, `cond`'s clause bodies, and function bodies, the body is *already* a `begin` — you don't need to write it explicitly. You'll mostly see `begin` in the arms of `if`, where each arm can only be one expression.

### `lambda` — anonymous functions

```scheme
(lambda (arg1 arg2 ...) body ...)
```

A `lambda` expression evaluates to a *function value*. You can call it immediately, pass it around, store it in a variable.

```scheme
sakura> ((lambda (x y) (* x y)) 6 7)
42

sakura> (define multiply (lambda (x y) (* x y)))
sakura> (multiply 6 7)
42

sakura> (map (lambda (n) (* n n)) '(1 2 3 4 5))
(1 4 9 16 25)
```

`lambda` is the workhorse. Anytime you'd write `x => x * x` in JavaScript or `lambda x: x * x` in Python, you write `(lambda (x) (* x x))` here.

### `quote` and `quasiquote`

We've been using `'` all along. It's shorthand for `(quote ...)`:

```scheme
sakura> 'hello
hello
sakura> (quote hello)
hello
sakura> '(1 2 3)
(1 2 3)
sakura> (quote (1 2 3))
(1 2 3)
```

`quote` says "don't evaluate this — leave it as data."

`quasiquote` is like quote but with holes: `,` inserts an evaluated expression back into the quoted structure.

```scheme
sakura> (define x 42)
sakura> `(a b ,x c)
(a b 42 c)
sakura> `(pi is about ,pi)
(pi is about 3.14159)
```

The backtick is `quasiquote`; the comma is `unquote`. This is the shape you use inside `syntax-rules` macros (Chapter 10) to build up new code. In everyday programming, quasiquote lets you construct data with named holes rather than piecing it together with `list` and `cons`.

### Why they're special

All of the above forms have one thing in common: they don't evaluate their arguments the way a function would. `if` evaluates only one branch. `and` and `or` short-circuit. `quote` doesn't evaluate its argument at all. `lambda` makes a new function without evaluating its body until called. `define` binds a name without evaluating the *name* (only the value).

Functions can't do any of that. If `if` were a function, both branches would be evaluated before it was even called — and infinite recursion would blow up on the very first call. That's why these fifteen forms are baked in.

The complete list, one more time: `quote if define set! lambda begin let let* letrec cond case when unless and or quasiquote define-syntax syntax-rules`.

Chapters 6 through 10 will use them constantly. If you've kept up to here, you have the whole grammar in your head.

---

## Chapter 6 — Functions

Functions are the ordinary tool in Scheme. Everything nontrivial you write will be a function.

### The basics

Two ways to make one:

```scheme
;; the short form
(define (add-one x) (+ x 1))

;; the long form
(define add-one (lambda (x) (+ x 1)))
```

They're the same. The short form is sugar for the long form. Both bind `add-one` to a function value that takes one argument.

Call a function by putting it at the head of a list:

```scheme
sakura> (add-one 41)
42
```

Multi-argument:

```scheme
sakura> (define (sum-of-squares x y)
          (+ (* x x) (* y y)))
sakura> (sum-of-squares 3 4)
25
```

Variadic (accepting any number of arguments) — put a dotted parameter at the end:

```scheme
sakura> (define (average . nums)
          (/ (apply + nums) (length nums)))
sakura> (average 1 2 3 4 5)
3
```

The `.` in the parameter list says "put every remaining argument into a list called `nums`." Inside, `nums` is a list.

### First-class functions

A function is a value. You can:

Pass a function to another function:

```scheme
sakura> (define (apply-twice f x) (f (f x)))
sakura> (apply-twice add-one 5)
7
sakura> (apply-twice (lambda (n) (* n 2)) 3)
12
```

Return a function from a function:

```scheme
sakura> (define (make-adder n)
          (lambda (x) (+ x n)))

sakura> (define add-10 (make-adder 10))
sakura> (add-10 5)
15

sakura> ((make-adder 100) 7)
107
```

Store a function in a data structure:

```scheme
sakura> (define ops (list + - * /))
sakura> ((car ops) 3 4)                     ;; add
7
sakura> ((cadr ops) 10 3)                   ;; subtract
7
```

### Closures

A function that captures variables from its enclosing scope is called a *closure*. This is what `make-adder` above is doing: the returned function captures `n` from the surrounding `let` / parameter binding.

The classic example:

```scheme
sakura> (define (make-counter)
          (let ((n 0))
            (lambda ()
              (set! n (+ n 1))
              n)))

sakura> (define c (make-counter))
sakura> (c)                                 ;; ⇒ 1
1
sakura> (c)                                 ;; ⇒ 2
2
sakura> (c)                                 ;; ⇒ 3
3
```

The lambda captures `n`. Every call mutates the captured binding. `c` "remembers" between calls even though `n` isn't visible from outside.

Two counters don't share state:

```scheme
sakura> (define c1 (make-counter))
sakura> (define c2 (make-counter))
sakura> (c1)
1
sakura> (c1)
2
sakura> (c2)                                ;; c2 has its own n
1
```

Closures are the substrate objects are built on in most OOP languages. In Scheme they're the raw thing.

### Higher-order patterns

You've already seen `map`. Its family:

```scheme
;; map: (map fn list) → new list
(map (lambda (x) (* x x)) '(1 2 3 4))       ;; ⇒ (1 4 9 16)

;; filter: (filter pred list) → new list
(filter odd? '(1 2 3 4 5 6))                ;; ⇒ (1 3 5)

;; fold: (fold fn init list) → single value, left-to-right
(fold + 0 '(1 2 3 4 5))                     ;; ⇒ 15

;; reduce: like fold but seed is the head element
(reduce + '(1 2 3 4 5))                     ;; ⇒ 15

;; for-each: like map, but returns nothing (side effects only)
(for-each display '("a" "b" "c"))           ;; prints abc, returns undefined

;; any: is any element truthy under pred?
(any odd? '(2 4 6 7 8))                     ;; ⇒ #t

;; every: are all elements truthy under pred?
(every positive? '(1 2 3 4))                ;; ⇒ #t
```

Between these six or seven verbs, you can express most of what a `for`-loop or list comprehension would do in another language. When you find yourself reaching for `for`, ask "could this be `map`? `filter`? `fold`?" Almost always the answer is yes.

### A worked example

Let's compute the sum of the squares of the odd numbers in a list.

**One way:** compose the primitives.

```scheme
(define (sum-of-odd-squares xs)
  (fold + 0
    (map (lambda (x) (* x x))
      (filter odd? xs))))

(sum-of-odd-squares '(1 2 3 4 5))           ;; ⇒ 1 + 9 + 25 = 35
```

Read from inside out: filter to odd, square each, sum. Three passes over the data, three familiar shapes.

**Another way:** a single recursion.

```scheme
(define (sum-of-odd-squares xs)
  (cond
    ((null? xs) 0)
    ((odd? (car xs))
     (+ (* (car xs) (car xs))
        (sum-of-odd-squares (cdr xs))))
    (else (sum-of-odd-squares (cdr xs)))))
```

One pass, more custom. Slightly faster; less obvious what it does at a glance. In practice you'd write the first version unless profiling said otherwise.

Higher-order composition is Scheme's default; explicit recursion is a step down when you need control. Both are cheap to write, and both are readable to a Scheme audience.

### Currying, sort of

Some languages let you partially apply a function — give `+` its first argument and get back a function waiting for the second. Scheme doesn't do this automatically, but you can build it explicitly:

```scheme
(define (curry f x)
  (lambda (y) (f x y)))

(define add-5 (curry + 5))
(add-5 10)                                  ;; ⇒ 15
```

Most Scheme code just uses `lambda` at the call site. It's more explicit, one extra character, and you keep the option to compute the outer argument.

---

## Chapter 7 — Lists

Lists are the workhorse data structure. Once you're comfortable with `car`, `cdr`, `cons`, `map`, and `filter`, you can build almost anything.

### How lists are made

A list is a chain of cons cells. Each cons cell is a *pair* — two slots, a head and a tail. `cons` builds one:

```scheme
sakura> (cons 1 '())
(1)
sakura> (cons 1 (cons 2 '()))
(1 2)
sakura> (cons 1 (cons 2 (cons 3 '())))
(1 2 3)
```

The empty list `'()` is the base. Every list is a chain of pairs ending in `'()`. Textually, a list `(1 2 3)` is exactly this chain.

Alternatives:

```scheme
sakura> (list 1 2 3)                        ;; the function form
(1 2 3)
sakura> '(1 2 3)                            ;; the literal form
(1 2 3)
```

Prefer `'(...)` for literal data; use `(list ...)` when the elements need to be computed.

### The classical accessors

```scheme
sakura> (car '(a b c d))                    ;; head
a
sakura> (cdr '(a b c d))                    ;; tail
(b c d)
```

For nested access, Scheme has a family of compound accessors:

```scheme
(cadr xs)       ;; (car (cdr xs)) → 2nd element
(caddr xs)      ;; (car (cdr (cdr xs))) → 3rd
(cddr xs)       ;; (cdr (cdr xs)) → tail from 3rd element
(cadddr xs)     ;; 4th element
```

They compose from `c` + a chain of `a`/`d` + `r`. `a` for `car`, `d` for `cdr`. Read them right to left.

The friendlier alternatives — same idea, better names — are `first`, `second`, `third`, `last`, `nth`:

```scheme
sakura> (first '(a b c d))
a
sakura> (second '(a b c d))
b
sakura> (last '(a b c d))
d
sakura> (nth 2 '(a b c d))                  ;; zero-indexed
c
```

### The core operations

```scheme
sakura> (length '(a b c d))
4

sakura> (reverse '(1 2 3))
(3 2 1)

sakura> (append '(a b) '(c d) '(e))
(a b c d e)

sakura> (take '(1 2 3 4 5) 3)
(1 2 3)

sakura> (drop '(1 2 3 4 5) 3)
(4 5)

sakura> (list-ref '(a b c d) 2)             ;; zero-indexed
c
```

`length` is O(n); `reverse` is O(n); `append` is O(n) in the length of the first list. For most work these performances are fine.

### Building lists

Two idiomatic patterns:

**Prepend then reverse.** Grow the list at the head (which is O(1)) and reverse at the end.

```scheme
(define (numbers-1-to n)
  (let loop ((i n) (acc '()))
    (if (= i 0)
        acc
        (loop (- i 1) (cons i acc)))))

(numbers-1-to 5)                            ;; ⇒ (1 2 3 4 5)
```

**Recursion with cons.** Build the answer as you unwind the recursion.

```scheme
(define (numbers-1-to n)
  (define (helper i)
    (if (> i n) '() (cons i (helper (+ i 1)))))
  (helper 1))

(numbers-1-to 5)                            ;; ⇒ (1 2 3 4 5)
```

The first version is tail-recursive and won't blow the stack. The second is prettier for small lists and turns into stack frames one per element. When it matters, prefer prepend-then-reverse.

### Association lists

An association list is a list of pairs, used as a lightweight dictionary. Each pair is `(key value)` or `(key . value)`.

```scheme
sakura> (define person '((name "Alfred") (age 32) (city "Brooklyn")))

sakura> (assoc 'age person)
(age 32)

sakura> (cadr (assoc 'age person))          ;; extract the value
32
```

`assoc` returns the whole pair; `#f` if not found. `member` does the same for plain lists:

```scheme
sakura> (member 'c '(a b c d))
(c d)
sakura> (member 'z '(a b c d))
#f
```

For anything past a couple dozen entries, use a hash table. But for small structured records, association lists are quick and readable.

### Composition

Nothing about lists is exotic. They're just chains of pairs. But because Scheme's syntax is *also* chains of pairs, the same operations that manipulate data manipulate code:

```scheme
sakura> '(+ 1 2)                            ;; a piece of source, as data
(+ 1 2)
sakura> (car '(+ 1 2))
+
sakura> (cdr '(+ 1 2))
(1 2)
```

That's the seed of macros. We'll return to it in Chapter 10.

---

## Chapter 8 — Recursion and Tail Calls

Scheme's default control structure is recursion. `while` and `for` exist as macros in some Schemes, but idiomatic code uses recursion — and Scheme's implementation makes that safe.

### Simple recursion

Factorial is the classical example:

```scheme
(define (fact n)
  (if (< n 2)
      1
      (* n (fact (- n 1)))))

(fact 5)                                    ;; ⇒ 120
(fact 10)                                   ;; ⇒ 3628800
```

Read it: if `n` is 0 or 1, return 1. Otherwise, `n * fact(n-1)`.

This works but has a subtle problem. Each call frames the multiplication and *then* recurses. The stack grows with `n`. `(fact 100000)` would blow the stack in most languages.

### Proper tail calls

A tail call is a call in a position where the function is about to return. When a call is in tail position, Scheme reuses the current frame instead of pushing a new one. The result: recursion doesn't consume stack.

Rewrite factorial to be tail-recursive:

```scheme
(define (fact n)
  (define (loop i acc)
    (if (< i 2) acc (loop (- i 1) (* acc i))))
  (loop n 1))

(fact 100000)                               ;; works, doesn't crash
```

The trick is the *accumulator*. We carry a running product `acc` and update it as we go. When the recursion returns, it just returns `acc` — no pending work to do — so the recursive call is in tail position.

This isn't a compiler trick you have to hint at. It's guaranteed by the language spec. Every proper Scheme implementation does this.

### The `let loop` idiom

The pattern of "define a helper, call it once" is so common that Scheme has a shorthand: *named let*. Same shape, less indentation.

```scheme
(define (fact n)
  (let loop ((i n) (acc 1))
    (if (< i 2) acc (loop (- i 1) (* acc i)))))
```

`let loop ((i n) (acc 1))` defines a local recursive function called `loop`, gives it two parameters `i` and `acc`, and calls it immediately with initial values. It reads like a `for`-loop wearing a Lisp costume. You'll see it everywhere.

### More examples

**Fibonacci:**

```scheme
;; naive — exponential time; don't try n > 30
(define (fib n)
  (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))

;; tail-recursive — linear time
(define (fib n)
  (let loop ((i 0) (a 0) (b 1))
    (if (= i n) a (loop (+ i 1) b (+ a b)))))

(fib 30)                                    ;; ⇒ 832040
(fib 100)                                   ;; works
```

**List sum:**

```scheme
;; the natural shape
(define (sum-list xs)
  (if (null? xs) 0 (+ (car xs) (sum-list (cdr xs)))))

;; tail-recursive
(define (sum-list xs)
  (let loop ((xs xs) (acc 0))
    (if (null? xs) acc (loop (cdr xs) (+ acc (car xs))))))
```

**Tree traversal (a tree is a list of atoms and sub-lists):**

```scheme
(define (leaves tree)
  (cond
    ((null? tree) '())
    ((pair? tree)
     (append (leaves (car tree)) (leaves (cdr tree))))
    (else (list tree))))

(leaves '(1 (2 (3 4)) 5 ((6)) 7))           ;; ⇒ (1 2 3 4 5 6 7)
```

This one isn't tail-recursive — it has two recursive calls per branch, and both are inside `append`. That's fine for reasonable-size trees. For arbitrarily-deep ones, you'd rewrite with an explicit stack — but at the point where that matters, you're deep into a particular problem.

### When to reach for iteration instead

Scheme has `do` in some implementations, but scheme-lang leans on named `let` for iteration. If you find yourself with a naturally-imperative loop, use `let loop`:

```scheme
;; sum 1..100
(let loop ((i 1) (acc 0))
  (if (> i 100)
      acc
      (loop (+ i 1) (+ acc i))))
;; ⇒ 5050
```

That's `for i = 1 to 100: acc += i` written the Scheme way. Same idea, one form to remember.

### The mental shift

The hardest thing about learning Scheme, if you're coming from a `for`-loop culture, is trusting recursion. It feels expensive. It isn't — proper tail calls make it not just correct but efficient.

The reward is that most algorithms read more directly. "The sum of a list is the head plus the sum of the rest" is a mathematical statement; the Scheme is a translation of it. In an imperative language you spend a lot of energy translating mathematical statements into loops with accumulator variables. In Scheme you write closer to the statement.

---

## Chapter 9 — Destructuring and Simple Pattern Matching

You've seen `car` and `cdr` for pulling lists apart. For more elaborate shapes, Scheme leans on named accessors, association lists, and hash tables.

### Explicit accessors

The most common pattern — pull the fields you want with `car`, `cadr`, `caddr`:

```scheme
(define (point-sum p)
  (let ((x (car p))
        (y (cadr p)))
    (+ x y)))

(point-sum '(3 4))                          ;; ⇒ 7
```

Or `first`, `second`, `third`:

```scheme
(define (point-sum p)
  (let ((x (first p))
        (y (second p)))
    (+ x y)))
```

For key-value data, `assoc` or `hash-ref`:

```scheme
(define (person-summary p)
  (let ((name (cadr (assoc 'name p)))
        (age  (cadr (assoc 'age  p))))
    (string-append name " is " (number->string age))))

(person-summary '((name "Ada") (age 36)))
;; ⇒ "Ada is 36"
```

### Multi-value returns via lists

Scheme doesn't have Python's tuple unpacking — `x, y = f()` — as a core feature. You return multiple values by returning a list and destructure by hand:

```scheme
(define (divmod a b)
  (list (quotient a b) (remainder a b)))

(let ((result (divmod 17 5)))
  (let ((q (first result))
        (r (second result)))
    (display "quotient: ") (display q) (newline)
    (display "remainder: ") (display r) (newline)))
```

If you find yourself doing this often, a small `match`-style macro will save keystrokes. Scheme lets you build that macro in a chapter or two of `syntax-rules` (see Chapter 10). Most codebases pick a shape and stick with it.

### A tiny cond-based pattern matcher

For discriminated unions — a value that could be one of a few shapes — `cond` plus predicates gives you a pretty good pattern matcher:

```scheme
(define (describe x)
  (cond
    ((null? x)                          "empty")
    ((number? x)                        "a number")
    ((and (pair? x) (eq? (car x) 'point))
     (string-append "a 2D point at "
                    (number->string (cadr x))
                    ", "
                    (number->string (caddr x))))
    (else                               "something else")))

(describe '())                              ;; ⇒ "empty"
(describe 42)                               ;; ⇒ "a number"
(describe '(point 3 4))                     ;; ⇒ "a 2D point at 3, 4"
```

This reads like `match` in an ML language, once you know the vocabulary. The trade is: you write the tests explicitly. The gain: you have complete control, no gotchas, and the same shape works everywhere.

### Where destructuring lives in Scheme

Bigger Schemes ship a `match` macro that does what you'd want. scheme-lang's base doesn't (yet). When it lands, it will use the same `syntax-rules` machinery you'll learn about in the next chapter. Meanwhile, `first`/`second`/`assoc`/`hash-ref` cover most cases.

If you're translating from a language where destructuring is everywhere (Clojure, Erlang, Rust), the adjustment is small. You'll write a few extra `let` clauses; you'll also find your programs are more explicit about which fields they read, which is often a virtue.

---

## Chapter 10 — Macros

This is the chapter Scheme is famous for.

A macro is a piece of code that transforms other code. In Scheme, macros run at *expansion time* — before the interpreter evaluates anything. You write a rule that says "wherever you see this shape, rewrite it into that shape," and the compiler does the rewriting once, up front.

Because Scheme code *is* Scheme data (parenthesized lists of symbols and other atoms), a macro is just a function from lists to lists. That's the whole idea. The details are in how you write the rules cleanly and how the compiler keeps names from getting tangled up.

### The problem macros solve

Suppose you find yourself writing this over and over:

```scheme
(if (some-test)
    (begin
      (log "check passed")
      (do-thing))
    (log "check failed"))
```

You'd like a shorthand like `(check some-test do-thing)`. In a language without macros you can't have it — the test has to be evaluated only when the check runs, so a function won't work; a function evaluates its arguments before the body runs.

A macro can:

```scheme
(define-syntax check
  (syntax-rules ()
    ((_ test body)
     (if test
         (begin (log "check passed") body)
         (log "check failed")))))

(check (> 3 2) (do-thing))
```

The macro rewrites `(check (> 3 2) (do-thing))` into the `if` shape at expansion time. By the time the interpreter sees it, it's ordinary Scheme.

### `syntax-rules` — pattern-based macros

The most common macro form. You give a set of patterns and templates; the compiler matches your call against the patterns and rewrites according to the template.

```scheme
(define-syntax name
  (syntax-rules (literal-keywords...)
    ((pattern1) template1)
    ((pattern2) template2)
    ...))
```

The simplest useful macro — a `when` for languages that don't have one built in:

```scheme
(define-syntax my-when
  (syntax-rules ()
    ((_ test body ...)
     (if test (begin body ...) #f))))

(my-when (> 3 2)
  (display "yes")
  (newline))
```

Read the pattern `(_ test body ...)`:
- `_` is a placeholder for the macro's own name (we don't need it in the template)
- `test` is any single expression
- `body ...` is any number of expressions

The template `(if test (begin body ...) #f)` uses those pattern variables to build the rewrite.

The trailing `...` — three dots — is called an *ellipsis*. It matches zero or more of whatever precedes it, and inside the template it expands them all.

### A more useful example: `swap!`

Swap the values of two variables — you can't write this as a function (a function receives values, not variable names):

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
x                                           ;; ⇒ 2
y                                           ;; ⇒ 1
```

The macro expands `(swap! x y)` at compile time into the `let`/`set!`/`set!` sequence. `x` and `y` become the actual variable names inside the rewrite.

### A control-structure macro: `while`

Scheme doesn't have `while` as a special form. Add one:

```scheme
(define-syntax while
  (syntax-rules ()
    ((_ test body ...)
     (let loop ()
       (when test
         body ...
         (loop))))))

(define i 0)
(while (< i 5)
  (display i)
  (set! i (+ i 1)))
;; prints 01234
```

You just extended the language. Not a library. Not a function that pretends to look like a keyword. An actual new syntactic form that participates in Scheme's evaluation rules.

### Hygiene

Notice `swap!` used a helper variable called `tmp` inside the template. What if you called `(swap! tmp foo)`? In a naive macro system, the `tmp` inside the template would collide with your `tmp` and things would break.

Scheme's `syntax-rules` is *hygienic*: it renames temporary bindings automatically so they can't collide with names in the calling code. You don't have to think about it. Write the template as if you named the variables freely; the compiler adjusts.

This is a big deal historically. Lisp macros before Scheme (and macros in many other languages today) require you to manually generate unique names to avoid capture. Hygienic macros make the safe path the default one.

### `define-macro` — the classic style

scheme-lang also supports the older, non-hygienic `define-macro` style — you get more power (arbitrary Scheme code, not just a pattern-and-template) at the cost of thinking about name capture yourself. Most macros should be `syntax-rules`. Reach for `define-macro` when you need to compute the rewrite in a way patterns can't express.

### When to write a macro

Not often. When you find yourself writing the same *shape* over and over — with actual expressions in a couple of holes — a macro is the tool. When you find yourself passing arguments to a function, a function is the tool.

Some good macro use cases:
- New control structures (`when`, `unless`, `while`, `do-times`, `each`)
- Binding forms with special evaluation rules (`with-open-file`, `with-time`)
- Domain-specific mini-languages inside your program (a route definition, a state-machine transition table, a testing DSL)
- Compile-time optimization (partial evaluation, dead-code removal)

Some bad macro use cases:
- Anything a function can do — always prefer a function
- "Save a couple of keystrokes" — a function is cheaper
- Redefining core forms — leave `if` and `let` alone

### Reading `,expand`

The REPL will show you what a macro expands to:

```
sakura> (define-syntax square-first
  (syntax-rules ()
    ((_ xs) (car (map (lambda (x) (* x x)) xs)))))

sakura> ,expand (square-first '(3 4 5))
(car (map (lambda (x) (* x x)) '(3 4 5)))
```

That's exactly what the interpreter will see. Any time you're unsure what a macro does, `,expand` is the answer.

Macros are Scheme's superpower. Even if you don't reach for them often, they're what makes big Scheme programs feel small. When a library adds a `define-record` or a `for-each-line` or a `with-mutex`, that's a macro. You don't have to be a language designer to write them — you just have to know the language you already have.

---

## Chapter 11 — Modules and Imports

scheme-lang keeps a simple module story: one file, one namespace, all definitions visible to any other file that loads it. There's no separate `module` form to declare, no `export` list, no `import` at the top of every file. If a name is defined, it's in scope; if it isn't, it isn't.

### Files

Save this as `mymath.scm`:

```scheme
;; mymath.scm — a few small helpers

(define (square x) (* x x))
(define (cube x) (* x x x))
(define (average . xs) (/ (apply + xs) (length xs)))
```

Load it from the REPL:

```
sakura> ,load mymath.scm
loaded 3 definitions
sakura> (square 5)
25
sakura> (average 3 4 5)
4
```

Or run it as a program:

```
sakura-scheme run mymath.scm
```

### Organizing bigger programs

A rule of thumb: one topic per file. `mymath.scm`, `strings.scm`, `parser.scm`. Files load top-to-bottom, and later files can reference earlier ones (in the same load pass). If you're writing a script that pulls in three helper files, load them explicitly:

```scheme
;; app.scm
;; This will be loaded from the REPL or via `sakura-scheme run app.scm`.
;; We use `,load` from the REPL for interactive sessions, and rely on
;; startup ordering for scripts.

(define (main)
  (display "hello")
  (newline))

(main)
```

The two-file case (`mymath.scm` + `app.scm`) works via REPL:

```
sakura> ,load mymath.scm
sakura> ,load app.scm
```

Or a small shell wrapper concatenates them for a batch run.

### Shebangs

Any `.scm` file can start with a shebang and run like any other script:

```scheme
#!/usr/bin/env sakura-scheme
;; hello.scm — a tiny script.

(display "hello, scheme!")
(newline)
```

Make it executable:

```
chmod +x hello.scm
./hello.scm
```

The interpreter strips the first line if it starts with `#!`. Everything below is regular Scheme.

### Config

scheme-lang looks for `~/.scheme-lang/config.slat` at startup — an optional SLAT file with your preferences. See the README for the fields. You never *need* one; the defaults are sensible.

### Room to grow

A full R7RS module system with `import`, `export`, `library` declarations, and phase-separated compilation is a lot of machinery for a small Scheme. scheme-lang keeps it minimal on purpose. When your programs get large enough that name-collision is a real risk, most of the mitigation comes from good file naming and consistent prefixes (`json:parse`, `json:emit`, `xml:parse`, `xml:emit`). At that scale, a more elaborate module system helps — but you'll be ready for it by then.

---

## Chapter 12 — Errors

Programs fail. Scheme has an `error` primitive that stops execution cleanly.

### Raising an error

```scheme
(define (divide a b)
  (if (zero? b)
      (error "divide: cannot divide by zero" a b)
      (/ a b)))

(divide 10 2)                               ;; ⇒ 5
(divide 10 0)                               ;; error: divide: cannot divide by zero 10 0
```

The first argument to `error` is a message; anything after gets attached as additional context. When an error propagates all the way up, the REPL prints it with the context and returns you to the prompt.

### Contract errors and did-you-mean

Verbs check their arguments and report structured errors when something's wrong:

```
sakura> (car "hello")
sakura-scheme: car: expected pair, got string
```

Some verbs go further: when you mistype a name, the REPL suggests corrections.

```
sakura> (filtr odd? '(1 2 3 4 5))
sakura-scheme: unbound symbol: filtr — did you mean 'filter'?
```

That's part of what makes scheme-lang friendly to explore. You'll type a name wrong at some point; you don't lose your session, you get pointed at the right one.

### When and where to check

A rule of thumb from long practice: check what you can afford to check *when you can afford to check it*. In the shell of your program, at the boundary between the outside world (files, user input, network) and your logic, validate aggressively. Inside your logic, where inputs come from other pieces of your own code, check less — trust the boundaries.

```scheme
(define (parse-age s)
  (let ((n (string->number s)))
    (cond
      ((not n)          (error "parse-age: not a number" s))
      ((< n 0)          (error "parse-age: negative" n))
      ((> n 130)        (error "parse-age: implausibly old" n))
      (else n))))

(parse-age "42")                            ;; ⇒ 42
(parse-age "hello")                         ;; error
```

That's the boundary. Once `parse-age` succeeds, downstream code can trust the result.

### Recovering from errors

At the base level, scheme-lang doesn't ship a `try`/`catch` form. When a program raises `error`, it terminates. This suits scripts and REPL use — you see the failure, fix the cause, run again.

Bigger programs sometimes need to catch and continue (imagine: "this row parsed badly, log it, keep going with the rest"). That story is on the road map, likely via a `guard` form. If your program grows to need it, you can build a workaround with an explicit success/failure record — return `(list 'ok result)` or `(list 'err message)`, and the caller dispatches on the tag:

```scheme
(define (safe-parse s)
  (let ((n (string->number s)))
    (if n (list 'ok n) (list 'err s))))

(let ((r (safe-parse "42")))
  (case (car r)
    ((ok)  (display "got: ") (display (cadr r)))
    ((err) (display "bad: ") (display (cadr r)))))
```

This shape is close to Rust's `Result` or Haskell's `Either`. It's more work to write than exceptions, but it makes the failure path explicit — which is often what you want anyway.

---

## Chapter 13 — Working With Sakura Scheme's Extras

Everything so far has been core Scheme. scheme-lang also ships four higher layers — media (framebuffer + sound + animation), AI (cortex memory), game (entities + physics), and commercial (opt-in). This chapter is a quick tour so you know what's there when you want to reach for it.

### Drawing

```scheme
sakura> (circle 40 40 15)
```

Draws an outlined circle centered at (40, 40) with radius 15. The REPL renders the framebuffer in your terminal — Braille dots if your terminal doesn't do inline images, inline PNG if it does (iTerm2, WezTerm, kitty, Sixel).

Companions:

```scheme
(disc cx cy r)                              ;; filled circle
(line x0 y0 x1 y1)
(rect x y w h)                              ;; outline
(rect-fill x y w h)                         ;; filled
(clear c)                                   ;; wipe to color c (0..15)
(set-color c)                               ;; default draw color
(set-mode w h)                              ;; resize the framebuffer
(set-mode 'pico8)                           ;; 128x128 preset
```

The framebuffer starts at 80×80. `pico8` gives you 128×128, `tic80` gives you 240×136. You can also set custom dimensions.

Colors are palette indices 0–15. The palette borrows from PICO-8's beloved 16-color set:

```
0  black         4  brown          8  red           12 blue
1  dark-blue     5  dark-grey      9  orange        13 lavender
2  dark-purple   6  light-grey     10 yellow        14 pink (petal)
3  dark-green    7  white          11 green         15 peach
```

`(set-color 'petal)` and `(set-color 14)` do the same thing.

### Composing shapes

Because `(circle 40 40 15)` returns a tagged list, you can `map` over lists of shape parameters:

```scheme
(for-each (lambda (n) (circle (* n 12) 40 3))
          '(1 2 3 4 5 6))
```

Six little circles in a row.

### Animation

Register a frame handler with `on-frame`:

```scheme
(define t 0)

(define (frame)
  (clear 0)
  (disc (+ 40 (* 20 (sin (/ t 10)))) 40 5)
  (set! t (+ t 1)))

(on-frame frame)
```

The frame handler runs at 60Hz. Every frame it wipes the buffer, draws a disc at a position that oscillates via `sin`, and increments a global `t`. When you're ready to stop, `,exit` the REPL — it shuts the animation loop down.

If you don't want a mutable global, thread state through the frame:

```scheme
(define state 0)

(define (frame)
  (clear 0)
  (disc (+ 40 (* 20 (sin (/ state 10)))) 40 5)
  (set! state (+ state 1)))

(on-frame frame)
```

Or wrap the state in a closure. The `on-frame` API is deliberately simple — you're responsible for evolving state however you like.

### Sound

`tone` plays a raw sine wave:

```scheme
(tone 440 0.5)                              ;; A4 for half a second
```

`note` takes a named pitch:

```scheme
(note 'A4 0.5)
(note 'C#5 0.25)
```

Chords need multiple `note` calls; sequences are just loops:

```scheme
(for-each (lambda (p) (note p 0.3))
          '(C4 E4 G4 C5))
```

If your terminal has no audio backing, `note` falls back to the terminal bell — you'll hear a click, and see the events on the timeline. In a browser REPL or with the `speaker` npm package installed, you hear the real tone.

### Entities and physics

For small games, the game layer gives you an entity table and basic physics.

```scheme
(entity/make 'ball 40 5 4 4)                ;; id, x, y, w, h
(entity/set-velocity! 'ball 1 0)            ;; give it a small horizontal push
(entity/make 'floor 0 76 80 4)              ;; a floor at the bottom
(entity/pin! 'floor)                        ;; pinned means physics doesn't move it
(entity/tag! 'floor 'ground)

(physics/gravity! 0.5)
(physics/friction! 0.99)
(physics/step)                              ;; advance one frame
(entity/get 'ball)                          ;; ⇒ (id x y vx vy w h)
```

Combining animation and physics gives you a bouncing ball in twenty lines. See `examples/bouncing-ball.scm` in the repo for a complete headless demo.

### Cortex — the memory layer

Cortex is a small key-value store you can write to and read back. In the standalone REPL it's in-memory (goes away on exit). When the Sakura runtime plugs itself in, it becomes real persistent memory.

```scheme
(cortex/remember 'birthday "July 12")
(cortex/recall 'birthday)                   ;; ⇒ "July 12"
(cortex/keys)                               ;; ⇒ (birthday)
(cortex/size)                               ;; ⇒ 1
(cortex/forget 'birthday)
```

Think of it as a place to keep facts across sessions — for a script that runs weekly and needs to remember what it did last week, for example.

### Where to explore next

`,namespace` at the REPL shows every verb whose name starts with a given prefix:

```
sakura> ,namespace entity/
entity/accel!
entity/alive?
entity/bounce!
entity/collides?
entity/count
...
```

`,help <verb>` gives you the full documentation on any one. That's how you go from "I heard there's a thing" to "I know exactly what it does" without leaving the REPL.

The full reference lives at `docs/SAKURA-SCHEME-REFERENCE.slat`. 1,157 verbs. Same source the REPL reads.

---

## Chapter 14 — What's Next

You've gotten through the ramp-up. You know the core language, the important standard library, how to write recursive functions, how to reach for a macro when the moment calls for it. You know where to find the reference and how to explore the extras.

Here's a short guide to where to go next.

**Practice.** The single best thing you can do is write small programs. Not toy problems — actual things you'd use. A script that reads a file and does something with it. A tiny game. A CLI tool. Even a hundred lines of scheme-lang will teach you more than any book.

**SICP.** *Structure and Interpretation of Computer Programs* by Abelson and Sussman is still the best introduction to computer science that exists. It's written in Scheme. It's freely available online. If you enjoyed this book, you'll enjoy SICP an order of magnitude more.

**The Little Schemer.** By Felleisen and Friedman. A small book that teaches recursion via dialogue. Weird, gentle, effective.

**On Lisp.** By Paul Graham. Common Lisp, not Scheme, but the macro chapters are foundational reading for anyone who wants to write real macros.

**The Book of Jesse.** In this same repo, `docs/BOOK-OF-JESSE.md`. If you already program in Fennel, TIC-80, Clojure, or Lua, that book maps your knowledge onto Sakura Scheme. Even if you don't, the animation chapters are worth reading.

**Small Schemes to read.** Chibi Scheme and Chicken Scheme both have compact codebases; reading them will teach you how the language is implemented. scheme-lang itself is under `src/` — a few thousand lines of readable JavaScript. Reader, interpreter, macros, REPL, verb registry. That's the whole thing.

**Bigger Schemes to grow into.** Racket is the most widely-used Scheme today. It has a huge standard library, a good IDE (DrRacket), and a strong pedagogical tradition. If you want to write big programs in Scheme, Racket is where you go.

### Some REPL tricks worth knowing

Fluent REPL use is half the productivity of using this thing.

- `Tab` completes verb names.
- `Ctrl-R` searches your command history.
- `Ctrl-O` opens the current line in `$EDITOR` for anything bigger than a one-liner.
- `,save my.slat` saves your session; `,load my.slat` restores it.
- `,watch-file scratch.scm` reloads a file every time you save it in your editor. Great for iterative development.
- `,trace <fn>` prints every call to `<fn>` with nested indentation. Great for debugging recursion.
- `,inspect <value>` walks any value with arrow keys.
- `,ask sakura` will ask her for help — she reads your session bindings and the last few evaluations, and answers with runnable code you can hit Enter to eval. (Not connected in the base; waiting for her.)

### Closing note

Scheme has been around for fifty years. Its ideas — first-class functions, proper tail calls, hygienic macros, code as data — have made their way into every major language you use today. Learning Scheme won't unlock a job market. It will unlock a way of thinking. Programs get smaller. Abstractions get sharper. The distinction between library and language becomes something you can move.

That's why people who don't get paid to write Scheme still write it.

Somebody gave a shit about writing this book. Someone else is going to give a shit about writing the next one. If you get pretty good at Scheme and use it for something you care about, that's the whole payoff.

Good luck. Come back when you're ready to write your own macros.

— The maintainers

---

## Appendix — Exercises

Twenty exercises. Do them in order; each builds on the last. Solutions follow after the whole set. Try to solve them without peeking — the point of the exercises is to make the ideas stick.

Every one runs in the REPL. Most take under fifteen lines.

### The exercises

**1.** Write a function `(hypotenuse a b)` that returns `sqrt(a² + b²)`.

**2.** Write a function `(min-of xs)` that returns the smallest element of a list. Assume the list is non-empty.

**3.** Write a function `(count-if pred xs)` that returns how many elements of `xs` satisfy `pred`.

**4.** Write a function `(range-list a b)` that returns the list `(a a+1 a+2 ... b-1)`.

**5.** Write a function `(sum-range a b)` that returns the sum of integers from `a` (inclusive) to `b` (exclusive). Use `range-list` and `fold`.

**6.** Write a function `(fact n)` that returns the factorial of `n`. Make it tail-recursive.

**7.** Write a function `(reverse-list xs)` without using the built-in `reverse`. Use the accumulator idiom.

**8.** Write a function `(nth-element n xs)` that returns the nth element of a list. Do it two ways: once as a straightforward recursion, once as a tail-recursive helper.

**9.** Write a function `(flatten xs)` that turns a nested list into a flat list. E.g. `(flatten '(1 (2 (3 4)) 5))` ⇒ `(1 2 3 4 5)`.

**10.** Write a function `(zip xs ys)` that returns a list of pairs. E.g. `(zip '(a b c) '(1 2 3))` ⇒ `((a 1) (b 2) (c 3))`. Assume the lists are the same length.

**11.** Write `(take-while pred xs)` — a list of leading elements of `xs` for which `pred` is true, stopping at the first `#f`.

**12.** Write `(drop-while pred xs)` — everything after `take-while`.

**13.** Write a function `(make-adder n)` that returns a function that adds `n` to its argument. Then write `(compose f g)` that returns a function of `x` computing `(f (g x))`. Verify `((compose (make-adder 1) (make-adder 2)) 10)` returns 13.

**14.** Write a `syntax-rules` macro `(swap! a b)` that swaps the values of two variables. (See Chapter 10 for the shape.)

**15.** Write a `syntax-rules` macro `(unless test body ...)` that runs `body ...` when `test` is `#f`. (Yes, `unless` is built in; write your own.)

**16.** Write a function `(occurrences x xs)` that returns how many times `x` appears in `xs`. Use `fold`.

**17.** Write `(quicksort xs)` — the classic recursive shape. Pick a pivot; partition into less-than and greater-than; recurse.

**18.** Write `(binary-search sorted-xs target)` on a sorted list. Return the index of `target`, or `#f` if not found. (Naïve linear pass is fine; the interesting version uses a vector.)

**19.** Write a function `(mem-fib n)` that returns the nth Fibonacci number, using memoization to make it fast. A hash-table works well.

**20.** Write `(church-encode n)` that returns the Church numeral for `n` — a function of `f` that returns a function of `x` that applies `f` to `x` exactly `n` times. Then write `(church-decode c)` that converts a Church numeral back to an ordinary integer.

### Solutions

**1.**

```scheme
(define (hypotenuse a b)
  (sqrt (+ (* a a) (* b b))))
```

**2.**

```scheme
(define (min-of xs)
  (fold min (car xs) (cdr xs)))
```

**3.**

```scheme
(define (count-if pred xs)
  (fold + 0 (map (lambda (x) (if (pred x) 1 0)) xs)))
```

**4.**

```scheme
(define (range-list a b)
  (if (>= a b)
      '()
      (cons a (range-list (+ a 1) b))))
```

(The built-in `range` does the same thing. Either would score full credit.)

**5.**

```scheme
(define (sum-range a b)
  (fold + 0 (range-list a b)))
```

**6.**

```scheme
(define (fact n)
  (let loop ((i n) (acc 1))
    (if (< i 2) acc (loop (- i 1) (* acc i)))))
```

**7.**

```scheme
(define (reverse-list xs)
  (let loop ((xs xs) (acc '()))
    (if (null? xs)
        acc
        (loop (cdr xs) (cons (car xs) acc)))))
```

**8.**

```scheme
;; the direct recursion
(define (nth-element n xs)
  (if (= n 0) (car xs) (nth-element (- n 1) (cdr xs))))

;; the tail-recursive version (looks the same for this problem)
(define (nth-element-tail n xs)
  (let loop ((i n) (xs xs))
    (if (= i 0) (car xs) (loop (- i 1) (cdr xs)))))
```

Both are tail-recursive here because the recursive call is the last thing to happen. The difference is more visible when you have work to do *after* the recursion — like adding to the result.

**9.**

```scheme
(define (flatten xs)
  (cond
    ((null? xs) '())
    ((pair? (car xs))
     (append (flatten (car xs)) (flatten (cdr xs))))
    (else
     (cons (car xs) (flatten (cdr xs))))))
```

**10.**

```scheme
(define (zip xs ys)
  (if (or (null? xs) (null? ys))
      '()
      (cons (list (car xs) (car ys))
            (zip (cdr xs) (cdr ys)))))
```

**11.**

```scheme
(define (take-while pred xs)
  (cond
    ((null? xs) '())
    ((pred (car xs))
     (cons (car xs) (take-while pred (cdr xs))))
    (else '())))
```

**12.**

```scheme
(define (drop-while pred xs)
  (cond
    ((null? xs) '())
    ((pred (car xs)) (drop-while pred (cdr xs)))
    (else xs)))
```

**13.**

```scheme
(define (make-adder n)
  (lambda (x) (+ x n)))

(define (compose f g)
  (lambda (x) (f (g x))))

((compose (make-adder 1) (make-adder 2)) 10)
;; ⇒ 13
```

**14.**

```scheme
(define-syntax swap!
  (syntax-rules ()
    ((_ a b)
     (let ((tmp a))
       (set! a b)
       (set! b tmp)))))
```

**15.**

```scheme
(define-syntax my-unless
  (syntax-rules ()
    ((_ test body ...)
     (if test #f (begin body ...)))))
```

**16.**

```scheme
(define (occurrences x xs)
  (fold + 0 (map (lambda (y) (if (equal? x y) 1 0)) xs)))
```

**17.**

```scheme
(define (quicksort xs)
  (if (or (null? xs) (null? (cdr xs)))
      xs
      (let ((pivot (car xs))
            (rest  (cdr xs)))
        (append
          (quicksort (filter (lambda (x) (< x pivot)) rest))
          (list pivot)
          (quicksort (filter (lambda (x) (>= x pivot)) rest))))))
```

Not the fastest quicksort (it makes several passes over the list per level), but it reads like the definition.

**18.**

```scheme
;; on a list, this is just a linear scan — but written like binary search
(define (binary-search xs target)
  (let loop ((xs xs) (i 0))
    (cond
      ((null? xs)         #f)
      ((= (car xs) target) i)
      (else (loop (cdr xs) (+ i 1))))))
```

The "real" binary search wants random access — a vector — and halves the search space each step. On a linked list, halving is O(n) per step, so linear scan is faster.

**19.**

```scheme
(define (mem-fib n)
  (let ((cache (make-hash)))
    (define (fib k)
      (if (< k 2)
          k
          (let ((cached (hash-ref cache k #f)))
            (if cached
                cached
                (let ((v (+ (fib (- k 1)) (fib (- k 2)))))
                  (hash-set! cache k v)
                  v)))))
    (fib n)))

(mem-fib 100)
;; ⇒ 354224848179261915075
```

**20.**

```scheme
(define (church-encode n)
  (lambda (f)
    (lambda (x)
      (let loop ((i n) (v x))
        (if (= i 0) v (loop (- i 1) (f v)))))))

(define (church-decode c)
  ((c (lambda (x) (+ x 1))) 0))

(church-decode (church-encode 5))
;; ⇒ 5
```

The Church numeral for 5 is a function that takes `f`, returns a function that takes `x`, applies `f` five times to `x`. To decode: apply the numeral to "add one" starting from zero.

That's the last exercise. If you got most of these — or even understood most of these — you are, as promised, pretty good at Scheme.

There's still a whole world in front of you. Go build something.

— fin —
