#!/usr/bin/env python3
"""Build the prototype JSONL for reference-lane shapes R1-R6.

Verbs used (all confirmed wired via ./bin/motoi run):
  - fold    (SRFI-1, elem-first combiner)
  - filter  (SRFI-1)
  - iota    (SRFI-1)   [+ map, delete-duplicates as supporting]

Doctrine: GRAB real example bodies from scheme/reference/39-list.slat, don't invent.
Every code_block is meant to run under ./bin/motoi run /dev/stdin. R5 broken blocks
that legitimately raise a runtime error are tagged with a trailing marker in the
harness (see expected_error handling): here we set "expected_error": true at the
pair level and list which blocks are expected to error.
"""
import json

pairs = []

def add(shape, instruction, response, code_blocks, expected_error_idx=None):
    rec = {
        "shape": shape,
        "instruction": instruction,
        "response": response,
        "code_blocks": code_blocks,
    }
    if expected_error_idx is not None:
        rec["expected_error_idx"] = expected_error_idx  # list of indices expected to error
    pairs.append(rec)

# ----------------------------------------------------------------------------
# R1 · VERB-IDENTITY — the 5-row × 3-discipline grid, condensed to a pair.
# We give the three-discipline lens (eng / cs / math) as three distinct bodies.
# ----------------------------------------------------------------------------

add(
    "R1",
    "Show me `fold` from three angles at once — a working engineering use, a "
    "computer-science framing, and the math it stands for.",
    "`fold` walks a list left-to-right, threading an accumulator. SRFI-1 puts the "
    "*element first* in the combiner: `(f elem acc)`.\n\n"
    "Engineering — total a column of numbers:\n"
    "    (fold + 0 (list 3 7 2 9 1))        ; => 22\n\n"
    "CS — it's the catamorphism over a list; `max` folded gives the running peak:\n"
    "    (fold max 0 (list 3 7 2 9 1))      ; => 9\n\n"
    "Math — `fold` with `cons` and `'()` rebuilds (and reverses) the list, which is "
    "why `fold` is the universal list eliminator:\n"
    "    (fold cons (quote ()) (list 1 2 3)) ; => (3 2 1)",
    [
        "(fold + 0 (list 3 7 2 9 1))",
        "(fold max 0 (list 3 7 2 9 1))",
        "(fold cons (quote ()) (list 1 2 3))",
    ],
)

add(
    "R1",
    "Give me the identity card for `filter`: one real-world job, one CS view, one "
    "mathematical reading.",
    "`filter` keeps only the elements that satisfy a predicate, in order.\n\n"
    "Real job — drop the odd readings, keep the even ones:\n"
    "    (filter even? (iota 10))            ; => (0 2 4 6 8)\n\n"
    "CS view — it's a selection over a sequence; compose it with `iota` to sieve an "
    "index range:\n"
    "    (filter (lambda (i) (= 0 (modulo i 3))) (iota 12))  ; => (0 3 6 9)\n\n"
    "Math reading — `filter p` computes the subset {x in xs : p(x)}; here the "
    "positives:\n"
    "    (filter positive? (list -2 -1 0 1 2)) ; => (1 2)",
    [
        "(filter even? (iota 10))",
        "(filter (lambda (i) (= 0 (modulo i 3))) (iota 12))",
        "(filter positive? (list -2 -1 0 1 2))",
    ],
)

add(
    "R1",
    "I want to understand `iota` across disciplines — a concrete build, a CS pattern, "
    "and the sequence it denotes.",
    "`iota` generates counted number sequences: `(iota n)`, `(iota n start)`, "
    "`(iota n start step)`.\n\n"
    "Concrete — an index/square table you could plot:\n"
    "    (map (lambda (i) (list i (* i i))) (iota 5))  ; => ((0 0) (1 1) (2 4) (3 9) (4 16))\n\n"
    "CS pattern — a bounded unfold; five values stepping by two from ten:\n"
    "    (iota 5 10 2)                       ; => (10 12 14 16 18)\n\n"
    "The sequence it denotes — an arithmetic progression a_i = start + i·step:\n"
    "    (define (arith-prog n start step) (map (lambda (i) (+ start (* i step))) (iota n)))\n"
    "    (display (arith-prog 5 10 2))\n    (newline)  ; => (10 12 14 16 18)",
    [
        "(map (lambda (i) (list i (* i i))) (iota 5))",
        "(iota 5 10 2)",
        "(define (arith-prog n start step) (map (lambda (i) (+ start (* i step))) (iota n)))\n(display (arith-prog 5 10 2))\n(newline)",
    ],
)

# ----------------------------------------------------------------------------
# R2 · RUN-AND-EXPLAIN — abductive: observe -> predict -> run -> substitution trace
# ----------------------------------------------------------------------------

add(
    "R2",
    "Before running it, what do you expect `(fold + 0 (list 10 20 30))` to give, and "
    "then walk me through why?",
    "Prediction: I expect 60 — `fold` threads a running sum starting at the seed 0.\n\n"
    "Run:\n"
    "    (fold + 0 (list 10 20 30))         ; => 60\n\n"
    "Substitution trace (SRFI-1 order is `(+ elem acc)`):\n"
    "  step 0: acc = 0\n"
    "  step 1: (+ 10 0)  -> acc = 10\n"
    "  step 2: (+ 20 10) -> acc = 30\n"
    "  step 3: (+ 30 30) -> acc = 60\n"
    "The list is empty now, so the final accumulator 60 is the answer. The prediction "
    "held.",
    ["(fold + 0 (list 10 20 30))"],
)

add(
    "R2",
    "Predict the output of `(filter odd? (iota 6))`, then run it and account for the "
    "difference from what a beginner might guess.",
    "Prediction: `(1 3 5)`. `iota 6` is `(0 1 2 3 4 5)` and `filter odd?` keeps the "
    "odd ones. A beginner sometimes expects `(1 3 5 7 ...)` — but `iota 6` stops after "
    "six values counting from 0, so the largest is 5.\n\n"
    "Run:\n"
    "    (filter odd? (iota 6))             ; => (1 3 5)\n\n"
    "Trace: test each element against `odd?` — 0 no, 1 yes, 2 no, 3 yes, 4 no, 5 yes — "
    "and cons the survivors in order.",
    ["(filter odd? (iota 6))"],
)

add(
    "R2",
    "What will `(fold cons '() (list 1 2 3))` produce? State your guess, run it, and "
    "explain the surprise.",
    "Guess: many expect `(1 2 3)`, but the answer is `(3 2 1)` — `fold` reverses when "
    "you cons.\n\n"
    "Run:\n"
    "    (fold cons (quote ()) (list 1 2 3)) ; => (3 2 1)\n\n"
    "Trace: acc starts `()`.\n"
    "  (cons 1 ()) -> (1)\n"
    "  (cons 2 (1)) -> (2 1)\n"
    "  (cons 3 (2 1)) -> (3 2 1)\n"
    "Each new element is prepended to the front of the growing accumulator, so the "
    "last element ends up first. Use `fold-right` if you want order preserved.",
    ["(fold cons (quote ()) (list 1 2 3))"],
)

# ----------------------------------------------------------------------------
# R3 · DECOMPOSE-AND-LABEL — HtDP recipe; name every functional part.
# ----------------------------------------------------------------------------

add(
    "R3",
    "Take this program and label every functional part for me:\n"
    "    (define (sum-evens xs) (fold + 0 (filter even? xs)))",
    "[program]   (define (sum-evens xs) (fold + 0 (filter even? xs)))\n"
    "[signature] list-of-number -> number\n"
    "[purpose]   sum only the even numbers in xs\n"
    "[inventory]\n"
    "  - input:        xs, the list of numbers\n"
    "  - predicate:    even? — decides which elements survive\n"
    "  - transform:    (filter even? xs) — the selected sub-list\n"
    "  - combiner:     + — folds two numbers into one\n"
    "  - seed:         0 — the additive identity / base case for the fold\n"
    "  - output:       the accumulated sum\n"
    "[template]  (fold <combiner> <seed> (filter <predicate> xs))\n"
    "[trace]     for xs = (1 2 3 4): filter -> (2 4); fold: (+ 2 0)=2, (+ 4 2)=6\n"
    "[meta]      the shape of the data (a flat list) dictated a filter-then-fold shape.\n\n"
    "Check it runs:\n"
    "    (define (sum-evens xs) (fold + 0 (filter even? xs)))\n"
    "    (display (sum-evens (list 1 2 3 4)))\n    (newline)  ; => 6",
    [
        "(define (sum-evens xs) (fold + 0 (filter even? xs)))\n(display (sum-evens (list 1 2 3 4)))\n(newline)",
    ],
)

add(
    "R3",
    "Name what each piece is in `(define (count-multiples-of-3 n) (length (filter "
    "(lambda (i) (= 0 (modulo i 3))) (iota n))))`.",
    "[program]   (define (count-multiples-of-3 n)\n"
    "              (length (filter (lambda (i) (= 0 (modulo i 3))) (iota n))))\n"
    "[signature] nonneg-integer -> nonneg-integer\n"
    "[purpose]   count how many integers in [0, n) are divisible by 3\n"
    "[inventory]\n"
    "  - input:      n, the exclusive upper bound\n"
    "  - generator:  (iota n) — produces (0 1 ... n-1)\n"
    "  - predicate:  (lambda (i) (= 0 (modulo i 3))) — divisible-by-3 test\n"
    "  - transform:  filter — keeps the multiples\n"
    "  - combiner:   length — collapses the survivors to a count\n"
    "  - output:     the integer count\n"
    "[template]  (length (filter <predicate> (iota n)))\n"
    "[meta]      generate -> select -> measure; a very common CS pipeline.\n\n"
    "Runs:\n"
    "    (define (count-multiples-of-3 n) (length (filter (lambda (i) (= 0 (modulo i 3))) (iota n))))\n"
    "    (display (count-multiples-of-3 10))\n    (newline)  ; => 4",
    [
        "(define (count-multiples-of-3 n) (length (filter (lambda (i) (= 0 (modulo i 3))) (iota n))))\n(display (count-multiples-of-3 10))\n(newline)",
    ],
)

# ----------------------------------------------------------------------------
# R4 · RECOMPOSE / BUILD-UP LADDER — each rung runs, stepwise refinement.
# ----------------------------------------------------------------------------

add(
    "R4",
    "Build me up, one small step at a time, to a function that returns the average of "
    "the even numbers in a list. Start from the smallest seed.",
    "Rung 1 — the seed: just make the range.\n"
    "    (iota 6)                            ; => (0 1 2 3 4 5)\n\n"
    "Rung 2 — keep only the evens (add the predicate):\n"
    "    (filter even? (iota 6))             ; => (0 2 4)\n\n"
    "Rung 3 — total them (compose in the fold):\n"
    "    (fold + 0 (filter even? (iota 6)))  ; => 6\n\n"
    "Rung 4 — divide by how many there are (the average), guarding empty:\n"
    "    (define (avg-evens xs)\n"
    "      (let ((evens (filter even? xs)))\n"
    "        (if (null? evens) 0 (/ (fold + 0 evens) (length evens)))))\n"
    "    (display (avg-evens (iota 6)))\n    (newline)  ; => 2\n\n"
    "[meta] the pattern that emerged is generate -> filter -> reduce, then normalize.",
    [
        "(iota 6)",
        "(filter even? (iota 6))",
        "(fold + 0 (filter even? (iota 6)))",
        "(define (avg-evens xs)\n  (let ((evens (filter even? xs)))\n    (if (null? evens) 0 (/ (fold + 0 evens) (length evens)))))\n(display (avg-evens (iota 6)))\n(newline)",
    ],
)

add(
    "R4",
    "Ladder me up from `iota` to a small program that lists each index paired with its "
    "square, but only for even indices.",
    "Rung 1 — the range:\n"
    "    (iota 5)                            ; => (0 1 2 3 4)\n\n"
    "Rung 2 — pair each index with its square (add the map + transform):\n"
    "    (map (lambda (i) (list i (* i i))) (iota 5))  ; => ((0 0) (1 1) (2 4) (3 9) (4 16))\n\n"
    "Rung 3 — keep only the even-index rows (compose a filter on top):\n"
    "    (filter (lambda (row) (even? (car row)))\n"
    "            (map (lambda (i) (list i (* i i))) (iota 5)))  ; => ((0 0) (2 4) (4 16))\n\n"
    "Rung 4 — name it and run:\n"
    "    (define (even-square-table n)\n"
    "      (filter (lambda (row) (even? (car row)))\n"
    "              (map (lambda (i) (list i (* i i))) (iota n))))\n"
    "    (display (even-square-table 6))\n    (newline)  ; => ((0 0) (2 4))\n\n"
    "[meta] each rung stayed runnable; the shape is generate -> map -> filter.",
    [
        "(iota 5)",
        "(map (lambda (i) (list i (* i i))) (iota 5))",
        "(filter (lambda (row) (even? (car row)))\n        (map (lambda (i) (list i (* i i))) (iota 5)))",
        "(define (even-square-table n)\n  (filter (lambda (row) (even? (car row)))\n          (map (lambda (i) (list i (* i i))) (iota n))))\n(display (even-square-table 6))\n(newline)",
    ],
)

# ----------------------------------------------------------------------------
# R5 · PROGRAM REVERSALS — code<->description and broken<->fixed.
# Broken blocks legitimately raise runtime errors and are tagged expected_error.
# ----------------------------------------------------------------------------

add(
    "R5",
    "Here's a description: 'return the running total of a list of numbers.' Write the "
    "Motoi code — then reverse it: given the code, describe it back.",
    "Description -> code:\n"
    "    (fold + 0 (list 4 5 6))            ; => 15\n\n"
    "Code -> description (the reverse direction): `(fold + 0 xs)` reduces the list `xs` "
    "to a single number by repeatedly adding each element into an accumulator that "
    "starts at 0 — i.e. it computes the sum. The reverse reading is what lets you "
    "recognize the sum idiom when you see it, not just write it.",
    ["(fold + 0 (list 4 5 6))"],
)

add(
    "R5",
    "This program is broken — it uses an R6RS name Motoi does not have. Show the "
    "breakage, then fix it.",
    "Broken (R6RS `fold-left`, accumulator-first, which Motoi deliberately excludes):\n"
    "    (fold-left + 0 (list 1 2 3))       ; error: unbound symbol: fold-left\n\n"
    "Fixed — use SRFI-1 `fold` (element-first). For `+` the order doesn't matter, so "
    "the result is the same 6:\n"
    "    (fold + 0 (list 1 2 3))            ; => 6\n\n"
    "Lesson: Motoi's standard is R7RS-small + SRFI-1. `fold-left`/`foldl`/`foldr` are "
    "not wired on purpose; reach for `fold` and `fold-right` instead.",
    [
        "(fold-left + 0 (list 1 2 3))",
        "(fold + 0 (list 1 2 3))",
    ],
    expected_error_idx=[0],
)

add(
    "R5",
    "Reverse this broken->fixed the other way: start from a working filter, then show "
    "the classic way it breaks, so I learn how a good program goes wrong.",
    "Working:\n"
    "    (filter even? (iota 6))            ; => (0 2 4)\n\n"
    "How it breaks (passing a value where a predicate procedure is expected — `even?` "
    "with no argument is fine, but calling filter with a non-procedure raises):\n"
    "    (filter 42 (iota 6))               ; error: not a procedure / cannot apply 42\n\n"
    "Lesson: `filter` wants a one-argument predicate as its first argument. The "
    "reverse (fixed -> broken) direction teaches the failure mode so you can spot it "
    "before it happens.",
    [
        "(filter even? (iota 6))",
        "(filter 42 (iota 6))",
    ],
    expected_error_idx=[1],
)

# ----------------------------------------------------------------------------
# R6 · COMPREHENSION-VOCAB OVERLAY — name the metalanguage of program structure.
# ----------------------------------------------------------------------------

add(
    "R6",
    "In `(fold + 0 xs)`, teach me the vocabulary — which part is the combiner, which "
    "is the seed, and what 'tail position' and 'accumulator' mean here.",
    "Metalanguage overlay for `(fold + 0 xs)`:\n"
    "  - the *combiner* is `+`: the two-argument function that merges the current "
    "element with the accumulator.\n"
    "  - the *seed* (a.k.a. the identity or base case) is `0`: the accumulator's "
    "starting value, chosen because 0 is the identity for addition.\n"
    "  - the *accumulator* is the running result threaded through each step.\n"
    "  - `fold` recurses in *tail position*, so it uses constant stack — the recursive "
    "call is the last thing it does.\n\n"
    "You can see the seed's identity role: folding `+` over the empty list returns the "
    "seed unchanged.\n"
    "    (fold + 0 (list))                  ; => 0",
    ["(fold + 0 (list))"],
)

add(
    "R6",
    "Give me the role-words for `(filter even? xs)` — what is `even?` called, what is "
    "the result called, and why is this 'pure'?",
    "Role-words for `(filter even? xs)`:\n"
    "  - `even?` is the *predicate*: a function returning a boolean that decides "
    "membership.\n"
    "  - the result is the *selection* (or sub-sequence): the elements for which the "
    "predicate held, order preserved.\n"
    "  - `filter` is a *higher-order* function: it takes another function as an "
    "argument.\n"
    "  - it is *pure* / *referentially transparent*: no state is mutated, so the same "
    "input always yields the same output — you can substitute the call for its value.\n\n"
    "Referential transparency in action — the same expression twice, same answer, so "
    "they are `equal?`:\n"
    "    (equal? (filter even? (iota 6)) (filter even? (iota 6)))  ; => #t",
    ["(equal? (filter even? (iota 6)) (filter even? (iota 6)))"],
)

with open("/Users/alfred/code/motoi-scheme/scratch/sft-plans/prototype-shapes-0-5.jsonl", "w") as f:
    for rec in pairs:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

print(f"wrote {len(pairs)} pairs")
by_shape = {}
total_blocks = 0
for rec in pairs:
    by_shape[rec["shape"]] = by_shape.get(rec["shape"], 0) + 1
    total_blocks += len(rec["code_blocks"])
print("by shape:", by_shape)
print("total code blocks:", total_blocks)
