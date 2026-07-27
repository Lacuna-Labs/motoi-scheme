#!/usr/bin/env python3
"""backfill-book-chapter-tags.py — add missing per-chapter tags in bulk.

Marcus flagged 1,685 chapter records missing :voice / :audience / :dialect /
:training-eligible / :confidentiality / :provenance. These are older imports
that predate the standard tag envelope.

Backfill logic (safe defaults per book-type):
  :audience — inherited from book's README, or 'programmer-learning-motoi'
  :dialect — always 'motoi' (we're in motoi-scheme repo)
  :voice — 'motoi-copilot' (safe default for learning/composition books)
  :training-eligible — #t (we're in Motoi's public corpus)
  :confidentiality — 'public'
  :provenance — (:authored-at "2026-07-22-backfill" :note "tag backfill")

Only writes tags that are MISSING. Never overwrites existing values.
"""
import os, re, glob
BOOKS = '/Users/alfred/code/motoi-scheme/scheme-books'

DEFAULTS = {
    'audience': 'programmer-learning-motoi',
    'dialect': 'motoi',
    'voice': 'motoi-copilot',
    'training-eligible': '#t',
    'confidentiality': 'public',
}

# Find every (chapter ...) block; check which tags are missing; inject them
# right after the opening `(chapter` line.

CHAPTER_RE = re.compile(r'\(chapter\b')
FIELD_RE = re.compile(r':([a-z][a-z-]*)\s')

def process_file(path):
    text = open(path).read()
    changes = 0
    # find every (chapter ...) form start
    pos = 0
    result_parts = []
    last_end = 0
    while True:
        m = CHAPTER_RE.search(text, pos)
        if not m: break
        start = m.start()
        # find matching close
        depth = 0; ins = False; esc = False; j = start
        while j < len(text):
            c = text[j]
            if ins:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': ins = False
            else:
                if c == '"': ins = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0: j += 1; break
            j += 1
        end = j
        body = text[start:end]
        # find missing tags
        present = set(FIELD_RE.findall(body))
        missing = [(k, v) for k, v in DEFAULTS.items() if k not in present]
        if not missing:
            pos = end
            continue
        # inject missing tags AFTER the first line of the chapter form
        # (before the first inner field like :book or :title)
        # We insert after opening `(chapter\n` — find first newline after start
        nl = text.find('\n', start)
        if nl < 0 or nl > end:
            pos = end; continue
        # Build insertion
        indent = '  '
        addition = ''.join(f'{indent}:{k:<20s} {v}\n' for k, v in missing)
        new_text = text[:nl+1] + addition + text[nl+1:]
        # Update indices for the rest of the walk
        text = new_text
        end += len(addition)
        changes += len(missing)
        pos = end
    if changes:
        with open(path, 'w') as f: f.write(text)
    return changes

total_files = 0
total_tags = 0
for path in sorted(glob.glob(os.path.join(BOOKS, '**/*.book.slatl'), recursive=True)):
    n = process_file(path)
    if n:
        total_files += 1
        total_tags += n

for path in sorted(glob.glob(os.path.join(BOOKS, '**/*.slat'), recursive=True)):
    if '/MANIFEST' in path or '/README' in path or '/CHAPTERS' in path or '/00-outline' in path:
        continue
    n = process_file(path)
    if n:
        total_files += 1
        total_tags += n

print(f'Backfilled {total_tags} missing tags across {total_files} chapter files.')
