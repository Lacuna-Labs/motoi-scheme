#!/usr/bin/env python3
"""Inventory + migrate hash-table-ref calls for strict SRFI-125.

Strict SRFI-125: (hash-table-ref h k [failure [success]]) — the 3rd arg is a
FAILURE THUNK, not a plain value; a missing key with no failure raises.
Corpus written against old semantics used a plain VALUE as the 3rd arg. The
behavior-preserving conformance fix is: 3-arg plain-value form -> hash-table-ref/default.

Modes:
  analyze  — dry run: report every call, its argc, and arg3 shape.
  migrate  — rewrite exactly-3-arg plain-value calls to hash-table-ref/default.
             Leaves 2-arg and thunk-form (arg3 starts with '(lambda') untouched;
             reports them for manual review.
"""
import sys, os, re, glob

LIVE_GLOBS = [
    "Scheme/reference/**/*.slat",
    "scheme-books/**/*.slatl",
    "graphs/*.slat",
    "Spec/*.slat", "Spec/*.slatl",
]
# never touch these
EXCLUDE = re.compile(r"(\.claude/worktrees|node_modules|_archive|broken-examples|/EVAL-|verb-index)")

def find_calls(text, head="hash-table-ref"):
    """Yield (start, end, args_list) for each (head ...) call, argc-aware.
    Skips hash-table-ref/default and other longer heads by requiring the char
    after head to be whitespace."""
    calls = []
    i = 0
    n = len(text)
    pat = "(" + head
    while True:
        j = text.find(pat, i)
        if j < 0:
            break
        after = text[j+len(pat):j+len(pat)+1]
        if after not in (" ", "\n", "\t"):
            i = j + len(pat)          # e.g. hash-table-ref/default — skip
            continue
        # balance from the opening paren at j
        depth = 0
        k = j
        instr = False
        while k < n:
            c = text[k]
            if instr:
                if c == '\\':
                    k += 2; continue
                if c == '"':
                    instr = False
            else:
                if c == '"':
                    instr = True
                elif c == '(':
                    depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        k += 1
                        break
            k += 1
        call = text[j:k]
        calls.append((j, k, call))
        i = k
    return calls

def split_args(call, head="hash-table-ref"):
    """Return the top-level arg substrings (excluding the head)."""
    inner = call[1:-1]                  # strip outer parens
    inner = inner[len(head):].lstrip()  # drop head
    args = []
    depth = 0
    instr = False
    cur = ""
    i = 0
    while i < len(inner):
        c = inner[i]
        if instr:
            cur += c
            if c == '\\':
                if i+1 < len(inner):
                    cur += inner[i+1]; i += 2; continue
            elif c == '"':
                instr = False
            i += 1; continue
        if c == '"':
            instr = True; cur += c; i += 1; continue
        if c == '(':
            depth += 1; cur += c
        elif c == ')':
            depth -= 1; cur += c
        elif c in " \n\t" and depth == 0:
            if cur:
                args.append(cur); cur = ""
        else:
            cur += c
        i += 1
    if cur:
        args.append(cur)
    return args

def target_files():
    seen = []
    for g in LIVE_GLOBS:
        for f in glob.glob(g, recursive=True):
            if EXCLUDE.search(f):
                continue
            if f not in seen:
                seen.append(f)
    return seen

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "analyze"
    files = target_files()
    n_convert = n_2arg = n_thunk = n_4arg = 0
    twoarg_sites = []
    for f in files:
        with open(f) as fh:
            text = fh.read()
        calls = find_calls(text)
        if not calls:
            continue
        # process right-to-left so offsets stay valid on migrate
        new = text
        changes = 0
        for (a, b, call) in reversed(calls):
            args = split_args(call)
            argc = len(args)
            if argc <= 2:
                n_2arg += 1
                twoarg_sites.append((f, call[:70]))
                continue
            arg3 = args[2]
            if arg3.startswith("(lambda"):
                n_thunk += 1
                continue
            if argc >= 4:
                n_4arg += 1
                twoarg_sites.append((f, "ARGC>=4: " + call[:70]))
                continue
            # exactly 3 args, plain value -> /default
            n_convert += 1
            if mode == "migrate":
                converted = "(hash-table-ref/default" + call[len("(hash-table-ref"):]
                new = new[:a] + converted + new[b:]
                changes += 1
        if mode == "migrate" and changes:
            with open(f, "w") as fh:
                fh.write(new)
            print(f"  migrated {changes:3d}  {f}")
    print(f"\n=== {mode} summary ===")
    print(f"  3-arg plain-value -> /default : {n_convert}")
    print(f"  2-arg (manual: raises on miss): {n_2arg}")
    print(f"  thunk-form (already strict)   : {n_thunk}")
    print(f"  4+-arg (manual review)        : {n_4arg}")
    if twoarg_sites:
        print("\n  Manual-review sites:")
        for f, c in twoarg_sites:
            print(f"    {f}\n      {c}")

if __name__ == "__main__":
    main()
