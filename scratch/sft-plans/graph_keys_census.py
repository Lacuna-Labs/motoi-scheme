#!/usr/bin/env python3
"""Rigorous per-key census of the four Motoi Jung-axis graphs.

READ-ONLY. Splits each .slat into (node ...) records by top-level paren
balance, then for each RELATION key classifies each node into one of three
states:
  populated     - key present with a non-empty value ( not "()" / not "pending")
  honest-null   - key present with empty () AND a companion :honest-null-<key> #t,
                  OR value is exactly () with a trailing honest-null comment,
                  OR the value is the literal token `pending`.
  unfilled      - key absent from the node entirely (should-have-data gap).

We only score keys against the node population that the SCHEMA expects them on.
Because the schema is tiered, we report per-key: populated / honest-null /
key-present-empty-no-flag / absent, plus which axes carry the key.
"""
import re, os, glob, collections, json

GRAPH_DIR = "/Users/alfred/code/motoi-scheme/graphs"
FILES = ["graph-of-sensation.slat", "graph-of-intuition.slat",
         "graph-of-thinking.slat", "graph-of-feeling.slat"]

# Relation / edge keys we care about (the traversable graph edges + evidence
# locators). Statistical scalars (freq/idf/tf-idf) and governance
# (dialect/audience/provenance) are NOT relation edges; we list them separately.
RELATION_KEYS = [
    "synonyms", "oppositions", "associations", "distributional-neighbors",
    "cross-refs-graph", "cross-refs-books", "related-books", "related-verbs",
    "related-principles", "appears-in-corpus", "surrounding-words",
    "relations", "context-of-use", "prerequisites",
    "example-dialogue", "examples", "used-in-programs-as",
    "example-in-world", "example-in-scheme", "short-scenario",
    "antipattern-scenario", "sensory-description", "contrast-register",
    "tf-idf-per-axis", "definition", "definition-technical",
]

def split_nodes(text):
    """Yield the text of each top-level (node ...) record via paren balancing."""
    i = 0
    n = len(text)
    while True:
        idx = text.find("\n(node", i)
        if idx == -1:
            break
        # start at the '(' after the newline
        start = idx + 1
        depth = 0
        j = start
        in_str = False
        while j < n:
            c = text[j]
            if in_str:
                if c == '\\':
                    j += 2
                    continue
                if c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == '(':
                    depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        yield text[start:j+1]
                        break
            j += 1
        i = j + 1

def key_state(node_text, key):
    """Return one of: 'absent','populated','honest-null','empty-no-flag'."""
    # find ':key' as a token (word boundary — not a longer key)
    m = re.search(r'(?<![A-Za-z0-9-]):' + re.escape(key) + r'(?![A-Za-z0-9-])', node_text)
    if not m:
        return 'absent'
    # companion honest-null flag?
    hn = re.search(r':honest-null-' + re.escape(key) + r'\s+#t', node_text)
    if hn:
        return 'honest-null'
    # examine the value right after the key
    rest = node_text[m.end():].lstrip()
    # value is a paren list, a string, or a bare token
    if rest.startswith('()'):
        # empty list; check for trailing 'pending' or honest-null comment on line
        line = rest.splitlines()[0] if rest.splitlines() else rest
        if 'honest-null' in line or 'pending' in line:
            return 'honest-null'
        return 'empty-no-flag'
    if rest.startswith('('):
        return 'populated'
    if rest.startswith('"'):
        # string value — populated if non-empty
        sm = re.match(r'"((?:[^"\\]|\\.)*)"', rest)
        if sm and sm.group(1).strip():
            return 'populated'
        return 'empty-no-flag'
    # bare token value
    tok = rest.split()[0] if rest.split() else ''
    if tok in ('pending', '()', ''):
        return 'honest-null' if tok == 'pending' else 'empty-no-flag'
    return 'populated'

census = {k: collections.Counter() for k in RELATION_KEYS}
per_axis_present = {k: collections.Counter() for k in RELATION_KEYS}
node_totals = collections.Counter()
grand_total = 0

for fn in FILES:
    axis = fn.replace("graph-of-", "").replace(".slat", "")
    path = os.path.join(GRAPH_DIR, fn)
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    cnt = 0
    for nt in split_nodes(text):
        cnt += 1
        grand_total += 1
        for k in RELATION_KEYS:
            st = key_state(nt, k)
            census[k][st] += 1
            if st != 'absent':
                per_axis_present[k][axis] += 1
    node_totals[axis] = cnt

result = {
    "grand_total_nodes": grand_total,
    "per_axis_node_count": dict(node_totals),
    "keys": {},
}
for k in RELATION_KEYS:
    c = census[k]
    present = c['populated'] + c['honest-null'] + c['empty-no-flag']
    result["keys"][k] = {
        "populated": c['populated'],
        "honest_null": c['honest-null'],
        "empty_no_flag": c['empty-no-flag'],
        "absent": c['absent'],
        "present_total": present,
        "axes_present": dict(per_axis_present[k]),
    }

print(json.dumps(result, indent=2))
