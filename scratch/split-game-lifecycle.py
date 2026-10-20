import re, sys
from pathlib import Path
p = Path('scheme/reference/28-game.slat')
text = p.read_text()

# Split into top-level (verb ...) records by paren-depth scanning.
def find_verbs(t):
    recs = []
    i = 0
    while True:
        m = t.find('\n(verb', i)
        if m < 0: break
        start = m+1
        depth = 0
        j = start
        while j < len(t):
            c = t[j]
            if c == '"':
                j += 1
                while j < len(t) and t[j] != '"':
                    if t[j] == '\\': j += 1
                    j += 1
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    recs.append((start, j+1))
                    break
            j += 1
        i = j+1
    return recs

recs = find_verbs(text)
LIFECYCLE = {'game/frame','game/running?','game/state','game/step','game/stop'}
life_spans = []
other_names = []
for (s,e) in recs:
    body = text[s:e]
    nm = re.search(r':name\s+"([^"]+)"', body)
    name = nm.group(1) if nm else '?'
    if name in LIFECYCLE:
        life_spans.append((s,e,name))
    else:
        other_names.append((name, body))

print("total verb records:", len(recs))
print("lifecycle records:", [n for _,_,n in life_spans])
print("other records:", len(other_names))

# Check if any OTHER record references a lifecycle name in its body
for name, body in other_names:
    hits = [lc for lc in LIFECYCLE if lc in body]
    if hits:
        print("  CROSS-REF in", name, "->", hits)

# Write extraction + trimmed chapter
life_spans.sort()
preserved = "\n\n".join(text[s:e] for (s,e,_) in life_spans)
Path('scratch/28-game.lifecycle-records.original.txt').write_text(preserved)

# Build trimmed text by removing lifecycle spans (with surrounding blank lines)
spans = sorted([(s,e) for (s,e,_) in life_spans])
out = []
prev = 0
for (s,e) in spans:
    # include the preceding newline boundary: trim back to line start
    ls = text.rfind('\n', 0, s)  # start of the '(verb' line minus 1
    out.append(text[prev:s])
    prev = e
out.append(text[prev:])
trimmed = "".join(out)
# collapse 3+ blank lines
trimmed = re.sub(r'\n{4,}', '\n\n\n', trimmed)
Path('scheme/reference/28-game.slat').write_text(trimmed)
print("wrote trimmed chapter; remaining verb records:", len(find_verbs(trimmed)))
