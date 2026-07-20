# CLAUDE.md — Motoi Scheme

Per-repo guidance for agents working in this tree.

## What this repo is

Motoi Scheme is the **base** dialect. Small. Open source. Nobody's product.

- `src/` — the engine (reader, interp, base, macro, dispatch, registry, repl, cli, docs-emitter, slat).
- `bin/motoi` — CLI entry point.
- `bindings/{js,python}/` — language bindings for SLAT and reader.
- `engineering/` — architecture + eng docs.
- `scheme/` — the language reference + book + tutorial.
- `words/` — vocabulary and taxonomy.
- `spec/` — dialect protocol, SLAT format spec.

## Doctrines that apply here

- **The reference IS the language.** `scheme/MOTOI-SCHEME-REFERENCE.slat`
  is canonical. When code and reference disagree, reference wins.
- **The 16-chapter invariant** applies to scheme/BOOK (when authored). Overflow
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

## scratch/ — the working area

`scratch/` is the ephemeral working directory. Every WIP file, intermediate
artifact, agent draft, one-off script, or generated batch lands there — NOT
at the repo root. Gitignored except for `scratch/README.slat` (documents the
convention) and `scratch/.gitkeep`.

**Promotion:** when a scratch artifact is final, `git mv` it to its
first-class path (`engineering/`, `scheme/`, `spec/`, `training-data/`, etc.)
and commit. Leave no dangling references in scratch/.

**Rule for agents:** if you're not sure whether an artifact is first-class,
put it in `scratch/`. Better to leave a working note there than to pollute
the tree.

## Where things came from (first pass)

Extracted 2026-07-16 from `~/code/sakura-scheme/`. See `MOTOI-FIRST-PASS.slat`
for the exact provenance of every file.

## Where things go next

Wiring sakura-scheme (and Curator, and Lacuna) to consume `motoi-scheme` via
SemVer pin is the next pass. See `MOTOI-FIRST-PASS.slat` for the sequence.
