#!/usr/bin/env python3
"""fold-training-corpus.py

Fold Motoi's reference + all books into a training corpus (JSONL).

Sources:
  1. Reference intro (`Scheme/reference/00-intro.slat`) → 1 self-describing pair
  2. Reference verb records (all chapters) → per-row pairs:
       Row 2 (audit)     → (:prompt "when do I reach for X in P?" :completion problem→program→explanation→meta)
       Row 3 (dimension) → (:prompt "where else does X's shape appear?" :completion setup→rungs→explanation→meta)
       Row 4 (proof)     → (:prompt "why does X hold?" :completion claim→program→invariant→meta)
       Row 5 (emergence) → (:prompt "what does X become when chained?" :completion base→composition→emergent→meta)
  3. Row-1 examples in verb records → (:prompt "how do I use X?" :completion 3-tier examples)
  4. Book chapters (`scheme-books/*/`) → chapter-level prose pairs

Output: `training-data/motoi-mk1-corpus-2026-07-19.jsonl`

NO training fires from this script. It only builds the corpus.
"""

import os, re, sys, json
from collections import defaultdict

MOTOI_ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{MOTOI_ROOT}/Scheme/reference'
BOOKS_DIR = f'{MOTOI_ROOT}/scheme-books'
OUT = f'{MOTOI_ROOT}/training-data/motoi-mk1-corpus-2026-07-19.jsonl'

def extract_records(text, tag='(verb'):
    records = []; i = 0; n = len(text)
    while i < n:
        if (i == 0 or text[i-1] == '\n') and text.startswith(tag, i):
            start = i; depth = 0; in_str = False; esc = False; j = i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0: j += 1; break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records

def get_str(rec, key):
    """Extract a string field like :prompt \"...\" from a record."""
    m = re.search(rf':{key}\s+"((?:[^"\\]|\\.)*)"', rec)
    return m.group(1) if m else None

def name(rec):
    return get_str(rec, 'name') or '<unnamed>'

def library(rec):
    return get_str(rec, 'library') or '<unknown>'

def signature(rec):
    return get_str(rec, 'signature') or ''

def summary(rec):
    return get_str(rec, 'summary') or ''

def get_row_body(rec, row_key):
    """Get the raw (paren-balanced) body of a :row-X-yyy field."""
    i = rec.find(f':{row_key}')
    if i < 0: return None
    j = i + len(f':{row_key}')
    while j < len(rec) and rec[j] in ' \t\n': j += 1
    if j >= len(rec) or rec[j] != '(': return None
    start = j; depth = 0; in_str = False; esc = False
    while j < len(rec):
        c = rec[j]
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0: return rec[start:j+1]
        j += 1
    return None

pairs = []

# 1. Reference meta-chapters — self-describing pairs
META_CHAPTERS = [
    ('00-intro.slat',
     "What is the Motoi Scheme reference manual, and how do I read it?",
     "reference-intro"),
    ('00b-introspection.slat',
     "How does Motoi see itself? What introspection tools does it have?",
     "reference-introspection"),
    ('00c-runtime-and-composition.slat',
     "How does the Motoi runtime work? How does composition happen?",
     "reference-runtime"),
    ('README.slat',
     "How is the Motoi Scheme reference manual organized in this folder?",
     "reference-readme"),
    ('MANIFEST.slat',
     "What is the machine-readable manifest of the Motoi Scheme reference?",
     "reference-manifest"),
]
for filename, prompt, kind in META_CHAPTERS:
    path = f'{REF_DIR}/{filename}'
    try:
        with open(path) as f:
            text = f.read()
        pairs.append({
            "source": f"reference/{filename}",
            "kind": kind,
            "prompt": prompt,
            "completion": text
        })
    except Exception as e:
        print(f"WARN: {filename} read failed: {e}")

# 2 + 3. Reference verb records
verb_count = 0
row_pair_counts = defaultdict(int)
for fname in sorted(os.listdir(REF_DIR)):
    if not fname.endswith('.slat'): continue
    # skip files handled as meta-chapters above OR the appendix prose
    if (fname.startswith('00-') or fname.startswith('00b-')
        or fname.startswith('00c-') or fname.startswith('99-')
        or fname == 'MANIFEST.slat' or fname == 'README.slat'):
        continue
    with open(f'{REF_DIR}/{fname}') as f:
        text = f.read()
    records = extract_records(text, '(verb')
    for rec in records:
        verb_count += 1
        vn = name(rec); lib = library(rec)
        sig = signature(rec); summ = summary(rec)
        # Row 1 — use examples field for now
        pairs.append({
            "source": f"reference/{fname}",
            "kind": "row-1-composition",
            "prompt": f"How do I use {vn}? Show me the verb in code, from small to large.",
            "completion": f"{vn} — {summ}\nSignature: {sig}\n\n" + (rec[:4000] if len(rec) > 4000 else rec)
        })
        row_pair_counts['row-1'] += 1
        # Rows 2-5
        for row_key, prompt_template in [
            ('row-2-audit',       f"When do I reach for {vn}, and why not a sibling verb?"),
            ('row-3-dimension',   f"Where else does {vn}'s shape appear?"),
            ('row-4-proof',       f"Why does {vn} hold up? What is the invariant?"),
            ('row-5-emergence',   f"What does {vn} become when chained with other verbs?"),
        ]:
            body = get_row_body(rec, row_key)
            if body:
                pairs.append({
                    "source": f"reference/{fname}",
                    "kind": row_key,
                    "prompt": prompt_template,
                    "completion": body
                })
                row_pair_counts[row_key.split('-')[1]] += 1

# 4. Book chapters
book_count = 0
chapter_count = 0
if os.path.isdir(BOOKS_DIR):
    for book_name in sorted(os.listdir(BOOKS_DIR)):
        book_path = f'{BOOKS_DIR}/{book_name}'
        if not os.path.isdir(book_path): continue
        if not book_name.startswith('book-of-'): continue
        book_count += 1
        for chap_name in sorted(os.listdir(book_path)):
            if not chap_name.endswith('.book.slatl') and not chap_name.endswith('.slatl'):
                continue
            try:
                with open(f'{book_path}/{chap_name}') as f:
                    chap_text = f.read()
                if len(chap_text) < 100: continue
                pairs.append({
                    "source": f"scheme-books/{book_name}/{chap_name}",
                    "kind": "book-chapter",
                    "prompt": f"Show me chapter {chap_name} of {book_name} in Motoi Scheme.",
                    "completion": chap_text
                })
                chapter_count += 1
            except Exception:
                pass

# write JSONL
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    for p in pairs:
        f.write(json.dumps(p, ensure_ascii=False) + '\n')

print(f"corpus written: {OUT}")
print(f"total pairs: {len(pairs)}")
print(f"  reference intro: 1")
print(f"  verb records touched: {verb_count}")
print(f"  row-1 pairs: {row_pair_counts.get('row-1', 0)}")
print(f"  row-2 pairs: {row_pair_counts.get('2', 0)}")
print(f"  row-3 pairs: {row_pair_counts.get('3', 0)}")
print(f"  row-4 pairs: {row_pair_counts.get('4', 0)}")
print(f"  row-5 pairs: {row_pair_counts.get('5', 0)}")
print(f"  book chapters: {chapter_count} across {book_count} books")
