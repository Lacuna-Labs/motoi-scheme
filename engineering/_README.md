# Engineering/

Engineering docs for Motoi Scheme. Dry engineering voice. Facts, decisions, contracts, invariants.

## First-pass state (2026-07-16)

Only two docs migrated from sakura-scheme so far — **CORTEX** and **FORGE** —
because those are the only two shaped correctly (per-chapter records with
`:doc`, `:section`, `:audience`, `:provenance`, `:training-eligible`,
`:confidentiality` tags).

The other 11 sakura-scheme engineering docs (LOAM, MARIONETTE, AUTOMATIONS,
SCHEME, TELEMETRY, HELLO-SURFACE, LACUNA-INTEGRATION, VOICE-ROUTING,
VOICE-STT-TTS, SECURITY-CANONICAL, TRAINING-MANUAL) come over once the
flat-slat repair job runs. Six of them are `(eng-doc :code_blocks ...)`
single-record shape — content preserved but shape is unusable for the
training pipeline. Repair is dispatched to a future foreground pass.

## Doc naming

`<TOPIC>-<VERSION>.ENG.slat` (canonical) + `<TOPIC>-<VERSION>.ENG.md`
(archived source, never deleted).

## Every record must carry

- `:doc "<topic-slug>"`
- `:section "<title>"`
- `:section-number N`
- `:audience :engineer`
- `:provenance :source-path "..."`
- `:training-eligible true|false`
- `:confidentiality :public | :internal | :sensitive`
- `:prose "..."` — the body
- `:code` when there's code (as `((example-of-what) ...)` — not flattened)
