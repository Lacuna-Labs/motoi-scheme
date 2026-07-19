---
title: Compat Architecture Specs — Consolidated Execution Report
date: 2026-07-19
author: Claude
status: AWAITING-ALFRED-REVIEW
canonical: COMPAT-ARCHITECTURE-SPECS-2026-07-19.ENG.slat
burn-down-cross-ref: sakura-scheme/engineering/BIG-0.85-READINESS-BURN-DOWN-2026-07-19.ENG.md items A-1 through A-4
---

# Compat Architecture Specs — Consolidated Execution Report

## Frame

Four foundational specs authored for the Motoi identity SLAT + Rosetta + compat manifest system. All four are SLAT canonical + MD twin. Zero code changes, zero commits. Ready for Alfred review before dependent lanes commence.

**Doctrine loaded:**

- `[[identity-slat-rosetta-compat-architecture-2026-07-19]]`
- `[[variant-not-dialect-terminology-2026-07-19]]`
- `[[no-contaminants-provenance-rule-2026-07-17]]`

**Time:** ~3.5h agent time (budget was 10-14h). Efficiency came from clear doctrine + existing MOTOI-SCHEME-REFERENCE-SCHEMA giving the schema-authoring pattern.

**Constraints observed:** No touching `~/.forge/runs/motoi-4.0/`. No commits. Pure spec authoring, no code execution against Motoi runtime.

---

## Deliverables — 8 files, 1682 lines

| File | Lines | Purpose |
|------|-------|---------|
| `~/code/motoi-scheme/spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat` | 479 | 299 R7RS-small primitives, each cited to R7RS section |
| `~/code/motoi-scheme/spec/R7RS-SMALL-PRIMITIVE-FLOOR.md` | 69 | MD twin |
| `~/code/motoi-scheme/spec/VIRTUAL-SHAPE-VOCABULARY.slat` | 232 | 14 shape kinds, one paragraph each |
| `~/code/motoi-scheme/spec/VIRTUAL-SHAPE-VOCABULARY.md` | 74 | MD twin |
| `~/code/motoi-scheme/spec/IDENTITY-SLAT-V1.slat` | 298 | Format spec + validator rules + 5 worked examples |
| `~/code/motoi-scheme/spec/IDENTITY-SLAT-V1.md` | 165 | MD twin |
| `~/code/motoi-scheme/spec/COMPAT-MANIFEST-SCHEMA.slat` | 225 | Output format + Rosetta algorithm + loader contract |
| `~/code/motoi-scheme/spec/COMPAT-MANIFEST-SCHEMA.md` | 140 | MD twin |

Plus this consolidated report and its MD twin.

---

## Spec 1 — R7RS-small Primitive Floor (A-2)

**Purpose:** The declared canonical list of "verbs every variant guarantees." Every reduction chain in the identity SLAT terminates here.

**Count:** 299 primitives (task prompt estimated 200-250; actual is higher because R7RS-small has more than most summaries acknowledge — includes 30+ special forms as explicit records, standard libraries `(scheme char)`, `(scheme inexact)`, `(scheme complex)`, etc., and R7RS-required aliases like `quotient`/`remainder`/`modulo` alongside `floor-*`/`truncate-*`).

**Key decisions:**

- R7RS-small **pure**. Not "R7RS-small + a few conveniences" (per Alfred).
- Every primitive cites its R7RS section (`R7RS §6.4`, `R7RS (scheme inexact)`, etc.).
- Every primitive has a `:floor-eligible-because` field — auditable, not just declared.

**Needs Alfred:** None. Scope was clear and shipped.

---

## Spec 2 — Virtual Shape Vocabulary (A-3)

**Purpose:** The closed set of shape descriptors any verb's `:virtual-shape` field may use.

**Count:** 14 shape kinds: `port`, `record`, `list-of`, `number`, `string`, `symbol`, `boolean`, `procedure`, `promise`, `hash-table`, `bytevector`, `effect-channel`, `never`, `any`.

**Key decisions:**

- Every shape documented with: `:kind`, `:summary`, `:declaration-syntax`, `:slots`, `:example-real`, `:example-virtual`, `:meaningful-on-virtual`, `:notes`.
- Sentinel design principle: virtual sentinel must satisfy the type predicates a caller might apply to a real value. Reads return conservative defaults (EOF, `#f`, empty). Writes are silent no-ops.
- `:kind never` is the only shape whose sentinel is a control effect (raise), not a value.
- `:kind any` is the escape hatch, with a WARN validator rule if it exceeds 10% of verbs.
- `:kind effect-channel` treats framebuffer/audio/sensor/actuator/remote-service as a family rather than proliferating one shape per subsystem.

**Needs Alfred:**

- Confirm 14 kinds is the right size (extensions later require doctrine memory + cosign).
- Confirm `effect-channel` as a family shape (rather than `fb`, `audio`, `sensor` as separate shapes).

---

## Spec 3 — Identity SLAT v1 Format (A-1)

**Purpose:** The format Motoi uses for its per-release identity artifact. Extension of `MOTOI-SCHEME-REFERENCE-SCHEMA`.

**Explicitly NOT included:** the 459 verb records themselves. That authoring is a separate (40-80h) lane, held for post-spec-cosign.

**Key decisions:**

- Four load-bearing identity fields per verb: `:signature-data`, `:contract`, `:reduction`, `:virtual-shape`. Plus `:primitives-required` as a validator-friendly redundant index.
- Legacy `MOTOI-SCHEME-REFERENCE-SCHEMA` fields all continue to apply. Identity SLAT is a strict superset.
- Header pins SHAs of the floor + vocab SLATs consumed. Rosetta refuses on mismatch.
- Reductions are single-expression lambdas using only floor names + other verbs in this SLAT. Must terminate (topological sort at Rosetta compile time; cycles fatal).
- Footer includes SHA-256 of the whole normalized SLAT for tamper-detection.
- 12 validator rules (V01–V12): 9 fatal, 3 warn.
- 5 worked examples: `safe-divide` (simple arithmetic), `list/take-safely` (medium list op), `file/read-lines` (complex I/O), `file/count-lines` (cascading reduction chain of depth 2), `motoi/quit` (`:kind never` with variadic args).

**Needs Alfred:**

- Confirm `:primitives-required` is worth keeping alongside `:reduction` (I kept it for validator speed; Alfred may prefer to drop as redundant).
- Confirm the four identity fields have the right shape and names.
- Confirm the 459 retroactive reduction authoring lane can proceed after cosign (needs supervisor).

---

## Spec 4 — Compat Manifest Schema (A-4)

**Purpose:** The output format Rosetta produces, plus Rosetta's compilation algorithm, plus the variant-side loader contract.

**Key decisions:**

- Four binding kinds per verb: `:native`, `:reduced`, `:virtual`, `:break`. Matches doctrine.
- Per-kind fields fully specified.
- **Determinism contract:** `:ts-compiled` is informational and zeroed for `:manifest-hash` computation. Identical `(identity-slat, primitive-registry, policy)` → identical `:manifest-hash` across time.
- Rosetta's algorithm documented step-by-step (8 steps). Reverse-topological order (leaves first) makes binding decisions a linear pass, not a fixed-point iteration.
- 10 validator rules (M01–M10): 8 fatal, 2 warn.
- **Loader contract:** 50-line canonical Scheme implementation in the SLAT appendix. The variant side is intentionally cheap — a variant author reads the manifest and installs 4 kinds of bindings, no policy logic, no reduction walking. All smart stuff happens at Rosetta compile time.

**Needs Alfred:**

- Confirm M09 threshold of "break count < 5%" is right.
- Confirm the loader appendix should live inline (vs a separate `LOADER-CONTRACT.slat`). Small enough that inline seems right; separable later.

---

## Surprises

1. **R7RS-small has more primitives than summaries suggest.** Landed at 299, not the 200-250 estimate in the prompt. The gap is largely (a) explicit syntax records, (b) standard-library primitives across `(scheme char)`/`(scheme inexact)`/`(scheme complex)`, (c) aliases like `quotient` alongside `truncate-quotient`.
2. **`effect-channel` emerged as a family shape** rather than one shape per subsystem. Justification in the SLAT.
3. **Cascading reductions demonstrated in worked example 4** (`file/count-lines` uses `file/read-lines` in its reduction). Demonstrates chain-depth > 1 without cycles.
4. **Loader is intentionally 50 lines.** Compat contract is cheap for variants to implement. All complexity is on the Rosetta compile side.

---

## Downstream lanes (post-Alfred cosign)

| ID | Name | Effort | Prerequisite |
|----|------|--------|--------------|
| A-1-execution | Retroactive reduction authoring for 459 Motoi verbs | 40-80h | All 4 specs cosigned |
| A-5 | Rosetta v0.1 prototype | 1-2 weeks | IDENTITY-SLAT-V1 + COMPAT-MANIFEST-SCHEMA cosigned + proof-of-life identity SLAT (~20 verbs) |
| sakura-primitive-registry | Sakura's consumer-side registry declaration | ~1-2h | R7RS-SMALL-PRIMITIVE-FLOOR cosigned |
| sakura-policy | Sakura's variant policy | ~1-2h | VIRTUAL-SHAPE-VOCABULARY cosigned |

---

## Cosign

- **Author:** Claude
- **Author verdict:** APPROVED
  - All four specs deliverable-quality
  - Deferred choices flagged in `Needs Alfred` sections
  - No blocking uncertainties
- **Reviewer:** Alfred (pending)

🌳
