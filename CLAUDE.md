# CLAUDE.md — Motoi Scheme

Per-repo guidance for agents working in this tree.

## What this repo is

Motoi Scheme is the **base** dialect. Small. Open source. Nobody's product.

- `src/` — the engine (reader, interp, base, macro, dispatch, registry, repl, cli, docs-emitter, slat).
- `bin/motoi` — CLI entry point.
- `bindings/{js,python}/` — language bindings for SLAT and reader.
- `Engineering/` — architecture + eng docs.
- `Scheme/` — the language reference + book + tutorial.
- `Words/` — vocabulary and taxonomy.
- `Spec/` — dialect protocol, SLAT format spec.

## Doctrines that apply here

- **The reference IS the language.** `Scheme/MOTOI-SCHEME-REFERENCE.slat`
  is canonical. When code and reference disagree, reference wins.
- **The 16-chapter invariant** applies to Scheme/BOOK (when authored). Overflow
  → appendices.
- **SLAT is the working format.** MD stays archived. Never delete source MD.
- **Training-ready tagging.** Every record: `:doc`, `:section`, `:audience`,
  `:dialect`, `:provenance`, `:training-eligible`, `:confidentiality`.
- **No deletes. Ever.** Even of "clearly obsolete" material — archive under a
  dated `_archive/` subdir.
- **No fabrication.** If you don't know, log `:status "needs-alfred"` and stop.
- **No `--force`, no `--no-verify`.**
- **Never commit without Alfred saying so.**

## What Motoi is NOT

- Not Sakura. Sakura is a character and a dialect (in `sakura-scheme` repo).
- Not Curator. Curator consumes Motoi via the Sakura dialect.
- Not a language server, browser bundle, or IDE plugin — those are later.
- Not a place to put dialect verbs. `card/*`, `shop/*`, `sys/*`, `net/*` live
  in their consumer repos, not here.

## Where things came from (first pass)

Extracted 2026-07-16 from `~/code/sakura-scheme/`. See `MOTOI-FIRST-PASS.slat`
for the exact provenance of every file.

## Where things go next

Wiring sakura-scheme (and Curator, and Lacuna) to consume `motoi-scheme` via
SemVer pin is the next pass. See `MOTOI-FIRST-PASS.slat` for the sequence.
