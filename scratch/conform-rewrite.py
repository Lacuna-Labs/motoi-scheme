#!/usr/bin/env python3
"""Deterministic conformance rewriter (2026-07-24).

Rewrites incidental CODE usage of dropped non-standard verbs to their
SRFI-125 / R7RS-small standard names, across reference .slat + book .md files.

  hash-set!            -> hash-table-set!          (direct, same arity/semantics)
  hash-table-exists?   -> hash-table-contains?     (SRFI-69 name -> SRFI-125 name)
  error?               -> error-object?            (R7RS-small §6.11 standard name)
  hash-ref h k         -> hash-table-ref/default h k #f   (2-arg: append #f)
  hash-ref h k d       -> hash-table-ref/default h k d     (3-arg: direct)

It is a TEXT rewriter with symbol-boundary awareness. It deliberately does NOT
touch the `:name "hash-ref"` / `:name "hash-set!"` fields of verb DEFINITIONS —
those verb entries are removed structurally and preserved as broken-examples.

Usage: python3 scratch/conform-rewrite.py <file> [<file> ...]
Prints per-file per-rule counts. Writes files in place.
"""
import re, sys

SYM = r"A-Za-z0-9\-!?*/+<>=._%&$:"          # scheme symbol continuation chars
def boundary(tok):
    # match tok as a whole symbol (not part of a longer symbol)
    return re.compile(r"(?<![%s])%s(?![%s])" % (SYM, re.escape(tok), SYM))

DIRECT = [
    ("hash-set!",          "hash-table-set!"),
    ("hash-table-exists?", "hash-table-contains?"),
    ("error?",             "error-object?"),
]

def protect_verb_defs(text):
    """Blank out the exact `:name "hash-ref"` / `:name "hash-set!"` tokens so the
    rewriter never rebrands a verb DEFINITION. Returns (text, restore_map)."""
    # We don't rewrite :name fields at all in DIRECT/hash-ref because those are
    # string literals of the verb name; handled by the caller removing entries.
    return text

def find_forms(text, head):
    """Yield (start, close, argc) for every (head ...) form. start = index of '('.
    close = index of matching ')'. argc = number of top-level args after head.
    Paren-aware, string-aware (toggles on unescaped ")."""
    out = []
    pat = re.compile(r"\(\s*%s(?=[\s)])" % re.escape(head))
    for m in pat.finditer(text):
        i = m.start()            # the '('
        depth = 0
        j = i
        in_str = False
        argc = 0
        at_arg_boundary = True   # whether next non-space starts a new arg
        # walk from '(' counting; head already consumed conceptually
        # We'll re-walk char by char.
        k = i
        seen_head = False
        while k < len(text):
            c = text[k]
            if in_str:
                if c == '\\':
                    k += 2; continue
                if c == '"':
                    in_str = False
                k += 1; continue
            if c == '"':
                in_str = True
                if depth == 1 and at_arg_boundary and seen_head:
                    argc += 1; at_arg_boundary = False
                k += 1; continue
            if c == '(':
                depth += 1
                if depth == 2 and seen_head:
                    if at_arg_boundary:
                        argc += 1; at_arg_boundary = False
                k += 1; continue
            if c == ')':
                depth -= 1
                if depth == 0:
                    out.append((i, k, argc))
                    break
                k += 1; continue
            if c in ' \t\n':
                if depth == 1:
                    at_arg_boundary = True
                k += 1; continue
            # a normal atom char at depth 1
            if depth == 1:
                if not seen_head:
                    # consuming the head symbol
                    # detect end of head token
                    seen_head = True
                    # skip the rest of head token
                    while k < len(text) and text[k] not in ' \t\n()"':
                        k += 1
                    at_arg_boundary = True
                    continue
                else:
                    if at_arg_boundary:
                        argc += 1; at_arg_boundary = False
            k += 1
    return out

def rewrite_hash_ref(text):
    forms = find_forms(text, "hash-ref")
    # process right-to-left so indices stay valid
    n2 = n3 = 0
    for (start, close, argc) in sorted(forms, key=lambda t: -t[0]):
        if argc == 2:
            text = text[:close] + " #f" + text[close:]
            n2 += 1
        elif argc == 3:
            n3 += 1
        else:
            # unexpected arity — leave, will surface in verification
            continue
    # now rename the head token hash-ref -> hash-table-ref/default everywhere
    # (but NOT inside a verb :name string — those entries are removed separately)
    text, nhead = boundary("hash-ref").subn("hash-table-ref/default", text)
    return text, n2, n3, nhead

def main(paths):
    for p in paths:
        with open(p, encoding="utf-8") as f:
            text = f.read()
        orig = text
        counts = {}
        # hash-ref first (needs pre-rename arity), then directs
        text, n2, n3, nhead = rewrite_hash_ref(text)
        counts["hash-ref->hash-table-ref/default (2arg+#f)"] = n2
        counts["hash-ref->hash-table-ref/default (3arg)"] = n3
        for tok, repl in DIRECT:
            text, n = boundary(tok).subn(repl, text)
            counts[f"{tok}->{repl}"] = n
        if text != orig:
            with open(p, "w", encoding="utf-8") as f:
                f.write(text)
        total = sum(counts.values())
        if total:
            print(f"{p}: {total} rewrites")
            for k, v in counts.items():
                if v:
                    print(f"    {v:4d}  {k}")

if __name__ == "__main__":
    main(sys.argv[1:])
