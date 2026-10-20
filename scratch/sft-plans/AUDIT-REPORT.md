# AUDIT REPORT — Motoi SFT Big-Fold Design Work

**Auditor:** independent audit instance (read-only) · **Date:** 2026-07-29
**Scope:** `scratch/sft-plans/00-BIG-FOLD-PLAN.md` + companions + `forge/forge/corpus/motoi_sft/assess.py`.
**Method:** re-ran every load-bearing disk command myself; ran `assess.py`; ran the prototype harness. Nothing modified/authored.

---

## 1. VERDICT: **PASS-WITH-FINDINGS**

The work is grounded, honest, and doctrine-compliant. Every headline number I re-checked reproduces on disk. `assess.py` runs and prints **~3.04M**. The prototype's 29/29 claim is **real** (I ran it). The ONLY-ADD doctrine is **honored** — every delta vs the prior 2026-07-28 assessment is an *increase*; no lane was cut, dropped, or right-sized down.

Findings are all minor: a handful of small constant drifts (±4–6 on 25k / 1.1k bases, immaterial to the headline), one genuine *under*-count inside the non-canonical `fold-sizing-record.md` (BOOK_CODE 9,156 vs disk 9,258 — which errs on the low side, so it does not violate the doctrine), and two file-location mismatches vs the audit brief. None block the fold.

---

## 2. PER-CHECK FINDINGS (A–G)

### A. Groundedness / no fabrication — **PASS**
Every BASE claim I re-ran reproduced.

| Claim | Source | Command output | Verdict |
|---|---|---|---|
| Graph nodes = 25,222 | plan §6.1, fold-sizing | `grep -c '^(node' graphs/graph-of-*.slat` → 675+1,100+6,244+17,203 = **25,222** | ✅ exact |
| Graph `:id` = 25,222 | fold-sizing L70 | `grep -rhoE ':id ' graphs/graph-of-*.slat | wc -l` → **25,222** | ✅ exact |
| Fenced code | plan §1 (9,156), assess.py (9,258) | `grep -rhoE '```(scheme|lisp)' scheme-books/ | wc -l` → **9,258** (scheme 9,252 + lisp 6) | ✅ matches assess.py; fold-sizing's 9,156 is stale/low (Finding 2) |
| Reference `:signature` | fold-sizing L37 (1,179) | `grep -rhoE ':signature' scheme/reference/*.slat | wc -l` → **1,179** | ✅ (retag-new excluded automatically) |
| Reference `:code` | plan §11 1b (7,268) | `grep -rhoE ':code ' scheme/reference/*.slat | wc -l` → **7,263** | ✅ within 5 (grep-vs-parser scope) |
| Broken jsonl = 3,012 | fold-sizing | `wc -l broken-examples/*.jsonl` → **3,012 total** | ✅ exact |
| Word-book chapters = 50 | assess.py, fold-sizing | `find word-books/book-of-words -name '*.book.slatl' | wc -l` → **50** | ✅ exact |
| Music/anim ground truth 5 / 6 | fold-sizing L143/154 | `ls carts/cart-maker-3-music/*.scm` → 5; `cart-maker-1-scenes/*.scm` → 6 | ✅ exact |
| `carts/spacewar.sks` ABSENT | plan §7.4 | `ls carts/spacewar.sks` → not found | ✅ honestly flagged as to-write |
| honest-null companions (assoc 1, distrib 1, synonyms 776) | graph-keys-audit §2b | grep each → 1, 1, 776 | ✅ exact |

No fabricated numbers found. Where grep and the parser diverge, the docs *explain* it (grep counts key occurrences incl. honest-null slots; string-valued is the base). That explanation is correct.

### B. assess.py runs and agrees — **PASS**
- `python3 assess.py` → **HEADLINE ROUND NUMBER: ~3,040,000** ✅ (≥3.0M).
- The two ≥1M lanes are exactly **Reference = 1,319,625 (~1.32M)** and **Graphs = 1,135,170 (~1.14M)** ✅ — matches plan §1.
- Music (72 base → 11,520) and Animation (77 base → 12,320) are present as additive `Line`s ✅ — the prior 2026-07-28 model had neither.
- Word-book edit is additive: density lifted 1,200 → 2,000 (100,000 yield) ✅.
- No lane's density was lowered vs the prior assessment (see check C table).

### C. ONLY-ADD adherence — **PASS (honored)**
Direct diff of the canonical model vs the prior `00-assessment-2026-07-28.md` (which landed at ~900K). **Every change is an increase or an addition; nothing was reduced:**

| Lane | 2026-07-28 density | 2026-07-29 density | direction |
|---|---|---|---|
| Reference | ~300 | **1,125** | ▲ up |
| Graphs | ~13 | **45** | ▲ up |
| Scheme books (prose) | ~200 | **220** | ▲ up |
| Word books | ~1,200 | **2,000** | ▲ up |
| Broken code | ~33 (base 30) | 11 (base 3,224) | ▲ up (yield 1k → 35k) |
| Book fenced code | — (unused) | **20 (new lane 4b)** | ＋ added |
| Music / Animation | — (absent) | **160 each (new lanes)** | ＋ added |

The broken-code *density* number dropped (33→11) but the *base* grew 30→3,224 and the *yield* rose ~1k→35k — an increase, not a prune. Deferred carts stay excluded from the headline exactly as before. I found **no** place where a cap was lowered, a lane dropped, or yield "right-sized down." The prior 900K→3.04M jump is entirely density-lift + two new lanes + the previously-unused BOOK_CODE base — textbook ONLY-ADD.

### D. Prototype honesty — **PASS**
Ran `bash scratch/sft-plans/test-shapes-0-5.sh` live:
```
TOTAL: 29 blocks | PASS: 29 | FAIL: 0
ALL BLOCKS OK (100%)
```
27 must-run blocks exit 0; the 2 R5 blocks (`(fold-left + 0 …)` → unbound; `(filter 42 …)` → not-a-function) fail for the *right* reason and are counted PASS via `expected_error_idx`. Interpreter healthy: `echo '(+ 1 2)' | ./bin/motoi run /dev/stdin` → `3`. The 29/29 claim is real, not asserted.

### E. Internal consistency — **PASS with minor drifts**
- **Graph 25,222 / tiers 961/4,092/20,169:** plan §6 and graph-keys-audit §1 agree with each other (25,222 total). My raw `:tier` grep sums to **964/4,094/20,171** (+3 vs the parser-based 961/4,092/20,169). The 3-node gap is the known intuition-salvage/paren bug (documented in `00-assessment-2026-07-28.md` §defect-1). Immaterial. **Consistent.**
- **§7.5 verb gap = 88, copilot/composer NO gap:** plan §2/§7.5 and `reference-rules-and-verb-gap.md` §B agree exactly — 183 undocumented-by-name = 88 in-scope + 5 R7RS-core + 89 no-chapter + 1 downstream (flower); copilot (8) + composer (42) fully documented. **Consistent.**
- **Reference base number drifts three ways** (Finding 3): assess.py `REF_VERBS=1173`, fold-sizing grep `1,179`, plan §1 table `19,326 seeds`. The 1,173 vs 1,179 gap is cosmetic (both are "~1.17k verbs"; the 19,326 runnable-seed base is what actually drives yield and it is stable). Flag, don't block.

### F. Completeness vs directive — **PASS**
Every required topic has a real, non-stub section:
- **CPT** — §3 is a full section (Mk3.5 top-up vs fresh Mk4, invariants, CPT⟂SFT boundary). Real. ✅
- **Shapes-training into BOTH reference and books** — §4 is explicit, names an OWNER (dedicated full-context lane, task #438), a shape roster, a reference deliverable, a books deliverable, and sequencing. Satisfies the "scheduled with an owner" gate. ✅
- **Graph keys** — §6 + `graph-keys-audit.md`: complete 24-key set, nested-key descent, and the honest-null "perennially-missed" finding (11 of 24 keys have no null companion). Substantive. ✅
- **Tagging contract** — §9 + `tag-audit.md`: full tag set, the `:section` gap (72 → ~26k), value-normalization, training-eligible read gate. ✅
- **Balance** — §8: ADD-to-thin, per-Bloom/philosopher/register/axis, never trim thick. ✅
- **Variety / phrase-lock** — §5 + `research-variety-phraselock.md`: hybrid engine, measured diversity gate (Self-BLEU/Distinct-2/gzip/BERTScore) computed per fact-cluster. ✅
- **Where the fold goes** — §9: output path, record format, grading, holdback, scrub wall. ✅

Nothing hand-wavy that maps to a directive item.

### G. NEEDS-ALFRED decisions (§13) — **PASS (genuinely open)**
All 8 items in §13 (+ the addendum's 6–9 in fold-sizing-record) are real undecided choices — CPT variant, span-census confirmation, graph governor curve, per-layer book explosion, copilot fold-vs-standalone, variety verdict, 5 R7RS-core placements, 89 no-chapter verbs. None is a fabricated "answer dressed as a question." They correctly gate downstream authoring. ✅

---

## 3. TOP ISSUES TO FIX (ranked)

1. **assess.py constant drifts (cosmetic, fix for hygiene):** `GRAPH_NODES=25226` (disk **25,222**, +4) and `REF_VERBS=1173` (disk `:signature` **1,179**, −6). Neither moves the headline; both should be reconciled to disk so the canonical model reads clean. LOW severity.
2. **`fold-sizing-record.md` uses BOOK_CODE=9,156; disk = 9,258.** This is an *under*-count (doctrine-safe direction) but disagrees with the canonical `assess.py` (9,258). Reconcile to 9,258 (adds ~2k yield). LOW severity, ONLY-ADD-safe.
3. **Reference base stated three ways (1,173 / 1,179 / 19,326-seed).** Pick one verb count for prose consistency. The yield driver (19,326 seeds) is stable, so cosmetic. LOW.
4. **File-location mismatches vs the audit brief:** `fold-sizing-record.md` lives at `scratch/fold-sizing-record.md`, not `scratch/sft-plans/`; `assess.py` lives under `/Users/alfred/code/forge/…`, not inside the repo. Both exist and are correct — only the brief's paths were off. No action beyond noting the index. LOW.
5. **Graph tier counts differ by 3 between raw grep and the parser-based census** (intuition salvage/paren bug, already a known `needs-alfred` defect). Not introduced by this work. LOW.

No HIGH- or MEDIUM-severity issues found. No fabrication, no pruning, no dropped lane.

---

## 4. ONLY-ADD DOCTRINE — EXPLICIT CONFIRMATION

**HONORED.** The fold moved from the prior ~900K assessment to a grounded ~3.04M purely by (a) lifting per-unit densities upward on every existing lane, (b) adding two structurally-missing lanes (Music, Animation), and (c) finally multiplying the previously-measured-but-unused BOOK_CODE base. I found **zero** instances of a lowered cap, a dropped lane, a "right-sized-down" yield, or a shrink toward "~1.2M." The one internal number that is *lower* than canonical (fold-sizing's BOOK_CODE 9,156) errs on the conservative/under-count side, which is the doctrine-safe direction, not a prune. Two lanes exceed 1M (Reference 1.32M, Graphs 1.14M) exactly as claimed, and the three flagged multipliers toward ~5M (word-book per-span, graph governor, per-layer book explosion) are all additive and honestly marked NEEDS-ALFRED rather than baked in.
