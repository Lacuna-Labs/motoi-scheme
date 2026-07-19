# Scheme/

The language reference, book, tutorial, style guide.

## First-pass state (2026-07-16)

- `MOTOI-SCHEME-REFERENCE.slat` — the canonical reference. **The reference IS
  the language.** 1,167 verbs + 70 core forms (per E2 audit 2026-07-15). Copied
  verbatim from `scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat`; not yet
  renamed internally — a rename sweep is a later pass.
- `TUTORIAL.html` — the interactive tutorial.
- `STYLE-GUIDE.md` — code style guide (still MD; convert to SLAT next pass).

## Not yet here

- `MOTOI-SCHEME-BOOK.slatl` — the 16-chapter canonical book. Lives across
  `curator/scheme-books/book-of-scheme/` and needs consolidation +
  extraction of dialect-neutral material.
- `LANG-SPEC.slat` — formal language spec (grammar, forms, error taxonomy).
  Currently a draft at `scheme-lang/docs/LANG-SPEC.md`.

## Doctrine reminder

When the reference and the code disagree, the reference wins. Adding a verb
means authoring in the reference FIRST. The interpreter only knows what the
reference documented.
