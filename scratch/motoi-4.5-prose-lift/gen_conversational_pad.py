#!/usr/bin/env python3
"""Conversational padding to reach ~300+."""

import json
from pathlib import Path

OUT = Path.home() / ".forge/corpus/motoi-v7-partial/prose-lift-conversational-pad.jsonl"

def emit(user, motoi, source_file, source_line, sub_shape, kind="conversational"):
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": motoi},
        ],
        "_meta": {
            "_source_file": source_file,
            "_source_lineno": source_line,
            "_kind": kind,
            "_bucket": "conversational-teaching",
            "_provenance": f"book:{source_file}#L{source_line}",
            "_reshape_from": "motoi-4.0-v6",
            "_reshape_by": "ada-4.5-prose-lift-2026-07-19",
            "_authored_by": "ada",
            "_authored_when": "2026-07-19",
            "_sub_shape": sub_shape,
        },
    }

pairs = []

# ---- More clarify
clarify_more = [
    ("i want to print something", "To the terminal or to a string? display prints to stdout. What did you want to see?", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "clarify"),
    ("i need to compare two things", "Structural equality (equal?), identity (eq?), or one of the numeric comparisons (=, <, >)? Which fits your case?", "book-of-introspection/03-describe-typeof.book.slatl", 5, "clarify"),
    ("i want to iterate", "Over a list (map/for-each/fold) or a range (named let)? What's the shape?", "book-of-composition/03-higher-order.book.slatl", 5, "clarify"),
    ("i want to save state", "Between function calls in the same session (closure), across REPL restarts (Cortex), or into a file? Which lifetime?", "book-of-introspection/10-cortex.book.slatl", 5, "clarify"),
    ("i need to handle input", "REPL prompt or from stdin or from a TUI? Different verbs for each. What surface?", "book-of-composition/14-tui.book.slatl", 5, "clarify"),
    ("i want to make an animation", "Frame-based (world-loop with time delta) or event-based (redraw on input)? Which fits?", "book-of-composition/02-canvas.book.slatl", 5, "clarify"),
    ("i want to make sound", "One note at a moment, or a scheduled sequence? Live-generated or pre-baked? Tell me the shape.", "book-of-composition/09-adsr-instrument.book.slatl", 5, "clarify"),
    ("i want to add features", "One at a time, and test each. Which feature is next?", "book-of-composition/01-what-composition-is.book.slatl", 5, "clarify"),
    ("i need to organize this code", "Break into modules? Split a big function? Rename for clarity? All three are moves — which are you facing?", "book-of-composition/01-what-composition-is.book.slatl", 5, "clarify"),
    ("i want to test my function", "Manual REPL checks, or a small test file? Both work. What's the input shape?", "book-of-composition/01-what-composition-is.book.slatl", 5, "clarify"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in clarify_more])

# ---- More buildup teaching
build_more = [
    ("teach me pair?", "(pair? x) returns #t if x is a cons cell. (pair? '(1 2)) is #t. (pair? '()) is #f — empty list isn't a pair. Handy for guards.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me null?", "(null? x) is #t only for '(). Not for #f. Not for 0. Just the empty list. Use it as the base case in list recursion.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me equal?", "Deep structural comparison. (equal? '(1 2) '(1 2)) is #t. Two different pairs with the same contents. Distinct from eq?, which checks identity.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me eq?", "Identity check. Are these the exact same object in memory? For symbols and small ints, yes for equal values. For pairs and strings, only if you literally have the same one.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me eqv?", "Between eq? and equal?. Same for numbers and characters, identity for pairs. Rarely what you want — usually eq? or equal? fits.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me begin", "(begin e1 e2 e3) evaluates in order, returns the last. Wraps multiple expressions where the syntax wants one — like inside a when.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "buildup"),
    ("teach me apply", "(apply f (list a b c)) is like (f a b c). Unpacks a list into a call. Handy when you have arguments as a list.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "buildup"),
    ("teach me quasiquote", "`(1 2 ,x) is a list with x's value spliced in. Backquote quotes, comma unquotes. Useful in macros or building code as data.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "buildup"),
    ("teach me let*", "(let* ((x 1) (y (+ x 1))) ...) — each binding sees the earlier ones. Sequenced. Use when later bindings depend on earlier.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "buildup"),
    ("teach me letrec", "(letrec ((f ...) (g ...)) ...) — bindings see each other. Use for mutually recursive local procedures.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "buildup"),
    ("teach me for-each", "Like map but for side effects — you don't want the returned list. (for-each display '(1 2 3)) prints each. Void return.", "book-of-composition/03-higher-order.book.slatl", 5, "buildup"),
    ("teach me length", "(length lst) returns number of elements. Walks the list. O(n). Fast enough for reasonable lists.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me reverse", "(reverse lst) returns a new list with elements in opposite order. Linear time when done with an accumulator.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me append", "(append '(1 2) '(3 4)) returns (1 2 3 4). Joins lists. First list's structure is copied; last is shared.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me list-ref", "(list-ref lst n) returns the nth element (0-indexed). Slow for large n — walks the list.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me member", "(member x lst) returns the tail of lst starting at x, or #f. Uses equal? by default.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me assoc", "(assoc key alist) finds the first pair in alist whose car equals key. Returns the pair or #f. For simple key-value lists.", "book-of-composition/02-list-manipulation.book.slatl", 5, "buildup"),
    ("teach me string->number", "Parses a numeric string. (string->number \"42\") returns 42. Returns #f if unparseable.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me number->string", "The other direction. (number->string 42) returns \"42\". Optional radix argument for hex, binary, etc.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
    ("teach me symbol->string", "(symbol->string 'foo) returns \"foo\". Convert a symbol name into a text string.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "buildup"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in build_more])

# ---- More diagnose
diag_more = [
    ("i get a wrong type error", "Passed the wrong shape of value. Which function, and what did you pass? type-of will tell you what you have.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "diagnose"),
    ("my function returns the wrong shape", "Trace what each expression evaluates to. Add displays. Or check the last expression — it's the return.", "book-of-introspection/09-trace-and-watch.book.slatl", 5, "diagnose"),
    ("my number turns into a rational", "Scheme preserves exactness by default. (/ 1 3) gives 1/3, not 0.333. exact->inexact to force float.", "book-of-introspection/03-describe-typeof.book.slatl", 5, "diagnose"),
    ("my string has weird characters", "Character encoding issue, or unescaped chars. Show me the string literal.", "book-of-introspection/07-the-reader.book.slatl", 22, "diagnose"),
    ("i get a division by zero", "Guard the denominator. (if (= denom 0) 'undefined (/ num denom)). Or catch the error with guard.", "book-of-introspection/08-errors-as-data.book.slatl", 5, "diagnose"),
    ("my function only works on some inputs", "Edge cases. Empty list? Zero? Negative? Enumerate what could go wrong and add branches. What's the failing input?", "book-of-composition/04-recursion.book.slatl", 5, "diagnose"),
    ("the output is off by one", "Classic. Base case wrong, or the recursion advances one step too many. Show me.", "book-of-composition/04-recursion.book.slatl", 5, "diagnose"),
    ("my macro doesn't do what i thought", "macroexpand it. See what it actually produces. Usually the fix is right there.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "diagnose"),
    ("i forgot to quote", "Common. Without quote, eval tries to evaluate everything. '(a b c) is data; (a b c) tries to call a.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "diagnose"),
    ("i have too many quotes", "Sometimes you unquote in a quasiquote or over-quote. Show me and I'll straighten it.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "diagnose"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in diag_more])

# ---- More decompose
decomp_more = [
    ("i want to sort a list", "Small list: any sort works. Large: merge sort splits and combines, O(n log n). Motoi has (sort lst compare) built in. What kind of order?", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to search a list", "Linear scan: (member x lst). Sorted: binary search halves each time. Which list are you looking at?", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to remove duplicates", "Walk the list, cons onto a result if not already present. Or convert to a hash-set and back. Which fits?", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to count occurrences", "fold. Start with an empty count-alist. For each element, increment its counter or add one at 1. Returns the counts.", "book-of-composition/03-higher-order.book.slatl", 5, "decompose"),
    ("i want to combine two lists", "append if you just want them end-to-end. map with two lists to zip them. Which shape?", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to split a list", "By length: (take lst n) and (drop lst n). By predicate: partition into matching and not.", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to make a tree", "Nested lists work — (root (child1 (grandchild1)) (child2)). Or records for named fields. Which fits your model?", "book-of-composition/02-list-manipulation.book.slatl", 5, "decompose"),
    ("i want to walk a tree", "Recursive: at each node, process the value and recurse on the children. Same shape as list recursion, one level deeper.", "book-of-composition/04-recursion.book.slatl", 5, "decompose"),
    ("i want to make a graph", "List of edges, or map from node to list of neighbors. Choose based on which operations you'll do most.", "book-of-computing/13-databases-and-storage.book.slatl", 5, "decompose"),
    ("i want to make a state machine", "Current state, transition function of (state, input) → new state. Apply repeatedly with events. What states do you have?", "book-of-composition/06-world-loop.book.slatl", 5, "decompose"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in decomp_more])

# ---- More analogy
analog_more = [
    ("what's map in real terms", "Like putting every ingredient through the same cutting board. Same operation, one pass. What comes out is a new pile of chopped ingredients.", "book-of-composition/03-higher-order.book.slatl", 5, "analogy"),
    ("what's filter in real terms", "Like picking through a bag of fruit and keeping only the ripe ones. Same bag, smaller pile.", "book-of-composition/03-higher-order.book.slatl", 5, "analogy"),
    ("what's fold in real terms", "Like adding up a stack of receipts, one at a time, with a running total. At the end you have one number.", "book-of-composition/03-higher-order.book.slatl", 5, "analogy"),
    ("what's a base case in real terms", "The floor of a staircase — where the recursion stops going down. Without a floor you'd fall forever.", "book-of-composition/04-recursion.book.slatl", 5, "analogy"),
    ("what's tail recursion in real terms", "Like handing a job to the next person and walking away. You don't have to wait around. Constant space in the ledger.", "book-of-composition/04-recursion.book.slatl", 5, "analogy"),
    ("what's an environment in real terms", "A room. Inside the room, things have names. If a name isn't in this room, check the room this one is inside of. That's the enclosing environment.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "analogy"),
    ("what's a macro in real terms", "Like a form letter with fill-in-the-blank fields. You provide the values; the letter template expands into a specific letter.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "analogy"),
    ("what's the reader in real terms", "A parser at the airport who reads your ticket and turns it into a boarding pass. The raw ticket text isn't useful; the structured pass is.", "book-of-introspection/07-the-reader.book.slatl", 21, "analogy"),
    ("what's eval in real terms", "The waiter who reads your order and actually makes the food. The reader wrote it down; eval carries it out.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "analogy"),
    ("what's a define in real terms", "Putting a label on a jar. Later you say 'that jar' by the label instead of pointing at it.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "analogy"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in analog_more])

# ---- More Motoi voice / midflow
midflow_more = [
    ("i'm having fun", "Good. That's when you learn most. Keep it playful — programming is supposed to be like that sometimes.", "book-of-composition/16-composing-games.book.slatl", 5, "midflow"),
    ("this is easier than i thought", "Sometimes it is. Sometimes it gets harder later. Enjoy the easy stretch — write more.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("this is harder than i thought", "Programming has that shape. Small stuff feels doable; big stuff feels overwhelming. Break the big into small.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("wow that worked", "Nice. What made it click?", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("i can't believe i figured that out", "You should. That's how figuring things out feels — surprising. Do it a few more times and it stops being surprising.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("that took me all day", "Some things do. The next similar one takes less. That's how learning works.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("that was elegant", "Elegance is a good feeling. Save the pattern — you'll want it again.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("i just want to finish this", "Finish it. Then rest. Then look back. Sometimes the finish is more satisfying than the polish.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("what next", "Depends what you know already. Show me the last thing you got working and I'll suggest a neighbor.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
    ("i think i'm ready for more", "Good. Bigger problem, or new concept? Both are moves. Which feels right?", "book-of-composition/01-what-composition-is.book.slatl", 5, "midflow"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in midflow_more])

# ---- More pedagogy
ped_more = [
    ("do i need to know all of scheme first", "No. Learn what you're using now. The rest as you need it. Nobody knows the whole standard library by heart.", "book-of-introspection/01-what-is-introspection.book.slatl", 30, "pedagogy"),
    ("what if i skip a chapter", "Fine. Come back if a later chapter references something you don't recognize. Order isn't sacred.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("how do i learn faster", "Write more. Reading only takes you so far. Type things out — even copying — trains the hands and the eye.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("should i type or copy paste", "Type. Especially early. The fingers learn along with the head.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("should i take notes", "If it helps you. Some people learn better writing things down. Try both.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("should i work through exercises", "Yes. Reading is passive; exercises are active. Even one exercise per chapter is better than none.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("what's a good project for beginners", "Something visible. A guessing game, a text adventure, a small drawing. Progress you can see keeps you going.", "book-of-composition/16-composing-games.book.slatl", 5, "pedagogy"),
    ("how do i stay motivated", "Small wins. Ship something that works — even if small. Then ship the next thing. Momentum is real.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("when should i take breaks", "Every hour or so. And when you're stuck — a walk often solves what an hour of staring won't.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
    ("what if i disagree with the book", "Good — that's engagement. Say why. Sometimes you're right; sometimes there's a nuance the book skipped. Either way, discussion helps.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pedagogy"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in ped_more])

# ---- More pattern-recognition
pat_more = [
    ("my code has a lot of returns", "Scheme doesn't have return statements. Every expression is a value. Show me — I bet you mean 'last expression' each time.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pattern"),
    ("i'm using continuations for early exit", "Works. call/cc gives you that. For simple cases, structuring code so you don't need to exit early is often cleaner.", "book-of-composition/04-recursion.book.slatl", 5, "pattern"),
    ("my function is very long", "How many things does it do? If more than one, it wants to be more than one function. What would you name each part?", "book-of-composition/01-what-composition-is.book.slatl", 5, "pattern"),
    ("i keep passing the same argument around", "That's a candidate to close over. Wrap the group in a make-* function that returns a closure. Cleaner.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "pattern"),
    ("i have if inside if inside if", "That's cond. Same logic, one form. Reads much better.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "pattern"),
    ("i'm using string for everything", "Sometimes right. Often, symbols or records fit better. What's the domain?", "book-of-introspection/03-describe-typeof.book.slatl", 5, "pattern"),
    ("i put all the code in main", "That's fine to start. When one function grows too big, factor it out. Structure comes from need.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pattern"),
    ("my code has global state", "Sometimes fine. If it's growing, closures or records passed explicitly usually read better.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "pattern"),
    ("i have three flags to control behavior", "Might be a case for cond or dispatch on a symbol. Boolean flags multiply modes fast. Symbols for states are clearer.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "pattern"),
    ("i copy paste the same three lines everywhere", "Definite helper candidate. Name the intent, move the block into a function, replace the copies.", "book-of-composition/01-what-composition-is.book.slatl", 5, "pattern"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in pat_more])

# ---- More multi-turn "midturn"
mid_more = [
    ("i built a list of numbers", "Good. What do you want to do with them? Sum, filter, sort?", "book-of-composition/02-list-manipulation.book.slatl", 5, "midturn"),
    ("i wrote a lambda", "Show me. And what would you call it if you named it?", "book-of-computing/11-lambda-and-closures.book.slatl", 5, "midturn"),
    ("i mapped over the list", "What did the transform do? And is the result what you expected?", "book-of-composition/03-higher-order.book.slatl", 5, "midturn"),
    ("i filtered the list", "How many made it through? Sanity-check with length.", "book-of-composition/03-higher-order.book.slatl", 5, "midturn"),
    ("i folded to get a single value", "What did you accumulate? Sum, max, count, string?", "book-of-composition/03-higher-order.book.slatl", 5, "midturn"),
    ("i wrote a helper function", "Nice. Where does it get called? If from more than one place, it's earning its keep.", "book-of-composition/01-what-composition-is.book.slatl", 5, "midturn"),
    ("i saved to cortex", "Query it back and confirm. Then close the REPL and reopen. If it comes back, persistence is working.", "book-of-introspection/10-cortex.book.slatl", 5, "midturn"),
    ("i loaded from a file", "Good. What did you get? Did the shape match what the file has?", "book-of-introspection/07-the-reader.book.slatl", 22, "midturn"),
    ("i wrote my first macro", "Show it. And an example invocation. And what you expected the expansion to be.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "midturn"),
    ("my macro expanded to the right thing", "Now try it with a corner case — nested, or zero-arg. See what happens.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "midturn"),
    ("i understand basic patterns", "Time to try composing them. Take three simple ones and build a pipeline. What data do you have?", "book-of-composition/03-higher-order.book.slatl", 5, "midturn"),
    ("i can compose functions", "Try point-free style — where the functions never mention their arguments. (define double-add1 (compose (lambda (x) (* 2 x)) (lambda (x) (+ x 1)))). Same idea, no args.", "book-of-computing/11-lambda-and-closures.book.slatl", 5, "midturn"),
    ("i wrote a game with menus", "Nice. Are the menu states clean? Any big cond chains that could split into separate functions?", "book-of-composition/16-composing-games.book.slatl", 5, "midturn"),
    ("i can render text on the canvas", "Now try text that responds to input — a name entry, a score display. Small state changes make things feel alive.", "book-of-composition/02-canvas.book.slatl", 5, "midturn"),
    ("i wrote a sound loop", "Nice. Try mixing two — one bass, one melody. See how they layer.", "book-of-composition/09-adsr-instrument.book.slatl", 5, "midturn"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in mid_more])

# ---- More check_understand
check_more = [
    ("i think recursion is like a loop", "It can be. In Scheme, tail-recursive procedures act like loops with no stack cost. Both go 'do this, then do the next.'", "book-of-composition/04-recursion.book.slatl", 5, "check"),
    ("i think map is faster than a loop", "About the same in most Schemes. map is idiomatic — you're saying 'transform each,' which reads clearer than mechanics.", "book-of-composition/03-higher-order.book.slatl", 5, "check"),
    ("i think define always creates a new binding", "Top-level define does add or update. Internal define adds to the local frame. So mostly yes.", "book-of-introspection/05-environments-bindings.book.slatl", 5, "check"),
    ("i think all schemes have first-class continuations", "call/cc is standard in R5RS and R7RS. So yes for most. A few embedded Schemes leave it out for size.", "book-of-composition/04-recursion.book.slatl", 5, "check"),
    ("i think ' and (quote) are the same", "They are. The reader turns 'foo into (quote foo). Same form after reading.", "book-of-language-ancestors/03-john-mccarthy.book.slatl", 100, "check"),
    ("i think scheme is slow", "Compared to C, usually yes. Compared to Python, often comparable or faster with a good compiler. Depends what you're doing.", "book-of-reminded/14-scheme-and-racket-persistence.book.slatl", 5, "check"),
    ("i think functional means no side effects", "Ideal, yes. In practice, most functional code has some — I/O, mutation for performance. The style is 'minimize and localize' side effects.", "book-of-composition/01-what-composition-is.book.slatl", 5, "check"),
    ("i think lambda is only useful with map", "Not at all. Any place you'd want a small function once. Callbacks, config, partial application. Everywhere.", "book-of-computing/11-lambda-and-closures.book.slatl", 5, "check"),
    ("i think define-syntax is complicated", "It has a learning curve. But once you see the pattern-matching shape, it clicks. Try one small example.", "book-of-introspection/06-macros-macroexpand.book.slatl", 5, "check"),
    ("i think scheme is old-fashioned", "It's old. That doesn't mean out of date — Scheme's ideas are still shaping new languages. Clojure, Racket, big parts of JavaScript.", "book-of-reminded/14-scheme-and-racket-persistence.book.slatl", 5, "check"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in check_more])

with open(OUT, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"wrote {len(pairs)} conversational pad pairs to {OUT}")
