# Motoi Scheme

**基** — foundation.

Motoi Scheme is the base Scheme dialect that Sakura, Lacuna, and future forks
share. It is intentionally small: reader, interpreter, macros, base library,
verb registry, dispatch, REPL, CLI, docs emitter, and SLAT serialization.
Everything else — cards, shops, sound, framebuffer, sidecars, deployments — is
a *dialect* layered on top.

Motoi is open. Fork it, dialect it, teach with it.

## The 4-doc-type layout

Every Motoi fork inherits this shape:

- **`Engineering/`** — architecture, decisions, adapter engine, telemetry, security, integration.
- **`Scheme/`** — the language reference, book, tutorial, style guide.
- **`Words/`** — vocabulary, glossary, naming conventions, canonical taxonomy.
- **`Spec/`** — formal specifications (dialect.slat, SLAT format, protocol specs, contracts).

## Status

This is the **first pass** — extracted from `sakura-scheme` on 2026-07-16. The
engine files (`src/`) are copies of sakura-scheme's core, staged here so
consumers can begin migrating. Wiring sakura-scheme to consume motoi-scheme
via SemVer pin is the next pass; see `MOTOI-FIRST-PASS.slat` for the sequence.

## Install

Not yet published. Local development only for now.

```bash
git clone git@github.com:Lacuna-Labs/motoi-scheme.git
cd motoi-scheme
npm install
./bin/motoi --help
```

## License

Apache 2.0 — see `LICENSE`. Choose a permissive license so kids and
teachers can build on this without asking.

## Fork protocol

To fork Motoi:

1. Clone this repo, rename to `<your-name>-scheme/`.
2. Keep the 4-doc-type layout — do not flatten.
3. Author `Spec/dialect.slat` declaring what your dialect
   `refuses / modifies / adopts / adds` relative to Motoi.
4. Adapters translate between dialects deterministically without LLM.
5. Your fork stands on its own; Motoi has no upward knowledge of forks.

See `Spec/dialect.slat` for the schema.
