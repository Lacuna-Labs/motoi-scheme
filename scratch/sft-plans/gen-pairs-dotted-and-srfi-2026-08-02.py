#!/usr/bin/env python3
"""Stage SFT pairs for the 2026-08-02 additions: real dotted pairs and the
SRFI-1/13/125 verbs.

ADD-ONLY. Writes one new .jsonl under scratch/sft-plans/. Touches no existing
lane file and no fold.

Every code block is executed by ./bin/motoi before it is emitted. A pair whose
documented output does not match what the interpreter actually prints is a
hard failure, not a warning -- the whole point of these pairs is that the
model learns what the machine does, not what an author remembered.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOTOI = ROOT / "bin" / "motoi"
OUT = ROOT / "scratch" / "sft-plans" / "pairs-dotted-and-srfi-2026-08-02.jsonl"


def run(code):
    """Evaluate one expression and return what motoi writes for it."""
    prog = f"(write {code})"
    r = subprocess.run(
        [str(MOTOI), "run", "/dev/stdin"],
        input=prog, capture_output=True, text=True, cwd=ROOT,
    )
    if r.returncode != 0:
        return "ERROR: " + (r.stderr or r.stdout).strip().splitlines()[0]
    return r.stdout.strip()


# (code, expected) -- expected is asserted against the live interpreter.
CHECKS = []


def ck(code, expected):
    CHECKS.append((code, expected))
    return code


PAIRS = []


def pair(shape, instruction, response, blocks):
    PAIRS.append({
        "shape": shape,
        "instruction": instruction,
        "response": response,
        "code_blocks": blocks,
        "lane": "dotted-pairs-and-srfi-2026-08-02",
    })


# ---------------------------------------------------------------------------
# Family P -- the pair/list shape confusion. Debugger shape: the symptom is a
# wrong value, not an error, so the lesson is how to READ the extra parens.
# ---------------------------------------------------------------------------

ck("(cons 1 2)", "(1 . 2)")
ck("(pair? (cons 1 2))", "#t")
ck("(list? (cons 1 2))", "#f")
ck("(cdr (cons 'volume 7))", "7")

pair(
    "P1",
    "What does `(cons 1 2)` give me? I expected a two-element list.",
    "A **pair**, not a list:\n\n    (cons 1 2)\n    ;=> (1 . 2)\n\nThe dot is the printer telling you this is one cons cell whose rest is `2` "
    "rather than a list. Every list is a chain of conses ending in `'()` -- `(1 2)` is really "
    "`(cons 1 (cons 2 '()))`. When you cons onto `2` instead of onto a list, the chain never "
    "reaches `'()`, so it is not a list.\n\nBoth predicates are telling the truth about it:\n\n"
    "    (pair? (cons 1 2))\n    ;=> #t\n    (list? (cons 1 2))\n    ;=> #f\n\n"
    "`pair?` asks *is there a cons cell here*. `list?` asks *does it end properly*.\n\n"
    "This is not a mistake to avoid -- it is the shape you want when gluing a label to a value, "
    "because the value sits right in the `cdr`:\n\n    (cdr (cons 'volume 7))\n    ;=> 7\n\n"
    "If you wanted the two-element list, say so: `(list 1 2)`.",
    ["(cons 1 2)", "(pair? (cons 1 2))", "(list? (cons 1 2))", "(cdr (cons 'volume 7))"],
)

ck("(cdr (assoc 'b '((a 1) (b 2))))", "(2)")
ck("(cadr (assoc 'b '((a 1) (b 2))))", "2")
ck("(cdr (assoc 'b '((a . 1) (b . 2))))", "2")

pair(
    "P2",
    "My config lookup returns `(2)` instead of `2` and then the arithmetic blows up. "
    "Nothing errors at the lookup. What am I doing wrong?",
    "That extra layer of parentheses is the diagnosis. You built a **list-shaped** alist and "
    "read it **pair-style**.\n\n    (cdr (assoc 'b '((a 1) (b 2))))\n    ;=> (2)\n\n"
    "`(b 2)` is a two-element list. `cdr` of it is everything-after-the-first, which is the "
    "one-element list `(2)`. To get the value out of a two-element list you want `cadr`:\n\n"
    "    (cadr (assoc 'b '((a 1) (b 2))))\n    ;=> 2\n\n"
    "The other shape is a real pair, and *that* one is read with `cdr`:\n\n"
    "    (cdr (assoc 'b '((a . 1) (b . 2))))\n    ;=> 2\n\n"
    "The reason nothing errored at the lookup is that `assoc` finds either shape happily -- it "
    "only compares the `car`. So the mismatch survives until something downstream demands a "
    "number, and the message you finally get is about arithmetic, several frames from the "
    "actual mistake.\n\n**The habit worth building:** when a lookup hands your value back "
    "wrapped in one extra layer of parens, that layer is naming the shape you actually built. "
    "Fix the accessor, not the thing that raised. Pair alist -> `cdr`. List alist -> `cadr`.",
    ["(cdr (assoc 'b '((a 1) (b 2))))",
     "(cadr (assoc 'b '((a 1) (b 2))))",
     "(cdr (assoc 'b '((a . 1) (b . 2))))"],
)

ck("(list? (cons 1 '(2 3)))", "#t")
ck("(pair? '())", "#f")
ck("(null? '())", "#t")

pair(
    "P3",
    "When should I use `pair?` and when `list?`?",
    "`pair?` asks whether there is a cons cell at all. `list?` asks whether the chain ends "
    "properly in `'()`.\n\n    (pair? (cons 1 2))      ;=> #t     one cons cell\n"
    "    (list? (cons 1 2))      ;=> #f     but it ends in 2\n"
    "    (list? (cons 1 '(2 3))) ;=> #t     ends in '()\n\n"
    "Neither is true of the empty list, which is why `null?` exists:\n\n"
    "    (pair? '())  ;=> #f\n    (null? '())  ;=> #t\n\n"
    "Most list-walking code wants `pair?`, because the question it is really asking is *is "
    "there more to do* -- and `null?` for *am I done*. Those two cover every case. Reach for "
    "`list?` only when you specifically have to reject a dotted tail, and know that it costs a "
    "full walk of the list to answer.",
    ["(pair? (cons 1 2))", "(list? (cons 1 2))", "(list? (cons 1 '(2 3)))",
     "(pair? '())", "(null? '())"],
)

# ---------------------------------------------------------------------------
# Family V -- reversal shape. Hand-rolled spelling <-> standard verb, in both
# directions, with the reason the standard one is better than a style note.
# ---------------------------------------------------------------------------

ck("(filter (lambda (x) (not (even? x))) '(1 2 3 4))", "(1 3)")
ck("(remove even? '(1 2 3 4))", "(1 3)")

pair(
    "V1",
    "Is there a shorter way to write `(filter (lambda (x) (not (even? x))) lst)`?",
    "Yes -- `remove`, from SRFI-1. It is `filter` with the test read the other way round, so "
    "the `not` disappears:\n\n    (filter (lambda (x) (not (even? x))) '(1 2 3 4))\n    ;=> (1 3)\n"
    "    (remove even? '(1 2 3 4))\n    ;=> (1 3)\n\n"
    "Same answer, same single pass. The win is that the code now says what you meant. A "
    "negated predicate makes a reader hold two things at once -- the test, and the inversion "
    "of the test -- and that is exactly where an off-by-one in the logic hides.\n\n"
    "Rule of thumb: reach for whichever of `filter` / `remove` lets you write the condition "
    "without a leading `not`.",
    ["(filter (lambda (x) (not (even? x))) '(1 2 3 4))", "(remove even? '(1 2 3 4))"],
)

ck('(string=? (substring "foobar" 0 3) "foo")', "#t")
ck('(string-prefix? "foo" "foobar")', "#t")
ck('(string-prefix? "foobar!" "foo")', "#f")
ck('(substring "ab" 0 3)', '"ab"')

pair(
    "V2",
    "I test prefixes with `(string=? (substring s 0 3) \"foo\")`. Anything wrong with that?",
    "It gives the right answer here, but it is resting on something the standard does not "
    "promise. Ask for more characters than the string has and you get back what there was:\n\n"
    "    (substring \"ab\" 0 3)\n    ;=> \"ab\"\n\n"
    "That silent clamp is what makes the test work on short input -- `\"ab\"` is not `\"foo\"`, "
    "so you get `#f`, which is correct. But **R7RS section 6.7 requires** `0 <= start <= end <= "
    "(string-length s)`, and a conforming Scheme is entitled to raise instead of clamping. So "
    "the prefix test above is not portable: it is correct here and an error elsewhere, which is "
    "the worst way for a bug to travel.\n\n"
    "`string-prefix?` from SRFI-13 asks the question directly and does not depend on any of "
    "that:\n\n    (string-prefix? \"foo\" \"foobar\")   ;=> #t\n"
    "    (string-prefix? \"foobar!\" \"foo\")   ;=> #f\n\n"
    "Note the argument order -- prefix first, the string being tested second. `string-suffix?` "
    "is the same shape for the other end. Both also read as the question you were actually "
    "asking, which the `substring` version never quite does.",
    ['(string-prefix? "foo" "foobar")', '(string-prefix? "foobar!" "foo")',
     '(substring "ab" 0 3)'],
)

ck('(= (string-length "") 0)', "#t")
ck('(string-null? "")', "#t")
ck('(string-null? "x")', "#f")

pair(
    "V3",
    "Rewrite `(= (string-length s) 0)` using the standard library.",
    "    (string-null? \"\")   ;=> #t\n    (string-null? \"x\")  ;=> #f\n\n"
    "`string-null?` is SRFI-13 and says the thing you actually mean. `(= (string-length s) 0)` "
    "gets there too --\n\n    (= (string-length \"\") 0)\n    ;=> #t\n\n"
    "-- but it asks the machine to count the whole string in order to compare the count against "
    "zero, and it makes the reader decode an arithmetic expression to recover a yes/no question. "
    "Prefer the predicate that names the question.",
    ['(string-null? "")', '(string-null? "x")', '(= (string-length "") 0)'],
)

ck("(cons 1 (cons 2 '(3 4)))", "(1 2 3 4)")
ck("(cons* 1 2 '(3 4))", "(1 2 3 4)")

pair(
    "V4",
    "What is `cons*` for?",
    "Consing a whole run onto a list in one call instead of nesting `cons`:\n\n"
    "    (cons 1 (cons 2 '(3 4)))\n    ;=> (1 2 3 4)\n    (cons* 1 2 '(3 4))\n    ;=> (1 2 3 4)\n\n"
    "The last argument is the tail; everything before it is consed on in order. It reads "
    "left-to-right the way the result does, where the nested form makes you read outward-in.\n\n"
    "It comes from SRFI-1. The name is the convention for *the starred variant that takes a "
    "final rest argument* -- you will meet the same star on `list*` in other Lisps.",
    ["(cons 1 (cons 2 '(3 4)))", "(cons* 1 2 '(3 4))"],
)

ck("(length (filter even? '(1 2 3 4 5 6)))", "3")
ck("(count even? '(1 2 3 4 5 6))", "3")

pair(
    "V5",
    "Is `(length (filter pred lst))` the right way to count matches?",
    "It gives the right answer, but it builds an entire list only to measure it and throw it "
    "away. `count` does it in one pass with nothing allocated:\n\n"
    "    (length (filter even? '(1 2 3 4 5 6)))\n    ;=> 3\n    (count even? '(1 2 3 4 5 6))\n    ;=> 3\n\n"
    "On six elements this does not matter and you should not care. It starts to matter when the "
    "list is long or the count is inside a loop -- and either way, `count` names the operation, "
    "which means the next reader does not have to work out that the `filter` was never wanted "
    "for its own sake.",
    ["(length (filter even? '(1 2 3 4 5 6)))", "(count even? '(1 2 3 4 5 6))"],
)

ck("(any even? '(1 3 4))", "#t")
ck("(any even? '(1 3 5))", "#f")
ck("(every odd? '(1 3 5))", "#t")
ck("(any even? '())", "#f")
ck("(every odd? '())", "#t")

pair(
    "V6",
    "How do I ask 'does any element pass' and 'do all elements pass'?",
    "SRFI-1's `any` and `every`:\n\n    (any even? '(1 3 4))   ;=> #t\n    (any even? '(1 3 5))   ;=> #f\n"
    "    (every odd? '(1 3 5))  ;=> #t\n\n"
    "Both stop walking the moment the answer is settled -- `any` at the first pass, `every` at "
    "the first failure. That is why they beat `(not (null? (filter ...)))` and "
    "`(= (length lst) (length (filter ...)))`, which walk everything every time, and the second "
    "of which walks twice.\n\nThe empty list is worth memorising:\n\n"
    "    (any even? '())   ;=> #f\n    (every odd? '())  ;=> #t\n\n"
    "Nothing passed, so `any` is false. Every element passed -- there were none to fail -- so "
    "`every` is true. That is the standard convention and it is what makes `every` compose "
    "correctly when a list happens to come up empty.",
    ["(any even? '(1 3 4))", "(any even? '(1 3 5))", "(every odd? '(1 3 5))",
     "(any even? '())", "(every odd? '())"],
)

ck("(append (reverse '(3 2 1)) '(4 5))", "(1 2 3 4 5)")
ck("(append-reverse '(3 2 1) '(4 5))", "(1 2 3 4 5)")

pair(
    "V7",
    "I end a lot of loops with `(append (reverse acc) tail)`. Is there a verb for that?",
    "`append-reverse`, from SRFI-1:\n\n    (append (reverse '(3 2 1)) '(4 5))\n    ;=> (1 2 3 4 5)\n"
    "    (append-reverse '(3 2 1) '(4 5))\n    ;=> (1 2 3 4 5)\n\n"
    "It does the same job in one pass. The two-call version builds the reversed list, then "
    "copies it again inside `append`; `append-reverse` walks the first list once, consing "
    "straight onto the second.\n\n"
    "It exists precisely because the prepend-then-reverse pattern is so common: you grow an "
    "accumulator at the head because that is the O(1) end, then put it back the right way round "
    "at the finish. This is the verb for the finish.",
    ["(append (reverse '(3 2 1)) '(4 5))", "(append-reverse '(3 2 1) '(4 5))"],
)

ck("(delete 3 '(1 3 2 3))", "(1 2)")
ck("(delete-duplicates '(1 2 1 3 2))", "(1 2 3)")

pair(
    "V8",
    "What is the difference between `delete` and `delete-duplicates`?",
    "`delete` takes a value and drops every copy of it. `delete-duplicates` takes no value and "
    "drops every *repeat*, keeping the first of each:\n\n"
    "    (delete 3 '(1 3 2 3))\n    ;=> (1 2)\n    (delete-duplicates '(1 2 1 3 2))\n    ;=> (1 2 3)\n\n"
    "Both are SRFI-1 and both return a new list -- despite the names, neither mutates. That is "
    "worth saying out loud, because `delete` sounds destructive and is not. The list you passed "
    "in is untouched.",
    ["(delete 3 '(1 3 2 3))", "(delete-duplicates '(1 2 1 3 2))"],
)

ck("(take-while positive? '(3 1 -2 5))", "(3 1)")
ck("(drop-while positive? '(3 1 -2 5))", "(-2 5)")

pair(
    "V9",
    "Explain `take-while` and `drop-while` -- how are they different from `filter`?",
    "They cut the list at the **first** element that fails the test and stop looking. `filter` "
    "checks every element to the end.\n\n"
    "    (take-while positive? '(3 1 -2 5))\n    ;=> (3 1)\n"
    "    (drop-while positive? '(3 1 -2 5))\n    ;=> (-2 5)\n\n"
    "Note the `5` at the end. `filter` with `positive?` would have kept it; `take-while` "
    "stopped at `-2` and never saw it, and `drop-while` handed back everything from `-2` "
    "onward including it.\n\n"
    "That makes them the right tools for data with a *prefix structure* -- leading whitespace, "
    "a header block before a blank line, samples before a threshold is crossed -- and the wrong "
    "tool for 'keep all the ones that match', which is `filter`.",
    ["(take-while positive? '(3 1 -2 5))", "(drop-while positive? '(3 1 -2 5))"],
)

# ---------------------------------------------------------------------------
# Family X -- excluded and mis-remembered spellings. The model must answer the
# unbound-name question with the bound name AND the reason, not just correct it.
# ---------------------------------------------------------------------------

ck("(fold + 0 '(1 2 3 4))", "10")
ck("(fold-right cons '() '(1 2 3))", "(1 2 3)")
ck("(fold-left + 0 '(1 2 3 4))", "ERROR")

pair(
    "X1",
    "`(fold-left + 0 '(1 2 3 4))` says `unbound symbol: fold-left`. Why isn't it there?",
    "Because Motoi's fold is SRFI-1's, and `fold-left` is R6RS. They differ in argument order, "
    "which is exactly the kind of difference that does not announce itself:\n\n"
    "- SRFI-1 `fold` calls `(f element accumulator)` -- **element first**.\n"
    "- R6RS `fold-left` calls `(f accumulator element)` -- accumulator first.\n\n"
    "With `+` you would never notice. With `cons` you get a different list. Binding both would "
    "mean two folds in one language that look interchangeable and are not, so only one is "
    "bound:\n\n    (fold + 0 '(1 2 3 4))\n    ;=> 10\n    (fold-right cons '() '(1 2 3))\n    ;=> (1 2 3)\n\n"
    "`foldl` and `foldr`, the Racket spellings, are unbound for the same reason. Getting "
    "`unbound symbol: fold-left` is the intended outcome -- it is a loud failure in place of a "
    "quiet wrong answer.",
    ["(fold + 0 '(1 2 3 4))", "(fold-right cons '() '(1 2 3))"],
)

ck('(string-contains "hello world" "world")', "6")
ck('(string-contains "hello" "zz")', "#f")
ck('(string-contains "abc" "a")', "0")

pair(
    "X2",
    "Is it `string-contains?` or `string-contains`? And what does it return?",
    "`string-contains`, no question mark -- and that is a warning, not a typo. It does not "
    "return a boolean. It returns the **index** of the first match, or `#f`:\n\n"
    "    (string-contains \"hello world\" \"world\")\n    ;=> 6\n"
    "    (string-contains \"hello\" \"zz\")\n    ;=> #f\n\n"
    "Which means this is a trap:\n\n    (string-contains \"abc\" \"a\")\n    ;=> 0\n\n"
    "A match at the very start returns `0`. So `(> (string-contains s sub) 0)` reports *not "
    "found* for a string that begins with what you were looking for, and `(if (string-contains "
    "s sub) ...)` is correct, because `0` is truthy in Scheme and only `#f` is false.\n\n"
    "The naming convention is doing real work here: in Scheme a trailing `?` promises a "
    "boolean. No `?` means the return value carries information, and you should look at what "
    "it is before testing it.",
    ['(string-contains "hello world" "world")', '(string-contains "hello" "zz")',
     '(string-contains "abc" "a")'],
)

ck("(hash-table-contains? (let ((h (make-hash-table))) (hash-table-set! h 'a 1) h) 'a)", "#t")
ck("(hash-table-ref/default (make-hash-table) 'missing 'none)", "none")

pair(
    "X3",
    "I keep writing `hash-table-exists?` and it's unbound. What's the right name?",
    "`hash-table-contains?`. `hash-table-exists?` is the **SRFI-69** spelling; the hash table "
    "part here is **SRFI-125**, which renamed it.\n\n"
    "    (define h (make-hash-table))\n    (hash-table-set! h 'a 1)\n"
    "    (hash-table-contains? h 'a)\n    ;=> #t\n\n"
    "Often the membership test is not what you actually want. If you are about to branch on "
    "presence just to supply a fallback, ask for the fallback directly:\n\n"
    "    (hash-table-ref/default (make-hash-table) 'missing 'none)\n    ;=> none\n\n"
    "That is one lookup instead of two, and it removes a branch where a race or a typo could "
    "make the two lookups disagree. `hash-table-ref` without a default raises on a miss, which "
    "is the right choice when absence really is a bug.",
    ["(hash-table-contains? (let ((h (make-hash-table))) (hash-table-set! h 'a 1) h) 'a)",
     "(hash-table-ref/default (make-hash-table) 'missing 'none)"],
)

ck("(hash-table->alist (let ((h (make-hash-table))) (hash-table-set! h 'a 1) h))", "((a 1))")

pair(
    "X4",
    "`hash-table->alist` gave me `((a 1))`. I expected `((a . 1))`. Which is it?",
    "Two-element lists, here:\n\n    (hash-table->alist h)\n    ;=> ((a 1))\n\n"
    "So you read the value with `cadr`, not `cdr`. SRFI-125 itself specifies dotted pairs "
    "`((a . 1))`, read with `cdr`, so this is a known divergence rather than the standard "
    "behaviour, and portable code should not assume it.\n\n"
    "The reason it matters more than a cosmetic difference: `cdr` against a two-element list "
    "does not raise. It hands back `(1)` -- your value wrapped in one extra list -- and the "
    "failure surfaces somewhere else entirely. If you are porting code that assumed dotted "
    "pairs, the symptom to watch for is a value arriving with one layer of parentheses too "
    "many.",
    ["(hash-table->alist (let ((h (make-hash-table))) (hash-table-set! h 'a 1) h))"],
)


def main():
    failures = []
    for code, expected in CHECKS:
        got = run(code)
        if expected == "ERROR":
            ok = got.startswith("ERROR")
        else:
            ok = got == expected
        if not ok:
            failures.append((code, expected, got))

    for code, expected, got in failures:
        print(f"MISMATCH {code}\n  expected {expected}\n  got      {got}", file=sys.stderr)
    if failures:
        print(f"\n{len(failures)}/{len(CHECKS)} checks FAILED -- nothing written.", file=sys.stderr)
        return 1

    with open(OUT, "w") as f:
        for p in PAIRS:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"{len(CHECKS)}/{len(CHECKS)} checks pass")
    print(f"{len(PAIRS)} pairs -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
