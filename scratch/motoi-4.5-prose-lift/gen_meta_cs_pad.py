#!/usr/bin/env python3
"""Meta-CS padding to reach ~300."""

import json
from pathlib import Path

OUT = Path.home() / ".forge/corpus/motoi-v7-partial/prose-lift-meta-cs-pad.jsonl"

def emit(user, motoi, source_file, source_line, sub_shape, kind="meta-cs"):
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": motoi},
        ],
        "_meta": {
            "_source_file": source_file,
            "_source_lineno": source_line,
            "_kind": kind,
            "_bucket": "meta-cs",
            "_provenance": f"book:{source_file}#L{source_line}",
            "_reshape_from": "motoi-4.0-v6",
            "_reshape_by": "ada-4.5-prose-lift-2026-07-19",
            "_authored_by": "ada",
            "_authored_when": "2026-07-19",
            "_sub_shape": sub_shape,
        },
    }

pairs = []

# ---- More reader-depth
reader_more = [
    ("what's a token stream", "The output of the tokenizer. A flat sequence of tokens before parsing groups them. Numbers, symbols, parens each become one token.", "book-of-introspection/07-the-reader.book.slatl", 22, "reader"),
    ("what's the difference between parse and read", "Same in Motoi. Both take a string and return forms. Some Schemes use read for one form at a time, parse for a batch.", "book-of-introspection/07-the-reader.book.slatl", 21, "reader"),
    ("what characters separate tokens", "Whitespace, parens, quotes, comments. The tokenizer scans continuously and cuts at these boundaries.", "book-of-introspection/07-the-reader.book.slatl", 22, "reader"),
    ("how does the reader handle comments", "Skips them. Semicolon starts a line comment. #| ... |# is a block comment. The tokens go through as if the comment weren't there.", "book-of-introspection/07-the-reader.book.slatl", 22, "reader"),
    ("what's a string literal", "Text between double quotes. Backslash escapes. The reader turns \"hi\" into a string atom.", "book-of-introspection/07-the-reader.book.slatl", 22, "reader"),
    ("what happens with quoted lists", "'(1 2 3) becomes (quote (1 2 3)) after the reader. Eval sees quote and returns the list without evaluating its elements.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "reader"),
    ("what happens with backquote", "`(1 2 3) becomes (quasiquote (1 2 3)). Eval walks it and evaluates only unquoted subforms.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "reader"),
    ("what happens if a symbol has weird characters", "Symbols can have almost anything if you escape or use pipe syntax. But by convention, keep them alphanumeric plus - / ? ! *.", "book-of-introspection/07-the-reader.book.slatl", 22, "reader"),
    ("what does dot mean in a list", "(a . b) is a dotted pair — not a proper list. cdr returns b directly instead of a list. Ends in something other than '().", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "reader"),
    ("what's an improper list", "A list whose last cdr isn't '() but some other value. (1 2 . 3) — the cdr of the second pair is 3, not '().", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "reader"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in reader_more])

# ---- More env / bindings
env_more = [
    ("what's set exclaim", "set! — assignment. Change the value of an existing binding. Mutation. Use sparingly.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("why is set exclaim marked with exclamation", "Convention — the ! signals side effect. Any name ending in ! is doing something mutable. Warns the reader.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's a name ending in question mark", "Convention for predicates — functions returning boolean. null?, pair?, even?. Marks intent.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's a top-level define", "A define at the outermost level of a file or REPL. Adds to the global environment. Available everywhere in the same runtime after evaluation.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's an internal define", "A define inside a procedure body. Adds a binding to the local frame. Only visible within that procedure.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("can i mutate a captured variable", "Yes, via set!. Common pattern for building generators or objects with state.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's a free variable", "One referenced in a lambda that isn't a parameter or a local binding. It comes from the enclosing environment. That's what closures capture.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's a bound variable", "One that's a parameter of a lambda or introduced by let. Its meaning is fixed by the enclosing binding form.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
    ("what's alpha renaming", "Renaming a bound variable consistently. (lambda (x) x) and (lambda (y) y) are the same function. Foundational in lambda calculus.", "book-of-language-ancestors/01-alonzo-church.book.slatl", 5, "env"),
    ("what's variable shadowing again", "When an inner binding hides an outer one with the same name. Not an error — but can be confusing. Some linters warn.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "env"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in env_more])

# ---- More continuations / control
cont_more = [
    ("what's dynamic-wind", "Runs a before-thunk, then a body, then an after-thunk — even if a continuation jumps out mid-body. Structured cleanup for continuation-heavy code.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's a generator", "A procedure that produces values on demand. Each call gives the next one. Built from continuations in Scheme; a first-class primitive in Python.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's a promise vs a continuation", "Promise: a wrapped delayed value, forced once. Continuation: the rest of a computation, callable to jump back. Different mechanisms, overlapping uses.", "book-of-composition/03-higher-order.book.slatl", 5, "cont"),
    ("what's coroutines really", "Cooperative concurrency. Each coroutine yields to others voluntarily. Built from continuations. Cheap compared to threads.", "book-of-computing/14-concurrency-and-async.book.slatl", 5, "cont"),
    ("why call slash cc is powerful", "It captures 'what happens next' as a value. That's control-flow-as-data — you can save it, call it, ignore it. Enables patterns that need much more code without it.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's a one-shot continuation", "One you can only invoke once. Cheaper to implement than full continuations. Sufficient for non-local exit but not for backtracking.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's escape only", "A continuation used purely to jump out of a nested computation. Doesn't need to resume later. Common with call/cc.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's cps", "Continuation-passing style. Every function takes an extra continuation argument saying what to do with its result. Explicit control flow. Some compilers convert internally.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("why write in cps", "To make control flow explicit. Compilers do it because it exposes optimizations. Humans rarely write it directly — call/cc gives similar power more compactly.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
    ("what's proper tail position", "A position whose value is the value of the enclosing procedure. Last expression in a lambda body, both branches of an if in tail position, etc. Scheme guarantees no stack for tail calls there.", "book-of-composition/04-recursion.book.slatl", 5, "cont"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in cont_more])

# ---- More about how the interpreter works internally
interp_more = [
    ("what's an interpreter", "A program that walks source and executes it. Doesn't produce a binary. Motoi's core is one.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("how does interpretation compare to compilation", "Interpreter: walk the tree, do what each node says. Compiler: turn the tree into machine code, then run that. Interpreters iterate faster; compilers run faster.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("what's a tree-walking interpreter", "One that literally traverses the AST, dispatching on node types. Simple to write. Slower than JIT or compiled code but easy to reason about.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("what's a bytecode interpreter", "One that compiles source to a simpler intermediate — bytecode — and then interprets the bytecode. Faster because the bytecode is simpler than the source tree.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("what's a stack-based interpreter", "One that runs on a stack machine — push, pop, operate. Simple. Common intermediate model. Python's CPython works this way.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("what's a register-based interpreter", "One that uses virtual registers instead of a stack. Fewer instructions to do the same work. Lua and modern V8 use variants.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("how does motoi run under the hood", "Reader parses. Macro expander expands. Interpreter walks the resulting forms — dispatching by shape, looking up bindings, applying procedures.", "book-of-introspection/07-the-reader.book.slatl", 106, "interp"),
    ("what's a bytecode", "A compact intermediate representation between source and execution. Each bytecode instruction is simple. Faster to interpret than raw source.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("what's the difference between interp and compiler in scheme", "Both exist. Interpreter: run this immediately. Compiler: emit machine code or bytecode for later. Motoi is primarily interpreted with some caching.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "interp"),
    ("can i implement my own scheme", "Yes. That's the whole SICP Chapter 4 project. A tree-walking interpreter for a Scheme subset fits in a couple hundred lines.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 96, "interp"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in interp_more])

# ---- More macros
macros_more = [
    ("what's a syntax pattern", "The left side of a syntax-rules clause. Matches input syntax. Variables in the pattern bind to whatever's there in the actual invocation.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what's a syntax template", "The right side of a syntax-rules clause. What the macro expands into. Variables from the pattern get substituted.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what's an ellipsis in syntax-rules", "The ... marker for zero-or-more repetition. Lets a macro accept variable-length input. (body ...) captures however many body forms are supplied.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("how do i write a for loop as a macro", "(define-syntax for (syntax-rules (from to do) ((_ i from a to b do body ...) (let loop ((i a)) (when (<= i b) body ... (loop (+ i 1))))))). Now (for i from 1 to 5 do (print i)) works.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what's a low-level macro", "One that doesn't use syntax-rules. Non-hygienic, gets raw forms. define-macro. More flexible, more dangerous.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what's syntax-case", "R6RS's macro system. Pattern matching on syntax with the ability to break hygiene when needed. Between syntax-rules and low-level macros in power.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what's a hygiene violation", "When a macro's internal name accidentally captures or shadows the caller's binding. Hygienic macros prevent this automatically.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("why do most schemes prefer hygienic macros", "Because bugs from hygiene violations are subtle and painful. syntax-rules trades some flexibility for safety.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("what does macroexpand-once do", "Expands the outer macro one level. Useful when a form nests macros — see the first layer without diving all the way.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
    ("when does macroexpansion happen", "Before eval sees the form. During compilation for compiled code. Interactively in the REPL, expansion happens just before evaluation of each entered form.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "macro"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in macros_more])

# ---- More errors and debugging
err_more = [
    ("how do i print for debugging", "(display value) prints without a newline. (newline) adds one. (write value) is like display but escapes strings. Use them together.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "errors"),
    ("what does display do", "Prints a value in human-readable form. Strings without quotes. Not intended for machine reading.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "errors"),
    ("what does write do", "Prints a value in reader-parseable form. Strings with quotes and escapes. Round-trippable via read.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "errors"),
    ("what's a debug print", "(display 'debug-here) (newline). Or a trace. Or a watched variable. Old-school printf debugging still works.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "errors"),
    ("how do i pretty-print a value", "(pp value) formats nested structures across lines with indentation. Way more readable than a single line for large forms.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "errors"),
    ("what's guard", "A form for catching errors. (guard (exn ((error? exn) 'recovered)) body). If body raises a matching exn, the clause runs. Else the value of body.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "errors"),
    ("what does with-exception-handler do", "Installs a handler for exceptions raised during the body. When one hits, the handler runs. May resume or unwind.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "errors"),
    ("what's a condition", "A structured exception. Has a type. May have fields. Not just a string. Enables handlers to match by type and read fields.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "errors"),
    ("how do i re-raise", "(raise exn) — pass the caught exception up the chain. The next handler gets it. If none, it bubbles to the REPL.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "errors"),
    ("what's assert in scheme", "(assert expr) checks that expr is truthy. If false, raises an assertion error. Optionally takes a message. Common for input validation.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "errors"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in err_more])

# ---- Recursion patterns
rec_more = [
    ("how do i sum a list recursively", "(define (sum lst) (if (null? lst) 0 (+ (car lst) (sum (cdr lst))))). Base case: empty list is 0. Recursive: add head to sum of tail.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i sum with tail recursion", "(define (sum lst) (define (loop lst acc) (if (null? lst) acc (loop (cdr lst) (+ acc (car lst))))) (loop lst 0)). Accumulator carries the running total.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i reverse a list", "(define (rev lst) (if (null? lst) '() (append (rev (cdr lst)) (list (car lst))))). Quadratic though. Better with an accumulator.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i reverse efficiently", "(define (rev lst) (define (loop lst acc) (if (null? lst) acc (loop (cdr lst) (cons (car lst) acc)))) (loop lst '())). Linear time, tail-recursive.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i count elements", "(define (len lst) (if (null? lst) 0 (+ 1 (len (cdr lst))))). Or use tail recursion with an accumulator.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i find max in a list", "(define (mx lst) (if (null? (cdr lst)) (car lst) (max (car lst) (mx (cdr lst))))). Assumes non-empty.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("how do i flatten a nested list", "(define (flat lst) (cond ((null? lst) '()) ((pair? (car lst)) (append (flat (car lst)) (flat (cdr lst)))) (else (cons (car lst) (flat (cdr lst)))))). Recurses into sublists.", "book-of-composition/02-list-manipulation.book.slatl", 5, "rec"),
    ("what's structural induction", "Proving a property holds for all cases of a recursive data type by induction on structure. Base case + induction step. Same shape as recursion.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("what's mutual recursion example", "(define (evn? n) (if (zero? n) #t (odd? (- n 1)))) (define (odd? n) (if (zero? n) #f (evn? (- n 1)))). They call each other.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
    ("what's a fixed point", "A value x such that f(x) = x. Fixed-point iteration finds one by starting somewhere and applying f until convergence. Useful in numerical methods.", "book-of-composition/04-recursion.book.slatl", 5, "rec"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in rec_more])

# ---- Homoiconicity and metaprogramming
homo_more = [
    ("what's an ast", "Abstract syntax tree. What the parser gives you. In Scheme, the AST literally is a list. That's homoiconicity.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "homoiconic"),
    ("why is scheme's ast just lists", "Because programs are lists. When McCarthy designed Lisp in 1958, he made data and code share a syntax. No separate AST type. The list IS the AST.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 44, "homoiconic"),
    ("what's metaprogramming", "Programs that manipulate programs. Macros. Code generation. Reflection. All easier in a language where code and data have the same shape.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 44, "homoiconic"),
    ("what's reflection", "A program's ability to inspect and modify itself at runtime. Motoi's introspection is reflection. Registry inspection, environment enumeration, macro expansion — all reflective operations.", "book-of-introspection/01-what-is-introspection.book.slatl", 22, "homoiconic"),
    ("what's a symbol table", "The mapping from names to bindings. In an interpreter, environments implement it. In a compiler, the compile-time symbol table gets baked into generated code.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "homoiconic"),
    ("what's read-eval-symbol", "The whole chain when you type foo. Reader turns 'foo' into a symbol. Eval looks it up in the environment. Returns the bound value.", "book-of-introspection/07-the-reader.book.slatl", 22, "homoiconic"),
    ("what's a fexpr", "An old Lisp feature — like a macro but running at eval time, seeing unevaluated arguments. Powerful, hygiene-breaking, mostly abandoned. Modern Lisps prefer macros.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "homoiconic"),
    ("what's an environment as data", "In Scheme, environments are conceptually first-class — a lambda captures one. Some Schemes expose them directly; most don't for safety.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "homoiconic"),
    ("can i build a list and call it", "(eval (list '+ 1 2) (interaction-environment)) — yes. Homoiconicity plus eval gives you runtime code generation.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 44, "homoiconic"),
    ("what's a DSL in scheme", "Domain-specific language built on top of Scheme with macros. Because you can add syntax, you can shape the language for your problem.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "homoiconic"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in homo_more])

# ---- Program state and semantics
sem_more = [
    ("what's evaluation order", "The order sub-expressions get evaluated in. Scheme is applicative order — arguments evaluated left-to-right before the call. Some languages evaluate lazily.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "semantics"),
    ("what's applicative order", "Arguments evaluated before the call. What Scheme does. Predictable side effect order. Sometimes wastes work if the function ignores an argument.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "semantics"),
    ("what's normal order", "Arguments evaluated on demand, when the function uses them. Haskell does variants of this. Can avoid infinite computations in unused arguments.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "semantics"),
    ("what's lazy evaluation", "Values computed only when needed. Streams, promises, force/delay in Scheme. Haskell defaults to it. Nice for infinite structures.", "book-of-composition/03-higher-order.book.slatl", 5, "semantics"),
    ("what's referential transparency again", "Replacing an expression with its value doesn't change program behavior. Pure functions have it. Impure ones don't. Enables reasoning by substitution.", "book-of-computing/11-lambda-and-closures.book.slatl", 5, "semantics"),
    ("what's side effect", "Any change beyond returning a value. Printing. File I/O. Mutating shared state. Sending network messages. Impure.", "book-of-composition/01-what-composition-is.book.slatl", 5, "semantics"),
    ("what's pure code", "Code with no side effects. Only inputs and outputs. Easy to test, easy to reason about. Not always achievable but a good goal for most functions.", "book-of-composition/01-what-composition-is.book.slatl", 5, "semantics"),
    ("what's an imperative style", "Programming as sequences of state-changing statements. C, Java's method bodies. Scheme lets you but doesn't lean into it.", "book-of-composition/01-what-composition-is.book.slatl", 5, "semantics"),
    ("what's declarative style", "Programming by saying what you want, not how. SQL is declarative. So is a lot of functional code — expressions rather than steps.", "book-of-composition/01-what-composition-is.book.slatl", 5, "semantics"),
    ("what's semantics of a language", "What programs mean. Operational semantics: how they execute. Denotational: what values they represent mathematically. Axiomatic: what properties they preserve.", "book-of-language-ancestors/16-christopher-strachey.book.slatl", 5, "semantics"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in sem_more])

# ---- More on scheme-specific features
scheme_more = [
    ("what does define-record-type do", "Creates a new record type with a constructor, predicate, and field accessors. (define-record-type point (make-point x y) point? (x px) (y py)).", "book-of-introspection/03-describe-typeof.book.slatl", 5, "scheme"),
    ("what's a record", "A struct-like value with named fields. Distinct type. Constructor, predicate, accessors. Motoi has them.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "scheme"),
    ("what's the equivalent of null", "'() — the empty list — in Scheme. Distinct from #f. Some Schemes have a separate null symbol.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "scheme"),
    ("what's the equivalent of nil", "Same as null in most Schemes — '(). Common Lisp fuses nil, false, and empty list; Scheme separates them.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "scheme"),
    ("what's void in scheme", "The result of expressions with no meaningful value — set!, display, etc. Different implementations call it different things. Not something you should rely on.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "scheme"),
    ("what's a syntactic keyword", "A word that names a special form. define, if, lambda, quote, cond, let. They're not verbs — you can't bind them to a value.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "scheme"),
    ("what's tail-call proper", "Scheme's guarantee that tail-position calls don't grow the stack. Language contract, not compiler optimization. Enables clean recursion for loops.", "book-of-composition/04-recursion.book.slatl", 5, "scheme"),
    ("what's a named let", "(let loop ((x 0)) (if ...)) — a let with a name creates a recursive procedure named loop, and calls it once. Convenient for tail-recursive loops.", "book-of-composition/04-recursion.book.slatl", 5, "scheme"),
    ("what's begin", "Sequences expressions. Evaluates each in order, returns the last one's value. Useful when you need multiple expressions where syntax allows one.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "scheme"),
    ("what's cond", "Multi-way conditional. (cond ((test1) body1) ((test2) body2) (else default)). Cleaner than nested ifs.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "scheme"),
    ("what's case", "Value dispatch. (case x ((1 2) 'small) ((3 4) 'medium) (else 'other)). Constants only, not general predicates.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "scheme"),
    ("what's when and unless", "Sugar for one-armed if. (when test body ...) is (if test (begin body ...) #f). Reads better for single-branch checks.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "scheme"),
    ("what's do loop", "Scheme's iteration form. Init variables, test, step. (do ((i 0 (+ i 1))) ((>= i 10)) body). Less common than named let.", "book-of-composition/04-recursion.book.slatl", 5, "scheme"),
    ("what's apply", "Calls a procedure with a list of arguments unpacked. (apply + '(1 2 3)) is (+ 1 2 3). Handy when you have arguments as a list.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "scheme"),
    ("what's quasiquote example", "(let ((x 5)) `(a b ,x d)) returns (a b 5 d). Backquote quotes; comma unquotes.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "scheme"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in scheme_more])

# ---- Interpreter internals + language design
internals_more = [
    ("what's an fexpr again", "A macro-like construct that receives unevaluated arguments at runtime. Went out of style because they made static analysis nearly impossible.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "internals"),
    ("what's staged computation", "Programs that decide at one time what to do at another. Macros stage at compile time. Templates stage at parse time. Many patterns.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "internals"),
    ("what's a hash consing", "Ensuring identical structures share memory. Second time you cons the same pair, you get the same object back. Space savings. Enables cheap eq? equality.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 40, "internals"),
    ("what's a boxed value", "A value stored on the heap with a pointer to it. Compare to unboxed — value stored directly in a register or stack slot. Boxing costs a pointer indirection.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "internals"),
    ("what's a tagged pointer", "A pointer where a few bits encode type information. Small integers can live inside pointers without being on the heap. Common optimization in dynamic languages.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "internals"),
    ("what's a fixnum", "A small integer stored directly in a machine word. Fits in a pointer with tag bits. Fast — no heap allocation. Overflow promotes to bignums.", "book-of-computing/12-compilers-and-interpreters.book.slatl", 5, "internals"),
    ("what's a bignum", "An arbitrary-precision integer. Uses a heap-allocated array of machine words to represent big numbers. Scheme has them by default via the number tower.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "internals"),
    ("what's arbitrary precision", "Numbers not bound by machine word size. Scheme's integer type is arbitrary precision — you can compute factorials of large numbers exactly.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "internals"),
    ("what's a generational garbage collector", "One that treats short-lived and long-lived objects differently. Most objects die young; only trace young ones frequently, old ones rarely. Big performance win.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 90, "internals"),
    ("what's a mark and sweep gc", "Simple garbage collector. Mark all reachable objects. Sweep unmarked objects into the free list. Two passes over the heap. Basic but works.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 90, "internals"),
    ("what's a copying gc", "Divides the heap in two. Live objects get copied from old to new during collection. Compacts as it goes. Faster than mark-sweep but uses more memory.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 90, "internals"),
    ("what's stop the world gc", "When the collector pauses all program threads while it runs. Simple to implement, adds latency. Modern collectors work concurrently to avoid it.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 90, "internals"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in internals_more])

# ---- Values enumeration / LLM boundary
llm_boundary = [
    ("does motoi have LLM verbs", "Yes. copilot/*, what-is, explain, fix, pretty-error. They call out to an LLM backend. Chapter 13 of Book of Introspection walks them.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what's the difference between help and what-is", "help reads the registry. what-is reads the registry too but can also add a prose sentence if useful. what-is falls back to the model only if the registry is empty.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what's a confidence field", "LLM-augmented verbs return a :confidence value on their results. Low means the model guessed; high means it grounded in mechanical sources.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what does explain do", "Takes a verb name and returns prose about how to use it. Consults registry, then may add prose. (explain 'map) — helpful when you know the name but not the shape.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what does fix do", "Given an error record, suggests a fix. LLM-augmented. Grounds in the error's fields where possible.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what does pretty-error do", "Formats an error record into a human-readable message. Uses the error's fields plus optional LLM smoothing for narrative shape.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what does rewrite do", "Given code, suggests an idiomatic version. LLM-augmented. Best on short passages. You review before adopting.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
    ("what's copilot/rag", "Retrieval-augmented generation. Consult the books for a topic, feed relevant chunks to the model, get a grounded answer. Not just weights.", "book-of-introspection/appendix-n-introspection-x-training.book.slatl", 5, "llm-verb"),
    ("can motoi read a book at runtime", "Yes. (book/read :book 'introspection :chapter 1). Prints the chapter. Books are queryable substrate.", "book-of-introspection/appendix-n-introspection-x-training.book.slatl", 5, "llm-verb"),
    ("what's the completions verb", "(copilot/complete src) — proposes a completion for the given source. Grounded in the registry when possible. Confidence reported.", "book-of-introspection/13-ask-the-llm.book.slatl", 5, "llm-verb"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in llm_boundary])

# ---- Performance and profiling
perf_more = [
    ("how do i measure runtime", "(time expr) — runs expr and reports elapsed time. Useful for quick checks. Not a full profiler but often enough.", "book-of-introspection/15-performance-introspection.book.slatl", 5, "perf"),
    ("what's a profiler", "A tool that records how much time is spent in each function. Points at hot spots to optimize. Motoi has a basic one; production runs may want more.", "book-of-introspection/15-performance-introspection.book.slatl", 5, "perf"),
    ("what's amortized cost", "Average cost per operation over a sequence, including occasional expensive ones. Growing a vector: each individual doubling is expensive, but amortized cost of append is constant.", "book-of-introspection/15-performance-introspection.book.slatl", 5, "perf"),
    ("what's constant time", "O(1). Fixed cost regardless of input size. Hash lookup average case. Array index. Register access.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "perf"),
    ("what's linear time", "O(n). Cost proportional to input size. Sum of a list. Copy an array. Filter.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "perf"),
    ("what's log time", "O(log n). Doubling input adds one step. Binary search. B-tree lookup. Balanced tree operations.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "perf"),
    ("what's linearithmic", "O(n log n). Sorting typically. Divide-and-conquer with linear merging. Better than quadratic for large inputs.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "perf"),
    ("why does big o matter", "Because scaling. An O(n²) algorithm that works fine on 100 items dies on 100,000. Growth rate dominates for large inputs.", "book-of-language-ancestors/06-donald-knuth.book.slatl", 5, "perf"),
    ("what's memoization for perf", "Cache results of expensive functions. Second call with same input skips the work. Big win for recursive functions with overlapping subproblems.", "book-of-composition/04-recursion.book.slatl", 5, "perf"),
    ("what's tail-call and performance", "Tail-recursive code runs in constant stack space, avoids overhead of stack frames. In Scheme, it's the natural way to write loops.", "book-of-composition/04-recursion.book.slatl", 5, "perf"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in perf_more])

with open(OUT, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"wrote {len(pairs)} meta-cs pad pairs to {OUT}")
