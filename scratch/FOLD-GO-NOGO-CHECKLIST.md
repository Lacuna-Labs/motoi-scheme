# Motoi SFT Fold — Go/No-Go Checklist + Tooling (Priya)

Release + TDD gate for the big fold. Doctrine honored throughout:
**ONLY-ADD-NEVER-PRUNE · over-include-then-measure · no fabrication.**
Nothing here deletes data. Every "fix" is *diversify/author-more*, never *trim*.

## The scripts (all in `scratch/`, all runnable, all import `fold_common.py`)

| Script | Ask | What it gates |
|---|---|---|
| `fold_common.py` | shared | record reader; handles `{shape,instruction,response}`, `{messages}`, flat `{instruction,output}`; skips `_provenance_header`; banned-token/name lists; paren-balance |
| `fold_sweep.py` | #1 | malformed JSON · non-UTF8 · empty prompt/completion · unbalanced parens · exact dups · banned tokens (Curator/Sakura/Lacuna/Cortex/Qwen…) · banned crew-names · `needs-alfred` · unknown-schema. **Reports counts, deletes nothing.** |
| `lockin_detect.py` | #2 | skeletonises prompts → template families → per-cluster self-BLEU / distinct-2 / gzip gate (§5 thresholds). Fix-plan (Verbalized-Sampling rewrite lane) in-file. |
| `reversal_fidelity.py` | #3 | round-trip: forward-pair code must appear as a reverse-pair subject; `--run` base64-passes full programs through `./bin/motoi run` (exit 0 unless expected-error). |
| `fold_checks.py` | #4 | 7 fold-failure modes (below), each with a concrete pre-fold check. |
| `fold_manifest.py` | #5 | authored vs folded vs excluded-with-reason per lane; flags **silent drops**. |
| `fold_report.py` | #6 | one go/no-go dashboard aggregating all of the above. |

Run: `python3 scratch/fold_report.py` (fast) or `--run` (adds interpreter grading).
Paths default to `training-data/`, `~/.forge/corpus/motoi-v8-partial/`, `scratch/sft-plans/`;
pass explicit paths to scope to just the authored Motoi SFT lanes.

## The 7 fold-failure modes → pre-fold check (ask #4)

1. **train/valid leakage** → `split_leakage()` checks exact + skeleton prompt
   overlap across the split; the REAL split must group by `(lane, code-hash)` so a
   reversal's two directions never straddle it.
2. **tokenizer/special-token mismatch** → scan for raw `<|im_start|>` etc. already
   in records (the packer double-adds them otherwise).
3. **truncation silently dropping completions** → BPE length vs `max_seq` (uses the
   real Qwen tokenizer if `transformers` present, else chars/3.3 PROXY, flagged).
4. **label-mask off-by-one** → structural: every trainable record needs both a
   non-empty prompt AND completion (no empty side of the mask).
5. **class imbalance** → per-lane share; thin lanes flagged as **ADD-work, not
   NO-GO** (over-include doctrine); over-weight Feeling/Sensation (regressed in Mk2).
6. **encoding corruption (iter-350 spike)** → U+FFFD / lone surrogates / control chars.
7. **dedup removing signal** → duplicate COUNT reported so dedup is a DECISION;
   honest-null and reversal-anchor dups must be KEPT.

## GO / NO-GO gates (hard = blocks fire)

- [ ] **HARD** `fold_sweep` blocking count = 0 (banned tokens, needs-alfred, empty, unknown-schema in the *authored SFT scope*)
- [ ] **HARD** `lockin_detect` zero families over threshold (self-BLEU>0.35 / distinct-2<0.6 / gzip<0.65)
- [ ] **HARD** `reversal_fidelity --run` zero UNEXPECTED failures (expected-errors must be tagged)
- [ ] **HARD** leakage/tokenizer/label/encoding all zero
- [ ] **HARD** truncation over max_seq = 0 (run with the REAL tokenizer, not proxy)
- [ ] **HARD** `fold_manifest --folded` zero silent drops (authored == folded + excluded-with-reason)
- [ ] INFO thin-axis balance reviewed → ADD to thin side
- [ ] INFO exact-dup count reviewed → keep null/reversal anchors
- [ ] then CPT (§3 of BIG-FOLD-PLAN) → SFT → loss-based probe + human sift

## Findings from running against real sample data (2026-07-30)

- **Banned-token gate works, catches real leaks:** `Cortex` appears in
  `graph-code-teaching-pairs` and `graph-relationship-pairs` (secret-sauce
  holdback → must scrub before fold). `Priya` (crew name) in `marcus-2-word-books`.
- **False-positive guard added:** `Cauchy`(-Schwarz), `Architect`(ure), `curry`
  are domain vocabulary, NOT crew leaks — removed from name list; remaining names
  are word-boundary matched. If a *persona* ("the Architect said") appears, catch by review.
- **Reversal grading caught 2 real expected-error blocks** in the shapes prototype
  (`(fold-left …)` R6RS unbound = correct teaching signal; `(filter 42 …)` error
  card) that lack an `expected_outcome` tag → **author the tag** (grader gotcha §10.1).
- **Scale + scope signal:** default scan = 336K records / 70 files, but **218K are
  `unknown_schema`** — they are CPT streams (`cpt-stream.jsonl`, `cpt-manifest.jsonl`
  = `{"text":…}`) and axis/FIM files, NOT SFT pairs. The reader REFUSES to coerce
  them (no-fabrication). **The authored SFT scope must be an explicit path list,
  not the whole `training-data/` dir.**
- **`unbalanced_parens` (352)** in `marcus-1-code-teaching` are mostly multi-line
  code blocks fenced across records — verify these are genuine fragments vs the
  balance heuristic before treating as bugs.

## NEEDS-ALFRED (flagged, not decided)

1. **Scope the authored SFT lane list.** Which jsonl files are the real Motoi SFT
   authored pairs vs CPT substrate vs Sakura mirrors? The scripts need an explicit
   manifest of in-scope lanes; guessing risks folding CPT `{text}` as SFT pairs.
2. **Banned-name roster** — confirm the crew-persona list and any personal names
   to scrub (only `Alfred Borden` is allowed). Extend `BANNED_NAMES` in `fold_common.py`.
3. **`Cortex` scrub policy** — secret-sauce holdback says the training recipe stays
   out; confirm whether *domain* mentions of a "Cortex module" (the reasoning-cortex
   feature) are allowed or must be scrubbed too.
4. **Real tokenizer for truncation** — run `fold_checks` under the forge venv
   (`transformers`) so BPE length is exact, not proxy, before the pack step.
5. **Expected-error tagging** — the fold record format needs a per-block
   `expected_outcome` (ok | error | error-matching `<pat>`) field so `reversal_fidelity`
   doesn't false-fail broken↔fixed pairs (§10.1 grader requirement).

## Additional prep I'd add for a clean MLX fold (ask #7)

- **Group-aware split** (by lane + code-hash) so reversal directions and
  build-ladder families never leak across train/valid — implement in the split step,
  gate with `fold_checks.split_leakage`.
- **Fold-record identity hash** (`fold_manifest.pair_id`) carried INTO the fold
  output so post-fold reconciliation is exact, not by count.
- **Interpreter-grade at fold-verify time**, not just author time — every `:code`
  block re-run through `./bin/motoi run` (STEP 4 in the plan); this tooling already
  base64-passes to survive quotes/newlines.
- **Honest-null pairs are training signal** — do NOT let dedup or empty-completion
  checks strip "I don't know / no-X-exists" pairs; they have real completions and
  must survive (they will, given the current checks, but call it out in review).
