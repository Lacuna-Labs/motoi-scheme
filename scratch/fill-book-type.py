#!/usr/bin/env python3
"""fill-book-type.py — mechanical :book-type fill/reconcile from the registry.

Registry authority: docs/BOOK-TYPES.slat (parked at
scratch/attic/consolidation-2026-07-25/docs/BOOK-TYPES.slat). For each book:
 - README boot-record: insert :book-type after :book-kind line (if missing),
   or correct the value if it disagrees with the registry.
 - manifest ((book-manifest / (manifest / single-line book-of-slat form):
   insert :book-type right after the opening form (if missing), or correct.

No deletes. Idempotent. Prints a per-file diff summary.
"""
from __future__ import annotations
import re, sys
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
BOOKS = REPO / 'scheme-books'

# book-slug (without 'book-of-') -> registry type (registry is authority)
TYPE = {
    # learning
    'scheme':'learning','code':'learning','cs-curriculum':'learning','math':'learning',
    'motion':'learning','sound':'learning','music':'learning','animation':'learning',
    'logic':'learning','computing':'learning','ml':'learning','r7rs-recipes':'learning',
    'slat':'learning','modules':'learning','systems':'learning',
    # application
    'arcade-games':'application','narrative-games':'application',
    'simulation-games':'application','instruments':'application',
    # composition
    'composition':'composition','sick-composition':'composition','craft':'composition',
    'one-shot':'composition',
    # introspection
    'introspection':'introspection',
    # prose
    'self':'prose','values':'prose','limits':'prose','reminded':'prose',
    'jesse':'prose','language-ancestors':'prose',
    # challenge
    'challenges':'challenge','ai-tech-cards':'challenge',
    # NOT in registry :books lists — inferred by content-shape, flagged in report
    'motoi':'learning',
}

MANIFEST_NAMES = ('MANIFEST.slat','MANIFEST.book.slatl','00-manifest.slat',
                  '00-manifest.book.slatl','CHAPTERS.book.slatl')

def manifest_path(bookdir: Path) -> Path | None:
    for n in MANIFEST_NAMES:
        p = bookdir / n
        if p.exists():
            return p
    return None

BT_RE = re.compile(r':book-type\s+"([^"]*)"')

def fix_readme(readme: Path, want: str, log: list):
    text = readme.read_text()
    m = BT_RE.search(text)
    if m:
        if m.group(1) != want:
            text = text[:m.start()] + f':book-type "{want}"' + text[m.end():]
            readme.write_text(text)
            log.append(f'  README  CORRECT {m.group(1)} -> {want}')
        else:
            log.append(f'  README  ok ({want})')
        return
    # insert after the :book-kind line
    km = re.search(r'(?m)^(\s*):book-kind\s+"[^"]*"\s*$', text)
    if not km:
        log.append('  README  !! no :book-kind anchor — SKIPPED')
        return
    indent = km.group(1)
    insert = f'\n{indent}:book-type "{want}"'
    text = text[:km.end()] + insert + text[km.end():]
    readme.write_text(text)
    log.append(f'  README  INSERT :book-type "{want}"')

def fix_manifest(man: Path, want: str, log: list):
    text = man.read_text()
    m = BT_RE.search(text)
    if m:
        if m.group(1) != want:
            text = text[:m.start()] + f':book-type "{want}"' + text[m.end():]
            man.write_text(text)
            log.append(f'  MAN     CORRECT {m.group(1)} -> {want}  ({man.name})')
        else:
            log.append(f'  MAN     ok ({want})  ({man.name})')
        return
    # anchor: opening (book-manifest  OR (manifest
    am = re.search(r'\((book-manifest|manifest)\b', text)
    if not am:
        log.append(f'  MAN     !! no (book-manifest anchor — SKIPPED ({man.name})')
        return
    # single-line form (book-of-slat): insert right after the form keyword + space
    after = am.end()
    # if next non-space char on same line is a ':' key, it's single-line form
    rest = text[after:]
    if rest[:1] == ' ' and re.match(r'\s*:', rest):
        insert = f' :book-type "{want}"'
        text = text[:after] + insert + text[after:]
    else:
        # multi-line form: newline + 2-space indent
        insert = f'\n  :book-type "{want}"'
        text = text[:after] + insert + text[after:]
    man.write_text(text)
    log.append(f'  MAN     INSERT :book-type "{want}"  ({man.name})')

def main():
    for slug, want in sorted(TYPE.items()):
        bookdir = BOOKS / f'book-of-{slug}'
        if not bookdir.is_dir():
            print(f'book-of-{slug}: MISSING DIR'); continue
        log = []
        readme = bookdir / 'README.slatl'
        if readme.exists():
            fix_readme(readme, want, log)
        else:
            log.append('  README  !! missing README.slatl')
        man = manifest_path(bookdir)
        if man:
            fix_manifest(man, want, log)
        else:
            log.append('  MAN     !! no manifest file')
        print(f'book-of-{slug}  -> {want}')
        for line in log:
            print(line)

if __name__ == '__main__':
    main()
