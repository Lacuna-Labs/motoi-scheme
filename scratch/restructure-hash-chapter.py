#!/usr/bin/env python3
"""Restructure 32-hash.slat for SRFI-125 conformance.

- Drop divergent verb blocks: hash-ref, hash-set! (Sakura short aliases, unbound),
  and the WEAK hash-table-contains? block (framed as "alias for hash-table-exists?").
- Rename the RICH hash-table-exists? block -> hash-table-contains?, :std SRFI-125.
- Globally rewrite remaining hash-table-exists? program sites -> hash-table-contains?.

String-aware paren matcher: parens inside "..." literals (with \\" escapes) don't count.
Dry-run by default; pass 'write' to save.
"""
import sys

PATH = "Scheme/reference/32-hash.slat"

def find_verbs(text):
    """Return list of (start_idx, end_idx, name) for each top-level (verb ...) form."""
    verbs = []
    i = 0
    n = len(text)
    while i < n:
        j = text.find("(verb ", i)
        if j == -1:
            break
        # paren-match from j, string-aware
        depth = 0
        k = j
        in_str = False
        while k < n:
            c = text[k]
            if in_str:
                if c == "\\":
                    k += 2
                    continue
                if c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        break
            k += 1
        end = k + 1  # index just past closing paren
        # extract :name "..."
        head = text[j:j+200]
        m = head.find(':name "')
        name = None
        if m != -1:
            s = m + len(':name "')
            e = head.find('"', s)
            name = head[s:e]
        verbs.append((j, end, name))
        i = end
    return verbs

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dry"
    with open(PATH) as fh:
        text = fh.read()
    verbs = find_verbs(text)
    print(f"found {len(verbs)} verb blocks")

    DROP = {"hash-ref", "hash-set!", "hash-table-contains?"}
    RENAME = "hash-table-exists?"

    # Build new text by walking verbs; keep inter-verb text (blank lines/header).
    out = []
    prev_end = 0
    kept = []
    dropped = []
    for (a, b, name) in verbs:
        gap = text[prev_end:a]
        block = text[a:b]
        if name in DROP:
            dropped.append(name)
            # swallow the trailing blank separator that followed this block:
            # keep the gap BEFORE, drop one trailing "\n\n" after by not emitting;
            # we handle separators by only emitting gap+block for kept verbs.
            # To avoid double blanks, we skip emitting this block AND its following gap.
            prev_end = b
            # also consume following blank lines
            while prev_end < len(text) and text[prev_end] == "\n":
                # peek: keep exactly the newlines; but to prevent blank pileup,
                # drop up to 2 leading newlines after a dropped block
                break
            continue
        if name == RENAME:
            block = block.replace(
                '(verb :name "hash-table-exists?" :std "Motoi"',
                '(verb :name "hash-table-contains?" :std "SRFI-125"', 1)
            kept.append("hash-table-contains? (from exists?)")
        else:
            kept.append(name)
        out.append(gap)
        out.append(block)
        prev_end = b
    out.append(text[prev_end:])
    new = "".join(out)

    # Global rewrite of any remaining exists? program sites.
    before = new.count("hash-table-exists?")
    new = new.replace("hash-table-exists?", "hash-table-contains?")
    # collapse any triple+ newlines from dropped-block gaps
    while "\n\n\n\n" in new:
        new = new.replace("\n\n\n\n", "\n\n\n")

    print("dropped:", dropped)
    print("kept count:", len(kept))
    print(f"remaining exists? sites rewritten: {before}")
    print(f"final exists? count (should be 0): {new.count('hash-table-exists?')}")
    print(f"final contains? count: {new.count('hash-table-contains?')}")
    print(f"hash-ref count (should be 0): {new.count('hash-ref')}")
    print(f"hash-set! count (should be 0): {new.count('hash-set!')}")

    if mode == "write":
        with open(PATH, "w") as fh:
            fh.write(new)
        print("WROTE", PATH)
    else:
        print("dry-run; pass 'write' to save")

if __name__ == "__main__":
    main()
