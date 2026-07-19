---
title: Engineering
---

# Engineering

Motoi's engineering docs live at `engineering/*.slat` (SLAT is the
working format; `.md` copies are the archival mirror).

## Doc index

| Doc | SLAT | Notes |
| --- | --- | --- |
| Composer | `COMPOSER-1.0.ENG.slat` | Runtime composer |
| Cortex | `CORTEX-1.0.ENG.slat` | Long-term memory faucet |
| Forge | `FORGE-1.0.ENG.slat` | Build + release pipeline |
| Hello Surface | `HELLO-SURFACE-1.0.ENG.slat` | UI substrate |
| Lacuna Integration | `LACUNA-INTEGRATION-1.0.ENG.slat` | Downstream contract |
| Lang Design | `LANG-DESIGN-1.0.ENG.slat` | Motoi language design |
| Lang Engineering | `LANG-ENGINEERING-1.0.ENG.slat` | Interpreter internals |
| LLM Augmented REPL | `LLM-AUGMENTED-REPL-1.0.ENG.slat` | REPL + copilot bridge |
| Loam | `LOAM-1.0.ENG.slat` | Storage substrate |
| Marionette | `MARIONETTE-1.0.ENG.slat` | Animation puppeteering |
| Sakura Automations | `SAKURA-AUTOMATIONS-1.0.ENG.slat` | Automation catalog |
| Sakura Scheme | `SAKURA-SCHEME-1.0.ENG.slat` | Sakura dialect layer |
| Sakura Training Manual | `SAKURA-TRAINING-MANUAL-1.0.ENG.slat` | Training pipeline |
| Sakura Voice Routing | `SAKURA-VOICE-ROUTING-1.0.ENG.slat` | Voice IO routing |
| Sakura Voice STT/TTS | `SAKURA-VOICE-STT-TTS-PACKAGE-1.0.ENG.slat` | STT/TTS package |
| Security Canonical | `SECURITY-CANONICAL-1.0.ENG.slat` | Baseline security |
| Telemetry Median | `TELEMETRY-MEDIAN-1.0.ENG.slat` | Telemetry contract |

## Rendering status

- [ ] SLAT → MD renderer for engineering docs (`scripts/build-eng-docs.mjs`)
- [ ] Sidebar auto-generation from ENG index

Until the renderer lands, read the source directly under `engineering/`.
Alfred's convention: SLAT is canonical, MD is archive. Both stay committed.
