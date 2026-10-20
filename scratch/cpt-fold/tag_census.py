#!/usr/bin/env python3
"""
tag_census.py — CPT-fold tag completeness instrument.

SET A = every :keyword tag present in the corpus data (reference + books + graphs),
        with occurrence count, distinct value-shapes, a sample value, and which
        sources/tiers/axes it lives in.
SET B = every tag the emitter consumes (v4 = Mk3 run, v5 = latest).
A - B  = FORGOTTEN tags (present in data, emitter never reads them).
B - A  = MISCOLLECTED / phantom tags (emitter reads a key that no data carries).

Data-only. No fabrication. Prints a report and writes JSON to scratch/cpt-fold/.
"""
import os, re, json, collections, sys

ROOT = "/Users/alfred/code/motoi-scheme"
REF_DIR   = os.path.join(ROOT, "scheme/reference")
BOOKS_DIR = os.path.join(ROOT, "scheme-books")
GRAPHS    = {
    "sensation": os.path.join(ROOT, "graphs/graph-of-sensation.slat"),
    "intuition": os.path.join(ROOT, "graphs/graph-of-intuition.slat"),
    "thinking":  os.path.join(ROOT, "graphs/graph-of-thinking.slat"),
    "feeling":   os.path.join(ROOT, "graphs/graph-of-feeling.slat"),
}
EMITTERS = {
    "v4": os.path.join(ROOT, "scripts/cpt-prep/emit_cpt_v4.py"),
    "v5": os.path.join(ROOT, "scripts/cpt-prep/emit_cpt_v5.py"),
}

# a slat key: :kebab-case-token  (leading colon, then letters/digits/hyphen)
KEY_RE = re.compile(r'(?<![\w:")#\\]):([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b')

def value_shape(rest):
    """Classify what follows a key on the same line."""
    s = rest.lstrip()
    if not s:
        return "empty/multiline"
    c = s[0]
    if c == '"':
        return "string"
    if c == '(':
        return "list"
    if c == '#':
        if s[:2] in ('#t', '#f'):
            return "bool"
        if s.startswith('#\\'):
            return "char"
        return "reader-macro"
    if c == ':':
        return "keyword"
    if re.match(r'-?\d', s):
        return "number"
    return "symbol"

KEY_POS_RE = re.compile(r'^\s*\(?:([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b')

def scan_file(path):
    """Return dict tag -> {count, shapes, sample, keycount} for one file.
    keycount = times the tag appeared in KEY position (first token on line),
    which is the schema-key signal we diff against the emitter."""
    out = collections.defaultdict(lambda: {"count": 0, "keycount": 0, "shapes": set(), "sample": None})
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
    except Exception as e:
        print(f"  !! cannot read {path}: {e}", file=sys.stderr)
        return out, 0
    for line in text.splitlines():
        km = KEY_POS_RE.match(line)
        key_tag = km.group(1) if km else None
        for m in KEY_RE.finditer(line):
            tag = m.group(1)
            rest = line[m.end():]
            rec = out[tag]
            rec["count"] += 1
            if tag == key_tag and m.start() <= (km.end() - len(tag)):
                rec["keycount"] += 1
            sh = value_shape(rest)
            rec["shapes"].add(sh)
            if rec["sample"] is None:
                rec["sample"] = rest.strip()[:80]
    return out, len(text)

def merge(dst, src):
    for tag, rec in src.items():
        d = dst[tag]
        d["count"] += rec["count"]
        d["keycount"] += rec["keycount"]
        d["shapes"] |= rec["shapes"]
        if d["sample"] is None:
            d["sample"] = rec["sample"]
        d["files"] += 1

def new_bucket():
    return collections.defaultdict(lambda: {"count": 0, "keycount": 0, "shapes": set(), "sample": None, "files": 0})

# ---- SET A: walk the three source families -------------------------------
sources = {}   # source-name -> bucket
charcount = collections.Counter()

# reference (split error-cards / broken-examples / core)
ref_core = new_bucket(); ref_err = new_bucket(); ref_brk = new_bucket()
for dirpath, _, files in os.walk(REF_DIR):
    for fn in files:
        if not fn.endswith((".slat", ".slatl")):
            continue
        p = os.path.join(dirpath, fn)
        b, n = scan_file(p)
        if "error-cards" in dirpath:
            merge(ref_err, b); charcount["reference/error-cards"] += n
        elif "broken-examples" in dirpath:
            merge(ref_brk, b); charcount["reference/broken-examples"] += n
        else:
            merge(ref_core, b); charcount["reference/core"] += n
sources["reference/core"] = ref_core
sources["reference/error-cards"] = ref_err
sources["reference/broken-examples"] = ref_brk

# books — grouped, plus per-book-type tally
books_all = new_bucket()
book_files = 0
booktype_counter = collections.Counter()
booktype_missing = 0
for dirpath, _, files in os.walk(BOOKS_DIR):
    for fn in files:
        if not fn.endswith((".slat", ".slatl")):
            continue
        p = os.path.join(dirpath, fn)
        b, n = scan_file(p)
        merge(books_all, b); charcount["books"] += n; book_files += 1
        if "book-type" in b:
            # capture the value shape presence; we tally actual values separately
            pass
sources["books"] = books_all

# book-type lives in each book FOLDER's boot record (README.slat*) / manifest, not per chapter.
# Coverage = per book-of-* folder: does ANY file in it declare :book-type?
book_folders = sorted(d for d in os.listdir(BOOKS_DIR)
                      if os.path.isdir(os.path.join(BOOKS_DIR, d)))
booktype_by_folder = {}
booktype_missing_folders = []
for d in book_folders:
    fp = os.path.join(BOOKS_DIR, d)
    val = None
    for fn in os.listdir(fp):
        if not fn.endswith((".slat", ".slatl")):
            continue
        with open(os.path.join(fp, fn), encoding="utf-8", errors="replace") as f:
            txt = f.read()
        m = re.search(r':book-type\s+"?([a-z-]+)"?', txt)
        if m:
            val = m.group(1); break
    if val:
        booktype_by_folder[d] = val
        booktype_counter[val] += 1
    else:
        booktype_missing_folders.append(d)
booktype_missing = len(booktype_missing_folders)

# graphs — per axis, and per tier within axis
graph_axis = {}
graph_tier = {}   # (axis, tier) -> bucket
for axis, path in GRAPHS.items():
    b, n = scan_file(path)
    graph_axis[axis] = b
    charcount[f"graph/{axis}"] += n
for axis in GRAPHS:
    bk = new_bucket()
    merge(bk, graph_axis[axis])
    sources[f"graph/{axis}"] = bk

# ---- SET A union ----------------------------------------------------------
setA = collections.defaultdict(lambda: {"count":0,"keycount":0,"shapes":set(),"sources":set(),"sample":None})
for sname, bucket in sources.items():
    for tag, rec in bucket.items():
        a = setA[tag]
        a["count"] += rec["count"]
        a["keycount"] += rec["keycount"]
        a["shapes"] |= rec["shapes"]
        a["sources"].add(sname)
        if a["sample"] is None:
            a["sample"] = rec["sample"]

# schema keys = tags that appear in KEY position at least once (drops value-keywords)
setA_keys = {t: a for t, a in setA.items() if a["keycount"] > 0}

# ---- SET B: what the emitters consume ------------------------------------
def emitter_keys(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        src = f.read()
    keys = set()
    # python dict/get access on record fields: .get("x"), ["x"], get('x')
    for m in re.finditer(r'''\.get\(\s*['"]([a-zA-Z0-9_-]+)['"]''', src):
        keys.add(m.group(1))
    for m in re.finditer(r'''\[\s*['"]([a-zA-Z0-9_-]+)['"]\s*\]''', src):
        keys.add(m.group(1))
    # also slat-key string literals ":foo" the emitter may match on
    for m in re.finditer(r'''['"]:([a-z][a-z0-9-]*)['"]''', src):
        keys.add(m.group(1))
    return keys

setB = {name: emitter_keys(p) for name, p in EMITTERS.items()}

# normalize: emitter uses python_underscore; data uses kebab-case
def norm(k):
    return k.replace("_", "-").lower()

setA_norm = {norm(k): k for k in setA_keys}
report = {}
for ename, keys in setB.items():
    keys_norm = {norm(k) for k in keys}
    consumed_present = sorted(k for k in setA_keys if norm(k) in keys_norm)
    forgotten = sorted(setA_keys, key=lambda k: -setA_keys[k]["keycount"])
    forgotten = [k for k in forgotten if norm(k) not in keys_norm]
    phantom   = sorted(k for k in keys if norm(k) not in setA_norm and re.match(r'^[a-z]', k))
    report[ename] = {
        "consumed_and_present": consumed_present,
        "forgotten": forgotten,
        "phantom": phantom,
    }

# ---- OUTPUT ---------------------------------------------------------------
def sh(s): return "/".join(sorted(s))

print("="*72)
print("SET A — SCHEMA KEYS (tags in key-position) across the corpus")
print("="*72)
print(f"distinct schema keys: {len(setA_keys)}   (distinct raw tokens incl. values: {len(setA)})")
print(f"total key occurrences: {sum(a['keycount'] for a in setA_keys.values()):,}")
print()
print(f"{'key':38} {'keys':>8}  shapes / sources")
for tag in sorted(setA_keys, key=lambda t: -setA_keys[t]["keycount"]):
    a = setA_keys[tag]
    print(f"  :{tag:36} {a['keycount']:>8}  [{sh(a['shapes'])}]  {{{','.join(sorted(a['sources']))}}}")

print()
print("="*72)
print("CHAR / TOKEN counts per source  (tokens ~= chars/4)")
print("="*72)
total_chars = 0
for s in sorted(charcount):
    c = charcount[s]; total_chars += c
    print(f"  {s:34} {c:>12,} chars  ~{c//4:>11,} tok")
print(f"  {'TOTAL':34} {total_chars:>12,} chars  ~{total_chars//4:>11,} tok")

print()
print("="*72)
print("BOOK-TYPE coverage (miscollection risk)")
print("="*72)
print(f"  book folders: {len(book_folders)}   book files scanned: {book_files}")
for bt, c in booktype_counter.most_common():
    print(f"    {bt:20} {c} folders")
print(f"    {'FOLDERS MISSING :book-type':26} {booktype_missing}")
for d in booktype_missing_folders:
    print(f"        - {d}")

print()
print("="*72)
print("SET B diff — per emitter")
print("="*72)
for ename in ("v4","v5"):
    r = report[ename]
    print(f"\n--- emitter {ename} ---")
    print(f"  consumed & present : {len(r['consumed_and_present'])}")
    print(f"  FORGOTTEN (in data, emitter ignores) : {len(r['forgotten'])}")
    print("     " + ", ".join(":"+t for t in r["forgotten"]))
    print(f"  PHANTOM (emitter reads, no data has)  : {len(r['phantom'])}")
    print("     " + ", ".join(r["phantom"]))

# write JSON
outp = os.path.join(ROOT, "scratch/cpt-fold/tag_census.json")
serial = {
    "setA": {t: {"count": a["count"], "shapes": sorted(a["shapes"]),
                 "sources": sorted(a["sources"]), "sample": a["sample"]}
             for t, a in setA.items()},
    "char_counts": dict(charcount),
    "book_type_coverage": dict(booktype_counter),
    "book_type_missing": booktype_missing,
    "book_files": book_files,
    "diff": report,
}
with open(outp, "w") as f:
    json.dump(serial, f, indent=2)
print(f"\nwrote {outp}")
