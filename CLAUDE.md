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

- **The reference IS the language.** The reference is `scheme/reference/` — a
  chaptered book (one folder, many `.slat` chapters, a `README.slatl` boot
  record, and a `MANIFEST.slat` machine index per `spec/BOOK-LAYOUT.slat`). It
  is canonical. When code and reference disagree, reference wins. The old
  single-file monolith (`scheme/MOTOI-SCHEME-REFERENCE.slat`) was retired
  2026-07-24 and parked (with all other non-canonical/archived material) under
  the gitignored `scratch/attic/` working area.
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

## The standard library (LOCKED 2026-07-24)

Motoi's standard = **R7RS-small (the core, the semantic authority) + a set of
named, versioned SRFI parts**. No R6RS. No Racket. Nobody else.

- **R7RS-small is the authority.** Never redefine a standard name to mean
  something non-standard. When behavior must be picked, bind ONE superset that
  satisfies the standard (e.g. `map`/`for-each` use SRFI-1 shortest-stop, which
  is a strict superset of R7RS's unspecified case).
- **The conformance ladder.** Every hand-rolled verb must comply with the
  HIGHEST standard it corresponds to, in this order: **R7RS-small first, then a
  SRFI, then (only if it matches nothing standard) Motoi-own.** A hand-rolled
  verb that duplicates a standard verb under a divergent name or signature is a
  bug: conform it to the standard name + signature + semantics, do not keep the
  divergent version. Adopted parts (confirmed 2026-07-24): R7RS-small · SRFI-1
  (lists) · SRFI-13 (strings) · SRFI-125 (hash tables). `random` and friends map
  to nothing in R7RS-small; assess against SRFI-27, else keep Motoi-own.
- **Each SRFI is its own part** — its own bucket, its own reference-manual
  section, its own spec kept alongside. Parts can be **included or excluded**.
- **Default bundle** = R7RS-small + SRFI-1 (the "expected superset"). The other
  parts are **lazy-loaded** and **pulled in explicitly** when needed. Motoi must
  be taught (in the corpus) the difference between the base and each part.
- **EXCLUDED:** R6RS/Racket `fold-left` (acc-first), `foldl`, `foldr`. Use
  SRFI-1 `fold`/`fold-right` (elem-first). Sites using the excluded names become
  **broken-examples**, not wired.

### Necessary criteria for introducing ANY library (a hard gate)

A library/part may only enter the language when ALL of these hold:

1. **Own bucket.** It is a named part with recorded provenance on every verb
   (`:std` / `:provenance` citing the exact standard + section, e.g.
   `SRFI-13`, `R7RS §6.7`, `SRFI-125`).
2. **Spec kept alongside.** The part's actual spec (SRFI text / R7RS section)
   lives in a `.slatl` **with** the part — R7RS-small spec kept with them too.
3. **Every verb implemented correctly.** Each verb is conformance-verified
   against its cited spec (signature + behavior), not just present.
4. **Includable/excludable + lazy-loadable.** The part loads on demand and can
   be excluded; nothing else silently depends on it being always-on.
5. **Runs.** `echo '<expr>' | ./bin/motoi run /dev/stdin` passes for the part's
   verbs; the whole reference still runs.

### Broken-examples teach the differences

`scheme/reference/broken-examples/` holds per-verb `.slatl` teaching cases:
the broken code, **why** it's broken, the fix, the lesson, and 3 examples of the
same idea in 3 other libraries. Use them to teach the differences between
**R5RS, R6RS, and the SRFIs** (e.g. `fold-left` R6RS acc-first vs `fold` SRFI-1
elem-first vs `foldl` Racket). Bad examples are kept — they are teaching signal.

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
