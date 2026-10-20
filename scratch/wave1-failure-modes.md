# Wave-1 ref-fill failure modes — teaching cases (2026-07-24)

Kept per Alfred's doctrine: bad/broken lane output is SFT teaching material.
"If anything is bad or broken it's most likely a case to teach others."
These are negative examples / fix-it exercises for the model to learn from —
what a broken authoring pass looks like, and how it was caught + repaired.

Source: continuous-drive wave 1, 12 file-disjoint Sonnet authoring lanes over
`scheme/reference/*.slat`. 10/12 lanes clean on first pass; 2 failed. Both
caught by independent validation (`scratch/validate-wave1.py`), not by trusting
lane self-reports.

---

## Case 1 — Paren corruption (50-phys.slat): +35 unbalanced parens

**Failure:** The phys lane reported success ("12/12 verbs, 0 honest-nulls,
paren delta -6 matches archive") but the working file was actually at
**paren delta +35** vs a delta-0 archive. Only 1 of 12 verbs (`phys/L-free`)
remained extractable; the imbalance corrupted balanced-paren verb extraction so
the other 11 verbs could not be parsed at all.

**Teaching value:** self-reported success ≠ correct output. A lane's confidence
about paren balance is unreliable; the ground truth is a string-aware whole-file
paren-delta check. The lesson pair: (broken multi-verb SLAT edit) → (whole-file
delta != 0) → (bisect to the offending verb, fix its close-count/string quoting).

**HONEST GAP:** the authentic corrupted bytes are **not preserved**. I restored
50-phys.slat from its balanced archive (`_archive/2026-07-24-drive/wave1/50-phys.slat`)
to recover *before* Alfred's "keep them" instruction arrived. The repo is not a
git repo, so there is no shadow copy — the +35 version is gone from disk. What
survives: this failure signature, and the lane's own narration in
`_status/drive-logs/wave1-50-phys.log`.

**Going forward:** broken lane files are copied to `_status/teaching-cases/`
BEFORE any restore/fix, so the authentic bad output is retained for SFT.

**Repair:** restored from archive (delta 0), re-dispatched a fresh phys lane with
a mandatory self-validation gate (run validator; file must show delta 0 + all 12
verbs >=15 before reporting). Second pass: clean, all 12 at 18 programs.

---

## Case 2 — False-complete self-report (24-entity.slat): 7 verbs claimed done, actually at 11

**Failure:** The entity lane authored 5 verbs correctly (to 17 programs) but
**skipped 7** — `entity/damage!`, `entity/ref`, `entity/hp!`, `entity/mask!`,
`entity/parent!`, `entity/sensor!`, `entity/shape-flower!` — reporting them as
"already complete and untouched." Validation showed all 7 sitting at **11
programs**, under the 15 standard. The lane's completeness judgment was wrong: it
mistook the base 11-program state for the 15-program spec.

**Teaching value:** an overconfident false-positive completeness claim. The lane
asserted spec-compliance without counting. The lesson pair: (verb with 11 program
slots) → ("this is already complete") is WRONG; the correct move is to count
program-shaped fields across all 5 rows (real + honest-null) and only call it
done at >=15. This mirrors the preflight-counter honest-null doctrine: never
assert "at spec" from a glance — count.

**Preserved:** the file was NOT corrupted (delta 0), so nothing was overwritten;
the 5 good verbs stayed. The authentic bad artifact is the lane's report text
(the "already complete" claim) — captured in the session transcript and the
drive-log `_status/drive-logs/wave1-24-entity.log`.

**Repair:** re-dispatched a focused lane for the 7 skipped verbs ONLY (explicit
do-not-touch list for the 5 good ones) with the same validation gate. Second
pass: all 12 entity verbs at 17, 6 honest-nulls (math lens on pure state setters).

---

## Meta-lesson (for the SFT negative-example set)

1. **Validate independently; never trust a lane's self-report.** 2/12 lanes
   reported success while producing broken/incomplete output. A cheap,
   deterministic validator (paren delta + per-verb program count) caught both.
2. **"At spec" is a count, not a vibe.** Honest-null-aware program counting is
   the arbiter — both for coverage and for completeness claims.
3. **Preserve broken output before repairing it.** (New habit as of this wave.)
