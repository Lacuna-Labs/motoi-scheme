# CPT-ZERO Readiness Plan — 2026-08-07

## §0 Exec summary

Fire `emit_cpt_v5.py` when **all four measured gates pass simultaneously on a committed worktree**. Named check: `bash scratch/four-gates.sh` (chains `node scratch/conformance-probe.mjs` + `audit-books-values.py` + `verify-reference-notes.py` + `verify-fold.py`, each must exit 0/≤N). Owner: **Architect** (holds the ledger, pings Alfred at every step boundary). Nothing about the current disk state can be trusted — 477 files uncommitted since the audits were taken.

## §1 Completeness answers

- **Reference (CPT):** verify-reference-notes not re-run since Aug 3 — status unknown; the 243+45 documentation gap in `FULL-GAP.json` is SFT-authoring, **not CPT-blocking**.
- **Graphs:** the four Jung-axis SLATs in `graphs/` (25,228 nodes total; sensation/intuition fully enriched, thinking back-written Jul 26, feeling thin by design) are **CPT-source substrate, present and enriched** — no re-audit blocks CPT; graph→SFT pair-gen is MK ZERO, later.
- **Engine:** **not verifiable** — `src/reader.js` (+565), `src/interp.js` (+380), `src/macro.js` (+571) modified since HEAD `54e9d96`; 477 uncommitted files total; needs conformance re-run against worktree + `node --test tests/` green + commit before it can be called good.
- **Words in books:** the 75 prose-claim + 41 inner-claim rows (Aug 4 audit) need cheap yes/no triage — most are legitimate prose about a value, some are stale re-authoring targets; the 19 hard mismatches are the actual blocker.

## §2 Role assignments

| step | owner | gate = done | model | STOP/PING |
|---|---|---|---|---|
| 0 (re-measure) | Abel | four audits rerun against worktree, mtimes 2026-08-07 | none | PING Alfred with fresh numbers vs Aug 4 |
| 2 reader lexemes | Marcus | READ-* buckets = 0 in fresh conformance | none | STOP if any bucket grows |
| 3 num-exactness, n-ary compare, RANGE-ARG | Marcus | those buckets = 0 | none | STOP |
| 4 language design calls | Architect → Alfred | Alfred's decisions on complex / mutable-string / ports recorded | none | PING (Alfred-only decision) |
| 5 regenerate repair list | Abel | gates re-run, splice inputs regenerated *from* fresh gate | none | — |
| 6 book+reference splices | Abel | audit-books = 0 hard mismatch, verify-reference-notes = 0 bad | none | STOP if any splice fails byte-idempotency |
| 7 quarantine non-deterministic | Abel | 12 book + 609 fold rows moved to `_archive/`, not deleted | none | — |
| 7b prose-claim triage (116) | Korra (dispatch) | each row labeled keep-prose / re-author | Haiku (yes/no) + local (re-author) | STOP at 60k Haiku tokens |
| 8 fold repair | Abel | verify-fold = 0 wrong_value | none | — |
| 9 full suite green | Priya | `node --test tests/` all green; TDD gate | none | STOP on any red |
| 9b commit worktree | Priya | `git status` clean; no `--no-verify` | none | PING Alfred before commit |
| 10 emit CPT | Priya | `emit_cpt_v5.py` runs; then `pack_bpe.py --target 4096` gives real token count | none | PING Alfred with real BPE count |
| 11 CPT train overnight | Alfred | — | — | Architect logs kickoff |

Korra also watches scope: any request to touch carts, word-books, or the SLAT daemon during this walk → refuse and log.

## §3 Haiku / local / interpreter split

| task | tier | cap |
|---|---|---|
| Value verification (every checkable row in books/reference/fold) | interpreter | free |
| Splice application (byte-identical anchor writes) | mechanical Python | free |
| Prose-claim triage (75 prose + 41 inner = 116) | **Haiku** yes/no | **500 tok/read, batch 20/call ≈ 6 calls ≈ 60k tokens total, hard cap** |
| Re-author the "no" bucket from triage | **local** (Mistral-Small-3.2-24B for prose) | resident; free |
| Reference verb voice (451) — SFT, not CPT | local (Mistral prose, Gemma math-adjacent per bake-off) | not on CPT path |
| Book chapter re-voice (752) — SFT, not CPT | local | not on CPT path |
| Any sub-100-token decision the interpreter can't grade | Haiku | count against 60k cap |

**Total Haiku upper bound for CPT prep: ~60,000 tokens.** Anything above requires Alfred re-authorization.

## §4 Completeness gates (named)

- **Engine:** `node --test tests/ --test-reporter=tap` green AND `node scratch/conformance-probe.mjs` mismatch total ≤ **N** (Alfred sets N in §2 step 4 after complex/mutable-string/port decisions).
- **Books:** `python3 scratch/audit-books-values.py` → 0 hard mismatch (prose-claim bucket triaged separately per §3).
- **Reference notes:** `python3 scratch/verify-reference-notes.py` → 0 bad.
- **Fold:** `python3 scratch/verify-fold.py` → 0 wrong_value.
- **CPT emit ready:** all four above pass in one run AND `git status --porcelain` empty.

## §5 Explicit NOT-CPT list

- Reference documentation gap (243 undocumented + 45 under-documented + 2 dead in `FULL-GAP.json`) — SFT-authoring lane.
- Word-books (52 files, never audited) — SFT-authoring lane.
- Carts — Alfred said tomorrow, three times.
- SLAT daemon — build during CPT training, not before.
- Graph→SFT pair-generation — MK ZERO, after CPT.
- Complex numbers / mutable strings / ports — Alfred's design calls; do not block mechanical work; conformance gate N is set *after* these decisions.
- The 451-verb voice backlog and 752 book chapter re-voice — SFT, not CPT.

## §6 Order of operations

**Step 0 (mandatory, before step 2):** Abel re-runs conformance-probe + audit-books-values + verify-reference-notes + verify-fold against HEAD+worktree so the 477 uncommitted changes are measured. **PING Alfred with the delta table** (Aug 4 vs Aug 7). If the fresh numbers already show engine at target and only splice work remains, **skip to step 5**. If reader-bucket failures dropped near zero, the huge worktree diff on `reader.js` is the reason — jump to step 4 for Alfred's design calls, then step 5.

Then follow §2 in order. Every step has a STOP boundary; Architect pings Alfred at each PING marker and does not proceed without explicit go. No agent dispatch, no paid spend past the 60k Haiku cap, no `emit_cpt_v5.py` invocation, without Alfred's authorization.

### Critical Files for Implementation

- /Users/alfred/code/motoi-scheme/src/reader.js
- /Users/alfred/code/motoi-scheme/src/interp.js
- /Users/alfred/code/motoi-scheme/src/macro.js
- /Users/alfred/code/motoi-scheme/scratch/audit-books-values.py
- /Users/alfred/code/motoi-scheme/scratch/verify-reference-notes.py
