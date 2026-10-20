#!/usr/bin/env python3
"""
graph_surgery.py — remove the mined "sakura" concept nodes from the 4 axis
graphs and strip residual "sakura" tokens from surviving nodes' list/prose
fields, so those nodes stay in the fold (the fold guard drops any record still
containing 'sakura').

Blocks are top-level forms separated by blank lines. A block is DELETED if its
:id names a sakura concept. Surviving blocks are cleaned in place.

--apply to write; default dry-run.
"""
import re, sys, io, glob

APPLY = "--apply" in sys.argv
GRAPHS = sorted(glob.glob("/Users/alfred/code/motoi-scheme/graphs/graph-of-*.slat"))

ID_SAKURA = re.compile(r':id\s+"[^"]*sakuras?"')

def clean_block(b):
    # 1. weighted association elements: "sakura(9.46)"
    b = re.sub(r'"sakuras?\([^")]*\)"\s*', '', b)
    # 2. cross-refs-graph tuples that point at a sakura node
    b = re.sub(r'\(:ref-graph\s+"[^"]*"\s+:ref-id\s+"[^"]*sakuras?"\)\s*', '', b)
    # 3. quoted node-id refs
    b = re.sub(r'"(?:intuition|sensation|thinking|feeling)/sakuras?"\s*', '', b)
    # 4. bare quoted tag
    b = re.sub(r'"sakuras?"\s*', '', b)
    # 5. prose / symbol-list occurrences (comma-aware)
    b = re.sub(r'\bsakuras?\b\s*,\s*', '', b)      # "sakura, X" -> "X"
    b = re.sub(r'\s*,\s*sakuras?\b', '', b)        # "X, sakura" -> "X"
    b = re.sub(r'\bsakuras?\b', '', b)             # leftover bare
    # 6. tidy artifacts
    b = re.sub(r'\(\s+', '(', b)                   # "( gives" -> "(gives"
    b = re.sub(r'\s+\)', ')', b)                   # "device )" -> "device)"
    b = re.sub(r'[ \t]{2,}(?=\S)', lambda m: m.group(0), b)  # keep column pad
    b = re.sub(r'such as\s*\.', 'such as related concepts.', b)
    b = re.sub(r'such as\s*,\s*', 'such as ', b)
    b = re.sub(r',\s*\.', '.', b)                  # ", ." -> "."
    b = re.sub(r'\(\)', '()', b)
    return b

def main():
    for g in GRAPHS:
        with io.open(g, encoding="utf-8") as f:
            text = f.read()
        blocks = text.split("\n\n")
        out = []
        deleted = 0
        cleaned = 0
        for blk in blocks:
            if ID_SAKURA.search(blk):
                deleted += 1
                continue
            if re.search(r'sakura', blk, re.IGNORECASE):
                nb = clean_block(blk)
                if nb != blk:
                    cleaned += 1
                out.append(nb)
            else:
                out.append(blk)
        newtext = "\n\n".join(out)
        resid = len(re.findall(r'sakura', newtext, re.IGNORECASE))
        name = g.rsplit("/", 1)[-1]
        print(f"{name}: deleted {deleted} node(s), cleaned {cleaned} block(s), residual sakura={resid}")
        if APPLY:
            with io.open(g, "w", encoding="utf-8") as f:
                f.write(newtext)

if __name__ == "__main__":
    main()
